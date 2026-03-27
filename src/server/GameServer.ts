import { AbilityManager } from '#/common/Abilities';
import { BLOCK_DEFS, BlockTypes, hasBlockBehavior } from '#/block/BlockRegistry';
import { getItemMaxDurability, getItemToolStats, getItemToolType, sumEquippedArmorPointsFromSlots } from '#/common/ItemRegistry';
import { appendChatMessage, isContainerUiOpen, type GameContext } from '#/common/GameContext';
import {
  CHUNK_SIZE,
  type EntityInteractionAction,
  GRAVITY,
  JUMP_VELOCITY,
  WORLD_HEIGHT,
  PLAYER_START_SATURATION,
  type ToolType,
  type WorldPreset,
} from '#/common/types';
import { applyDefaultStartingInventoryIfEmpty, craft, Inventory } from './Inventory';
import { World, VILLAGE_CHEST_POSITIONS, getDungeonPlacement } from './World';
import { EntityManager, isNightTime } from './EntityManager';
import { handleCommand } from './CommandHandler';
import { blockRuleEngine } from './BlockRules';
import { planBreakBlock, planPlaceBlock } from './systems/blockActionSystem';
import { interactBlock } from './systems/blockInteractionSystem';
import { EatingSystem } from './systems/eatingSystem';
import { CraftingSystem } from './systems/craftingSystem';
import { FurnaceSystem, type TileEntitySnapshot, type FurnaceTileSnapshot } from './systems/furnaceSystem';
import { ChestSystem, type ChestTileSnapshot } from './systems/chestSystem';
import { MiningSystem } from './systems/miningSystem';
import { MilestoneTracker, type MilestoneId } from './systems/milestoneSystem';
import { getChunkCoordsInRadiusSorted, planVillageEntitySpawnsForChunk } from './systems/chunkSyncSystem';
import { LOOT_TABLES, generateLoot } from './systems/lootTableSystem';
import { resolveChunkRequestRadius } from './systems/chunkRequestSystem';
import {
  planEntityAttackDropSpawns,
  planEntityInteractionDropSpawns,
  resolveInteractionTrade,
  shouldDamageInteractionSelectedItem,
} from './systems/entityActionSystem';
import { tickItemDrops } from './systems/itemDropSystem';
import { isPlayerHeadInBlock, isPlayerInWater, isPlayerTouchingBlock } from './systems/playerBlockSampling';
import { applyFallImpactDamage, tickPlayerHazards } from './systems/playerHazardSystem';
import { damageRandomEquippedArmorPiece, mitigateDamageWithArmor } from './systems/playerArmorDamageSystem';
import { canOccupyAt, resolveHorizontalMovement } from './systems/playerMovementSystem';
import { gatePlayerEntityAttack, resolveAttackCooldownMs } from './systems/playerCombatSystem';
import { createItemDropEntries } from './systems/itemDropSpawnSystem';
import { shouldPruneChunk } from './systems/chunkPruneSystem';
import { bindServerC2SEvents } from './systems/serverEventBinding';
import { armorUiIndexToKey, isOffhandUiIndex, resolveInventoryClickRequest, resolveInventoryCollectIndex } from './systems/inventoryRequestSystem';
import {
  advancePlayerSurvival,
  createSurvivalAccumulators,
  SPRINT_HUNGER_MOVE_MULT,
  type SurvivalAccumulators,
} from './systems/playerSurvivalSystem';
import { createBrowserTickDriver, type TickDriver } from './SimulationClock';

const B = BlockTypes;

const TOOL_SPEED: Record<ToolType, Record<string, number>> = {
  hand: {},
  pickaxe: { stone: 3, cobblestone: 3, coal_ore: 3, iron_ore: 3, diamond_ore: 3, gold_ore: 3, bricks: 3, furnace: 3, ice: 2 },
  axe: { oak_log: 3, birch_log: 3, spruce_log: 3, oak_planks: 3, crafting_table: 3, oak_leaves: 2, spruce_leaves: 2, birch_leaves: 2 },
  shovel: { dirt: 3, grass: 3, sand: 3, gravel: 3, clay: 3, snow: 3, moss: 2 },
  hoe: {},
  sword: {},
  shears: { oak_leaves: 4, spruce_leaves: 4, birch_leaves: 4 },
};
const CHUNK_PRUNE_INTERVAL_TICKS = 60;
const CHUNK_PRUNE_KEEP_RADIUS_PADDING = 6;

export class GameServer {
  world: World;
  inventory: Inventory;
  abilities: AbilityManager;
  entityManager: EntityManager;
  ctx: GameContext;
  flySpeed = 1;

  get seed(): number { return this.world.seed; }
  get isFlying(): boolean { return this.abilities.has('fly'); }
  set isFlying(v: boolean) { this.abilities.set('fly', v); this.syncAbilities(); }
  get isRunning(): boolean { return this.running; }

  private unsubs: (() => void)[] = [];
  private tickDriver: TickDriver;
  private nextDropId = 0;
  private nextChatMessageId = 0;
  private seededVillageChunks = new Set<string>();
  private sentChunkKeys = new Set<string>();
  private running = false;
  private tickCount = 0;
  private spawnPosition = { x: 8.5, y: 0, z: 8.5 };
  private survivalAcc: SurvivalAccumulators = createSurvivalAccumulators();
  private survivalMoveDistance = 0;
  private readonly eatingSystem = new EatingSystem();
  private readonly craftingSystem = new CraftingSystem();
  readonly furnaceSystem = new FurnaceSystem();
  readonly chestSystem: ChestSystem;
  private readonly miningSystem: MiningSystem;
  readonly milestones = new MilestoneTracker();
  private wasNightTime = false;

  /** 3×3 shapeless crafting grid when using a crafting table (server-authoritative). */
  get craftTableGrid() {
    return this.craftingSystem.grid;
  }

  snapshotTileEntities(): TileEntitySnapshot {
    return {
      furnaces: this.furnaceSystem.snapshotTiles(),
      chests: this.chestSystem.snapshotTiles(),
    };
  }

  loadTileEntities(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const data = raw as Partial<TileEntitySnapshot>;
    if (Array.isArray(data.furnaces)) {
      this.furnaceSystem.loadTiles(data.furnaces as Array<[string, FurnaceTileSnapshot]>);
    }
    if (Array.isArray((data as Record<string, unknown>).chests)) {
      this.chestSystem.loadTiles((data as Record<string, unknown>).chests as Array<[string, ChestTileSnapshot]>);
    }
  }

  constructor(ctx: GameContext, seed?: number, tickDriver?: TickDriver, preset?: WorldPreset) {
    this.tickDriver = tickDriver ?? createBrowserTickDriver();
    this.ctx = ctx;
    this.world = new World(seed);
    this.inventory = new Inventory(36);
    this.abilities = new AbilityManager();
    applyDefaultStartingInventoryIfEmpty(this.inventory, preset ?? 'demo');

    const sy = this.world.findSpawnY(8, 8);
    const s = ctx.state;
    this.spawnPosition = { x: 8.5, y: sy + 0.1, z: 8.5 };
    s.player.position = { ...this.spawnPosition };
    s.seed = this.world.seed;

    this.entityManager = new EntityManager(ctx, this.world);
    this.chestSystem = new ChestSystem(ctx, this.inventory, this);
    this.miningSystem = new MiningSystem({
      world: this.world,
      inventory: this.inventory,
      ctx: this.ctx,
      abilities: this.abilities,
      applyInstantBreak: (x, y, z) => this.applyInstantBreak(x, y, z),
      isBlockReachable: (x, y, z) => this.isBlockReachable(x, y, z),
      getToolSpeedMultiplier: (blockName) => this.getToolSpeedMultiplier(blockName),
    });
    this.syncInventory();
    this.syncAbilities();
    this.listen();
  }

  private listen() {
    this.unsubs.push(...bindServerC2SEvents(this.ctx.c2s, {
      requestChunks: ({ cx, cz, radius }) => this.sendChunks(cx, cz, radius),
      attackEntity: ({ id }) => this.attackEntity(id),
      breakBlock: ({ x, y, z }) => this.handleC2sBreakBlock(x, y, z),
      startBreak: ({ x, y, z }) => this.handleStartBreak(x, y, z),
      cancelBreak: (_payload) => this.handleCancelBreak(),
      interactBlock: ({ x, y, z, action }) => interactBlock(this, () => this.eatingSystem.cancel(), x, y, z, action),
      placeBlock: ({ x, y, z, blockId }) => this.placeBlock(x, y, z, blockId),
      interactEntity: ({ id, action }) => this.interactEntity(id, action === 'use' ? 'auto' : action),
      craft: ({ recipeIndex }) => {
        craft(this.inventory, recipeIndex);
        this.syncInventory();
      },
      chat: ({ message }) => {
        if (message.startsWith('/')) {
          handleCommand(message.slice(1), this);
        } else {
          this.addChatMessage('Player', message);
        }
      },
      command: ({ command }) => handleCommand(command, this),
      swapOffhand: () => {
        this.inventory.swapSelectedWithOffhand();
        this.syncInventory();
      },
      inventoryClick: (payload) => {
        const request = resolveInventoryClickRequest({
          index: payload.index,
          button: payload.button,
          shift: payload.shift,
          inventorySize: this.inventory.size,
          area: payload.area,
        });
        if (!request) return;
        if (request.area === 'craftResult') {
          const cursorBefore = this.inventory.cursor?.itemId ?? null;
          this.craftingSystem.clickCraftTableResult(this.inventory, request.button);
          const cursorAfter = this.inventory.cursor?.itemId ?? null;
          if (cursorAfter != null && cursorAfter !== cursorBefore) {
            const craftMilestone = this.milestones.checkCraft(cursorAfter);
            if (craftMilestone) this.tryCompleteMilestone(craftMilestone);
          }
          this.syncInventory();
          return;
        }
        if (request.area === 'player' && request.shift && this.ctx.state.ui.chestOpen) {
          this.chestSystem.shiftClickPlayerToChest(request.index);
          this.syncInventory();
          return;
        }
        if (request.area === 'player' && request.shift && this.ctx.state.ui.furnaceOpen) {
          this.furnaceSystem.shiftClickPlayerToFurnace(this.inventory, request.index);
          this.furnaceSystem.syncFurnaceToState(this.ctx);
          this.syncInventory();
          return;
        }
        if (request.area === 'player') {
          if (isOffhandUiIndex(request.index, this.inventory.size)) {
            this.inventory.clickOffhandSlot(request.button, request.shift);
          } else {
            const armorKey = armorUiIndexToKey(request.index, this.inventory.size);
            if (armorKey) {
              this.inventory.clickArmorSlot(armorKey, request.button, request.shift);
            } else {
              this.inventory.clickSlot(request.index, request.button, request.shift);
            }
          }
        } else {
          this.inventory.clickCraftTableSlot(this.craftTableGrid, request.index, request.button, request.shift);
        }
        this.syncInventory();
      },
      inventoryCollect: (payload) => {
        const area = payload.area ?? 'player';
        if (area === 'craftTable') {
          const resolvedIndex = resolveInventoryCollectIndex({
            index: payload.index,
            inventorySize: 9,
          });
          if (resolvedIndex == null) return;
          this.inventory.collectSimilarCraftTable(this.craftTableGrid, resolvedIndex);
          this.syncInventory();
          return;
        }
        const resolvedIndex = resolveInventoryCollectIndex({
          index: payload.index,
          inventorySize: this.inventory.size,
          area: payload.area,
        });
        if (resolvedIndex == null) return;
        const armorKey = armorUiIndexToKey(resolvedIndex, this.inventory.size);
        if (armorKey) {
          this.inventory.collectSimilarArmor(armorKey);
        } else {
          this.inventory.collectSimilar(resolvedIndex);
        }
        this.syncInventory();
      },
      inventoryClose: () => {
        this.inventory.stowCraftTableGrid(this.craftTableGrid);
        this.inventory.stowCursor();
        this.syncInventory();
      },
      furnaceClick: (payload) => {
        this.furnaceSystem.click(this, payload.slot, payload.button, !!payload.shift);
        if (payload.slot === 'output') {
          const cursorItem = this.inventory.cursor?.itemId;
          if (cursorItem != null) {
            const smeltMilestone = this.milestones.checkSmeltOutput(cursorItem);
            if (smeltMilestone) this.tryCompleteMilestone(smeltMilestone);
          }
        }
      },
      furnaceClose: () => {
        this.furnaceSystem.closeFurnace(this);
      },
      chestClick: (payload: { slotIndex: number; button: 'left' | 'right'; shift?: boolean }) => {
        this.chestSystem.handleSlotClick(payload.slotIndex, payload.button, !!payload.shift);
      },
      chestClose: () => {
        this.chestSystem.handleClose();
      },
      useItem: () => {
        if (isContainerUiOpen(this.ctx.state.ui)) return;
        this.eatingSystem.handleUseItem({
          selectedIndex: this.ctx.state.inventory.selectedIndex,
          inventory: this.inventory,
          player: this.ctx.state.player,
        });
      },
    }));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.primeWorld();
    this.tickDriver.start((dt) => this.tick(dt), 16);
  }

  pause() {
    this.miningSystem.cancel();
    if (!this.running) return;
    this.tickDriver.stop();
    this.running = false;
  }

  stop() {
    this.pause();
    for (const unsub of this.unsubs) unsub();
    this.unsubs.length = 0;
  }

  primeWorld(radius = 5) {
    this.syncInventory();
    this.syncChunksAroundWorldPos(
      this.ctx.state.player.position.x,
      this.ctx.state.player.position.z,
      radius,
    );
  }

  /** Real seconds for one full 24000-tick MC day (20 min default). timeOfDay 0–1 == tick/24000. */
  private dayDuration = 1200;

  tick(dt: number) {
    const s = this.ctx.state;
    const realDt = dt;
    s.player.attackCooldownMs = Math.max(0, s.player.attackCooldownMs - realDt * 1000);
    s.player.hurtCooldownMs = Math.max(0, s.player.hurtCooldownMs - realDt * 1000);

    dt = Math.min(realDt, 0.1);

    s.timeOfDay = (s.timeOfDay + dt / this.dayDuration) % 1;

    const night = isNightTime(s.timeOfDay);
    if (night && !this.wasNightTime) {
      this.addChatMessage('§7[Server]', '§c☾ Night is falling... hostile creatures stir!');
    } else if (!night && this.wasNightTime) {
      this.addChatMessage('§7[Server]', '§e☀ Dawn breaks! The sun rises.');
      const ms = this.milestones.checkNightSurvived();
      if (ms && s.player.hp > 0) this.tryCompleteMilestone(ms);
    }
    this.wasNightTime = night;

    blockRuleEngine.tick(this, realDt);

    const entityTick = this.entityManager.tick(realDt, s.player.position);
    if (entityTick.playerHits.length > 0 && s.player.hurtCooldownMs <= 0) {
      const hit = entityTick.playerHits[0];
      const ap = sumEquippedArmorPointsFromSlots(this.inventory.armor);
      const mitigated = ap > 0 ? mitigateDamageWithArmor(hit.damage, ap) : hit.damage;
      const dealt = Math.max(0, Math.floor(mitigated));
      s.player.hurtCooldownMs = 600;
      if (dealt > 0) {
        s.player.hp = Math.max(0, s.player.hp - dealt);
        damageRandomEquippedArmorPiece(this.inventory.armor);
        this.syncInventory();
        this.addChatMessage('§7[Server]', `§c${hit.message} (${s.player.hp}/${s.player.maxHp})`);
      }
      if (s.player.hp <= 0) {
        this.respawnPlayer();
      }
    }
    const touchingLava = isPlayerTouchingBlock(this.world, s.player.position, B.LAVA);
    const headInWater = isPlayerHeadInBlock(this.world, s.player.position, B.WATER);
    const headInLava = isPlayerHeadInBlock(this.world, s.player.position, B.LAVA);
    const armorPts = sumEquippedArmorPointsFromSlots(this.inventory.armor);
    const hazard = tickPlayerHazards({
      player: s.player,
      realDt,
      touchingLava,
      headInWater,
      headInLava,
      armorPoints: armorPts,
      onMitigatedEnvironmentalDamage: () => {
        damageRandomEquippedArmorPiece(this.inventory.armor);
        this.syncInventory();
      },
    });
    for (const message of hazard.messages) {
      this.addChatMessage('§7[Server]', message);
    }
    if (hazard.didDie) {
      this.respawnPlayer();
    }

    const dropTick = tickItemDrops({
      drops: s.itemDrops,
      dt,
      playerPosition: s.player.position,
      findLocalSupportY: (x, z, fromY, toY) => this.world.findLocalSupportY(x, z, fromY, toY),
      onPickup: (itemId) => {
        this.inventory.addItem(itemId, 1);
      },
    });
    if (dropTick.pickedUpCount > 0) {
      this.syncInventory();
    }

    const flying = this.isFlying;
    const waterState = isPlayerInWater(this.world, s.player.position, B.WATER);
    const inWater = waterState.feet || waterState.body;
    if (!flying && inWater) {
      const WATER_GRAVITY = GRAVITY * 0.15;
      const WATER_BUOYANCY = 6.0;
      const WATER_DRAG = 0.85;
      s.player.vy -= WATER_GRAVITY * dt;
      if (s.player.vy < -2) {
        s.player.vy += WATER_BUOYANCY * dt;
      }
      s.player.vy *= Math.pow(WATER_DRAG, dt * 20);
      if (s.player.jumping) {
        s.player.vy = Math.max(s.player.vy, 3.5);
      } else if (s.player.sneaking) {
        s.player.vy = Math.min(s.player.vy, -2.5);
      }
      if (s.player.vy < -4) s.player.vy = -4;
    } else if (!flying) {
      s.player.vy -= GRAVITY * dt;
      if (s.player.vy < -30) s.player.vy = -30;
    } else {
      if (s.player.jumping && s.player.sneaking) {
        s.player.vy = 0;
      } else if (s.player.jumping) {
        s.player.vy = 8 * this.flySpeed;
      } else if (s.player.sneaking) {
        s.player.vy = -8 * this.flySpeed;
      } else {
        s.player.vy *= 0.85;
      }
    }

    const ny = s.player.position.y + s.player.vy * dt;
    const noclip = this.abilities.has('noclip');
    let landingImpactSpeed = 0;
    if (noclip || canOccupyAt(this.world, s.player.position.x, ny, s.player.position.z)) {
      s.player.position.y = ny;
    } else {
      if (s.player.vy < 0) {
        landingImpactSpeed = Math.max(landingImpactSpeed, -s.player.vy);
        s.player.position.y = Math.floor(s.player.position.y) + 0.001;
      }
      s.player.vy = 0;
    }
    if (s.player.position.y < 0) {
      if (s.player.vy < 0) {
        landingImpactSpeed = Math.max(landingImpactSpeed, -s.player.vy);
      }
      s.player.position.y = 0;
      s.player.vy = 0;
    }
    if (s.player.position.y > WORLD_HEIGHT - 1) {
      s.player.position.y = WORLD_HEIGHT - 1;
      if (s.player.vy > 0) s.player.vy = 0;
    }
    s.player.onGround = !flying && !canOccupyAt(this.world, s.player.position.x, s.player.position.y - 0.05, s.player.position.z);
    if (!flying && !noclip && landingImpactSpeed > 0) {
      const fallResult = applyFallImpactDamage({
        player: s.player,
        landingImpactSpeed,
        flying,
        noclip,
        inWater: (() => {
          const w = isPlayerInWater(this.world, s.player.position, B.WATER);
          return w.feet || w.body || w.head;
        })(),
        armorPoints: armorPts,
        onMitigatedFallDamage: () => {
          damageRandomEquippedArmorPiece(this.inventory.armor);
          this.syncInventory();
        },
      });
      if (fallResult.message) {
        this.addChatMessage('§7[Server]', fallResult.message);
      }
      if (fallResult.didDie) {
        this.respawnPlayer();
      }
    }

    const biome = this.world.getBiomeAt(
      Math.floor(s.player.position.x),
      Math.floor(s.player.position.z),
    );
    s.stats.biome = biome.name;

    const depthMs = this.milestones.checkDepth(s.player.position.y);
    if (depthMs) this.tryCompleteMilestone(depthMs);

    const moveDist = this.survivalMoveDistance;
    this.survivalMoveDistance = 0;
    const survivalDt = Math.min(realDt, 0.25);
    advancePlayerSurvival(this.survivalAcc, {
      player: s.player,
      realDt: survivalDt,
      moveDistanceBlocks: moveDist,
      creative: this.abilities.has('creative'),
      flying: this.isFlying,
      isNightTime: night,
    });
    if (s.player.hp <= 0) {
      this.respawnPlayer();
    }
    this.eatingSystem.tick(realDt, {
      selectedIndex: s.inventory.selectedIndex,
      inventory: this.inventory,
      player: s.player,
      syncInventory: () => this.syncInventory(),
    });
    if (s.player.targetBlock) {
      const state = this.world.getResolvedBlockState(
        s.player.targetBlock.x,
        s.player.targetBlock.y,
        s.player.targetBlock.z,
      );
      if (state && Object.keys(state).length > 0) {
        s.player.targetBlock.state = state;
      } else {
        delete s.player.targetBlock.state;
      }
    }

    this.miningSystem.tick(dt);
    this.furnaceSystem.tick(this, dt);

    this.tickCount++;
    if (this.tickCount % CHUNK_PRUNE_INTERVAL_TICKS === 0) {
      this.pruneFarChunks();
    }
  }

  private pruneFarChunks() {
    const centerCx = Math.floor(this.ctx.state.player.position.x / CHUNK_SIZE);
    const centerCz = Math.floor(this.ctx.state.player.position.z / CHUNK_SIZE);
    const keepRadius = this.ctx.state.settings.renderDistance + CHUNK_PRUNE_KEEP_RADIUS_PADDING;
    for (const [key, chunk] of this.world.chunks) {
      if (!shouldPruneChunk({
        key,
        dirty: chunk.dirty,
        centerCx,
        centerCz,
        keepRadius,
      })) continue;
      this.world.chunks.delete(key);
      this.seededVillageChunks.delete(key);
      const [ckx, ckz] = key.split(',').map(Number);
      this.entityManager.removeEntitiesInChunk(ckx, ckz);
    }
  }

  getSpeedMultiplier(): number {
    if (this.isFlying) return this.flySpeed;
    const waterState = isPlayerInWater(this.world, this.ctx.state.player.position, B.WATER);
    if (waterState.feet || waterState.body) return 0.55;
    return 1;
  }

  applyMovement(dx: number, dz: number) {
    if (dx !== 0 || dz !== 0) {
      this.eatingSystem.cancel();
    }
    const mult = this.getSpeedMultiplier();
    dx *= mult;
    dz *= mult;
    const s = this.ctx.state;
    const prevX = s.player.position.x;
    const prevZ = s.player.position.z;
    const noclip = this.abilities.has('noclip');
    const flying = this.isFlying;
    const moved = resolveHorizontalMovement({
      world: this.world,
      x: s.player.position.x,
      y: s.player.position.y,
      z: s.player.position.z,
      dx,
      dz,
      noclip,
      flying,
      onGround: s.player.onGround,
    });
    s.player.position.x = moved.x;
    s.player.position.z = moved.z;
    const dist = Math.hypot(s.player.position.x - prevX, s.player.position.z - prevZ);
    if (dist > 1e-8 && !this.abilities.has('creative') && !flying) {
      const sprintMult = s.player.sprinting ? SPRINT_HUNGER_MOVE_MULT : 1;
      this.survivalMoveDistance += dist * sprintMult;
    }
    if (moved.y != null && s.player.onGround) {
      s.player.position.y = moved.y;
      s.player.vy = 0;
    }
  }

  handleJump() {
    const s = this.ctx.state;
    s.player.jumping = true;
    if (!this.isFlying && s.player.onGround) s.player.vy = JUMP_VELOCITY;
  }

  addChatMessage(sender: string, message: string) {
    appendChatMessage(this.ctx.state, {
      id: `${Date.now()}-${this.nextChatMessageId++}`,
      sender: sender.replace(/§./g, ''),
      message,
      timestamp: Date.now(),
    });
  }

  tryCompleteMilestone(id: MilestoneId): boolean {
    const def = this.milestones.complete(id);
    if (!def) return false;
    this.addChatMessage('', def.announce);
    for (const item of def.reward.items) {
      this.inventory.addItem(item.itemId, item.count);
    }
    if (def.reward.message) {
      this.addChatMessage('', def.reward.message);
    }
    if (def.reward.items.length > 0) {
      this.syncInventory();
    }
    return true;
  }

  healPlayer(amount: number): { healed: number; hp: number; maxHp: number } {
    const s = this.ctx.state;
    const safeAmount = Math.max(0, amount);
    const nextHp = Math.min(s.player.maxHp, s.player.hp + safeAmount);
    const healed = nextHp - s.player.hp;
    s.player.hp = nextHp;
    return { healed, hp: s.player.hp, maxHp: s.player.maxHp };
  }

  killPlayer(reason = 'Killed by command') {
    const s = this.ctx.state;
    s.player.hp = 0;
    this.addChatMessage('§7[Server]', `§c${reason}`);
    this.respawnPlayer();
  }

  private respawnPlayer() {
    this.eatingSystem.cancel();
    const s = this.ctx.state;
    s.player.position = { ...this.spawnPosition };
    s.player.vy = 0;
    s.player.hp = s.player.maxHp;
    s.player.hunger = s.player.maxHunger;
    s.player.saturation = PLAYER_START_SATURATION;
    s.player.airMs = 10_000;
    s.player.hurtCooldownMs = 1_000;
    this.survivalAcc = createSurvivalAccumulators();
    this.addChatMessage('§7[Server]', '§eYou died and respawned at spawn');
  }

  interactEntity(id: number, action: EntityInteractionAction | 'auto' = 'auto') {
    this.eatingSystem.cancel();
    const selectedItemId = this.inventory.slots[this.ctx.state.inventory.selectedIndex]?.itemId;
    const activeTool = getItemToolType(selectedItemId) ?? this.ctx.state.player.tool;
    const requestedAction: EntityInteractionAction = action === 'auto' ? 'use' : action;
    const result = this.entityManager.interactEntity(id, requestedAction, {
      tool: activeTool,
      itemId: selectedItemId ?? null,
    });
    const trade = resolveInteractionTrade({
      result,
      hasRequiredItems: (offer) => this.inventory.hasItem(offer.wantItemId, offer.wantCount),
    });
    let inventoryDirty = false;
    if (trade.applyTradeOffer) {
      this.inventory.removeItem(trade.applyTradeOffer.wantItemId, trade.applyTradeOffer.wantCount);
      this.inventory.addItem(trade.applyTradeOffer.giveItemId, trade.applyTradeOffer.giveCount);
      inventoryDirty = true;
      const tradeMilestone = this.milestones.checkTrade();
      if (tradeMilestone) this.tryCompleteMilestone(tradeMilestone);
    }

    if (result.ok && result.replaceSelectedItem !== undefined) {
      this.inventory.setSelectedSlot(result.replaceSelectedItem);
      inventoryDirty = true;
    }
    if (shouldDamageInteractionSelectedItem({
      result,
      requestedAction: action,
      selectedItemId: selectedItemId ?? null,
      selectedItemMaxDurability: getItemMaxDurability(selectedItemId),
    })) {
      this.inventory.damageSelectedItem(1);
      inventoryDirty = true;
    }
    if (inventoryDirty) {
      this.syncInventory();
    }
    const entity = this.entityManager.getEntity(id);
    const dropSpawns = planEntityInteractionDropSpawns({
      result,
      entityPosition: entity ? entity.position : null,
    });
    for (const spawn of dropSpawns) {
      this.spawnItemDrop(spawn.itemId, spawn.count, spawn.position, spawn.velocity);
    }
    this.addChatMessage('§7[Server]', `${trade.success ? '§a' : '§c'}${trade.message}`);
  }

  attackEntity(id: number) {
    this.eatingSystem.cancel();
    const selectedItemId = this.inventory.getSelectedItem();
    const activeTool = getItemToolType(selectedItemId) ?? this.ctx.state.player.tool;
    const toolStats = getItemToolStats(selectedItemId);
    const s = this.ctx.state;
    const gate = gatePlayerEntityAttack({
      activeTool,
      attackCooldownMs: s.player.attackCooldownMs,
    });
    if (!gate.allowed) {
      this.addChatMessage('§7[Server]', gate.message ?? '§cAttack blocked');
      return;
    }
    const result = this.entityManager.attackEntity(id, {
      tool: activeTool,
      itemId: selectedItemId ?? null,
      damage: toolStats?.attackDamage,
      attackerPosition: { ...s.player.position },
    });
    if (result.ok && selectedItemId != null) {
      this.inventory.damageSelectedItem(1);
      this.syncInventory();
    }
    if (result.ok) {
      s.player.attackCooldownMs = resolveAttackCooldownMs(toolStats);
    }
    const attackDropSpawns = planEntityAttackDropSpawns({
      result,
      playerPosition: s.player.position,
    });
    for (const spawn of attackDropSpawns) {
      this.spawnItemDrop(spawn.itemId, spawn.count, spawn.position);
    }
    this.addChatMessage('§7[Server]', `${result.ok ? '§a' : '§c'}${result.message}`);
  }

  spawnItemDrop(
    itemId: number,
    count: number,
    position: { x: number; y: number; z: number },
    velocity?: { x: number; y: number; z: number },
  ) {
    const created = createItemDropEntries({
      startDropId: this.nextDropId,
      itemId,
      count,
      position,
      velocity,
    });
    this.nextDropId = created.nextDropId;
    this.ctx.state.itemDrops.push(...created.drops);
  }

  syncInventory() {
    const s = this.ctx.state;
    s.inventory.slots = this.inventory.snapshot();
    s.player.tool = getItemToolType(this.inventory.getSelectedItem()) ?? 'hand';
    s.inventory.offhand = this.inventory.snapshotOffhand();
    s.inventory.cursor = this.inventory.snapshotCursor();
    s.inventory.craftTableSlots = this.craftTableGrid.map((x) => (x ? { ...x } : null));
    s.player.armor = this.inventory.snapshotArmor();
  }

  syncAbilities() {
    const s = this.ctx.state;
    s.abilities = this.abilities.snapshot();
  }

  reachDistance = Infinity;

  isBlockReachable(x: number, y: number, z: number): boolean {
    if (this.isFlying || this.abilities.has('noclip')) return true;
    const p = this.ctx.state.player.position;
    const dx = x + 0.5 - p.x, dy = y + 0.5 - (p.y + 1.6), dz = z + 0.5 - p.z;
    return dx * dx + dy * dy + dz * dz <= this.reachDistance * this.reachDistance;
  }

  /**
   * Instant break: creative / hardness≤0 fallback via `c2s:breakBlock`, or mining completion.
   * Survival clients should use `c2s:startBreak` + timer for hard blocks.
   */
  applyInstantBreak(x: number, y: number, z: number) {
    if (!this.isBlockReachable(x, y, z)) return;
    const block = this.world.getBlock(x, y, z);
    const selectedItemId = this.inventory.getSelectedItem();
    const plan = planBreakBlock({
      blockId: block,
      selectedItemId,
      playerTool: this.ctx.state.player.tool,
    });
    if (!plan.shouldBreak) return;

    if (block === B.FURNACE) {
      this.furnaceSystem.onFurnaceDestroyed(this, x, y, z);
    }
    if (block === B.CHEST) {
      const chestDrops = this.chestSystem.onChestDestroyed(x, y, z);
      for (const drop of chestDrops) {
        this.spawnItemDrop(drop.itemId, drop.count, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      }
    }
    blockRuleEngine.applyOnBreak(this, { x, y, z, blockId: block });
    this.world.setBlock(x, y, z, B.AIR);
    for (const drop of plan.drops) {
      this.spawnItemDrop(drop.itemId, drop.count, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    }
    if (plan.warningMessage) {
      this.addChatMessage('§7[Server]', plan.warningMessage);
    }
    this.ctx.s2c.emit('s2c:blockChange', { x, y, z, blockId: B.AIR });
    if (plan.shouldDamageSelectedItem) {
      this.inventory.damageSelectedItem(1);
      this.syncInventory();
    }
    const blockMilestone = this.milestones.checkBlockBreak(block);
    if (blockMilestone) this.tryCompleteMilestone(blockMilestone);
  }

  /** `c2s:breakBlock` — only creative or instamine (hardness ≤ 0). */
  private handleC2sBreakBlock(x: number, y: number, z: number) {
    this.eatingSystem.cancel();
    if (!this.isBlockReachable(x, y, z)) return;
    const blockId = this.world.getBlock(x, y, z);
    const hardness = BLOCK_DEFS[blockId]?.hardness ?? 1;
    if (!this.abilities.has('creative') && hardness > 0) return;
    this.miningSystem.cancel();
    this.applyInstantBreak(x, y, z);
  }

  private handleStartBreak(x: number, y: number, z: number) {
    this.eatingSystem.cancel();
    this.miningSystem.handleStartBreak(x, y, z);
  }

  private handleCancelBreak() {
    this.miningSystem.cancel();
  }

  private placeBlock(x: number, y: number, z: number, blockId: number) {
    this.eatingSystem.cancel();
    if (!this.isBlockReachable(x, y, z)) return;
    const s = this.ctx.state;
    const selectedItemId = this.inventory.getSelectedItem();
    const plan = planPlaceBlock({
      isSolidAtTarget: this.world.isSolid(x, y, z),
      playerPosition: s.player.position,
      x,
      y,
      z,
      blockId,
      selectedItemId,
      isCreative: this.abilities.has('creative'),
      hasInventoryBlock: this.inventory.hasItem(blockId),
    });
    if (!plan.allowed) return;

    if (hasBlockBehavior(blockId, 'crop')) {
      const below = this.world.getBlock(x, y - 1, z);
      if (!hasBlockBehavior(below, 'farmland')) return;
    }

    this.world.setBlock(x, y, z, blockId);
    blockRuleEngine.applyOnPlace(this, {
      x,
      y,
      z,
      blockId,
      targetBlock: this.ctx.state.player.targetBlock,
      selectedItemId,
      placingViaContainer: plan.placingViaContainer,
    });
    if (!this.abilities.has('creative')) {
      if (plan.placingViaContainer && selectedItemId != null) {
        const handled = blockRuleEngine.applyOnPlaceConsume(this, {
          x,
          y,
          z,
          blockId,
          targetBlock: this.ctx.state.player.targetBlock,
          selectedItemId,
          placingViaContainer: plan.placingViaContainer,
        });
        if (!handled) {
          this.inventory.setSelectedSlot(null);
        }
      } else {
        this.inventory.removeItem(blockId, 1);
      }
    }
    this.ctx.s2c.emit('s2c:blockChange', { x, y, z, blockId });
    this.syncInventory();
  }

  private sendChunks(cx: number, cz: number, radius: number) {
    const safeRadius = resolveChunkRequestRadius({
      requestedRadius: radius,
      renderDistance: this.ctx.state.settings.renderDistance,
    });
    const keepKeys = new Set<string>();
    for (const coord of getChunkCoordsInRadiusSorted(cx, cz, safeRadius)) {
      const key = `${coord.cx},${coord.cz}`;
      keepKeys.add(key);
      const chunk = this.world.getChunk(coord.cx, coord.cz);
      if (!this.sentChunkKeys.has(key) || chunk.dirty) {
        this.ctx.s2c.emit('s2c:chunk', this.world.toChunkDataWithFacings(chunk));
        chunk.dirty = false;
        this.sentChunkKeys.add(key);
      }
      this.seedVillageEntitiesForChunk(coord.cx, coord.cz);
    }
    for (const key of this.sentChunkKeys) {
      if (!keepKeys.has(key)) this.sentChunkKeys.delete(key);
    }
  }

  private seedVillageEntitiesForChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    if (this.seededVillageChunks.has(key)) return;
    this.seededVillageChunks.add(key);
    const plans = planVillageEntitySpawnsForChunk({
      cx,
      cz,
      seed: this.seed,
      getBiomeAt: (x, z) => this.world.getBiomeAt(x, z),
      findSpawnY: (x, z) => this.world.findSpawnY(x, z),
    });

    for (const plan of plans) {
      const entity = this.entityManager.spawn(plan.type, { x: plan.x, y: plan.y, z: plan.z });
      if (entity && plan.type === 'villager' && plan.profession) {
        this.entityManager.setEntityAttribute(entity.id, 'profession', plan.profession);
      }
    }
    if (plans.length > 0) {
      this.seedVillageChests(cx, cz);
      const villageMilestone = this.milestones.checkVillageDiscovery();
      if (villageMilestone) this.tryCompleteMilestone(villageMilestone);
    }
    this.seedDungeonChest(cx, cz);
  }

  private seedVillageChests(cx: number, cz: number) {
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    for (const pos of VILLAGE_CHEST_POSITIONS) {
      const wx = originX + pos.localX;
      const wz = originZ + pos.localZ;
      const wy = this.world.findSpawnY(wx, wz);
      for (let y = wy; y >= wy - 3; y--) {
        if (this.world.getBlock(wx, y, wz) !== B.CHEST) continue;
        const key = `${wx},${y},${wz}`;
        if (this.chestSystem.hasTile(key)) break;
        const table = LOOT_TABLES[pos.lootTable];
        if (!table) break;
        const loot = generateLoot(table);
        const tile = this.chestSystem.getOrCreateTile(key);
        for (let i = 0; i < loot.length && i < tile.slots.length; i++) {
          tile.slots[i] = loot[i];
        }
        break;
      }
    }
  }

  private seedDungeonChest(cx: number, cz: number) {
    const dungeon = getDungeonPlacement(cx, cz, this.world.seed);
    if (!dungeon) return;
    const chestX = dungeon.wx + 2;
    const chestZ = dungeon.wz + 2;
    const chestY = dungeon.wy + 1;
    if (this.world.getBlock(chestX, chestY, chestZ) !== B.CHEST) return;
    const key = `${chestX},${chestY},${chestZ}`;
    if (this.chestSystem.hasTile(key)) return;
    const loot = generateLoot(LOOT_TABLES.dungeon);
    const tile = this.chestSystem.getOrCreateTile(key);
    for (let i = 0; i < loot.length && i < tile.slots.length; i++) {
      tile.slots[i] = loot[i];
    }
    const ms = this.milestones.checkDungeonDiscovery();
    if (ms) this.tryCompleteMilestone(ms);
  }

  syncChunksAroundWorldPos(x: number, z: number, radius: number) {
    this.sendChunks(
      Math.floor(x / CHUNK_SIZE),
      Math.floor(z / CHUNK_SIZE),
      radius,
    );
  }

  getToolSpeedMultiplier(blockName: string): number {
    return TOOL_SPEED[this.ctx.state.player.tool]?.[blockName.toLowerCase()] ?? 1;
  }
}
