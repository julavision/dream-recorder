/**
 * Tour specification.
 *
 * A tour is a set of rooms laid out on a shared XZ plane (Y is up, metres).
 * Rooms are axis-aligned boxes. Openings (doors, windows, passages) are cut
 * into walls. Furniture is placed by referencing a procedural factory by name.
 *
 * Everything is code-only: no mesh downloads. The spec is what an agent running
 * the img2threejs skill writes after looking at a handful of listing photos.
 */

export type Vec2 = [x: number, z: number];
export type Vec3 = [x: number, y: number, z: number];

export type WallSide = 'north' | 'south' | 'east' | 'west';

export interface MaterialSpec {
  /** Procedural texture generator to use. */
  kind: 'plaster' | 'paint' | 'wood' | 'tile' | 'concrete' | 'fabric' | 'marble' | 'glass' | 'metal' | 'flat';
  /** Base colour as a CSS hex string, usually sampled from a photo. */
  color: string;
  /** Optional accent colour for grout, grain, veins, etc. */
  accent?: string;
  roughness?: number;
  metalness?: number;
  /** Texture repeat in metres per tile. */
  scale?: number;
}

export interface OpeningSpec {
  /** Door opening a person can walk through, window with glass, or a passage (no frame). */
  type: 'door' | 'window' | 'passage';
  wall: WallSide;
  /**
   * Centre offset along the wall in metres, measured from the wall's start:
   * the west end for north/south walls, the north end for east/west walls
   * (i.e. from the left / top on a north-up floor plan).
   */
  at: number;
  width: number;
  height: number;
  /** Bottom of the opening above the floor, metres. Doors default to 0, windows to 0.9. */
  sill?: number;
  /** Door only: render a swung-open door leaf. */
  leaf?: boolean;
}

export interface FurnitureSpec {
  /** Name of a factory in src/scene/furniture.ts. */
  kind: string;
  /** Position relative to the room origin (south-west corner), metres. */
  at: Vec2;
  /**
   * Rotation in degrees, counter-clockwise on a north-up plan.
   * 0 faces south (+Z), 90 faces east, 180 faces north, 270 faces west.
   */
  rotation?: number;
  /** Optional overrides the factory understands (colours, sizes). */
  options?: Record<string, unknown>;
}

export interface HotspotSpec {
  id: string;
  title: string;
  body?: string;
  /** Position relative to room origin, metres. */
  at: Vec3;
  /** Optional reference photo URL to show alongside the reconstruction. */
  photo?: string;
}

export interface RoomSpec {
  id: string;
  name: string;
  /** South-west corner of the room in world XZ. */
  origin: Vec2;
  /** Interior width (X) and depth (Z). */
  size: Vec2;
  height?: number;
  floor: MaterialSpec;
  walls: MaterialSpec;
  ceiling?: MaterialSpec;
  /** Per-wall override, e.g. an accent wall. */
  wallOverrides?: Partial<Record<WallSide, MaterialSpec>>;
  openings?: OpeningSpec[];
  furniture?: FurnitureSpec[];
  hotspots?: HotspotSpec[];
  /** Where the player lands when teleporting into this room (relative). Defaults to the centre. */
  entry?: Vec2;
  /** Heading in degrees when teleporting in. 0 looks toward -Z (north). */
  entryHeading?: number;
  /** Ceiling light fixtures (relative XZ). */
  lights?: Vec2[];
  /** Shown in the HUD. */
  area?: number;
  /** Reference photo this room was rebuilt from. */
  photo?: string;
}

export interface ExteriorSpec {
  /** What is seen through windows. */
  kind: 'city' | 'garden' | 'sea' | 'none';
  skyTop?: string;
  skyBottom?: string;
  sunAzimuth?: number;
  sunElevation?: number;
}

export interface TourSpec {
  version: 1;
  title: string;
  subtitle?: string;
  /** Default wall thickness, metres. */
  wallThickness?: number;
  /** Default room height, metres. */
  roomHeight?: number;
  /** Player eye height, metres. */
  eyeHeight?: number;
  exterior?: ExteriorSpec;
  /** Room to start in. Defaults to the first room. */
  start?: string;
  rooms: RoomSpec[];
  /** Credits shown in the HUD footer. */
  credits?: string;
}
