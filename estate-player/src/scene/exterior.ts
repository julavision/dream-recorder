import * as THREE from 'three';
import type { ExteriorSpec } from '../spec/types';

/**
 * What the player sees through the windows: a gradient sky dome, a ground
 * plane, sunlight, and a simple procedural skyline or garden. Kept cheap so
 * the interior gets the GPU budget.
 */
export interface Exterior {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  setNight(night: boolean): void;
}

function skyDome(top: string, bottom: string): THREE.Mesh {
  const geo = new THREE.SphereGeometry(200, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      bottom: { value: new THREE.Color(bottom) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
      void main() {
        float h = clamp(normalize(vPos).y * 1.4 + 0.25, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  return mesh;
}

function skyline(rand: () => number, centre: THREE.Vector3, radius: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.9 });
  const litMat = new THREE.MeshStandardMaterial({ color: 0xbfc6cf, roughness: 0.9 });
  const count = 70;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius * (0.6 + rand() * 0.6);
    const w = 6 + rand() * 14;
    const d = 6 + rand() * 14;
    const h = 10 + rand() * 60;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rand() > 0.5 ? mat : litMat);
    m.position.set(centre.x + Math.cos(a) * r, h / 2 - 0.5, centre.z + Math.sin(a) * r);
    m.rotation.y = rand() * Math.PI;
    g.add(m);
  }
  return g;
}

function garden(rand: () => number, centre: THREE.Vector3, radius: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x4f7d3a, roughness: 1 });
  for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius * (0.4 + rand() * 0.8);
    const s = 0.7 + rand() * 1.2;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 2.5 * s, 6), trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.6 * s, 10, 8), leaves);
    t.position.set(centre.x + Math.cos(a) * r, 1.25 * s - 0.5, centre.z + Math.sin(a) * r);
    crown.position.copy(t.position).add(new THREE.Vector3(0, 2 * s, 0));
    g.add(t, crown);
  }
  return g;
}

export function buildExterior(spec: ExteriorSpec | undefined, centre: THREE.Vector3): Exterior {
  const kind = spec?.kind ?? 'city';
  const group = new THREE.Group();
  group.name = 'exterior';

  const dayTop = spec?.skyTop ?? '#6fa8dc';
  const dayBottom = spec?.skyBottom ?? '#dfe9f3';
  const sky = skyDome(dayTop, dayBottom);
  sky.position.copy(centre);
  group.add(sky);

  const groundColor = kind === 'sea' ? 0x3a6f8f : kind === 'garden' ? 0x5c8a45 : 0x8d9299;
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(190, 48),
    new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centre.x, -0.6, centre.z);
  ground.receiveShadow = true;
  group.add(ground);

  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (kind === 'city') group.add(skyline(rand, centre, 90));
  if (kind === 'garden') group.add(garden(rand, centre, 40));

  const az = THREE.MathUtils.degToRad(spec?.sunAzimuth ?? 210);
  const el = THREE.MathUtils.degToRad(spec?.sunElevation ?? 42);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(
    centre.x + Math.cos(el) * Math.sin(az) * 40,
    Math.sin(el) * 40,
    centre.z + Math.cos(el) * Math.cos(az) * 40,
  );
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  const cam = sun.shadow.camera;
  cam.left = -25;
  cam.right = 25;
  cam.top = 25;
  cam.bottom = -25;
  cam.near = 1;
  cam.far = 120;
  group.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xdbe8f5, 0xa39f99, 0.8);
  group.add(hemi);

  const skyMat = sky.material as THREE.ShaderMaterial;
  const setNight = (night: boolean) => {
    const topU = skyMat.uniforms['top'];
    const bottomU = skyMat.uniforms['bottom'];
    if (!topU || !bottomU) return;
    if (night) {
      (topU.value as THREE.Color).set('#0b1430');
      (bottomU.value as THREE.Color).set('#2a3350');
      sun.intensity = 0.25;
      sun.color.set('#a9b8ff');
      hemi.intensity = 0.25;
    } else {
      (topU.value as THREE.Color).set(dayTop);
      (bottomU.value as THREE.Color).set(dayBottom);
      sun.intensity = 2.6;
      sun.color.set('#fff1dc');
      hemi.intensity = 0.9;
    }
  };

  return { group, sun, hemi, setNight };
}
