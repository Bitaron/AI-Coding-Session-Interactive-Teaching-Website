import {
  BufferGeometry,
  ConeGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  SphereGeometry,
  Vector3,
} from "three";
import { GREEN, INK, ORANGE } from "../engine/palette";
import { Bin, anchor, geo, label, matte, tint } from "./kit";
import { damp, hash, str, type FrameContext, type Hotspot, type RigFactory } from "./rig";

/**
 * Structure as mycelium: spores joined by grown filaments, with pulses of
 * work travelling along them — a graph that looks alive rather than a
 * flowchart.
 *  - graph:     write → run tests → pass? → done, or → fix → (depends on) re-run
 *  - wayfinder: a map issue whose decision tickets close one per session, then fruit into a spec
 *  - modules:   the Maven parent and the modules that grew from it
 *  - legacy:    a dense old tangle; an agent probe lights what it reads, humans flag what it missed
 */

interface Spore {
  pos: Vector3;
  name?: string;
  mesh: Mesh;
  mat: MeshStandardMaterial;
  heat: number;
  done: number;
}

interface Filament {
  a: number;
  b: number;
  curve: QuadraticBezierCurve3;
  line: Line;
}

function grow(bin: Bin, parent: Group, nodes: { p: Vector3; name?: string; cap?: boolean }[], edges: [number, number, boolean?][]) {
  const capGeo = geo(bin, new ConeGeometry(0.42, 0.36, 14, 1, true));
  const sporeGeo = geo(bin, new SphereGeometry(0.13, 10, 8));
  const spores: Spore[] = nodes.map((n) => {
    const mat = matte(bin, INK);
    const mesh = new Mesh(n.cap ? capGeo : sporeGeo, mat);
    if (n.cap) mat.side = 2;
    mesh.position.copy(n.p);
    parent.add(mesh);
    if (n.name) {
      const t = label(bin, n.name, { size: 0.28 });
      t.position.copy(n.p).add(new Vector3(0, 0.5, 0));
      parent.add(t);
    }
    return { pos: n.p, name: n.name, mesh, mat, heat: 0, done: 0 };
  });
  const solid = bin.add(new LineBasicMaterial({ color: INK, transparent: true, opacity: 0.7 }));
  const dashed = bin.add(new LineDashedMaterial({ color: INK, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.7 }));
  const filaments: Filament[] = edges.map(([a, b, isDashed], k) => {
    const pa = nodes[a].p;
    const pb = nodes[b].p;
    const mid = pa.clone().lerp(pb, 0.5);
    mid.y += 0.5 + hash(k) * 0.6;
    mid.z += (hash(k + 9) - 0.5) * 1.2;
    const curve = new QuadraticBezierCurve3(pa.clone(), mid, pb.clone());
    const g = geo(bin, new BufferGeometry().setFromPoints(curve.getPoints(28)));
    const line = new Line(g, isDashed ? dashed : solid);
    if (isDashed) line.computeLineDistances();
    g.setDrawRange(0, 0);
    parent.add(line);
    return { a, b, curve, line };
  });
  return { spores, filaments };
}

export const mycelium: RigFactory = (preset) => {
  const mode = str(preset, "mode", "graph");
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];
  const pulse = new Mesh(geo(bin, new SphereGeometry(0.14, 12, 10)), matte(bin, ORANGE));
  object.add(pulse);

  let nodes: { p: Vector3; name?: string; cap?: boolean }[] = [];
  let edges: [number, number, boolean?][] = [];
  /** A walk: the sequence of edges the pulse travels. Chosen per mode. */
  let walk: () => number[] = () => [];
  /** Set by a walk when its story starts over, so done-state clears. */
  let restart = false;

  if (mode === "graph") {
    nodes = [
      { p: new Vector3(-4, 1.2, 0.6), name: "write code", cap: true },
      { p: new Vector3(-1.4, 2.0, -0.8), name: "run tests", cap: true },
      { p: new Vector3(1.2, 1.4, 0.4), name: "tests pass?", cap: true },
      { p: new Vector3(4, 2.4, -0.4), name: "done", cap: true },
      { p: new Vector3(0, 0.6, 2.2), name: "fix", cap: true },
    ];
    edges = [[0, 1], [1, 2], [2, 3], [2, 4], [4, 1, true]];
    let laps = 0;
    walk = () => {
      laps++;
      // Fails once or twice before passing; temperature isn't involved — the
      // graph decides the route, the pulse just follows it.
      return laps % 3 === 0 ? [0, 1, 2] : [0, 1, 3, 4, 1, 2];
    };
    hotspots.push(
      { term: "workflow-graph", label: "states + decisions", anchor: anchor(object, 1.2, 2.4, 0.4) },
      { term: "dependency-edge", label: "fix depends on re-test", anchor: anchor(object, -0.8, 1.6, 1.6) }
    );
  } else if (mode === "wayfinder") {
    const tickets = ["#11 baseline", "#12 modules", "#13 storage", "#14", "#15", "#16", "#17 embedded", "#18", "#19", "#25", "#26"];
    nodes = [{ p: new Vector3(0, 1.2, 0), name: "#1 File Manager Spec", cap: true }];
    tickets.forEach((name, k) => {
      const a = (k / tickets.length) * Math.PI * 2;
      nodes.push({ p: new Vector3(Math.cos(a) * 4.6, 0.5 + (k % 3) * 0.75, Math.sin(a) * 2.4), name });
    });
    nodes.push({ p: new Vector3(0, 3.6, 0), name: "#27 spec → #28–#38", cap: true });
    edges = tickets.map((_, k) => [0, k + 1] as [number, number]);
    edges.push([0, tickets.length + 1]);
    let session = 0;
    walk = () => {
      session = (session % (tickets.length + 1)) + 1;
      if (session === 1) restart = true;
      // One ticket per session; the last walk fruits the map into a spec.
      return session <= tickets.length ? [session - 1] : [tickets.length];
    };
    hotspots.push(
      { term: "wayfinder", label: "wayfinder map", anchor: anchor(object, 0, 1.8, 0) },
      { term: "one-ticket-per-session", label: "one ticket per session", anchor: anchor(object, 4, 1.2, 0) }
    );
  } else if (mode === "modules") {
    const mods = str(
      preset,
      "modules",
      "file-manager-api|file-manager-core|spring-boot-autoconfigure|spring-boot-starter|storage-api|storage-local|storage-s3|file-manager-service|test-support|usage-example"
    ).split("|");
    nodes = [{ p: new Vector3(0, 0.3, 0.8), name: str(preset, "root", "file-manager-parent"), cap: true }];
    mods.forEach((name, k) => {
      // A fan opening upward and back, so labels stack in readable rows.
      const a = Math.PI * (0.08 + (0.84 * k) / Math.max(1, mods.length - 1));
      nodes.push({ p: new Vector3(-Math.cos(a) * 4.8, 1.4 + (k % 3) * 0.95, -Math.sin(a) * 2.2), name });
    });
    edges = mods.map((_, k) => [0, k + 1] as [number, number]);
    let k = 0;
    walk = () => [k++ % mods.length];
    hotspots.push(
      { term: "maven-multi-module", label: "Maven multi-module", anchor: anchor(object, 0, 1.2, 0) },
      { term: "deep-module", label: "deep module", anchor: anchor(object, 4, 2.2, 0) }
    );
  } else {
    // legacy: a tangle with four flagged spots the probe would have walked past
    const n = 46;
    for (let k = 0; k < n; k++) {
      const a = k * 2.4;
      const r = 0.8 + Math.sqrt(k) * 0.52;
      nodes.push({ p: new Vector3(Math.cos(a) * r, 0.4 + hash(k) * 2.2, Math.sin(a) * r * 0.7) });
    }
    const flags: [number, string][] = [
      [8, "who may export?"],
      [19, "status: free text"],
      [28, "CSV escaping"],
      [40, "auth guard missing"],
    ];
    flags.forEach(([i, name]) => (nodes[i].name = name));
    for (let k = 1; k < n; k++) edges.push([k, Math.floor(hash(k * 7) * k)]);
    for (let k = 0; k < 14; k++) edges.push([Math.floor(hash(k + 50) * n), Math.floor(hash(k + 80) * n)]);
    let visit = 0;
    walk = () => {
      visit = (visit + 1) % (n - 1);
      if (visit === 0) restart = true;
      return [visit];
    };
    hotspots.push(
      { term: "agents-md", label: "AGENT.md", anchor: anchor(object, 0, 2.6, 0) },
      { term: "human-in-the-loop", label: "humans flag what it missed", anchor: anchor(object, nodes[40].p.x, nodes[40].p.y + 0.4, nodes[40].p.z) }
    );
  }

  const { spores, filaments } = grow(bin, object, nodes, edges);
  let route: number[] = [];
  let leg = 0;
  let along = 0;
  let grown = 0;

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: FrameContext) {
      // Filaments grow in once, the first time the station is seen.
      grown = Math.min(1, grown + ctx.dt * 0.5);
      filaments.forEach((f, k) => {
        const local = Math.min(1, Math.max(0, grown * 1.6 - (k / filaments.length) * 0.6));
        f.line.geometry.setDrawRange(0, Math.floor(local * 29));
      });

      if (leg >= route.length) {
        route = walk();
        if (restart) {
          restart = false;
          spores.forEach((s) => (s.done = 0));
        }
        leg = 0;
        along = 0;
      }
      const f = filaments[route[leg]];
      if (f) {
        along += ctx.dt * (mode === "legacy" ? 1.6 : 0.8);
        f.curve.getPoint(Math.min(1, along), pulse.position);
        if (along >= 1) {
          spores[f.b].heat = 1;
          if (mode === "wayfinder" || mode === "legacy") spores[f.b].done = 1;
          leg++;
          along = 0;
        }
      }

      spores.forEach((s, k) => {
        s.heat = Math.max(0, s.heat - ctx.dt * 0.7);
        const flagged = mode === "legacy" && s.name;
        const base = s.done && !flagged ? 0.75 : 0;
        if (flagged) tint(s.mat, ORANGE, GREEN, s.done);
        else if (s.done) tint(s.mat, INK, GREEN, base + s.heat * 0.25);
        else tint(s.mat, INK, ORANGE, s.heat);
        const scale = 1 + s.heat * 0.4 + (flagged ? 0.6 : 0);
        s.mesh.scale.setScalar(damp(s.mesh.scale.x, scale, 6, ctx.dt));
        s.mesh.position.y = s.pos.y + Math.sin(ctx.time * 0.7 + k) * 0.04;
      });
    },
  };
};
