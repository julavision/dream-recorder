import * as THREE from 'three';
import type { Walkable } from './collision';

export interface WalkControlsOptions {
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  walkable: Walkable;
  eyeHeight: number;
  radius?: number;
  walkSpeed?: number;
  runSpeed?: number;
  lookSpeed?: number;
}

/**
 * First-person walking: pointer-lock mouse look (or drag-look when lock is
 * unavailable), WASD / arrows, Shift to run, touch look on the right half of
 * the screen, an external joystick vector for touch movement, and animated
 * teleports used by room buttons, the minimap and click-to-walk.
 */
export class WalkControls {
  readonly camera: THREE.PerspectiveCamera;
  readonly dom: HTMLElement;
  readonly walkable: Walkable;
  radius: number;
  walkSpeed: number;
  runSpeed: number;
  lookSpeed: number;
  eyeHeight: number;
  enabled = true;

  yaw = 0;
  pitch = 0;
  position = new THREE.Vector3();
  /** External movement input (joystick), x = strafe, y = forward, each in [-1, 1]. */
  joystick = new THREE.Vector2();

  private keys = new Set<string>();
  private velocity = new THREE.Vector2();
  private dragging = false;
  private dragId: number | null = null;
  private last = new THREE.Vector2();
  private dragMoved = 0;
  private locked = false;
  private teleport: { from: THREE.Vector3; to: THREE.Vector3; yawFrom: number; yawTo: number; t: number; duration: number } | null = null;
  private bob = 0;
  private listeners: Array<() => void> = [];
  onTap: ((ndc: THREE.Vector2) => void) | null = null;

  constructor(o: WalkControlsOptions) {
    this.camera = o.camera;
    this.dom = o.dom;
    this.walkable = o.walkable;
    this.eyeHeight = o.eyeHeight;
    this.radius = o.radius ?? 0.28;
    this.walkSpeed = o.walkSpeed ?? 1.7;
    this.runSpeed = o.runSpeed ?? 3.2;
    this.lookSpeed = o.lookSpeed ?? 0.0022;
    this.camera.rotation.order = 'YXZ';
    this.bind();
  }

  get isLocked() {
    return this.locked;
  }

  /** Places the player instantly. Heading in degrees, 0 = looking north (-Z). */
  place(x: number, z: number, headingDeg: number) {
    this.position.set(x, this.eyeHeight, z);
    this.yaw = THREE.MathUtils.degToRad(-headingDeg);
    this.pitch = 0;
    this.teleport = null;
    this.apply();
  }

  /** Smoothly moves the player to a point, optionally turning to a heading. */
  teleportTo(x: number, z: number, headingDeg?: number, duration = 0.8) {
    const yawTo = headingDeg === undefined ? this.yaw : THREE.MathUtils.degToRad(-headingDeg);
    // Shortest rotation.
    let delta = yawTo - this.yaw;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.teleport = {
      from: this.position.clone(),
      to: new THREE.Vector3(x, this.eyeHeight, z),
      yawFrom: this.yaw,
      yawTo: this.yaw + delta,
      t: 0,
      duration,
    };
  }

  requestLock() {
    if (!('requestPointerLock' in this.dom)) return;
    try {
      const p = this.dom.requestPointerLock() as unknown;
      if (p instanceof Promise) p.catch(() => undefined);
    } catch {
      /* pointer lock unavailable, drag-look still works */
    }
  }

  exitLock() {
    if (document.pointerLockElement === this.dom) document.exitPointerLock();
  }

  private bind() {
    const on = <K extends keyof DocumentEventMap>(target: Document, type: K, fn: (e: DocumentEventMap[K]) => void) => {
      target.addEventListener(type, fn);
      this.listeners.push(() => target.removeEventListener(type, fn));
    };
    const onEl = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      this.dom.addEventListener(type, fn, opts);
      this.listeners.push(() => this.dom.removeEventListener(type, fn));
    };

    on(document, 'keydown', (e) => {
      if (!this.enabled) return;
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    on(document, 'keyup', (e) => this.keys.delete(e.code));
    on(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    on(document, 'mousemove', (e) => {
      if (!this.enabled || !this.locked) return;
      // Chrome can deliver one huge delta when the lock engages; drop it.
      if (Math.abs(e.movementX) > 150 || Math.abs(e.movementY) > 150) return;
      this.look(e.movementX, e.movementY);
    });
    onEl('dblclick', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      if (this.locked) this.exitLock();
      else this.requestLock();
    });

    onEl('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Touch: only the right half of the screen looks; the left half is the joystick.
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45) return;
      if (this.dragId !== null) return;
      this.dragging = true;
      this.dragId = e.pointerId;
      this.dragMoved = 0;
      this.last.set(e.clientX, e.clientY);
      this.dom.setPointerCapture(e.pointerId);
    });
    onEl('pointermove', (e) => {
      if (!this.dragging || e.pointerId !== this.dragId) return;
      const dx = e.clientX - this.last.x;
      const dy = e.clientY - this.last.y;
      this.last.set(e.clientX, e.clientY);
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      if (this.locked) return;
      // Dragging grabs the scene: drag right to look left, like a street-view panorama.
      const k = e.pointerType === 'touch' ? 2.2 : 1.6;
      this.look(-dx * k, -dy * k);
    });
    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== this.dragId) return;
      this.dragging = false;
      this.dragId = null;
      if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
      if (this.dragMoved < 6 && this.onTap) {
        const ndc = this.locked
          ? new THREE.Vector2(0, 0)
          : new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
        this.onTap(ndc);
      }
    };
    onEl('pointerup', endDrag);
    onEl('pointercancel', endDrag);
    onEl('contextmenu', (e) => e.preventDefault());
  }

  private look(dx: number, dy: number) {
    this.yaw -= dx * this.lookSpeed;
    this.pitch -= dy * this.lookSpeed;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  private apply() {
    this.camera.position.copy(this.position);
    this.camera.position.y += Math.sin(this.bob) * 0.012;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  update(dt: number) {
    if (this.teleport) {
      const tp = this.teleport;
      tp.t = Math.min(tp.duration, tp.t + dt);
      const k = tp.t / tp.duration;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.position.lerpVectors(tp.from, tp.to, e);
      this.yaw = THREE.MathUtils.lerp(tp.yawFrom, tp.yawTo, e);
      if (tp.t >= tp.duration) this.teleport = null;
      this.apply();
      return;
    }
    if (!this.enabled) {
      this.apply();
      return;
    }

    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafe = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    let ix = strafe + this.joystick.x;
    let iy = forward + this.joystick.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    const speed = run ? this.runSpeed : this.walkSpeed;
    const target = new THREE.Vector2(ix * speed, iy * speed);
    // Smooth acceleration for a camera-dolly feel rather than a game feel.
    const accel = len > 0.01 ? 10 : 14;
    this.velocity.lerp(target, 1 - Math.exp(-accel * dt));

    if (this.velocity.lengthSq() > 1e-6) {
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // Camera looks down -Z at yaw 0; forward vector is (-sin, -cos) in XZ.
      const dx = (-sin * this.velocity.y + cos * this.velocity.x) * dt;
      const dz = (-cos * this.velocity.y - sin * this.velocity.x) * dt;
      const [nx, nz] = this.walkable.move(this.position.x, this.position.z, dx, dz, this.radius);
      const moved = Math.hypot(nx - this.position.x, nz - this.position.z);
      this.position.x = nx;
      this.position.z = nz;
      this.bob += moved * 7;
    } else {
      this.bob = THREE.MathUtils.lerp(this.bob, Math.round(this.bob / Math.PI) * Math.PI, 1 - Math.exp(-8 * dt));
    }
    this.apply();
  }

  dispose() {
    for (const off of this.listeners) off();
    this.listeners = [];
  }
}
