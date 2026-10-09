import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Sprite,
  TorusGeometry,
  Vector3,
  type Material,
} from "three";
import { backend } from "../../../v2/content/backend";
import { ARMOR, CONCRETE, CYAN, GLASS, GREEN, INK, ORANGE, STEEL } from "../../engine/palette";
import { anchor, Bin, geo, glow, label, sfx, textTexture, toon } from "../kit";
import { damp, type CityFrame, type CityRig, type Hotspot, type SiteDef, type Vantage } from "../rig";
import { buildBody, buildHead } from "../robotkit";

// The backend example as a building site in the east docks: a warehouse
// for a file manager, raised one part per real screenshot (55). Each
// backend step is a stage; arriving at a stage replays its parts one by one
// (cyan outline first, then the solid rises), earlier stages stand finished
// and later ones aren't there yet. Pointing at a screenshot in the panel
// lights the part it stands for. Site-local: front faces +z, the shed's
// footprint is 26 × 16 centred on the origin, eaves at 9, ridge at 11.

type V3 = [number, number, number];

interface PartDef {
  obj: Group;
  at: V3;
  /** Flies in from here instead of rising in place. */
  from?: V3;
  /** Parts of the same stage (local indices) this one takes the place of. */
  replaces?: number[];
}

interface Part extends PartDef {
  holder: Group;
  solid: Group;
  outline: Group;
  lineMat: LineBasicMaterial;
  baseY: number;
  top: Vector3;
  p: number;
  hiddenBy: number[];
}

const COUNTS = backend.steps.map((s) => s.evidence?.length ?? 0);
const SOUNDS = ["CLANK!", "WHIRR", "BZZT!", "KA-CHUNK", "SNAP!", "THUNK"];

// Decisions the human overrode, read from the screenshot labels/alts and
// the replay: “the overrides”, plan-mode tokens, no admin API, fully embedded.
const OVERRIDDEN = new Set([1, 5, 6, 7]);

const SPOTS: [string, string, V3][][] = [
  [["wayfinder", "wayfinder map", [0, 1, 0]], ["one-ticket-per-session", "one lot per decision", [9, 1, 4]]],
  [["grilling", "a recommendation per question", [-6, 1.5, 4]], ["human-in-the-loop", "the human overrides", [6, 1.5, -4]]],
  [["wayfinder", "map on GitHub", [-18, 5.5, 13]], ["one-ticket-per-session", "one ticket per session", [-15, 2, 13]]],
  [["subagent", "research in the background", [-9, 7, 12]], ["one-ticket-per-session", "one ticket, one session", [-13, 9, 8]]],
  [["agents-md", "AGENTS.md", [18, 3, -4]], ["repo-as-memory", "the repo carries the state", [0, 6, 3]]],
  [["maven-multi-module", "Maven multi-module", [0, 9.5, 8]], ["deep-module", "deep module", [-6.5, 6, -8]]],
  [["context-window", "the window spent on nothing", [-3, 2, 0]], ["context-engineering", "trim what loads", [6, 2, 4]]],
  [["spring-autoconfigure", "property picks the module", [4.5, 3, 11]], ["deep-module", "small interface, deep module", [0, 3.5, 8.4]]],
  [["one-ticket-per-session", "one decision, one session", [-6, 6, -2]], ["human-in-the-loop", "grilling is HITL", [6, 6, -2]]],
  [["spec-driven", "map → spec → tickets", [0, 11.5, 0]], ["worktree", "isolated worktree", [-13, 5, 0]]],
  [["guardrails", "enforced, not requested", [0, 6, 18]], ["human-in-the-loop", "the human can still choose", [5, 1.5, 14]]],
  [["maven-multi-module", "eleven modules", [0, 8, 8.5]], ["deep-module", "deep module", [-13, 5, 0]]],
];

export const VANTAGES: Vantage[] = [
  { eye: [10, 17, 31], target: [0, 0, 0] },
  { eye: [-12, 14, 28], target: [0, 0.5, 0] },
  { eye: [-6, 7, 29], target: [-15, 3, 10] },
  { eye: [-1, 7.5, 27], target: [-11, 4, 7] },
  { eye: [0, 15, 35], target: [0, 2, -1] },
  { eye: [16, 12, 27], target: [0, 4, 0] },
  { eye: [-14, 13, 24], target: [0, 1, 0] },
  { eye: [11, 6.5, 30], target: [0, 2, 10] },
  { eye: [-16, 10, 24], target: [0, 4, -2] },
  { eye: [19, 13, 31], target: [0, 5, 0] },
  { eye: [-9, 6.5, 35], target: [0, 2, 16] },
  { eye: [-21, 12, 32], target: [0, 5, 0] },
];

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

function buildWarehouse(): CityRig {
  const bin = new Bin();
  const object = new Group();
  const m = {
    slab: toon(bin, CONCRETE),
    floor: toon(bin, "#f0ece2"),
    steel: toon(bin, STEEL),
    dark: toon(bin, "#5e6466"),
    armor: toon(bin, ARMOR),
    glass: toon(bin, GLASS),
    ink: toon(bin, INK),
    orange: toon(bin, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.25 }),
    green: toon(bin, GREEN, { emissive: GREEN, emissiveIntensity: 0.2 }),
    cyan: glow(bin, CYAN),
    junk: [toon(bin, "#9a8f7e"), toon(bin, "#b7ab95"), toon(bin, "#7d7468")],
  };

  // --- small builders --------------------------------------------------------
  const boxes = new Map<string, BoxGeometry>();
  /** A box whose base sits at y. */
  const box = (w: number, h: number, d: number, mat: Material, x = 0, y = 0, z = 0): Mesh => {
    const key = `${w},${h},${d}`;
    let g = boxes.get(key);
    if (!g) boxes.set(key, (g = geo(bin, new BoxGeometry(w, h, d))));
    const mesh = new Mesh(g, mat);
    mesh.position.set(x, y + h / 2, z);
    return mesh;
  };
  const put = <T extends Object3D>(o: T, x: number, y: number, z: number): T => {
    o.position.set(x, y, z);
    return o;
  };
  const scaled = <T extends Object3D>(o: T, s: number): T => {
    o.scale.setScalar(s);
    return o;
  };
  const group = (...children: Object3D[]) => {
    const g = new Group();
    if (children.length) g.add(...children);
    return g;
  };
  const sign = (text: string, width: number, opts: { background?: string; color?: string } = {}): Mesh => {
    const { texture, aspect } = textTexture(bin, text, { background: opts.background ?? "#fbf8f1", color: opts.color, weight: "700" });
    const mat = bin.add(new MeshBasicMaterial({ map: texture }));
    return new Mesh(geo(bin, new PlaneGeometry(width, width / aspect)), mat);
  };
  const tag = (text: string, size = 0.5, y = 0) => {
    const s = label(bin, text, { size, background: "#fbf8f1" });
    s.position.y = y;
    return s;
  };
  const lights = (n: number, spacing: number, mat: Material, size = 0.32) => {
    const g = group();
    for (let i = 0; i < n; i++) g.add(box(size, size, 0.12, mat, (i - (n - 1) / 2) * spacing, 0, 0));
    return g;
  };

  // --- the parts, stage by stage (one per screenshot, in screenshot order) ----
  const at = (obj: Group | Object3D, pos: V3, extra: Partial<PartDef> = {}): PartDef => ({
    obj: obj instanceof Group ? obj : group(obj),
    at: pos,
    ...extra,
  });

  const stakes = () => {
    const g = group();
    const corners: V3[] = [[-13, 0, -8], [13, 0, -8], [13, 0, 8], [-13, 0, 8]];
    corners.forEach(([x, , z]) => g.add(box(0.2, 1.4, 0.2, m.steel, x, 0, z), box(0.5, 0.3, 0.04, m.orange, x + 0.27, 1.05, z)));
    g.add(box(26, 0.06, 0.08, m.orange, 0, 0.5, 8), box(26, 0.06, 0.08, m.orange, 0, 0.5, -8));
    g.add(box(0.08, 0.06, 16, m.orange, 13, 0.5, 0), box(0.08, 0.06, 16, m.orange, -13, 0.5, 0));
    return g;
  };
  const plots = () => {
    const g = group();
    for (const x of [-6.5, 0, 6.5]) g.add(box(0.12, 0.05, 16, m.cyan, x, 0.02, 0));
    g.add(box(26, 0.05, 0.12, m.cyan, 0, 0.02, 0));
    return g;
  };
  const slab = (k: number) => {
    const g = group(box(6.45, 0.5, 7.95, m.slab));
    if (OVERRIDDEN.has(k)) g.add(box(6.0, 0.05, 7.5, m.orange, 0, 0.5, 0), box(5.3, 0.06, 6.8, m.slab, 0, 0.5, 0));
    return at(g, [-9.75 + (k % 4) * 6.5, 0, k < 4 ? -4 : 4]);
  };

  const C2: V3 = [21, 0, -1];
  const C1: V3 = [-21, 0, -1];
  const portal = (x: number) => at(group(box(0.55, 9, 0.55, m.steel, 0, 0.5, -8), box(0.55, 9, 0.55, m.steel, 0, 0.5, 8), box(0.5, 0.6, 16.6, m.steel, 0, 9.2, 0)), [x, 0, 0]);
  const rafters = () => {
    const g = group(box(26.6, 0.4, 0.4, m.steel, 0, 11.2, 0));
    for (const x of [-13, -6.5, 0, 6.5, 13]) {
      for (const side of [-1, 1]) {
        const r = box(0.35, 0.35, 8.3, m.steel, x, 0, 0);
        r.position.set(x, 10.4, side * 4);
        r.rotation.x = side * Math.atan2(2, 8);
        g.add(r);
      }
    }
    return g;
  };
  const roofHalf = (side: number) => {
    const g = group();
    const panel = box(26.8, 0.25, 8.4, m.dark, 0, 0, 0);
    panel.position.set(0, 10.6, side * 4.1);
    panel.rotation.x = side * Math.atan2(2, 8);
    g.add(panel);
    return g;
  };
  const wall = (w: number, d: number, x: number, z: number) => group(box(w, 8.5, d, m.armor, x, 0.5, z), box(w + 0.04, 0.6, d + 0.04, m.glass, x, 5.6, z));

  // Dock pods move on an inner group so docking doesn't fight the build animation.
  const podLocal = group(box(3, 2.2, 2.4, m.armor), box(3.04, 0.4, 2.44, m.cyan, 0, 1.1, 0), tag("storage-local", 0.5, 3));
  const podS3 = group(box(3, 2.2, 2.4, m.armor), box(3.04, 0.4, 2.44, m.orange, 0, 1.1, 0), tag("storage-s3 (MinIO ok)", 0.5, 3));
  const lever = group(box(0.3, 2.4, 0.3, m.ink, 0, 0, 0));
  const leverArm = box(0.18, 1.4, 0.18, m.orange, 0, 0, 0);
  leverArm.position.set(0, 2.4, 0);
  lever.add(leverArm, tag("property selects", 0.42, 3.6));
  const barrier = group(box(7.2, 0.25, 0.25, m.orange, 3.6, 0, 0));
  barrier.position.set(-3.8, 1.3, 0);

  const stages: PartDef[][] = [
    // 0 · brief: survey the plot, then split it into lots — one per decision
    [at(stakes(), [0, 0, 0]), at(plots(), [0, 0, 0])],
    // 1 · grilling: eight foundation slabs; orange rim = the human overrode
    Array.from({ length: 8 }, (_, k) => slab(k)),
    // 2 · tracker: the site board for issue #1 and its tickets
    [
      at(group(box(0.3, 5.6, 0.3, m.steel, -2.6, 0, 0), box(0.3, 5.6, 0.3, m.steel, 2.6, 0, 0)), [-18, 0, 13]),
      at(group(box(6, 3.2, 0.2, m.armor, 0, 2.2, 0.1)), [-18, 0, 13]),
      at(group(put(sign("#1 File Manager Spec", 5.2), 0, 4.7, 0.25)), [-18, 0, 13]),
      at(group(put(lights(9, 0.55, m.cyan), 0, 3.0, 0.25), tag("#11 – #19", 0.42, 2.4)), [-18, 0, 13]),
    ],
    // 3 · baseline: a helper drone researching in the background; the first column
    [
      at(group(scaled(buildHead(bin).group, 0.6), new Mesh(geo(bin, new TorusGeometry(0.55, 0.05, 6, 24).rotateX(Math.PI / 2)), m.ink), tag("research", 0.4, 0.9)), [-9, 6, 12]),
      at(group(box(0.75, 9.5, 0.75, m.steel, 0, 0, 0), put(sign("ADR 0001", 1.4), 0, 2.2, 0.4)), [-13, 0, 8]),
    ],
    // 4 · handoff: the state is written down at Computer 2's cabin and carried to Computer 1's
    [
      at(group(box(1.2, 1.1, 0.8, m.dark), box(0.8, 1.0, 0.12, m.armor, 0, 1.1, 0), tag("issue-tracker.md", 0.4, 2.6)), [17, 0, 3]),
      at(group(box(0.2, 3, 0.2, m.ink), put(sign("AGENTS.md →", 2.2), 0.4, 2.6, 0.12)), [17.5, 0, -4.5]),
      at(group(box(1.8, 1.4, 1.4, m.dark), box(1.84, 0.2, 1.44, m.cyan, 0, 0.6, 0)), [17, 0, 3], { replaces: [0] }),
      at(group(box(0.6, 0.12, 0.6, m.green)), [17, 1.4, 3]),
      at(group(lights(3, 0.7, m.cyan, 0.4)), [C2[0], 2.2, C2[2] + 2.05]),
      at(group(box(1.8, 1.4, 1.4, m.dark), box(1.84, 0.2, 1.44, m.cyan, 0, 0.6, 0), box(0.6, 0.12, 0.6, m.green, 0, 1.4, 0)), [-17, 0, 3], { from: [17, 0, 3], replaces: [2, 3] }),
      at(group(lights(8, 0.5, m.cyan, 0.3), tag("#12 – #19", 0.4, -0.7)), [C1[0], 2.2, C1[2] + 2.05]),
    ],
    // 5 · modules: five portal frames, the long beams, the rafters, then "closed"
    [
      portal(-13),
      portal(-6.5),
      portal(0),
      portal(6.5),
      portal(13),
      at(group(box(26.6, 0.45, 0.45, m.steel, 0, 9.2, 8), box(26.6, 0.45, 0.45, m.steel, 0, 9.2, -8), box(26.6, 0.35, 0.35, m.steel, 0, 4.5, -8)), [0, 0, 0]),
      at(rafters(), [0, 0, 0]),
      at(group(box(0.12, 2, 0.12, m.ink, 0, 0, 0), box(1.2, 0.7, 0.05, m.green, 0.62, 1.25, 0)), [0, 11.4, 0]),
    ],
    // 6 · context hygiene: each screenshot hauls a pile off and lays clean floor
    [-9.75, -3.25, 3.25, 9.75].map((x) => at(group(box(6.3, 0.08, 15.6, m.floor)), [x, 0.5, 0])),
    // 7 · storage contract: socket, platform, two backends, the selector, the record
    [
      at(group(box(4.6, 3.4, 0.4, m.ink, 0, 0, 0), new Mesh(geo(bin, new TorusGeometry(0.9, 0.12, 8, 28)), m.cyan), tag("StorageBackend contract", 0.45, 4.1)), [0, 0.5, 8.5]),
      at(group(box(8, 0.9, 5, m.slab)), [0, 0, 11]),
      at(group(podLocal), [-8, 0, 14]),
      at(group(podS3), [8, 0, 14]),
      at(lever, [3.1, 0.9, 12.6]),
      at(group(box(0.15, 1.6, 0.15, m.ink), put(sign("PR #22 · ADR 0002", 2.2), 0, 1.9, 0.1)), [-3.1, 0.9, 12.6]),
    ],
    // 8 · decisions: mezzanine floors across the back, one per screenshot
    [-9.75, -3.25, 3.25, 9.75].map((x) =>
      at(group(box(6.3, 0.35, 7, m.slab, 0, 4.4, -4.5), box(6.3, 0.9, 0.08, m.steel, 0, 4.75, -1.05), box(0.3, 4.4, 0.3, m.steel, 0, 0, -1.3)), [x, 0.5, 0])
    ),
    // 9 · spec to code: walls and roof, then the ridge light for the next ticket
    [
      at(wall(26.6, 0.3, 0, -8.15), [0, 0, 0]),
      at(wall(0.3, 16, -13.15, 0), [0, 0, 0]),
      at(wall(0.3, 16, 13.15, 0), [0, 0, 0]),
      at(group(box(9.15, 8.5, 0.3, m.armor, -8.6, 0.5, 8.15), box(9.15, 8.5, 0.3, m.armor, 8.6, 0.5, 8.15), box(8.1, 4.5, 0.3, m.armor, 0, 4.5, 8.15)), [0, 0, 0]),
      at(roofHalf(1), [0, 0, 0]),
      at(roofHalf(-1), [0, 0, 0]),
      at(group(box(20, 0.25, 0.6, m.cyan, 0, 11.45, 0)), [0, 0, 0]),
    ],
    // 10 · refusal: the security gate on the driveway
    [at(group(box(0.6, 6, 0.6, m.steel, -4.2, 0, 0), box(0.6, 6, 0.6, m.steel, 4.2, 0, 0), box(9, 0.8, 0.6, m.ink, 0, 6, 0), put(sign("user-invocation only", 6), 0, 6.4, 0.32), barrier), [0, 0, 18])],
    // 11 · built: the name on the façade, then the eleven module bays lit
    [
      at(group(put(sign("spring-boot-file-manager", 12, { background: "#1b1a17", color: "#f2e2a0" }), 0, 0.8, 0)), [0, 9.3, 8.35]),
      at(group(lights(11, 2.3, m.cyan, 0.9)), [0, 7.2, 8.4]),
    ],
  ];

  if (import.meta.env.DEV) {
    stages.forEach((s, i) => {
      if (s.length !== COUNTS[i]) console.warn(`warehouse: stage ${i} has ${s.length} parts for ${COUNTS[i]} screenshots`);
    });
  }

  // --- assemble ---------------------------------------------------------------
  const cum = [0];
  stages.forEach((s) => cum.push(cum[cum.length - 1] + s.length));
  const edgesCache = new Map<string, EdgesGeometry>();
  const parts: Part[] = stages.flat().map((def) => {
    const holder = new Group();
    holder.position.set(...def.at);
    const solid = def.obj;
    holder.add(solid);
    solid.updateMatrixWorld(true);
    const lineMat = bin.add(new LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthWrite: false }));
    const outline = new Group();
    let minY = Infinity;
    let maxY = -Infinity;
    let cx = 0;
    let cz = 0;
    let n = 0;
    solid.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const g = o.geometry;
      let e = edgesCache.get(g.uuid);
      if (!e) edgesCache.set(g.uuid, (e = geo(bin, new EdgesGeometry(g, 30))));
      const line = new LineSegments(e, lineMat);
      line.matrixAutoUpdate = false;
      line.matrix.copy(o.matrixWorld);
      outline.add(line);
      g.computeBoundingBox();
      const bb = g.boundingBox!.clone().applyMatrix4(o.matrixWorld);
      minY = Math.min(minY, bb.min.y);
      maxY = Math.max(maxY, bb.max.y);
      cx += (bb.min.x + bb.max.x) / 2;
      cz += (bb.min.z + bb.max.z) / 2;
      n++;
    });
    holder.add(outline);
    holder.visible = false;
    object.add(holder);
    return { ...def, holder, solid, outline, lineMat, baseY: minY, top: new Vector3(cx / n, maxY, cz / n), p: 0, hiddenBy: [] };
  });
  stages.forEach((s, si) =>
    s.forEach((def, i) => def.replaces?.forEach((r) => parts[cum[si] + r].hiddenBy.push(cum[si] + i)))
  );

  // Clutter: unused tools and skills piling up inside, until stage 6 hauls it.
  const clutter = [-9.75, -3.25, 3.25, 9.75].map((x, k) => {
    const pile = group();
    for (let i = 0; i < 6; i++) {
      const s = 0.6 + ((i * 37 + k * 11) % 7) * 0.12;
      pile.add(box(s, s, s, m.junk[(i + k) % 3], ((i % 3) - 1) * 0.9, i > 2 ? 0.7 : 0, ((i * 5 + k) % 3) - 1));
    }
    pile.position.set(x, 0.5, 3 + (k % 2) * -5);
    pile.scale.setScalar(0.001);
    object.add(pile);
    return { pile, by: cum[6] + k, s: 0 };
  });

  // Two crew cabins for the handover, from stage 4 on.
  const cabins = [C2, C1].map((pos, i) => {
    const g = group(box(5, 3.2, 4, m.armor), box(5.4, 0.3, 4.4, m.dark, 0, 3.2, 0), box(1, 2, 0.1, m.ink, 1.3, 0, 2.02), tag(i === 0 ? "Computer 2" : "Computer 1", 0.6, 4.4));
    g.position.set(...pos);
    g.visible = false;
    object.add(g);
    return g;
  });

  // The crew: a robot on the ground and a drone with a welding beam.
  const worker = buildBody(bin);
  worker.group.scale.setScalar(1.3);
  worker.group.position.set(0, 0, 12);
  const drone = group(buildHead(bin).group, new Mesh(geo(bin, new TorusGeometry(0.75, 0.06, 6, 28).rotateX(Math.PI / 2)), m.ink));
  const beamMat = glow(bin, CYAN, 0.55);
  const beam = new Mesh(geo(bin, new CylinderGeometry(0.06, 0.18, 1, 8).translate(0, -0.5, 0)), beamMat);
  drone.add(beam);
  drone.position.set(4, 9, 10);
  object.add(worker.group, drone);

  // Gate traffic: requests in different words; only human-invoked ones pass.
  const requests = [
    { text: "user runs /implement", pass: true },
    { text: "agent: local copy", pass: false },
    { text: "“I order you”", pass: false },
    { text: "user edits the flag", pass: true },
  ].map((r) => {
    const pod = group(box(1.6, 0.9, 1.0, r.pass ? m.green : m.orange), tag(r.text, 0.42, 1.6));
    pod.visible = false;
    object.add(pod);
    return { ...r, pod };
  });

  const sounds: Sprite[] = SOUNDS.map((s, i) => {
    const sp = sfx(bin, s, { size: 1.6, color: i % 2 ? "#f2e2a0" : "#fbf8f1", tilt: i % 2 ? 0.08 : -0.08 });
    sp.userData.base = sp.scale.clone();
    sp.visible = false;
    object.add(sp);
    return sp;
  });
  const labelCache = new Map<number, Sprite>();

  const spotSets: Hotspot[][] = SPOTS.map((set) => set.map(([term, text, p]) => ({ term, label: text, anchor: anchor(object, ...p) })));

  // --- state ------------------------------------------------------------------
  let held = 0;
  let seqNext = cum[1]; // nothing queued
  let seqEnd = cum[1];
  let seqDelay = 0;
  let pop: { sprite: Sprite; t: number } | null = null;
  let shown: Sprite | null = null;
  for (let i = cum[0]; i < cum[1]; i++) parts[i].p = 1;

  const setStage = (s: number) => {
    held = s;
    // The current stage replays from its first part.
    for (let i = cum[s]; i < cum[s + 1]; i++) parts[i].p = 0;
    seqNext = cum[s];
    seqEnd = cum[s + 1];
    seqDelay = 0.8;
  };

  const tmp = new Vector3();
  const focusV = new Vector3();
  const hoverV = new Vector3();
  const walkTo = new Vector3(0, 0, 12);
  let walkPhase = 0;

  return {
    object,
    get hotspots() {
      return spotSets[held];
    },
    update(ctx: CityFrame) {
      const dt = ctx.dt;
      if (ctx.stage !== null && ctx.stage !== held && ctx.stage < stages.length) setStage(ctx.stage);

      // Earlier stages: standing (built fast if we jumped ahead). Later: gone.
      for (let i = 0; i < parts.length; i++) {
        if (i >= cum[held] && i < cum[held + 1]) continue;
        const target = i < cum[held] ? 1 : 0;
        const pt = parts[i];
        pt.p = target > pt.p ? Math.min(1, pt.p + dt * 2.5) : Math.max(0, pt.p - dt * 3);
      }
      // This stage: one part after another.
      let active: Part | null = null;
      if (seqNext < seqEnd) {
        seqDelay -= dt;
        if (seqDelay <= 0) {
          active = parts[seqNext];
          active.p = Math.min(1, active.p + dt / 1.3);
          if (active.p >= 1) {
            if (ctx.lod < 2) {
              pop = { sprite: sounds[seqNext % sounds.length], t: 0 };
              pop.sprite.position.copy(active.holder.position).add(active.top).add(tmp.set(0, 1.2, 0));
            }
            seqNext++;
            seqDelay = 0.25;
          }
        }
      }

      // Draw every part from its progress.
      const hi = ctx.evidence >= 0 && ctx.stage !== null ? cum[held] + ctx.evidence : -1;
      parts.forEach((pt, i) => {
        const gone = pt.hiddenBy.some((j) => parts[j].p > 0.5);
        pt.holder.visible = pt.p > 0.001 && !gone;
        if (!pt.holder.visible) return;
        const s = ease(clamp01((pt.p - 0.2) / 0.8));
        pt.solid.scale.y = Math.max(0.001, s);
        pt.solid.position.y = pt.baseY * (1 - s);
        if (pt.from) {
          const k = ease(pt.p);
          pt.holder.position.set(...pt.from).lerp(tmp.set(...pt.at), k);
          pt.holder.position.y += Math.sin(k * Math.PI) * 7;
          pt.solid.scale.y = 1;
          pt.solid.position.y = 0;
        }
        const lit = i === hi ? 0.65 + Math.sin(ctx.time * 6) * 0.35 : 0;
        pt.lineMat.opacity = Math.max(pt.p < 1 ? Math.min(1, pt.p * 5) * 0.95 : 0, lit);
        pt.outline.visible = pt.lineMat.opacity > 0.01;
        if (!pt.from) pt.holder.position.y = pt.at[1] + (i === hi ? 0.25 + Math.sin(ctx.time * 4) * 0.12 : 0);
      });

      // The hovered screenshot's label floats over its part.
      const want = hi >= 0 && hi < cum[held + 1] ? hi : -1;
      if (shown && (want < 0 || labelCache.get(want) !== shown)) {
        shown.visible = false;
        shown = null;
      }
      if (want >= 0) {
        let s = labelCache.get(want);
        if (!s) {
          const ev = backend.steps[held].evidence?.[ctx.evidence];
          s = label(bin, ev?.label ?? "", { size: 0.7, background: "#f2e2a0" });
          object.add(s);
          labelCache.set(want, s);
        }
        const pt = parts[want];
        s.position.copy(pt.holder.position).add(pt.top).add(tmp.set(0, 1.6, 0));
        s.visible = true;
        shown = s;
      }

      // Decor that belongs to stages rather than screenshots.
      for (const c of clutter) {
        const goal = held >= 1 && parts[c.by].p < 0.5 ? 1 : 0;
        c.s = damp(c.s, goal, 6, dt);
        c.pile.scale.setScalar(Math.max(0.001, c.s));
        c.pile.visible = c.s > 0.01;
      }
      cabins.forEach((c) => (c.visible = held >= 4));

      const detail = ctx.lod < 2;
      worker.group.visible = drone.visible = detail;
      if (pop) {
        pop.t += dt;
        const k = pop.t / 0.9;
        pop.sprite.visible = detail && k < 1;
        // Snap in big, drift up, fade.
        pop.sprite.material.opacity = 1 - Math.max(0, k - 0.6) / 0.4;
        const grow = Math.min(1, pop.t * 8);
        pop.sprite.scale.copy(pop.sprite.userData.base as Vector3).multiplyScalar(0.5 + 0.5 * grow);
        pop.sprite.position.y += dt * 0.6;
        if (k >= 1) {
          pop.sprite.visible = false;
          pop = null;
        }
      }

      if (detail) {
        // The crew follows whatever is being built; otherwise waits by the dock.
        const focus = active ? focusV.copy(active.holder.position).add(active.top) : null;
        if (focus) walkTo.set(focus.x * 0.85, 0, Math.max(focus.z + 3.5, -4));
        else walkTo.set(-2, 0, 13);
        const wp = worker.group.position;
        const d = Math.hypot(walkTo.x - wp.x, walkTo.z - wp.z);
        const moving = d > 0.4;
        if (moving) {
          const step = Math.min(d, dt * 4.5);
          wp.x += ((walkTo.x - wp.x) / d) * step;
          wp.z += ((walkTo.z - wp.z) / d) * step;
          worker.group.rotation.y = Math.atan2(walkTo.x - wp.x, walkTo.z - wp.z);
          walkPhase += dt * 9;
        } else if (focus) {
          worker.group.rotation.y = Math.atan2(focus.x - wp.x, focus.z - wp.z);
        }
        worker.walk(walkPhase, moving ? 1 : 0);
        worker.reach("R", new Vector3(0.4, 1.5, 0.6), focus && !moving ? 0.6 + Math.sin(ctx.time * 10) * 0.2 : 0);
        worker.head.setEyes(1);

        const hover = focus ? hoverV.set(focus.x, Math.max(focus.y + 2.6, 3.5), focus.z) : hoverV.set(4, 9 + Math.sin(ctx.time) * 0.3, 11);
        drone.position.x = damp(drone.position.x, hover.x, 3, dt);
        drone.position.y = damp(drone.position.y, hover.y, 3, dt);
        drone.position.z = damp(drone.position.z, hover.z, 3, dt);
        drone.rotation.y += dt * 0.8;
        beam.visible = !!focus;
        if (focus) beam.scale.y = Math.max(0.5, drone.position.y - focus.y);
        beamMat.opacity = 0.4 + Math.sin(ctx.time * 30) * 0.15;
      }

      // Stage 3's research drone bobs while it works.
      const research = parts[cum[3]];
      if (research.holder.visible) research.solid.position.y += Math.sin(ctx.time * 2) * 0.2;

      // Stage 7+: whichever backend the property selects docks; the other waits.
      const dockReady = held >= 7 && parts[cum[7] + 2].p >= 1 && parts[cum[7] + 3].p >= 1;
      const s3 = Math.floor(ctx.time / 4) % 2 === 1;
      const dock = (pod: Group, selected: boolean, side: number) => {
        const goalX = dockReady && selected ? -side * 8 : 0;
        const goalY = dockReady && selected ? 0.9 : 0;
        const goalZ = dockReady && selected ? -3 : 0;
        pod.position.x = damp(pod.position.x, goalX, 3, dt);
        pod.position.y = damp(pod.position.y, goalY, 3, dt);
        pod.position.z = damp(pod.position.z, goalZ, 3, dt);
      };
      dock(podLocal, !s3, -1);
      dock(podS3, s3, 1);
      leverArm.rotation.z = damp(leverArm.rotation.z, dockReady ? (s3 ? -0.5 : 0.5) : 0, 5, dt);

      // Stage 10+: requests reach the gate; the barrier turns back the re-worded ones.
      const gateReady = held >= 10 && parts[cum[10]].p >= 1 && detail;
      let blocking = false;
      requests.forEach((r, i) => {
        r.pod.visible = gateReady;
        if (!gateReady) return;
        const t = (ctx.time * 0.3 + i / requests.length) % 1;
        let z: number;
        if (r.pass) z = 30 - t * 18;
        else {
          z = t < 0.5 ? 30 - t * 2 * 11 : 19 + (t - 0.5) * 2 * 11;
          if (t > 0.35 && t < 0.65) blocking = true;
        }
        r.pod.position.set(i % 2 ? 1.2 : -1.2, 0, z);
      });
      barrier.rotation.z = damp(barrier.rotation.z, blocking ? 0 : 1.35, 6, dt);
    },
    dispose: () => bin.dispose(),
  };
}

export const warehouseSite: SiteDef = {
  id: "warehouse",
  vantages: VANTAGES,
  clear: 42,
  build: buildWarehouse,
};
