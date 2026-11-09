import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  fov?: number;
}

/**
 * Owns the renderer, scene, camera and the frame loop. Everything else
 * (controls, UI, tour) registers an update callback.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly timer = new THREE.Timer();
  private updaters = new Set<(dt: number, t: number) => void>();
  private running = false;

  constructor(opts: EngineOptions) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 70, 1, 0.05, 300);
    this.scene.add(this.camera);

    // A neutral studio environment so metals, glass and glossy tiles have
    // something to reflect. Kept dim: the room lights do the real work.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  onUpdate(fn: (dt: number, t: number) => void) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.renderer.setAnimationLoop(this.frame);
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private frame = () => {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const t = this.timer.getElapsed();
    for (const fn of this.updaters) fn(dt, t);
    this.renderer.render(this.scene, this.camera);
  };

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
