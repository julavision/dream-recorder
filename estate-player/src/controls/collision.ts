/**
 * Walkable-area model: a union of axis-aligned rectangles (room floors and
 * doorway slabs) minus a set of blocker rectangles (furniture footprints).
 * The player is a disc; a position is valid when every sample point around
 * the disc is inside some walkable rect and outside every blocker.
 */

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Room id this rect belongs to, if any. */
  room?: string;
}

const EPS = 1e-4;

export function rectContains(r: Rect, x: number, z: number): boolean {
  return x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS;
}

export class Walkable {
  readonly rects: Rect[] = [];
  readonly blockers: Rect[] = [];

  addRect(r: Rect) {
    this.rects.push(r);
  }

  addBlocker(r: Rect) {
    this.blockers.push(r);
  }

  pointOk(x: number, z: number): boolean {
    let inside = false;
    for (const r of this.rects) {
      if (rectContains(r, x, z)) {
        inside = true;
        break;
      }
    }
    if (!inside) return false;
    for (const b of this.blockers) {
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
    }
    return true;
  }

  /** Disc test with 8 perimeter samples plus the centre. */
  discOk(x: number, z: number, radius: number): boolean {
    if (!this.pointOk(x, z)) return false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (!this.pointOk(x + Math.cos(a) * radius, z + Math.sin(a) * radius)) return false;
    }
    return true;
  }

  /** Which room rect contains the point, if any. */
  roomAt(x: number, z: number): string | undefined {
    for (const r of this.rects) {
      if (r.room && rectContains(r, x, z)) return r.room;
    }
    return undefined;
  }

  /**
   * Attempts to move from (x,z) by (dx,dz). Slides along walls by trying the
   * full step, then each axis on its own. Returns the resulting position.
   */
  move(x: number, z: number, dx: number, dz: number, radius: number): [number, number] {
    if (this.discOk(x + dx, z + dz, radius)) return [x + dx, z + dz];
    if (this.discOk(x + dx, z, radius)) return [x + dx, z];
    if (this.discOk(x, z + dz, radius)) return [x, z + dz];
    return [x, z];
  }

  /** Nearest valid point to a target, searched on a small ring; used for click-to-walk. */
  nearest(x: number, z: number, radius: number): [number, number] | undefined {
    if (this.discOk(x, z, radius)) return [x, z];
    for (let r = 0.1; r <= 1.2; r += 0.1) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (this.discOk(px, pz, radius)) return [px, pz];
      }
    }
    return undefined;
  }
}
