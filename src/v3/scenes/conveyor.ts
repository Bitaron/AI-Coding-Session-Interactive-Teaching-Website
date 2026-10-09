import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  PlaneGeometry,
} from "three";
import { CAPTION, CYAN, GREEN, INK, ORANGE, STEEL } from "../engine/palette";
import { anchor, Bin, budget, geo, glow, label, sfx, toon } from "./kit";
import { hash, str, type CityFrame, type CityRigFactory, type Hotspot } from "./rig";

/**
 * Checks on a production line. Crates of work ride a conveyor left to
 * right; temperature makes more of them sloppy (orange).
 *  - fence: a rule painted on the belt (a CLAUDE.md line) — sloppy crates
 *           mostly roll straight over it — then a hard energy barrier (a
 *           test suite or hook) that sends every sloppy crate back; it
 *           returns fixed (green)
 *  - sieve: a review scanner arch catches flagged crates and sends them
 *           back; they come round again fixed
 */

const FULL = 26;
const BELT_Y = 0.75;
const HALF = 6.2;

interface Check {
  x: number;
  kind: "soft" | "hard" | "lens";
}

const RAW = new Color("#d8c3a0");

export const conveyor: CityRigFactory = (preset) => {
  const mode = str(preset, "mode", "fence") === "sieve" ? "sieve" : "fence";
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];

  // --- the line -----------------------------------------------------------------
  const belt = new Mesh(geo(bin, new BoxGeometry(HALF * 2 + 0.6, 0.22, 2.2)), toon(bin, "#4a4740"));
  belt.position.y = BELT_Y - 0.11;
  object.add(belt);
  const frameMat = toon(bin, STEEL);
  for (const z of [-1.2, 1.2]) {
    const rail = new Mesh(geo(bin, new BoxGeometry(HALF * 2 + 0.8, 0.3, 0.16)), frameMat);
    rail.position.set(0, BELT_Y - 0.05, z);
    object.add(rail);
  }
  const legGeo = geo(bin, new BoxGeometry(0.16, BELT_Y - 0.2, 0.16));
  for (let x = -HALF; x <= HALF; x += 3.1) {
    for (const z of [-1.1, 1.1]) {
      const leg = new Mesh(legGeo, frameMat);
      leg.position.set(x, (BELT_Y - 0.2) / 2, z);
      object.add(leg);
    }
  }
  // Belt slats that move, so the direction of travel reads at a glance.
  const slats = new InstancedMesh(geo(bin, new BoxGeometry(0.06, 0.02, 2.1)), toon(bin, INK), 30);
  slats.instanceMatrix.setUsage(DynamicDrawUsage);
  object.add(slats);

  const checks: Check[] = [];
  let barrierMat: ReturnType<typeof glow> | null = null;
  if (mode === "fence") {
    checks.push({ x: -1.6, kind: "soft" }, { x: 2.6, kind: "hard" });
    // A rule painted on the belt: dashes anyone can roll over.
    const paint = toon(bin, CAPTION);
    for (let k = 0; k < 5; k++) {
      const dash = new Mesh(geo(bin, new BoxGeometry(0.16, 0.02, 0.26)), paint);
      dash.position.set(-1.6, BELT_Y + 0.01, -0.85 + k * 0.42);
      object.add(dash);
    }
    // The barrier: two posts and a field between them.
    for (const z of [-1.3, 1.3]) {
      const post = new Mesh(geo(bin, new CylinderGeometry(0.14, 0.18, 2.6, 10)), toon(bin, STEEL));
      post.position.set(2.6, 1.3, z);
      object.add(post);
      const cap = new Mesh(geo(bin, new CylinderGeometry(0.2, 0.2, 0.14, 10)), toon(bin, ORANGE));
      cap.position.set(2.6, 2.65, z);
      object.add(cap);
    }
    barrierMat = glow(bin, CYAN, 0.28);
    const field = new Mesh(geo(bin, new PlaneGeometry(2.6, 1.7)), barrierMat);
    field.rotation.y = Math.PI / 2;
    field.position.set(2.6, BELT_Y + 0.85, 0);
    object.add(field);
    const soft = label(bin, "CLAUDE.md: “run the tests”", { size: 0.32 });
    soft.position.set(-1.6, 2.4, 0);
    const hard = label(bin, "test suite / hook", { size: 0.32 });
    hard.position.set(2.6, 3.2, 0);
    object.add(soft, hard);
    hotspots.push(
      { term: "soft-rule", label: "soft rule", anchor: anchor(object, -1.6, 1.9, 0) },
      { term: "guardrails", label: "hard guard", anchor: anchor(object, 2.6, 2.4, 0) }
    );
  } else {
    checks.push({ x: 0.6, kind: "lens" });
    const archMat = toon(bin, STEEL);
    for (const z of [-1.4, 1.4]) {
      const post = new Mesh(geo(bin, new BoxGeometry(0.3, 2.8, 0.3)), archMat);
      post.position.set(0.6, 1.4, z);
      object.add(post);
    }
    const beam = new Mesh(geo(bin, new BoxGeometry(0.5, 0.4, 3.1)), archMat);
    beam.position.set(0.6, 2.9, 0);
    object.add(beam);
    barrierMat = glow(bin, CYAN, 0.22);
    const curtain = new Mesh(geo(bin, new PlaneGeometry(2.5, 2.0)), barrierMat);
    curtain.rotation.y = Math.PI / 2;
    curtain.position.set(0.6, BELT_Y + 1.0, 0);
    object.add(curtain);
    const t = label(bin, "review", { size: 0.4 });
    t.position.set(0.6, 3.5, 0);
    object.add(t);
    hotspots.push({ term: "code-review", label: "review scanner", anchor: anchor(object, 0.6, 3.0, 0) });
  }
  const bzzt = sfx(bin, mode === "fence" ? "BZZT!" : "BEEP!", { size: 0.6, color: "#e8611e" });
  bzzt.position.set(checks[checks.length - 1].x + 0.6, 3.6, 0.6);
  bzzt.visible = false;
  object.add(bzzt);

  // --- the crates -----------------------------------------------------------------
  const crates = new InstancedMesh(geo(bin, new BoxGeometry(0.62, 0.5, 0.62)), toon(bin, 0xffffff), FULL);
  crates.instanceMatrix.setUsage(DynamicDrawUsage);
  object.add(crates);
  const x = new Float32Array(FULL);
  const z = new Float32Array(FULL);
  const vx = new Float32Array(FULL);
  const hop = new Float32Array(FULL);
  /** 1 sloppy (orange), 0 fine, -1 sent back and fixed (green). */
  const heat = new Float32Array(FULL);
  for (let i = 0; i < FULL; i++) {
    x[i] = -HALF + (i / FULL) * HALF * 2;
    z[i] = (hash(i * 1.3) - 0.5) * 1.1;
    vx[i] = 1.2;
    heat[i] = hash(i * 7.1) < 0.3 ? 1 : 0;
  }

  const o = new Object3D();
  const col = new Color();
  let t = 0;
  let flash = 0;
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: CityFrame) {
      const dt = Math.min(ctx.dt, 0.1);
      t += dt;
      const temp = ctx.params.temperature;
      const n = budget(ctx.lod, FULL);
      crates.count = n;
      flash = Math.max(0, flash - dt * 2.5);

      for (let i = 0; i < n; i++) {
        // The belt pulls everything right; a bounced crate skids back first.
        vx[i] += (1.2 - vx[i]) * dt * 1.6;
        const before = x[i];
        x[i] += vx[i] * dt;
        hop[i] = Math.max(0, hop[i] - dt * 2);
        for (const c of checks) {
          if (!(before < c.x - 0.35 && x[i] >= c.x - 0.35) || heat[i] <= 0) continue;
          // A painted rule is mostly rolled over; a few sloppy crates notice it.
          if (c.kind === "soft" && hash(i * 2.7 + Math.floor(t)) > 0.3) continue;
          vx[i] = c.kind === "soft" ? -1.2 : -3;
          hop[i] = 1;
          heat[i] = c.kind === "soft" ? 0 : -1;
          if (c.kind !== "soft") flash = 1;
        }
        if (x[i] > HALF) {
          // A fresh crate: temperature decides how sloppy the work is.
          x[i] = -HALF;
          z[i] = (hash(i + t) - 0.5) * 1.1;
          heat[i] = hash(i * 3.1 + Math.floor(t * 0.7)) < 0.12 + temp * 0.35 ? 1 : 0;
        }
        const wobble = heat[i] > 0 ? (0.08 + temp * 0.12) * Math.sin(t * 9 + i) : 0;
        o.position.set(x[i], BELT_Y + 0.25 + Math.sin(hop[i] * Math.PI) * 0.6, z[i]);
        o.rotation.set(0, wobble, wobble * 0.6);
        o.updateMatrix();
        crates.setMatrixAt(i, o.matrix);
        col.copy(RAW);
        if (heat[i] > 0) col.copy(ORANGE);
        else if (heat[i] < 0) col.copy(GREEN);
        crates.setColorAt(i, col);
      }
      crates.instanceMatrix.needsUpdate = true;
      if (crates.instanceColor) crates.instanceColor.needsUpdate = true;

      const shift = (t * 1.2) % 0.84;
      for (let k = 0; k < 30; k++) {
        o.position.set(-HALF + ((k * 0.84 + shift) % (HALF * 2)), BELT_Y + 0.005, 0);
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        slats.setMatrixAt(k, o.matrix);
      }
      slats.instanceMatrix.needsUpdate = true;

      // The check flares orange each time it turns work back.
      if (barrierMat) {
        barrierMat.color.copy(CYAN).lerp(ORANGE, flash);
        barrierMat.opacity = 0.22 + flash * 0.35;
      }
      bzzt.visible = flash > 0.5 && ctx.lod === 0;
    },
  };
};
