import * as THREE from 'three';
import { solid } from '../engine/materials';

/**
 * Procedural furniture. Each factory returns a group whose origin sits on the
 * floor at the centre of its footprint, facing +Z ("south") at rotation 0.
 * Pieces are built from primitives only, in the spirit of img2threejs:
 * an agent looks at a listing photo, picks the closest factory, and passes
 * the colours it sees as options. Add new factories to `FACTORIES`.
 */

export interface FurniturePiece {
  group: THREE.Group;
  /** Footprint [width along X, depth along Z] in metres, centred at the origin. */
  footprint: [number, number];
  /** If true the player can walk over/through it (rugs, low items). */
  passable?: boolean;
}

export type FurnitureOptions = Record<string, unknown>;
export type FurnitureFactory = (o: FurnitureOptions) => FurniturePiece;

function str(o: FurnitureOptions, key: string, fallback: string): string {
  const v = o[key];
  return typeof v === 'string' ? v : fallback;
}
function num(o: FurnitureOptions, key: string, fallback: number): number {
  const v = o[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  shadow = true,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function cylinder(r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function rounded(w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  // A box with softened vertical edges, used for cushions and upholstery.
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hd = d / 2;
  const rr = Math.min(r, hw, hd);
  shape.moveTo(-hw + rr, -hd);
  shape.lineTo(hw - rr, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + rr);
  shape.lineTo(hw, hd - rr);
  shape.quadraticCurveTo(hw, hd, hw - rr, hd);
  shape.lineTo(-hw + rr, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - rr);
  shape.lineTo(-hw, -hd + rr);
  shape.quadraticCurveTo(-hw, -hd, -hw + rr, -hd);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: rr * 0.5, bevelThickness: rr * 0.5, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y + rr * 0.5, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function legs(g: THREE.Group, w: number, d: number, h: number, r: number, mat: THREE.Material, inset = 0.08) {
  const hw = w / 2 - inset;
  const hd = d / 2 - inset;
  for (const [x, z] of [
    [-hw, -hd],
    [hw, -hd],
    [-hw, hd],
    [hw, hd],
  ]) {
    g.add(cylinder(r, h, mat, x, 0, z, 10));
  }
}

// ---------------------------------------------------------------------------

const sofa: FurnitureFactory = (o) => {
  const w = num(o, 'width', 2.2);
  const d = 0.95;
  const fabric = solid(str(o, 'color', '#8a8f86'), 0.95);
  const cushion = solid(str(o, 'cushion', str(o, 'color', '#8a8f86')), 0.95);
  const wood = solid(str(o, 'legs', '#3a2f28'), 0.6);
  const g = new THREE.Group();
  g.add(box(w, 0.1, d, wood, 0, 0.08, 0)); // plinth
  legs(g, w, d, 0.1, 0.025, wood, 0.12);
  g.add(rounded(w, 0.32, d - 0.1, 0.06, fabric, 0, 0.16, -0.05)); // base
  g.add(rounded(w - 0.3, 0.42, 0.22, 0.06, fabric, 0, 0.4, -d / 2 + 0.16)); // back
  g.add(rounded(0.18, 0.28, d - 0.1, 0.05, fabric, -w / 2 + 0.09, 0.42, -0.05)); // arms
  g.add(rounded(0.18, 0.28, d - 0.1, 0.05, fabric, w / 2 - 0.09, 0.42, -0.05));
  const seats = w > 1.8 ? 3 : 2;
  const sw = (w - 0.4) / seats;
  for (let i = 0; i < seats; i++) {
    const x = -w / 2 + 0.2 + sw * (i + 0.5);
    g.add(rounded(sw - 0.04, 0.12, 0.6, 0.05, cushion, x, 0.46, 0.05));
    g.add(rounded(sw - 0.06, 0.36, 0.14, 0.05, cushion, x, 0.56, -d / 2 + 0.34));
  }
  return { group: g, footprint: [w, d] };
};

const armchair: FurnitureFactory = (o) => {
  const p = sofa({ ...o, width: 0.95 });
  return { group: p.group, footprint: [0.95, 0.95] };
};

const coffeeTable: FurnitureFactory = (o) => {
  const w = num(o, 'width', 1.1);
  const d = num(o, 'depth', 0.6);
  const top = solid(str(o, 'color', '#5a4634'), 0.5);
  const metal = solid(str(o, 'legs', '#222222'), 0.4, 0.7);
  const g = new THREE.Group();
  g.add(box(w, 0.04, d, top, 0, 0.4, 0));
  legs(g, w, d, 0.4, 0.015, metal, 0.06);
  return { group: g, footprint: [w, d] };
};

const diningTable: FurnitureFactory = (o) => {
  const w = num(o, 'width', 1.6);
  const d = num(o, 'depth', 0.9);
  const seats = Math.max(2, Math.round(num(o, 'seats', 4)));
  const top = solid(str(o, 'color', '#6b5240'), 0.5);
  const legMat = solid(str(o, 'legs', '#2b2b2b'), 0.5, 0.3);
  const chairMat = solid(str(o, 'chair', '#2f2f33'), 0.8);
  const g = new THREE.Group();
  g.add(box(w, 0.04, d, top, 0, 0.74, 0));
  legs(g, w, d, 0.74, 0.03, legMat, 0.1);
  const perSide = Math.ceil(seats / 2);
  for (let i = 0; i < perSide; i++) {
    const x = -w / 2 + (w / (perSide + 1)) * (i + 1);
    for (const side of [-1, 1]) {
      if (side === 1 && i + perSide >= seats) continue;
      const z = side * (d / 2 + 0.3);
      const c = new THREE.Group();
      c.add(box(0.42, 0.04, 0.42, chairMat, 0, 0.44, 0));
      c.add(box(0.42, 0.42, 0.04, chairMat, 0, 0.48, -0.19));
      legs(c, 0.42, 0.42, 0.44, 0.015, legMat, 0.05);
      c.position.set(x, 0, z);
      c.rotation.y = side === 1 ? Math.PI : 0;
      g.add(c);
    }
  }
  return { group: g, footprint: [w + 0.2, d + 1.3] };
};

const bed: FurnitureFactory = (o) => {
  const w = num(o, 'width', 1.6);
  const d = num(o, 'length', 2.0);
  const frame = solid(str(o, 'frame', '#4a3a30'), 0.6);
  const mattress = solid(str(o, 'mattress', '#f1efe9'), 0.95);
  const duvet = solid(str(o, 'duvet', '#c9ccd3'), 0.95);
  const pillow = solid(str(o, 'pillow', '#ffffff'), 0.95);
  const g = new THREE.Group();
  g.add(box(w + 0.1, 0.25, d + 0.1, frame, 0, 0, 0));
  g.add(box(w + 0.1, 0.9, 0.06, frame, 0, 0, -d / 2 - 0.02)); // headboard
  g.add(rounded(w, 0.22, d, 0.04, mattress, 0, 0.25, 0));
  g.add(rounded(w + 0.04, 0.14, d * 0.62, 0.05, duvet, 0, 0.45, d * 0.18));
  const pw = w / 2 - 0.12;
  g.add(rounded(pw, 0.12, 0.45, 0.05, pillow, -w / 4, 0.47, -d / 2 + 0.3));
  g.add(rounded(pw, 0.12, 0.45, 0.05, pillow, w / 4, 0.47, -d / 2 + 0.3));
  return { group: g, footprint: [w + 0.1, d + 0.1] };
};

const nightstand: FurnitureFactory = (o) => {
  const mat = solid(str(o, 'color', '#4a3a30'), 0.6);
  const g = new THREE.Group();
  g.add(box(0.5, 0.5, 0.4, mat, 0, 0, 0));
  g.add(box(0.44, 0.02, 0.34, solid('#2a2a2a'), 0, 0.26, 0.01));
  // Lamp.
  g.add(cylinder(0.05, 0.3, solid('#b8b1a6', 0.5, 0.4), 0, 0.5, 0));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.18, 16, 1, true), solid('#f3ead8', 0.9));
  shade.material = (shade.material as THREE.MeshStandardMaterial).clone();
  (shade.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  shade.position.set(0, 0.83, 0);
  g.add(shade);
  return { group: g, footprint: [0.5, 0.4] };
};

const wardrobe: FurnitureFactory = (o) => {
  const w = num(o, 'width', 1.8);
  const mat = solid(str(o, 'color', '#e8e4dc'), 0.7);
  const handle = solid('#777777', 0.4, 0.8);
  const g = new THREE.Group();
  g.add(box(w, 2.3, 0.6, mat, 0, 0, 0));
  const doors = Math.max(2, Math.round(w / 0.5));
  for (let i = 1; i < doors; i++) {
    g.add(box(0.01, 2.2, 0.01, solid('#999999'), -w / 2 + (w / doors) * i, 0.05, 0.3));
  }
  for (let i = 0; i < doors; i++) {
    g.add(box(0.02, 0.2, 0.02, handle, -w / 2 + (w / doors) * (i + 0.5) + (i % 2 ? -0.06 : 0.06), 1.0, 0.31));
  }
  return { group: g, footprint: [w, 0.6] };
};

const kitchenCounter: FurnitureFactory = (o) => {
  const w = num(o, 'width', 2.8);
  const cab = solid(str(o, 'color', '#2f3338'), 0.6);
  const top = solid(str(o, 'top', '#d8d2c6'), 0.3);
  const steel = solid('#c9ccd1', 0.3, 0.9);
  const g = new THREE.Group();
  g.add(box(w, 0.86, 0.6, cab, 0, 0, 0));
  g.add(box(w + 0.02, 0.04, 0.63, top, 0, 0.86, 0.015));
  // Drawer and door seams.
  const units = Math.max(2, Math.round(w / 0.6));
  for (let i = 1; i < units; i++) g.add(box(0.008, 0.8, 0.008, solid('#111111'), -w / 2 + (w / units) * i, 0.03, 0.3));
  for (let i = 0; i < units; i++) g.add(box(0.18, 0.015, 0.015, steel, -w / 2 + (w / units) * (i + 0.5), 0.72, 0.305));
  // Sink and hob.
  g.add(box(0.5, 0.01, 0.4, steel, -w / 4, 0.9, 0));
  g.add(cylinder(0.012, 0.3, steel, -w / 4, 0.9, -0.22, 8));
  g.add(box(0.58, 0.01, 0.5, solid('#1a1a1a', 0.2), w / 4, 0.9, 0));
  const burners: Array<[number, number]> = [
    [-0.14, -0.12],
    [0.14, -0.12],
    [-0.14, 0.12],
    [0.14, 0.12],
  ];
  for (const [x, z] of burners) {
    g.add(cylinder(0.08, 0.004, solid('#3a3a3a', 0.4), w / 4 + x, 0.91, z));
  }
  if (o['uppers'] !== false) {
    g.add(box(w, 0.7, 0.35, cab, 0, 1.5, -0.125));
    for (let i = 1; i < units; i++) g.add(box(0.008, 0.66, 0.008, solid('#111111'), -w / 2 + (w / units) * i, 1.52, 0.05));
  }
  if (o['splashback'] !== false) {
    g.add(box(w, 0.6, 0.02, solid(str(o, 'splash', '#e9e3d6'), 0.3), 0, 0.9, -0.29, false));
  }
  return { group: g, footprint: [w, 0.6] };
};

const fridge: FurnitureFactory = (o) => {
  const mat = solid(str(o, 'color', '#d7d9dc'), 0.35, 0.6);
  const g = new THREE.Group();
  g.add(box(0.7, 1.9, 0.68, mat, 0, 0, 0));
  g.add(box(0.66, 0.01, 0.01, solid('#555555'), 0, 1.2, 0.345));
  g.add(box(0.02, 0.5, 0.02, solid('#777777', 0.4, 0.8), 0.28, 1.3, 0.35));
  return { group: g, footprint: [0.7, 0.68] };
};

const tvUnit: FurnitureFactory = (o) => {
  const w = num(o, 'width', 1.8);
  const mat = solid(str(o, 'color', '#3b332c'), 0.6);
  const g = new THREE.Group();
  g.add(box(w, 0.45, 0.42, mat, 0, 0, 0));
  g.add(box(0.012, 0.22, 0.012, solid('#555555'), 0, 0.46, -0.1));
  const screen = box(num(o, 'tv', 1.4), 0.8, 0.03, solid('#0a0a0c', 0.3, 0.2), 0, 0.6, -0.12);
  g.add(screen);
  g.add(box(num(o, 'tv', 1.4) - 0.04, 0.76, 0.005, solid('#16181d', 0.1, 0.4), 0, 0.62, -0.1, false));
  return { group: g, footprint: [w, 0.42] };
};

const bookshelf: FurnitureFactory = (o) => {
  const w = num(o, 'width', 1.0);
  const h = num(o, 'height', 2.0);
  const mat = solid(str(o, 'color', '#5e4a3a'), 0.7);
  const g = new THREE.Group();
  g.add(box(0.03, h, 0.3, mat, -w / 2 + 0.015, 0, 0));
  g.add(box(0.03, h, 0.3, mat, w / 2 - 0.015, 0, 0));
  g.add(box(w, 0.02, 0.3, mat, 0, 0, 0));
  g.add(box(w, 0.015, 0.3, mat, 0, h - 0.015, 0));
  g.add(box(w, h, 0.01, mat, 0, 0, -0.145));
  const shelves = Math.max(2, Math.round(h / 0.38));
  const palette = ['#b23a3a', '#2f6b8f', '#d9b85e', '#3f6b4e', '#ececec', '#333333', '#8c5a9b'];
  let seed = Math.round(w * 100 + h * 10);
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 1; i < shelves; i++) {
    const y = (h / shelves) * i;
    g.add(box(w - 0.06, 0.02, 0.28, mat, 0, y, 0));
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.1) {
      const bw = 0.025 + rand() * 0.03;
      const bh = 0.18 + rand() * 0.12;
      g.add(box(bw, bh, 0.2, solid(palette[Math.floor(rand() * palette.length)] ?? '#444444', 0.8), x + bw / 2, y - h / shelves + 0.02, -0.02, false));
      x += bw + 0.004;
      if (rand() > 0.85) x += 0.08;
    }
  }
  return { group: g, footprint: [w, 0.3] };
};

const rug: FurnitureFactory = (o) => {
  const w = num(o, 'width', 2.0);
  const d = num(o, 'depth', 1.4);
  const mat = solid(str(o, 'color', '#b8a58d'), 1);
  const g = new THREE.Group();
  const m = box(w, 0.012, d, mat, 0, 0, 0, false);
  g.add(m);
  g.add(box(w - 0.16, 0.013, d - 0.16, solid(str(o, 'accent', '#a08f78'), 1), 0, 0, 0, false));
  return { group: g, footprint: [w, d], passable: true };
};

const plant: FurnitureFactory = (o) => {
  const pot = solid(str(o, 'pot', '#9c7a5a'), 0.8);
  const leaf = solid(str(o, 'color', '#3f7b45'), 0.9);
  const g = new THREE.Group();
  g.add(cylinder(0.18, 0.4, pot, 0, 0, 0));
  g.add(cylinder(0.02, 0.9, solid('#4b3b2d'), 0, 0.4, 0, 6));
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 9; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.16 + rand() * 0.1, 8, 6), leaf);
    l.scale.set(1, 0.5, 1.4);
    l.position.set((rand() - 0.5) * 0.5, 1.0 + rand() * 0.45, (rand() - 0.5) * 0.5);
    l.rotation.y = rand() * Math.PI;
    l.castShadow = true;
    g.add(l);
  }
  return { group: g, footprint: [0.4, 0.4] };
};

const floorLamp: FurnitureFactory = (o) => {
  const metal = solid(str(o, 'color', '#2b2b2b'), 0.4, 0.8);
  const g = new THREE.Group();
  g.add(cylinder(0.14, 0.02, metal, 0, 0, 0));
  g.add(cylinder(0.012, 1.5, metal, 0, 0, 0, 8));
  const shadeMat = solid(str(o, 'shade', '#f0e6d2'), 0.9).clone();
  shadeMat.side = THREE.DoubleSide;
  shadeMat.emissive = new THREE.Color('#ffe2b0');
  shadeMat.emissiveIntensity = 0.35;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 18, 1, true), shadeMat);
  shade.position.set(0, 1.55, 0);
  g.add(shade);
  const light = new THREE.PointLight('#ffdcae', 4, 5, 2);
  light.position.set(0, 1.5, 0);
  g.add(light);
  return { group: g, footprint: [0.3, 0.3] };
};

const desk: FurnitureFactory = (o) => {
  const w = num(o, 'width', 1.4);
  const top = solid(str(o, 'color', '#d9cdb8'), 0.6);
  const metal = solid('#2b2b2b', 0.4, 0.7);
  const g = new THREE.Group();
  g.add(box(w, 0.03, 0.7, top, 0, 0.73, 0));
  legs(g, w, 0.7, 0.73, 0.02, metal, 0.05);
  // Monitor and chair.
  g.add(box(0.5, 0.3, 0.02, solid('#0a0a0c', 0.3), 0, 0.9, -0.2));
  g.add(cylinder(0.08, 0.02, metal, 0, 0.76, -0.2));
  g.add(box(0.02, 0.14, 0.02, metal, 0, 0.76, -0.2));
  const c = new THREE.Group();
  c.add(box(0.46, 0.06, 0.46, solid(str(o, 'chair', '#333338'), 0.8), 0, 0.46, 0));
  c.add(box(0.44, 0.5, 0.05, solid(str(o, 'chair', '#333338'), 0.8), 0, 0.52, -0.2));
  c.add(cylinder(0.03, 0.44, metal, 0, 0, 0, 8));
  c.add(cylinder(0.3, 0.02, metal, 0, 0, 0, 10));
  c.position.set(0, 0, 0.55);
  g.add(c);
  return { group: g, footprint: [w, 1.3] };
};

const toilet: FurnitureFactory = () => {
  const white = solid('#f4f4f2', 0.2);
  const g = new THREE.Group();
  g.add(box(0.4, 0.4, 0.5, white, 0, 0, 0.1));
  g.add(rounded(0.38, 0.06, 0.48, 0.15, solid('#ffffff', 0.3), 0, 0.4, 0.1));
  g.add(box(0.4, 0.4, 0.18, white, 0, 0.4, -0.2));
  return { group: g, footprint: [0.4, 0.7] };
};

const vanity: FurnitureFactory = (o) => {
  const w = num(o, 'width', 0.9);
  const cab = solid(str(o, 'color', '#4a4038'), 0.6);
  const white = solid('#f7f7f5', 0.2);
  const g = new THREE.Group();
  g.add(box(w, 0.5, 0.48, cab, 0, 0.3, 0));
  g.add(box(w + 0.02, 0.05, 0.5, white, 0, 0.8, 0));
  g.add(cylinder(0.18, 0.08, white, 0, 0.85, -0.02, 20));
  g.add(cylinder(0.012, 0.2, solid('#c9ccd1', 0.3, 0.9), 0, 0.85, -0.2, 8));
  // Mirror.
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.05, metalness: 1 }));
  mirror.position.set(0, 1.5, -0.23);
  g.add(mirror);
  return { group: g, footprint: [w, 0.48] };
};

const shower: FurnitureFactory = (o) => {
  const w = num(o, 'width', 0.9);
  const d = num(o, 'depth', 0.9);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const tray = solid('#f4f4f2', 0.3);
  const chrome = solid('#c9ccd1', 0.25, 0.9);
  const g = new THREE.Group();
  g.add(box(w, 0.04, d, tray, 0, 0, 0));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.0), glass);
  panel.position.set(0, 1.04, d / 2);
  g.add(panel);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(d, 2.0), glass);
  side.rotation.y = Math.PI / 2;
  side.position.set(w / 2, 1.04, 0);
  g.add(side);
  g.add(cylinder(0.012, 1.0, chrome, -w / 2 + 0.08, 1.0, -d / 2 + 0.05, 8));
  g.add(cylinder(0.1, 0.01, chrome, -w / 2 + 0.3, 2.0, -d / 2 + 0.25, 16));
  return { group: g, footprint: [w, d] };
};

const bathtub: FurnitureFactory = (o) => {
  const w = num(o, 'width', 1.7);
  const white = solid('#f6f6f4', 0.25);
  const g = new THREE.Group();
  g.add(box(w, 0.55, 0.75, white, 0, 0, 0));
  g.add(box(w - 0.16, 0.3, 0.59, solid('#dfe4e8', 0.2), 0, 0.26, 0, false));
  g.add(cylinder(0.012, 0.2, solid('#c9ccd1', 0.3, 0.9), w / 2 - 0.15, 0.55, -0.2, 8));
  return { group: g, footprint: [w, 0.75] };
};

const washingMachine: FurnitureFactory = () => {
  const white = solid('#eeeeee', 0.4, 0.2);
  const g = new THREE.Group();
  g.add(box(0.6, 0.85, 0.6, white, 0, 0, 0));
  g.add(cylinder(0.22, 0.02, solid('#222222', 0.2, 0.3), 0, 0.42, 0.3, 24).rotateX(Math.PI / 2));
  return { group: g, footprint: [0.6, 0.6] };
};

const sideboard: FurnitureFactory = (o) => {
  const w = num(o, 'width', 1.6);
  const mat = solid(str(o, 'color', '#6a5542'), 0.6);
  const g = new THREE.Group();
  g.add(box(w, 0.75, 0.45, mat, 0, 0.1, 0));
  legs(g, w, 0.45, 0.1, 0.015, solid('#222222', 0.4, 0.7), 0.06);
  const doors = Math.max(2, Math.round(w / 0.55));
  for (let i = 1; i < doors; i++) g.add(box(0.008, 0.7, 0.008, solid('#111111'), -w / 2 + (w / doors) * i, 0.12, 0.225));
  return { group: g, footprint: [w, 0.45] };
};

const curtain: FurnitureFactory = (o) => {
  // Floor-length curtain panels flanking a window; place against a wall.
  const w = num(o, 'width', 1.8);
  const h = num(o, 'height', 2.5);
  const mat = solid(str(o, 'color', '#d9d3c7'), 1);
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const panel = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      panel.add(cylinder(0.05, h, mat, side * (w / 2 - 0.2) + (i - 2.5) * 0.075, 0, 0, 8));
    }
    g.add(panel);
  }
  g.add(cylinder(0.012, w + 0.2, solid('#444444', 0.4, 0.8), 0, h + 0.02, 0, 8).rotateZ(Math.PI / 2));
  return { group: g, footprint: [w, 0.12], passable: true };
};

const artwork: FurnitureFactory = (o) => {
  // Framed canvas hung on a wall; `at` is where it hangs, `rotation` faces it into the room.
  const w = num(o, 'width', 1.0);
  const h = num(o, 'height', 0.7);
  const y = num(o, 'y', 1.5);
  const frame = solid(str(o, 'frame', '#222222'), 0.5);
  const canvas = solid(str(o, 'color', '#b65a3c'), 0.9);
  const g = new THREE.Group();
  g.add(box(w, h, 0.03, frame, 0, y - h / 2, 0, false));
  g.add(box(w - 0.08, h - 0.08, 0.035, canvas, 0, y - h / 2 + 0.04, 0.0, false));
  g.add(box((w - 0.08) * 0.5, (h - 0.08) * 0.35, 0.036, solid(str(o, 'accent', '#efe1c4'), 0.9), -(w - 0.08) * 0.15, y - h / 2 + (h - 0.08) * 0.25, 0, false));
  return { group: g, footprint: [w, 0.05], passable: true };
};

export const FACTORIES: Record<string, FurnitureFactory> = {
  sofa,
  armchair,
  coffeeTable,
  diningTable,
  bed,
  nightstand,
  wardrobe,
  kitchenCounter,
  fridge,
  tvUnit,
  bookshelf,
  rug,
  plant,
  floorLamp,
  desk,
  toilet,
  vanity,
  shower,
  bathtub,
  washingMachine,
  sideboard,
  curtain,
  artwork,
};

export function makeFurniture(kind: string, options: FurnitureOptions = {}): FurniturePiece | undefined {
  const f = FACTORIES[kind];
  if (!f) {
    console.warn(`[estate-player] unknown furniture kind "${kind}"`);
    return undefined;
  }
  return f(options);
}
