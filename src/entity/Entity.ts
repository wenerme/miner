import type { EntityInteractionAction, EntityStateMap, ToolType, Vec3 } from '#/common/types';

export interface ShearingInteractionMechanic {
  action: 'shear';
  requiredTool: ToolType;
  shearedStateKey: string;
  cooldownStateKey: string;
  cooldownMs: number;
  drops: Array<{ itemId?: number; blockId?: number; count: number }>;
  missingToolMessage: string;
  alreadyDoneMessage: string;
  successMessage: string;
}

export interface FillContainerOnUseInteractionMechanic {
  action: 'use';
  requiredItemId: number;
  cooldownStateKey: string;
  cooldownMs: number;
  replaceSelectedItem: { itemId: number; count: number };
  actionName: string;
  actionStateName: string;
  actionDurationMs: number;
  missingItemMessage: string;
  cooldownMessage: string;
  successMessage: string;
}

export interface CooldownDropOnUseInteractionMechanic {
  action: 'use';
  cooldownStateKey: string;
  cooldownMs: number;
  drop: { itemId?: number; blockId?: number; count: number };
  actionName: string;
  actionStateName: string;
  actionDurationMs: number;
  cooldownMessage: string;
  successMessage: string;
}

export interface EntityInteractionMechanics {
  shearing?: ShearingInteractionMechanic;
  fillContainerOnUse?: FillContainerOnUseInteractionMechanic;
  cooldownDropOnUse?: CooldownDropOnUseInteractionMechanic;
}

export interface EntityDef {
  type: string;
  name: string;
  maxHp: number;
  speed: number;
  width: number;
  height: number;
  hostile: boolean;
  burnsInDaylight?: boolean;
  attackDamage?: number;
  attackRange?: number;
  aggroRange?: number;
  drops?: {
    itemId?: number;
    blockId?: number;
    /** Fixed drop size when `countMin` / `countMax` are not set. */
    count?: number;
    countMin?: number;
    countMax?: number;
    chance?: number;
  }[];
  spawnBiomes?: string[];
  spawnWeight?: number;
  defaultState?: EntityStateMap;
  defaultAttributes?: EntityStateMap;
  interactions?: readonly EntityInteractionAction[];
  interactionDefaults?: {
    use?: EntityInteractionAction;
    withTool?: Partial<Record<ToolType, EntityInteractionAction>>;
  };
  interactionMechanics?: EntityInteractionMechanics;
  timing?: {
    actionDurationsMs?: Record<string, number>;
    cooldownsMs?: Record<string, number>;
  };
}

export interface EntityInteractionContext {
  itemId: number | null;
  tool: ToolType;
}

export interface Entity {
  id: number;
  type: string;
  position: Vec3;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  velocity: Vec3;
  onGround: boolean;
  dead: boolean;
  state: EntityStateMap;
  attributes: EntityStateMap;
}

export function createEntity(id: number, def: EntityDef, position: Vec3): Entity {
  return {
    id,
    type: def.type,
    position: { ...position },
    yaw: Math.random() * Math.PI * 2,
    pitch: 0,
    hp: def.maxHp,
    maxHp: def.maxHp,
    velocity: { x: 0, y: 0, z: 0 },
    onGround: false,
    dead: false,
    state: { ...(def.defaultState ?? {}) },
    attributes: { ...(def.defaultAttributes ?? {}) },
  };
}
