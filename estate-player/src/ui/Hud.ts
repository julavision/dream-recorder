import type { BuiltTour } from '../scene/buildTour';
import type { HotspotSpec } from '../spec/types';

export interface HudCallbacks {
  onRoom(roomId: string): void;
  onToggleNight(night: boolean): void;
  onEnter(): void;
}

/**
 * DOM overlay: title, current room, room chips, info card for hotspots,
 * toolbar, and the start screen with controls help.
 */
export class Hud {
  readonly root: HTMLElement;
  readonly mapSlot: HTMLDivElement;
  private roomName: HTMLDivElement;
  private roomMeta: HTMLDivElement;
  private chips = new Map<string, HTMLButtonElement>();
  private card: HTMLDivElement;
  private start: HTMLDivElement;
  private hint: HTMLDivElement;
  private night = false;

  constructor(root: HTMLElement, tour: BuiltTour, cb: HudCallbacks) {
    this.root = root;
    root.innerHTML = '';

    const top = el('div', 'hud-top');
    const titleBox = el('div', 'hud-title');
    titleBox.appendChild(el('div', 'hud-h1', tour.spec.title));
    if (tour.spec.subtitle) titleBox.appendChild(el('div', 'hud-sub', tour.spec.subtitle));
    const roomBox = el('div', 'hud-room');
    this.roomName = el('div', 'hud-room-name', '');
    this.roomMeta = el('div', 'hud-room-meta', '');
    roomBox.append(this.roomName, this.roomMeta);
    top.append(titleBox, roomBox);

    const bottom = el('div', 'hud-bottom');
    const chips = el('div', 'hud-chips');
    for (const id of tour.order) {
      const r = tour.rooms.get(id);
      if (!r) continue;
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = r.spec.name;
      b.addEventListener('click', () => cb.onRoom(id));
      chips.appendChild(b);
      this.chips.set(id, b);
    }
    const right = el('div', 'hud-right');
    const tools = el('div', 'hud-tools');
    const nightBtn = button('Night', () => {
      this.night = !this.night;
      nightBtn.textContent = this.night ? 'Day' : 'Night';
      cb.onToggleNight(this.night);
    });
    const fsBtn = button('Fullscreen', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
    });
    tools.append(nightBtn, fsBtn);
    this.mapSlot = el('div', 'hud-map');
    right.append(tools, this.mapSlot);
    bottom.append(chips, right);

    this.card = el('div', 'hud-card hidden');
    this.hint = el('div', 'hud-hint', '');

    this.start = el('div', 'hud-start');
    const panel = el('div', 'hud-start-panel');
    panel.appendChild(el('div', 'hud-start-title', tour.spec.title));
    panel.appendChild(el('div', 'hud-start-sub', tour.spec.subtitle ?? 'Navigable 3D walkthrough'));
    const help = el('div', 'hud-help');
    help.innerHTML = isTouch()
      ? '<b>Left side</b> drag to walk · <b>Right side</b> drag to look · <b>Tap</b> the floor to walk there · <b>Tap</b> a marker for details'
      : '<b>Drag</b> to look around · <b>W A S D</b> or arrows to walk · <b>Shift</b> to run · <b>Click</b> the floor to walk there · <b>Click</b> a marker for details · <b>Double-click</b> for mouse-look (<b>Esc</b> to release)';
    panel.appendChild(help);
    const enter = button(isTouch() ? 'Tap to enter' : 'Click to enter', () => cb.onEnter());
    enter.className = 'btn-primary';
    panel.appendChild(enter);
    if (tour.spec.credits) panel.appendChild(el('div', 'hud-credits', tour.spec.credits));
    this.start.appendChild(panel);
    this.start.addEventListener('click', (e) => {
      if (e.target === this.start) cb.onEnter();
    });

    root.append(top, bottom, this.card, this.hint, this.start);
  }

  setRoom(id: string | undefined, tour: BuiltTour) {
    for (const [rid, chip] of this.chips) chip.classList.toggle('active', rid === id);
    const r = id ? tour.rooms.get(id) : undefined;
    if (!r) {
      this.roomName.textContent = '';
      this.roomMeta.textContent = '';
      return;
    }
    this.roomName.textContent = r.spec.name;
    const area = r.spec.area ?? Math.round(r.spec.size[0] * r.spec.size[1] * 10) / 10;
    this.roomMeta.textContent = `${area} m² · ${r.spec.size[0]} × ${r.spec.size[1]} m`;
  }

  showHotspot(h: HotspotSpec) {
    this.card.innerHTML = '';
    const close = button('×', () => this.hideCard());
    close.className = 'card-close';
    this.card.appendChild(close);
    this.card.appendChild(el('div', 'card-title', h.title));
    if (h.body) this.card.appendChild(el('div', 'card-body', h.body));
    if (h.photo) {
      const img = document.createElement('img');
      img.src = h.photo;
      img.alt = h.title;
      img.className = 'card-photo';
      this.card.appendChild(img);
      this.card.appendChild(el('div', 'card-caption', 'Reference photo'));
    }
    this.card.classList.remove('hidden');
  }

  hideCard() {
    this.card.classList.add('hidden');
  }

  get cardOpen() {
    return !this.card.classList.contains('hidden');
  }

  setHint(text: string) {
    this.hint.textContent = text;
    this.hint.classList.toggle('visible', text.length > 0);
  }

  hideStart() {
    this.start.classList.add('hidden');
  }

  showStart() {
    this.start.classList.remove('hidden');
  }

  get startVisible() {
    return !this.start.classList.contains('hidden');
  }
}

function el(tag: string, cls: string, text?: string): HTMLDivElement {
  const e = document.createElement(tag) as HTMLDivElement;
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = 'btn';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

export function isTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}
