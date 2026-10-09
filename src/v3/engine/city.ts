import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  RingGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash } from "../../v2/scenes/rig";
import { Bin, geo, toon } from "../scenes/kit";
import { buildHead, type RobotHead } from "../scenes/robotkit";
import type { CityLayout } from "./layout";
import {
  ARMOR,
  ASPHALT,
  BRICK,
  CONCRETE,
  CYAN,
  GLASS,
  GRASS,
  GROUND,
  LEAF,
  ROOF,
  STEEL,
  TIMBER,
  WATER,
} from "./palette";

/**
 * The city every station stands in: ground, river, roads, the old town's
 * low brick blocks and pitched roofs, the new city's towers, an elevated
 * train ring and the central tower with its giant head (the landmark you
 * steer by on the map). Filler buildings are generated around the
 * stations and kept out of every camera's line of sight. Two draw calls
 * per building family, whatever the count.
 */

export interface City {
  group: Group;
  update(time: number): void;
  dispose(): void;
}

interface Seg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

function segDist(px: number, pz: number, s: Seg): number {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / l2));
  return Math.hypot(px - (s.ax + dx * t), pz - (s.az + dz * t));
}

/** Window grid painted from world position, so any box size gets real-scale windows. */
function windowed(mat: MeshToonMaterial, pane: Color, spacing: [number, number], key: string): MeshToonMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPane = { value: pane };
    shader.uniforms.uSpacing = { value: { x: spacing[0], y: spacing[1] } };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCityPos;\nvarying vec3 vCityNormal;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vCityPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vCityNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vCityPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vCityNormal = normalize(mat3(modelMatrix) * objectNormal);
        #endif`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vCityPos;\nvarying vec3 vCityNormal;\nuniform vec3 uPane;\nuniform vec2 uSpacing;"
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (abs(vCityNormal.y) < 0.5) {
          vec2 t = normalize(vec2(-vCityNormal.z, vCityNormal.x));
          float u = dot(vCityPos.xz, t) / uSpacing.x;
          float v = (vCityPos.y - 1.2) / uSpacing.y;
          float pane = step(0.3, fract(u)) * step(fract(u), 0.78) * step(0.28, fract(v)) * step(fract(v), 0.78) * step(0.0, v);
          diffuseColor.rgb = mix(diffuseColor.rgb, uPane, pane);
        }`
      );
  };
  mat.customProgramCacheKey = () => `city-windows-${key}`;
  return mat;
}

/** A prism roof: a box's footprint with a ridge along x. */
function roofGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  // Unit footprint (-0.5..0.5), ridge at y = 1.
  const p = [
    // two slopes
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,
    0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,
    // gables
    -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0,
  ];
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A painted meadow: the base green with soft darker and sunnier patches
 * and short brush strokes of grass, tiled every ~12 units. Breaks up the
 * flat green the way a background painter would.
 */
function meadowTexture(bin: Bin): CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = `#${GRASS.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  const patch = (x: number, y: number, r: number, color: string) => {
    // Draw wrapped so the tile repeats without seams.
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * 0.7, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  for (let i = 0; i < 7; i++) patch(hash(i * 3.1) * size, hash(i * 7.3) * size, 60 + hash(i * 1.9) * 70, i % 2 ? "rgba(70,120,60,0.09)" : "rgba(220,230,120,0.1)");
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 260; i++) {
    const x = hash(i * 5.7) * size;
    const y = hash(i * 9.1) * size;
    ctx.strokeStyle = i % 2 ? "rgba(60,110,50,0.35)" : "rgba(190,220,120,0.4)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (hash(i) - 0.5) * 3, y - 5 - hash(i * 2.2) * 4);
    ctx.stroke();
  }
  const tex = bin.add(new CanvasTexture(c));
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(70, 70);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildCity(layout: CityLayout): City {
  const bin = new Bin();
  const group = new Group();
  const R = layout.avenue;
  const RX = layout.riverX;
  const RIVER_HALF = 13;

  // --- ground, river, roads ---------------------------------------------------
  // Green underfoot almost everywhere: the city is built into a meadow.
  const groundMat = toon(bin, 0xffffff, { map: meadowTexture(bin) });
  const west = new Mesh(geo(bin, new PlaneGeometry(900, 1600)), groundMat);
  west.rotation.x = -Math.PI / 2;
  west.position.set(RX - RIVER_HALF - 450, 0, 0);
  const east = new Mesh(geo(bin, new PlaneGeometry(1200, 1600)), groundMat);
  east.rotation.x = -Math.PI / 2;
  east.position.set(RX + RIVER_HALF + 600, 0, 0);
  group.add(west, east);
  // The central plaza is paved; stations stand on its rim of lawn and trees.
  const plaza = new Mesh(geo(bin, new CircleGeometry(64, 96)), toon(bin, GROUND));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.012;
  group.add(plaza);

  const water = new Mesh(geo(bin, new PlaneGeometry(RIVER_HALF * 2, 1600)), toon(bin, WATER));
  water.rotation.x = -Math.PI / 2;
  water.position.set(RX, -0.7, 0);
  group.add(water);
  const bankMat = toon(bin, CONCRETE);
  for (const side of [-1, 1]) {
    const bank = new Mesh(geo(bin, new BoxGeometry(0.6, 0.8, 1600)), bankMat);
    bank.position.set(RX + side * RIVER_HALF, -0.35, 0);
    group.add(bank);
  }
  // Ripple marks: short strokes, the comic shorthand for water.
  const rippleMat = toon(bin, new Color(WATER).multiplyScalar(0.82));
  const ripples = new InstancedMesh(geo(bin, new BoxGeometry(2.2, 0.02, 0.14)), rippleMat, 160);
  const m = new Matrix4();
  for (let i = 0; i < 160; i++) {
    m.makeTranslation(RX + (hash(i * 3.1) - 0.5) * RIVER_HALF * 1.6, -0.68, (hash(i * 7.7) - 0.5) * 700);
    ripples.setMatrixAt(i, m);
  }
  group.add(ripples);

  const roads: Seg[] = [
    { ax: -330, az: 40, bx: -R, bz: 40 }, // the bridge road: old town → avenue
    { ax: -195, az: -150, bx: -195, bz: 260 },
    { ax: -262, az: -150, bx: -262, bz: 260 },
    { ax: -330, az: -40, bx: RX - RIVER_HALF, bz: -40 },
    { ax: -330, az: 140, bx: RX - RIVER_HALF, bz: 140 },
    { ax: R + 6, az: 78, bx: 330, bz: 78 }, // to the docks
    { ax: 18, az: R + 6, bx: 18, bz: 330 }, // to the media plaza
  ];
  const asphalt = toon(bin, ASPHALT);
  roads.forEach((s, i) => {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    const road = new Mesh(geo(bin, new PlaneGeometry(len, 9)), asphalt);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = -Math.atan2(s.bz - s.az, s.bx - s.ax);
    road.position.set((s.ax + s.bx) / 2, 0.02 + i * 0.002, (s.az + s.bz) / 2);
    group.add(road);
  });
  const ring = new Mesh(geo(bin, new RingGeometry(R + 7, R + 21, 160)), asphalt);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  group.add(ring);
  const kerbMat = toon(bin, CONCRETE, { side: DoubleSide });
  for (const r of [R + 7, R + 21]) {
    const kerb = new Mesh(geo(bin, new CylinderGeometry(r, r, 0.3, 160, 1, true)), kerbMat);
    kerb.position.y = 0.15;
    group.add(kerb);
  }

  // The bridge: where the old town hands over to the new city.
  const deck = new Mesh(geo(bin, new BoxGeometry(RIVER_HALF * 2 + 8, 0.6, 11)), toon(bin, CONCRETE));
  deck.position.set(RX, 0.05, 40);
  group.add(deck);
  for (const side of [-1, 1]) {
    const rail = new Mesh(geo(bin, new BoxGeometry(RIVER_HALF * 2 + 8, 0.9, 0.25)), toon(bin, STEEL));
    rail.position.set(RX, 0.8, 40 + side * 5.3);
    group.add(rail);
  }

  // --- station plinths ------------------------------------------------------------
  const plinthMat = toon(bin, "#ebe5d8");
  const plinthGeo = geo(bin, new CylinderGeometry(6.4, 6.6, 0.3, 48));
  for (const st of layout.stations) {
    if (st.site) continue;
    const p = new Mesh(plinthGeo, plinthMat);
    p.position.set(st.position.x, 0.15, st.position.z);
    group.add(p);
  }

  // --- what must stay clear ---------------------------------------------------------
  const sightlines: Seg[] = [];
  const corridors: Seg[] = [];
  const focus: Vector3[] = [];
  let prev: (typeof layout.stations)[number] | null = null;
  for (const st of layout.stations) {
    sightlines.push({ ax: st.eye.x, az: st.eye.z, bx: st.target.x, bz: st.target.z });
    if (!st.site) focus.push(st.position);
    if (prev && prev.route.sectionId === st.route.sectionId) {
      corridors.push({ ax: prev.eye.x, az: prev.eye.z, bx: st.eye.x, bz: st.eye.z });
    }
    prev = st;
  }
  const blocked = (x: number, z: number, margin: number): boolean => {
    const r = Math.hypot(x, z);
    if (r < 62 + margin) return true; // the plaza
    if (r > R - 34 - margin && r < R) return true; // open ground in front of the stations
    if (Math.abs(r - (R + 14)) < 10 + margin) return true; // the avenue
    if (Math.abs(x - RX) < RIVER_HALF + 3 + margin) return true;
    for (const s of layout.sites) if (Math.hypot(x - s.position.x, z - s.position.z) < s.def.clear + margin) return true;
    for (const p of focus) if (Math.hypot(x - p.x, z - p.z) < 14 + margin) return true;
    for (const s of sightlines) if (segDist(x, z, s) < 8 + margin) return true;
    for (const s of corridors) if (segDist(x, z, s) < 7 + margin) return true;
    for (const s of roads) if (segDist(x, z, s) < 5.5 + margin) return true;
    return false;
  };
  const nearestFocus = (x: number, z: number) => {
    let d = Infinity;
    for (const st of layout.stations) d = Math.min(d, Math.hypot(x - st.eye.x, z - st.eye.z), Math.hypot(x - st.target.x, z - st.target.z));
    return d;
  };

  // --- filler buildings ----------------------------------------------------------------
  type Block = { x: number; z: number; w: number; d: number; h: number; c: Color; roof?: boolean; rot: number };
  const oldBlocks: Block[] = [];
  const newBlocks: Block[] = [];
  const trees: { x: number; z: number; s: number }[] = [];
  // Old town: plaster walls in cream, ochre and rose, with brick here and there.
  const oldColors = [CONCRETE, new Color("#f6eedb"), new Color("#e9c27a"), new Color("#efc3a8"), BRICK, new Color("#d9b48a")];
  // New city: white and pale-sea towers with sky-blue glass.
  const newColors = [ARMOR, new Color("#e6f2f1"), new Color("#cfe7ea"), GLASS, new Color("#f6eedd"), STEEL];

  let n = 0;
  for (let gx = -330; gx <= 330; gx += 14) {
    for (let gz = -280; gz <= 330; gz += 14) {
      n++;
      // Every fifth row and column is a street; a few lots stay empty.
      if (((gx + 330) / 14) % 5 === 0 || ((gz + 280) / 14) % 5 === 0 || hash(n * 11.3) < 0.12) continue;
      const x = gx + (hash(n * 1.7) - 0.5) * 3;
      const z = gz + (hash(n * 2.3) - 0.5) * 3;
      const isOld = x < RX;
      const w = isOld ? 5 + hash(n * 3.1) * 4 : 6 + hash(n * 3.1) * 4.5;
      const d = isOld ? 5 + hash(n * 4.3) * 4 : 6 + hash(n * 4.3) * 4.5;
      const margin = Math.hypot(w, d) / 2;
      if (blocked(x, z, margin)) {
        if (isOld && hash(n * 9.1) > 0.55 && !blocked(x, z, 1.5)) trees.push({ x, z, s: 0.8 + hash(n * 5.5) * 0.6 });
        continue;
      }
      const near = nearestFocus(x, z);
      if (isOld) {
        if (hash(n * 6.1) < 0.12) {
          trees.push({ x, z, s: 1 + hash(n * 5.5) * 0.5 });
          continue;
        }
        const h = 3.2 + hash(n * 5.3) * (near < 40 ? 3 : 7);
        oldBlocks.push({ x, z, w, d, h, c: oldColors[Math.floor(hash(n * 7.9) * oldColors.length)], roof: hash(n * 8.3) > 0.4, rot: 0 });
      } else {
        const r = Math.hypot(x, z);
        const skyline = r > 175 ? 35 + hash(n * 5.3) * 60 : 12 + hash(n * 5.3) * 34;
        // Near a camera, keep blocks low enough to see over.
        let cap = near < 50 ? 4 + Math.max(0, near - 10) * 0.75 : Infinity;
        // Inside the avenue ring stays low: the tower is every station's backdrop.
        if (r < R) cap = Math.min(cap, 7);
        const h = Math.max(5, Math.min(skyline, cap));
        newBlocks.push({ x, z, w, d, h, c: newColors[Math.floor(hash(n * 7.9) * newColors.length)], rot: 0 });
        // Setback crowns on the tall ones.
        if (h > 30 && hash(n * 9.7) > 0.4) {
          newBlocks.push({ x, z, w: w * 0.6, d: d * 0.6, h: h + 6 + hash(n * 3.3) * 10, c: newColors[Math.floor(hash(n * 6.3) * newColors.length)], rot: 0 });
        }
      }
    }
  }

  const box = geo(bin, new BoxGeometry(1, 1, 1));
  box.translate(0, 0.5, 0);
  const place = (mesh: InstancedMesh, blocks: Block[]) => {
    const o = new Object3D();
    blocks.forEach((b, i) => {
      o.position.set(b.x, 0, b.z);
      o.rotation.set(0, b.rot, 0);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, b.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  const oldMat = windowed(toon(bin, 0xffffff), new Color("#456a80"), [2.6, 3.0], "old");
  const oldMesh = new InstancedMesh(box, oldMat, Math.max(1, oldBlocks.length));
  place(oldMesh, oldBlocks);
  const newMat = windowed(toon(bin, 0xffffff), new Color("#3c88ab"), [2.0, 3.4], "new");
  const newMesh = new InstancedMesh(box, newMat, Math.max(1, newBlocks.length));
  place(newMesh, newBlocks);
  group.add(oldMesh, newMesh);

  const roofed = oldBlocks.filter((b) => b.roof);
  const roofs = new InstancedMesh(geo(bin, roofGeometry()), toon(bin, 0xffffff), Math.max(1, roofed.length));
  {
    const o = new Object3D();
    roofed.forEach((b, i) => {
      o.position.set(b.x, b.h, b.z);
      o.scale.set(b.w + 0.4, Math.min(b.w, b.d) * 0.45, b.d + 0.4);
      o.updateMatrix();
      roofs.setMatrixAt(i, o.matrix);
      // Mostly terracotta; some weathered copper, like a harbour town.
      roofs.setColorAt(i, i % 4 === 0 ? new Color("#5f9a95") : i % 3 === 0 ? new Color("#e07a4f") : ROOF);
    });
  }
  group.add(roofs);

  // Park trees round the plaza: the backdrop every avenue station looks into.
  for (let i = 0; i < 260; i++) {
    const a = hash(i * 12.9) * Math.PI * 2;
    const r = 68 + hash(i * 4.7) * (R - 82);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (sightlines.some((s) => segDist(x, z, s) < 3)) continue;
    trees.push({ x, z, s: 0.9 + hash(i * 6.1) * 0.8 });
  }
  // Street trees along the new city's roads.
  for (const s of roads.slice(5)) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    const nx = -(s.bz - s.az) / len;
    const nz = (s.bx - s.ax) / len;
    for (let t = 10; t < len; t += 11) {
      for (const side of [-1, 1]) {
        const x = s.ax + ((s.bx - s.ax) * t) / len + nx * 6.5 * side;
        const z = s.az + ((s.bz - s.az) * t) / len + nz * 6.5 * side;
        if (!layout.sites.some((st) => Math.hypot(x - st.position.x, z - st.position.z) < st.def.clear)) trees.push({ x, z, s: 0.8 });
      }
    }
  }

  // Ghibli trees: lumpy clusters of leaf, in several greens, that sway in
  // the breeze — the top more than the base.
  const wind = { value: 0 };
  const lumps = mergeGeometries([
    new IcosahedronGeometry(1.35, 1).translate(0, 2.9, 0),
    new IcosahedronGeometry(0.95, 1).translate(0.85, 3.5, 0.3),
    new IcosahedronGeometry(1.0, 1).translate(-0.75, 3.35, -0.35),
    new IcosahedronGeometry(0.8, 1).translate(0.1, 4.2, -0.2),
  ]);
  const crownMat = toon(bin, 0xffffff);
  crownMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 root = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          float gust = sin(uWind * 1.1 + root.x * 0.07 + root.y * 0.05) * 0.6 + sin(uWind * 2.7 + root.x * 0.13) * 0.25;
          float bend = max(transformed.y - 2.0, 0.0);
          transformed.x += gust * 0.09 * bend;
          transformed.z += gust * 0.04 * bend;
        #endif`
      );
  };
  crownMat.customProgramCacheKey = () => "city-crowns";
  const trunk = new InstancedMesh(geo(bin, new CylinderGeometry(0.18, 0.26, 2.2, 6).translate(0, 1.1, 0)), toon(bin, TIMBER), Math.max(1, trees.length));
  const crown = new InstancedMesh(geo(bin, lumps), crownMat, Math.max(1, trees.length));
  const greens = [LEAF, new Color("#6db04d"), new Color("#3f8a4a"), new Color("#86bf55")];
  {
    const o = new Object3D();
    trees.forEach((t, i) => {
      o.position.set(t.x, 0, t.z);
      o.rotation.set(0, hash(i * 3.7) * Math.PI * 2, 0);
      o.scale.setScalar(t.s);
      o.updateMatrix();
      trunk.setMatrixAt(i, o.matrix);
      crown.setMatrixAt(i, o.matrix);
      crown.setColorAt(i, greens[i % greens.length]);
    });
  }
  group.add(trunk, crown);

  // Rooftop gardens on the new city's lower towers.
  const gardened = newBlocks.filter((b, i) => b.h < 34 && hash(i * 17.3) > 0.45);
  const gardens = new InstancedMesh(box, toon(bin, 0xffffff), Math.max(1, gardened.length));
  {
    const o = new Object3D();
    gardened.forEach((b, i) => {
      o.position.set(b.x, b.h, b.z);
      o.scale.set(b.w * 0.86, 0.45, b.d * 0.86);
      o.updateMatrix();
      gardens.setMatrixAt(i, o.matrix);
      gardens.setColorAt(i, greens[i % greens.length]);
    });
  }
  group.add(gardens);

  // --- the elevated train: the new city keeps moving ---------------------------------
  const TRACK_R = 158;
  const TRACK_Y = 16;
  const track = new Mesh(geo(bin, new TorusGeometry(TRACK_R, 0.8, 6, 220)), toon(bin, STEEL));
  track.rotation.x = Math.PI / 2;
  track.scale.set(1, 1, 0.6);
  track.position.y = TRACK_Y;
  group.add(track);
  const pylonCount = 60;
  const pylons = new InstancedMesh(geo(bin, new CylinderGeometry(0.6, 0.9, TRACK_Y, 8).translate(0, TRACK_Y / 2, 0)), toon(bin, STEEL), pylonCount);
  let placed = 0;
  for (let i = 0; i < pylonCount; i++) {
    const a = (i / pylonCount) * Math.PI * 2;
    const x = Math.cos(a) * TRACK_R;
    const z = Math.sin(a) * TRACK_R;
    if (x < RX + RIVER_HALF + 4) continue; // the line stops at the river
    m.makeTranslation(x, 0, z);
    pylons.setMatrixAt(placed++, m);
  }
  pylons.count = placed;
  group.add(pylons);
  const train = new Group();
  const carMat = toon(bin, ARMOR);
  const stripe = toon(bin, CYAN, { emissive: CYAN, emissiveIntensity: 0.3 });
  const cars: Object3D[] = [];
  for (let i = 0; i < 4; i++) {
    const car = new Group();
    const body = new Mesh(geo(bin, new BoxGeometry(2.4, 2.2, 9)), carMat);
    body.position.y = 1.9;
    const band = new Mesh(geo(bin, new BoxGeometry(2.45, 0.35, 8.6)), stripe);
    band.position.y = 2.2;
    car.add(body, band);
    train.add(car);
    cars.push(car);
  }
  group.add(train);

  // --- the central tower and its head --------------------------------------------------
  const tower = new Group();
  tower.position.set(0, 0, -22);
  const towerMat = windowed(toon(bin, ARMOR), new Color("#5f8f96"), [2.0, 3.4], "new");
  const tiers: [number, number, number][] = [
    [11, 26, 0],
    [8, 22, 26],
    [5.5, 14, 48],
  ];
  for (const [r, h, y] of tiers) {
    const t = new Mesh(geo(bin, new CylinderGeometry(r * 0.92, r, h, 24)), towerMat);
    t.position.y = y + h / 2;
    tower.add(t);
  }
  const head: RobotHead = buildHead(bin);
  head.group.scale.setScalar(12);
  head.group.position.y = 62 + 6;
  head.group.rotation.y = Math.PI * 0.1;
  tower.add(head.group);
  group.add(tower);

  const tmp = new Vector3();
  return {
    group,
    update(time) {
      // One lap every ~100 s, counter-clockwise from the docks.
      cars.forEach((car, i) => {
        const a = time * 0.063 - i * 0.06;
        tmp.set(Math.cos(a) * TRACK_R, TRACK_Y, Math.sin(a) * TRACK_R);
        car.position.copy(tmp);
        car.rotation.y = -a;
        // Trains vanish into the tunnel portal at the river.
        car.visible = tmp.x > RX + RIVER_HALF + 6;
      });
      head.group.rotation.y = Math.PI * 0.1 + Math.sin(time * 0.05) * 0.5;
      head.setEyes(0.85 + Math.sin(time * 1.3) * 0.15);
      wind.value = time;
    },
    dispose() {
      oldMesh.dispose();
      newMesh.dispose();
      roofs.dispose();
      trunk.dispose();
      crown.dispose();
      gardens.dispose();
      lumps.dispose();
      pylons.dispose();
      ripples.dispose();
      bin.dispose();
    },
  };
}
