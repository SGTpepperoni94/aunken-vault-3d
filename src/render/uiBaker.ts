import { AssetRegistry } from './assetRegistry';

function bakeIconDataUrl(key: string, size: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  return AssetRegistry.getDataUrl(key, () => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    return c.toDataURL('image/png');
  });
}

export interface UiPixelAtlas {
  warriorPortrait: string;
  magePortrait: string;
  swordIcon: string;
  shieldIcon: string;
  fireballIcon: string;
  cleaveIcon: string;
  flaskIcon: string;
  runeIcon: string;
  arcaneIcon: string;
  scrollIcon: string;
  staffIcon: string;
}

export function getUiPixelAtlas(): UiPixelAtlas {
  const warriorPortrait = bakeIconDataUrl('ui_portrait_warrior', 48, (ctx) => {
    // Moody dungeon stone backdrop
    ctx.fillStyle = '#241c18';
    ctx.fillRect(0, 0, 48, 48);
    ctx.fillStyle = '#332822';
    ctx.fillRect(0, 0, 48, 22);

    // Armored steel pauldrons & cloak
    ctx.fillStyle = '#474f5c';
    ctx.fillRect(4, 34, 40, 14);
    ctx.fillStyle = '#737f91';
    ctx.fillRect(6, 35, 12, 8);
    ctx.fillRect(30, 35, 12, 8);
    ctx.fillStyle = '#b88f3d'; // gold shoulder trim
    ctx.fillRect(6, 34, 12, 2);
    ctx.fillRect(30, 34, 12, 2);
    // Steel sword hilt peeking right shoulder
    ctx.fillStyle = '#c4cfd9';
    ctx.fillRect(38, 20, 4, 18);
    ctx.fillStyle = '#d9a443';
    ctx.fillRect(35, 34, 10, 3);

    // Neck & weathered face
    ctx.fillStyle = '#a8744f';
    ctx.fillRect(19, 30, 10, 8);
    ctx.fillStyle = '#d49d72';
    ctx.fillRect(15, 12, 18, 20);
    ctx.fillStyle = '#e8b58b';
    ctx.fillRect(17, 13, 12, 10);

    // Rugged brown hair & beard (matching reference Warrior portrait!)
    ctx.fillStyle = '#633c1e';
    ctx.fillRect(13, 7, 22, 8);
    ctx.fillRect(12, 12, 4, 12);
    ctx.fillRect(31, 11, 4, 10);
    ctx.fillStyle = '#87552d';
    ctx.fillRect(16, 8, 14, 4);
    // Beard & mustache
    ctx.fillStyle = '#5c361a';
    ctx.fillRect(15, 25, 18, 9);
    ctx.fillRect(17, 32, 14, 4);
    ctx.fillStyle = '#7a4a26';
    ctx.fillRect(18, 26, 12, 4);
    // Mouth line
    ctx.fillStyle = '#381e12';
    ctx.fillRect(21, 28, 6, 2);

    // Determined eyes & brows
    ctx.fillStyle = '#472814';
    ctx.fillRect(17, 17, 6, 2);
    ctx.fillRect(25, 17, 6, 2);
    ctx.fillStyle = '#f2ede4';
    ctx.fillRect(18, 19, 4, 2);
    ctx.fillRect(26, 19, 4, 2);
    ctx.fillStyle = '#241a14';
    ctx.fillRect(20, 19, 2, 2);
    ctx.fillRect(28, 19, 2, 2);
  });

  const magePortrait = bakeIconDataUrl('ui_portrait_mage', 32, (ctx) => {
    ctx.fillStyle = '#14192b';
    ctx.fillRect(0, 0, 32, 32);
    // Blue hood & gold trim
    ctx.fillStyle = '#24407a';
    ctx.fillRect(6, 4, 20, 28);
    ctx.fillStyle = '#365eab';
    ctx.fillRect(8, 6, 16, 6);
    ctx.fillStyle = '#d9a443';
    ctx.fillRect(8, 24, 16, 2);
    // Face inside hood
    ctx.fillStyle = '#deb08a';
    ctx.fillRect(10, 11, 12, 11);
    ctx.fillStyle = '#54351e';
    ctx.fillRect(10, 11, 12, 3);
    ctx.fillStyle = '#1b2436';
    ctx.fillRect(12, 15, 2, 2);
    ctx.fillRect(18, 15, 2, 2);
  });

  const swordIcon = bakeIconDataUrl('ui_icon_sword', 32, (ctx) => {
    ctx.fillStyle = '#261a12';
    ctx.fillRect(0, 0, 32, 32);
    // Diagonal steel blade
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = '#9aa6b8';
      ctx.fillRect(24 - i, 4 + i, 4, 4);
      ctx.fillStyle = '#e8f0f8';
      ctx.fillRect(25 - i, 4 + i, 2, 2);
    }
    ctx.fillStyle = '#d9a443';
    ctx.fillRect(6, 18, 10, 3);
    ctx.fillRect(11, 14, 3, 10);
    ctx.fillStyle = '#6b3e1f';
    ctx.fillRect(5, 23, 5, 5);
  });

  const shieldIcon = bakeIconDataUrl('ui_icon_shield', 32, (ctx) => {
    ctx.fillStyle = '#161b26';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#8b99ad';
    ctx.fillRect(6, 5, 20, 14);
    ctx.fillRect(8, 19, 16, 5);
    ctx.fillRect(11, 24, 10, 4);
    ctx.fillStyle = '#32538f';
    ctx.fillRect(9, 8, 14, 12);
    ctx.fillRect(11, 20, 10, 4);
    ctx.fillStyle = '#e0ebfa';
    ctx.fillRect(15, 8, 2, 15);
  });

  const fireballIcon = bakeIconDataUrl('ui_icon_fireball', 32, (ctx) => {
    ctx.fillStyle = '#1f0e0a';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#b8320e';
    ctx.fillRect(5, 6, 18, 18);
    ctx.fillStyle = '#f2741b';
    ctx.fillRect(9, 10, 16, 16);
    ctx.fillStyle = '#ffcb3d';
    ctx.fillRect(13, 14, 11, 11);
    ctx.fillStyle = '#fff9cc';
    ctx.fillRect(16, 17, 6, 6);
  });

  const cleaveIcon = bakeIconDataUrl('ui_icon_cleave', 32, (ctx) => {
    ctx.fillStyle = '#1f0d0c';
    ctx.fillRect(0, 0, 32, 32);
    // Fiery sweeping arc
    ctx.strokeStyle = '#ff6b1a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(16, 18, 11, Math.PI * 1.15, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = '#ffe57a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 18, 11, Math.PI * 1.2, Math.PI * 1.9);
    ctx.stroke();
  });

  const flaskIcon = bakeIconDataUrl('ui_icon_flask', 32, (ctx) => {
    ctx.fillStyle = '#1a1216';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#b59d78';
    ctx.fillRect(13, 4, 6, 4);
    ctx.fillStyle = '#9aa8ba';
    ctx.fillRect(12, 8, 8, 5);
    ctx.fillStyle = '#5c1724';
    ctx.fillRect(8, 13, 16, 14);
    ctx.fillStyle = '#d92638';
    ctx.fillRect(10, 16, 12, 9);
    ctx.fillStyle = '#ff8a95';
    ctx.fillRect(11, 17, 3, 5);
  });

  const runeIcon = bakeIconDataUrl('ui_icon_rune', 32, (ctx) => {
    ctx.fillStyle = '#0e1c14';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#2ab352';
    ctx.beginPath();
    ctx.moveTo(16, 4);
    ctx.lineTo(25, 16);
    ctx.lineTo(16, 28);
    ctx.lineTo(7, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9effb8';
    ctx.beginPath();
    ctx.moveTo(16, 8);
    ctx.lineTo(20, 16);
    ctx.lineTo(16, 23);
    ctx.lineTo(12, 16);
    ctx.closePath();
    ctx.fill();
  });

  const arcaneIcon = bakeIconDataUrl('ui_icon_arcane', 32, (ctx) => {
    ctx.fillStyle = '#0e1629';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#2d8ef0';
    ctx.beginPath();
    ctx.arc(16, 16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8ce0ff';
    ctx.beginPath();
    ctx.arc(16, 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, 14, 4, 4);
  });

  const scrollIcon = bakeIconDataUrl('ui_icon_scroll', 32, (ctx) => {
    ctx.fillStyle = '#1c1510';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#8c6438';
    ctx.fillRect(6, 6, 20, 4);
    ctx.fillRect(6, 22, 20, 4);
    ctx.fillStyle = '#d4b27c';
    ctx.fillRect(8, 10, 16, 12);
    ctx.fillStyle = '#47b8ff';
    ctx.fillRect(13, 12, 6, 8);
  });

  const staffIcon = bakeIconDataUrl('ui_icon_staff', 32, (ctx) => {
    ctx.fillStyle = '#131626';
    ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = '#754c29';
      ctx.fillRect(6 + i, 24 - i, 3, 3);
    }
    ctx.fillStyle = '#4cc4ff';
    ctx.fillRect(20, 4, 8, 8);
    ctx.fillStyle = '#e0f8ff';
    ctx.fillRect(22, 6, 4, 4);
  });

  return {
    warriorPortrait,
    magePortrait,
    swordIcon,
    shieldIcon,
    fireballIcon,
    cleaveIcon,
    flaskIcon,
    runeIcon,
    arcaneIcon,
    scrollIcon,
    staffIcon,
  };
}
