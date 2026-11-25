import * as THREE from 'three';
import { CAMPUS_ORIGIN, latLonToLocal } from '../data/campusData';

export class TextureRegistry {
  private textures: THREE.Texture[] = [];

  track<T extends THREE.Texture>(tex: T): T {
    this.textures.push(tex);
    return tex;
  }

  disposeAll(): void {
    for (const tex of this.textures) {
      tex.dispose();
    }
    this.textures = [];
  }
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  registry: TextureRegistry,
  maxAnisotropy: number,
  options?: {
    isColor?: boolean;
    repeatX?: number;
    repeatY?: number;
  }
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace =
    options?.isColor === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAnisotropy);
  if (options?.repeatX || options?.repeatY) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(options.repeatX ?? 1, options.repeatY ?? 1);
  }
  tex.needsUpdate = true;
  return registry.track(tex);
}

export interface FacadeTexturePair {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export function createFacadeTextures(
  registry: TextureRegistry,
  maxAnisotropy: number,
  opts: {
    wallHex: string;
    corniceHex?: string;
    plinthHex?: string;
    windowHex?: string;
    stories: number;
    bays: number;
    pilasters?: boolean;
    seed?: number;
  }
): FacadeTexturePair {
  const width = 512;
  const height = 512;

  const albedo = document.createElement('canvas');
  albedo.width = width;
  albedo.height = height;
  const ctx = albedo.getContext('2d')!;

  const emissive = document.createElement('canvas');
  emissive.width = width;
  emissive.height = height;
  const eCtx = emissive.getContext('2d')!;

  // Base stucco wall
  ctx.fillStyle = opts.wallHex;
  ctx.fillRect(0, 0, width, height);

  // Subtle architectural stucco grain
  let s = opts.seed ?? 17;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.035)';
    ctx.fillRect(rand() * width, rand() * height, 2, 2);
  }

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, width, height);

  const plinthH = opts.plinthHex ? height * 0.08 : 0;
  if (opts.plinthHex) {
    ctx.fillStyle = opts.plinthHex;
    ctx.fillRect(0, height - plinthH, width, plinthH);
  }

  const usableH = height - plinthH;
  const floorH = usableH / opts.stories;
  const bayW = width / opts.bays;
  const corniceColor = opts.corniceHex ?? '#f8fafc';
  const windowColor = opts.windowHex ?? '#3c6e9c';

  for (let f = 0; f < opts.stories; f++) {
    const floorTop = f * floorH;

    // White inter-floor cornice band
    ctx.fillStyle = corniceColor;
    ctx.fillRect(0, floorTop, width, Math.max(4, floorH * 0.11));

    for (let b = 0; b < opts.bays; b++) {
      const bx = b * bayW;

      // Optional vertical white pilaster between bays
      if (opts.pilasters && b > 0 && b % 2 === 0) {
        ctx.fillStyle = corniceColor;
        ctx.fillRect(bx - 3, 0, 6, usableH);
      }

      const wx = bx + bayW * 0.19;
      const wy = floorTop + floorH * 0.22;
      const ww = bayW * 0.62;
      const wh = floorH * 0.62;

      // Deep architectural recess shadow around window reveal
      ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
      ctx.fillRect(wx - 4, wy - 4, ww + 6, wh + 6);

      // White outer window casing & lower stone sill
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(wx - 4, wy + wh + 2, ww + 8, Math.max(3, floorH * 0.06));

      // Dark-blue reflective glazing with sky reflection gradient
      const grad = ctx.createLinearGradient(wx, wy, wx + ww * 0.35, wy + wh);
      grad.addColorStop(0, windowColor);
      grad.addColorStop(0.55, '#1b3b66');
      grad.addColorStop(1, '#0f2544');
      ctx.fillStyle = grad;
      ctx.fillRect(wx, wy, ww, wh);

      // Diagonal glass sky-glint sheen
      ctx.fillStyle = 'rgba(186, 230, 253, 0.18)';
      ctx.beginPath();
      ctx.moveTo(wx + 2, wy + 2);
      ctx.lineTo(wx + ww * 0.52, wy + 2);
      ctx.lineTo(wx + ww * 0.2, wy + wh - 2);
      ctx.lineTo(wx + 2, wy + wh - 2);
      ctx.closePath();
      ctx.fill();

      // Mullion crossbars
      ctx.fillStyle = 'rgba(248, 250, 252, 0.84)';
      ctx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
      ctx.fillRect(wx, wy + wh * 0.4, ww, 1.8);

      // Nighttime interior room illumination (~68% occupancy)
      const litRoll = rand();
      if (litRoll > 0.3) {
        const warmth =
          litRoll > 0.78
            ? '#ffe7a3'
            : litRoll > 0.52
              ? '#ffd27d'
              : '#9fd3ff';
        eCtx.fillStyle = warmth;
        eCtx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
      }
    }
  }

  return {
    map: finalizeTexture(albedo, registry, maxAnisotropy, { isColor: true }),
    emissiveMap: finalizeTexture(emissive, registry, maxAnisotropy, {
      isColor: true,
    }),
  };
}

export function createRectorateSignTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8f5ec';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Architectural trim lines
  ctx.fillStyle = '#c99b3b';
  ctx.fillRect(0, 0, canvas.width, 10);
  ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

  ctx.fillStyle = '#b91c1c';
  ctx.font = '700 54px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    'ДОНИШГОҲИ ДАВЛАТИИ ҲУҚУҚ, БИЗНЕС ВА СИЁСАТИ ТОҶИКИСТОН',
    canvas.width / 2,
    canvas.height / 2 + 2
  );

  return finalizeTexture(canvas, registry, maxAnisotropy, { isColor: true });
}

export function createBlueBannerTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1d4ed8');
  grad.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Gold border
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, 480, 480);

  // Stylized emblem circle
  ctx.beginPath();
  ctx.arc(256, 178, 72, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fde68a';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 44px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ДДҲБСТ', 256, 192);

  ctx.font = '600 26px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText('ХУҶАНД · 1993', 256, 315);
  ctx.font = '500 22px "DM Sans", Arial, sans-serif';
  ctx.fillStyle = '#fde68a';
  ctx.fillText('ИЛМ · МАЪРИФАТ · ПЕШРАФТ', 256, 368);

  return finalizeTexture(canvas, registry, maxAnisotropy, { isColor: true });
}

export function createTajikistanFlagTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Red (2/7), White (3/7), Green (2/7)
  const redH = (2 / 7) * 256;
  const whiteH = (3 / 7) * 256;

  ctx.fillStyle = '#cc0000';
  ctx.fillRect(0, 0, 512, redH);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, redH, 512, whiteH);

  ctx.fillStyle = '#006600';
  ctx.fillRect(0, redH + whiteH, 512, redH + 2);

  // Golden crown & 7 stars
  ctx.fillStyle = '#f8c300';
  ctx.beginPath();
  ctx.arc(256, 146, 20, Math.PI, 0, false);
  ctx.lineTo(276, 154);
  ctx.lineTo(236, 154);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 7; i++) {
    const angle = Math.PI + ((i + 0.5) / 7) * Math.PI;
    const sx = 256 + Math.cos(angle) * 34;
    const sy = 142 + Math.sin(angle) * 26;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(canvas, registry, maxAnisotropy, { isColor: true });
}

export function createGateOrnamentTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#d9822b';
  ctx.fillRect(0, 0, 1024, 256);

  // White Tajik geometric frieze pattern
  ctx.strokeStyle = 'rgba(255, 250, 240, 0.85)';
  ctx.lineWidth = 4;
  for (let x = 32; x < 1024; x += 64) {
    ctx.strokeRect(x - 18, 32, 36, 36);
    ctx.save();
    ctx.translate(x, 50);
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-14, -14, 28, 28);
    ctx.restore();
  }

  // Top & bottom trim bands
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(0, 0, 1024, 14);
  ctx.fillRect(0, 242, 1024, 14);

  // Central golden crest medallion
  ctx.beginPath();
  ctx.arc(512, 148, 42, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fef3c7';
  ctx.stroke();

  ctx.fillStyle = '#7c2d12';
  ctx.font = '700 22px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ДДҲБСТ', 512, 149);

  return finalizeTexture(canvas, registry, maxAnisotropy, { isColor: true });
}

export function createStadiumPitchTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d')!;

  // Mowed grass stripes
  const stripeCount = 14;
  const stripeH = canvas.height / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2f7d44' : '#378c4e';
    ctx.fillRect(0, i * stripeH, canvas.width, stripeH + 1);
  }

  // Crisp white regulation pitch lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 10;

  const pad = 64;
  const pw = canvas.width - pad * 2;
  const ph = canvas.height - pad * 2;

  ctx.strokeRect(pad, pad, pw, ph);

  // Halfway line & center circle
  ctx.beginPath();
  ctx.moveTo(pad, canvas.height / 2);
  ctx.lineTo(canvas.width - pad, canvas.height / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 130, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // North & South penalty boxes
  const boxW = pw * 0.56;
  const boxH = 210;
  const goalBoxW = pw * 0.28;
  const goalBoxH = 85;

  ctx.strokeRect((canvas.width - boxW) / 2, pad, boxW, boxH);
  ctx.strokeRect((canvas.width - goalBoxW) / 2, pad, goalBoxW, goalBoxH);

  ctx.strokeRect((canvas.width - boxW) / 2, canvas.height - pad - boxH, boxW, boxH);
  ctx.strokeRect(
    (canvas.width - goalBoxW) / 2,
    canvas.height - pad - goalBoxH,
    goalBoxW,
    goalBoxH
  );

  // Penalty arcs
  ctx.beginPath();
  ctx.arc(canvas.width / 2, pad + 150, 95, 0.22 * Math.PI, 0.78 * Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(
    canvas.width / 2,
    canvas.height - pad - 150,
    95,
    1.22 * Math.PI,
    1.78 * Math.PI
  );
  ctx.stroke();

  return finalizeTexture(canvas, registry, maxAnisotropy, { isColor: true });
}

export function createRunningTrackTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#b4533b';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle rubberized tartan texture
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(60,15,10,0.05)';
    ctx.fillRect((i * 73) % 512, (i * 137) % 512, 2, 2);
  }

  // Lane markings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 3;
  for (let y = 64; y < 512; y += 85) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  return finalizeTexture(canvas, registry, maxAnisotropy, {
    isColor: true,
    repeatX: 4,
    repeatY: 4,
  });
}

export function createPoolMosaicTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(0, 0, 256, 256);

  const step = 16;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      const shade = ((x * 7 + y * 13) % 5) * 8;
      ctx.fillStyle = `rgb(${14 + shade}, ${155 + shade}, ${225 + (shade % 20)})`;
      ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
    }
  }

  return finalizeTexture(canvas, registry, maxAnisotropy, {
    isColor: true,
    repeatX: 3,
    repeatY: 2,
  });
}

export function createCrosswalkTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#f8fafc';
  for (let x = 14; x < 245; x += 36) {
    ctx.fillRect(x, 12, 18, 104);
  }

  return finalizeTexture(canvas, registry, maxAnisotropy, { isColor: true });
}

export function createArchitecturalBaseTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#d7d3c8';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle architectural survey grid
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 1024; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Subtle ground grain
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(51,65,85,0.04)';
    ctx.fillRect((i * 193) % 1024, (i * 311) % 1024, 2, 2);
  }

  return finalizeTexture(canvas, registry, maxAnisotropy, {
    isColor: true,
    repeatX: 6,
    repeatY: 6,
  });
}

export function createRoofTileTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9e2a22';
  ctx.fillRect(0, 0, 512, 512);

  // Standing-seam metal / terracotta tile courses
  const cols = 16;
  const rows = 16;
  const cw = 512 / cols;
  const rh = 512 / rows;

  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = r % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, r * rh, 512, rh);
    ctx.fillStyle = 'rgba(45, 10, 8, 0.25)';
    ctx.fillRect(0, r * rh + rh - 2, 512, 2);
  }
  for (let c = 0; c < cols; c++) {
    ctx.fillStyle = 'rgba(255, 220, 210, 0.1)';
    ctx.fillRect(c * cw, 0, 2, 512);
    ctx.fillStyle = 'rgba(45, 10, 8, 0.24)';
    ctx.fillRect(c * cw + 2, 0, 2, 512);
  }

  return finalizeTexture(canvas, registry, maxAnisotropy, {
    isColor: true,
    repeatX: 3,
    repeatY: 3,
  });
}

export function createPavingTileTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dcd7ce';
  ctx.fillRect(0, 0, 512, 512);

  const step = 32;
  for (let y = 0; y < 512; y += step) {
    for (let x = 0; x < 512; x += step) {
      const n = ((x * 13 + y * 29) % 7) - 3;
      ctx.fillStyle = `rgb(${216 + n * 2}, ${211 + n * 2}, ${201 + n * 2})`;
      ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
    }
  }

  return finalizeTexture(canvas, registry, maxAnisotropy, {
    isColor: true,
    repeatX: 12,
    repeatY: 8,
  });
}

export function createAsphaltTexture(
  registry: TextureRegistry,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 3200; i++) {
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(15,23,42,0.08)';
    ctx.fillRect((i * 89) % 256, (i * 149) % 256, 2, 2);
  }

  return finalizeTexture(canvas, registry, maxAnisotropy, {
    isColor: true,
    repeatX: 4,
    repeatY: 4,
  });
}

export function createStuccoWallTexture(
  registry: TextureRegistry,
  maxAnisotropy: number,
  baseHex = '#e4bd6b'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(30,41,59,0.04)';
    ctx.fillRect((i * 71) % 256, (i * 113) % 256, 2, 2);
  }

  return finalizeTexture(canvas, registry, maxAnisotropy, {
    isColor: true,
    repeatX: 2,
    repeatY: 2,
  });
}

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

function tileXToLon(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export interface SatelliteTileOverlay {
  texture: THREE.CanvasTexture;
  centerX: number;
  centerZ: number;
  widthMeters: number;
  depthMeters: number;
}

/**
 * Fetches a 3x3 ESRI World Imagery tile grid centered on [40.3125, 69.6225] at zoom 17
 * and computes its exact meter footprint in Three.js local coordinates.
 */
export async function loadAlignedSatelliteOverlay(
  registry: TextureRegistry,
  maxAnisotropy: number
): Promise<SatelliteTileOverlay> {
  const zoom = 17;
  const centerTx = lonToTileX(CAMPUS_ORIGIN.lng, zoom);
  const centerTy = latToTileY(CAMPUS_ORIGIN.lat, zoom);

  const radius = 1; // 3x3 tiles (~720m x 720m at zoom 17)
  const gridCols = radius * 2 + 1;
  const tileSize = 256;

  const canvas = document.createElement('canvas');
  canvas.width = gridCols * tileSize;
  canvas.height = gridCols * tileSize;
  const ctx = canvas.getContext('2d')!;

  // Warm Khujand satellite base tone if tiles are unavailable offline
  ctx.fillStyle = '#8b8a7a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const westLon = tileXToLon(centerTx - radius, zoom);
  const eastLon = tileXToLon(centerTx + radius + 1, zoom);
  const northLat = tileYToLat(centerTy - radius, zoom);
  const southLat = tileYToLat(centerTy + radius + 1, zoom);

  const [westX, northZ] = latLonToLocal(northLat, westLon);
  const [eastX, southZ] = latLonToLocal(southLat, eastLon);

  const widthMeters = Math.abs(eastX - westX);
  const depthMeters = Math.abs(southZ - northZ);
  const centerX = (westX + eastX) * 0.5;
  const centerZ = (northZ + southZ) * 0.5;

  const loadTile = (dx: number, dy: number) =>
    new Promise<void>((resolve) => {
      const tx = centerTx + dx;
      const ty = centerTy + dy;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timeout = window.setTimeout(() => resolve(), 4500);
      img.onload = () => {
        window.clearTimeout(timeout);
        ctx.drawImage(
          img,
          (dx + radius) * tileSize,
          (dy + radius) * tileSize,
          tileSize,
          tileSize
        );
        resolve();
      };
      img.onerror = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
    });

  const tasks: Array<Promise<void>> = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      tasks.push(loadTile(dx, dy));
    }
  }
  await Promise.all(tasks);

  const texture = finalizeTexture(canvas, registry, maxAnisotropy, {
    isColor: true,
  });

  return {
    texture,
    centerX,
    centerZ,
    widthMeters,
    depthMeters,
  };
}
