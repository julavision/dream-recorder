import * as THREE from 'three';
import type { OpeningSpec } from '../spec/types';
import { solid } from '../engine/materials';

/**
 * Wall pieces. A wall run is described in a local frame where the wall
 * extends along +X from 0 to `length`, stands on y=0, and has its "inner"
 * face toward -Z. The caller positions and rotates the group into the world.
 */

export interface WallOpening {
  type: OpeningSpec['type'];
  /** Centre along the run, metres. */
  at: number;
  width: number;
  height: number;
  sill: number;
  leaf?: boolean;
  /** Hinge side for a door leaf, relative to the run. */
  hinge?: 'start' | 'end';
  /** Which side of the wall the leaf swings toward. Inner is the run's -Z face. */
  swing?: 'inner' | 'outer';
}

export interface WallRunOptions {
  length: number;
  height: number;
  thickness: number;
  inner: THREE.Material;
  outer: THREE.Material;
  openings: WallOpening[];
  /** Draw a baseboard along the inner face. */
  baseboard?: boolean;
  trimColor?: string;
}

const BASEBOARD_H = 0.1;
const BASEBOARD_T = 0.014;

function block(w: number, h: number, d: number, inner: THREE.Material, outer: THREE.Material, side: THREE.Material): THREE.Mesh {
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z. Inner face is -z.
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, outer, inner]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWallRun(o: WallRunOptions): THREE.Group {
  const g = new THREE.Group();
  const t = o.thickness;
  const trim = solid(o.trimColor ?? '#f4f2ee', 0.6);
  const reveal = trim;

  const openings = [...o.openings].sort((a, b) => a.at - b.at);
  let cursor = 0;
  const segments: Array<[number, number]> = [];

  const addFull = (x0: number, x1: number) => {
    const w = x1 - x0;
    if (w <= 0.001) return;
    const m = block(w, o.height, t, o.inner, o.outer, reveal);
    m.position.set(x0 + w / 2, o.height / 2, t / 2);
    g.add(m);
    segments.push([x0, x1]);
  };

  for (const op of openings) {
    const x0 = Math.max(cursor, op.at - op.width / 2);
    const x1 = Math.min(o.length, op.at + op.width / 2);
    if (x1 <= x0) continue;
    addFull(cursor, x0);
    const w = x1 - x0;
    const sill = op.type === 'window' ? Math.max(op.sill, 0.05) : op.sill;
    if (sill > 0.001) {
      const m = block(w, sill, t, o.inner, o.outer, reveal);
      m.position.set(x0 + w / 2, sill / 2, t / 2);
      g.add(m);
    }
    const top = sill + op.height;
    if (top < o.height - 0.001) {
      const h = o.height - top;
      const m = block(w, h, t, o.inner, o.outer, reveal);
      m.position.set(x0 + w / 2, top + h / 2, t / 2);
      g.add(m);
    }
    if (op.type === 'window') {
      const frame = solid('#f7f7f7', 0.5);
      const fw = 0.05;
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(w - fw * 2, op.height - fw * 2),
        new THREE.MeshPhysicalMaterial({
          color: 0xdfeeff,
          roughness: 0.02,
          metalness: 0,
          transmission: 0.92,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      glass.position.set(x0 + w / 2, sill + op.height / 2, t / 2);
      g.add(glass);
      const frameGroup = new THREE.Group();
      const mk = (fx: number, fy: number, fw2: number, fh: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(fw2, fh, t * 0.6), frame);
        m.position.set(fx, fy, t / 2);
        m.castShadow = true;
        frameGroup.add(m);
      };
      mk(x0 + w / 2, sill + fw / 2, w, fw);
      mk(x0 + w / 2, sill + op.height - fw / 2, w, fw);
      mk(x0 + fw / 2, sill + op.height / 2, fw, op.height);
      mk(x1 - fw / 2, sill + op.height / 2, fw, op.height);
      if (w > 1.3) mk(x0 + w / 2, sill + op.height / 2, fw * 0.7, op.height);
      g.add(frameGroup);
      // Interior sill ledge.
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.03, 0.12), frame);
      ledge.position.set(x0 + w / 2, sill - 0.015, -0.03);
      ledge.castShadow = true;
      g.add(ledge);
    }
    if (op.type === 'door') {
      const jamb = solid('#f7f7f7', 0.5);
      const jw = 0.06;
      const mk = (fx: number, fy: number, fw2: number, fh: number, z: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(fw2, fh, 0.02), jamb);
        m.position.set(fx, fy, z);
        m.castShadow = true;
        g.add(m);
      };
      for (const z of [-0.01, t + 0.01]) {
        mk(x0 + jw / 2 - 0.02, op.height / 2, jw, op.height + jw, z);
        mk(x1 - jw / 2 + 0.02, op.height / 2, jw, op.height + jw, z);
        mk(x0 + w / 2, op.height + jw / 2, w + jw, jw, z);
      }
      if (op.leaf) {
        const leafMat = solid('#f0eeea', 0.5);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, op.height - 0.02, 0.04), leafMat);
        leaf.castShadow = true;
        const pivot = new THREE.Group();
        const hingeAtStart = (op.hinge ?? 'start') === 'start';
        pivot.position.set(hingeAtStart ? x0 + 0.01 : x1 - 0.01, 0, t / 2);
        leaf.position.set(hingeAtStart ? (w - 0.02) / 2 : -(w - 0.02) / 2, (op.height - 0.02) / 2, 0);
        pivot.add(leaf);
        const towardInner = (op.swing ?? 'inner') === 'inner';
        pivot.rotation.y = (hingeAtStart ? 1 : -1) * (towardInner ? 1 : -1) * THREE.MathUtils.degToRad(100);
        // Handle.
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), solid('#9a9a9a', 0.4, 0.8));
        handle.position.set(hingeAtStart ? w - 0.12 : -(w - 0.12), 1.0, -0.04);
        pivot.add(handle);
        g.add(pivot);
      }
    }
    cursor = x1;
  }
  addFull(cursor, o.length);

  if (o.baseboard !== false) {
    for (const [x0, x1] of segments) {
      const w = x1 - x0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, BASEBOARD_H, BASEBOARD_T), trim);
      m.position.set(x0 + w / 2, BASEBOARD_H / 2, -BASEBOARD_T / 2);
      m.receiveShadow = true;
      g.add(m);
    }
    // Baseboards also continue under windows.
    for (const op of openings) {
      if (op.type !== 'window') continue;
      const x0 = Math.max(0, op.at - op.width / 2);
      const x1 = Math.min(o.length, op.at + op.width / 2);
      const w = x1 - x0;
      if (w <= 0) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, BASEBOARD_H, BASEBOARD_T), trim);
      m.position.set(x0 + w / 2, BASEBOARD_H / 2, -BASEBOARD_T / 2);
      g.add(m);
    }
  }

  return g;
}
