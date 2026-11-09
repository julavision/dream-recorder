import * as THREE from 'three';
import './ui/styles.css';
import type { HotspotSpec, TourSpec } from './spec/types';
import { Engine } from './engine/Engine';
import { buildTour } from './scene/buildTour';
import { buildExterior } from './scene/exterior';
import { WalkControls } from './controls/WalkControls';
import { Hud, isTouch } from './ui/Hud';
import { Minimap } from './ui/Minimap';
import { Joystick } from './ui/Joystick';

const canvasEl = document.getElementById('view') as HTMLCanvasElement | null;
const hudEl = document.getElementById('hud');
if (!canvasEl || !hudEl) throw new Error('Missing #view canvas or #hud element');
const canvas: HTMLCanvasElement = canvasEl;
const hudRoot: HTMLElement = hudEl;

function showError(message: string) {
  hudRoot.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'hud-error';
  box.innerHTML = message;
  hudRoot.appendChild(box);
}

async function loadSpec(): Promise<TourSpec> {
  const params = new URLSearchParams(location.search);
  const url = params.get('tour') ?? 'tours/demo/tour.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load tour <code>${url}</code> (${res.status})`);
  const spec = (await res.json()) as TourSpec;
  if (spec.version !== 1 || !Array.isArray(spec.rooms) || spec.rooms.length === 0) {
    throw new Error(`Tour <code>${url}</code> is not a valid v1 tour spec`);
  }
  return spec;
}

async function main() {
  const spec = await loadSpec();
  const engine = new Engine({ canvas, fov: 72 });
  const tour = buildTour(spec);
  engine.scene.add(tour.group);
  const exterior = buildExterior(spec.exterior, tour.centre);
  engine.scene.add(exterior.group);

  const controls = new WalkControls({
    camera: engine.camera,
    dom: canvas,
    walkable: tour.walkable,
    eyeHeight: tour.eyeHeight,
  });
  controls.enabled = false;

  const startId = spec.start && tour.rooms.has(spec.start) ? spec.start : tour.order[0];
  const startRoom = startId ? tour.rooms.get(startId) : undefined;
  if (startRoom) controls.place(startRoom.entry[0], startRoom.entry[1], startRoom.heading);

  const goToRoom = (id: string) => {
    const r = tour.rooms.get(id);
    if (!r) return;
    hud.hideCard();
    controls.teleportTo(r.entry[0], r.entry[1], r.heading, 0.9);
  };

  const hud = new Hud(hudRoot, tour, {
    onRoom: goToRoom,
    onToggleNight: (night) => exterior.setNight(night),
    onEnter: () => {
      hud.hideStart();
      controls.enabled = true;
    },
  });
  hud.setRoom(startId, tour);

  const minimap = new Minimap(hud.mapSlot, tour);
  minimap.onRoomClick = (_id, x, z) => {
    const p = tour.walkable.nearest(x, z, controls.radius);
    if (!p) return;
    hud.hideCard();
    const dist = Math.hypot(p[0] - controls.position.x, p[1] - controls.position.z);
    controls.teleportTo(p[0], p[1], undefined, Math.min(1.4, 0.4 + dist * 0.12));
  };

  if (isTouch()) {
    const joy = new Joystick(hudRoot, canvas);
    controls.joystick = joy.value;
  }

  // Picking: hotspots first, then the floor for click-to-walk.
  const raycaster = new THREE.Raycaster();
  const pick = (ndc: THREE.Vector2): { hotspot?: HotspotSpec; floor?: THREE.Vector3 } => {
    raycaster.setFromCamera(ndc, engine.camera);
    const hs = raycaster.intersectObjects(tour.hotspots, false)[0];
    if (hs) return { hotspot: hs.object.userData['hotspot'] as HotspotSpec };
    const fl = raycaster.intersectObjects(tour.floors, false)[0];
    if (fl) return { floor: fl.point };
    return {};
  };

  controls.onTap = (ndc) => {
    if (hud.startVisible) return;
    const hit = pick(ndc);
    if (hit.hotspot) {
      hud.showHotspot(hit.hotspot);
      return;
    }
    if (hud.cardOpen) {
      hud.hideCard();
      return;
    }
    if (hit.floor) {
      const p = tour.walkable.nearest(hit.floor.x, hit.floor.z, controls.radius);
      if (!p) return;
      const dist = Math.hypot(p[0] - controls.position.x, p[1] - controls.position.z);
      if (dist < 0.3) return;
      controls.teleportTo(p[0], p[1], undefined, Math.min(1.6, 0.35 + dist * 0.18));
    }
  };

  // Hover hints.
  const mouse = new THREE.Vector2(0, 0);
  let hasMouse = false;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    hasMouse = true;
    mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && hud.cardOpen) hud.hideCard();
  });

  let currentRoom = startId;
  let hintTimer = 0;
  engine.onUpdate((dt, t) => {
    controls.update(dt);
    tour.update(dt, t);
    const room = tour.walkable.roomAt(controls.position.x, controls.position.z);
    if (room !== currentRoom) {
      currentRoom = room;
      hud.setRoom(room, tour);
    }
    minimap.draw(controls.position.x, controls.position.z, controls.yaw, currentRoom);

    hintTimer += dt;
    if (hintTimer > 0.08 && !hud.startVisible) {
      hintTimer = 0;
      const ndc = controls.isLocked || !hasMouse ? new THREE.Vector2(0, 0) : mouse;
      const hit = pick(ndc);
      if (hit.hotspot) {
        hud.setHint(`${hit.hotspot.title} · click for details`);
        canvas.style.cursor = 'pointer';
      } else {
        hud.setHint(controls.isLocked ? 'Mouse look · Esc or double-click to release' : '');
        canvas.style.cursor = controls.isLocked ? 'none' : 'crosshair';
      }
    }
  });

  engine.start();
  // Expose for debugging and for agents iterating on a tour spec.
  (window as unknown as { estatePlayer: unknown }).estatePlayer = { engine, tour, controls, exterior, spec };
}

main().catch((err: unknown) => {
  console.error(err);
  showError(err instanceof Error ? err.message : String(err));
});
