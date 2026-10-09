import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import { INK, PAPER, PAPER_DEEP } from "./palette";
import type { WorldLayout } from "./world";

/**
 * The map the whole guide sits on: a topographic sheet whose contour lines
 * rise around each section's region, the dashed survey path linking every
 * station, a numbered stake per station and each region's name set into
 * the ground. Seen up close it is terrain; from the map view it reads as a
 * printed field-guide chart.
 */
export function buildGround(layout: WorldLayout): { group: Group; dispose: () => void } {
  const group = new Group();
  const disposables: { dispose(): void }[] = [];

  // --- contour sheet ------------------------------------------------------
  const centers = layout.regions.map((r) => r.center);
  const terrain = new ShaderMaterial({
    uniforms: {
      uPaper: { value: PAPER },
      uDeep: { value: PAPER_DEEP },
      uInk: { value: INK },
      uCenters: { value: centers.concat(Array(Math.max(0, 6 - centers.length)).fill(new Vector3(9e4, 0, 9e4))).slice(0, 6) },
      uRadii: { value: layout.regions.map((r) => r.radius).concat(Array(6).fill(1)).slice(0, 6) },
      uFogNear: { value: 60 },
      uFogFar: { value: 260 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying float vDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPaper; uniform vec3 uDeep; uniform vec3 uInk;
      uniform vec3 uCenters[6]; uniform float uRadii[6];
      uniform float uFogNear; uniform float uFogFar; uniform float uTime;
      varying vec3 vWorld; varying float vDepth;

      float height(vec2 p) {
        float h = 0.0;
        for (int i = 0; i < 6; i++) {
          vec2 d = p - uCenters[i].xz;
          float r = uRadii[i];
          h += 30.0 * exp(-dot(d, d) / (r * r * 0.9));
        }
        h += 4.0 * sin(p.x * 0.021 + sin(p.y * 0.017)) + 3.0 * sin(p.y * 0.026 - p.x * 0.011);
        return h;
      }

      void main() {
        float h = height(vWorld.xz);
        // Contour every 2 units, index contour every 10 — like a survey map.
        float minor = abs(fract(h / 2.0 - 0.5) - 0.5) / fwidth(h / 2.0);
        float major = abs(fract(h / 10.0 - 0.5) - 0.5) / fwidth(h / 10.0);
        float line = (1.0 - min(minor, 1.0)) * 0.16 + (1.0 - min(major, 1.0)) * 0.34;
        vec3 col = mix(uPaper, uDeep, smoothstep(0.0, 40.0, h) * 0.35);
        col = mix(col, uInk, line);
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(mix(col, uPaper, fog), 1.0);
      }
    `,
    extensions: { derivatives: true } as never,
  });
  const sheet = new Mesh(new PlaneGeometry(1600, 1600, 1, 1), terrain);
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = -0.02;
  sheet.renderOrder = -1;
  group.add(sheet);
  disposables.push(sheet.geometry, terrain);

  // --- survey path --------------------------------------------------------
  const pts: number[] = [];
  for (const st of layout.stations) pts.push(st.position.x, 0.03, st.position.z);
  const pathGeo = new BufferGeometry();
  pathGeo.setAttribute("position", new Float32BufferAttribute(pts, 3));
  const pathMat = new LineDashedMaterial({ color: INK, dashSize: 1.2, gapSize: 1.4, transparent: true, opacity: 0.55, fog: true });
  const path = new Line(pathGeo, pathMat);
  path.computeLineDistances();
  group.add(path);
  disposables.push(pathGeo, pathMat);

  // --- stakes & region names ---------------------------------------------
  for (const st of layout.stations) {
    // The stake number sits on the pedestal ring's near-left edge, like a survey tag.
    const { mesh, dispose } = groundText(String(st.index + 1).padStart(2, "0"), 1.0, 0.45);
    const toEye = st.eye.clone().sub(st.position).setY(0).normalize();
    const side = new Vector3(toEye.z, 0, -toEye.x);
    mesh.position.copy(st.position).addScaledVector(toEye, 3.6).addScaledVector(side, -4.4).setY(0.04);
    mesh.rotation.z = Math.atan2(toEye.x, toEye.z);
    group.add(mesh);
    disposables.push({ dispose });
  }
  for (const region of layout.regions) {
    // Printed upright for the map camera, just south of each region.
    const { mesh, dispose } = groundText(region.label.toUpperCase(), Math.min(90, region.label.length * 4.2), 0.55, "600");
    mesh.position.set(region.center.x, 0.05, region.center.z + region.radius * 0.8 + 8);
    group.add(mesh);
    disposables.push({ dispose });
  }

  return {
    group,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/** Flat ink lettering lying on the ground plane, width in world units. */
function groundText(text: string, width: number, opacity: number, weight = "500") {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontPx = 96;
  ctx.font = `${weight} ${fontPx}px ui-monospace, "SF Mono", Menlo, monospace`;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = w;
  canvas.height = fontPx + 24;
  ctx.font = `${weight} ${fontPx}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.fillStyle = "#1b1a17";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 12, canvas.height / 2);
  const tex = new CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, fog: true });
  const geo = new PlaneGeometry(width, (width * canvas.height) / canvas.width);
  const mesh = new Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return {
    mesh,
    dispose: () => {
      tex.dispose();
      mat.dispose();
      geo.dispose();
    },
  };
}

/** Exposed so the engine can keep the shader fog in step with scene fog. */
export function setGroundFog(group: Group, near: number, far: number, time: number): void {
  const sheet = group.children[0] as Mesh<PlaneGeometry, ShaderMaterial>;
  sheet.material.uniforms.uFogNear.value = near;
  sheet.material.uniforms.uFogFar.value = far;
  sheet.material.uniforms.uTime.value = time;
}
