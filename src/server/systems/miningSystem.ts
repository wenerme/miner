import { BLOCK_DEFS } from '#/block/BlockRegistry';
import type { GameContext } from '#/common/GameContext';
import type { AbilityManager } from '#/common/Abilities';
import type { Inventory } from '../Inventory';
import type { World } from '../World';
import { hasCorrectToolForBreakSpeed, planBreakBlock } from './blockActionSystem';

type MiningState = { x: number; y: number; z: number; progress: number; blockId: number } | null;

export type MiningSystemHost = {
  world: World;
  inventory: Inventory;
  ctx: GameContext;
  abilities: AbilityManager;
  applyInstantBreak(x: number, y: number, z: number): void;
  isBlockReachable(x: number, y: number, z: number): boolean;
  getToolSpeedMultiplier(blockName: string): number;
};

export class MiningSystem {
  private state: MiningState = null;

  constructor(private readonly host: MiningSystemHost) {}

  cancel(): void {
    if (!this.state) return;
    const { x, y, z } = this.state;
    this.state = null;
    this.host.ctx.s2c.emit('s2c:breakProgress', { x, y, z, progress: -1 });
  }

  handleStartBreak(x: number, y: number, z: number): void {
    if (!this.host.isBlockReachable(x, y, z)) return;

    if (this.host.abilities.has('creative')) {
      this.cancel();
      this.host.applyInstantBreak(x, y, z);
      return;
    }

    const currentId = this.host.world.getBlock(x, y, z);
    const hardness = BLOCK_DEFS[currentId]?.hardness ?? 1;

    if (hardness <= 0) {
      this.cancel();
      const plan = planBreakBlock({
        blockId: currentId,
        selectedItemId: this.host.inventory.getSelectedItem(),
        playerTool: this.host.ctx.state.player.tool,
      });
      if (plan.shouldBreak) this.host.applyInstantBreak(x, y, z);
      return;
    }

    const plan = planBreakBlock({
      blockId: currentId,
      selectedItemId: this.host.inventory.getSelectedItem(),
      playerTool: this.host.ctx.state.player.tool,
    });
    if (!plan.shouldBreak) {
      this.cancel();
      return;
    }

    if (
      this.state
      && this.state.x === x
      && this.state.y === y
      && this.state.z === z
      && this.state.blockId === currentId
    ) {
      return;
    }

    this.cancel();
    this.state = { x, y, z, progress: 0, blockId: currentId };
    this.host.ctx.s2c.emit('s2c:breakProgress', { x, y, z, progress: 0 });
  }

  tick(dt: number): void {
    if (!this.state) return;
    const { x, y, z, blockId } = this.state;
    const current = this.host.world.getBlock(x, y, z);
    if (current !== blockId || !this.host.isBlockReachable(x, y, z)) {
      this.cancel();
      return;
    }
    const plan = planBreakBlock({
      blockId: current,
      selectedItemId: this.host.inventory.getSelectedItem(),
      playerTool: this.host.ctx.state.player.tool,
    });
    if (!plan.shouldBreak) {
      this.cancel();
      return;
    }
    const breakSec = this.computeBreakSeconds(current);
    if (breakSec <= 0) {
      this.completeBreak(x, y, z);
      return;
    }
    this.state.progress += dt / breakSec;
    const p = Math.min(1, this.state.progress);
    this.host.ctx.s2c.emit('s2c:breakProgress', { x, y, z, progress: p });
    if (this.state.progress >= 1) {
      this.completeBreak(x, y, z);
    }
  }

  private completeBreak(x: number, y: number, z: number): void {
    this.state = null;
    this.host.ctx.s2c.emit('s2c:breakProgress', { x, y, z, progress: -1 });
    this.host.applyInstantBreak(x, y, z);
  }

  private computeBreakSeconds(blockId: number): number {
    const info = BLOCK_DEFS[blockId];
    const hardness = info?.hardness ?? 1;
    if (hardness <= 0) return 0;
    const selectedItemId = this.host.inventory.getSelectedItem();
    const playerTool = this.host.ctx.state.player.tool;
    const correct = hasCorrectToolForBreakSpeed({ blockId, selectedItemId, playerTool });
    if (correct) {
      const mult = Math.max(0.05, this.host.getToolSpeedMultiplier(info?.name ?? ''));
      return (hardness * 1.5) / mult;
    }
    return hardness * 5.0;
  }
}
