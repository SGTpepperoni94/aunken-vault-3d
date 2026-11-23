import React, { useEffect, useRef } from 'react';
import type { DungeonMap } from '../game/types';

interface MinimapCanvasProps {
  map: DungeonMap;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  enemies: Array<{ x: number; z: number; isBoss: boolean }>;
  loot: Array<{ x: number; z: number; isLegendary: boolean }>;
  locationLabel: string;
}

export const MinimapCanvas: React.FC<MinimapCanvasProps> = ({
  map,
  playerX,
  playerZ,
  playerYaw,
  enemies,
  loot,
  locationLabel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 112;
    const half = size / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    // Circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 3, 0, Math.PI * 2);
    ctx.clip();

    // Dark obsidian slate background
    ctx.fillStyle = '#120f11';
    ctx.fillRect(0, 0, size, size);

    const pxTile = playerX / map.tileSize;
    const pzTile = playerZ / map.tileSize;
    const cellPx = 4;

    // Draw navigable tiles relative to player position
    for (let gz = 0; gz < map.height; gz++) {
      for (let gx = 0; gx < map.width; gx++) {
        const t = map.tiles[gz * map.width + gx];
        if (t === 0) continue;
        const sx = Math.round(half + (gx + 0.5 - pxTile) * cellPx);
        const sy = Math.round(half + (gz + 0.5 - pzTile) * cellPx);
        if (sx < -cellPx || sy < -cellPx || sx > size + cellPx || sy > size + cellPx) continue;

        if (t === 2) ctx.fillStyle = '#73382e';
        else if (t === 3) ctx.fillStyle = '#a698bf';
        else if (t === 4) ctx.fillStyle = '#5c4d3e';
        else if (t === 5) ctx.fillStyle = '#5c5563';
        else ctx.fillStyle = '#4e483d';

        ctx.fillRect(sx - 2, sy - 2, cellPx, cellPx);
      }
    }

    // Interactables (Shrine cyan, Chest/Forge gold, Cavern/Stairs violet)
    for (const inter of map.interactables) {
      if (inter.used && inter.kind === 'chest') continue;
      const sx = Math.round(half + (inter.x / map.tileSize - pxTile) * cellPx);
      const sy = Math.round(half + (inter.z / map.tileSize - pzTile) * cellPx);
      if (inter.kind === 'kindled_shrine') ctx.fillStyle = '#4ce0ff';
      else if (inter.kind === 'chest' || inter.kind === 'ember_forge' || inter.kind === 'bound_stash') ctx.fillStyle = '#f2be49';
      else if (inter.kind === 'cavern_entrance' || inter.kind === 'stairs_down') ctx.fillStyle = '#b478ff';
      else if (inter.kind === 'lost_echo') ctx.fillStyle = '#6ecbff';
      else continue;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }

    // Loot pips (emerald / legendary gold)
    for (const l of loot) {
      const sx = Math.round(half + (l.x / map.tileSize - pxTile) * cellPx);
      const sy = Math.round(half + (l.z / map.tileSize - pzTile) * cellPx);
      ctx.fillStyle = l.isLegendary ? '#ffe066' : '#52d977';
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
    }

    // Enemy pips (crimson)
    for (const e of enemies) {
      const sx = Math.round(half + (e.x / map.tileSize - pxTile) * cellPx);
      const sy = Math.round(half + (e.z / map.tileSize - pzTile) * cellPx);
      ctx.fillStyle = e.isBoss ? '#ff3b3b' : '#d93829';
      const r = e.isBoss ? 3 : 2;
      ctx.fillRect(sx - Math.floor(r / 2), sy - Math.floor(r / 2), r + 1, r + 1);
    }

    // Player directional chevron at center
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(-playerYaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // Beveled circular bronze compass ring + cardinal pips
    ctx.strokeStyle = '#9e7a3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#291d12';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(half, half, half - 4, 0, Math.PI * 2);
    ctx.stroke();

    // North diamond marker
    ctx.fillStyle = '#eab84b';
    ctx.beginPath();
    ctx.moveTo(half, 0);
    ctx.lineTo(half + 4, 5);
    ctx.lineTo(half, 9);
    ctx.lineTo(half - 4, 5);
    ctx.closePath();
    ctx.fill();
  }, [map, playerX, playerZ, playerYaw, enemies, loot]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[74px] h-[74px] sm:w-[112px] sm:h-[112px] rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.88)]">
        <canvas
          ref={canvasRef}
          width={112}
          height={112}
          className="w-full h-full pixelated rounded-full"
          aria-label="Dungeon Minimap"
        />
      </div>
      <div className="rpg-frame-dark mt-1 sm:mt-1.5 px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-[11px] font-display tracking-wide text-[#f0e2c2] whitespace-nowrap">
        {locationLabel}
      </div>
    </div>
  );
};
