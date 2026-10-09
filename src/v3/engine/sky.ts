import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  type PerspectiveCamera,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { hash } from "../../v2/scenes/rig";
import { HAZE, INK, SKY_HORIZON, SKY_TOP } from "./palette";

/**
 * The sky the city sits under, painted rather than simulated: a gradient
 * dome from a deep zenith blue to a pale hazy horizon with a warm glow
 * where the sun is, big cumulus clouds drifting slowly at the edge of the
 * world, and a few flocks of birds wheeling over the plaza. The dome
 * follows the camera, so it is always "infinitely" far away.
 */

export interface Sky {
  group: Group;
  update(time: number, dt: number, camera: PerspectiveCamera): void;
  dispose(): void;
}

export const SUN_DIR = new Vector3(-0.45, 0.62, 0.64).normalize();

/** A Ghibli cumulus: shaded lobes underneath, sunlit lobes on top. */
function cloudTexture(seed: number): CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const lobes = 7 + Math.floor(hash(seed) * 4);
  const pts = Array.from({ length: lobes }, (_, i) => {
    const t = i / (lobes - 1);
    const r = 40 + Math.sin(t * Math.PI) * 60 + hash(seed + i) * 25;
    return { x: 70 + t * (w - 140) + (hash(seed * 3 + i) - 0.5) * 30, y: h - 50 - r * 0.75, r };
  });
  const draw = (fill: string, dx: number, dy: number, k: number) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (const p of pts) {
      ctx.moveTo(p.x + dx + p.r * k, p.y + dy);
      ctx.arc(p.x + dx, p.y + dy, p.r * k, 0, Math.PI * 2);
    }
    // A flat base, the way cumulus sits on its condensation level.
    ctx.rect(70 + dx, h - 90 + dy, w - 140, 50);
    ctx.fill();
  };
  draw("#c3d6e6", 0, 0, 1); // shade
  draw("#e8f0f6", -6, -10, 0.93); // mid
  draw("#ffffff", -14, -22, 0.78); // sunlit tops
  // Cut the flat base clean.
  ctx.clearRect(0, h - 40, w, 40);
  const tex = new CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function wing(side: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([0, 0, 0.25, side * 1.1, 0, -0.15, 0, 0, -0.35], 3));
  g.computeVertexNormals();
  return g;
}

export function buildSky(): Sky {
  const group = new Group();
  const disposables: { dispose(): void }[] = [];

  const domeMat = new ShaderMaterial({
    uniforms: {
      uTop: { value: SKY_TOP },
      uHorizon: { value: SKY_HORIZON },
      uHaze: { value: HAZE },
      uSun: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uHaze, uSun;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(uHorizon, uTop, smoothstep(0.02, 0.6, h));
        col = mix(uHaze, col, smoothstep(-0.05, 0.04, h));
        // A warm bloom of air around the sun.
        float sun = max(dot(normalize(vDir), uSun), 0.0);
        col += vec3(1.0, 0.86, 0.6) * pow(sun, 24.0) * 0.35;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const domeGeo = new SphereGeometry(1200, 32, 16);
  const dome = new Mesh(domeGeo, domeMat);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  group.add(dome);
  disposables.push(domeMat, domeGeo);

  // Clouds ride a wide ring outside the city, so they never hide the map.
  const textures = [11, 23, 37, 51].map(cloudTexture);
  disposables.push(...textures);
  const clouds: { sprite: Sprite; a: number; r: number; speed: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const mat = new SpriteMaterial({ map: textures[i % textures.length], transparent: true, depthWrite: false, fog: false });
    disposables.push(mat);
    const sprite = new Sprite(mat);
    const s = 150 + hash(i * 7.1) * 170;
    sprite.scale.set(s, s / 2, 1);
    const cloud = { sprite, a: (i / 26) * Math.PI * 2 + hash(i) * 0.2, r: 820 + hash(i * 3.3) * 260, speed: 0.004 + hash(i * 5.7) * 0.004 };
    sprite.position.y = 70 + hash(i * 9.1) * 200;
    clouds.push(cloud);
    group.add(sprite);
  }

  // Birds: a few small flocks circling the plaza on the breeze.
  const FLOCKS = 3;
  const PER = 7;
  const wingMat = new MeshBasicMaterial({ color: INK, side: 2, fog: true });
  const left = wing(-1);
  const right = wing(1);
  disposables.push(wingMat, left, right);
  const wingsL = new InstancedMesh(left, wingMat, FLOCKS * PER);
  const wingsR = new InstancedMesh(right, wingMat, FLOCKS * PER);
  wingsL.frustumCulled = wingsR.frustumCulled = false;
  group.add(wingsL, wingsR);
  disposables.push(wingsL, wingsR);
  const o = new Object3D();
  const centre = new Vector3();

  return {
    group,
    update(time, dt, camera) {
      dome.position.copy(camera.position);
      for (const c of clouds) {
        c.a += c.speed * dt;
        c.sprite.position.x = camera.position.x * 0.6 + Math.cos(c.a) * c.r;
        c.sprite.position.z = camera.position.z * 0.6 + Math.sin(c.a) * c.r;
      }
      for (let f = 0; f < FLOCKS; f++) {
        const a = time * (0.05 + f * 0.012) + f * 2.1;
        centre.set(Math.cos(a) * (60 + f * 35), 45 + f * 14, Math.sin(a) * (60 + f * 35) - 10);
        const heading = a + Math.PI / 2;
        for (let b = 0; b < PER; b++) {
          const row = Math.ceil(b / 2);
          const side = b % 2 ? 1 : -1;
          o.position.set(
            centre.x + Math.cos(heading) * -row * 2.2 + Math.sin(heading) * side * row * 1.6,
            centre.y + Math.sin(time * 1.3 + b) * 0.4,
            centre.z + Math.sin(heading) * -row * 2.2 - Math.cos(heading) * side * row * 1.6
          );
          o.rotation.set(0, -heading + Math.PI / 2, 0);
          o.scale.setScalar(1.2);
          const flap = Math.sin(time * 9 + b * 1.7 + f) * 0.6;
          o.rotateZ(flap);
          o.updateMatrix();
          wingsL.setMatrixAt(f * PER + b, o.matrix);
          o.rotateZ(-2 * flap);
          o.updateMatrix();
          wingsR.setMatrixAt(f * PER + b, o.matrix);
        }
      }
      wingsL.instanceMatrix.needsUpdate = true;
      wingsR.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
