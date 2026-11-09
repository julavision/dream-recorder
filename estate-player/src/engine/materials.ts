import * as THREE from 'three';
import type { MaterialSpec } from '../spec/types';
import { textureFor } from './textures';

const DEFAULT_ROUGHNESS: Record<MaterialSpec['kind'], number> = {
  plaster: 0.92,
  paint: 0.85,
  wood: 0.55,
  tile: 0.25,
  concrete: 0.95,
  fabric: 1,
  marble: 0.2,
  glass: 0.05,
  metal: 0.35,
  flat: 0.8,
};

const DEFAULT_SCALE: Record<MaterialSpec['kind'], number> = {
  plaster: 3,
  paint: 3,
  wood: 1.6,
  tile: 1.2,
  concrete: 2.5,
  fabric: 0.5,
  marble: 2,
  glass: 1,
  metal: 0.5,
  flat: 1,
};

const cache = new Map<string, THREE.Material>();

/**
 * Builds a PBR material for the spec. `extent` is the surface size in metres
 * so the texture repeats at a physical scale regardless of geometry size.
 * Materials are cached per (spec, extent) pair.
 */
export function materialFor(spec: MaterialSpec, extent: [number, number] = [1, 1]): THREE.Material {
  const scale = spec.scale ?? DEFAULT_SCALE[spec.kind];
  const repeat: [number, number] = [Math.max(0.01, extent[0] / scale), Math.max(0.01, extent[1] / scale)];
  const key = JSON.stringify([spec, repeat.map((r) => r.toFixed(3))]);
  const hit = cache.get(key);
  if (hit) return hit;

  let mat: THREE.Material;
  if (spec.kind === 'glass') {
    mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(spec.color),
      roughness: spec.roughness ?? 0.05,
      metalness: 0,
      transmission: 0.85,
      thickness: 0.02,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  } else {
    const map = textureFor(spec).clone();
    map.repeat.set(repeat[0], repeat[1]);
    map.needsUpdate = true;
    mat = new THREE.MeshStandardMaterial({
      map,
      roughness: spec.roughness ?? DEFAULT_ROUGHNESS[spec.kind],
      metalness: spec.metalness ?? (spec.kind === 'metal' ? 0.8 : 0),
    });
  }
  cache.set(key, mat);
  return mat;
}

/** Plain colour material for furniture parts; cached by colour and finish. */
export function solid(color: string, roughness = 0.6, metalness = 0): THREE.MeshStandardMaterial {
  const key = `solid:${color}:${roughness}:${metalness}`;
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshStandardMaterial;
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness });
  cache.set(key, mat);
  return mat;
}

export function disposeMaterialCache() {
  for (const m of cache.values()) m.dispose();
  cache.clear();
}
