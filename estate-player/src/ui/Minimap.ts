import type { BuiltTour } from '../scene/buildTour';

/**
 * Top-down floor plan drawn from the tour spec. Shows rooms, doorways,
 * furniture footprints, hotspots and the player's position and heading.
 * Clicking a room teleports the player there.
 */
export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offX = 0;
  private offZ = 0;
  private size = 190;
  onRoomClick: ((roomId: string, x: number, z: number) => void) | null = null;

  constructor(parent: HTMLElement, private tour: BuiltTour) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    parent.appendChild(this.canvas);
    this.layout();
    window.addEventListener('resize', this.layout);
    this.canvas.addEventListener('click', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * (this.canvas.width / r.width);
      const pz = (e.clientY - r.top) * (this.canvas.height / r.height);
      const x = (px - this.offX) / this.scale;
      const z = (pz - this.offZ) / this.scale;
      const room = this.tour.walkable.roomAt(x, z);
      if (room && this.onRoomClick) this.onRoomClick(room, x, z);
    });
  }

  private layout = () => {
    const small = window.innerWidth < 640;
    this.size = small ? 140 : 200;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const b = this.tour.bounds;
    const w = b.x1 - b.x0;
    const h = b.z1 - b.z0;
    const aspect = w / h;
    const cw = aspect >= 1 ? this.size : this.size * aspect;
    const ch = aspect >= 1 ? this.size / aspect : this.size;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    const pad = 6 * dpr;
    this.scale = Math.min((this.canvas.width - pad * 2) / w, (this.canvas.height - pad * 2) / h);
    this.offX = pad - b.x0 * this.scale;
    this.offZ = pad - b.z0 * this.scale;
  };

  draw(px: number, pz: number, yaw: number, currentRoom: string | undefined) {
    const c = this.ctx;
    const s = this.scale;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.save();
    c.translate(this.offX, this.offZ);

    const t = this.tour.wallThickness;
    for (const room of this.tour.rooms.values()) {
      const r = room.rect;
      c.fillStyle = room.spec.id === currentRoom ? 'rgba(120,170,255,0.55)' : 'rgba(255,255,255,0.28)';
      c.fillRect((r.x0 - t) * s, (r.z0 - t) * s, (r.x1 - r.x0 + 2 * t) * s, (r.z1 - r.z0 + 2 * t) * s);
    }
    for (const room of this.tour.rooms.values()) {
      const r = room.rect;
      c.fillStyle = room.spec.id === currentRoom ? 'rgba(30,40,60,0.85)' : 'rgba(20,24,30,0.8)';
      c.fillRect(r.x0 * s, r.z0 * s, (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
    }
    for (const d of this.tour.doors) {
      const r = d.rect;
      c.fillStyle = 'rgba(20,24,30,0.8)';
      c.fillRect(r.x0 * s, r.z0 * s, (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
    }
    c.fillStyle = 'rgba(255,255,255,0.14)';
    for (const b of this.tour.walkable.blockers) {
      c.fillRect(b.x0 * s, b.z0 * s, (b.x1 - b.x0) * s, (b.z1 - b.z0) * s);
    }
    for (const h of this.tour.hotspots) {
      c.beginPath();
      c.arc(h.position.x * s, h.position.z * s, 2.2 * (this.canvas.width / this.size / 2 + 0.5), 0, Math.PI * 2);
      c.fillStyle = '#ffd166';
      c.fill();
    }
    // Player: view cone and dot. Camera yaw 0 looks toward -Z.
    const dir = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const cone = 0.45;
    c.beginPath();
    c.moveTo(px * s, pz * s);
    c.lineTo((px + (dir.x * Math.cos(cone) - dir.z * Math.sin(cone)) * 1.8) * s, (pz + (dir.x * Math.sin(cone) + dir.z * Math.cos(cone)) * 1.8) * s);
    c.lineTo((px + (dir.x * Math.cos(-cone) - dir.z * Math.sin(-cone)) * 1.8) * s, (pz + (dir.x * Math.sin(-cone) + dir.z * Math.cos(-cone)) * 1.8) * s);
    c.closePath();
    c.fillStyle = 'rgba(120,170,255,0.35)';
    c.fill();
    c.beginPath();
    c.arc(px * s, pz * s, 0.22 * s + 2, 0, Math.PI * 2);
    c.fillStyle = '#78aaff';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#ffffff';
    c.stroke();
    c.restore();
  }

  dispose() {
    window.removeEventListener('resize', this.layout);
    this.canvas.remove();
  }
}
