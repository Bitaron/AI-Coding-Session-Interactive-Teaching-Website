import {
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
  Vector4,
} from "three";
import { INK, ORANGE, PAPER } from "../engine/palette";
import { Bin, anchor, geo, green, ink, label, matte } from "./kit";
import { damp, str, type FrameContext, type Hotspot, type RigFactory } from "./rig";

/**
 * Context as water. Every token entering the context is a drop: it ripples
 * (drawn as ink isolines, like the map's contours) and settles as a floating
 * chip. "context" mode shows one window with its hard rim and a smaller,
 * green "usable" ring; chips in the middle of a long context fade (attention
 * thins there) and chips beyond the usable ring turn orange. "stateless"
 * mode shows two sessions as separate pools — when a session ends its pool
 * drains completely — and an external memory basin that, when switched on,
 * carries a few chips across.
 */

const DROPS = 10;

interface Pool {
  group: Group;
  radius: number;
  material: ShaderMaterial;
  drops: Vector4[];
  next: number;
  chips: InstancedMesh;
  drop(x: number, z: number, t: number, strength: number): void;
}

function makePool(bin: Bin, radius: number): Pool {
  const drops = Array.from({ length: DROPS }, () => new Vector4(0, 0, -99, 0));
  const material = bin.add(
    new ShaderMaterial({
      uniforms: {
        uDrops: { value: drops },
        uTime: { value: 0 },
        uRadius: { value: radius },
        uLevel: { value: 0.3 },
        uPaper: { value: PAPER },
        uInk: { value: INK },
        fogColor: { value: PAPER },
        fogNear: { value: 40 },
        fogFar: { value: 200 },
      },
      vertexShader: /* glsl */ `
        uniform vec4 uDrops[${DROPS}];
        uniform float uTime;
        uniform float uLevel;
        varying float vH;
        varying vec2 vP;
        varying float vDepth;
        float ripple(vec2 p) {
          float h = 0.0;
          for (int i = 0; i < ${DROPS}; i++) {
            float age = uTime - uDrops[i].z;
            if (age < 0.0 || age > 6.0) continue;
            float d = distance(p, uDrops[i].xy);
            float front = age * 1.8;
            h += uDrops[i].w * sin((d - front) * 5.0) * exp(-abs(d - front) * 1.6) * exp(-age * 0.7);
          }
          return h;
        }
        void main() {
          vec3 p = position;
          vP = p.xz;
          float h = ripple(p.xz) * 0.22;
          p.y += h + uLevel;
          vH = h;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uPaper; uniform vec3 uInk; uniform float uRadius;
        uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
        varying float vH; varying vec2 vP; varying float vDepth;
        void main() {
          float r = length(vP);
          if (r > uRadius) discard;
          float iso = abs(fract(vH * 18.0) - 0.5) / fwidth(vH * 18.0);
          float line = (1.0 - min(iso, 1.0)) * smoothstep(0.0005, 0.01, abs(vH));
          vec3 water = mix(uPaper * 0.94, uPaper, smoothstep(0.0, uRadius, r));
          vec3 col = mix(water, uInk, line * 0.55);
          float fog = smoothstep(fogNear, fogFar, vDepth);
          gl_FragColor = vec4(mix(col, fogColor, fog), 1.0);
        }
      `,
      fog: false,
    })
  );
  const surface = new Mesh(geo(bin, new PlaneGeometry(radius * 2, radius * 2, 90, 90).rotateX(-Math.PI / 2)), material);
  const group = new Group();
  group.add(surface);

  // Basin wall.
  const rim = new Mesh(geo(bin, new TorusGeometry(radius, 0.14, 8, 96).rotateX(Math.PI / 2)), ink(bin));
  rim.position.y = 0.32;
  const wall = new Mesh(geo(bin, new CylinderGeometry(radius, radius * 0.97, 0.32, 96, 1, true)), matte(bin, 0xd8d0bf));
  wall.position.y = 0.16;
  group.add(rim, wall);

  const chips = new InstancedMesh(geo(bin, new CylinderGeometry(0.11, 0.11, 0.05, 10)), matte(bin, 0xffffff), 260);
  chips.instanceMatrix.setUsage(DynamicDrawUsage);
  chips.count = 0;
  group.add(chips);

  const pool: Pool = {
    group,
    radius,
    material,
    drops,
    next: 0,
    chips,
    drop(x, z, t, strength) {
      drops[pool.next].set(x, z, t, strength);
      pool.next = (pool.next + 1) % DROPS;
    },
  };
  return pool;
}

const m = new Matrix4();
const v = new Vector3();
const col = new Color();

/** Golden-angle spiral position for chip k of n inside radius r. */
function spiral(k: number, r: number, out: Vector3): Vector3 {
  const a = k * 2.39996;
  const d = Math.sqrt(k + 0.5) * (r / Math.sqrt(260)) * 0.98;
  return out.set(Math.cos(a) * d, 0, Math.sin(a) * d);
}

export const pool: RigFactory = (preset) => {
  const mode = str(preset, "mode", "context");
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];

  if (mode === "context") {
    const p = makePool(bin, 3.7);
    object.add(p.group);
    const usable = new Mesh(geo(bin, new TorusGeometry(1, 0.035, 6, 96).rotateX(Math.PI / 2)), green(bin));
    usable.position.y = 0.45;
    object.add(usable);
    const t1 = label(bin, "context window", { size: 0.36 });
    t1.position.set(0, 1.2, -4.0);
    const t2 = label(bin, "usable", { size: 0.32, color: "#1f8a56" });
    object.add(t1, t2);
    hotspots.push(
      { term: "context-window", label: "context window", anchor: anchor(object, -2.6, 0.9, -2.6) },
      { term: "lost-in-the-middle", label: "lost in the middle", anchor: anchor(object, 0, 0.9, 0) },
      { term: "context-rot", label: "context rot", anchor: anchor(object, 2.9, 0.9, 1.6) }
    );
    let shown = 0;
    let dropTimer = 0;
    let level = 0.2;

    return {
      object,
      hotspots,
      dispose: () => bin.dispose(),
      update(ctx: FrameContext) {
        const target = Math.round(ctx.params.contextFill * 260);
        dropTimer += ctx.dt;
        // Tokens arrive one drop at a time, so moving the slider pours or drains.
        const rate = Math.max(1, Math.abs(target - shown) / 12);
        if (dropTimer > 0.04 && shown !== target) {
          dropTimer = 0;
          const stepN = Math.ceil(rate);
          shown += Math.sign(target - shown) * Math.min(stepN, Math.abs(target - shown));
          spiral(shown, p.radius, v);
          p.drop(v.x, v.z, ctx.time, 0.9);
        }
        p.material.uniforms.uTime.value = ctx.time;
        level = damp(level, 0.18 + ctx.params.contextFill * 0.16, 3, ctx.dt);
        p.material.uniforms.uLevel.value = level;

        // Usable context is a fraction of the advertised window; treat 60% as the knee.
        const usableR = Math.sqrt(0.6 * 260 + 0.5) * (p.radius / Math.sqrt(260));
        usable.scale.set(usableR, 1, usableR);
        t2.position.set(usableR * 0.72, 0.9, usableR * 0.72);

        p.chips.count = shown;
        for (let k = 0; k < shown; k++) {
          spiral(k, p.radius, v);
          v.y = level + 0.06 + Math.sin(ctx.time * 1.3 + k) * 0.02;
          m.makeTranslation(v.x, v.y, v.z);
          p.chips.setMatrixAt(k, m);
          // Attention is U-shaped over position: strong at the start and end.
          const u = shown > 1 ? k / (shown - 1) : 0;
          const attention = shown < 40 ? 1 : 0.25 + 0.75 * Math.pow(Math.abs(u - 0.5) * 2, 1.6);
          if (k > 0.6 * 260) col.copy(ORANGE);
          else col.copy(PAPER).lerp(INK, attention);
          p.chips.setColorAt(k, col);
        }
        p.chips.instanceMatrix.needsUpdate = true;
        if (p.chips.instanceColor) p.chips.instanceColor.needsUpdate = true;
      },
    };
  }

  // --- stateless ---------------------------------------------------------
  const a = makePool(bin, 2.2);
  const b = makePool(bin, 2.2);
  a.group.position.set(-3.0, 0, 0);
  b.group.position.set(3.0, 0, 0);
  const basinStone = new Mesh(geo(bin, new CylinderGeometry(0.9, 1.1, 0.5, 9)), matte(bin, 0xcfc6b3, { flat: true }));
  basinStone.position.set(0, 0.25, -2.6);
  object.add(a.group, b.group, basinStone);
  const la = label(bin, "session A", { size: 0.34 });
  la.position.set(-3.0, 1.3, -2.5);
  const lb = label(bin, "session B", { size: 0.34 });
  lb.position.set(3.0, 1.3, -2.5);
  const memOff = label(bin, "external memory: off", { size: 0.3 });
  const memOnLabel = label(bin, "external memory: on", { size: 0.3, color: "#1f8a56" });
  memOff.position.set(0, 1.4, -2.6);
  memOnLabel.position.copy(memOff.position);
  object.add(la, lb, memOff, memOnLabel);
  hotspots.push(
    { term: "stateless", label: "stateless session", anchor: anchor(object, -3.0, 0.9, 0) },
    { term: "agent-memory", label: "external memory", anchor: anchor(object, 0, 1.0, -2.6) }
  );
  const memory = new InstancedMesh(geo(bin, new CylinderGeometry(0.11, 0.11, 0.05, 10)), matte(bin, ORANGE), 6);
  object.add(memory);
  memory.count = 0;

  let clock = 0;
  let lastSession = -1;

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: FrameContext) {
      clock += ctx.dt;
      // One session = 7s: 5s of conversation, then it ends and the pool drains.
      const SESSION = 7;
      const session = Math.floor(clock / SESSION);
      const t = clock % SESSION;
      const active = session % 2 === 0 ? a : b;
      const idle = active === a ? b : a;
      // Every other pair of sessions runs with external memory switched on.
      const memOn = Math.floor(session / 2) % 2 === 1;
      memOnLabel.visible = memOn;
      memOff.visible = !memOn;
      if (session !== lastSession) {
        lastSession = session;
        idle.chips.count = 0;
        // With memory on, a few facts persist in the basin between sessions.
        memory.count = memOn ? 4 : 0;
      }
      const msgs = t < 5 ? Math.floor(t * 8) : 40;
      if (active.chips.count < msgs && t < 5) {
        spiral(active.chips.count * 6, active.radius * 0.95, v);
        active.drop(v.x, v.z, ctx.time, 1);
      }
      const drain = t > 5 ? (t - 5) / 2 : 0;
      active.chips.count = Math.round(msgs * (1 - drain));
      for (const pl of [a, b]) {
        pl.material.uniforms.uTime.value = ctx.time;
        for (let k = 0; k < pl.chips.count; k++) {
          spiral(k * 6, pl.radius * 0.95, v);
          m.makeTranslation(v.x, 0.36 + Math.sin(ctx.time + k) * 0.02 - drain * 0.3, v.z);
          pl.chips.setMatrixAt(k, m);
          pl.chips.setColorAt(k, col.copy(INK));
        }
        pl.chips.instanceMatrix.needsUpdate = true;
        if (pl.chips.instanceColor) pl.chips.instanceColor.needsUpdate = true;
      }
      // Remembered chips hover in the basin, then float into the new session.
      const enter = memOn && t < 1.2 ? t / 1.2 : 1;
      for (let k = 0; k < memory.count; k++) {
        const home = new Vector3(-0.3 + (k % 2) * 0.6, 0.6, -2.6 + Math.floor(k / 2) * 0.5 - 0.2);
        const dest = active.group.position.clone().add(new Vector3((k - 1.5) * 0.4, 0.5, -0.6));
        v.copy(home).lerp(dest, memOn && t < 5 ? Math.min(1, enter) : 0);
        v.y += Math.sin(enter * Math.PI) * 1.2;
        m.makeTranslation(v.x, v.y, v.z);
        memory.setMatrixAt(k, m);
      }
      memory.instanceMatrix.needsUpdate = true;
    },
  };
};
