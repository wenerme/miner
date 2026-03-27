'use client';

import type { ChatMessage, CraftingRecipe, EntityStateMap, InventorySlot, PlayerArmorSlots, ViewMode } from '#/common/types';
import { ChatFeed } from './ChatFeed';
import { ChatUI } from './ChatUI';
import { CraftingUI } from './CraftingUI';
import { CrosshairUI } from './CrosshairUI';
import { HotbarUI } from './HotbarUI';
import { InventoryUI, type InventoryUiMode } from './InventoryUI';
import { FurnaceUI } from './FurnaceUI';
import { ChestUI } from './ChestUI';
import type { GameSettings } from '#/common/types';
import { isMineWebDevEnv } from '#/common/runtimeEnv';
import { SettingsUI } from './SettingsUI';

interface TargetBlockInfo {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  state?: EntityStateMap;
}

interface MineWebUIProps {
  isLocked: boolean;
  loading: boolean;
  showInventory: boolean;
  showFurnace: boolean;
  inventoryMode: InventoryUiMode;
  showCrafting: boolean;
  showChat: boolean;
  showSettings: boolean;
  showClickToPlayPrompt?: boolean;
  showDebug?: boolean;
  selectedSlot: number;
  hotbarSlots: (InventorySlot | null)[];
  inventorySlots: (InventorySlot | null)[];
  armorSlots: PlayerArmorSlots;
  craftTableSlots: (InventorySlot | null)[];
  furnaceInputSlot: InventorySlot | null;
  furnaceFuelSlot: InventorySlot | null;
  furnaceOutputSlot: InventorySlot | null;
  furnaceBurnTimeLeft: number;
  furnaceBurnTimeTotal: number;
  furnaceCookProgress: number;
  furnaceCookTimeTotal: number;
  offhandSlot: InventorySlot | null;
  inventoryCursor: InventorySlot | null;
  playerPos: { x: number; y: number; z: number };
  playerHp: number;
  playerMaxHp: number;
  viewMode: ViewMode;
  yaw?: number;
  targetBlock?: TargetBlockInfo | null;
  chunkCount?: number;
  entityCount?: number;
  chatMessages: ChatMessage[];
  recipes: Array<CraftingRecipe & { craftable: boolean; index: number }>;
  settings: GameSettings;
  fps: number;
  biome?: string;
  onCraft: (index: number) => void;
  onSlotSelect: (i: number) => void;
  onInventorySlotClick: (index: number, button: 'left' | 'right', shift: boolean) => void;
  onInventorySlotCollect: (index: number) => void;
  onCraftTableSlotClick: (index: number, button: 'left' | 'right', shift: boolean) => void;
  onCraftTableSlotCollect: (index: number) => void;
  onCraftResultClick: (button: 'left' | 'right', shift: boolean) => void;
  onFurnaceSlotClick: (slot: 'input' | 'fuel' | 'output', button: 'left' | 'right', shift: boolean) => void;
  showChest: boolean;
  chestSlots: (InventorySlot | null)[];
  onChestSlotClick: (slotIndex: number, button: 'left' | 'right', shift: boolean) => void;
  onCloseChest: () => void;
  onChatSend: (msg: string) => void;
  onCloseInventory: () => void;
  onCloseFurnace: () => void;
  onCloseCrafting: () => void;
  onCloseChat: () => void;
  onCloseSettings: () => void;
  onSaveSettings: (s: GameSettings) => void;
  onResetSettings: () => void;
  onClickToPlay: () => void;
  chatPrefix?: string;
  onChatOpened?: () => void;
  onNewGame?: () => void;
  onQuitToMenu?: () => void;
}

export function shouldRenderDomChatFeed(input: {
  showChat: boolean;
  useNativeHud: boolean;
  showClickToPlayPrompt?: boolean;
  showFurnace?: boolean;
}) {
  return !input.showChat && !input.useNativeHud && !input.showClickToPlayPrompt && !input.showFurnace;
}

function fmtCoord(v: number): string {
  const s = v.toFixed(1);
  return s.length < 7 ? s.padStart(7) : s;
}

function faceFromNormal(nx: number, ny: number, nz: number): string {
  if (ny === 1) return '+Y';
  if (ny === -1) return '-Y';
  if (nx === 1) return '+X';
  if (nx === -1) return '-X';
  if (nz === 1) return '+Z';
  if (nz === -1) return '-Z';
  return '?';
}

function facingFromYaw(yaw: number): string {
  const deg = ((yaw * 180) / Math.PI + 360) % 360;
  if (deg >= 315 || deg < 45) return 'south';
  if (deg >= 45 && deg < 135) return 'west';
  if (deg >= 135 && deg < 225) return 'north';
  return 'east';
}

export function MineWebUI(props: MineWebUIProps) {
  const isDevEnv = isMineWebDevEnv();
  const viewLabel = { 'first-person': 'FP', 'third-back': '3rd', 'third-front': '3rd Front' }[props.viewMode];
  const { x, y, z } = props.playerPos;
  const hpLabel = `HP ${props.playerHp.toFixed(0)}/${props.playerMaxHp.toFixed(0)}`;
  const bx = Math.floor(x);
  const by = Math.floor(y);
  const bz = Math.floor(z);
  const cx = Math.floor(x / 16);
  const cz = Math.floor(z / 16);
  const showDebug = props.showDebug && props.isLocked;
  const chunkCount = props.chunkCount ?? 0;
  const entityCount = props.entityCount ?? 0;
  const yaw = props.yaw ?? 0;
  const useNativeHud = props.settings.nativeHud && props.isLocked;
  const offhandLabel = props.offhandSlot ? `${props.offhandSlot.itemId}x${props.offhandSlot.count}` : 'empty';

  return (
    <>
      {props.isLocked && !useNativeHud && <CrosshairUI />}
      {props.isLocked && showDebug && !useNativeHud && (
        <div className='pointer-events-none absolute top-2 left-2 w-[280px] rounded bg-black/60 px-3 py-2 font-[Monocraft,monospace] text-[10px] leading-relaxed text-white/80 backdrop-blur-sm'>
          <div>XYZ: {fmtCoord(x)} / {fmtCoord(y)} / {fmtCoord(z)}</div>
          <div>Block: {bx} {by} {bz}</div>
          <div>Chunk: {cx} {Math.floor(y / 16)} {cz}</div>
          <div>Facing: {facingFromYaw(yaw).padEnd(5)} yaw: {fmtCoord(yaw)}</div>
          <div className={props.targetBlock ? '' : 'invisible'}>
            Target: {props.targetBlock?.x ?? 0},{props.targetBlock?.y ?? 0},{props.targetBlock?.z ?? 0} {props.targetBlock ? faceFromNormal(props.targetBlock.nx, props.targetBlock.ny, props.targetBlock.nz) : '?'}
          </div>
          <div>HP: {props.playerHp.toFixed(0)}/{props.playerMaxHp.toFixed(0)}</div>
          <div>Chunks: {chunkCount} Entities: {entityCount}</div>
          <div>Render: {props.settings.renderDistance ?? 6} FOV: {props.settings.fov ?? 75}</div>
          <div>FPS: {props.fps} {viewLabel}</div>
        </div>
      )}
      {props.isLocked && !showDebug && !useNativeHud && (
        <div className='pointer-events-none absolute top-2 left-2 w-[220px] rounded bg-black/60 px-3 py-2 font-[Monocraft,monospace] text-[10px] leading-relaxed text-white/80 backdrop-blur-sm'>
          <div>XYZ: {fmtCoord(x)} / {fmtCoord(y)} / {fmtCoord(z)}</div>
          <div>Chunk: {cx}, {cz} [{viewLabel}]</div>
          {props.settings.showFps && <div>{props.fps} FPS</div>}
          <div className={props.targetBlock ? '' : 'invisible'}>
            Target: {props.targetBlock?.x ?? 0},{props.targetBlock?.y ?? 0},{props.targetBlock?.z ?? 0}
          </div>
          <div>{props.biome ?? '\u00A0'}</div>
          <div>{hpLabel}</div>
        </div>
      )}
      {!props.isLocked && !props.showInventory && !props.showFurnace && !props.showCrafting && !props.showChat && !props.showSettings && (
        <div className='absolute inset-0 flex cursor-pointer items-center justify-center overflow-hidden' onClick={props.onClickToPlay}>
          <div className='absolute inset-0 bg-black/60' />
          <div className='absolute inset-0 opacity-20' style={{
            backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.03) 2px,rgba(255,255,255,0.03) 4px)`,
          }} />
          <div className='relative z-10 text-center text-white'>
            {props.loading ? (
              <>
                <div className='loading loading-spinner loading-lg mb-4' />
                <p className='text-lg'>Loading world...</p>
              </>
            ) : props.showClickToPlayPrompt ? (
              <>
                <h1 className='mb-2 text-5xl font-bold tracking-tight'>MineWeb</h1>
                <p className='mb-8 text-xl font-medium'>Click to start playing</p>
                <div className='mx-auto max-w-md space-y-2 rounded-lg bg-black/40 px-6 py-4 text-left text-sm text-white/70 [&_kbd]:inline-block [&_kbd]:rounded [&_kbd]:border [&_kbd]:border-neutral-600 [&_kbd]:bg-neutral-800 [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:font-mono [&_kbd]:text-xs [&_kbd]:text-white'>
                  <p><kbd>WASD</kbd> Move · <kbd>Mouse</kbd> Look · <kbd>Space</kbd> Jump</p>
                  <p><kbd>LMB</kbd> Break · <kbd>RMB</kbd> Place · <kbd>Scroll</kbd> Hotbar</p>
                  <p><kbd>1-9</kbd> Slot · <kbd>F</kbd> Swap Offhand · <kbd>E</kbd> Inventory · <kbd>C</kbd> Craft · <kbd>T</kbd> Chat</p>
                  <p><kbd>F3</kbd> Debug · <kbd>F5</kbd> View · <kbd>Shift</kbd> Sneak/Descend · <kbd>Esc</kbd> Settings</p>
                  <p className='pt-1 text-white/40'>Type <code>/fly</code>, <code>/flyspeed 3</code>, <code>/testmap</code>, <code>/noclip</code>, <code>/tp</code>, <code>/give</code>, <code>/help</code> in chat</p>
                </div>
              </>
            ) : (
              <>
                <p className='text-xl font-medium'>Click to resume</p>
                <p className='mt-2 text-sm text-white/60'>Press <kbd className='inline-block rounded border border-neutral-600 bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-white'>Esc</kbd> for settings</p>
              </>
            )}
          </div>
        </div>
      )}
      {shouldRenderDomChatFeed({
        showChat: props.showChat,
        useNativeHud,
        showClickToPlayPrompt: props.showClickToPlayPrompt,
        showFurnace: props.showFurnace,
      }) && (
        <ChatFeed messages={props.chatMessages} />
      )}
      {!useNativeHud && <HotbarUI slots={props.hotbarSlots} offhandSlot={props.offhandSlot} selectedIndex={props.selectedSlot} onSelect={props.onSlotSelect} />}
      {props.showFurnace && (
        <FurnaceUI
          inputSlot={props.furnaceInputSlot}
          fuelSlot={props.furnaceFuelSlot}
          outputSlot={props.furnaceOutputSlot}
          burnTimeLeft={props.furnaceBurnTimeLeft}
          burnTimeTotal={props.furnaceBurnTimeTotal}
          cookProgress={props.furnaceCookProgress}
          cookTimeTotal={props.furnaceCookTimeTotal}
          slots={props.inventorySlots}
          cursorSlot={props.inventoryCursor}
          selectedIndex={props.selectedSlot}
          onSlotClick={props.onInventorySlotClick}
          onSlotCollect={props.onInventorySlotCollect}
          onFurnaceSlotClick={props.onFurnaceSlotClick}
          onClose={props.onCloseFurnace}
        />
      )}
      {props.showChest && (
        <ChestUI
          chestSlots={props.chestSlots}
          slots={props.inventorySlots}
          cursorSlot={props.inventoryCursor}
          selectedIndex={props.selectedSlot}
          onSlotClick={props.onInventorySlotClick}
          onSlotCollect={props.onInventorySlotCollect}
          onChestSlotClick={props.onChestSlotClick}
          onClose={props.onCloseChest}
        />
      )}
      {props.showInventory && (
        <InventoryUI
          mode={props.inventoryMode}
          slots={props.inventorySlots}
          armorSlots={props.armorSlots}
          craftTableSlots={props.craftTableSlots}
          offhandSlot={props.offhandSlot}
          cursorSlot={props.inventoryCursor}
          selectedIndex={props.selectedSlot}
          onSlotClick={props.onInventorySlotClick}
          onSlotCollect={props.onInventorySlotCollect}
          onCraftTableSlotClick={props.inventoryMode === 'craftTable' ? props.onCraftTableSlotClick : undefined}
          onCraftTableSlotCollect={props.inventoryMode === 'craftTable' ? props.onCraftTableSlotCollect : undefined}
          onCraftResultClick={props.inventoryMode === 'craftTable' ? props.onCraftResultClick : undefined}
          onClose={props.onCloseInventory}
        />
      )}
      {props.showCrafting && <CraftingUI recipes={props.recipes} onCraft={props.onCraft} onClose={props.onCloseCrafting} />}
      {props.showChat && <ChatUI messages={props.chatMessages} onSend={props.onChatSend} onClose={props.onCloseChat} prefix={props.chatPrefix} onOpened={props.onChatOpened} />}
      {props.showSettings && (
        <SettingsUI
          settings={props.settings}
          onSave={props.onSaveSettings}
          onReset={props.onResetSettings}
          onClose={props.onCloseSettings}
          onNewGame={props.onNewGame}
          onQuitToMenu={props.onQuitToMenu}
        />
      )}
    </>
  );
}
