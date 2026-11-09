import * as THREE from 'three';
import type { MaterialSpec } from '../spec/types';

/**
 * Procedural, canvas-generated textures. No image downloads: every surface in
 * the player is produced from a colour and a few numbers, which keeps the
 * tour spec small and lets an agent describe a photo in a handful of fields.
 */

type Ctx = CanvasRenderingContext2D;

const cache = new Map<string, THREE.CanvasTexture>();

/** Deterministic PRNG so textures are identical between reloads. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function rgba(rgb: [number, number, number], a = 1) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function shade(rgb: [number, number, number], k: number): [number, number, number] {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * k))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * k))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * k))),
  ];
}

function makeCanvas(size: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [canvas, ctx];
}

/** Soft noise overlay so flat colours read as real surfaces. */
function speckle(ctx: Ctx, size: number, rand: () => number, amount: number, count = 4000) {
  for (let i = 0; i < count; i++) {
    const v = (rand() - 0.5) * amount;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    const s = 1 + rand() * 3;
    ctx.fillRect(rand() * size, rand() * size, s, s);
  }
}

function plaster(ctx: Ctx, size: number, base: [number, number, number], rand: () => number) {
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, 0, size, size);
  // Large soft blotches for the trowel pattern.
  for (let i = 0; i < 60; i++) {
    const r = 40 + rand() * 120;
    const g = ctx.createRadialGradient(rand() * size, rand() * size, 0, rand() * size, rand() * size, r);
    const k = 0.96 + rand() * 0.08;
    g.addColorStop(0, rgba(shade(base, k), 0.35));
    g.addColorStop(1, rgba(base, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  speckle(ctx, size, rand, 0.06, 6000);
}

function paint(ctx: Ctx, size: number, base: [number, number, number], rand: () => number) {
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, rand, 0.03, 3000);
}

function wood(ctx: Ctx, size: number, base: [number, number, number], accent: [number, number, number], rand: () => number) {
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, 0, size, size);
  const planks = 6;
  const plankH = size / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * plankH;
    const k = 0.9 + rand() * 0.2;
    ctx.fillStyle = rgba(shade(base, k));
    ctx.fillRect(0, y0, size, plankH);
    // Grain lines.
    for (let i = 0; i < 28; i++) {
      ctx.strokeStyle = rgba(shade(accent, 0.85 + rand() * 0.3), 0.18 + rand() * 0.2);
      ctx.lineWidth = 0.6 + rand() * 1.4;
      ctx.beginPath();
      const y = y0 + rand() * plankH;
      ctx.moveTo(0, y);
      const segs = 8;
      for (let s = 1; s <= segs; s++) {
        ctx.lineTo((size * s) / segs, y + (rand() - 0.5) * 6);
      }
      ctx.stroke();
    }
    // Plank seam and a staggered end joint.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y0, size, 2);
    const joint = ((p * 0.37 + 0.2) % 1) * size;
    ctx.fillRect(joint, y0, 2, plankH);
  }
  speckle(ctx, size, rand, 0.04, 2000);
}

function tile(ctx: Ctx, size: number, base: [number, number, number], grout: [number, number, number], rand: () => number) {
  ctx.fillStyle = rgba(grout);
  ctx.fillRect(0, 0, size, size);
  const n = 4;
  const t = size / n;
  const gap = Math.max(2, size * 0.008);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = 0.95 + rand() * 0.1;
      const g = ctx.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
      g.addColorStop(0, rgba(shade(base, k * 1.03)));
      g.addColorStop(1, rgba(shade(base, k * 0.97)));
      ctx.fillStyle = g;
      ctx.fillRect(i * t + gap, j * t + gap, t - gap * 2, t - gap * 2);
    }
  }
  speckle(ctx, size, rand, 0.03, 1500);
}

function concrete(ctx: Ctx, size: number, base: [number, number, number], rand: () => number) {
  plaster(ctx, size, base, rand);
  speckle(ctx, size, rand, 0.12, 9000);
  // Faint formwork lines.
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (size * i) / 3);
    ctx.lineTo(size, (size * i) / 3);
    ctx.stroke();
  }
}

function fabric(ctx: Ctx, size: number, base: [number, number, number], rand: () => number) {
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, 0, size, size);
  const step = 4;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const k = ((x / step + y / step) % 2 === 0 ? 1.04 : 0.96) * (0.98 + rand() * 0.04);
      ctx.fillStyle = rgba(shade(base, k));
      ctx.fillRect(x, y, step, step);
    }
  }
}

function marble(ctx: Ctx, size: number, base: [number, number, number], vein: [number, number, number], rand: () => number) {
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = rgba(vein, 0.12 + rand() * 0.25);
    ctx.lineWidth = 1 + rand() * 3;
    ctx.beginPath();
    let x = rand() * size;
    let y = rand() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 12; s++) {
      x += (rand() - 0.5) * 120;
      y += (rand() - 0.5) * 120;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  speckle(ctx, size, rand, 0.03, 2000);
}

function metal(ctx: Ctx, size: number, base: [number, number, number], rand: () => number) {
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.08})`;
    ctx.fillRect(0, y, size, 1);
  }
}

/**
 * Returns a colour map for the material spec. Textures are cached by their
 * spec signature so identical rooms share GPU memory.
 */
export function textureFor(spec: MaterialSpec, size = 512): THREE.CanvasTexture {
  const key = JSON.stringify([spec.kind, spec.color, spec.accent ?? '', size]);
  const hit = cache.get(key);
  if (hit) return hit;

  const [canvas, ctx] = makeCanvas(size);
  const rand = mulberry32(hashString(key));
  const base = hexToRgb(spec.color);
  const accent = hexToRgb(spec.accent ?? spec.color);

  switch (spec.kind) {
    case 'plaster':
      plaster(ctx, size, base, rand);
      break;
    case 'paint':
      paint(ctx, size, base, rand);
      break;
    case 'wood':
      wood(ctx, size, base, accent, rand);
      break;
    case 'tile':
      tile(ctx, size, base, spec.accent ? accent : shade(base, 0.75), rand);
      break;
    case 'concrete':
      concrete(ctx, size, base, rand);
      break;
    case 'fabric':
      fabric(ctx, size, base, rand);
      break;
    case 'marble':
      marble(ctx, size, base, spec.accent ? accent : shade(base, 0.6), rand);
      break;
    case 'metal':
      metal(ctx, size, base, rand);
      break;
    case 'glass':
    case 'flat':
      ctx.fillStyle = rgba(base);
      ctx.fillRect(0, 0, size, size);
      break;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

export function disposeTextureCache() {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}
