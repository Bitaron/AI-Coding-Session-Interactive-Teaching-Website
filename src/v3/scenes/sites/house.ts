import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { ARMOR, BRICK, CONCRETE, CYAN, GLASS, GREEN, INK, ORANGE, ROOF, STEEL, TIMBER } from "../../engine/palette";
import { anchor, balloon, Bin, geo, glow, label, sfx, textTexture, toon } from "../kit";
import type { CityFrame, CityRig, Hotspot, SiteDef, Vantage } from "../rig";
import { buildBody, buildPerson, type Person } from "../robotkit";

/**
 * The old house, west of the river. Stage 0 (Intro · traditional): people
 * build it the present-day way — an architect plans, a foreman divides,
 * crews pass bricks hand to hand, and bricks dropped at a hand-off turn
 * orange (context lost). Stages 1–5 (Working in an existing project): a
 * robot arrives at the finished house and, with the owner's catches,
 * renovates it into a new-city house. Every part has an old and a new
 * variant, so the last stage is visibly the same house converted.
 */

const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

interface Part {
  pivot: Object3D;
  old: Group;
  fresh: Group;
  /** Stage 0: when this part starts going up, and for how long (s). */
  start: number;
  dur: number;
  /** Stage 5: the review sends this one back once. */
  flagged?: boolean;
}

const BUILD_DONE = 16.5;
const SWAP_GAP = 0.75;

/** Prism roof, unit footprint (-0.5..0.5), ridge along x at y = 1. */
function roofGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const p = [
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,
    0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,
    -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0,
  ];
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

function buildHouse(): CityRig {
  const bin = new Bin();
  const object = new Group();

  // --- materials ------------------------------------------------------------------
  const brick = toon(bin, BRICK, { transparent: true });
  const roofMat = toon(bin, ROOF, { transparent: true });
  const timber = toon(bin, TIMBER);
  const pane = toon(bin, "#4d4237");
  const concrete = toon(bin, CONCRETE);
  const armor = toon(bin, ARMOR);
  const glass = toon(bin, GLASS, { emissive: CYAN, emissiveIntensity: 0.12 });
  const solar = toon(bin, "#2f4550");
  const seam = glow(bin, CYAN);
  const craneYellow = toon(bin, "#e7b829");
  const steel = toon(bin, STEEL);
  const xray = [brick, roofMat];

  const box = (w: number, h: number, d: number, mat: Material, x = 0, y = 0, z = 0) => {
    const m = new Mesh(geo(bin, new BoxGeometry(w, h, d).translate(0, h / 2, 0)), mat);
    m.position.set(x, y, z);
    return m;
  };

  // --- the house: one part list, two eras ---------------------------------------------
  const parts: Part[] = [];
  const addPart = (x: number, y: number, z: number, start: number, dur: number, old: Object3D[], fresh: Object3D[], flagged = false) => {
    const pivot = new Object3D();
    pivot.position.set(x, y, z);
    const o = new Group();
    const f = new Group();
    o.add(...old);
    f.add(...fresh);
    pivot.add(o, f);
    object.add(pivot);
    parts.push({ pivot, old: o, fresh: f, start, dur, flagged });
  };

  // Foundation
  addPart(0, 0, 0, 0.5, 1.5, [box(10.6, 0.4, 8.6, concrete)], [box(10.6, 0.4, 8.6, armor), box(10.7, 0.06, 8.7, seam, 0, 0.32)]);
  // Walls, two floors: front, back, left, right.
  const wall = (y: number, start: number) => {
    const sides: [number, number, number, number][] = [
      [0, 4, 10, 0.3],
      [0, -4, 10, 0.3],
      [-5, 0, 0.3, 8],
      [5, 0, 0.3, 8],
    ];
    sides.forEach(([x, z, w, d], i) =>
      addPart(x, y, z, start + i * 0.6, 1.6, [box(w, 3, d, brick)], [box(w, 3, d, armor), box(w + 0.02, 0.07, d + 0.02, seam, 0, 2.9)])
    );
  };
  wall(0.4, 2);
  wall(3.4, 6);
  // Windows and the door, on the front face.
  const addWindow = (x: number, y: number, start: number) =>
    addPart(x, y, 4.16, start, 0.6, [box(1.4, 1.3, 0.12, timber), box(1.1, 1.0, 0.14, pane, 0, 0.15)], [box(2.6, 1.8, 0.12, armor), box(2.4, 1.6, 0.16, glass, 0, 0.1)]);
  addWindow(-3, 1.2, 10);
  addWindow(3, 1.2, 10.4);
  const doorFresh = toon(bin, ARMOR);
  addPart(0, 0.4, 4.16, 10.8, 0.6, [box(1.3, 2.2, 0.14, timber)], [box(1.7, 2.5, 0.12, doorFresh), box(1.4, 2.3, 0.16, glass)], true);
  addWindow(-3, 4.2, 11.2);
  addWindow(3, 4.2, 11.6);
  // Roof: pitched tiles → flat slab with solar panels.
  const pitched = new Mesh(geo(bin, roofGeometry()), roofMat);
  pitched.scale.set(10.8, 2.6, 8.8);
  const solarPanels: Object3D[] = [box(11, 0.35, 9, armor)];
  for (let i = 0; i < 6; i++) {
    const p = box(3, 0.12, 2.6, solar, -3.4 + (i % 3) * 3.4, 0.55, i < 3 ? -1.8 : 1.8);
    p.rotation.x = i < 3 ? 0.22 : -0.22;
    solarPanels.push(p);
  }
  addPart(0, 6.4, 0, 13, 2, [pitched], solarPanels);
  // Chimney → antenna mast.
  const mast = box(0.12, 3, 0.12, steel);
  const dish = new Mesh(geo(bin, new SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), armor);
  dish.position.y = 2;
  dish.rotation.x = 0.9;
  const tip = new Mesh(geo(bin, new SphereGeometry(0.12, 10, 8)), seam);
  tip.position.y = 3.05;
  addPart(3, 7, -1.5, 15.5, 1, [box(0.9, 2.8, 0.9, brick)], [mast, dish, tip]);
  const doorPart = parts.find((p) => p.flagged)!;

  // --- people and the machine ----------------------------------------------------------
  const architect = buildPerson(bin, { shirt: "#6c7a89", hat: "#f4f1ea" });
  const foreman = buildPerson(bin, { shirt: "#b25b3c" });
  const crew: Person[] = [buildPerson(bin, { shirt: "#5f7f99" }), buildPerson(bin, { shirt: "#7d8b56" })];
  const scaffoldCrew: Person[] = [buildPerson(bin, { shirt: "#5f7f99" }), buildPerson(bin, { shirt: "#8a6a4c" })];
  const chain: Person[] = [architect, foreman, ...crew];
  const chainAt: [number, number][] = [
    [-12, 6.4],
    [-8, 9],
    [-3.5, 8.5],
    [1.5, 6.6],
  ];
  chain.forEach((p, i) => {
    p.group.position.set(chainAt[i][0], 0, chainAt[i][1]);
    const next = chainAt[i + 1] ?? [0, 4];
    p.group.rotation.y = Math.atan2(next[0] - chainAt[i][0], next[1] - chainAt[i][1]);
    object.add(p.group);
  });
  scaffoldCrew[0].group.position.set(6.3, 3.35, 2);
  scaffoldCrew[1].group.position.set(-2, 3.35, 5.2);
  scaffoldCrew[0].group.rotation.y = -Math.PI / 2;
  scaffoldCrew[1].group.rotation.y = Math.PI;
  object.add(scaffoldCrew[0].group, scaffoldCrew[1].group);

  const owner = buildPerson(bin, { shirt: "#6d8a5a", hat: false });
  object.add(owner.group);
  const robot = buildBody(bin);
  robot.group.scale.setScalar(1.15);
  const toolbox = box(0.42, 0.28, 0.22, toon(bin, ORANGE));
  toolbox.position.y = -0.3;
  robot.armR.end.add(toolbox);
  object.add(robot.group);

  // --- stage 0 props: plan table, scaffold, crane -----------------------------------------
  const oldSite = new Group();
  object.add(oldSite);
  const table = new Group();
  table.position.set(-13.4, 0, 7.6);
  table.add(box(1.8, 0.08, 1.1, timber, 0, 0.95), box(0.08, 0.95, 0.08, timber, -0.8, 0, -0.45), box(0.08, 0.95, 0.08, timber, 0.8, 0, 0.45));
  const blueprint = box(1.5, 0.02, 0.9, toon(bin, "#a9c3d6"), 0, 1.03);
  table.add(blueprint);
  oldSite.add(table);

  const scaffold = new Group();
  for (let x = -5.5; x <= 5.6; x += 2.75) scaffold.add(box(0.1, 7, 0.1, steel, x, 0, 5.2));
  for (let z = -4; z <= 4.1; z += 2.66) scaffold.add(box(0.1, 7, 0.1, steel, 6.2, 0, z));
  for (const y of [3.2, 6.2]) {
    scaffold.add(box(11.6, 0.1, 0.9, timber, 0, y, 5.2));
    scaffold.add(box(0.9, 0.1, 8.4, timber, 6.2, y, 0));
  }
  oldSite.add(scaffold);

  const crane = new Group();
  crane.position.set(10, 0, -8);
  crane.add(box(0.9, 18, 0.9, craneYellow));
  const slew = new Object3D();
  slew.position.y = 18;
  crane.add(slew);
  slew.add(box(18, 0.5, 0.6, craneYellow, -5, 0, 0), box(1.4, 1.2, 1.2, steel, 0.6, -1.2, 0), box(1.6, 1.4, 1.2, concrete, 3.3, -1.0, 0));
  const hookLine = box(0.04, 1, 0.04, toon(bin, INK));
  hookLine.position.set(-12.8, 0, 0);
  hookLine.scale.y = -1;
  const pallet = box(1.4, 0.5, 1.0, brick);
  pallet.position.x = -12.8;
  slew.add(hookLine, pallet);
  oldSite.add(crane);

  const weeksLater = balloon(bin, "Weeks later…", "caption", { height: 0.9 });
  weeksLater.position.set(0, 12.5, 2);
  object.add(weeksLater);

  // --- bricks passed hand to hand -----------------------------------------------------------
  const brickGeo = geo(bin, new BoxGeometry(0.42, 0.2, 0.22));
  const lost = toon(bin, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.25 });
  type Brick = { mesh: Mesh; hop: number; t: number; falling: boolean; from: Vector3; to: Vector3; vy: number; landed: boolean };
  const bricks: Brick[] = [];
  const dropped: Brick[] = [];
  let spawnT = 0;
  const handOf = (i: number) => {
    const p = chain[i].group.position;
    return new Vector3(p.x, 1.2, p.z);
  };
  const wallTop = (t: number) => {
    // Where the house currently tops out (follows the build).
    const h = t < 6 ? 0.4 + clamp01((t - 2) / 4) * 3 : t < 10 ? 3.4 + clamp01((t - 6) / 4) * 3 : 6.4;
    return new Vector3(-4 + Math.random() * 8, h, 4);
  };

  // --- stage 2: x-ray wiring and the flags the human raised ---------------------------------
  const xrayGroup = new Group();
  object.add(xrayGroup);
  const wires: { mesh: Mesh; mat: MeshToonMaterial; x: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const pts = Array.from({ length: 6 }, (_, k) => new Vector3(-4.3 + ((k + i * 0.7) % 6) * 1.7 + Math.sin(i * 3 + k) * 0.6, 0.8 + ((i * 1.7 + k * 2.3) % 5), -3 + ((i * 2.1 + k * 1.3) % 6)));
    const mat = toon(bin, INK);
    const mesh = new Mesh(geo(bin, new TubeGeometry(new CatmullRomCurve3(pts), 48, 0.05, 5)), mat);
    xrayGroup.add(mesh);
    wires.push({ mesh, mat, x: pts.reduce((s, p) => s + p.x, 0) / pts.length });
  }
  const flag = (x: number, y: number, z: number, text: string) => {
    const g = new Group();
    g.position.set(x, y, z);
    g.add(box(0.06, 1.3, 0.06, toon(bin, INK)));
    const cloth = new Mesh(geo(bin, new PlaneGeometry(0.7, 0.45)), glow(bin, ORANGE));
    cloth.position.set(0.38, 1.05, 0);
    g.add(cloth);
    const tag = label(bin, text, { size: 0.36, background: "#fbf8f1", color: "#e8611e" });
    tag.position.set(0, 1.9, 0);
    g.add(tag);
    xrayGroup.add(g);
    return g;
  };
  const flagStatus = flag(-2.6, 0.4, 1.5, "status is free text");
  const flagCsv = flag(2.2, 3.4, -0.8, "don't hand-roll CSV");
  const beamPos = new Float32Array(9);
  const beamGeo = geo(bin, new BufferGeometry());
  beamGeo.setAttribute("position", new BufferAttribute(beamPos, 3));
  const beam = new Mesh(beamGeo, glow(bin, CYAN, 0.25));
  beam.frustumCulled = false;
  xrayGroup.add(beam);

  // --- stage 3: the manual plate by the door ---------------------------------------------------
  const plate = new Group();
  plate.position.set(2.75, 1.25, 4.33);
  plate.add(box(2.9, 1.7, 0.06, toon(bin, "#fbf8f1")));
  const RULES: [string, boolean][] = [
    ["status: free text, compare case-insensitively", false],
    ["CSV: use an audited dependency", false],
    ["routes.js: don't split it casually", true],
    ["auth: agents see only their own tickets", true],
  ];
  const plateLines = RULES.map(([text, human], i) => {
    const row = new Group();
    row.position.set(-1.3, 1.45 - i * 0.37, 0.05);
    row.add(box(0.12, 0.24, 0.02, glow(bin, human ? ORANGE : CYAN), 0, -0.12));
    const { texture, aspect } = textTexture(bin, text);
    const h = 0.17;
    const w = Math.min(2.45, h * aspect);
    const plane = new Mesh(geo(bin, new PlaneGeometry(w, h)), bin.add(new MeshBasicMaterial({ map: texture, transparent: true })));
    plane.position.set(0.15 + w / 2, 0, 0.01);
    row.add(plane);
    plate.add(row);
    return row;
  });
  object.add(plate);

  // --- stage 4: the plan, as a hologram over the house -------------------------------------------
  const holo = new Group();
  object.add(holo);
  const holoLine = bin.add(new LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9 }));
  const holoShape = new Group();
  for (const [w, h, d, y] of [
    [10.6, 6.0, 8.6, 0.4],
    [11.2, 0.35, 9.2, 6.4],
    [0.2, 3, 0.2, 6.8],
  ] as [number, number, number, number][]) {
    const e = new LineSegments(geo(bin, new EdgesGeometry(new BoxGeometry(w, h, d).translate(0, h / 2, 0))), holoLine);
    e.position.set(w < 1 ? 3 : 0, y, w < 1 ? -1.5 : 0);
    holoShape.add(e);
  }
  holoShape.add(box(10.7, 6.1, 8.7, glow(bin, CYAN, 0.07), 0, 0.4));
  holo.add(holoShape);
  const PANELS = ["?status= filter", "export.csv route", "dropdown + link", "same role scoping"];
  const panels = PANELS.map((text, i) => {
    const human = i === PANELS.length - 1;
    const hinge = new Object3D();
    hinge.position.set(-6 + i * 3.05, 8.6, 5.5);
    const col = human ? ORANGE : CYAN;
    const frame = new Mesh(geo(bin, new PlaneGeometry(2.9, 1.1).translate(1.45, 0, 0)), glow(bin, col, 0.16));
    const edge = new LineSegments(geo(bin, new EdgesGeometry(new PlaneGeometry(2.9, 1.1).translate(1.45, 0, 0))), bin.add(new LineBasicMaterial({ color: col })));
    const { texture, aspect } = textTexture(bin, text, { color: human ? "#e8611e" : "#1d8f9c" });
    const h = 0.32;
    const t = new Mesh(geo(bin, new PlaneGeometry(Math.min(2.6, h * aspect), h)), bin.add(new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })));
    t.position.set(1.45, 0, 0.02);
    hinge.add(frame, edge, t);
    holo.add(hinge);
    return hinge;
  });
  const reviewed = label(bin, "✓ reviewed before code", { size: 0.42, color: "#1f8a56", background: "#fbf8f1" });
  reviewed.position.set(0, 10.1, 5.5);
  holo.add(reviewed);

  // --- stage 5: the review scanner ------------------------------------------------------------------
  const scanner = new Mesh(geo(bin, new TorusGeometry(1.6, 0.07, 8, 40)), glow(bin, CYAN));
  object.add(scanner);
  const noGuard = label(bin, "no session check", { size: 0.38, color: "#e8611e", background: "#fbf8f1" });
  const guardOk = label(bin, "401 guard ✓", { size: 0.38, color: "#1f8a56", background: "#fbf8f1" });
  const bzzt = sfx(bin, "BZZT!", { color: "#e8611e", size: 0.8 });
  for (const s of [noGuard, guardOk, bzzt]) {
    s.position.set(0, 3.6, 5.4);
    object.add(s);
  }
  bzzt.position.set(1.6, 2.6, 5.6);

  const shout = balloon(bin, "Hold on — don't start yet!", "shout", { height: 1.1 });
  shout.position.set(-0.4, 3.4, 6.2);
  object.add(shout);

  // --- hotspots per stage ----------------------------------------------------------------------------
  const spots: Hotspot[][] = [
    [
      { term: "waterfall", label: "plan", anchor: anchor(object, -12.6, 2.2, 7) },
      { term: "work-breakdown", label: "divide", anchor: anchor(object, -8, 2.2, 9) },
      { term: "integration", label: "implement", anchor: anchor(object, 1.5, 2.2, 6.6) },
    ],
    [{ term: "human-in-the-loop", label: "the owner stops it", anchor: anchor(object, 0, 2.2, 5.2) }],
    [
      { term: "human-in-the-loop", label: "what the human knew", anchor: anchor(object, -2.6, 2.6, 1.5) },
      { term: "csv-injection", label: "hand-rolled CSV", anchor: anchor(object, 2.2, 5.6, -0.8) },
    ],
    [
      { term: "agents-md", label: "day-one knowledge", anchor: anchor(object, 2.75, 3.2, 4.4) },
      { term: "soft-rule", label: "still a written rule", anchor: anchor(object, 4.4, 1.6, 4.4) },
    ],
    [{ term: "human-in-the-loop", label: "review the plan", anchor: anchor(object, 4.2, 9.4, 5.5) }],
    [{ term: "code-review", label: "review", anchor: anchor(object, 0, 3.4, 5.6) }],
  ];

  // --- state -------------------------------------------------------------------------------------------
  let stage = 1;
  let t = 100; // seconds in the current stage; starts "long ago" so the house stands
  const tmp = new Vector3();
  const face = (o: Object3D, x: number, z: number, dt: number) => {
    const yaw = Math.atan2(x - o.position.x, z - o.position.z);
    let d = yaw - o.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    o.rotation.y += d * (1 - Math.exp(-8 * dt));
  };
  const show = (k: number, o: Object3D, mode: "y" | "all") => {
    o.visible = k > 0.001;
    if (mode === "y") o.scale.set(1, Math.max(0.001, k), 1);
    else o.scale.setScalar(Math.max(0.001, k));
  };
  const restBricks = () => {
    for (const b of [...bricks, ...dropped]) b.mesh.removeFromParent();
    bricks.length = 0;
    dropped.length = 0;
  };

  const updateBricks = (dt: number, lod: number) => {
    spawnT -= dt;
    if (lod < 2 && spawnT <= 0) {
      spawnT = lod === 0 ? 0.9 : 1.8;
      const mesh = new Mesh(brickGeo, brick);
      object.add(mesh);
      bricks.push({ mesh, hop: 0, t: 0, falling: false, from: handOf(0), to: handOf(1), vy: 0, landed: false });
    }
    for (let i = bricks.length - 1; i >= 0; i--) {
      const b = bricks[i];
      if (b.falling) {
        b.vy -= 18 * dt;
        b.mesh.position.y = Math.max(0.1, b.mesh.position.y + b.vy * dt);
        b.mesh.rotation.z += dt * 6;
        if (b.mesh.position.y <= 0.1) {
          b.mesh.rotation.set(0, Math.random() * 3, 0);
          bricks.splice(i, 1);
          dropped.push(b);
          if (dropped.length > 10) dropped.shift()!.mesh.removeFromParent();
        }
        continue;
      }
      b.t += dt / 0.7;
      const k = Math.min(1, b.t);
      tmp.copy(b.from).lerp(b.to, k);
      tmp.y += Math.sin(k * Math.PI) * 0.9;
      b.mesh.position.copy(tmp);
      b.mesh.rotation.y += dt * 3;
      if (k < 1) continue;
      b.hop++;
      if (b.hop >= chain.length) {
        b.mesh.removeFromParent();
        bricks.splice(i, 1);
        continue;
      }
      b.t = 0;
      b.from = handOf(b.hop);
      b.to = b.hop + 1 < chain.length ? handOf(b.hop + 1) : t < BUILD_DONE ? wallTop(t) : new Vector3(4.5, 0.6, 6.5);
      // Every hand-off between people can lose the piece.
      if (b.hop + 1 < chain.length && Math.random() < 0.14) {
        b.falling = true;
        b.vy = 1.5;
        b.mesh.material = lost;
      }
    }
  };

  return {
    object,
    get hotspots() {
      return spots[stage] ?? [];
    },
    update(ctx: CityFrame) {
      const dt = ctx.dt;
      if (ctx.stage !== null && ctx.stage !== stage) {
        stage = ctx.stage;
        t = 0;
        restBricks();
      }
      t += dt;
      const time = ctx.time;

      // House parts: old era builds (0), stands (1–4), swaps for new (5).
      const swapping = stage === 5;
      parts.forEach((p, i) => {
        let oldK = 1;
        let freshK = 0;
        if (stage === 0) oldK = easeOut((t - p.start) / p.dur);
        if (swapping) {
          const s = 1 + i * SWAP_GAP;
          oldK = 1 - clamp01((t - s) / 0.5);
          freshK = easeOut((t - s - 0.35) / 0.6);
        }
        const isRoof = i === parts.length - 2;
        show(oldK, p.old, i === 0 || (i >= 1 && i <= 8) ? "y" : "all");
        show(freshK, p.fresh, isRoof || i === 0 ? "y" : "all");
      });

      // The flagged door: arrives orange, is sent back up, returns green.
      const doorIdx = parts.indexOf(doorPart);
      const dStart = 1 + doorIdx * SWAP_GAP + 0.95;
      const dk = swapping ? t - dStart : -1;
      const rejected = dk > 0.4 && dk < 2.6;
      doorFresh.color.copy(ARMOR);
      if (swapping && dk > 0 && dk < 2.0) doorFresh.color.copy(ORANGE);
      else if (swapping && dk >= 2.0 && dk < 4) doorFresh.color.copy(GREEN).lerp(ARMOR, clamp01((dk - 3) / 1));
      doorPart.fresh.position.y = rejected ? Math.sin(((dk - 0.4) / 2.2) * Math.PI) * 2.4 : 0;
      noGuard.visible = swapping && dk > 0.2 && dk < 2.0;
      bzzt.visible = swapping && dk > 0.3 && dk < 1.1;
      guardOk.visible = swapping && dk >= 2.6 && dk < 6;

      // Scanner rides along the part being swapped.
      const current = Math.min(parts.length - 1, Math.max(0, Math.floor((t - 1) / SWAP_GAP)));
      scanner.visible = swapping && t < 1 + parts.length * SWAP_GAP + 3.5;
      if (scanner.visible) {
        const target = t > dStart && t < dStart + 2.6 ? doorPart.pivot : parts[current].pivot;
        target.getWorldPosition(tmp);
        object.worldToLocal(tmp);
        scanner.position.lerp(tmp.add(new Vector3(0, 1.2 + Math.sin(time * 4) * 0.8, 0.6)), 1 - Math.exp(-8 * dt));
        scanner.rotation.x = Math.PI / 2;
      }

      // Stage 0: people, crane, scaffold, bricks.
      const building = stage === 0;
      oldSite.visible = building;
      scaffold.visible = building && t < BUILD_DONE;
      weeksLater.visible = building && t > BUILD_DONE + 0.5;
      for (const p of [...chain, ...scaffoldCrew]) p.group.visible = building;
      if (ctx.lod >= 1) scaffoldCrew.forEach((p) => (p.group.visible = false));
      if (building) {
        updateBricks(dt, ctx.lod);
        chain.forEach((p, i) => {
          const toss = Math.max(0, Math.sin(time * 7 - i * 1.4));
          p.armR.rotation.x = -0.4 - toss * 1.1;
          p.armL.rotation.x = -0.4 - toss * 0.9;
        });
        scaffoldCrew.forEach((p, i) => (p.armR.rotation.x = -1.6 - Math.abs(Math.sin(time * 6 + i)) * 1.2));
        foreman.armL.rotation.z = Math.sin(time * 1.3) * 0.8; // pointing crews to their jobs
        slew.rotation.y = 0.67 + Math.sin(time * 0.35) * 0.6;
        const drop = 4 + (Math.sin(time * 0.7) * 0.5 + 0.5) * 10;
        hookLine.scale.y = drop;
        hookLine.position.y = -drop;
        pallet.position.y = -drop - 0.5;
      } else if (bricks.length || dropped.length) restBricks();

      // Owner and robot, per stage.
      owner.group.visible = stage >= 1;
      robot.group.visible = stage >= 1;
      robot.head.setEyes(1);
      robot.head.talk(0);
      robot.walk(0, 0);
      robot.reach("R", new Vector3(0.45, 0.9, 0.1), 0);
      robot.reach("L", new Vector3(-0.45, 0.9, 0.1), 0);
      owner.walk(0, 0);
      owner.armR.rotation.set(0, 0, 0);
      owner.armL.rotation.set(0, 0, 0);
      shout.visible = false;
      toolbox.visible = stage === 1;
      xrayGroup.visible = stage === 2;
      plate.visible = stage >= 3 && stage <= 4;
      holo.visible = stage === 4;

      if (stage === 1) {
        // The robot runs for the door; the owner steps out and stops it.
        const k = clamp01(t / 2.2);
        robot.group.position.set(9 - 6.5 * easeOut(k), 0, 15 - 7 * easeOut(k));
        face(robot.group, 0, 4, dt);
        robot.walk(time * 12, 1 - k);
        robot.reach("R", new Vector3(0.45, 0.75, 0.15), 0.4);
        const out = easeOut((t - 1.2) / 0.8);
        owner.group.position.set(0, 0, 4.4 + out * 1.4);
        owner.group.rotation.y = 0.5;
        owner.armR.rotation.set(-2.6 * out, 0, 0.3 * out);
        shout.visible = t > 1.6;
      } else if (stage === 2) {
        robot.group.position.set(7.5, 0, 9);
        face(robot.group, 0, 0, dt);
        owner.group.position.set(-4.5, 0, 8.5);
        face(owner.group, flagStatus.position.x, flagStatus.position.z, dt);
        owner.armR.rotation.x = -1.7;
        // X-ray: walls and roof go thin while the scan sweeps.
        const scanX = -5.5 + ((t * 2.4) % 11);
        for (const m of xray) {
          m.opacity = 0.2;
          m.depthWrite = false;
        }
        for (const w of wires) w.mat.color.copy(scanX > w.x ? CYAN : INK);
        // The flags are what the scan walked past; they don't light.
        flagCsv.rotation.y = Math.sin(time * 2) * 0.15;
        flagStatus.rotation.y = Math.sin(time * 2 + 1) * 0.15;
        robot.head.group.getWorldPosition(tmp);
        object.worldToLocal(tmp);
        beamPos.set([tmp.x, tmp.y, tmp.z, scanX, 0.4, 0, scanX, 6.6, 0]);
        beamGeo.attributes.position.needsUpdate = true;
        beamGeo.computeBoundingSphere();
      } else if (stage === 3) {
        // Two lines from the agent, then two the owner had to add.
        const shown = Math.min(4, Math.floor(t / 1.6) + 1);
        plateLines.forEach((row, i) => (row.visible = i < shown));
        const writer = shown <= 2 ? "robot" : "owner";
        robot.group.position.set(5.2, 0, 7);
        owner.group.position.set(1.0, 0, 6.6);
        face(robot.group, 3, 4.4, dt);
        face(owner.group, 2.6, 4.4, dt);
        if (writer === "robot") robot.reach("L", new Vector3(-0.4, 1.4, 0.9), 0.5 + Math.sin(time * 9) * 0.1);
        else owner.armR.rotation.x = -1.9 + Math.sin(time * 9) * 0.15;
      } else if (stage === 4) {
        plateLines.forEach((row) => (row.visible = true));
        robot.group.position.set(8, 0, 7);
        owner.group.position.set(-3.5, 0, 8.5);
        face(robot.group, 0, 3, dt);
        face(owner.group, 4, 5, dt);
        robot.neck.rotation.x = -0.4;
        holoShape.scale.set(1, Math.max(0.001, easeOut(t / 2.5)), 1);
        panels.forEach((hinge, i) => {
          const k = easeOut((t - 1 - i * 1.3) / 0.8);
          hinge.visible = k > 0.001;
          hinge.rotation.y = (1 - k) * (Math.PI / 2);
        });
        reviewed.visible = t > 1 + PANELS.length * 1.3 + 0.6;
        if (t > 1 + 3 * 1.3) owner.armR.rotation.x = -2.2; // the owner adds the last panel
      } else if (stage === 5) {
        robot.group.position.set(7.5, 0, 7);
        owner.group.position.set(-4.5, 0, 8.5);
        face(owner.group, 0, 2, dt);
        parts[current].pivot.getWorldPosition(tmp);
        object.worldToLocal(tmp);
        face(robot.group, tmp.x, tmp.z, dt);
        // Arm raised toward the part being fitted, while the swap runs.
        robot.reach("R", new Vector3(0.4, 1.5 + Math.sin(time * 5) * 0.1, 0.6), t < parts.length * SWAP_GAP + 1 ? 0.8 : 0);
      }
      if (stage !== 4) robot.neck.rotation.x = 0;
      if (stage !== 2) {
        for (const m of xray) {
          m.opacity = 1;
          m.depthWrite = true;
        }
      }
    },
    dispose: () => bin.dispose(),
  };
}

const vantages: Vantage[] = [
  // 0 · traditional: the whole site — plan table, crews, crane, house
  { eye: [-4, 13, 30], target: [-3.5, 4, 3] },
  // 1 · ask: the robot running for the door
  { eye: [10, 5, 22], target: [2, 2.6, 6] },
  // 2 · context: the x-ray scan, from the corner
  { eye: [17, 10, 19], target: [0, 3, 0.5] },
  // 3 · AGENT.md: the plate by the door
  { eye: [-3, 6.5, 17], target: [2.4, 2.4, 4.4] },
  // 4 · plan: the hologram and its panels
  { eye: [-10, 11, 25], target: [0, 5.6, 2] },
  // 5 · review: the renovated house
  { eye: [11, 7.5, 23], target: [0, 4, 1] },
];

export const houseSite: SiteDef = { id: "house", clear: 28, vantages, build: buildHouse };

