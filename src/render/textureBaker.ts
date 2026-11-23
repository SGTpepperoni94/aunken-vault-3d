import * as THREE from 'three';
import type { BiomeId } from '../game/types';
import { BIOME_PALETTES } from '../world/DungeonLogic';
import { mulberry32 } from '../systems/LootAndForge';
import { AssetRegistry } from './assetRegistry';

function makePixelCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function finalizePixelTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbStr(r: number, g: number, b: number, a = 1): string {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return a < 1 ? `rgba(${cr},${cg},${cb},${a})` : `rgb(${cr},${cg},${cb})`;
}

export interface BiomeTexturePack {
  wallMap: THREE.Texture;
  wallBump: THREE.Texture;
  floorMap: THREE.Texture;
  archMap: THREE.Texture;
  mossVineMap: THREE.Texture;
  crackedWallMap: THREE.Texture;
  trapFloorMap: THREE.Texture;
  woodBarrelMap: THREE.Texture;
  chestWoodMap: THREE.Texture;
  fogGateMap: THREE.Texture;
  whisperRuneMap: THREE.Texture;
  skyboxMap: THREE.Texture;
  contactShadowMap: THREE.Texture;
}

function bakeStoneWall(biome: BiomeId, isArch = false, isCracked = false): HTMLCanvasElement {
  const pal = BIOME_PALETTES[biome];
  const [c, ctx] = makePixelCanvas(64, 64);
  const rng = mulberry32(biome.charCodeAt(0) * 997 + (isArch ? 13 : 0) + (isCracked ? 71 : 0));
  const [pr, pg, pb] = hexToRgb(pal.wallPrimary);
  const [sr, sg, sb] = hexToRgb(pal.wallSecondary);
  const [mr, mg, mb] = hexToRgb(pal.mossColor);

  // Dark mortar background
  ctx.fillStyle = rgbStr(sr * 0.42, sg * 0.42, sb * 0.42);
  ctx.fillRect(0, 0, 64, 64);

  const rows = isArch ? 8 : 6;
  const rowH = Math.floor(64 / rows);

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const offset = (r % 2) * 8;
    let x = -offset;
    while (x < 64) {
      const w = 12 + Math.floor(rng() * 10);
      const shade = 0.78 + rng() * 0.42;
      const mix = rng() * 0.4;
      const br = (pr * (1 - mix) + sr * mix) * shade;
      const bg = (pg * (1 - mix) + sg * mix) * shade;
      const bb = (pb * (1 - mix) + sb * mix) * shade;

      // Brick fill
      ctx.fillStyle = rgbStr(br, bg, bb);
      ctx.fillRect(x + 1, y + 1, w - 2, rowH - 2);

      // Top bevel highlight
      ctx.fillStyle = rgbStr(br * 1.24, bg * 1.22, bb * 1.18);
      ctx.fillRect(x + 1, y + 1, w - 2, 1);
      ctx.fillRect(x + 1, y + 1, 1, rowH - 3);

      // Bottom/right shadow bevel
      ctx.fillStyle = rgbStr(br * 0.58, bg * 0.58, bb * 0.58);
      ctx.fillRect(x + 1, y + rowH - 2, w - 2, 1);
      ctx.fillRect(x + w - 2, y + 1, 1, rowH - 2);

      // Stone surface mottling pixels
      for (let p = 0; p < 10; p++) {
        const px = x + 2 + Math.floor(rng() * Math.max(1, w - 4));
        const py = y + 2 + Math.floor(rng() * Math.max(1, rowH - 4));
        const d = rng() > 0.5 ? 1.18 : 0.76;
        ctx.fillStyle = rgbStr(br * d, bg * d, bb * d);
        ctx.fillRect(px, py, 1, 1);
      }
      x += w;
    }
  }

  // Dripping moss / lichen tufts along mortar seams (prominent in B1 & Hub like reference!)
  const mossCount = biome === 'b1' ? 28 : biome === 'hub' ? 16 : 12;
  for (let i = 0; i < mossCount; i++) {
    const mx = Math.floor(rng() * 60);
    const my = Math.floor(rng() * 56);
    const len = 3 + Math.floor(rng() * 7);
    for (let k = 0; k < len; k++) {
      const mShade = 0.75 + rng() * 0.5;
      ctx.fillStyle = rgbStr(mr * mShade, mg * mShade, mb * mShade);
      ctx.fillRect(mx + Math.floor(rng() * 3) - 1, my + k, 2, 1);
    }
  }

  // If cracked secret wall, carve bright amber-lit fissures
  if (isCracked) {
    ctx.strokeStyle = '#140e0a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, 4);
    ctx.lineTo(34, 20);
    ctx.lineTo(24, 34);
    ctx.lineTo(38, 48);
    ctx.lineTo(30, 62);
    ctx.stroke();

    ctx.strokeStyle = '#d9a443';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(29, 8);
    ctx.lineTo(35, 20);
    ctx.lineTo(25, 34);
    ctx.lineTo(37, 48);
    ctx.stroke();
  }

  return c;
}

function bakeStoneFloor(biome: BiomeId, isTrap = false): HTMLCanvasElement {
  const pal = BIOME_PALETTES[biome];
  const [c, ctx] = makePixelCanvas(64, 64);
  const rng = mulberry32(biome.charCodeAt(0) * 521 + (isTrap ? 33 : 0));
  const [pr, pg, pb] = hexToRgb(pal.floorPrimary);
  const [ar, ag, ab] = hexToRgb(pal.floorAccent);
  const [mr, mg, mb] = hexToRgb(pal.mossColor);

  // Dark soil/mortar base
  ctx.fillStyle = rgbStr(ar * 0.45, ag * 0.45, ab * 0.45);
  ctx.fillRect(0, 0, 64, 64);

  // Flagstone cobblestones (crisp weathered pavers)
  const grid = 4;
  const cell = 16;
  for (let gz = 0; gz < grid; gz++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = gx * cell + (gz % 2 === 1 ? 4 : 0);
      const y = gz * cell;
      const drawFlag = (fx: number, fy: number) => {
        const shade = 0.78 + rng() * 0.4;
        const r = pr * shade;
        const g = pg * shade;
        const b = pb * shade;
        ctx.fillStyle = rgbStr(r, g, b);
        ctx.fillRect(fx + 1, fy + 1, cell - 2, cell - 2);
        // Highlight & bevel
        ctx.fillStyle = rgbStr(r * 1.2, g * 1.18, b * 1.15);
        ctx.fillRect(fx + 1, fy + 1, cell - 3, 1);
        ctx.fillStyle = rgbStr(r * 0.62, g * 0.62, b * 0.62);
        ctx.fillRect(fx + 1, fy + cell - 2, cell - 2, 1);
        // Speckle
        for (let s = 0; s < 8; s++) {
          const sx = fx + 2 + Math.floor(rng() * (cell - 4));
          const sy = fy + 2 + Math.floor(rng() * (cell - 4));
          const mult = rng() > 0.5 ? 1.15 : 0.78;
          ctx.fillStyle = rgbStr(r * mult, g * mult, b * mult);
          ctx.fillRect(sx, sy, 1, 1);
        }
      };
      drawFlag(x % 64, y);
      if (x + cell > 64) drawFlag(x - 64, y);
    }
  }

  // Mossy cracks between floor stones
  for (let i = 0; i < 22; i++) {
    const mx = Math.floor(rng() * 62);
    const my = Math.floor(rng() * 62);
    ctx.fillStyle = rgbStr(mr * (0.7 + rng() * 0.5), mg * (0.7 + rng() * 0.5), mb * (0.7 + rng() * 0.5));
    ctx.fillRect(mx, my, 2, 1);
  }

  if (isTrap) {
    // Iron spike grate pressure plate
    ctx.fillStyle = '#241e1c';
    ctx.fillRect(8, 8, 48, 48);
    ctx.strokeStyle = '#806444';
    ctx.lineWidth = 2;
    ctx.strokeRect(9, 9, 46, 46);
    for (let y = 14; y < 52; y += 8) {
      for (let x = 14; x < 52; x += 8) {
        ctx.fillStyle = '#090707';
        ctx.fillRect(x, y, 4, 4);
        ctx.fillStyle = '#c89b5a';
        ctx.fillRect(x + 1, y + 1, 2, 2);
      }
    }
  }

  return c;
}

function bakeMossVines(): HTMLCanvasElement {
  const [c, ctx] = makePixelCanvas(64, 64);
  const rng = mulberry32(808);
  ctx.clearRect(0, 0, 64, 64);

  const strands = 9;
  for (let s = 0; s < strands; s++) {
    const baseX = 4 + s * 6 + Math.floor(rng() * 3);
    const len = 18 + Math.floor(rng() * 42);
    for (let y = 0; y < len; y++) {
      const sway = Math.round(Math.sin(y * 0.18 + s) * 1.4);
      const width = y < len * 0.4 ? 3 : y < len * 0.8 ? 2 : 1;
      const g = 88 + Math.floor(rng() * 42) - Math.floor(y * 0.4);
      const r = Math.floor(g * 0.72);
      const b = Math.floor(g * 0.28);
      ctx.fillStyle = rgbStr(r, g, b);
      ctx.fillRect(baseX + sway, y, width, 1);
      if (rng() > 0.65) {
        ctx.fillStyle = rgbStr(r * 1.25, g * 1.25, b * 1.1);
        ctx.fillRect(baseX + sway + 1, y, 1, 1);
      }
    }
  }
  return c;
}

function bakeWoodTexture(ironBands: boolean, gilded = false): HTMLCanvasElement {
  const [c, ctx] = makePixelCanvas(64, 64);
  const rng = mulberry32(ironBands ? 314 : 628);

  // Vertical wood planks
  for (let x = 0; x < 64; x += 8) {
    const shade = 0.82 + rng() * 0.32;
    ctx.fillStyle = rgbStr(92 * shade, 60 * shade, 36 * shade);
    ctx.fillRect(x, 0, 7, 64);
    ctx.fillStyle = '#23150c';
    ctx.fillRect(x + 7, 0, 1, 64);
    for (let y = 0; y < 64; y += 3) {
      const g = rng() > 0.5 ? 1.12 : 0.84;
      ctx.fillStyle = rgbStr(92 * shade * g, 60 * shade * g, 36 * shade * g);
      ctx.fillRect(x + 1 + Math.floor(rng() * 5), y, 1, 3);
    }
  }

  if (ironBands) {
    const bandColor = gilded ? '#b58d3e' : '#4a4e54';
    const hiColor = gilded ? '#f0ca6d' : '#7b828c';
    for (const y of [10, 48]) {
      ctx.fillStyle = '#1b1a1c';
      ctx.fillRect(0, y - 1, 64, 8);
      ctx.fillStyle = bandColor;
      ctx.fillRect(0, y, 64, 6);
      ctx.fillStyle = hiColor;
      ctx.fillRect(0, y, 64, 1);
      for (let rx = 4; rx < 64; rx += 12) {
        ctx.fillStyle = hiColor;
        ctx.fillRect(rx, y + 2, 2, 2);
      }
    }
  }

  return c;
}

function bakeFogGateTexture(): HTMLCanvasElement {
  const [c, ctx] = makePixelCanvas(64, 64);
  const rng = mulberry32(991);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const wave = Math.sin(x * 0.25 + y * 0.14) * 0.5 + 0.5;
      const swirl = Math.cos(y * 0.3 - x * 0.18) * 0.5 + 0.5;
      const v = (wave * 0.6 + swirl * 0.4) * 0.8 + rng() * 0.2;
      const r = 185 + v * 65;
      const g = 178 + v * 65;
      const b = 200 + v * 50;
      const a = 0.52 + v * 0.35;
      ctx.fillStyle = rgbStr(r, g, b, a);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function bakeWhisperRuneTexture(): HTMLCanvasElement {
  const [c, ctx] = makePixelCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = '#ffbe55';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(32, 32, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ff9838';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(32, 12);
  ctx.lineTo(44, 46);
  ctx.lineTo(16, 24);
  ctx.lineTo(48, 24);
  ctx.lineTo(20, 46);
  ctx.closePath();
  ctx.stroke();
  return c;
}

/**
 * Bakes the signature Twilight-Violet Mountain & Silhouetted Gothic Castle Skybox
 * matching the Golden Standard PRD vision (panoramic equirectangular-like cylinder sky).
 */
function bakeTwilightGothicSkybox(): HTMLCanvasElement {
  const [c, ctx] = makePixelCanvas(512, 256);
  const rng = mulberry32(1337);

  // 1. Rich moody twilight-violet & dusky rose horizon gradient (quantized painterly bands)
  const skyBands = [
    { y: 0, h: 26, col: '#181130' },
    { y: 26, h: 24, col: '#241845' },
    { y: 50, h: 26, col: '#35225e' },
    { y: 76, h: 26, col: '#4c2e78' },
    { y: 102, h: 24, col: '#693c82' },
    { y: 126, h: 20, col: '#8a4c84' },
    { y: 146, h: 18, col: '#ad637e' },
    { y: 164, h: 14, col: '#c77e78' },
    { y: 178, h: 78, col: '#1c1528' },
  ];
  for (const b of skyBands) {
    ctx.fillStyle = b.col;
    ctx.fillRect(0, b.y, 512, b.h);
  }

  // Crisp twilight stars
  for (let i = 0; i < 95; i++) {
    const sx = Math.floor(rng() * 512);
    const sy = Math.floor(rng() * 110);
    ctx.fillStyle = rng() > 0.65 ? '#f5eeff' : '#b29ee0';
    ctx.fillRect(sx, sy, 1, 1);
  }

  // Luminous crescent moon high in upper-left sky
  ctx.fillStyle = '#faf0d7';
  ctx.beginPath();
  ctx.arc(178, 72, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#382461';
  ctx.beginPath();
  ctx.arc(184, 69, 11, 0, Math.PI * 2);
  ctx.fill();

  // Painterly twilight cloud ribbons
  for (let i = 0; i < 28; i++) {
    const cx = Math.floor(rng() * 480);
    const cy = 58 + Math.floor(rng() * 94);
    const cw = 30 + Math.floor(rng() * 68);
    ctx.fillStyle = cy > 118 ? 'rgba(204,126,142,0.42)' : 'rgba(98,62,135,0.42)';
    ctx.fillRect(cx, cy, cw, 3);
    ctx.fillRect(cx + 8, cy - 2, cw - 16, 2);
  }

  // 2. Distant jagged twilight mountain silhouettes
  ctx.fillStyle = '#31214a';
  ctx.beginPath();
  ctx.moveTo(0, 186);
  for (let x = 0; x <= 512; x += 6) {
    const peak =
      152 -
      Math.abs(Math.sin(x * 0.022 + 0.5) * 44) -
      Math.abs(Math.cos(x * 0.055) * 20);
    ctx.lineTo(x, Math.round(peak));
  }
  ctx.lineTo(512, 195);
  ctx.closePath();
  ctx.fill();

  // 3. Mid-ground mountain ridge + towering silhouetted Gothic Castle Spires!
  ctx.fillStyle = '#1c152e';
  ctx.beginPath();
  ctx.moveTo(0, 192);
  for (let x = 0; x <= 512; x += 6) {
    const h = 166 - Math.abs(Math.sin(x * 0.036 + 1.0) * 26) - Math.abs(Math.sin(x * 0.085) * 11);
    ctx.lineTo(x, Math.round(h));
  }
  ctx.lineTo(512, 200);
  ctx.closePath();
  ctx.fill();

  const drawCastle = (cx: number, baseY: number, scale: number) => {
    ctx.fillStyle = '#120c21';
    ctx.fillRect(cx - 24 * scale, baseY - 28 * scale, 48 * scale, 38 * scale);
    const spires = [
      { dx: -24, w: 8, h: 48 },
      { dx: -12, w: 10, h: 66 },
      { dx: 1, w: 13, h: 82 },
      { dx: 15, w: 10, h: 56 },
    ];
    for (const sp of spires) {
      const sx = cx + sp.dx * scale;
      const sw = sp.w * scale;
      const sh = sp.h * scale;
      ctx.fillRect(sx, baseY - sh, sw, sh + 10);
      ctx.beginPath();
      ctx.moveTo(sx - 2, baseY - sh);
      ctx.lineTo(sx + sw / 2, baseY - sh - 26 * scale);
      ctx.lineTo(sx + sw + 2, baseY - sh);
      ctx.closePath();
      ctx.fill();
    }
    // Glowing amber lancet cathedral windows
    ctx.fillStyle = '#ffbe4f';
    ctx.fillRect(cx - 8 * scale, baseY - 46 * scale, 2, 5);
    ctx.fillRect(cx + 6 * scale, baseY - 58 * scale, 3, 6);
    ctx.fillRect(cx + 18 * scale, baseY - 38 * scale, 2, 4);
  };

  // Frame dramatic gothic castle silhouettes across the northern vista (centered around u=0.5 / x=256)
  drawCastle(256, 166, 1.25);
  drawCastle(142, 170, 0.85);
  drawCastle(368, 168, 0.9);

  // 4. Foreground dark pine forest canopy
  ctx.fillStyle = '#0f0e19';
  for (let x = 0; x < 512; x += 6) {
    const th = 14 + Math.floor(rng() * 18);
    ctx.beginPath();
    ctx.moveTo(x - 4, 188);
    ctx.lineTo(x + 2, 188 - th);
    ctx.lineTo(x + 8, 188);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(0, 186, 512, 70);

  return c;
}

function bakeContactShadow(): HTMLCanvasElement {
  const [c, ctx] = makePixelCanvas(32, 32);
  const grad = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
  grad.addColorStop(0, 'rgba(0,0,0,0.72)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.34)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return c;
}

function bakeBumpFromColor(colorCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = makePixelCanvas(colorCanvas.width, colorCanvas.height);
  const src = colorCanvas.getContext('2d')!.getImageData(0, 0, colorCanvas.width, colorCanvas.height);
  const out = ctx.createImageData(colorCanvas.width, colorCanvas.height);
  for (let i = 0; i < src.data.length; i += 4) {
    const lum = Math.round(src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114);
    out.data[i] = lum;
    out.data[i + 1] = lum;
    out.data[i + 2] = lum;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

export function getBiomeTexturePack(biome: BiomeId): BiomeTexturePack {
  let wallCanvas: HTMLCanvasElement | null = null;
  const wallMap = AssetRegistry.getTexture(`wall_${biome}`, () => {
    wallCanvas = bakeStoneWall(biome, false, false);
    return finalizePixelTexture(wallCanvas, 1, 1, true);
  });
  const wallBump = AssetRegistry.getTexture(`wall_bump_${biome}`, () => {
    const src = wallCanvas ?? bakeStoneWall(biome, false, false);
    return finalizePixelTexture(bakeBumpFromColor(src), 1, 1, false);
  });
  const floorMap = AssetRegistry.getTexture(`floor_${biome}`, () =>
    finalizePixelTexture(bakeStoneFloor(biome, false), 1, 1, true)
  );
  const archMap = AssetRegistry.getTexture(`arch_${biome}`, () =>
    finalizePixelTexture(bakeStoneWall(biome, true, false), 2, 2, true)
  );
  const mossVineMap = AssetRegistry.getTexture('moss_vines', () =>
    finalizePixelTexture(bakeMossVines(), 1, 1, true)
  );
  const crackedWallMap = AssetRegistry.getTexture(`cracked_${biome}`, () =>
    finalizePixelTexture(bakeStoneWall(biome, false, true), 1, 1, true)
  );
  const trapFloorMap = AssetRegistry.getTexture(`trap_${biome}`, () =>
    finalizePixelTexture(bakeStoneFloor(biome, true), 1, 1, true)
  );
  const woodBarrelMap = AssetRegistry.getTexture('wood_barrel', () =>
    finalizePixelTexture(bakeWoodTexture(true, false), 1, 1, true)
  );
  const chestWoodMap = AssetRegistry.getTexture('chest_wood', () =>
    finalizePixelTexture(bakeWoodTexture(true, true), 1, 1, true)
  );
  const fogGateMap = AssetRegistry.getTexture('fog_gate', () =>
    finalizePixelTexture(bakeFogGateTexture(), 1, 1, true)
  );
  const whisperRuneMap = AssetRegistry.getTexture('whisper_rune', () =>
    finalizePixelTexture(bakeWhisperRuneTexture(), 1, 1, true)
  );
  const skyboxMap = AssetRegistry.getTexture('twilight_skybox', () => {
    const tex = finalizePixelTexture(bakeTwilightGothicSkybox(), 1, 1, true);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
  const contactShadowMap = AssetRegistry.getTexture('contact_shadow', () => {
    const tex = finalizePixelTexture(bakeContactShadow(), 1, 1, true);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });

  return {
    wallMap,
    wallBump,
    floorMap,
    archMap,
    mossVineMap,
    crackedWallMap,
    trapFloorMap,
    woodBarrelMap,
    chestWoodMap,
    fogGateMap,
    whisperRuneMap,
    skyboxMap,
    contactShadowMap,
  };
}
