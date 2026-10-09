import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  TorusGeometry,
  Vector3,
} from "three";
import { ARMOR, CONCRETE, CYAN, GREEN, LEAF, ORANGE, STEEL } from "../engine/palette";
import { anchor, balloon, Bin, geo, glow, label, sfx, toon } from "./kit";
import type { CityFrame } from "./rig";
import { buildBody, buildPerson } from "./robotkit";

// A modern jungle: an overgrown hedge maze on a city plot, standing in for
// three skills that go together in the backend replay.
//  - wayfinder: the agent feels its way through, hits dead ends ("?") and
//    backtracks; every cell it walks is charted as a cyan floor tile;
//  - grilling: at each junction it stops and asks the human, with its own
//    recommendation; the human answers, sometimes overriding (orange);
//  - domain modeling: the answers become a hologram map, cell by cell —
//    once it's whole the agent runs the route again without asking.
// Local space: maze centred on the origin, entrance at +z (the camera
// side), exit at −z (toward the plot).

const W = 7;
const H = 5;
const S = 2.4;
const WALL_H = 1.6;
const ENTRY = (H - 1) * W + 3;
const EXIT = 3;
const OVERRIDE = new Set([1, 3]); // which questions the human overrides

type Dir = "left" | "right" | "straight";
type Act = { kind: "walk"; to: number; speed: number } | { kind: "wait"; t: number; robot?: string; human?: string; override?: boolean; mark?: "?" | "!"; done?: () => void };

const cx = (c: number) => ((c % W) - (W - 1) / 2) * S;
const cz = (c: number) => (Math.floor(c / W) - (H - 1) / 2) * S;
const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nbrs(c: number): number[] {
  const x = c % W;
  const z = Math.floor(c / W);
  return [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, z > 0 ? c - W : -1, z < H - 1 ? c + W : -1].filter((n) => n >= 0);
}

/** A perfect maze (one route between any two cells), carved by seeded DFS. */
function carve(seed: number): Set<string> {
  const r = rng(seed);
  const open = new Set<string>();
  const seen = new Set([ENTRY]);
  const stack = [ENTRY];
  while (stack.length) {
    const c = stack[stack.length - 1];
    const next = nbrs(c).filter((n) => !seen.has(n));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const n = next[Math.floor(r() * next.length)];
    open.add(key(c, n));
    seen.add(n);
    stack.push(n);
  }
  return open;
}

/** Pick the first seed whose route is long enough and has real choices. */
function design() {
  for (let seed = 1; ; seed++) {
    const open = carve(seed);
    const links = (c: number) => nbrs(c).filter((n) => open.has(key(c, n)));
    const prev = new Map<number, number>([[ENTRY, -1]]);
    const q = [ENTRY];
    while (q.length) {
      const c = q.shift()!;
      for (const n of links(c)) if (!prev.has(n)) prev.set(n, c), q.push(n);
    }
    const path: number[] = [];
    for (let c = EXIT; c !== -1; c = prev.get(c)!) path.unshift(c);
    const forks = path.filter((c, i) => i > 0 && c !== EXIT && links(c).length >= 3).length;
    if ((path.length >= 11 && path.length <= 17 && forks >= 3) || seed > 400) return { open, links, path };
  }
}

export interface Maze {
  group: Group;
  anchors: { maze: Object3D; human: Object3D; model: Object3D };
  /** `stage` is the warehouse's held stage: 0 explore, 1 grill, ≥2 sunk. */
  update(ctx: CityFrame, stage: number): void;
}

export function buildMaze(bin: Bin): Maze {
  const { open, links, path } = design();
  const onPath = new Set(path);
  const group = new Group();
  const walls = new Group();
  group.add(walls);
  const o = new Object3D();
  const set = (m: InstancedMesh, i: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.set(0, ry, 0);
    o.scale.set(sx, sy, sz);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  };

  // --- the plot and the jungle --------------------------------------------------
  const paving = new InstancedMesh(geo(bin, new BoxGeometry(1, 0.06, 1)), toon(bin, CONCRETE.clone().offsetHSL(0, 0, 0.06)), 1);
  set(paving, 0, 0, 0.03, 0, W * S + 1.4, 1, H * S + 1.4);
  group.add(paving);

  // Wall edges: every cell boundary that isn't a passage, minus the two doors.
  const edges: { x: number; z: number; along: "x" | "z" }[] = [];
  for (let c = 0; c < W * H; c++) {
    const x = c % W;
    const z = Math.floor(c / W);
    if (x < W - 1 && !open.has(key(c, c + 1))) edges.push({ x: cx(c) + S / 2, z: cz(c), along: "z" });
    if (z < H - 1 && !open.has(key(c, c + W))) edges.push({ x: cx(c), z: cz(c) + S / 2, along: "x" });
    if (x === 0) edges.push({ x: cx(c) - S / 2, z: cz(c), along: "z" });
    if (x === W - 1) edges.push({ x: cx(c) + S / 2, z: cz(c), along: "z" });
    if (z === 0 && c !== EXIT) edges.push({ x: cx(c), z: cz(c) - S / 2, along: "x" });
    if (z === H - 1 && c !== ENTRY) edges.push({ x: cx(c), z: cz(c) + S / 2, along: "x" });
  }
  const greens = [0, 1, 2, 3].map((k) => LEAF.clone().offsetHSL(0.02 * (k - 1), 0.12, -0.12 + k * 0.05));
  const hedge = new InstancedMesh(geo(bin, new BoxGeometry(1, 1, 1)), toon(bin, 0xffffff), edges.length);
  const crowns = new InstancedMesh(geo(bin, new SphereGeometry(0.5, 10, 7)), toon(bin, 0xffffff), edges.length * 3);
  edges.forEach((e, i) => {
    const ry = e.along === "x" ? 0 : Math.PI / 2;
    set(hedge, i, e.x, WALL_H * 0.42, e.z, S + 0.5, WALL_H * 0.84, 0.62, ry);
    hedge.setColorAt(i, greens[i % 2]);
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * S * 0.33;
      const [px, pz] = e.along === "x" ? [e.x + off, e.z] : [e.x, e.z + off];
      set(crowns, i * 3 + k, px, WALL_H * 0.86, pz, 1.05, 0.62 + ((i + k) % 3) * 0.1, 0.85);
      crowns.setColorAt(i * 3 + k, greens[(i + k) % 4]);
    }
  });
  walls.add(hedge, crowns);

  // Flowers on a few crowns; sleek tech posts with lamp caps (and vines) at corners.
  const flowerCols = [new Color("#f2a5b8"), new Color("#fff3d6"), new Color("#f6cf4d")];
  const flowers = new InstancedMesh(geo(bin, new SphereGeometry(0.11, 6, 4)), toon(bin, 0xffffff), 18);
  for (let f = 0; f < 18; f++) {
    const e = edges[(f * 7) % edges.length];
    const off = ((f % 3) - 1) * 0.6;
    set(flowers, f, e.along === "x" ? e.x + off : e.x + 0.25, WALL_H + 0.12, e.along === "x" ? e.z + 0.25 : e.z + off);
    flowers.setColorAt(f, flowerCols[f % 3]);
  }
  const corners: [number, number][] = [];
  for (let gx = 0; gx <= W; gx += 2) for (let gz = 0; gz <= H; gz += 2.5) corners.push([(gx - W / 2) * S, (Math.round(gz) - H / 2) * S]);
  const posts = new InstancedMesh(geo(bin, new CylinderGeometry(0.16, 0.2, 2.4, 10)), toon(bin, ARMOR), corners.length);
  const caps = new InstancedMesh(geo(bin, new SphereGeometry(0.17, 10, 6)), glow(bin, CYAN), corners.length);
  const vines = new InstancedMesh(geo(bin, new TorusGeometry(0.22, 0.05, 5, 12).rotateX(Math.PI / 2)), toon(bin, greens[0]), corners.length * 2);
  corners.forEach(([x, z], i) => {
    set(posts, i, x, 1.2, z);
    set(caps, i, x, 2.48, z);
    set(vines, i * 2, x, 0.7 + (i % 3) * 0.2, z, 1, 1, 1, i);
    set(vines, i * 2 + 1, x, 1.5 + (i % 2) * 0.3, z, 0.9, 1, 0.9, -i);
  });
  walls.add(flowers, posts, caps, vines);

  // --- the charted map: floor tiles (wayfinder), painted route (afterwards) ------
  const chartMat = glow(bin, CYAN, 0.42);
  const chart = new InstancedMesh(geo(bin, new PlaneGeometry(S * 0.8, S * 0.8).rotateX(-Math.PI / 2)), chartMat, W * H);
  const charted = new Float32Array(W * H);
  const chartGoal = new Float32Array(W * H);
  group.add(chart);
  const line = new InstancedMesh(geo(bin, new BoxGeometry(1, 0.04, 1)), glow(bin, CYAN), path.length + 1);
  path.forEach((c, i) => {
    const n = path[i + 1];
    if (n === undefined) set(line, i, cx(c), 0.08, cz(c) - S / 2, 0.3, 1, S + 0.3);
    else set(line, i, (cx(c) + cx(n)) / 2, 0.08, (cz(c) + cz(n)) / 2, Math.abs(cx(c) - cx(n)) + 0.3, 1, Math.abs(cz(c) - cz(n)) + 0.3);
  });
  set(line, path.length, cx(ENTRY), 0.08, cz(ENTRY) + S / 2, 0.3, 1, S + 0.3);
  group.add(line);

  // --- the human on a terrace by the entrance ---------------------------------------
  const terrace = new Group();
  terrace.position.set(-6.4, 0, H * S / 2 + 2.6);
  const deck = new InstancedMesh(geo(bin, new BoxGeometry(1, 1, 1)), toon(bin, STEEL), 2);
  set(deck, 0, 0, 0.25, 0, 3.2, 0.5, 2.4);
  set(deck, 1, 0, 1.0, -1.15, 3.2, 0.12, 0.08);
  terrace.add(deck);
  const person = buildPerson(bin, { hat: false, shirt: "#3d78a8" });
  person.group.position.y = 0.5;
  person.group.rotation.y = Math.atan2(6.4, -(H * S / 2 + 2.6));
  terrace.add(person.group);
  group.add(terrace);

  // --- the domain model: a hologram map that fills in from the answers --------------
  const model = new Group();
  model.position.set(W * S / 2 + 3.2, 4.4, -0.6);
  model.rotation.set(-0.95, -0.45, 0, "YXZ");
  const k = 0.5;
  const tileMat = bin.add(new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  const tiles = new InstancedMesh(geo(bin, new BoxGeometry(k * 0.78, k * 0.78, 0.05)), tileMat, W * H);
  const linkList = [...open].map((s) => s.split("-").map(Number));
  const bridges = new InstancedMesh(geo(bin, new BoxGeometry(1, 1, 0.04)), tileMat, linkList.length);
  const mx = (c: number) => ((c % W) - (W - 1) / 2) * k;
  const my = (c: number) => -(Math.floor(c / W) - (H - 1) / 2) * k;
  const frame = new InstancedMesh(geo(bin, new BoxGeometry(1, 1, 0.03)), glow(bin, CYAN, 0.35), 1);
  set(frame, 0, 0, 0, -0.03, W * k + 0.3, H * k + 0.3, 1);
  const dot = new InstancedMesh(geo(bin, new SphereGeometry(0.1, 8, 6)), glow(bin, ORANGE), 1);
  model.add(frame, tiles, bridges, dot);
  const modelTag = label(bin, "domain model", { size: 0.32, color: "#1b1a17", background: "#f2e2a0" });
  modelTag.position.set(0, H * k / 2 + 0.45, 0);
  model.add(modelTag);
  const projector = new InstancedMesh(geo(bin, new CylinderGeometry(0.12, 0.3, 1, 10)), toon(bin, STEEL), 1);
  set(projector, 0, model.position.x, 1.6, model.position.z, 1, 3.2, 1);
  group.add(model, projector);
  const known = new Float32Array(W * H); // 0 unknown, 1 walked, 2 told "not this way"
  const modelCol = new Color();
  const hidden = new Color();
  const paintModel = (complete: boolean) => {
    for (let c = 0; c < W * H; c++) {
      const s = known[c] ? 1 : 0.001;
      o.position.set(mx(c), my(c), 0);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(s);
      o.updateMatrix();
      tiles.setMatrixAt(c, o.matrix);
      modelCol.copy(known[c] === 2 ? hidden.set("#6f9fa6") : complete && onPath.has(c) ? GREEN : CYAN);
      tiles.setColorAt(c, modelCol);
    }
    linkList.forEach(([a, b], i) => {
      const on = known[a] && known[b];
      o.position.set((mx(a) + mx(b)) / 2, (my(a) + my(b)) / 2, 0);
      o.scale.set(on ? Math.abs(mx(a) - mx(b)) + 0.08 : 0.001, on ? Math.abs(my(a) - my(b)) + 0.08 : 0.001, 1);
      o.updateMatrix();
      bridges.setMatrixAt(i, o.matrix);
      bridges.setColorAt(i, complete && onPath.has(a) && onPath.has(b) ? GREEN : CYAN);
    });
    for (const m of [tiles, bridges]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };

  // --- the agent ------------------------------------------------------------------------
  const agent = buildBody(bin);
  agent.group.scale.setScalar(0.75);
  group.add(agent.group);
  const marks = { "?": sfx(bin, "?", { color: "#e8611e", size: 1.1 }), "!": sfx(bin, "!", { color: "#3fae6a", size: 1.1 }) };
  Object.values(marks).forEach((m) => ((m.visible = false), group.add(m)));
  const balloons = new Map<string, Sprite>();
  const say = (text: string, kind: "robot" | "speech", fill?: string): Sprite => {
    const id = `${kind}:${text}`;
    let b = balloons.get(id);
    if (!b) {
      b = balloon(bin, text, kind, { height: 0.95, fill, tail: kind === "speech" ? "right" : "left" });
      b.visible = false;
      group.add(b);
      balloons.set(id, b);
    }
    return b;
  };

  // --- scripts ------------------------------------------------------------------------
  const dirOf = (from: number, at: number, to: number): Dir => {
    const hx = cx(at) - cx(from);
    const hz = cz(at) - cz(from);
    const vx = cx(to) - cx(at);
    const vz = cz(to) - cz(at);
    if (Math.sign(vx) === Math.sign(hx) && Math.sign(vz) === Math.sign(hz)) return "straight";
    return Math.sign(vx) === Math.sign(hz) && Math.sign(vz) === Math.sign(-hx) ? "left" : "right";
  };

  const explore = (): Act[] => {
    // Depth-first, trying short side branches first — that's how dead ends get found.
    const size = (c: number, from: number): number => 1 + links(c).filter((n) => n !== from).reduce((s, n) => s + size(n, c), 0);
    const acts: Act[] = [];
    const visit = (c: number, from: number): boolean => {
      acts.push({ kind: "walk", to: c, speed: 2.6 }, { kind: "wait", t: 0.05, done: () => (chartGoal[c] = 1) });
      if (c === EXIT) return true;
      const next = links(c)
        .filter((n) => n !== from)
        .sort((a, b) => (onPath.has(a) ? 1 : 0) - (onPath.has(b) ? 1 : 0) || size(a, c) - size(b, c))
        .filter((n) => onPath.has(n) || size(n, c) <= 3);
      if (!next.length) acts.push({ kind: "wait", t: 1.1, mark: "?" });
      for (const n of next) {
        if (visit(n, c)) return true;
        acts.push({ kind: "walk", to: c, speed: 2.6 });
      }
      return false;
    };
    visit(ENTRY, -1);
    acts.push({ kind: "wait", t: 2.4, mark: "!" }, { kind: "wait", t: 0.6, done: () => chartGoal.fill(0) });
    return acts;
  };

  const grill = (): Act[] => {
    const acts: Act[] = [];
    let q = 0;
    path.forEach((c, i) => {
      acts.push({ kind: "walk", to: c, speed: 2.4 }, { kind: "wait", t: 0.05, done: () => ((known[c] = 1), paintModel(false)) });
      const out = links(c).filter((n) => n !== path[i - 1]);
      if (i === 0 || c === EXIT || out.length < 2) return;
      const right = path[i + 1];
      const dirs = out.map((n) => dirOf(path[i - 1], c, n));
      const truth = dirOf(path[i - 1], c, right);
      const override = OVERRIDE.has(q);
      const rec = override ? dirs.find((d) => d !== truth)! : truth;
      q++;
      acts.push(
        { kind: "wait", t: 2.0, robot: `Q${q}: ${dirs.join(" or ")}? I'd say ${rec}.` },
        {
          kind: "wait",
          t: 1.8,
          human: override ? `No — ${truth}.` : `${truth[0].toUpperCase()}${truth.slice(1)}, yes.`,
          override,
          // The answer also tells it where not to go: those cells join the model.
          done: () => (out.forEach((n) => n !== right && (known[n] = known[n] || 2)), paintModel(false)),
        }
      );
    });
    acts.push(
      { kind: "wait", t: 1.6, robot: "Map's complete.", done: () => (known.fill(1), paintModel(true)) },
      ...path.slice().reverse().map((c): Act => ({ kind: "walk", to: c, speed: 6 })),
      { kind: "wait", t: 1.0, robot: "No questions this time." },
      ...path.map((c): Act => ({ kind: "walk", to: c, speed: 3.6 })),
      { kind: "wait", t: 2.4, mark: "!" },
      { kind: "wait", t: 0.4, done: () => (known.fill(0), paintModel(false)) }
    );
    return acts;
  };

  // --- playback -------------------------------------------------------------------------
  let mode = -1;
  let acts: Act[] = [];
  let ai = 0;
  let waited = 0;
  let walkPhase = 0;
  let sink = 0;
  const pos = new Vector3(cx(ENTRY), 0, cz(ENTRY) + S);
  const humanAt = new Vector3().copy(terrace.position);
  /** What's on screen this frame: a mark or balloon over the agent, a balloon over the human. */
  let overAgent: Sprite | null = null;
  let overHuman: Sprite | null = null;

  const restart = (m: number) => {
    mode = m;
    ai = 0;
    waited = 0;
    chartGoal.fill(0);
    known.fill(0);
    paintModel(false);
    pos.set(cx(ENTRY), 0, cz(ENTRY) + S);
    acts = m === 0 ? explore() : m === 1 ? grill() : [];
  };

  const anchors = {
    maze: anchor(group, 0, WALL_H + 1, 0),
    human: anchor(group, terrace.position.x - 1.2, 2.2, terrace.position.z),
    model: anchor(group, model.position.x, model.position.y + 1.6, model.position.z),
  };

  return {
    group,
    anchors,
    update(ctx, stage) {
      const dt = ctx.dt;
      const m = Math.min(stage, 2);
      if (m !== mode) restart(m);
      sink = Math.min(1, Math.max(0, sink + (stage >= 2 ? dt : -dt) / 1.5));
      walls.scale.y = 1 - sink * 0.97;
      line.visible = sink > 0.5;
      const live = stage < 2 && ctx.lod < 2;
      agent.group.visible = terrace.visible = live;
      model.visible = projector.visible = stage === 1 && ctx.lod < 2;
      if (overAgent) overAgent.visible = false;
      if (overHuman) overHuman.visible = false;
      overAgent = overHuman = null;

      // Charted tiles ease in and out.
      for (let c = 0; c < W * H; c++) {
        charted[c] += (chartGoal[c] - charted[c]) * Math.min(1, dt * 5);
        set(chart, c, cx(c), 0.07, cz(c), Math.max(0.001, charted[c]), 1, Math.max(0.001, charted[c]));
      }
      chart.instanceMatrix.needsUpdate = true;
      chart.visible = stage === 0;
      if (!live || !acts.length) return;

      // Run the script.
      const act = acts[ai];
      let moving = false;
      if (act.kind === "walk") {
        const tx = cx(act.to);
        const tz = cz(act.to);
        const d = Math.hypot(tx - pos.x, tz - pos.z);
        const step = Math.min(d, dt * act.speed);
        if (d > 0.01) {
          pos.x += ((tx - pos.x) / d) * step;
          pos.z += ((tz - pos.z) / d) * step;
          agent.group.rotation.y = Math.atan2(tx - pos.x, tz - pos.z);
          moving = true;
        }
        if (d - step < 0.01) ai++;
      } else {
        if (waited === 0) act.done?.();
        waited += dt;
        const face = act.robot || act.human ? humanAt : null;
        if (face) agent.group.rotation.y = Math.atan2(face.x - pos.x, face.z - pos.z);
        if (act.mark) overAgent = marks[act.mark];
        if (act.robot) overAgent = say(act.robot, "robot");
        if (act.human) overHuman = say(act.human, "speech", act.override ? "#fbe0cf" : undefined);
        if (waited >= act.t) {
          waited = 0;
          ai++;
        }
      }
      if (ai >= acts.length) restart(mode);

      walkPhase += moving ? dt * 10 : 0;
      agent.group.position.copy(pos);
      agent.walk(walkPhase, moving ? 1 : 0);
      agent.head.setEyes(1);
      // The human points the way while answering.
      person.armR.rotation.x = overHuman ? -1.9 : 0;
      if (overAgent) {
        overAgent.visible = true;
        overAgent.position.set(pos.x, act.kind === "wait" && act.mark ? 2.6 : 3.2, pos.z);
      }
      if (overHuman) {
        overHuman.visible = true;
        overHuman.position.set(humanAt.x + 0.4, 3.5, humanAt.z);
      }
      // The dot on the model follows the agent.
      o.position.set((pos.x / S) * k, (-pos.z / S) * k, 0.06);
      o.scale.setScalar(1);
      o.updateMatrix();
      dot.setMatrixAt(0, o.matrix);
      dot.instanceMatrix.needsUpdate = true;
    },
  };
}
