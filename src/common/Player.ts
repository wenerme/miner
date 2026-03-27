import type { GameContext } from './GameContext';
import { getItemBlockId, getItemDef, getItemPlaceBlockId } from './ItemRegistry';
import type { ToolType, Vec3, ViewMode } from './types';

/**
 * Player action interface — provides methods to interact with the game.
 * Reads state from GameContext's valtio proxy, emits c2s protocol events.
 * Same interface works for human input, AI agents, and NPCs.
 */
export class Player {
  private ctx: GameContext;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  get position(): Vec3 { return this.ctx.state.player.position; }
  get yaw(): number { return this.ctx.state.player.yaw; }
  get pitch(): number { return this.ctx.state.player.pitch; }
  get onGround(): boolean { return this.ctx.state.player.onGround; }
  get selectedSlot(): number { return this.ctx.state.inventory.selectedIndex; }
  get inventory() { return this.ctx.state.inventory.slots; }
  get targetBlock() { return this.ctx.state.player.targetBlock; }
  get targetEntity() { return this.ctx.state.player.targetEntity; }
  get viewMode(): ViewMode { return this.ctx.state.player.viewMode; }
  get tool(): ToolType { return this.ctx.state.player.tool; }
  get isFlying(): boolean { return !!this.ctx.state.abilities.fly; }

  look(yaw: number, pitch: number) {
    this.ctx.state.player.yaw = yaw;
    this.ctx.state.player.pitch = pitch;
  }

  jump() {
    this.ctx.state.player.jumping = true;
  }

  sneak(down: boolean) {
    this.ctx.state.player.sneaking = down;
  }

  /** Left-click start: survival uses timed mining; creative keeps instant `c2s:breakBlock`. */
  startBreak() {
    const entity = this.targetEntity;
    if (entity) {
      this.ctx.c2s.emit('c2s:attackEntity', { id: entity.id });
      return;
    }
    const t = this.targetBlock;
    if (!t) return;
    if (this.ctx.state.abilities.creative) {
      this.ctx.c2s.emit('c2s:breakBlock', { x: t.x, y: t.y, z: t.z });
      return;
    }
    this.ctx.c2s.emit('c2s:startBreak', { x: t.x, y: t.y, z: t.z });
  }

  cancelBreak() {
    this.ctx.c2s.emit('c2s:cancelBreak', {});
  }

  /** Instant break fallback (creative / bots); survival hard blocks use `startBreak`. */
  breakBlock() {
    const entity = this.targetEntity;
    if (entity) {
      this.ctx.c2s.emit('c2s:attackEntity', { id: entity.id });
      return;
    }
    const t = this.targetBlock;
    if (!t) return;
    this.ctx.c2s.emit('c2s:breakBlock', { x: t.x, y: t.y, z: t.z });
  }

  placeBlock() {
    const entity = this.targetEntity;
    if (entity) {
      this.ctx.c2s.emit('c2s:interactEntity', { id: entity.id, action: 'use' });
      return;
    }
    const t = this.targetBlock;
    const sel = this.inventory[this.selectedSlot];
    const selectedItem = getItemDef(sel?.itemId);
    const placeBlockId = getItemPlaceBlockId(sel?.itemId);
    const blockId = getItemBlockId(sel?.itemId);
    if (!t && sel && selectedItem?.kind === 'food') {
      this.ctx.c2s.emit('c2s:useItem', {});
      return;
    }
    if (!t || !sel) return;
    if (placeBlockId != null) {
      this.ctx.c2s.emit('c2s:placeBlock', {
        x: Math.floor(t.x + t.nx),
        y: Math.floor(t.y + t.ny),
        z: Math.floor(t.z + t.nz),
        blockId: placeBlockId,
      });
      return;
    }
    if (selectedItem?.kind === 'tool' || blockId == null) {
      this.ctx.c2s.emit('c2s:interactBlock', { x: t.x, y: t.y, z: t.z, action: 'use' });
      return;
    }
    this.ctx.c2s.emit('c2s:placeBlock', {
      x: Math.floor(t.x + t.nx),
      y: Math.floor(t.y + t.ny),
      z: Math.floor(t.z + t.nz),
      blockId,
    });
  }

  selectSlot(index: number) {
    this.ctx.state.inventory.selectedIndex = index;
  }

  chat(message: string) {
    if (message.startsWith('/')) {
      this.ctx.c2s.emit('c2s:command', { command: message.slice(1) });
    } else {
      this.ctx.c2s.emit('c2s:chat', { message });
    }
  }

  executeCommand(command: string) {
    this.ctx.c2s.emit('c2s:command', { command });
  }

  swapOffhand() {
    this.ctx.c2s.emit('c2s:swapOffhand', {});
  }

  switchTool(tool: ToolType) {
    this.ctx.state.player.tool = tool;
  }

  changeView(mode: ViewMode) {
    this.ctx.state.player.viewMode = mode;
  }

  setTargetBlock(target: typeof this.ctx.state.player.targetBlock) {
    this.ctx.state.player.targetBlock = target;
  }

  setTargetEntity(target: typeof this.ctx.state.player.targetEntity) {
    this.ctx.state.player.targetEntity = target;
  }

  getLookDirection(): Vec3 {
    const { yaw, pitch } = this.ctx.state.player;
    return {
      x: -Math.sin(yaw) * Math.cos(pitch),
      y: -Math.sin(pitch),
      z: -Math.cos(yaw) * Math.cos(pitch),
    };
  }

  dispose() {
    // No listeners to clean up — reads from proxy directly
  }
}
