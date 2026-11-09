import * as THREE from 'three';

/**
 * Touch joystick anchored where the finger lands on the left part of the
 * screen. Writes a normalised vector that WalkControls reads each frame.
 */
export class Joystick {
  readonly el: HTMLDivElement;
  readonly value = new THREE.Vector2();
  private knob: HTMLDivElement;
  private pointerId: number | null = null;
  private origin = new THREE.Vector2();
  private radius = 48;

  constructor(parent: HTMLElement, private target: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'joystick';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.el.appendChild(this.knob);
    parent.appendChild(this.el);

    target.addEventListener('pointerdown', this.onDown, { passive: false });
    target.addEventListener('pointermove', this.onMove, { passive: false });
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointercancel', this.onUp);
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    if (e.clientX >= window.innerWidth * 0.45) return;
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.origin.set(e.clientX, e.clientY);
    this.el.style.left = `${e.clientX}px`;
    this.el.style.top = `${e.clientY}px`;
    this.el.classList.add('active');
    this.knob.style.transform = 'translate(0px, 0px)';
    e.preventDefault();
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    const dx = e.clientX - this.origin.x;
    const dy = e.clientY - this.origin.y;
    const len = Math.hypot(dx, dy);
    const k = len > this.radius ? this.radius / len : 1;
    const kx = dx * k;
    const ky = dy * k;
    this.knob.style.transform = `translate(${kx}px, ${ky}px)`;
    this.value.set(kx / this.radius, -ky / this.radius);
    e.preventDefault();
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.value.set(0, 0);
    this.el.classList.remove('active');
  };

  dispose() {
    this.target.removeEventListener('pointerdown', this.onDown);
    this.target.removeEventListener('pointermove', this.onMove);
    this.target.removeEventListener('pointerup', this.onUp);
    this.target.removeEventListener('pointercancel', this.onUp);
    this.el.remove();
  }
}
