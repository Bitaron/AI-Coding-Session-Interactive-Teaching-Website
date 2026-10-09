import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, Object3D, Vector3 } from "three";
import { ARMOR, CYAN, GREEN, INK, ORANGE, STEEL } from "../engine/palette";
import { anchor, Bin, geo, glow, label, sfx, tint, toon } from "./kit";
import { str, type CityFrame, type CityRigFactory, type Hotspot } from "./rig";

/**
 * Test-driven development as a print shop. The test comes first: a fixture
 * with a cross-shaped slot, outlined red. A robot arm prints a part, carries
 * it over and tries it. The first attempt is the wrong shape, the second is
 * close but an arm too long — each bounces off. The third drops in and the
 * fixture turns green; then a refactor pass prints it again, cleaner, and
 * it still fits. Then the shop starts over.
 */

const L1 = 3.3;
const L2 = 3.1;
const BASE = new Vector3(-3.0, 1.1, 0);
const RAW = new Color("#d9cdb3");
const PLATE = new Vector3(-1.2, 0.95, 0);
const MOULD = new Vector3(2.4, 1.0, 0);
/** Seconds per attempt. */
const CYCLE = 6;

const list = (v: string) => v.split("|").filter(Boolean);

/** A cross-shaped part; `stretch` lengthens one arm, `twist` turns it off-axis. */
function crossPart(bin: Bin, mat: Mesh["material"], stretch: number, twist: number): Group {
  const g = new Group();
  const a = new Mesh(geo(bin, new BoxGeometry(1.1 + stretch, 0.32, 0.36)), mat);
  a.position.x = stretch / 2;
  const b = new Mesh(geo(bin, new BoxGeometry(0.36, 0.32, 1.1)), mat);
  g.add(a, b);
  g.rotation.y = twist;
  return g;
}

export const printer: CityRigFactory = (preset) => {
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [
    { term: "tdd", label: "red → green → refactor", anchor: anchor(object, MOULD.x, 3.0, 0) },
    { term: "independent-verification", label: "independent check", anchor: anchor(object, MOULD.x + 1.4, 1.2, 0.4) },
  ];
  const calls = list(str(preset, "calls", "attempt 1|attempt 2|attempt 3|refactor"));
  const testName = list(str(preset, "gates", "test"))[0] ?? "test";

  // --- the test: a fixture with a cross-shaped slot --------------------------
  const fixtureMat = toon(bin, ARMOR);
  const fixture = new Mesh(geo(bin, new BoxGeometry(2.0, 1.0, 2.0)), fixtureMat);
  fixture.position.set(MOULD.x, 0.5, 0);
  object.add(fixture);
  const slotMat = toon(bin, INK);
  for (const [w, d] of [
    [1.2, 0.42],
    [0.42, 1.2],
  ]) {
    const slot = new Mesh(geo(bin, new BoxGeometry(w, 0.02, d)), slotMat);
    slot.position.set(MOULD.x, 1.01, 0);
    object.add(slot);
  }
  // The rim light is the verdict: orange while red, green once it passes.
  const rimMat = glow(bin, ORANGE);
  const rim = new Mesh(geo(bin, new BoxGeometry(2.1, 0.08, 2.1)), rimMat);
  rim.position.set(MOULD.x, 1.0, 0);
  object.add(rim);
  const testTag = label(bin, testName, { size: 0.36 });
  testTag.position.set(MOULD.x, 3.5, 0);
  object.add(testTag);
  const red = label(bin, "red", { size: 0.42, color: "#e8611e" });
  const green = label(bin, "green", { size: 0.42, color: "#1f8a56" });
  red.position.set(MOULD.x, -0.05 + 0.6, 1.35);
  green.position.copy(red.position);
  object.add(red, green);

  // --- the printer arm ----------------------------------------------------------
  const armMat = toon(bin, ARMOR);
  const jointMat = toon(bin, STEEL);
  const base = new Mesh(geo(bin, new CylinderGeometry(0.55, 0.7, BASE.y, 20)), jointMat);
  base.position.set(BASE.x, BASE.y / 2, 0);
  object.add(base);
  const shoulder = new Object3D();
  shoulder.position.copy(BASE);
  object.add(shoulder);
  const link1 = new Mesh(geo(bin, new BoxGeometry(L1, 0.3, 0.34).translate(L1 / 2, 0, 0)), armMat);
  shoulder.add(link1);
  const elbow = new Object3D();
  elbow.position.x = L1;
  shoulder.add(elbow);
  elbow.add(new Mesh(geo(bin, new CylinderGeometry(0.24, 0.24, 0.46, 16).rotateX(Math.PI / 2)), jointMat));
  const link2 = new Mesh(geo(bin, new BoxGeometry(L2, 0.24, 0.28).translate(L2 / 2, 0, 0)), armMat);
  elbow.add(link2);
  const wrist = new Object3D();
  wrist.position.x = L2;
  elbow.add(wrist);
  const nozzle = new Mesh(geo(bin, new ConeGeometry(0.18, 0.45, 12).rotateX(Math.PI).translate(0, -0.25, 0)), toon(bin, ORANGE));
  wrist.add(nozzle);
  const bead = new Mesh(geo(bin, new CylinderGeometry(0.03, 0.03, 0.4, 6)), glow(bin, CYAN));
  bead.position.y = -0.65;
  wrist.add(bead);

  const plate = new Mesh(geo(bin, new BoxGeometry(1.8, 0.12, 1.8)), toon(bin, STEEL));
  plate.position.set(PLATE.x, PLATE.y - 0.06, 0);
  object.add(plate);
  const plateLeg = new Mesh(geo(bin, new CylinderGeometry(0.12, 0.16, PLATE.y - 0.12, 8)), jointMat);
  plateLeg.position.set(PLATE.x, (PLATE.y - 0.12) / 2, 0);
  object.add(plateLeg);

  // One part per attempt: wrong shape, near miss, fit, refactored fit.
  const partMat = toon(bin, RAW);
  const parts = [crossPart(bin, partMat, 0, Math.PI / 4), crossPart(bin, partMat, 0.55, 0), crossPart(bin, partMat, 0, 0), crossPart(bin, partMat, 0, 0)];
  parts.forEach((p) => {
    p.visible = false;
    object.add(p);
  });
  const callTags = calls.map((c) => {
    const l = label(bin, c, { size: 0.3 });
    l.visible = false;
    object.add(l);
    return l;
  });
  const clunk = sfx(bin, "CLUNK!", { size: 0.6, color: "#e8611e" });
  const click = sfx(bin, "CLICK!", { size: 0.6, color: "#1f8a56" });
  clunk.position.set(MOULD.x + 0.4, 2.6, 0.8);
  click.position.copy(clunk.position);
  object.add(clunk, click);

  const aim = new Vector3();
  const reachTo = (p: Vector3) => {
    // Planar two-link IK, elbow up.
    aim.copy(p).sub(BASE);
    const d = Math.min(Math.max(Math.hypot(aim.x, aim.y), 0.4), L1 + L2 - 0.02);
    const a = Math.atan2(aim.y, aim.x);
    const a1 = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
    const a2 = Math.acos((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2));
    shoulder.rotation.z = a + a1;
    elbow.rotation.z = -(Math.PI - a2);
    // Keep the nozzle pointing down.
    wrist.rotation.z = -(shoulder.rotation.z + elbow.rotation.z);
  };

  let t = 0;
  const smooth = (x: number) => x * x * (3 - 2 * x);
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: CityFrame) {
      t += ctx.dt;
      const attempt = Math.floor(t / CYCLE) % parts.length;
      const u = (t % CYCLE) / CYCLE;
      const fits = attempt >= 2;
      const part = parts[attempt];
      parts.forEach((p) => (p.visible = p === part));

      // Print (0–.35) → carry (.35–.6) → try (.6–.8) → bounce or seat (.8–1).
      const head = new Vector3();
      const above = MOULD.clone().add(new Vector3(0, 1.3, 0));
      if (u < 0.35) {
        const k = u / 0.35;
        part.position.copy(PLATE).add(new Vector3(0, 0.16 * k, 0));
        part.scale.set(1, Math.max(0.02, k), 1);
        // The nozzle zig-zags over the growing part.
        head.copy(PLATE).add(new Vector3(Math.sin(k * 40) * 0.45, 0.95 + 0.32 * k, Math.cos(k * 33) * 0.3));
      } else if (u < 0.6) {
        const k = smooth((u - 0.35) / 0.25);
        part.scale.set(1, 1, 1);
        part.position.copy(PLATE).add(new Vector3(0, 0.16, 0)).lerp(above, k);
        part.position.y += Math.sin(k * Math.PI) * 1.2;
        head.copy(part.position).add(new Vector3(0, 0.75, 0));
      } else if (u < 0.8) {
        const k = smooth((u - 0.6) / 0.2);
        // A fitting part sinks into the slot; a wrong one stops on the rim.
        const floor = fits ? MOULD.y - 0.05 : MOULD.y + 0.2;
        part.position.set(MOULD.x, above.y + (floor - above.y) * k, 0);
        head.copy(above).add(new Vector3(0, 0.75 - 0.5 * k, 0));
      } else {
        const k = (u - 0.8) / 0.2;
        if (fits) part.position.set(MOULD.x, MOULD.y - 0.05, 0);
        else {
          // Bounced: knocked off the fixture, toward the scrap side.
          part.position.set(MOULD.x + k * 1.8, MOULD.y + 0.2 + Math.sin(k * Math.PI) * 0.8 - k * k * 1.2, k * 1.2);
          part.rotation.z = k * 1.6;
        }
        head.copy(above).add(new Vector3(-1.6 * k, 0.25 + 0.6 * k, 0));
      }
      if (u < 0.8) part.rotation.z = 0;
      reachTo(head);
      bead.visible = u < 0.35;

      const seated = fits && u > 0.75;
      // The verdict only changes once the part is tried.
      const passing = fits && (u > 0.75 || attempt === 3);
      tint(partMat, RAW, seated ? GREEN : ORANGE, seated ? 0.8 : !fits && u > 0.75 ? 0.8 : 0);
      rimMat.color.copy(passing ? GREEN : ORANGE);
      tint(fixtureMat, ARMOR, passing ? GREEN : ORANGE, 0.12);
      red.visible = !passing;
      green.visible = passing;
      clunk.visible = !fits && u > 0.78 && u < 0.95;
      click.visible = fits && u > 0.76 && u < 0.92;
      callTags.forEach((l, k) => {
        l.visible = k === attempt % callTags.length;
        l.position.copy(part.position).add(new Vector3(0, 0.75, 0.3));
      });
    },
  };
};
