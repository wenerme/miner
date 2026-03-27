/**
 * MineWeb registry / content pipeline lint.
 * Run: pnpm node --experimental-strip-types scripts/lint-registry.ts
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MINER_ROOT = join(__dirname, '..');

const PATHS = {
  blocksJson: join(MINER_ROOT, 'src/block/blocks.json'),
  blockColors: join(MINER_ROOT, 'src/block/blockColors.ts'),
  itemRegistry: join(MINER_ROOT, 'src/common/ItemRegistry.ts'),
  craftingRegistry: join(MINER_ROOT, 'src/common/CraftingRegistry.ts'),
  texturesBlock: join(MINER_ROOT, 'public/mc/assets/minecraft/textures/block'),
  texturesItem: join(MINER_ROOT, 'public/mc/assets/minecraft/textures/item'),
} as const;

type JsonBlock = {
  id: number;
  name: string;
  textures: Record<string, string | undefined>;
  itemTexture?: string;
  drops?: unknown;
  breakable?: boolean;
  solid?: boolean;
  stripToBlockId?: number;
  toolTransforms?: Array<{ toBlockId?: number }>;
  fluidPickupItemId?: number;
};

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function expandTextures(tex: Record<string, string | undefined>): { top: string } {
  if (tex.all !== undefined) {
    return { top: tex.all ?? '' };
  }
  const side = tex.side ?? tex.top ?? '';
  return { top: tex.top ?? side };
}

function blockKeyFromName(name: string): string {
  return name.toUpperCase().replace(/\s+/g, '_');
}

function listPngBasenames(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();
  const out = new Set<string>();
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.png')) continue;
    out.add(ent.name.slice(0, -'.png'.length));
  }
  return out;
}

function collectBlockTextureNames(entry: JsonBlock): string[] {
  const names: string[] = [];
  const t = entry.textures ?? {};
  for (const v of Object.values(t)) {
    if (v && typeof v === 'string' && v.length > 0) names.push(v);
  }
  if (entry.itemTexture) names.push(entry.itemTexture);
  return names;
}

function normalizeDropsRaw(drops: unknown): Array<{ itemId?: number; blockId?: number }> {
  if (drops == null) return [];
  const raw = Array.isArray(drops) ? drops : [drops];
  const out: Array<{ itemId?: number; blockId?: number }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const v = entry as { itemId?: unknown; blockId?: unknown };
    const itemId = typeof v.itemId === 'number' ? v.itemId : undefined;
    const blockId = typeof v.blockId === 'number' ? v.blockId : undefined;
    out.push({ itemId, blockId });
  }
  return out;
}

function parseItemTypesExplicit(itemRegistrySrc: string): Map<string, number> {
  const start = itemRegistrySrc.indexOf('export const ItemTypes = Object.freeze({');
  if (start === -1) throw new Error('ItemRegistry: ItemTypes not found');
  const brace = itemRegistrySrc.indexOf('{', start);
  let depth = 0;
  let i = brace;
  for (; i < itemRegistrySrc.length; i++) {
    const c = itemRegistrySrc[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const body = itemRegistrySrc.slice(brace + 1, i - 1);
  const lines = body.split('\n');
  const map = new Map<string, number>();
  for (const line of lines) {
    const t = line.trim();
    if (t === '' || t.startsWith('//')) continue;
    if (t.includes('...BlockTypes')) continue;
    const m = /^([A-Z_][A-Z0-9_]*)\s*:\s*(\d+)\s*,?\s*$/.exec(t);
    if (m) map.set(m[1], Number(m[2]));
  }
  return map;
}

function parseItemDefTextures(itemRegistrySrc: string): Map<string, string> {
  const textureByConst = new Map<string, string>();

  // Pattern 1: ITEM_DEFS[ItemTypes.XXX] = { ... texture: '...' ... }
  const needle = 'ITEM_DEFS[ItemTypes.';
  let from = 0;
  while (true) {
    const idx = itemRegistrySrc.indexOf(needle, from);
    if (idx === -1) break;
    const nameStart = idx + needle.length;
    const nameEnd = itemRegistrySrc.indexOf(']', nameStart);
    if (nameEnd === -1) break;
    const constName = itemRegistrySrc.slice(nameStart, nameEnd).trim();
    const eqBrace = itemRegistrySrc.indexOf('=', nameEnd);
    if (eqBrace === -1) break;
    const restOfLine = itemRegistrySrc.slice(eqBrace, itemRegistrySrc.indexOf('\n', eqBrace) + 1);

    // Check if RHS is a function call like defArmor(...) with string args
    const fnCallMatch = /=\s*\w+\([^)]*'([^']+)'/.exec(restOfLine);
    if (fnCallMatch && !restOfLine.includes('{')) {
      // For defArmor(id, name, texture, ...) — texture is the 3rd string arg
      const allStrings = [...restOfLine.matchAll(/'([^']+)'/g)].map(m => m[1]);
      if (allStrings.length >= 2) {
        textureByConst.set(constName, allStrings[1]);
      }
      from = eqBrace + restOfLine.length;
      continue;
    }

    const open = itemRegistrySrc.indexOf('{', eqBrace);
    if (open === -1) { from = eqBrace + 1; continue; }
    let depth = 0;
    let j = open;
    for (; j < itemRegistrySrc.length; j++) {
      const c = itemRegistrySrc[j];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    const block = itemRegistrySrc.slice(open, j);
    const tm = /texture:\s*'([^']+)'/.exec(block);
    if (tm) textureByConst.set(constName, tm[1]);
    from = j;
  }

  // Pattern 2: defTool(ItemTypes.XXX, 'Name', 'toolType', tier, 'texture', ...)
  const defToolRe = /defTool\(ItemTypes\.(\w+),\s*'[^']*',\s*'[^']*',\s*\d+,\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = defToolRe.exec(itemRegistrySrc)) !== null) {
    textureByConst.set(m[1], m[2]);
  }

  return textureByConst;
}

function parseCraftingItemRefs(craftingSrc: string): Array<{ kind: 'B' | 'I'; name: string; line: string }> {
  const refs: Array<{ kind: 'B' | 'I'; name: string; line: string }> = [];
  const lines = craftingSrc.split('\n');
  const re = /itemId:\s*([BI])\.(\w+)/g;
  for (const line of lines) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(line)) !== null) {
      refs.push({ kind: m[1] as 'B' | 'I', name: m[2], line: line.trim() });
    }
  }
  return refs;
}

function parseBlockColorsKeys(src: string): { keys: string[]; duplicates: string[] } {
  const start = src.indexOf('export const FALLBACK_COLORS');
  if (start === -1) return { keys: [], duplicates: [] };
  const objStart = src.indexOf('{', start);
  let depth = 0;
  let i = objStart;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = src.slice(objStart + 1, i);
  const keyRe = /^\s*([a-zA-Z0-9_]+)\s*:/gm;
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(body)) !== null) keys.push(m[1]);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const k of keys) {
    if (seen.has(k)) duplicates.push(k);
    seen.add(k);
  }
  return { keys, duplicates: [...new Set(duplicates)] };
}

function textureOnDisk(name: string, blockSet: Set<string>, itemSet: Set<string>): boolean {
  if (!name) return true;
  return blockSet.has(name) || itemSet.has(name);
}

function main(): number {
  console.log('=== MineWeb Registry Lint ===\n');

  const errors: string[] = [];

  const blocksRaw = JSON.parse(readText(PATHS.blocksJson)) as { blocks: JsonBlock[] };
  const blocks = blocksRaw.blocks;

  const blockIdsSeen = new Map<number, string>();
  const dupBlockIds: number[] = [];
  for (const b of blocks) {
    const prev = blockIdsSeen.get(b.id);
    if (prev !== undefined) dupBlockIds.push(b.id);
    else blockIdsSeen.set(b.id, b.name);
  }
  if (dupBlockIds.length === 0) console.log('[OK] No duplicate block IDs');
  else {
    console.log(`[ERROR] Duplicate block IDs: ${[...new Set(dupBlockIds)].join(', ')}`);
    errors.push('duplicate block IDs');
  }

  const blockNameToId = new Map<string, number>();
  for (const b of blocks) {
    blockNameToId.set(blockKeyFromName(b.name), b.id);
  }

  const itemRegistrySrc = readText(PATHS.itemRegistry);
  const explicitItemTypes = parseItemTypesExplicit(itemRegistrySrc);
  const itemConstToTexture = parseItemDefTextures(itemRegistrySrc);

  const itemTypeNameToId = new Map<string, number>(blockNameToId);
  for (const [k, v] of explicitItemTypes) itemTypeNameToId.set(k, v);

  const allItemIds = new Set<number>();
  for (const b of blocks) allItemIds.add(b.id);
  for (const v of explicitItemTypes.values()) allItemIds.add(v);

  const itemIdToKeys = new Map<number, string[]>();
  for (const [name, id] of itemTypeNameToId) {
    const arr = itemIdToKeys.get(id) ?? [];
    arr.push(name);
    itemIdToKeys.set(id, arr);
  }
  const dupItemIds: number[] = [];
  for (const [id, keys] of itemIdToKeys) {
    const uniqueKeys = [...new Set(keys)];
    if (uniqueKeys.length > 1) dupItemIds.push(id);
  }
  if (dupItemIds.length === 0) console.log('[OK] No duplicate item IDs');
  else {
    for (const id of dupItemIds.sort((a, b) => a - b)) {
      const keys = [...new Set(itemIdToKeys.get(id) ?? [])];
      console.log(`[ERROR] Duplicate item ID ${id} (${keys.join(', ')})`);
    }
    errors.push('duplicate item IDs');
  }

  const blockPng = listPngBasenames(PATHS.texturesBlock);
  const itemPng = listPngBasenames(PATHS.texturesItem);
  if (!existsSync(PATHS.texturesBlock) && !existsSync(PATHS.texturesItem)) {
    console.log('[WARN] Texture dirs not found — skipping PNG existence / orphan checks');
  }

  const referencedTextures = new Set<string>();

  const missingBlockTextures: Array<{ name: string; block: string }> = [];
  for (const b of blocks) {
    for (const tex of collectBlockTextureNames(b)) {
      referencedTextures.add(tex);
      if (existsSync(PATHS.texturesBlock) || existsSync(PATHS.texturesItem)) {
        if (!textureOnDisk(tex, blockPng, itemPng)) {
          missingBlockTextures.push({ name: tex, block: b.name });
        }
      }
    }
  }

  const itemsMissingTextureFile: Array<{ id: number; label: string; texture: string }> = [];
  const itemTextureById = new Map<number, string>();

  for (const b of blocks) {
    const ex = expandTextures(b.textures ?? {});
    const tex = b.itemTexture ?? ex.top ?? '';
    itemTextureById.set(b.id, tex);
    if (tex && (existsSync(PATHS.texturesBlock) || existsSync(PATHS.texturesItem))) {
      if (!textureOnDisk(tex, blockPng, itemPng)) {
        itemsMissingTextureFile.push({
          id: b.id,
          label: `Block "${b.name}"`,
          texture: tex,
        });
      }
    }
    if (tex) referencedTextures.add(tex);
  }

  for (const [constName, id] of explicitItemTypes) {
    const t = itemConstToTexture.get(constName);
    if (t == null || t === '') {
      console.log(`[WARN] ItemTypes.${constName} has no texture in ITEM_DEFS assignment`);
      continue;
    }
    itemTextureById.set(id, t);
    referencedTextures.add(t);
    if (existsSync(PATHS.texturesBlock) || existsSync(PATHS.texturesItem)) {
      if (!textureOnDisk(t, blockPng, itemPng)) {
        itemsMissingTextureFile.push({
          id,
          label: `ItemTypes.${constName}`,
          texture: t,
        });
      }
    }
  }

  if (missingBlockTextures.length === 0) console.log('[OK] All referenced block textures found on disk');
  else {
    console.log(`[WARN] ${missingBlockTextures.length} block texture(s) not found on disk:`);
    for (const row of missingBlockTextures) {
      console.log(`  - ${row.name} (used by Block "${row.block}")`);
    }
  }

  if (itemsMissingTextureFile.length === 0) console.log('[OK] All item textures found on disk');
  else {
    console.log(`[WARN] ${itemsMissingTextureFile.length} item(s) have no texture file:`);
    for (const row of itemsMissingTextureFile) {
      console.log(`  - ${row.texture} (${row.label}, id ${row.id})`);
    }
  }

  const colorParse = parseBlockColorsKeys(readText(PATHS.blockColors));
  if (colorParse.duplicates.length === 0) console.log('[OK] No duplicate color keys');
  else {
    console.log(`[ERROR] Duplicate keys in blockColors.ts: ${colorParse.duplicates.join(', ')}`);
    errors.push('duplicate color keys');
  }

  const blockIdSet = new Set(blocks.map((b) => b.id));

  const invalidDrops: string[] = [];
  for (const b of blocks) {
    for (const d of normalizeDropsRaw(b.drops)) {
      if (d.itemId != null && !allItemIds.has(d.itemId)) {
        invalidDrops.push(`Block "${b.name}" (#${b.id}) drops.itemId ${d.itemId} — no such item`);
      }
      if (d.blockId != null && !blockIdSet.has(d.blockId)) {
        invalidDrops.push(`Block "${b.name}" (#${b.id}) drops.blockId ${d.blockId} — no such block`);
      }
    }
    if (typeof b.stripToBlockId === 'number' && !blockIdSet.has(b.stripToBlockId)) {
      invalidDrops.push(`Block "${b.name}" (#${b.id}) stripToBlockId ${b.stripToBlockId} — no such block`);
    }
    const transforms = b.toolTransforms ?? [];
    for (let ti = 0; ti < transforms.length; ti++) {
      const toId = transforms[ti]?.toBlockId;
      if (typeof toId === 'number' && !blockIdSet.has(toId)) {
        invalidDrops.push(
          `Block "${b.name}" (#${b.id}) toolTransforms[${ti}].toBlockId ${toId} — no such block`,
        );
      }
    }
    if (typeof b.fluidPickupItemId === 'number' && !allItemIds.has(b.fluidPickupItemId)) {
      invalidDrops.push(
        `Block "${b.name}" (#${b.id}) fluidPickupItemId ${b.fluidPickupItemId} — no such item`,
      );
    }
  }

  if (invalidDrops.length === 0) console.log('[OK] No invalid drop / block-ref issues');
  else {
    console.log(`[ERROR] ${invalidDrops.length} invalid drop / block reference(s):`);
    for (const line of invalidDrops) console.log(`  - ${line}`);
    errors.push('invalid drops or refs');
  }

  const missingBlockItem: string[] = [];
  for (const b of blocks) {
    const ex = expandTextures(b.textures ?? {});
    const derived = b.itemTexture ?? ex.top ?? '';
    const breakable = b.breakable !== false;
    const isAir = b.id === 0;
    if (!isAir && breakable && derived === '') {
      missingBlockItem.push(`Block "${b.name}" (#${b.id}) — breakable but no itemTexture / texture top`);
    }
  }
  if (missingBlockItem.length === 0) console.log('[OK] No missing breakable block item textures');
  else {
    console.log(`[WARN] ${missingBlockItem.length} breakable block(s) lack item texture mapping:`);
    for (const line of missingBlockItem) console.log(`  - ${line}`);
  }

  const craftingSrc = readText(PATHS.craftingRegistry);
  const craftRefs = parseCraftingItemRefs(craftingSrc);
  const badCraft: string[] = [];
  for (const ref of craftRefs) {
    if (ref.kind === 'B') {
      const id = blockNameToId.get(ref.name);
      if (id === undefined) badCraft.push(`Unknown BlockTypes.${ref.name} (${ref.line})`);
      else if (!allItemIds.has(id)) badCraft.push(`BlockTypes.${ref.name} → ${id} not in item ID set (${ref.line})`);
    } else {
      const id = itemTypeNameToId.get(ref.name);
      if (id === undefined) badCraft.push(`Unknown ItemTypes.${ref.name} (${ref.line})`);
      else if (!allItemIds.has(id)) badCraft.push(`ItemTypes.${ref.name} → ${id} not in item ID set (${ref.line})`);
    }
  }
  if (badCraft.length === 0) console.log('[OK] Crafting recipes reference valid items');
  else {
    console.log(`[ERROR] ${badCraft.length} crafting recipe issue(s):`);
    for (const line of badCraft) console.log(`  - ${line}`);
    errors.push('invalid crafting refs');
  }

  if (existsSync(PATHS.texturesBlock) || existsSync(PATHS.texturesItem)) {
    const orphans: string[] = [];
    for (const n of blockPng) {
      if (!referencedTextures.has(n)) orphans.push(`block/${n}.png`);
    }
    for (const n of itemPng) {
      if (!referencedTextures.has(n)) orphans.push(`item/${n}.png`);
    }
    if (orphans.length === 0) console.log('[OK] No orphaned textures');
    else {
      console.log(`[WARN] ${orphans.length} orphaned texture file(s):`);
      for (const o of orphans.slice(0, 40)) console.log(`  - ${o}`);
      if (orphans.length > 40) console.log(`  ... and ${orphans.length - 40} more`);
    }
  }

  console.log('');
  if (errors.length > 0) {
    console.log(`Done with ${errors.length} error kind(s).`);
    return 1;
  }
  console.log('Done (warnings only or clean).');
  return 0;
}

process.exit(main());
