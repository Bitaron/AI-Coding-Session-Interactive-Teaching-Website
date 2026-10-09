import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshToonMaterial,
  Object3D,
  SphereGeometry,
  Sprite,
  TorusGeometry,
  Vector3,
} from "three";
import { ARMOR, CYAN, GREEN, INK, STEEL } from "../engine/palette";
import { anchor, balloon, Bin, geo, glow, label, toon } from "./kit";
import { damp, str, type CityFrame, type CityRigFactory, type Hotspot } from "./rig";
import { buildBody, type RobotBody } from "./robotkit";

/**
 * The agent, as a robot head with hands and legs. It runs the loop the
 * step describes: think (comic thought balloons — one per effort level),
 * walk to a tool bench, use the tool, carry the result chip back. Every lap
 * re-reads everything before it, so the chest token meter fills faster than
 * the work does. After `loopSteps` laps a green answer balloon pops.
 *
 * Modes: agent · subagents (three helpers, each hands back one chip) ·
 * trio (small quick / balanced / big deliberate builds).
 */

type Phase = "think" | "walk" | "use" | "return" | "answer" | "deliver" | "back";

interface Bench {
  pos: Vector3;
  toolMat: MeshToonMaterial;
  glow: number;
  prop: Object3D;
}

const THOUGHTS = 5;
const PROP = new Color(INK);

/** A small table with a tool on it; the tool's shape hints at what it does. */
function makeBench(bin: Bin, parent: Group, name: string, pos: Vector3, tag: boolean): Bench {
  const g = new Group();
  g.position.copy(pos);
  parent.add(g);
  const steel = toon(bin, STEEL);
  const top = new Mesh(geo(bin, new BoxGeometry(1.0, 0.08, 0.62)), toon(bin, ARMOR));
  top.position.y = 0.78;
  const leg = new Mesh(geo(bin, new CylinderGeometry(0.07, 0.16, 0.76, 10)), steel);
  leg.position.y = 0.38;
  g.add(top, leg);
  const toolMat = toon(bin, INK);
  const prop = new Group();
  prop.position.y = 0.95;
  const n = name.toLowerCase();
  if (n.includes("grep") || n.includes("lazyweb")) {
    // Magnifier
    const ring = new Mesh(geo(bin, new TorusGeometry(0.14, 0.035, 8, 20)), toolMat);
    ring.rotation.x = -0.6;
    ring.position.y = 0.12;
    const handle = new Mesh(geo(bin, new CylinderGeometry(0.03, 0.03, 0.22, 6)), toolMat);
    handle.position.set(0.12, 0.0, 0.05);
    handle.rotation.z = 0.9;
    prop.add(ring, handle);
  } else if (n.includes("read") || n.includes("gh ")) {
    // A stack of pages
    for (let i = 0; i < 3; i++) {
      const page = new Mesh(geo(bin, new BoxGeometry(0.34, 0.03, 0.44)), i === 2 ? toolMat : toon(bin, ARMOR));
      page.position.set(i * 0.02, i * 0.04, -i * 0.01);
      page.rotation.y = i * 0.12;
      prop.add(page);
    }
  } else if (n.includes("bash") || n.includes("playwright")) {
    // A terminal: dark screen with a cyan prompt line
    const screen = new Mesh(geo(bin, new BoxGeometry(0.46, 0.32, 0.05)), toolMat);
    screen.position.y = 0.18;
    const line = new Mesh(geo(bin, new BoxGeometry(0.24, 0.035, 0.01)), glow(bin, CYAN));
    line.position.set(-0.05, 0.2, 0.03);
    prop.add(screen, line);
  } else if (n.includes("web")) {
    const globe = new Mesh(geo(bin, new SphereGeometry(0.16, 12, 8)), toolMat);
    globe.position.y = 0.16;
    const band = new Mesh(geo(bin, new TorusGeometry(0.2, 0.02, 6, 24)), toon(bin, STEEL));
    band.position.y = 0.16;
    band.rotation.x = 1.2;
    prop.add(globe, band);
  } else {
    // Edit / Write / anything else: a wrench
    const shaft = new Mesh(geo(bin, new BoxGeometry(0.06, 0.04, 0.38)), toolMat);
    const jaw = new Mesh(geo(bin, new TorusGeometry(0.08, 0.035, 6, 12, Math.PI * 1.4)), toolMat);
    jaw.rotation.x = -Math.PI / 2;
    jaw.position.z = -0.22;
    prop.add(shaft, jaw);
    prop.position.y = 0.86;
  }
  g.add(prop);
  if (tag) {
    const t = label(bin, name, { size: 0.28 });
    t.position.set(0, 1.62, 0);
    g.add(t);
  }
  return { pos, toolMat, glow: 0, prop };
}

/** One walking, thinking robot and its loop state. */
class Bot {
  readonly root = new Group();
  readonly body: RobotBody;
  private thoughts: Sprite[] = [];
  private thoughtAspect = 1;
  private answer: Sprite;
  private chip: Mesh;
  phase: Phase = "think";
  phaseT = 0;
  lap = 0;
  /** Context carried so far, in v2's bead units (0–240). */
  tokens = 0;
  private bench = -1;
  private walkPhase = 0;
  private goal = new Vector3();
  private tmp = new Vector3();
  /** Called when a helper hands its chip over (subagents mode). */
  onDeliver: (() => void) | null = null;

  constructor(
    bin: Bin,
    private scale: number,
    private tempo: number,
    private benches: Bench[],
    readonly home: Vector3,
    private deliverTo: Vector3 | null = null,
    armor?: Color
  ) {
    this.body = buildBody(bin, { armor });
    this.root.add(this.body.group);
    this.root.scale.setScalar(scale);
    this.root.position.copy(home);
    for (let k = 0; k < THOUGHTS; k++) {
      const b = balloon(bin, "…", "thought", { height: 0.42, tail: "none" });
      b.visible = false;
      this.root.add(b);
      this.thoughtAspect = b.scale.x / b.scale.y;
      this.thoughts.push(b);
    }
    this.answer = balloon(bin, "answer ✓", "robot", { height: 0.5, color: "#1f8a56", tail: "left" });
    this.answer.visible = false;
    this.root.add(this.answer);
    this.chip = new Mesh(geo(bin, new BoxGeometry(0.16, 0.16, 0.16)), glow(bin, CYAN));
    this.chip.visible = false;
    this.body.armR.end.add(this.chip);
  }

  /** Advances the loop; returns true when an answer surfaces. */
  step(ctx: CityFrame, loopSteps: number, effort: number, face: Vector3 | null): boolean {
    const dt = ctx.dt * this.tempo;
    this.phaseT += dt;
    const thinkTime = 0.5 + effort * 0.35;
    let answered = false;
    let moving = false;
    switch (this.phase) {
      case "think":
        if (this.phaseT > thinkTime) {
          this.phaseT = 0;
          if (this.lap >= loopSteps) this.phase = this.deliverTo ? "deliver" : "answer";
          else if (this.benches.length) {
            this.bench = (this.lap * 2 + 1) % this.benches.length;
            this.phase = "walk";
          } else this.lap++;
        }
        break;
      case "walk": {
        const b = this.benches[this.bench];
        this.goal.copy(b.pos).add(this.tmp.copy(this.home).sub(b.pos).setY(0).normalize().multiplyScalar(0.95 * this.scale));
        moving = this.moveTo(this.goal, dt);
        if (!moving) {
          this.phase = "use";
          this.phaseT = 0;
        }
        break;
      }
      case "use":
        if (this.phaseT > 1.1) {
          this.benches[this.bench].glow = 1;
          this.chip.visible = true;
          this.phase = "return";
          this.phaseT = 0;
        }
        break;
      case "return":
        moving = this.moveTo(this.home, dt);
        if (!moving) {
          this.lap++;
          // Agentic token multiplication: each lap re-sends the growing context.
          this.tokens = Math.min(240, this.tokens + 4 + this.lap * 3 + Math.round(effort * 2));
          this.chip.visible = false;
          this.phase = "think";
          this.phaseT = 0;
        }
        break;
      case "deliver":
        this.chip.visible = true;
        moving = this.moveTo(this.deliverTo!, dt);
        if (!moving) {
          this.chip.visible = false;
          this.onDeliver?.();
          this.phase = "back";
        }
        break;
      case "back":
        moving = this.moveTo(this.home, dt);
        if (!moving) this.reset();
        break;
      case "answer":
        if (this.phaseT > 2.2) {
          this.reset();
          answered = true;
        }
        break;
    }
    this.draw(ctx, effort, dt, moving, face);
    return answered;
  }

  private reset(): void {
    this.lap = 0;
    this.tokens = 0;
    this.phase = "think";
    this.phaseT = 0;
  }

  /** Walks toward a point; returns false once there. */
  private moveTo(p: Vector3, dt: number): boolean {
    const d = this.tmp.copy(p).sub(this.root.position).setY(0);
    const dist = d.length();
    if (dist < 0.05) return false;
    const speed = 1.7 * this.scale;
    this.root.position.addScaledVector(d.normalize(), Math.min(dist, speed * dt));
    this.turnTo(Math.atan2(d.x, d.z), dt);
    this.walkPhase += dt * 9;
    return true;
  }

  private turnTo(yaw: number, dt: number): void {
    let d = yaw - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * (1 - Math.exp(-10 * dt));
  }

  private draw(ctx: CityFrame, effort: number, dt: number, moving: boolean, face: Vector3 | null): void {
    const b = this.body;
    // Arms back to rest, then the walk swings them; a held chip or a tool
    // reach overrides the right arm afterwards.
    b.reach("R", this.tmp.set(0, 0, 0), 0);
    b.reach("L", this.tmp, 0);
    b.walk(this.walkPhase, moving ? 1 : 0);
    if (!moving) this.walkPhase = 0;

    // At a bench: face it and reach for the tool.
    if (this.phase === "use") {
      const bench = this.benches[this.bench];
      this.turnTo(Math.atan2(bench.pos.x - this.root.position.x, bench.pos.z - this.root.position.z), dt);
      bench.prop.getWorldPosition(this.tmp);
      this.root.updateMatrixWorld(true);
      b.group.worldToLocal(this.tmp);
      b.reach("R", this.tmp, Math.min(1, this.phaseT * 2.5));
    } else {
      if (this.chip.visible) b.reach("R", this.tmp.set(0.3, 0.95, 0.45), 0.8);
      if (!moving && (this.phase === "think" || this.phase === "answer") && face) {
        this.turnTo(Math.atan2(face.x - this.root.position.x, face.z - this.root.position.z), dt);
      }
    }

    // Head follows the pointer, within the neck's reach.
    let yaw = 0;
    let pitch = 0;
    if (ctx.pointer && ctx.lod === 0) {
      const dx = ctx.pointer.x - this.root.position.x;
      const dz = ctx.pointer.z - this.root.position.z;
      yaw = Math.atan2(dx, dz) - this.root.rotation.y;
      yaw = Math.max(-1, Math.min(1, Math.atan2(Math.sin(yaw), Math.cos(yaw))));
      pitch = 0.15;
    }
    b.neck.rotation.y = damp(b.neck.rotation.y, yaw, 6, dt);
    b.neck.rotation.x = damp(b.neck.rotation.x, pitch, 6, dt);
    b.head.talk(this.phase === "answer" ? 0.5 + Math.sin(this.phaseT * 14) * 0.5 : 0);

    // Thought balloons pop one by one: effort is how many come up.
    const thinking = this.phase === "think";
    const interval = (0.5 + effort * 0.35) / Math.max(1, effort + 0.5);
    this.thoughts.forEach((s, k) => {
      const on = thinking && k < effort && this.phaseT > k * interval;
      s.visible = on;
      if (on) {
        const u = Math.min(1, (this.phaseT - k * interval) * 4);
        s.position.set(-0.75 + (k % 3) * 0.75, 2.75 + Math.floor(k / 3) * 0.5 + k * 0.06, 0.2);
        s.scale.set(this.thoughtAspect * 0.42 * u, 0.42 * u, 1);
      }
    });
    this.answer.visible = this.phase === "answer";
    if (this.answer.visible) this.answer.position.set(0.6, 2.9 + Math.min(1, this.phaseT) * 0.3, 0.2);

    // Token meter: v2's 240-bead ring maps onto six chest segments.
    b.setMeter(this.tokens / 120, 0.67);
  }
}

function animateBenches(benches: Bench[], dt: number): void {
  for (const b of benches) {
    b.glow = Math.max(0, b.glow - dt * 0.8);
    b.toolMat.color.copy(PROP).lerp(GREEN, b.glow);
  }
}

/** Benches on an arc behind and beside the robot's home. */
function arc(bin: Bin, parent: Group, names: string[], center: Vector3, radius: number, spread: number, tag = true): Bench[] {
  return names.map((name, k) => {
    const a = names.length > 1 ? (k / (names.length - 1) - 0.5) * spread : 0;
    const pos = new Vector3(center.x + Math.sin(a) * radius, 0, center.z - Math.cos(a) * radius * 0.75);
    return makeBench(bin, parent, name, pos, tag);
  });
}

export const robot: CityRigFactory = (preset) => {
  const mode = str(preset, "mode", "agent");
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];
  const camera = new Vector3(0, 0, 13);

  if (mode === "trio") {
    const specs = [
      { name: "Haiku · fast", scale: 0.75, tempo: 2.1, x: -4.1, armor: undefined },
      { name: "Sonnet · balanced", scale: 1.1, tempo: 1.3, x: 0, armor: undefined },
      { name: "Opus · deep", scale: 1.6, tempo: 0.75, x: 4.2, armor: new Color("#e2e4e0") },
    ];
    const bots = specs.map((s) => {
      const bench = makeBench(bin, object, "", new Vector3(s.x + 0.4, 0, -1.6), false);
      const bot = new Bot(bin, s.scale, s.tempo, [bench], new Vector3(s.x, 0, 0.7), null, s.armor);
      if (s.scale > 1.4) bot.body.torso.scale.set(1.25, 1.05, 1.15);
      object.add(bot.root);
      const tag = label(bin, s.name, { size: 0.34 });
      tag.position.set(s.x, 0.25, 2.1);
      object.add(tag);
      return { bot, bench };
    });
    hotspots.push(
      { term: "model-tiers", label: "capability tier", anchor: anchor(object, 0, 3.9, 0.7) },
      { term: "reasoning-effort", label: "effort = thought balloons", anchor: anchor(object, 4.2, 5.2, 0.7) }
    );
    return {
      object,
      hotspots,
      dispose: () => bin.dispose(),
      update(ctx) {
        for (const { bot, bench } of bots) {
          animateBenches([bench], ctx.dt);
          bot.step({ ...ctx, pointer: null }, 2, ctx.params.effort, camera);
        }
      },
    };
  }

  const toolNames = str(preset, "tools", "Read,Grep,Edit,Bash,WebFetch").split(",");

  if (mode === "subagents") {
    // The main robot keeps the conversation; three helpers loop on their own benches.
    const main = new Bot(bin, 1.3, 1, [], new Vector3(0, 0, -1.6));
    object.add(main.root);
    const helperTools = [["Grep", "Read"], ["Read", "Bash"], ["WebFetch", "Read"]];
    const helpers = [-1, 0, 1].map((side, k) => {
      const center = new Vector3(side * 3.9, 0, 1.4);
      const benches = arc(bin, object, helperTools[k], center.clone().add(new Vector3(0, 0, -0.2)), 1.5, 1.8, true);
      const kid = new Bot(bin, 0.75, 1.5, benches, center.clone().add(new Vector3(0, 0, 0.7)), new Vector3(side * 1.1, 0, -0.6));
      kid.onDeliver = () => (main.tokens = Math.min(240, main.tokens + 6));
      object.add(kid.root);
      return { kid, benches };
    });
    hotspots.push(
      { term: "agent-loop", label: "think → act → observe", anchor: anchor(object, 0, 4.3, -1.6) },
      { term: "subagent", label: "sub-agent, own context", anchor: anchor(object, 3.9, 2.8, 2.1) },
      { term: "token-multiplication", label: "theirs fill, not the parent's", anchor: anchor(object, -3.9, 1.6, 2.1) }
    );
    return {
      object,
      hotspots,
      dispose: () => bin.dispose(),
      update(ctx) {
        // The main robot only thinks and receives; its meter moves one chip at a time.
        main.lap = 0;
        main.step(ctx, 1, ctx.params.effort, camera);
        for (const h of helpers) {
          animateBenches(h.benches, ctx.dt);
          h.kid.step({ ...ctx, pointer: null }, ctx.params.loopSteps, ctx.params.effort, camera);
        }
        if (main.tokens >= 120) main.tokens = 0;
      },
    };
  }

  const benches = arc(bin, object, toolNames, new Vector3(0, 0, 0.4), 4.6, 2.5, true);
  const agent = new Bot(bin, 1.3, 1, benches, new Vector3(0, 0, 1.2));
  object.add(agent.root);
  hotspots.push(
    { term: "agent-loop", label: "think → act → observe", anchor: anchor(object, 0, 4.4, 1.2) },
    { term: "token-multiplication", label: "context grows per lap", anchor: anchor(object, 0.7, 1.9, 1.5) },
    { term: "tool-use", label: "tool call", anchor: anchor(object, benches[0].pos.x, 1.4, benches[0].pos.z) }
  );
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx) {
      animateBenches(benches, ctx.dt);
      agent.step(ctx, ctx.params.loopSteps, ctx.params.effort, camera);
    },
  };
};
