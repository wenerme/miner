import * as THREE from 'three';
import { assetManager } from '#/common/AssetManager';
import { getItemDef, getItemIconFallbackLabel } from '#/common/ItemRegistry';
import { FALLBACK_COLORS } from '#/block/blockColors';
import type {
  HotbarHudSlotModel,
  HudActiveHintModel,
  HudModel,
  MiningBarHudModel,
  SurvivalHudModel,
} from '#/common/HudModel';
import { MC_TEXTURES } from '#/common/types';

/** Lowest renderOrder among world-space HUD sprites (offhand); still well above chunk transparent layers. */
export const HUD_SPRITE_RENDER_ORDER_MIN = 990;

const SLOT_BG_PATH = 'sprites/container/slot.png';
const HOTBAR_SLOT_TEXTURE_SIZE = 64;

const HUD_ICON_PATHS = {
  heartFull: 'sprites/hud/heart/full.png',
  heartHalf: 'sprites/hud/heart/half.png',
  heartContainer: 'sprites/hud/heart/container.png',
  foodFull: 'sprites/hud/food_full.png',
  foodHalf: 'sprites/hud/food_half.png',
  foodEmpty: 'sprites/hud/food_empty.png',
} as const;
type HudIconKey = keyof typeof HUD_ICON_PATHS;

interface SlotMeshEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  sprite: THREE.Sprite;
  token: string;
}

interface InfoPanelEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  sprite: THREE.Sprite;
  token: string;
  width: number;
  height: number;
}

interface ChatFeedEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  sprite: THREE.Sprite;
  token: string;
  width: number;
  height: number;
}

interface SurvivalBarsEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  sprite: THREE.Sprite;
  token: string;
  width: number;
  height: number;
}

interface MiningBarEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  sprite: THREE.Sprite;
  token: string;
  width: number;
  height: number;
}

interface HintToastEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  sprite: THREE.Sprite;
  token: string;
  width: number;
  height: number;
}

function survivalHudDisplayUnits(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(20, (value / max) * 20));
}

function drawSpriteIconRow(
  ctx: CanvasRenderingContext2D,
  startX: number,
  y: number,
  iconW: number,
  _iconH: number,
  gap: number,
  displayUnits: number,
  icons: { empty: HTMLImageElement | null; half: HTMLImageElement | null; full: HTMLImageElement | null; container?: HTMLImageElement | null },
) {
  for (let i = 0; i < 10; i++) {
    const x = Math.round(startX + i * (iconW + gap));
    const yy = Math.round(y);
    const units = i * 2;
    if (icons.container) ctx.drawImage(icons.container, x, yy, iconW, iconW);
    else if (icons.empty) ctx.drawImage(icons.empty, x, yy, iconW, iconW);
    if (displayUnits >= units + 2 && icons.full) {
      ctx.drawImage(icons.full, x, yy, iconW, iconW);
    } else if (displayUnits >= units + 1 && icons.half) {
      ctx.drawImage(icons.half, x, yy, iconW, iconW);
    } else if (!icons.container && icons.empty) {
      ctx.drawImage(icons.empty, x, yy, iconW, iconW);
    }
  }
}

function drawFallback(ctx: CanvasRenderingContext2D, texName: string, size: number, label: string) {
  ctx.fillStyle = FALLBACK_COLORS[texName] ?? '#808080';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, size - Math.floor(size * 0.42), size, Math.floor(size * 0.42));
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = Math.max(1, Math.floor(size * 0.06));
  ctx.font = `bold ${Math.max(8, Math.floor(size * 0.28))}px Monocraft, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(label, size * 0.5, size * 0.78);
  ctx.fillText(label, size * 0.5, size * 0.78);
}

export class HudRenderer {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);

  private viewport = { width: 1, height: 1 };
  private lastInfoPanelRedraw = 0;
  private crosshairGroup = new THREE.Group();
  private hotbarGroup = new THREE.Group();
  private slotMeshes: SlotMeshEntry[] = [];
  private offhandMesh: SlotMeshEntry | null = null;
  private slotBackground: HTMLImageElement | null = null;
  private hudIcons: Record<HudIconKey, HTMLImageElement | null> = {
    heartFull: null, heartHalf: null, heartContainer: null,
    foodFull: null, foodHalf: null, foodEmpty: null,
  };
  private infoPanel: InfoPanelEntry;
  private chatFeed: ChatFeedEntry;
  private survivalBars: SurvivalBarsEntry;
  private miningBar: MiningBarEntry;
  private hintToast: HintToastEntry;

  constructor() {
    this.camera.position.z = 1;
    this.scene.add(this.crosshairGroup);
    this.scene.add(this.hotbarGroup);
    this.infoPanel = this.initInfoPanel();
    this.scene.add(this.infoPanel.sprite);
    this.chatFeed = this.initChatFeed();
    this.scene.add(this.chatFeed.sprite);
    this.survivalBars = this.initSurvivalBars();
    this.scene.add(this.survivalBars.sprite);
    this.miningBar = this.initMiningBar();
    this.scene.add(this.miningBar.sprite);
    this.hintToast = this.initHintToast();
    this.scene.add(this.hintToast.sprite);
    this.initCrosshair();
    this.initHotbar();
  }

  async init() {
    this.slotBackground = await assetManager.loadGuiTexture(SLOT_BG_PATH);
    const iconLoads = Object.entries(HUD_ICON_PATHS).map(async ([key, path]) => {
      this.hudIcons[key as HudIconKey] = await assetManager.loadGuiTexture(path);
    });
    await Promise.all(iconLoads);
    for (const [index, entry] of this.slotMeshes.entries()) {
      this.redrawSlot(entry, null, false, String(index + 1));
    }
    if (this.offhandMesh) {
      this.redrawSlot(this.offhandMesh, null, false, 'F');
    }
  }

  resize(width: number, height: number) {
    this.viewport = { width, height };
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
  }

  update(model: HudModel) {
    this.crosshairGroup.visible = model.crosshair.visible;
    this.hotbarGroup.visible = model.hotbar.visible;
    this.survivalBars.sprite.visible = model.survivalBars.visible;
    this.infoPanel.sprite.visible = model.infoPanel.visible;
    this.chatFeed.sprite.visible = model.chatFeed.visible;

    if (model.crosshair.visible) {
      const [horizontal, vertical] = this.crosshairGroup.children as THREE.Mesh[];
      horizontal.scale.set(model.crosshair.size, model.crosshair.thickness, 1);
      vertical.scale.set(model.crosshair.thickness, model.crosshair.size, 1);
    }

    model.hotbar.slots.forEach((slot, index) => {
      const entry = this.slotMeshes[index];
      if (!entry) return;

      entry.sprite.visible = model.hotbar.visible;
      entry.sprite.position.set(
        -this.viewport.width / 2 + slot.x + slot.size / 2,
        this.viewport.height / 2 - slot.y - slot.size / 2,
        0,
      );
      entry.sprite.scale.set(slot.size, slot.size, 1);

      const token = `${slot.selected}:${slot.slot?.itemId ?? 'empty'}:${slot.slot?.count ?? 0}:${slot.size}`;
      if (entry.token !== token) {
        entry.token = token;
        this.redrawSlot(entry, slot.slot, slot.selected, String(slot.index + 1));
      }
    });

    if (this.offhandMesh && model.hotbar.offhand) {
      const offhand = model.hotbar.offhand;
      this.offhandMesh.sprite.visible = model.hotbar.visible;
      this.offhandMesh.sprite.position.set(
        -this.viewport.width / 2 + offhand.x + offhand.size / 2,
        this.viewport.height / 2 - offhand.y - offhand.size / 2,
        0,
      );
      this.offhandMesh.sprite.scale.set(offhand.size, offhand.size, 1);
      const offhandToken = `offhand:${offhand.slot?.itemId ?? 'empty'}:${offhand.slot?.count ?? 0}:${offhand.size}`;
      if (this.offhandMesh.token !== offhandToken) {
        this.offhandMesh.token = offhandToken;
        this.redrawSlot(this.offhandMesh, offhand.slot, false, 'F');
      }
    } else if (this.offhandMesh) {
      this.offhandMesh.sprite.visible = false;
    }

    const sb = model.survivalBars;
    if (sb.visible) {
      const survivalToken = [
        sb.x,
        sb.y,
        sb.width,
        sb.height,
        sb.iconW,
        sb.iconH,
        sb.gap,
        sb.hp,
        sb.maxHp,
        sb.hunger,
        sb.maxHunger,
      ].join(':');
      if (this.survivalBars.token !== survivalToken) {
        this.survivalBars.token = survivalToken;
        this.redrawSurvivalBars(sb);
      }
      this.survivalBars.sprite.position.set(
        -this.viewport.width / 2 + sb.x + this.survivalBars.width / 2,
        this.viewport.height / 2 - sb.y - this.survivalBars.height / 2,
        0,
      );
      this.survivalBars.sprite.scale.set(this.survivalBars.width, this.survivalBars.height, 1);
    }

    const infoToken = model.infoPanel.lines.join('\n');
    if (this.infoPanel.token !== infoToken) {
      const now = performance.now();
      if (now - this.lastInfoPanelRedraw > 200) {
        this.infoPanel.token = infoToken;
        this.redrawInfoPanel(model.infoPanel.lines);
        this.lastInfoPanelRedraw = now;
      }
    }
    if (model.infoPanel.visible) {
      this.infoPanel.sprite.position.set(
        -this.viewport.width / 2 + model.infoPanel.x + this.infoPanel.width / 2,
        this.viewport.height / 2 - model.infoPanel.y - this.infoPanel.height / 2,
        0,
      );
      this.infoPanel.sprite.scale.set(this.infoPanel.width, this.infoPanel.height, 1);
    }

    const chatToken = model.chatFeed.lines
      .map((line) => `${line.text}:${Math.round(line.opacity * 5) / 5}`)
      .join('\n');
    if (this.chatFeed.token !== chatToken) {
      this.chatFeed.token = chatToken;
      this.redrawChatFeed(model.chatFeed.lines);
    }
    if (model.chatFeed.visible) {
      this.chatFeed.sprite.position.set(
        -this.viewport.width / 2 + model.chatFeed.x + this.chatFeed.width / 2,
        this.viewport.height / 2 - model.chatFeed.y - this.chatFeed.height / 2,
        0,
      );
      this.chatFeed.sprite.scale.set(this.chatFeed.width, this.chatFeed.height, 1);
    }

    const mb = model.miningBar;
    if (mb && mb.visible) {
      const token = `${mb.x}:${mb.y}:${mb.width}:${mb.height}:${mb.progress.toFixed(3)}`;
      if (this.miningBar.token !== token) {
        this.miningBar.token = token;
        this.redrawMiningBar(mb);
      }
      this.miningBar.sprite.visible = true;
      this.miningBar.sprite.position.set(
        -this.viewport.width / 2 + mb.x + this.miningBar.width / 2,
        this.viewport.height / 2 - mb.y - this.miningBar.height / 2,
        0,
      );
      this.miningBar.sprite.scale.set(this.miningBar.width, this.miningBar.height, 1);
    } else {
      this.miningBar.sprite.visible = false;
    }

    const hint = model.activeHint;
    if (hint) {
      const token = `${hint.title}\n${hint.message}\n${hint.opacity.toFixed(3)}\n${hint.offsetY ?? 0}`;
      if (this.hintToast.token !== token) {
        this.hintToast.token = token;
        this.redrawHintToast(hint);
      }
      const marginTop = 56;
      const oy = hint.offsetY ?? 0;
      this.hintToast.sprite.visible = true;
      this.hintToast.sprite.position.set(
        0,
        this.viewport.height / 2 - marginTop - this.hintToast.height / 2 + oy,
        0,
      );
      this.hintToast.sprite.scale.set(this.hintToast.width, this.hintToast.height, 1);
    } else {
      this.hintToast.sprite.visible = false;
    }
  }

  render(renderer: THREE.WebGLRenderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const child of this.crosshairGroup.children) {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    for (const entry of this.slotMeshes) {
      entry.texture.dispose();
      entry.material.dispose();
    }
    if (this.offhandMesh) {
      this.offhandMesh.texture.dispose();
      this.offhandMesh.material.dispose();
      this.offhandMesh = null;
    }
    this.infoPanel.texture.dispose();
    this.infoPanel.material.dispose();
    this.chatFeed.texture.dispose();
    this.chatFeed.material.dispose();
    this.survivalBars.texture.dispose();
    this.survivalBars.material.dispose();
    this.miningBar.texture.dispose();
    this.miningBar.material.dispose();
    this.hintToast.texture.dispose();
    this.hintToast.material.dispose();
    this.slotMeshes.length = 0;
  }

  private initCrosshair() {
    const horizontalGeo = new THREE.PlaneGeometry(1, 1);
    const verticalGeo = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });

    const horizontal = new THREE.Mesh(horizontalGeo, material.clone());
    const vertical = new THREE.Mesh(verticalGeo, material.clone());
    material.dispose();
    this.crosshairGroup.add(horizontal, vertical);
  }

  private initHotbar() {
    for (let i = 0; i < 9; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = HOTBAR_SLOT_TEXTURE_SIZE;
      canvas.height = HOTBAR_SLOT_TEXTURE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;

      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 1000 + i;
      this.hotbarGroup.add(sprite);
      this.slotMeshes.push({ canvas, ctx, texture, material, sprite, token: '' });
    }
    this.offhandMesh = this.createSlotMesh(990);
    if (this.offhandMesh) {
      this.hotbarGroup.add(this.offhandMesh.sprite);
    }
  }

  private createSlotMesh(renderOrder: number): SlotMeshEntry | null {
    const canvas = document.createElement('canvas');
    canvas.width = HOTBAR_SLOT_TEXTURE_SIZE;
    canvas.height = HOTBAR_SLOT_TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = renderOrder;
    return { canvas, ctx, texture, material, sprite, token: '' };
  }

  private initInfoPanel(): InfoPanelEntry {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context unavailable for HUD info panel');
    }
    ctx.imageSmoothingEnabled = false;

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 1100;
    return { canvas, ctx, texture, material, sprite, token: '', width: 1, height: 1 };
  }

  private initHintToast(): HintToastEntry {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context unavailable for hint toast HUD');
    }
    ctx.imageSmoothingEnabled = false;

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 1115;
    return { canvas, ctx, texture, material, sprite, token: '', width: 1, height: 1 };
  }

  private redrawHintToast(h: HudActiveHintModel) {
    const { canvas, ctx, texture, material } = this.hintToast;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const titleSize = 15;
    const msgSize = 13;
    const padX = 14;
    const padY = 10;
    const maxTextW = Math.min(420, Math.max(220, Math.round(this.viewport.width * 0.72)));

    ctx.font = `bold ${titleSize}px Monocraft, monospace`;
    const titleLines = this.wrapHudText(ctx, h.title, maxTextW);
    const titleTextW = titleLines.reduce((w, l) => Math.max(w, ctx.measureText(l).width), 0);
    ctx.font = `${msgSize}px Monocraft, monospace`;
    const msgLines = this.wrapHudText(ctx, h.message, maxTextW);
    const msgTextW = msgLines.reduce((w, l) => Math.max(w, ctx.measureText(l).width), 0);
    const lineHTitle = Math.round(titleSize * 1.15);
    const lineHMsg = Math.round(msgSize * 1.2);
    const cssWidth = Math.ceil(Math.max(maxTextW, titleTextW, msgTextW) + padX * 2);
    const cssHeight = Math.ceil(
      padY * 2 +
        titleLines.length * lineHTitle +
        (titleLines.length && msgLines.length ? 6 : 0) +
        msgLines.length * lineHMsg,
    );

    canvas.width = Math.max(2, Math.ceil(cssWidth * dpr));
    canvas.height = Math.max(2, Math.ceil(cssHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = h.opacity;

    const r = 4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(0, 0, cssWidth, cssHeight, r);
    } else {
      ctx.rect(0, 0, cssWidth, cssHeight);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(0.5, 0.5, cssWidth - 1, cssHeight - 1, r);
      ctx.stroke();
    } else {
      ctx.strokeRect(0.5, 0.5, cssWidth - 1, cssHeight - 1);
    }

    let y = padY;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${titleSize}px Monocraft, monospace`;
    ctx.fillStyle = '#ffdd33';
    for (const line of titleLines) {
      ctx.fillText(line, padX, y);
      y += lineHTitle;
    }
    if (titleLines.length && msgLines.length) {
      y += 4;
    }
    ctx.font = `${msgSize}px Monocraft, monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    for (const line of msgLines) {
      ctx.fillText(line, padX, y);
      y += lineHMsg;
    }

    ctx.globalAlpha = 1;
    texture.needsUpdate = true;
    material.opacity = 1;
    this.hintToast.width = cssWidth;
    this.hintToast.height = cssHeight;
  }

  private wrapHudText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let cur = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const w = words[i]!;
      const test = `${cur} ${w}`;
      if (ctx.measureText(test).width <= maxWidth) {
        cur = test;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    lines.push(cur);
    return lines;
  }

  private initMiningBar(): MiningBarEntry {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context unavailable for mining HUD');
    }
    ctx.imageSmoothingEnabled = false;

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 1085;
    return { canvas, ctx, texture, material, sprite, token: '', width: 1, height: 1 };
  }

  private redrawMiningBar(mb: MiningBarHudModel) {
    const { canvas, ctx, texture } = this.miningBar;
    const w = Math.max(32, Math.round(mb.width));
    const h = Math.max(4, Math.round(mb.height));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    const innerW = Math.max(0, w - 4);
    const innerH = Math.max(1, h - 4);
    ctx.fillStyle = 'rgba(220, 220, 220, 0.92)';
    ctx.fillRect(2, 2, innerW * mb.progress, innerH);
    texture.needsUpdate = true;
    this.miningBar.width = w;
    this.miningBar.height = h;
  }

  private initSurvivalBars(): SurvivalBarsEntry {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context unavailable for survival HUD');
    }
    ctx.imageSmoothingEnabled = false;

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 1040;
    return { canvas, ctx, texture, material, sprite, token: '', width: 1, height: 1 };
  }

  private redrawSurvivalBars(sb: SurvivalHudModel) {
    const { canvas, ctx, texture } = this.survivalBars;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const padY = Math.round((sb.height - sb.iconH) / 2);
    const heartRowW = 10 * (sb.iconW + sb.gap) - sb.gap;
    const cssWidth = Math.max(sb.width, heartRowW * 2 + 8);
    const cssHeight = sb.height;

    canvas.width = Math.max(2, Math.ceil(cssWidth * dpr));
    canvas.height = Math.max(2, Math.ceil(cssHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.imageSmoothingEnabled = false;

    const hpU = survivalHudDisplayUnits(sb.hp, sb.maxHp);
    const foodU = survivalHudDisplayUnits(sb.hunger, sb.maxHunger);
    const yIcons = padY;
    const ih = Math.round(sb.iconH);
    drawSpriteIconRow(ctx, 0, yIcons, sb.iconW, ih, sb.gap, hpU, {
      container: this.hudIcons.heartContainer,
      half: this.hudIcons.heartHalf,
      full: this.hudIcons.heartFull,
      empty: null,
    });
    const hungerStart = cssWidth - heartRowW;
    drawSpriteIconRow(ctx, hungerStart, yIcons, sb.iconW, ih, sb.gap, foodU, {
      empty: this.hudIcons.foodEmpty,
      half: this.hudIcons.foodHalf,
      full: this.hudIcons.foodFull,
    });

    this.survivalBars.width = cssWidth;
    this.survivalBars.height = cssHeight;
    texture.needsUpdate = true;
  }

  private initChatFeed(): ChatFeedEntry {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context unavailable for HUD chat feed');
    }
    ctx.imageSmoothingEnabled = false;

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 1090;
    return { canvas, ctx, texture, material, sprite, token: '', width: 1, height: 1 };
  }

  private redrawSlot(entry: SlotMeshEntry, slot: HotbarHudSlotModel['slot'], selected: boolean, label: string) {
    const { ctx, canvas, texture } = entry;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    if (this.slotBackground) {
      ctx.drawImage(this.slotBackground, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (selected) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px Monocraft, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, 5, 4);

    if (slot) {
      this.drawItemIcon(entry, slot.itemId);
      if (slot.count > 1) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Monocraft, monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        const text = String(slot.count);
        ctx.strokeText(text, canvas.width - 6, canvas.height - 5);
        ctx.fillText(text, canvas.width - 6, canvas.height - 5);
      }
    }

    texture.needsUpdate = true;
  }

  private drawItemIcon(entry: SlotMeshEntry, itemId: number) {
    const def = getItemDef(itemId);
    const texName = def?.texture ?? '';
    const fallbackLabel = getItemIconFallbackLabel(itemId);
    const { ctx, canvas, texture } = entry;
    const iconX = 10;
    const iconY = 12;
    const iconSize = 44;

    if (!texName) {
      ctx.save();
      ctx.translate(iconX, iconY);
      drawFallback(ctx, '', iconSize, fallbackLabel);
      ctx.restore();
      return;
    }

    const primaryFolder = def?.kind === 'block' ? 'block' : 'item';
    const secondaryFolder = primaryFolder === 'block' ? 'item' : 'block';
    const primaryPath = `${MC_TEXTURES}/${primaryFolder}/${texName}.png`;
    const secondaryPath = `${MC_TEXTURES}/${secondaryFolder}/${texName}.png`;
    const cachedPrimary = assetManager.getImage(primaryPath);
    if (cachedPrimary) {
      ctx.drawImage(cachedPrimary, iconX, iconY, iconSize, iconSize);
      return;
    }
    const cachedSecondary = assetManager.getImage(secondaryPath);
    if (cachedSecondary) {
      ctx.drawImage(cachedSecondary, iconX, iconY, iconSize, iconSize);
      return;
    }

    ctx.save();
    ctx.translate(iconX, iconY);
    drawFallback(ctx, texName, iconSize, fallbackLabel);
    ctx.restore();
    texture.needsUpdate = true;

    const primaryLoader = primaryFolder === 'block'
      ? assetManager.loadBlockTexture(texName)
      : assetManager.loadItemTexture(texName);
    const loadToken = entry.token;
    void primaryLoader.then(async (img) => {
      if (entry.token !== loadToken) return;
      const resolved = img ?? await (secondaryFolder === 'block'
        ? assetManager.loadBlockTexture(texName)
        : assetManager.loadItemTexture(texName));
      if (!resolved || entry.token !== loadToken) return;
      ctx.clearRect(iconX, iconY, iconSize, iconSize);
      ctx.drawImage(resolved, iconX, iconY, iconSize, iconSize);
      texture.needsUpdate = true;
    });
  }

  private infoPanelMaxWidth = 200;

  private redrawInfoPanel(lines: string[]) {
    const { canvas, ctx, texture } = this.infoPanel;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const fontSize = 13;
    const lineHeight = 16;
    const paddingX = 10;
    const paddingY = 8;
    const activeLines = lines.length > 0 ? lines : [''];

    ctx.font = `${fontSize}px Monocraft, monospace`;
    const measuredWidth = activeLines.reduce(
      (width, line) => Math.max(width, ctx.measureText(line).width),
      0,
    );
    const needed = Math.ceil(measuredWidth + paddingX * 2);
    this.infoPanelMaxWidth = Math.max(this.infoPanelMaxWidth, needed);
    const cssWidth = this.infoPanelMaxWidth;
    const cssHeight = Math.ceil(activeLines.length * lineHeight + paddingY * 2);

    canvas.width = Math.max(2, Math.ceil(cssWidth * dpr));
    canvas.height = Math.max(2, Math.ceil(cssHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.font = `${fontSize}px Monocraft, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    activeLines.forEach((line, index) => {
      ctx.fillText(line, paddingX, paddingY + index * lineHeight);
    });

    this.infoPanel.width = cssWidth;
    this.infoPanel.height = cssHeight;
    texture.needsUpdate = true;
  }

  private redrawChatFeed(lines: HudModel['chatFeed']['lines']) {
    const { canvas, ctx, texture } = this.chatFeed;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const fontSize = 13;
    const lineHeight = 18;
    const paddingX = 8;
    const paddingY = 4;
    const activeLines = lines.length > 0 ? lines : [{ text: '', opacity: 0 }];

    ctx.font = `${fontSize}px Monocraft, monospace`;
    const measuredWidth = activeLines.reduce(
      (width, line) => Math.max(width, ctx.measureText(line.text).width),
      0,
    );
    const cssWidth = Math.max(250, Math.ceil(measuredWidth + paddingX * 2));
    const cssHeight = Math.ceil(activeLines.length * lineHeight);

    canvas.width = Math.max(2, Math.ceil(cssWidth * dpr));
    canvas.height = Math.max(2, Math.ceil(cssHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.imageSmoothingEnabled = false;
    ctx.font = `${fontSize}px Monocraft, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    activeLines.forEach((line, index) => {
      const y = index * lineHeight;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * line.opacity})`;
      ctx.fillRect(0, y, cssWidth, lineHeight - 1);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * line.opacity})`;
      ctx.fillText(line.text, paddingX, y + paddingY);
    });

    this.chatFeed.width = cssWidth;
    this.chatFeed.height = cssHeight;
    texture.needsUpdate = true;
  }
}
