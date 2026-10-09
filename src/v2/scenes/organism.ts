import {
  BufferGeometry,
  Color,
  DodecahedronGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  Vector3,
} from "three";
import { GREEN, INK, ORANGE, PAPER } from "../engine/palette";
import { Bin, anchor, geo, label, matte, tint } from "./kit";
import { damp, num, str, type FrameContext, type Hotspot, type RigFactory } from "./rig";

/**
 * The agent as a creature. A paper bell with ink ribs and beaded tentacles
 * runs the loop the step describes: think (the bell contracts and throws
 * out rings — more rings at higher effort), act (a tentacle reaches for a
 * tool artifact), observe (the artifact answers green and a droplet climbs
 * back up). Every lap re-reads everything before it, so the bead ring of
 * tokens around its rim grows faster than the work does. It drifts toward
 * the cursor.
 *
 * Modes: agent · subagents · trio (Haiku/Sonnet/Opus temperaments).
 */

const SEGMENTS = 11;
const toolShapes = [
  () => new OctahedronGeometry(0.34),
  () => new TorusKnotGeometry(0.2, 0.07, 48, 6),
  () => new DodecahedronGeometry(0.32),
  () => new TetrahedronGeometry(0.4),
  () => new IcosahedronGeometry(0.3, 0),
];

interface Tool {
  mesh: Mesh;
  mat: MeshStandardMaterial;
  home: Vector3;
  glow: number;
}

type Phase = "think" | "act" | "observe" | "answer";

class Creature {
  readonly group = new Group();
  readonly bell: Mesh;
  private bellGeo: SphereGeometry;
  private bellBase: Float32Array;
  private ribs: LineSegments;
  private beads: InstancedMesh;
  private strands: LineSegments;
  private tokenRing: InstancedMesh;
  private thoughtRings: Mesh[] = [];
  private chains: Vector3[][] = [];
  private prev: Vector3[][] = [];
  phase: Phase = "think";
  phaseT = 0;
  lap = 0;
  tokens = 0;
  activeTool = -1;
  droplet = -1;
  answer: Mesh;
  private home = new Vector3();
  private m = new Matrix4();
  private c = new Color();

  constructor(
    bin: Bin,
    readonly size: number,
    readonly tempo: number,
    readonly tools: Tool[],
    private tentacles = 6
  ) {
    this.bellGeo = geo(bin, new SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55));
    this.bellBase = this.bellGeo.attributes.position.array.slice() as Float32Array;
    this.bell = new Mesh(this.bellGeo, matte(bin, PAPER, { flat: false }));
    (this.bell.material as MeshStandardMaterial).side = 2;
    this.group.add(this.bell);

    // Ink ribs: meridian lines over the bell, redrawn as it pulses.
    const ribGeo = geo(bin, new BufferGeometry());
    ribGeo.setAttribute("position", new Float32BufferAttribute(new Float32Array(12 * 8 * 2 * 3), 3));
    this.ribs = new LineSegments(ribGeo, bin.add(new LineBasicMaterial({ color: INK })));
    this.group.add(this.ribs);

    for (let t = 0; t < tentacles; t++) {
      const a = (t / tentacles) * Math.PI * 2;
      const chain = Array.from({ length: SEGMENTS }, (_, k) => new Vector3(Math.cos(a) * 0.6, -k * 0.28, Math.sin(a) * 0.6));
      this.chains.push(chain);
      this.prev.push(chain.map((p) => p.clone()));
    }
    this.beads = new InstancedMesh(geo(bin, new SphereGeometry(0.06, 8, 6)), matte(bin, 0xffffff), tentacles * SEGMENTS);
    this.beads.instanceMatrix.setUsage(DynamicDrawUsage);
    this.group.add(this.beads);
    // An ink strand threads each tentacle's beads so it reads as one limb.
    const strandGeo = geo(bin, new BufferGeometry());
    strandGeo.setAttribute("position", new Float32BufferAttribute(new Float32Array(tentacles * (SEGMENTS - 1) * 2 * 3), 3));
    this.strands = new LineSegments(strandGeo, bin.add(new LineBasicMaterial({ color: INK })));
    this.strands.frustumCulled = false;
    this.group.add(this.strands);

    this.tokenRing = new InstancedMesh(geo(bin, new SphereGeometry(0.05, 6, 4)), matte(bin, ORANGE), 240);
    this.tokenRing.count = 0;
    this.group.add(this.tokenRing);

    const ringGeo = geo(bin, new TorusGeometry(1.1, 0.02, 6, 64).rotateX(Math.PI / 2));
    for (let k = 0; k < 5; k++) {
      const ring = new Mesh(ringGeo, matte(bin, INK, { transparent: true, opacity: 0 }));
      this.thoughtRings.push(ring);
      this.group.add(ring);
    }

    this.answer = new Mesh(geo(bin, new IcosahedronGeometry(0.22, 1)), matte(bin, GREEN));
    this.answer.visible = false;
    this.group.add(this.answer);
    this.group.scale.setScalar(size);
  }

  setHome(x: number, y: number, z: number): void {
    this.home.set(x, y, z);
    this.group.position.copy(this.home);
  }

  /** Advances the think→act→observe loop; returns true when an answer surfaces. */
  step(ctx: FrameContext, loopSteps: number, effort: number): boolean {
    const dt = ctx.dt * this.tempo;
    this.phaseT += dt;
    const thinkTime = 0.5 + effort * 0.35;
    let answered = false;
    switch (this.phase) {
      case "think":
        if (this.phaseT > thinkTime) {
          this.phase = this.lap >= loopSteps ? "answer" : "act";
          this.phaseT = 0;
          this.activeTool = this.tools.length ? (this.lap * 2 + 1) % this.tools.length : -1;
        }
        break;
      case "act":
        if (this.phaseT > 1.1) {
          this.phase = "observe";
          this.phaseT = 0;
          if (this.activeTool >= 0) this.tools[this.activeTool].glow = 1;
          this.droplet = 0;
        }
        break;
      case "observe":
        this.droplet = Math.min(1, this.phaseT / 0.8);
        if (this.phaseT > 0.8) {
          this.lap++;
          // Agentic token multiplication: each lap re-sends the growing context.
          this.tokens = Math.min(240, this.tokens + 4 + this.lap * 3 + Math.round(effort * 2));
          this.phase = "think";
          this.phaseT = 0;
          this.activeTool = -1;
          this.droplet = -1;
        }
        break;
      case "answer":
        if (this.phaseT > 2.2) {
          this.lap = 0;
          this.tokens = 0;
          this.phase = "think";
          this.phaseT = 0;
          answered = true;
        }
        break;
    }
    this.draw(ctx, effort, dt);
    return answered;
  }

  private draw(ctx: FrameContext, effort: number, dt: number): void {
    const t = ctx.time * this.tempo;
    // Drift toward the pointer, within a leash.
    const goal = this.home.clone();
    if (ctx.pointer) {
      const pull = ctx.pointer.clone().setY(this.home.y).sub(this.home).clampLength(0, 1.6);
      goal.add(pull);
    }
    goal.y += Math.sin(t * 0.9) * 0.15;
    this.group.position.x = damp(this.group.position.x, goal.x, 1.4, dt);
    this.group.position.y = damp(this.group.position.y, goal.y, 1.4, dt);
    this.group.position.z = damp(this.group.position.z, goal.z, 1.4, dt);

    // Bell pulse: contracts while thinking.
    const thinking = this.phase === "think" ? Math.sin((this.phaseT / (0.5 + effort * 0.35)) * Math.PI) : 0;
    const squeeze = 1 - thinking * 0.16 + Math.sin(t * 2.2) * 0.03;
    const arr = this.bellGeo.attributes.position.array as Float32Array;
    const b = this.bellBase;
    for (let i = 0; i < arr.length; i += 3) {
      const lip = 1 - Math.max(0, b[i + 1]);
      const wob = Math.sin(Math.atan2(b[i + 2], b[i]) * 5 + t * 2) * 0.03 * lip;
      arr[i] = b[i] * (squeeze + wob);
      arr[i + 2] = b[i + 2] * (squeeze + wob);
      arr[i + 1] = b[i + 1] * (1 + thinking * 0.12);
    }
    this.bellGeo.attributes.position.needsUpdate = true;
    if (ctx.lod === 0) this.bellGeo.computeVertexNormals();
    this.drawRibs(squeeze, thinking);

    // Thought rings: one per effort level, rippling outward while thinking.
    this.thoughtRings.forEach((ring, k) => {
      const on = this.phase === "think" && k < effort;
      const u = (this.phaseT * 1.4 + k * 0.22) % 1;
      ring.scale.setScalar(1 + u * 1.6);
      ring.position.y = 0.2 - u * 0.3;
      const mat = ring.material as MeshStandardMaterial;
      mat.opacity = damp(mat.opacity, on ? (1 - u) * 0.6 : 0, 8, dt);
    });

    // Tentacles: verlet chains hanging from the rim; the active one reaches.
    const inv = 1 / this.size;
    this.chains.forEach((chain, ti) => {
      const a = (ti / this.tentacles) * Math.PI * 2 + Math.sin(t * 0.3) * 0.2;
      chain[0].set(Math.cos(a) * 0.82 * squeeze, -0.05, Math.sin(a) * 0.82 * squeeze);
      const reach = this.activeTool >= 0 && ti === this.activeTool % this.tentacles && (this.phase === "act" || this.phase === "observe");
      const tool = reach ? this.tools[this.activeTool] : null;
      const target = tool
        ? tool.mesh.position.clone().sub(this.group.position).multiplyScalar(inv)
        : null;
      const prev = this.prev[ti];
      for (let k = 1; k < SEGMENTS; k++) {
        const p = chain[k];
        const vel = p.clone().sub(prev[k]).multiplyScalar(0.92);
        prev[k].copy(p);
        p.add(vel);
        p.y -= 0.9 * dt * (reach ? 0.2 : 1);
        p.x += Math.sin(t * 1.3 + k * 0.6 + ti) * 0.004;
        p.z += Math.cos(t * 1.1 + k * 0.5 + ti) * 0.004;
        if (target && k === SEGMENTS - 1) {
          const strength = this.phase === "act" ? Math.min(1, this.phaseT * 1.5) : 1;
          p.lerp(target, 0.25 * strength);
        }
      }
      // Constraint passes keep segment lengths fixed.
      const len = reach ? 0.42 : 0.26;
      for (let it = 0; it < 3; it++) {
        for (let k = 1; k < SEGMENTS; k++) {
          const d = chain[k].clone().sub(chain[k - 1]);
          const l = d.length() || 1e-4;
          chain[k].copy(chain[k - 1]).addScaledVector(d, len / l);
        }
      }
      for (let k = 0; k < SEGMENTS; k++) {
        const s = 1 - k / SEGMENTS * 0.6;
        this.m.makeScale(s, s, s).setPosition(chain[k]);
        this.beads.setMatrixAt(ti * SEGMENTS + k, this.m);
        // The observation droplet climbs the reaching tentacle.
        const dropK = Math.round((1 - this.droplet) * (SEGMENTS - 1));
        const lit = reach && this.droplet >= 0 && k === dropK;
        this.beads.setColorAt(ti * SEGMENTS + k, this.c.copy(lit ? ORANGE : INK));
      }
    });
    this.beads.instanceMatrix.needsUpdate = true;
    if (this.beads.instanceColor) this.beads.instanceColor.needsUpdate = true;
    const sp = this.strands.geometry.attributes.position;
    const sa = sp.array as Float32Array;
    let w = 0;
    for (const chain of this.chains) {
      for (let k = 1; k < SEGMENTS; k++) {
        sa[w++] = chain[k - 1].x; sa[w++] = chain[k - 1].y; sa[w++] = chain[k - 1].z;
        sa[w++] = chain[k].x; sa[w++] = chain[k].y; sa[w++] = chain[k].z;
      }
    }
    sp.needsUpdate = true;

    // Token beads ring the rim; it keeps growing until the answer lands.
    this.tokenRing.count = this.tokens;
    for (let k = 0; k < this.tokens; k++) {
      const a = k * 0.26 + t * 0.2;
      const r = 1.25 + Math.floor(k / 24) * 0.12;
      this.m.makeTranslation(Math.cos(a) * r, -0.1 + Math.sin(k) * 0.04, Math.sin(a) * r);
      this.tokenRing.setMatrixAt(k, this.m);
    }
    this.tokenRing.instanceMatrix.needsUpdate = true;

    this.answer.visible = this.phase === "answer";
    if (this.answer.visible) {
      this.answer.position.set(0, 1 + this.phaseT * 1.1, 0);
      this.answer.rotation.y += dt * 2;
    }
  }

  private drawRibs(squeeze: number, thinking: number): void {
    const attr = this.ribs.geometry.attributes.position;
    const arr = attr.array as Float32Array;
    let i = 0;
    for (let r = 0; r < 12; r++) {
      const a = (r / 12) * Math.PI * 2;
      for (let s = 0; s < 8; s++) {
        for (const ss of [s, s + 1]) {
          const th = (ss / 8) * Math.PI * 0.55;
          const rad = Math.sin(th) * squeeze * 1.005;
          arr[i++] = Math.cos(a) * rad;
          arr[i++] = Math.cos(th) * (1 + thinking * 0.12);
          arr[i++] = Math.sin(a) * rad;
        }
      }
    }
    attr.needsUpdate = true;
  }
}

function makeTools(bin: Bin, object: Group, names: string[], center: Vector3, radius: number, hotspots: Hotspot[]): Tool[] {
  return names.map((name, k) => {
    const a = (k / names.length) * Math.PI * 1.6 - Math.PI * 0.8 - Math.PI / 2;
    const mat = matte(bin, INK, { flat: true });
    const mesh = new Mesh(geo(bin, toolShapes[k % toolShapes.length]()), mat);
    const home = new Vector3(center.x + Math.cos(a) * radius, 0.9 + (k % 2) * 0.5, center.z + Math.sin(a) * radius * 0.7);
    mesh.position.copy(home);
    object.add(mesh);
    const tag = label(bin, name, { size: 0.3 });
    tag.position.copy(home).add(new Vector3(0, 0.62, 0));
    object.add(tag);
    if (k === 0) hotspots.push({ term: "tool-use", label: "tool call", anchor: anchor(object, home.x, home.y + 0.2, home.z) });
    return { mesh, mat, home, glow: 0 };
  });
}

function animateTools(tools: Tool[], ctx: FrameContext): void {
  tools.forEach((tool, k) => {
    tool.glow = Math.max(0, tool.glow - ctx.dt * 0.8);
    tool.mesh.rotation.y += ctx.dt * (0.4 + k * 0.1);
    tool.mesh.rotation.x += ctx.dt * 0.2;
    tool.mesh.position.y = tool.home.y + Math.sin(ctx.time * 0.8 + k) * 0.12;
    tint(tool.mat, INK, GREEN, tool.glow);
    tool.mesh.scale.setScalar(1 + tool.glow * 0.35);
  });
}

export const organism: RigFactory = (preset) => {
  const mode = str(preset, "mode", "agent");
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];

  if (mode === "trio") {
    const specs = [
      { name: "Haiku · fast", size: 0.55, tempo: 2.2, x: -3.6 },
      { name: "Sonnet · balanced", size: 0.85, tempo: 1.3, x: 0 },
      { name: "Opus · deep", size: 1.2, tempo: 0.75, x: 3.8 },
    ];
    const creatures = specs.map((s) => {
      const c = new Creature(bin, s.size, s.tempo, []);
      c.setHome(s.x, 2.4 + s.size, 0);
      object.add(c.group);
      const tag = label(bin, s.name, { size: 0.34 });
      tag.position.set(s.x, 0.4, 1.2);
      object.add(tag);
      return c;
    });
    hotspots.push(
      { term: "model-tiers", label: "capability tier", anchor: anchor(object, 0, 4.4, 0) },
      { term: "reasoning-effort", label: "effort = rings", anchor: anchor(object, 3.8, 1.2, 0) }
    );
    return {
      object,
      hotspots,
      dispose: () => bin.dispose(),
      update(ctx) {
        creatures.forEach((c) => c.step({ ...ctx, pointer: null }, 0, ctx.params.effort));
      },
    };
  }

  const toolNames = str(preset, "tools", "Read,Grep,Edit,Bash,WebFetch").split(",");
  const reach = num(preset, "reach", mode === "subagents" ? 2.6 : 4.2);
  const tools = makeTools(bin, object, toolNames, new Vector3(0, 0, mode === "subagents" ? -1.4 : 0), reach, hotspots);
  const main = new Creature(bin, 1, 1, tools);
  main.setHome(0, 3.0, -0.4);
  object.add(main.group);
  hotspots.push(
    { term: "agent-loop", label: "think → act → observe", anchor: anchor(object, 0, 4.4, -0.4) },
    { term: "token-multiplication", label: "context grows per lap", anchor: anchor(object, 1.4, 2.8, -0.4) }
  );

  if (mode === "subagents") {
    // Three buds, each with its own small tool cluster and its own context.
    const kids = [-1, 0, 1].map((side, k) => {
      const kidTools = makeTools(bin, object, [["Grep", "Read"], ["Read", "Bash"], ["WebFetch", "Read"]][k], new Vector3(side * 3.4, 0, 2.6), 0.9, []);
      kidTools.forEach((t) => t.mesh.scale.setScalar(0.6));
      const kid = new Creature(bin, 0.42, 1.6, kidTools, 4);
      kid.setHome(side * 3.4, 2.0, 2.0);
      object.add(kid.group);
      return { kid, kidTools, summary: 0 };
    });
    hotspots.push({ term: "subagent", label: "sub-agent, own context", anchor: anchor(object, 3.4, 2.8, 2.0) });
    return {
      object,
      hotspots,
      dispose: () => bin.dispose(),
      update(ctx) {
        animateTools(tools, ctx);
        // The parent only takes one condensed summary back per child, so
        // its own token ring stays small while the children's churn.
        main.step(ctx, 1, ctx.params.effort);
        kids.forEach((k) => {
          animateTools(k.kidTools, ctx);
          if (k.kid.step({ ...ctx, pointer: null }, ctx.params.loopSteps, ctx.params.effort)) {
            main.tokens = Math.min(240, main.tokens + 2);
          }
        });
      },
    };
  }

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx) {
      animateTools(tools, ctx);
      main.step(ctx, ctx.params.loopSteps, ctx.params.effort);
    },
  };
};
