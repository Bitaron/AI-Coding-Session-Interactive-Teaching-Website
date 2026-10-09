import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { GREEN, INK, ORANGE, PAPER } from "../engine/palette";
import { Bin, anchor, budget, geo, ink, label, matte } from "./kit";
import { hash, str, type FrameContext, type Hotspot, type RigFactory } from "./rig";

/**
 * A flocking colony (boids). One rig, four behaviours:
 *  - relay:    workers ferry work between plan → divide → implement cairns
 *  - fence:    a soft written rule some cross, then a hard guard nobody does
 *  - sieve:    review as a lens that catches flagged work and sends it back fixed
 *  - converge: reference cards drift, gather into five candidate clusters, one is chosen
 * Temperature adds wander; the cursor scatters the swarm.
 */

interface Gate {
  x: number;
  kind: "soft" | "hard" | "lens";
}

const FULL = 150;

export const colony: RigFactory = (preset) => {
  const mode = str(preset, "mode", "relay");
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];

  const isCard = mode === "converge";
  const body = isCard
    ? geo(bin, new PlaneGeometry(0.62, 0.44))
    : geo(bin, new ConeGeometry(0.075, 0.32, 5).rotateX(Math.PI / 2));
  const mat = matte(bin, 0xffffff);
  if (isCard) mat.side = DoubleSide;
  const swarm = new InstancedMesh(body, mat, FULL);
  swarm.instanceMatrix.setUsage(DynamicDrawUsage);
  object.add(swarm);

  const pos = new Float32Array(FULL * 3);
  const vel = new Float32Array(FULL * 3);
  const state = new Float32Array(FULL); // relay stage / flagged / cluster id
  const heat = new Float32Array(FULL); // 0 ink → 1 orange, -1 green
  for (let i = 0; i < FULL; i++) {
    pos[i * 3] = (hash(i) - 0.5) * 10;
    pos[i * 3 + 1] = 0.4 + hash(i + 7) * 1.6;
    pos[i * 3 + 2] = (hash(i + 3) - 0.5) * 6;
    vel[i * 3] = hash(i + 11) - 0.5;
    vel[i * 3 + 2] = hash(i + 13) - 0.5;
    state[i] = i % 3;
  }

  // --- scenery per mode ----------------------------------------------------
  const cairns: Vector3[] = [];
  const gates: Gate[] = [];
  const clusterCenters: Vector3[] = [];

  if (mode === "relay") {
    const names = ["plan", "divide", "implement"];
    const terms = ["waterfall", "work-breakdown", "integration"];
    names.forEach((n, k) => {
      const a = -0.9 + k * 0.9;
      const p = new Vector3(Math.sin(a) * 5.2, 0, -Math.cos(a) * 2.2 + 0.8);
      cairns.push(p);
      object.add(cairn(bin, p, 3 + k));
      const tag = label(bin, n, { size: 0.42 });
      tag.position.set(p.x, 2.6 + k * 0.25, p.z);
      object.add(tag);
      hotspots.push({ term: terms[k], label: n, anchor: anchor(object, p.x, 1.8 + k * 0.2, p.z) });
    });
  }

  if (mode === "fence" || mode === "sieve") {
    if (mode === "fence") {
      gates.push({ x: -1.6, kind: "soft" }, { x: 2.6, kind: "hard" });
      object.add(stakeLine(bin, -1.6, true), stakeLine(bin, 2.6, false));
      const soft = label(bin, "CLAUDE.md: “run the tests”", { size: 0.34 });
      soft.position.set(-1.6, 2.9, 0);
      const hard = label(bin, "test suite / hook", { size: 0.34 });
      hard.position.set(2.6, 2.9, 0);
      object.add(soft, hard);
      hotspots.push(
        { term: "soft-rule", label: "soft rule", anchor: anchor(object, -1.6, 2.2, 0) },
        { term: "guardrails", label: "hard guard", anchor: anchor(object, 2.6, 2.2, 0) }
      );
    } else {
      gates.push({ x: 0.6, kind: "lens" });
      const ring = new Mesh(geo(bin, new TorusGeometry(1.9, 0.07, 10, 64)), ink(bin));
      ring.position.set(0.6, 1.2, 0);
      ring.rotation.y = Math.PI / 2 - 0.75;
      object.add(ring);
      const t = label(bin, "review", { size: 0.4 });
      t.position.set(0.6, 3.5, 0);
      object.add(t);
      hotspots.push({ term: "code-review", label: "review lens", anchor: anchor(object, 0.6, 3.1, 0) });
    }
  }

  if (mode === "converge") {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      clusterCenters.push(new Vector3(Math.cos(a) * 3.6, 1.3 + (k % 2) * 0.5, Math.sin(a) * 2.2));
    }
    for (let i = 0; i < FULL; i++) state[i] = i % 5;
    str(preset, "spots", "lazyweb~real UI references")
      .split("|")
      .forEach((spec, k) => {
        const [term, text] = spec.split("~");
        hotspots.push({ term, label: text, anchor: anchor(object, k ? 3.2 : 0, k ? 2.4 : 3.2, 0) });
      });
  }

  // --- simulation ----------------------------------------------------------
  const m = new Matrix4();
  const q = new Quaternion();
  const fwd = new Vector3(0, 0, 1);
  const dir = new Vector3();
  const one = new Vector3(1, 1, 1);
  const p = new Vector3();
  const col = new Color();
  const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -1.2);
  let cycle = 0;

  function update(ctx: FrameContext): void {
    const n = budget(ctx.lod, FULL);
    swarm.count = n;
    const dt = Math.min(ctx.dt, 0.1);
    const temp = ctx.params.temperature;
    cycle += dt;
    const phase = (cycle % 12) / 12; // converge timeline
    const chosen = Math.floor(cycle / 12) % 5;

    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      let ax = 0, ay = 0, az = 0;
      // Flocking against a strided neighbour sample keeps this O(n·k).
      let cx = 0, cy = 0, cz = 0, vx = 0, vz = 0, cnt = 0;
      for (let j = (i * 7) % 5; j < n; j += 5) {
        if (j === i) continue;
        const dx = pos[j * 3] - pos[ix];
        const dy = pos[j * 3 + 1] - pos[ix + 1];
        const dz = pos[j * 3 + 2] - pos[ix + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 4) continue;
        cnt++;
        cx += dx; cy += dy; cz += dz;
        vx += vel[j * 3]; vz += vel[j * 3 + 2];
        if (d2 < 0.16) {
          ax -= dx / (d2 + 0.01) * 0.08;
          ay -= dy / (d2 + 0.01) * 0.08;
          az -= dz / (d2 + 0.01) * 0.08;
        }
      }
      if (cnt) {
        ax += (cx / cnt) * 0.3 + (vx / cnt - vel[ix]) * 0.4;
        ay += (cy / cnt) * 0.3;
        az += (cz / cnt) * 0.3 + (vz / cnt - vel[ix + 2]) * 0.4;
      }

      // Goal steering per mode.
      let goal: Vector3 | null = null;
      if (mode === "relay") {
        goal = cairns[state[i]];
        p.set(pos[ix], 0, pos[ix + 2]);
        if (p.distanceTo(goal) < 0.9) {
          state[i] = (state[i] + 1) % 3;
          heat[i] = state[i] === 1 ? 1 : state[i] === 2 ? -1 : 0;
        }
      } else if (mode === "converge") {
        const gather = phase > 0.35 && phase < 0.85;
        if (gather) goal = clusterCenters[state[i]];
        heat[i] = gather && phase > 0.6 ? (state[i] === chosen ? -1 : 0) : 0;
      } else {
        // fence / sieve: a stream flowing +x, wrapping around.
        ax += (1.4 - vel[ix]) * 0.8;
        az += -pos[ix + 2] * 0.12;
        if (pos[ix] > 6.5) {
          pos[ix] = -6.5;
          pos[ix + 2] = (hash(i + cycle) - 0.5) * 4;
          // A fresh piece of work: temperature decides how sloppy it is.
          heat[i] = hash(i * 3.1 + Math.floor(cycle)) < 0.15 + temp * 0.3 ? 1 : 0;
          state[i] = 0;
        }
        for (const g of gates) {
          const dx = g.x - pos[ix];
          if (dx > 0 && dx < 0.5 && vel[ix] > 0) {
            if (g.kind === "soft" && heat[i] > 0 && hash(i + 0.5) > 0.35) continue; // ignored the prose rule
            if (g.kind === "soft" && heat[i] > 0) { vel[ix] *= -0.6; heat[i] = 0; }
            if (g.kind === "hard" && heat[i] > 0) { vel[ix] = -1.4; heat[i] = -1; }
            if (g.kind === "lens" && heat[i] > 0) { vel[ix] = -1.0; heat[i] = -1; }
          }
        }
        if (heat[i] < 0 && pos[ix] > 4.5) heat[i] = 0;
      }
      if (goal) {
        ax += (goal.x - pos[ix]) * 0.5;
        ay += (goal.y + 0.8 - pos[ix + 1]) * 0.5;
        az += (goal.z - pos[ix + 2]) * 0.5;
      } else if (mode !== "fence" && mode !== "sieve") {
        ax += -pos[ix] * 0.05;
        az += -pos[ix + 2] * 0.08;
      }
      ay += (1.2 - pos[ix + 1]) * 0.6;

      // Wander scales with temperature.
      const w = 0.6 + temp * 2.2;
      ax += (hash(i + cycle * 3.7) - 0.5) * w;
      az += (hash(i * 1.7 + cycle * 3.1) - 0.5) * w;

      // Cursor scatters.
      if (ctx.pointer) {
        const dx = pos[ix] - ctx.pointer.x;
        const dz = pos[ix + 2] - ctx.pointer.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 4.5) {
          ax += (dx / (d2 + 0.2)) * 4;
          az += (dz / (d2 + 0.2)) * 4;
        }
      }

      vel[ix] += ax * dt;
      vel[ix + 1] += ay * dt;
      vel[ix + 2] += az * dt;
      const sp = Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2]);
      const max = isCard ? 1.6 : 2.6;
      if (sp > max) {
        vel[ix] *= max / sp;
        vel[ix + 1] *= max / sp;
        vel[ix + 2] *= max / sp;
      }
      pos[ix] += vel[ix] * dt;
      pos[ix + 1] += vel[ix + 1] * dt;
      pos[ix + 2] += vel[ix + 2] * dt;

      dir.set(vel[ix], vel[ix + 1] * 0.4, vel[ix + 2]).normalize();
      q.setFromUnitVectors(fwd, dir);
      if (isCard) q.multiply(tilt);
      m.compose(p.set(pos[ix], pos[ix + 1], pos[ix + 2]), q, one);
      swarm.setMatrixAt(i, m);
      const base = isCard ? PAPER : INK;
      if (heat[i] > 0) col.copy(ORANGE);
      else if (heat[i] < 0) col.copy(GREEN);
      else col.copy(base);
      swarm.setColorAt(i, col);
    }
    swarm.instanceMatrix.needsUpdate = true;
    if (swarm.instanceColor) swarm.instanceColor.needsUpdate = true;
  }

  return { object, hotspots, update, dispose: () => bin.dispose() };
};

/** A cairn of stacked river stones — a place work gathers, not a box. */
function cairn(bin: Bin, at: Vector3, stones: number): Group {
  const g = new Group();
  const stone = geo(bin, new SphereGeometry(1, 10, 8));
  const mat = matte(bin, 0xcfc6b3, { flat: true });
  let y = 0;
  for (let k = 0; k < stones; k++) {
    const s = 0.75 - k * 0.12;
    const m = new Mesh(stone, mat);
    m.scale.set(s, s * 0.45, s * 0.9);
    y += s * 0.45;
    m.position.set(at.x + (hash(k + at.x) - 0.5) * 0.2, y, at.z);
    m.rotation.y = hash(k * 3 + at.z) * 3;
    y += s * 0.4;
    g.add(m);
  }
  return g;
}

/** A line of survey stakes across the stream; dashed = written rule, solid = enforced. */
function stakeLine(bin: Bin, x: number, gappy: boolean): Group {
  const g = new Group();
  const stake = geo(bin, new CylinderGeometry(0.035, 0.045, 2.4, 6));
  const mat = gappy ? matte(bin, INK, { transparent: true, opacity: 0.35 }) : ink(bin);
  for (let z = -2.6; z <= 2.6; z += gappy ? 0.9 : 0.32) {
    const s = new Mesh(stake, mat);
    s.position.set(x, 1.2, z);
    g.add(s);
  }
  return g;
}
