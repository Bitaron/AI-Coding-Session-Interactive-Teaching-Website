import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshToonMaterial, SphereGeometry, Sprite, TorusGeometry, Vector3 } from "three";
import { CYAN, GREEN, INK, ORANGE, PAPER, STEEL } from "../engine/palette";
import { anchor, balloon, Bin, geo, glow, label, tint, toon } from "./kit";
import { damp, hash, str, type CityFrame, type CityRigFactory, type Hotspot } from "./rig";
import { buildBody } from "./robotkit";

/**
 * Memory as a records office. What an agent "remembers" is whatever it can
 * pull back out of storage, and how it is stored decides what comes back.
 *  - memory: a loose heap of sheets next to two indexed archives (an issue
 *            tracker cabinet, a git-bound Beads tower); a clerk robot recalls
 *            from whichever you point at — the heap hands back a different
 *            sheet each time, the archives the right drawer
 *  - adr:    a tower of decision drawers; a question flies in on a drone
 *            and the drawer that already answers it slides out
 */

interface Drawer {
  mesh: Mesh;
  mat: MeshToonMaterial;
  base: Vector3;
  out: number;
  tag?: Sprite;
}

/** A cabinet of `count` drawers, front facing +z. */
function cabinet(bin: Bin, parent: Group, x: number, count: number, opts: { w: number; h: number; names?: string[] }): Drawer[] {
  const depth = 1.4;
  const body = new Mesh(geo(bin, new BoxGeometry(opts.w, count * opts.h + 0.2, depth)), toon(bin, STEEL));
  body.position.set(x, (count * opts.h + 0.2) / 2, 0);
  parent.add(body);
  const front = geo(bin, new BoxGeometry(opts.w - 0.16, opts.h - 0.08, depth * 0.9));
  const handle = geo(bin, new BoxGeometry(0.36, 0.06, 0.06));
  const handleMat = toon(bin, INK);
  return Array.from({ length: count }, (_, k) => {
    const mat = toon(bin, PAPER);
    const mesh = new Mesh(front, mat);
    const base = new Vector3(x, 0.1 + opts.h * (k + 0.5), 0.08);
    mesh.position.copy(base);
    const h = new Mesh(handle, handleMat);
    h.position.set(0, 0, depth * 0.45 + 0.03);
    mesh.add(h);
    parent.add(mesh);
    const drawer: Drawer = { mesh, mat, base, out: 0 };
    if (opts.names?.[k]) {
      drawer.tag = label(bin, opts.names[k], { size: 0.22 });
      parent.add(drawer.tag);
    }
    return drawer;
  });
}

export const archive: CityRigFactory = (preset) => (str(preset, "mode", "memory") === "adr" ? adr(preset) : memory());

function memory() {
  const bin = new Bin();
  const object = new Group();

  // The heap: sheets dropped wherever they landed.
  const sheetGeo = geo(bin, new BoxGeometry(1.5, 0.05, 1.1));
  const heap: Drawer[] = Array.from({ length: 14 }, (_, k) => {
    const mat = toon(bin, PAPER);
    const mesh = new Mesh(sheetGeo, mat);
    const base = new Vector3(-3.7 + (hash(k) - 0.5) * 0.9, 0.06 + k * 0.07, (hash(k * 2.3) - 0.5) * 0.8);
    mesh.position.copy(base);
    mesh.rotation.y = (hash(k * 3.1) - 0.5) * 1.2;
    object.add(mesh);
    return { mesh, mat, base, out: 0 };
  });

  const tracker = cabinet(bin, object, 0, 4, { w: 1.9, h: 0.62 });
  const beads = cabinet(bin, object, 3.7, 6, { w: 1.3, h: 0.5 });
  // Git binding: a cyan chain down the Beads tower's side.
  for (let k = 0; k < 6; k++) {
    const ring = new Mesh(geo(bin, new TorusGeometry(0.13, 0.035, 6, 16)), glow(bin, CYAN));
    ring.position.set(3.7 - 0.72, 0.4 + k * 0.5, 0.4);
    ring.rotation.y = k % 2 ? 0 : Math.PI / 2;
    object.add(ring);
  }

  const names: [string, number, number][] = [
    ["Markdown file", -3.7, 1.9],
    ["issue tracker", 0, 3.2],
    ["Beads (in git)", 3.7, 3.9],
  ];
  for (const [n, x, y] of names) {
    const t = label(bin, n, { size: 0.32 });
    t.position.set(x, y, 0);
    object.add(t);
  }

  // The clerk: walks nowhere, just turns and reaches for the store you chose.
  const clerk = buildBody(bin);
  clerk.group.position.set(0, 0, 2.6);
  object.add(clerk.group);
  // The recalled sheet floats up in front of the clerk.
  const recalled = new Mesh(sheetGeo, toon(bin, PAPER));
  recalled.rotation.x = Math.PI / 2 - 0.3;
  object.add(recalled);
  const recalledMat = recalled.material as MeshToonMaterial;

  const hotspots: Hotspot[] = [
    { term: "agent-memory", label: "memory lives outside the model", anchor: anchor(object, -3.7, 1.4, 0) },
    { term: "beads", label: "Beads", anchor: anchor(object, 3.7, 3.4, 0) },
  ];

  const stores = [heap, tracker, beads];
  const xs = [-3.7, 0, 3.7];
  let t = 0;
  let which = 0;
  let lift = 0;
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: CityFrame) {
      t += ctx.dt;
      const prev = which;
      which = Math.floor(t / 3.2) % 3;
      if (ctx.pointer) which = ctx.pointer.x < -1.8 ? 0 : ctx.pointer.x > 1.8 ? 2 : 1;
      if (which !== prev) lift = 0;
      lift = Math.min(1, lift + ctx.dt * 1.2);
      // A loose heap can be searched, not queried: each look pulls a
      // different sheet. The indexed stores go straight to the same drawer.
      const pick = which === 0 ? Math.floor(t * 1.1) % heap.length : which === 1 ? 2 : 3;
      stores.forEach((st, si) => {
        st.forEach((d, k) => {
          const want = si === which && k === pick ? 1 : 0;
          d.out = damp(d.out, want, 5, ctx.dt);
          if (si === 0) d.mesh.position.copy(d.base).add(new Vector3(0, d.out * 0.5, d.out * 0.9));
          else d.mesh.position.copy(d.base).add(new Vector3(0, 0, d.out * 0.9));
          tint(d.mat, PAPER, si === 0 ? ORANGE : GREEN, d.out * 0.6);
        });
      });
      // Clerk turns toward the store and reaches for it.
      const yaw = Math.atan2(xs[which] - clerk.group.position.x, -2.2);
      clerk.group.rotation.y = damp(clerk.group.rotation.y, yaw, 4, ctx.dt);
      clerk.reach("R", new Vector3(0.35, 1.25, 0.55), 0.5 + Math.sin(t * 3) * 0.1);
      clerk.head.setEyes(1);
      // What came back: orange from the heap, green from an index.
      const from = new Vector3(xs[which], 1.6, 0.9);
      const to = new Vector3(0.9, 2.6, 2.4);
      recalled.position.copy(from).lerp(to, Math.min(1, lift * 1.3));
      recalled.visible = lift > 0.15;
      tint(recalledMat, PAPER, which === 0 ? ORANGE : GREEN, 0.55);
    },
  };
}

function adr(preset: Parameters<CityRigFactory>[0]) {
  const bin = new Bin();
  const object = new Group();
  const names = str(
    preset,
    "layers",
    "ADR-0001 wayfinder map → decisions-only IA spec|ADR-0002 pushState routes + 404.html fallback|ADR-0003 frontend example freezes at launch|ADR-0004 title card + shared-frame morph"
  ).split("|");
  const answerAt = Math.min(names.length - 1, Math.max(0, Number(str(preset, "answer", "1"))));
  // The tower sits left so its index tabs can hang off the right edge.
  const TX = -2.6;
  const drawers = cabinet(bin, object, TX, names.length, { w: 2.2, h: 0.8, names });
  const top = names.length * 0.8 + 0.2;
  const sign = label(bin, "decisions", { size: 0.3 });
  sign.position.set(TX, top + 0.35, 0);
  object.add(sign);

  // The question arrives on a small courier drone.
  const drone = new Group();
  const shell = new Mesh(geo(bin, new SphereGeometry(0.28, 16, 12)), toon(bin, PAPER));
  const eye = new Mesh(geo(bin, new BoxGeometry(0.22, 0.06, 0.05)), glow(bin, CYAN));
  eye.position.set(0, 0.03, 0.27);
  const rotorMat = toon(bin, INK);
  const rotors: Mesh[] = [];
  for (const side of [-1, 1]) {
    const arm = new Mesh(geo(bin, new CylinderGeometry(0.03, 0.03, 0.5, 6)), rotorMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = side * 0.38;
    const rotor = new Mesh(geo(bin, new BoxGeometry(0.5, 0.02, 0.06)), rotorMat);
    rotor.position.set(side * 0.62, 0.08, 0);
    drone.add(arm, rotor);
    rotors.push(rotor);
  }
  drone.add(shell, eye);
  object.add(drone);
  const question = balloon(bin, str(preset, "question", "“why not hash routing?”"), "robot", { tail: "left", height: 0.62 });
  object.add(question);

  const hotspots: Hotspot[] = [];
  str(preset, "spots", "adr~architecture decision record|nygard-adr~problem · options · consequences")
    .split("|")
    .forEach((spec, k) => {
      const [term, text] = spec.split("~");
      hotspots.push({ term, label: text, anchor: anchor(object, k ? TX - 1.4 : TX, k ? 0.6 : top + 0.1, k ? 0.8 : 0) });
    });

  let t = 0;
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: CityFrame) {
      t += ctx.dt;
      const u = (t % 8) / 8;
      // Fly in from the upper right, hover in front of the answering drawer.
      const target = drawers[answerAt].base.clone().add(new Vector3(1.7, 0.5, 2.2));
      const from = new Vector3(5.5, 4.4, 1.5);
      const arrive = Math.min(1, u / 0.35);
      const e = arrive * arrive * (3 - 2 * arrive);
      drone.position.copy(from).lerp(target, e);
      drone.position.y += Math.sin(t * 3) * 0.06;
      drone.rotation.y = Math.atan2(target.x - from.x, target.z - from.z) * (1 - e) + -0.5 * e;
      drone.visible = u < 0.92;
      for (const r of rotors) r.rotation.y += ctx.dt * 30;
      question.position.copy(drone.position).add(new Vector3(0.6, 0.85, 0));
      question.visible = drone.visible;
      drawers.forEach((d, k) => {
        const want = k === answerAt && u > 0.35 && u < 0.9 ? 1 : 0;
        d.out = damp(d.out, want, 4, ctx.dt);
        d.mesh.position.copy(d.base).add(new Vector3(0, 0, d.out * 1.3));
        tint(d.mat, PAPER, GREEN, d.out * 0.55);
        // Index tabs hang off the right edge, left-aligned.
        if (d.tag) d.tag.position.set(TX + 1.25 + d.tag.scale.x / 2, d.base.y, 0.6 + d.out * 1.3);
      });
    },
  };
}
