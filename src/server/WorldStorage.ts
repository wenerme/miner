import type { InventorySlot, PlayerArmorSlots, Vec3, WorldPreset } from '#/common/types';
import type { BlockState } from './World';

export type SavedPlayerState = {
  position: Vec3;
  selectedSlot: number;
  armor?: PlayerArmorSlots;
  health?: number;
  hunger?: number;
  saturation?: number;
  airMs?: number;
};

const DB_VERSION = 1;
const STORE_CHUNKS = 'chunks';
const STORE_META = 'meta';
const SAVES_KEY = 'mineweb:saves';

export interface SaveProfile {
  id: string;
  name: string;
  seed: number;
  preset?: WorldPreset;
  createdAt: number;
  updatedAt: number;
}

function dbName(slotId: string): string {
  return slotId === 'default' ? 'mineweb' : `mineweb_${slotId}`;
}

function openDB(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) db.createObjectStore(STORE_CHUNKS);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

type LegacyInventorySlot = Partial<{
  itemId: unknown;
  blockId: unknown;
  count: unknown;
  durability: unknown;
}>;

function normalizeInventorySlot(slot: unknown): InventorySlot | null {
  if (!slot || typeof slot !== 'object') return null;
  const legacy = slot as LegacyInventorySlot;
  const rawItemId = typeof legacy.itemId === 'number'
    ? legacy.itemId
    : typeof legacy.blockId === 'number'
      ? legacy.blockId
      : null;
  const rawCount = typeof legacy.count === 'number' ? legacy.count : 0;
  if (rawItemId == null || !Number.isFinite(rawItemId) || rawItemId < 0) return null;
  if (!Number.isFinite(rawCount) || rawCount <= 0) return null;
  const itemId = Math.floor(rawItemId);
  const count = Math.floor(rawCount);
  const durability = typeof legacy.durability === 'number' && Number.isFinite(legacy.durability)
    ? Math.max(0, Math.floor(legacy.durability))
    : undefined;
  return { itemId, count, durability };
}

export function normalizeInventorySlots(raw: unknown): (InventorySlot | null)[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((slot) => normalizeInventorySlot(slot));
}

function normalizeBlockState(raw: unknown): BlockState | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: BlockState = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function normalizeBlockStateEntries(raw: unknown): Map<string, BlockState> {
  const result = new Map<string, BlockState>();
  if (!Array.isArray(raw)) return result;
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [key, state] = entry;
    if (typeof key !== 'string' || key.length === 0) continue;
    const normalized = normalizeBlockState(state);
    if (!normalized) continue;
    result.set(key, normalized);
  }
  return result;
}

export class WorldStorage {
  private db: IDBDatabase | null = null;
  readonly slotId: string;

  constructor(slotId = 'default') {
    this.slotId = slotId;
  }

  async init(): Promise<void> {
    this.db = await openDB(dbName(this.slotId));
  }

  async saveSeed(seed: number): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(seed, 'seed');
  }

  async loadSeed(): Promise<number | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('seed');
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  }

  async saveChunk(cx: number, cz: number, blocks: Uint8Array): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_CHUNKS, 'readwrite');
    tx.objectStore(STORE_CHUNKS).put(blocks, `${cx},${cz}`);
  }

  async loadChunk(cx: number, cz: number): Promise<Uint8Array | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_CHUNKS, 'readonly');
      const req = tx.objectStore(STORE_CHUNKS).get(`${cx},${cz}`);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  }

  async loadAllChunks(): Promise<Map<string, Uint8Array>> {
    if (!this.db) return new Map();
    return new Promise((resolve) => {
      const result = new Map<string, Uint8Array>();
      const tx = this.db!.transaction(STORE_CHUNKS, 'readonly');
      const store = tx.objectStore(STORE_CHUNKS);
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) {
          result.set(c.key as string, c.value);
          c.continue();
        } else {
          resolve(result);
        }
      };
      cursor.onerror = () => resolve(result);
    });
  }

  async saveInventory(slots: (InventorySlot | null)[]): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(JSON.stringify(normalizeInventorySlots(slots) ?? slots), 'inventory');
  }

  async loadInventory(): Promise<(InventorySlot | null)[] | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('inventory');
      req.onsuccess = () => {
        try {
          const parsed = req.result ? JSON.parse(req.result) : null;
          resolve(normalizeInventorySlots(parsed));
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  async saveOffhand(slot: InventorySlot | null): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(JSON.stringify(normalizeInventorySlot(slot)), 'offhand');
  }

  async loadOffhand(): Promise<InventorySlot | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('offhand');
      req.onsuccess = () => {
        try {
          const parsed = req.result ? JSON.parse(req.result) : null;
          resolve(normalizeInventorySlot(parsed));
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  async saveCursor(slot: InventorySlot | null): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(JSON.stringify(normalizeInventorySlot(slot)), 'cursor');
  }

  async loadCursor(): Promise<InventorySlot | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('cursor');
      req.onsuccess = () => {
        try {
          const parsed = req.result ? JSON.parse(req.result) : null;
          resolve(normalizeInventorySlot(parsed));
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  async saveMilestones(ids: string[]): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(JSON.stringify(ids), 'milestones');
  }

  async loadMilestones(): Promise<string[]> {
    if (!this.db) return [];
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('milestones');
      req.onsuccess = () => {
        try {
          const parsed = req.result ? JSON.parse(req.result) : null;
          resolve(Array.isArray(parsed) ? parsed : []);
        } catch {
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    });
  }

  async savePlayerState(state: SavedPlayerState): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(JSON.stringify(state), 'playerState');
  }

  async loadPlayerState(): Promise<SavedPlayerState | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('playerState');
      req.onsuccess = () => {
        try {
          const raw = req.result ? JSON.parse(req.result) : null;
          if (!raw) { resolve(null); return; }
          const state: SavedPlayerState = {
            position: raw.position,
            selectedSlot: raw.selectedSlot ?? 0,
          };
          if (raw.armor && typeof raw.armor === 'object') {
            state.armor = {
              helmet: normalizeInventorySlot(raw.armor.helmet),
              chestplate: normalizeInventorySlot(raw.armor.chestplate),
              leggings: normalizeInventorySlot(raw.armor.leggings),
              boots: normalizeInventorySlot(raw.armor.boots),
            };
          }
          if (typeof raw.health === 'number' && Number.isFinite(raw.health)) state.health = raw.health;
          if (typeof raw.hunger === 'number' && Number.isFinite(raw.hunger)) state.hunger = raw.hunger;
          if (typeof raw.saturation === 'number' && Number.isFinite(raw.saturation)) state.saturation = raw.saturation;
          if (typeof raw.airMs === 'number' && Number.isFinite(raw.airMs)) state.airMs = raw.airMs;
          resolve(state);
        } catch { resolve(null); }
      };
      req.onerror = () => resolve(null);
    });
  }

  async saveBlockStates(entries: Array<[string, BlockState]>): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(JSON.stringify(entries), 'blockStates');
  }

  async loadBlockStates(): Promise<Map<string, BlockState>> {
    if (!this.db) return new Map();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('blockStates');
      req.onsuccess = () => {
        try {
          resolve(normalizeBlockStateEntries(req.result ? JSON.parse(req.result) : null));
        } catch {
          resolve(new Map());
        }
      };
      req.onerror = () => resolve(new Map());
    });
  }

  async saveTileEntities(data: unknown): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(JSON.stringify(data), 'tileEntities');
  }

  async loadTileEntities(): Promise<unknown> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('tileEntities');
      req.onsuccess = () => {
        try {
          resolve(req.result ? JSON.parse(req.result) : null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
    tx.objectStore(STORE_CHUNKS).clear();
    tx.objectStore(STORE_META).clear();
  }

  close() {
    this.db?.close();
    this.db = null;
  }

  static listSaves(): SaveProfile[] {
    try {
      const raw = localStorage.getItem(SAVES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  static saveSaveList(saves: SaveProfile[]) {
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  }

  static addSave(profile: SaveProfile) {
    const saves = WorldStorage.listSaves().filter((s) => s.id !== profile.id);
    saves.unshift(profile);
    WorldStorage.saveSaveList(saves);
  }

  static updateSaveTimestamp(id: string) {
    const saves = WorldStorage.listSaves();
    const save = saves.find((s) => s.id === id);
    if (save) {
      save.updatedAt = Date.now();
      WorldStorage.saveSaveList(saves);
    }
  }

  static removeSave(id: string) {
    const saves = WorldStorage.listSaves().filter((s) => s.id !== id);
    WorldStorage.saveSaveList(saves);
    const name = dbName(id);
    try { indexedDB.deleteDatabase(name); } catch { /* ignore */ }
  }

  static getLatestSave(): SaveProfile | null {
    const saves = WorldStorage.listSaves();
    return saves.length > 0 ? saves.reduce((a, b) => a.updatedAt > b.updatedAt ? a : b) : null;
  }

  static async migrateDefaultSave(): Promise<void> {
    const saves = WorldStorage.listSaves();
    if (saves.some((s) => s.id === 'default')) return;
    try {
      const storage = new WorldStorage('default');
      await storage.init();
      const seed = await storage.loadSeed();
      storage.close();
      if (seed != null) {
        WorldStorage.addSave({
          id: 'default',
          name: 'World 1',
          seed,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    } catch { /* no existing data */ }
  }
}
