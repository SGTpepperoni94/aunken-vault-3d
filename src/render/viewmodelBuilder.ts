import * as THREE from 'three';
import { AssetRegistry } from './assetRegistry';
import { mulberry32 } from '../systems/LootAndForge';

function makePixelTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function getBladeTexture(flame: boolean): THREE.Texture {
  return AssetRegistry.getTexture(`vm_blade_${flame ? 'flame' : 'steel'}`, () =>
    makePixelTex(32, 64, (ctx) => {
      const rng = mulberry32(flame ? 777 : 333);
      // Chunky hammered retro steel mottling matching reference broadsword!
      for (let y = 0; y < 64; y += 2) {
        for (let x = 0; x < 32; x += 2) {
          const edge = Math.abs(x - 16) / 16;
          const base = flame ? 195 : 178;
          const v = base + (1 - edge) * 52 + (rng() - 0.5) * 44;
          if (flame && edge > 0.58) {
            ctx.fillStyle = `rgb(255, ${Math.round(130 + rng() * 90)}, 36)`;
          } else {
            const c = Math.max(70, Math.min(245, Math.round(v)));
            ctx.fillStyle = `rgb(${c}, ${c + 2}, ${Math.min(255, c + 8)})`;
          }
          ctx.fillRect(x, y, 2, 2);
        }
      }
      // Center fuller ridge
      ctx.fillStyle = '#5c636e';
      ctx.fillRect(15, 8, 2, 50);
    })
  );
}

function getLeatherTexture(): THREE.Texture {
  return AssetRegistry.getTexture('vm_leather', () =>
    makePixelTex(32, 32, (ctx) => {
      const rng = mulberry32(419);
      ctx.fillStyle = '#54321e';
      ctx.fillRect(0, 0, 32, 32);
      for (let y = 0; y < 32; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? '#6e4329' : '#402415';
        ctx.fillRect(0, y, 32, 3);
        ctx.fillStyle = '#24140b';
        ctx.fillRect(0, y + 3, 32, 1);
      }
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = rng() > 0.5 ? '#855638' : '#2e1a0e';
        ctx.fillRect(Math.floor(rng() * 32), Math.floor(rng() * 32), 2, 1);
      }
    })
  );
}

function getSkinHandTexture(): THREE.Texture {
  return AssetRegistry.getTexture('vm_hand', () =>
    makePixelTex(32, 32, (ctx) => {
      const rng = mulberry32(912);
      ctx.fillStyle = '#bd8962';
      ctx.fillRect(0, 0, 32, 32);
      for (let y = 0; y < 32; y += 2) {
        for (let x = 0; x < 32; x += 2) {
          const d = (rng() - 0.5) * 26;
          ctx.fillStyle = `rgb(${Math.round(190 + d)}, ${Math.round(134 + d * 0.8)}, ${Math.round(96 + d * 0.6)})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
      // Knuckle creases
      ctx.fillStyle = '#754b31';
      ctx.fillRect(0, 12, 32, 2);
      ctx.fillRect(0, 22, 32, 2);
    })
  );
}

function getShieldTexture(): THREE.Texture {
  return AssetRegistry.getTexture('vm_shield', () =>
    makePixelTex(64, 64, (ctx) => {
      const rng = mulberry32(505);
      // Dark oak planks
      for (let x = 0; x < 64; x += 8) {
        const s = 0.85 + rng() * 0.3;
        ctx.fillStyle = `rgb(${Math.round(92 * s)}, ${Math.round(58 * s)}, ${Math.round(35 * s)})`;
        ctx.fillRect(x, 0, 7, 64);
        ctx.fillStyle = '#24150c';
        ctx.fillRect(x + 7, 0, 1, 64);
      }
      // Heavy iron rim with rivets (matching reference shield!)
      ctx.fillStyle = '#606875';
      ctx.fillRect(0, 0, 64, 7);
      ctx.fillRect(0, 57, 64, 7);
      ctx.fillRect(0, 0, 7, 64);
      ctx.fillRect(57, 0, 7, 64);
      ctx.fillStyle = '#9aa6b8';
      ctx.fillRect(1, 1, 62, 2);
      for (let i = 6; i < 60; i += 10) {
        ctx.fillStyle = '#ced8e6';
        ctx.fillRect(i, 2, 3, 3);
        ctx.fillRect(2, i, 3, 3);
        ctx.fillRect(59, i, 3, 3);
      }
      // Center steel boss
      ctx.fillStyle = '#737d8c';
      ctx.fillRect(24, 24, 16, 16);
      ctx.fillStyle = '#b4c0cf';
      ctx.fillRect(27, 27, 10, 10);
    })
  );
}

function getStaffWoodTexture(): THREE.Texture {
  return AssetRegistry.getTexture('vm_staff_wood', () =>
    makePixelTex(32, 64, (ctx) => {
      const rng = mulberry32(616);
      ctx.fillStyle = '#472d1b';
      ctx.fillRect(0, 0, 32, 64);
      for (let y = 0; y < 64; y += 2) {
        for (let x = 0; x < 32; x += 2) {
          const s = 0.78 + rng() * 0.42;
          ctx.fillStyle = `rgb(${Math.round(78 * s)}, ${Math.round(50 * s)}, ${Math.round(30 * s)})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
      // Gold rune bands
      ctx.fillStyle = '#d9a443';
      ctx.fillRect(0, 14, 32, 4);
      ctx.fillRect(0, 38, 32, 4);
    })
  );
}

export interface ViewmodelRig {
  root: THREE.Group;
  vanguardRight: THREE.Group;
  vanguardLeft: THREE.Group;
  arcanistRight: THREE.Group;
  arcanistLeft: THREE.Group;
  bladeMesh: THREE.Mesh;
  staffCrystal: THREE.Mesh;
  arcaneSigil: THREE.Mesh;
  setFlameBlade: (flame: boolean) => void;
}

export function buildViewmodelRig(): ViewmodelRig {
  const root = new THREE.Group();

  const leatherMat = new THREE.MeshStandardMaterial({ map: getLeatherTexture(), roughness: 0.88, metalness: 0.04 });
  const skinMat = new THREE.MeshStandardMaterial({ map: getSkinHandTexture(), roughness: 0.82, metalness: 0.02 });
  const steelMat = new THREE.MeshStandardMaterial({ map: getBladeTexture(false), roughness: 0.54, metalness: 0.08 });
  const guardMat = new THREE.MeshStandardMaterial({ map: getBladeTexture(false), color: 0xbab1a4, roughness: 0.58, metalness: 0.1 });
  const shieldMat = new THREE.MeshStandardMaterial({ map: getShieldTexture(), roughness: 0.78, metalness: 0.14 });
  const staffWoodMat = new THREE.MeshStandardMaterial({ map: getStaffWoodTexture(), roughness: 0.8, metalness: 0.08 });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x52c8ff,
    emissive: 0x2699ff,
    emissiveIntensity: 1.35,
    roughness: 0.22,
    metalness: 0.15,
  });

  // =========================================================================
  // 1. VANGUARD RIGHT HAND (Broadsword + Gauntleted Forearm — reference framing!)
  // =========================================================================
  const vanguardRight = new THREE.Group();
  vanguardRight.position.set(0.39, -0.34, -0.94);
  vanguardRight.rotation.set(0.18, -0.14, 0.22);

  // Leather-wrapped forearm extending cleanly into bottom-right corner
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.42, 0.13), leatherMat);
  forearm.position.set(0.1, -0.24, 0.12);
  forearm.rotation.set(-0.36, 0.0, 0.42);
  vanguardRight.add(forearm);

  // Gripping fist (hand + thumb + fingers) clearly visible around hilt
  const fist = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.135, 0.135), skinMat);
  fist.position.set(0, -0.02, 0);
  vanguardRight.add(fist);

  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.06), skinMat);
  thumb.position.set(-0.06, 0.03, 0.04);
  thumb.rotation.z = 0.4;
  vanguardRight.add(thumb);

  // Wrapped hilt & pommel
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.22, 6), leatherMat);
  hilt.position.set(0, -0.02, -0.01);
  vanguardRight.add(hilt);

  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), guardMat);
  pommel.position.set(0, -0.14, -0.01);
  vanguardRight.add(pommel);

  // Faceted broadsword crossguard
  const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.065), guardMat);
  crossguard.position.set(0, 0.1, -0.01);
  vanguardRight.add(crossguard);

  // Tapered beveled broadsword blade sized so full blade tip stays below minimap!
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.048, 0);
  bladeShape.lineTo(0.048, 0);
  bladeShape.lineTo(0.032, 0.56);
  bladeShape.lineTo(0, 0.69);
  bladeShape.lineTo(-0.032, 0.56);
  bladeShape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
  });
  bladeGeo.center();
  const bladeMesh = new THREE.Mesh(bladeGeo, steelMat);
  bladeMesh.position.set(0, 0.46, -0.01);
  vanguardRight.add(bladeMesh);

  root.add(vanguardRight);

  // =========================================================================
  // 2. VANGUARD LEFT HAND (Riveted Oak & Iron Heater Shield — lower-left like reference!)
  // =========================================================================
  const vanguardLeft = new THREE.Group();
  vanguardLeft.position.set(-0.48, -0.45, -0.88);
  vanguardLeft.rotation.set(0.2, 0.46, -0.16);

  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.3, 0.24);
  shieldShape.lineTo(0, 0.34);
  shieldShape.lineTo(0.3, 0.24);
  shieldShape.lineTo(0.25, -0.2);
  shieldShape.lineTo(0, -0.38);
  shieldShape.lineTo(-0.25, -0.2);
  shieldShape.closePath();

  const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 1,
  });
  shieldGeo.center();
  // Normalize shield UVs to 0..1 so pixel wood/iron border aligns cleanly
  const posAttr = shieldGeo.attributes.position;
  const uvArr = new Float32Array(posAttr.count * 2);
  for (let i = 0; i < posAttr.count; i++) {
    uvArr[i * 2] = (posAttr.getX(i) + 0.32) / 0.64;
    uvArr[i * 2 + 1] = (posAttr.getY(i) + 0.4) / 0.78;
  }
  shieldGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));

  const shieldBody = new THREE.Mesh(shieldGeo, shieldMat);
  vanguardLeft.add(shieldBody);

  // Iron central boss stud
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.05, 6), guardMat);
  boss.rotation.x = Math.PI / 2;
  boss.position.set(0, 0.04, 0.038);
  vanguardLeft.add(boss);

  root.add(vanguardLeft);

  // =========================================================================
  // 3. ARCANIST RIGHT HAND (Gnarled Arcane Crystal Staff)
  // =========================================================================
  const arcanistRight = new THREE.Group();
  arcanistRight.position.set(0.4, -0.38, -0.92);
  arcanistRight.rotation.set(0.14, -0.14, 0.14);
  arcanistRight.visible = false;

  const staffForearm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), leatherMat);
  staffForearm.position.set(0.08, -0.24, 0.12);
  staffForearm.rotation.set(-0.38, 0, 0.36);
  arcanistRight.add(staffForearm);

  const staffHand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.12), skinMat);
  arcanistRight.add(staffHand);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.84, 7), staffWoodMat);
  shaft.position.set(0, 0.2, -0.02);
  arcanistRight.add(shaft);

  // Iron cradle prongs around crystal
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.18, 0.022), guardMat);
    prong.position.set(Math.cos(ang) * 0.068, 0.65, -0.02 + Math.sin(ang) * 0.068);
    prong.rotation.z = -Math.cos(ang) * 0.26;
    prong.rotation.x = Math.sin(ang) * 0.26;
    arcanistRight.add(prong);
  }

  const staffCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.082, 0), crystalMat);
  staffCrystal.position.set(0, 0.7, -0.02);
  arcanistRight.add(staffCrystal);

  root.add(arcanistRight);

  // =========================================================================
  // 4. ARCANIST LEFT HAND (Spellcasting Hand + Hovering Arcane Sigil)
  // =========================================================================
  const arcanistLeft = new THREE.Group();
  arcanistLeft.position.set(-0.48, -0.42, -0.74);
  arcanistLeft.rotation.set(0.28, 0.3, -0.15);
  arcanistLeft.visible = false;

  const mageSleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.38, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x264480, roughness: 0.82 })
  );
  mageSleeve.position.set(-0.08, -0.22, 0.14);
  mageSleeve.rotation.set(-0.35, 0, -0.28);
  arcanistLeft.add(mageSleeve);

  const castHand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.06), skinMat);
  castHand.position.set(0, 0.02, 0);
  arcanistLeft.add(castHand);

  const arcaneSigil = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.13, 6),
    new THREE.MeshBasicMaterial({ color: 0x58d4ff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  arcaneSigil.position.set(0.06, 0.14, -0.08);
  arcanistLeft.add(arcaneSigil);

  root.add(arcanistLeft);

  const setFlameBlade = (flame: boolean) => {
    steelMat.map = getBladeTexture(flame);
    steelMat.emissive.setHex(flame ? 0x6b2806 : 0x000000);
    steelMat.emissiveIntensity = flame ? 0.55 : 0;
    steelMat.needsUpdate = true;
  };

  return {
    root,
    vanguardRight,
    vanguardLeft,
    arcanistRight,
    arcanistLeft,
    bladeMesh,
    staffCrystal,
    arcaneSigil,
    setFlameBlade,
  };
}
