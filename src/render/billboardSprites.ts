import * as THREE from 'three';
import type { EnemyArchetype, Rarity } from '../game/types';
import { AssetRegistry } from './assetRegistry';

export type SpriteAnimFrame = 'idle' | 'walk' | 'windup' | 'attack' | 'stagger';

function createPixelCtx(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function addPixelOutline(canvas: HTMLCanvasElement, outlineColor = '#0c090a'): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  out.data.set(src.data);

  const [or, og, ob] = [
    parseInt(outlineColor.slice(1, 3), 16),
    parseInt(outlineColor.slice(3, 5), 16),
    parseInt(outlineColor.slice(5, 7), 16),
  ];

  const hasAlpha = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return src.data[(y * w + x) * 4 + 3] > 80;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (src.data[idx + 3] > 80) continue;
      if (hasAlpha(x - 1, y) || hasAlpha(x + 1, y) || hasAlpha(x, y - 1) || hasAlpha(x, y + 1)) {
        out.data[idx] = or;
        out.data[idx + 1] = og;
        out.data[idx + 2] = ob;
        out.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

function toPixelSpriteTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function drawGoblinFrame(ctx: CanvasRenderingContext2D, frame: SpriteAnimFrame): void {
  const bob = frame === 'walk' ? -2 : frame === 'stagger' ? 5 : 0;
  const lean = frame === 'attack' ? -4 : frame === 'windup' ? 3 : frame === 'stagger' ? 4 : 0;

  // Legs
  ctx.fillStyle = '#4f6e33';
  ctx.fillRect(18, 35 + bob, 4, 10 - Math.max(0, bob));
  ctx.fillRect(26, 35 + (frame === 'walk' ? 0 : bob), 4, 10);
  // Boots/wrappings
  ctx.fillStyle = '#4a3522';
  ctx.fillRect(17, 42, 5, 4);
  ctx.fillRect(26, 42, 5, 4);

  // Tattered leather tunic
  ctx.fillStyle = '#63472d';
  ctx.fillRect(16 + lean, 22 + bob, 16, 15);
  ctx.fillStyle = '#825f3c';
  ctx.fillRect(18 + lean, 23 + bob, 12, 6);
  ctx.fillStyle = '#382515';
  ctx.fillRect(16 + lean, 31 + bob, 16, 3); // belt
  ctx.fillStyle = '#cfa14b';
  ctx.fillRect(23 + lean, 31 + bob, 3, 3); // buckle

  // Green Goblin head & pointed ears
  ctx.fillStyle = '#6d9142';
  ctx.fillRect(17 + lean, 10 + bob, 14, 12);
  ctx.fillStyle = '#89b056';
  ctx.fillRect(19 + lean, 11 + bob, 10, 5);
  // Pointed ears
  ctx.fillStyle = '#5c7d36';
  ctx.fillRect(11 + lean, 12 + bob, 6, 4);
  ctx.fillRect(9 + lean, 11 + bob, 3, 2);
  ctx.fillRect(31 + lean, 12 + bob, 6, 4);
  ctx.fillRect(36 + lean, 11 + bob, 3, 2);

  // Glowing yellow eyes & snarl
  ctx.fillStyle = frame === 'windup' ? '#ff5533' : '#f5d742';
  ctx.fillRect(20 + lean, 15 + bob, 3, 2);
  ctx.fillRect(26 + lean, 15 + bob, 3, 2);
  ctx.fillStyle = '#241410';
  ctx.fillRect(21 + lean, 19 + bob, 6, 2);
  ctx.fillStyle = '#e8e2cc';
  ctx.fillRect(22 + lean, 19 + bob, 1, 1);
  ctx.fillRect(25 + lean, 19 + bob, 1, 1);

  // Arms & jagged spear
  ctx.fillStyle = '#6d9142';
  if (frame === 'windup') {
    // Raised spear telegraph!
    ctx.fillRect(31 + lean, 12 + bob, 5, 10);
    ctx.fillStyle = '#6b472a';
    ctx.fillRect(34 + lean, 3 + bob, 3, 28);
    // Gleaming telegraph tip
    ctx.fillStyle = '#ff9842';
    ctx.fillRect(32 + lean, 1 + bob, 7, 7);
    ctx.fillStyle = '#fff3b8';
    ctx.fillRect(34 + lean, 2 + bob, 3, 4);
  } else if (frame === 'attack') {
    ctx.fillRect(8, 22 + bob, 10, 4);
    ctx.fillStyle = '#6b472a';
    ctx.fillRect(4, 24 + bob, 30, 3);
    ctx.fillStyle = '#d8e0e8';
    ctx.fillRect(1, 22 + bob, 7, 7);
  } else {
    ctx.fillRect(12 + lean, 24 + bob, 4, 9);
    ctx.fillRect(32 + lean, 23 + bob, 4, 9);
    // Held spear upright
    ctx.fillStyle = '#6b472a';
    ctx.fillRect(35 + lean, 11 + bob, 2, 32);
    ctx.fillStyle = '#b4c0cc';
    ctx.fillRect(34 + lean, 6 + bob, 4, 7);
    ctx.fillStyle = '#eef4fa';
    ctx.fillRect(35 + lean, 5 + bob, 2, 4);
  }
}

function drawSpiderFrame(ctx: CanvasRenderingContext2D, frame: SpriteAnimFrame): void {
  const lift = frame === 'windup' ? -5 : frame === 'stagger' ? 4 : frame === 'walk' ? -1 : 0;

  // 8 segmented chitin legs
  ctx.fillStyle = '#382a23';
  const legSwing = frame === 'walk' ? 2 : 0;
  for (let side = -1; side <= 1; side += 2) {
    const baseX = side < 0 ? 15 : 31;
    for (let i = 0; i < 4; i++) {
      const kneeX = baseX + side * (7 + i * 2);
      const kneeY = 21 + i * 3 + lift + (i % 2 === 0 ? legSwing : -legSwing);
      const footX = baseX + side * (11 + i * 2);
      const footY = 40 + (i % 2) * 3;
      ctx.strokeStyle = '#3d2c24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(baseX, 28 + lift);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
      ctx.strokeStyle = '#694e3f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(baseX, 27 + lift);
      ctx.lineTo(kneeX, kneeY - 1);
      ctx.stroke();
    }
  }

  // Bulbous abdomen
  ctx.fillStyle = '#2d211b';
  ctx.fillRect(14, 18 + lift, 20, 15);
  ctx.fillStyle = '#4f3a2f';
  ctx.fillRect(16, 19 + lift, 16, 8);
  // Crimson hourglass marking
  ctx.fillStyle = '#a83226';
  ctx.fillRect(22, 21 + lift, 4, 4);

  // Cephalothorax & fangs
  ctx.fillStyle = '#3b2b23';
  ctx.fillRect(17, 27 + lift, 14, 11);
  // Glowing crimson cluster eyes
  ctx.fillStyle = frame === 'windup' ? '#ffdd55' : '#ff3824';
  ctx.fillRect(19, 31 + lift, 2, 2);
  ctx.fillRect(22, 30 + lift, 2, 2);
  ctx.fillRect(25, 30 + lift, 2, 2);
  ctx.fillRect(28, 31 + lift, 2, 2);
  // Venomous fangs
  ctx.fillStyle = '#d9ccb4';
  ctx.fillRect(20, 37 + lift, 2, 4);
  ctx.fillRect(26, 37 + lift, 2, 4);
}

function drawCultistFrame(ctx: CanvasRenderingContext2D, frame: SpriteAnimFrame): void {
  const bob = frame === 'walk' ? -2 : frame === 'stagger' ? 4 : 0;

  // Royal-blue & gold trimmed hooded robe (echoing the mage visual palette in reference!)
  ctx.fillStyle = '#1f3668';
  ctx.fillRect(15, 22 + bob, 18, 22);
  ctx.fillStyle = '#2f5196';
  ctx.fillRect(17, 23 + bob, 14, 18);
  // Gold hem & sash
  ctx.fillStyle = '#d9a443';
  ctx.fillRect(15, 41 + bob, 18, 3);
  ctx.fillRect(22, 24 + bob, 4, 17);
  ctx.fillStyle = '#5c3c20';
  ctx.fillRect(16, 30 + bob, 16, 3);

  // Pointed hood
  ctx.fillStyle = '#25427d';
  ctx.fillRect(16, 8 + bob, 16, 14);
  ctx.fillRect(19, 5 + bob, 10, 4);
  ctx.fillStyle = '#120f1c';
  ctx.fillRect(19, 12 + bob, 10, 8);
  // Glowing cyan/amber eyes beneath hood
  ctx.fillStyle = frame === 'windup' ? '#ffaa33' : '#58d4ff';
  ctx.fillRect(21, 15 + bob, 2, 2);
  ctx.fillRect(26, 15 + bob, 2, 2);

  // Casting hand + glowing arcane orb!
  ctx.fillStyle = '#2f5196';
  ctx.fillRect(8, 23 + bob, 8, 5);
  if (frame === 'windup' || frame === 'attack') {
    ctx.fillStyle = frame === 'windup' ? '#ff8833' : '#42c5ff';
    ctx.fillRect(3, 18 + bob, 10, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, 21 + bob, 4, 4);
  } else {
    ctx.fillStyle = '#42c5ff';
    ctx.fillRect(5, 21 + bob, 6, 6);
    ctx.fillStyle = '#ccf4ff';
    ctx.fillRect(7, 23 + bob, 2, 2);
  }
}

function drawSentinelFrame(ctx: CanvasRenderingContext2D, frame: SpriteAnimFrame): void {
  const bob = frame === 'walk' ? -1 : frame === 'stagger' ? 5 : 0;

  // Armored greaves
  ctx.fillStyle = '#4c525c';
  ctx.fillRect(15, 34 + bob, 6, 12);
  ctx.fillRect(27, 34 + bob, 6, 12);

  // Heavy plate torso + pauldrons
  ctx.fillStyle = '#5c6470';
  ctx.fillRect(13, 17 + bob, 22, 18);
  ctx.fillStyle = '#8590a1';
  ctx.fillRect(15, 18 + bob, 18, 8);
  ctx.fillStyle = '#b88f3d'; // gold trim
  ctx.fillRect(13, 17 + bob, 22, 2);
  ctx.fillRect(22, 19 + bob, 4, 15);

  // Greathelm with visor slit
  ctx.fillStyle = '#687180';
  ctx.fillRect(18, 5 + bob, 12, 12);
  ctx.fillStyle = '#9aa5b8';
  ctx.fillRect(20, 6 + bob, 8, 4);
  ctx.fillStyle = '#151214';
  ctx.fillRect(20, 10 + bob, 8, 2);
  ctx.fillStyle = '#ff6b2b';
  ctx.fillRect(21, 10 + bob, 2, 2);
  ctx.fillRect(25, 10 + bob, 2, 2);

  // Tower Shield on left flank (blocks frontal attacks visually!)
  const shieldX = frame === 'stagger' ? 3 : 6;
  ctx.fillStyle = '#3b3029';
  ctx.fillRect(shieldX, 18 + bob, 11, 22);
  ctx.fillStyle = '#8c7648';
  ctx.fillRect(shieldX, 18 + bob, 11, 2);
  ctx.fillRect(shieldX, 38 + bob, 11, 2);
  ctx.fillRect(shieldX, 18 + bob, 2, 22);
  ctx.fillRect(shieldX + 9, 18 + bob, 2, 22);

  // Heavy Halberd / Greatsword on right
  if (frame === 'windup') {
    ctx.fillStyle = '#ffaa38';
    ctx.fillRect(35, 2 + bob, 8, 22);
    ctx.fillStyle = '#fff5c2';
    ctx.fillRect(37, 4 + bob, 4, 16);
  } else {
    ctx.fillStyle = '#9eaab8';
    ctx.fillRect(36, 9 + bob, 5, 24);
    ctx.fillStyle = '#d9e3ed';
    ctx.fillRect(37, 10 + bob, 2, 20);
  }
}

function drawBossFrame(ctx: CanvasRenderingContext2D, archetype: EnemyArchetype, frame: SpriteAnimFrame): void {
  const bob = frame === 'walk' ? -2 : frame === 'stagger' ? 7 : 0;
  const primary =
    archetype === 'boss_b1'
      ? '#49635c'
      : archetype === 'boss_b2'
        ? '#b88e35'
        : archetype === 'boss_b3'
          ? '#8c2d19'
          : '#49316b';
  const accent =
    archetype === 'boss_b1'
      ? '#75d6c4'
      : archetype === 'boss_b2'
        ? '#ffe078'
        : archetype === 'boss_b3'
          ? '#ff8426'
          : '#c084ff';

  // Towering cloaked silhouette (64x64)
  ctx.fillStyle = '#1b141a';
  ctx.fillRect(14, 24 + bob, 36, 36);
  ctx.fillStyle = primary;
  ctx.fillRect(17, 20 + bob, 30, 32);
  // Broad horned pauldrons
  ctx.fillRect(10, 18 + bob, 12, 12);
  ctx.fillRect(42, 18 + bob, 12, 12);
  ctx.fillStyle = accent;
  ctx.fillRect(12, 19 + bob, 40, 3);
  ctx.fillRect(29, 22 + bob, 6, 28);

  // Crowned horned helm
  ctx.fillStyle = primary;
  ctx.fillRect(23, 8 + bob, 18, 13);
  // Horns / Crown spikes
  ctx.fillStyle = accent;
  ctx.fillRect(18, 3 + bob, 4, 9);
  ctx.fillRect(42, 3 + bob, 4, 9);
  ctx.fillRect(30, 2 + bob, 4, 7);

  // Blazing boss eyes
  ctx.fillStyle = frame === 'windup' ? '#ffffff' : accent;
  ctx.fillRect(26, 13 + bob, 4, 3);
  ctx.fillRect(34, 13 + bob, 4, 3);

  // Colossal Boss Weapon
  if (frame === 'windup') {
    ctx.fillStyle = '#ff9838';
    ctx.fillRect(48, 2 + bob, 10, 34);
    ctx.fillStyle = '#fff4bf';
    ctx.fillRect(51, 4 + bob, 4, 28);
  } else if (frame === 'attack') {
    ctx.fillStyle = accent;
    ctx.fillRect(6, 28 + bob, 48, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 30 + bob, 40, 3);
  } else {
    ctx.fillStyle = '#8b96a6';
    ctx.fillRect(49, 10 + bob, 7, 42);
    ctx.fillStyle = accent;
    ctx.fillRect(51, 14 + bob, 3, 30);
  }
}

export function getEnemySpriteTexture(archetype: EnemyArchetype, frame: SpriteAnimFrame): THREE.Texture {
  const key = `enemy_${archetype}_${frame}`;
  return AssetRegistry.getTexture(key, () => {
    const isBoss = archetype.startsWith('boss_');
    const size = isBoss ? 64 : 48;
    const [c, ctx] = createPixelCtx(size, size);
    if (archetype === 'goblin') drawGoblinFrame(ctx, frame);
    else if (archetype === 'spider') drawSpiderFrame(ctx, frame);
    else if (archetype === 'cultist') drawCultistFrame(ctx, frame);
    else if (archetype === 'sentinel') drawSentinelFrame(ctx, frame);
    else drawBossFrame(ctx, archetype, frame);
    addPixelOutline(c, '#0b0809');
    return toPixelSpriteTexture(c);
  });
}

export function getFlameFrameTexture(frameIndex: number, tint: 'orange' | 'violet' | 'crimson' = 'orange'): THREE.Texture {
  const idx = frameIndex % 4;
  return AssetRegistry.getTexture(`flame_${tint}_${idx}`, () => {
    const [c, ctx] = createPixelCtx(32, 40);
    const outer = tint === 'violet' ? '#6b3cc9' : tint === 'crimson' ? '#b82525' : '#d94d14';
    const mid = tint === 'violet' ? '#a675ff' : tint === 'crimson' ? '#f25738' : '#ff9824';
    const core = tint === 'violet' ? '#efe0ff' : '#fff3a8';

    const sway = [0, 2, -1, 1][idx];
    const tall = [0, 3, 1, -2][idx];

    // Outer tongues
    ctx.fillStyle = outer;
    ctx.fillRect(8, 22, 16, 16);
    ctx.fillRect(10 + sway, 12 - tall, 12, 14);
    ctx.fillRect(13 + sway, 5 - tall, 6, 10);
    ctx.fillRect(7 - sway, 17, 5, 10);
    ctx.fillRect(20 + sway, 16, 5, 11);

    // Mid blaze
    ctx.fillStyle = mid;
    ctx.fillRect(10, 24, 12, 13);
    ctx.fillRect(12 + sway, 14 - tall, 8, 12);
    ctx.fillRect(14 + sway, 9 - tall, 4, 7);

    // Bright white-gold core
    ctx.fillStyle = core;
    ctx.fillRect(13, 27, 6, 9);
    ctx.fillRect(14 + Math.round(sway * 0.5), 21, 4, 7);

    return toPixelSpriteTexture(c);
  });
}

export function getLootSpriteTexture(kind: 'gear' | 'rune' | 'embers' | 'flask_charge' | 'portal_scroll', rarity: Rarity, slot?: string): THREE.Texture {
  const key = `loot_${kind}_${rarity}_${slot ?? 'any'}`;
  return AssetRegistry.getTexture(key, () => {
    const [c, ctx] = createPixelCtx(32, 32);

    if (kind === 'rune') {
      // Glowing faceted emerald/arcane diamond like reference Mystic Rune!
      ctx.fillStyle = rarity === 'L' ? '#e8aa38' : rarity === 'R' ? '#a962f5' : '#2db854';
      ctx.beginPath();
      ctx.moveTo(16, 4);
      ctx.lineTo(25, 16);
      ctx.lineTo(16, 28);
      ctx.lineTo(7, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rarity === 'L' ? '#fff0b3' : rarity === 'R' ? '#e5caff' : '#9effb8';
      ctx.beginPath();
      ctx.moveTo(16, 7);
      ctx.lineTo(20, 15);
      ctx.lineTo(16, 22);
      ctx.lineTo(12, 15);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'embers') {
      // Scattered glowing gold/ember coins
      ctx.fillStyle = '#d99a26';
      ctx.fillRect(6, 20, 8, 5);
      ctx.fillRect(15, 22, 9, 5);
      ctx.fillRect(11, 16, 8, 5);
      ctx.fillStyle = '#ffe57a';
      ctx.fillRect(8, 21, 4, 2);
      ctx.fillRect(17, 23, 5, 2);
      ctx.fillRect(13, 17, 4, 2);
    } else if (kind === 'portal_scroll') {
      ctx.fillStyle = '#c9a66b';
      ctx.fillRect(9, 8, 14, 18);
      ctx.fillStyle = '#8c6638';
      ctx.fillRect(7, 7, 18, 3);
      ctx.fillRect(7, 24, 18, 3);
      ctx.fillStyle = '#48b8ff';
      ctx.fillRect(13, 13, 6, 7);
    } else if (kind === 'flask_charge') {
      ctx.fillStyle = '#8f1d1d';
      ctx.fillRect(11, 13, 10, 13);
      ctx.fillStyle = '#e03c31';
      ctx.fillRect(12, 16, 8, 9);
      ctx.fillStyle = '#c9b392';
      ctx.fillRect(13, 8, 6, 5);
    } else if (slot === 'boots') {
      // Sturdy Iron Boots icon like reference!
      ctx.fillStyle = '#5c616b';
      ctx.fillRect(7, 10, 7, 15);
      ctx.fillRect(5, 21, 9, 5);
      ctx.fillRect(17, 10, 7, 15);
      ctx.fillRect(17, 21, 9, 5);
      ctx.fillStyle = '#9aa3b2';
      ctx.fillRect(8, 11, 4, 8);
      ctx.fillRect(18, 11, 4, 8);
      ctx.fillStyle = '#c29242';
      ctx.fillRect(7, 15, 7, 2);
      ctx.fillRect(17, 15, 7, 2);
    } else if (slot === 'weapon' || slot === 'staff') {
      // Diagonal glowing sword or staff
      const bladeColor = rarity === 'L' ? '#ffaa33' : rarity === 'R' ? '#c084ff' : '#c4cfd9';
      ctx.fillStyle = bladeColor;
      for (let i = 0; i < 16; i++) {
        ctx.fillRect(24 - i, 4 + i, 4, 4);
      }
      ctx.fillStyle = '#d9a443';
      ctx.fillRect(6, 17, 10, 3);
      ctx.fillStyle = '#5e3c20';
      ctx.fillRect(5, 22, 5, 5);
    } else {
      // Armored chestplate / shield relic
      ctx.fillStyle = rarity === 'L' ? '#d99a2e' : rarity === 'R' ? '#7b4bb3' : '#657385';
      ctx.fillRect(8, 8, 16, 18);
      ctx.fillStyle = '#e6dec8';
      ctx.fillRect(13, 11, 6, 10);
    }

    addPixelOutline(c, '#0c090a');
    return toPixelSpriteTexture(c);
  });
}

export function getPropSpriteTexture(kind: 'lost_echo' | 'bones'): THREE.Texture {
  return AssetRegistry.getTexture(`prop_sprite_${kind}`, () => {
    const [c, ctx] = createPixelCtx(32, 32);
    if (kind === 'lost_echo') {
      ctx.fillStyle = '#47a8ff';
      ctx.beginPath();
      ctx.arc(16, 14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d4f2ff';
      ctx.beginPath();
      ctx.arc(16, 13, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b6cb0';
      ctx.fillRect(13, 21, 6, 8);
    } else {
      // Skull & crossed bones on floor
      ctx.fillStyle = '#d9cfb8';
      ctx.fillRect(10, 14, 10, 9);
      ctx.fillRect(12, 23, 6, 3);
      ctx.fillStyle = '#1f1a17';
      ctx.fillRect(12, 17, 2, 2);
      ctx.fillRect(16, 17, 2, 2);
      ctx.fillStyle = '#bfb39b';
      ctx.fillRect(4, 24, 22, 3);
    }
    addPixelOutline(c, '#0b0809');
    return toPixelSpriteTexture(c);
  });
}
