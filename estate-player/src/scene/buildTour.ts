import * as THREE from 'three';
import type { HotspotSpec, MaterialSpec, OpeningSpec, RoomSpec, TourSpec, WallSide } from '../spec/types';
import { materialFor, solid } from '../engine/materials';
import { Walkable, type Rect } from '../controls/collision';
import { buildWallRun, type WallOpening } from './walls';
import { makeFurniture } from './furniture';

export interface BuiltRoom {
  spec: RoomSpec;
  rect: Rect;
  centre: [number, number];
  entry: [number, number];
  heading: number;
}

export interface DoorRect {
  rect: Rect;
}

export interface BuiltTour {
  spec: TourSpec;
  group: THREE.Group;
  rooms: Map<string, BuiltRoom>;
  order: string[];
  walkable: Walkable;
  floors: THREE.Mesh[];
  hotspots: THREE.Sprite[];
  doors: DoorRect[];
  bounds: Rect;
  centre: THREE.Vector3;
  roomHeight: number;
  eyeHeight: number;
  wallThickness: number;
  update(dt: number, t: number): void;
}

const FACADE: MaterialSpec = { kind: 'plaster', color: '#d6d2ca', scale: 4 };
const EPS = 1e-3;

type Interval = [number, number];

interface SideFrame {
  length: number;
  /** Maps a local run coordinate to the world point on the wall's inner line. */
  group: THREE.Group;
}

function sideFrame(room: RoomSpec, side: WallSide): SideFrame {
  const [ox, oz] = room.origin;
  const [w, d] = room.size;
  const g = new THREE.Group();
  switch (side) {
    case 'south':
      g.position.set(ox, 0, oz + d);
      return { length: w, group: g };
    case 'north':
      g.position.set(ox + w, 0, oz);
      g.rotation.y = Math.PI;
      return { length: w, group: g };
    case 'west':
      g.position.set(ox, 0, oz);
      g.rotation.y = -Math.PI / 2;
      return { length: d, group: g };
    case 'east':
      g.position.set(ox + w, 0, oz + d);
      g.rotation.y = Math.PI / 2;
      return { length: d, group: g };
  }
}

/** Converts an opening's `at` (from west/north end) to the side's local run coordinate. */
function localAt(room: RoomSpec, side: WallSide, at: number): number {
  const [w, d] = room.size;
  switch (side) {
    case 'south':
    case 'west':
      return at;
    case 'north':
      return w - at;
    case 'east':
      return d - at;
  }
}

/** Converts a world coordinate along the wall axis to the side's local run coordinate. */
function localFromWorld(room: RoomSpec, side: WallSide, coord: number): number {
  const [ox, oz] = room.origin;
  switch (side) {
    case 'south':
      return coord - ox;
    case 'north':
      return room.size[0] - (coord - ox);
    case 'west':
      return coord - oz;
    case 'east':
      return room.size[1] - (coord - oz);
  }
}

function toWallOpening(room: RoomSpec, side: WallSide, op: OpeningSpec, swing: WallOpening['swing'] = 'inner'): WallOpening {
  const sill = op.sill ?? (op.type === 'window' ? 0.9 : 0);
  return {
    type: op.type,
    at: localAt(room, side, op.at),
    width: op.width,
    height: op.height,
    sill,
    leaf: op.leaf,
    hinge: 'start',
    swing,
  };
}

/** Shared door declared by both rooms: keep one, but let either side's `leaf` flag win. */
function mergeOpening(existing: WallOpening, incoming: WallOpening): WallOpening {
  if (incoming.leaf && !existing.leaf) return { ...existing, leaf: true, swing: incoming.swing, hinge: incoming.hinge };
  return existing;
}

function subtractIntervals(full: Interval, used: Interval[]): Interval[] {
  const sorted = [...used].sort((a, b) => a[0] - b[0]);
  const out: Interval[] = [];
  let cursor = full[0];
  for (const [a, b] of sorted) {
    if (a > cursor + EPS) out.push([cursor, Math.min(a, full[1])]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < full[1] - EPS) out.push([cursor, full[1]]);
  return out;
}

function wallMaterial(room: RoomSpec, side: WallSide, height: number, length: number): THREE.Material {
  const spec = room.wallOverrides?.[side] ?? room.walls;
  return materialFor(spec, [length, height]);
}

function hotspotSprite(spec: HotspotSpec): THREE.Sprite {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(20,24,30,0.9)';
    ctx.stroke();
    ctx.fillStyle = '#14181e';
    ctx.font = `bold ${size * 0.5}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', size / 2, size / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  sprite.scale.set(0.26, 0.26, 1);
  sprite.userData['hotspot'] = spec;
  sprite.name = `hotspot:${spec.id}`;
  return sprite;
}

export function buildTour(spec: TourSpec): BuiltTour {
  const group = new THREE.Group();
  group.name = 'tour';
  const t = spec.wallThickness ?? 0.18;
  const H = spec.roomHeight ?? 2.7;
  const walkable = new Walkable();
  const floors: THREE.Mesh[] = [];
  const hotspots: THREE.Sprite[] = [];
  const doors: DoorRect[] = [];
  const rooms = new Map<string, BuiltRoom>();
  const order: string[] = [];

  const consumed = new Map<string, Interval[]>();
  const key = (id: string, side: WallSide) => `${id}:${side}`;
  const consume = (id: string, side: WallSide, iv: Interval) => {
    const k = key(id, side);
    const list = consumed.get(k) ?? [];
    list.push(iv);
    consumed.set(k, list);
  };

  const frames = new Map<string, THREE.Group>();
  const frameFor = (room: RoomSpec, side: WallSide) => {
    const k = key(room.id, side);
    let g = frames.get(k);
    if (!g) {
      const f = sideFrame(room, side);
      g = f.group;
      g.name = `wall:${room.id}:${side}`;
      group.add(g);
      frames.set(k, g);
    }
    return g;
  };

  const roomHeight = (r: RoomSpec) => r.height ?? H;

  const openingsOn = (room: RoomSpec, side: WallSide) => (room.openings ?? []).filter((o) => o.wall === side);

  const addDoorRects = (room: RoomSpec, side: WallSide, ops: OpeningSpec[]) => {
    const [ox, oz] = room.origin;
    const [w, d] = room.size;
    for (const op of ops) {
      if (op.type === 'window') continue;
      let rect: Rect;
      switch (side) {
        case 'north':
          rect = { x0: ox + op.at - op.width / 2, x1: ox + op.at + op.width / 2, z0: oz - t, z1: oz };
          break;
        case 'south':
          rect = { x0: ox + op.at - op.width / 2, x1: ox + op.at + op.width / 2, z0: oz + d, z1: oz + d + t };
          break;
        case 'west':
          rect = { x0: ox - t, x1: ox, z0: oz + op.at - op.width / 2, z1: oz + op.at + op.width / 2 };
          break;
        case 'east':
          rect = { x0: ox + w, x1: ox + w + t, z0: oz + op.at - op.width / 2, z1: oz + op.at + op.width / 2 };
          break;
      }
      walkable.addRect(rect);
      doors.push({ rect });
    }
  };

  // --- Rooms: floors, ceilings, lights, furniture, hotspots, collision ----
  let bounds: Rect | undefined;
  for (const room of spec.rooms) {
    const [ox, oz] = room.origin;
    const [w, d] = room.size;
    const h = roomHeight(room);
    const rect: Rect = { x0: ox, z0: oz, x1: ox + w, z1: oz + d, room: room.id };
    walkable.addRect(rect);
    bounds = bounds
      ? { x0: Math.min(bounds.x0, ox - t), z0: Math.min(bounds.z0, oz - t), x1: Math.max(bounds.x1, ox + w + t), z1: Math.max(bounds.z1, oz + d + t) }
      : { x0: ox - t, z0: oz - t, x1: ox + w + t, z1: oz + d + t };

    const centre: [number, number] = [ox + w / 2, oz + d / 2];
    const entry: [number, number] = room.entry ? [ox + room.entry[0], oz + room.entry[1]] : centre;
    rooms.set(room.id, { spec: room, rect, centre, entry, heading: room.entryHeading ?? 0 });
    order.push(room.id);

    // Floor extends half a wall under the walls so doorways have no gap.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w + t, d + t), materialFor(room.floor, [w + t, d + t]));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centre[0], 0, centre[1]);
    floor.receiveShadow = true;
    floor.name = `floor:${room.id}`;
    floor.userData['room'] = room.id;
    group.add(floor);
    floors.push(floor);

    const ceilSpec = room.ceiling ?? { kind: 'paint', color: '#f6f5f2' };
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w + t, d + t), materialFor(ceilSpec, [w + t, d + t]));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(centre[0], h, centre[1]);
    ceiling.name = `ceiling:${room.id}`;
    group.add(ceiling);

    // Lights.
    const area = w * d;
    const fixtures: Array<[number, number]> =
      room.lights ?? (area > 14 ? (w >= d ? [[w * 0.3, d / 2], [w * 0.7, d / 2]] : [[w / 2, d * 0.3], [w / 2, d * 0.7]]) : [[w / 2, d / 2]]);
    for (const [lx, lz] of fixtures) {
      const light = new THREE.PointLight('#fff2dd', 10 + area * 0.6, Math.max(w, d) * 1.4, 1.6);
      light.position.set(ox + lx, h - 0.12, oz + lz);
      group.add(light);
      const diskMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#fff4e0'), emissiveIntensity: 1.6, roughness: 0.6 });
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 20), diskMat);
      disk.position.set(ox + lx, h - 0.02, oz + lz);
      group.add(disk);
    }

    // Furniture.
    for (const f of room.furniture ?? []) {
      const piece = makeFurniture(f.kind, f.options ?? {});
      if (!piece) continue;
      const rot = THREE.MathUtils.degToRad(f.rotation ?? 0);
      piece.group.position.set(ox + f.at[0], 0, oz + f.at[1]);
      piece.group.rotation.y = rot;
      piece.group.name = `furniture:${room.id}:${f.kind}`;
      group.add(piece.group);
      if (!piece.passable) {
        const [fw, fd] = piece.footprint;
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const hx = Math.abs(c) * fw / 2 + Math.abs(s) * fd / 2;
        const hz = Math.abs(s) * fw / 2 + Math.abs(c) * fd / 2;
        const px = ox + f.at[0];
        const pz = oz + f.at[1];
        walkable.addBlocker({ x0: px - hx + 0.02, x1: px + hx - 0.02, z0: pz - hz + 0.02, z1: pz + hz - 0.02 });
      }
    }

    // Hotspots.
    for (const hs of room.hotspots ?? []) {
      const sprite = hotspotSprite(hs);
      sprite.position.set(ox + hs.at[0], hs.at[1], oz + hs.at[2]);
      sprite.userData['baseY'] = hs.at[1];
      sprite.userData['room'] = room.id;
      group.add(sprite);
      hotspots.push(sprite);
    }

    // Doorway collision rects for every door on this room.
    for (const side of ['north', 'south', 'east', 'west'] as const) {
      addDoorRects(room, side, openingsOn(room, side));
    }
  }

  // --- Shared walls between abutting rooms --------------------------------
  const byId = new Map(spec.rooms.map((r) => [r.id, r] as const));
  for (const a of spec.rooms) {
    const [ax, az] = a.origin;
    const [aw, ad] = a.size;
    for (const b of spec.rooms) {
      if (a === b) continue;
      const [bx, bz] = b.origin;
      const [bw, bd] = b.size;
      const h = Math.max(roomHeight(a), roomHeight(b));

      // a.east <-> b.west
      if (Math.abs(bx - (ax + aw + t)) < EPS) {
        const z0 = Math.max(az, bz);
        const z1 = Math.min(az + ad, bz + bd);
        if (z1 - z0 > EPS) {
          const la: Interval = [localFromWorld(a, 'east', z1), localFromWorld(a, 'east', z0)];
          const lb: Interval = [localFromWorld(b, 'west', z0), localFromWorld(b, 'west', z1)];
          consume(a.id, 'east', la);
          consume(b.id, 'west', lb);
          const openings: WallOpening[] = [];
          for (const op of openingsOn(a, 'east')) {
            const wz = az + op.at;
            // Doors declared by A open away from A, i.e. toward the outer side.
            if (wz >= z0 - EPS && wz <= z1 + EPS) openings.push(toWallOpening(a, 'east', op, 'outer'));
          }
          for (const op of openingsOn(b, 'west')) {
            const wz = bz + op.at;
            if (wz < z0 - EPS || wz > z1 + EPS) continue;
            const local = localFromWorld(a, 'east', wz);
            const incoming: WallOpening = { ...toWallOpening(b, 'west', op, 'inner'), at: local, hinge: 'end' };
            const idx = openings.findIndex((o) => Math.abs(o.at - local) < 0.05);
            if (idx >= 0) {
              const existing = openings[idx];
              if (existing) openings[idx] = mergeOpening(existing, incoming);
              continue;
            }
            openings.push(incoming);
          }
          const len = la[1] - la[0];
          const run = buildWallRun({
            length: len,
            height: h,
            thickness: t,
            inner: wallMaterial(a, 'east', h, len),
            outer: wallMaterial(b, 'west', h, len),
            openings: openings.map((o) => ({ ...o, at: o.at - la[0] })),
          });
          run.position.x = la[0];
          frameFor(a, 'east').add(run);
        }
      }

      // a.south <-> b.north
      if (Math.abs(bz - (az + ad + t)) < EPS) {
        const x0 = Math.max(ax, bx);
        const x1 = Math.min(ax + aw, bx + bw);
        if (x1 - x0 > EPS) {
          const la: Interval = [localFromWorld(a, 'south', x0), localFromWorld(a, 'south', x1)];
          const lb: Interval = [localFromWorld(b, 'north', x1), localFromWorld(b, 'north', x0)];
          consume(a.id, 'south', la);
          consume(b.id, 'north', lb);
          const openings: WallOpening[] = [];
          for (const op of openingsOn(a, 'south')) {
            const wx = ax + op.at;
            if (wx >= x0 - EPS && wx <= x1 + EPS) openings.push(toWallOpening(a, 'south', op, 'outer'));
          }
          for (const op of openingsOn(b, 'north')) {
            const wx = bx + op.at;
            if (wx < x0 - EPS || wx > x1 + EPS) continue;
            const local = localFromWorld(a, 'south', wx);
            const incoming: WallOpening = { ...toWallOpening(b, 'north', op, 'inner'), at: local, hinge: 'end' };
            const idx = openings.findIndex((o) => Math.abs(o.at - local) < 0.05);
            if (idx >= 0) {
              const existing = openings[idx];
              if (existing) openings[idx] = mergeOpening(existing, incoming);
              continue;
            }
            openings.push(incoming);
          }
          const len = la[1] - la[0];
          const run = buildWallRun({
            length: len,
            height: h,
            thickness: t,
            inner: wallMaterial(a, 'south', h, len),
            outer: wallMaterial(b, 'north', h, len),
            openings: openings.map((o) => ({ ...o, at: o.at - la[0] })),
          });
          run.position.x = la[0];
          frameFor(a, 'south').add(run);
        }
      }
    }
  }

  // --- Remaining exterior walls -------------------------------------------
  for (const room of spec.rooms) {
    const h = roomHeight(room);
    for (const side of ['north', 'south', 'east', 'west'] as const) {
      const len = side === 'north' || side === 'south' ? room.size[0] : room.size[1];
      const used = consumed.get(key(room.id, side)) ?? [];
      for (const [a, b] of subtractIntervals([0, len], used)) {
        const openings = openingsOn(room, side)
          .map((op) => toWallOpening(room, side, op))
          .filter((o) => o.at >= a - EPS && o.at <= b + EPS)
          .map((o) => ({ ...o, at: o.at - a }));
        const run = buildWallRun({
          length: b - a,
          height: h,
          thickness: t,
          inner: wallMaterial(room, side, h, b - a),
          outer: materialFor(FACADE, [b - a, h]),
          openings,
        });
        run.position.x = a;
        frameFor(room, side).add(run);
      }
    }
  }
  void byId;

  // Exterior ground slab under the whole plan so nothing floats.
  if (bounds) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(bounds.x1 - bounds.x0 + 1, 0.3, bounds.z1 - bounds.z0 + 1),
      solid('#b9b5ad', 0.9),
    );
    slab.position.set((bounds.x0 + bounds.x1) / 2, -0.15 - 0.001, (bounds.z0 + bounds.z1) / 2);
    slab.receiveShadow = true;
    group.add(slab);
    // Roof so sunlight is only admitted through windows.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(bounds.x1 - bounds.x0, 0.25, bounds.z1 - bounds.z0),
      solid('#9d9891', 0.9),
    );
    // Sits 2 cm above the ceiling planes so the two never z-fight.
    roof.position.set((bounds.x0 + bounds.x1) / 2, H + 0.145, (bounds.z0 + bounds.z1) / 2);
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);
  }

  const b = bounds ?? { x0: -5, z0: -5, x1: 5, z1: 5 };
  const centre = new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);

  return {
    spec,
    group,
    rooms,
    order,
    walkable,
    floors,
    hotspots,
    doors,
    bounds: b,
    centre,
    roomHeight: H,
    eyeHeight: spec.eyeHeight ?? 1.6,
    wallThickness: t,
    update(_dt, time) {
      for (const s of hotspots) {
        const base = s.userData['baseY'] as number;
        s.position.y = base + Math.sin(time * 2 + s.position.x) * 0.03;
      }
    },
  };
}
