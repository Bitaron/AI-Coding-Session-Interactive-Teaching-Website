import {
  BackSide,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShapeGeometry,
  Shape,
  TorusGeometry,
  Vector3,
} from "three";
import { GREEN, INK, ORANGE, PAPER } from "../engine/palette";
import { Bin, anchor, cardTexture, geo, ink, label, matte, tint } from "./kit";
import { damp, hash, str, type FrameContext, type Hotspot, type RigFactory } from "./rig";

/**
 * Paper that folds. Knowledge packed small until it's needed, then opened:
 *  - skills:  sealed envelopes show only their name tab; one opens when called
 *  - plugins: one pod opens and the skills it bundles rise out of it
 *  - prompt:  a vague prompt crumples into a plane that misses; a specific one flies true
 *  - spec:    an accordion of idea → spec → plan/tasks → verify unfolds panel by panel
 *  - handoff: a folded note flies between two computers and opens on arrival
 */

const SHEET = 1.6;

/** A square sheet with four triangular flaps that fold over its face. */
function envelope(bin: Bin, name: string, body: string) {
  const group = new Group();
  const texture = cardTexture(bin, body);
  const face = new Mesh(
    geo(bin, new PlaneGeometry(SHEET, SHEET)),
    bin.add(new MeshBasicMaterial({ map: texture, side: DoubleSide, fog: true }))
  );
  group.add(face);
  const flapMat = matte(bin, PAPER);
  flapMat.side = DoubleSide;
  const h = SHEET / 2;
  const tri = new Shape();
  tri.moveTo(-h, 0);
  tri.lineTo(h, 0);
  tri.lineTo(0, h * 0.98);
  tri.closePath();
  const triGeo = geo(bin, new ShapeGeometry(tri));
  const pivots = [0, 1, 2, 3].map((k) => {
    const pivot = new Group();
    pivot.rotation.z = (k * Math.PI) / 2;
    const hinge = new Group();
    hinge.position.y = -h;
    const flap = new Mesh(triGeo, flapMat);
    flap.position.z = 0.002 * (k + 1);
    flap.rotation.z = Math.PI;
    hinge.add(flap);
    pivot.add(hinge);
    group.add(pivot);
    return hinge;
  });
  // The name tab stays visible even when sealed: that's the "description".
  const tab = label(bin, name, { size: 0.26 });
  tab.position.set(0, h + 0.28, 0.02);
  group.add(tab);
  let open = 0;
  return {
    group,
    get open() {
      return open;
    },
    setOpen(v: number) {
      open = v;
      // Closed: flaps folded flat over the face (rotation π). Open: flat out.
      pivots.forEach((hinge, k) => {
        hinge.rotation.x = Math.PI * (1 - v) * 0.995 + k * 0.002;
      });
      face.visible = v > 0.05;
    },
  };
}

/** A folded paper plane — triangles only, no texture. */
function paperPlane(bin: Bin): Mesh {
  const g = geo(bin, new BufferGeometry());
  // nose at +z; wings and keel
  const v = [
    0, 0, 0.9, -0.7, 0.05, -0.5, 0, 0, -0.5,
    0, 0, 0.9, 0, 0, -0.5, 0.7, 0.05, -0.5,
    0, 0, 0.9, 0, -0.18, -0.5, 0, 0, -0.5,
  ];
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  const mat = matte(bin, PAPER);
  mat.side = DoubleSide;
  return new Mesh(g, mat);
}

function plinth(bin: Bin, x: number, z: number, name: string, parent: Group): void {
  const p = new Mesh(geo(bin, new CylinderGeometry(0.75, 0.9, 0.8, 7)), matte(bin, 0xcfc6b3, { flat: true }));
  p.position.set(x, 0.4, z);
  parent.add(p);
  const t = label(bin, name, { size: 0.36 });
  t.position.set(x, 0.35, z + 1.3);
  parent.add(t);
}

export const origami: RigFactory = (preset) => {
  const mode = str(preset, "mode", "skills");
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];

  if (mode === "skills" || mode === "plugins") {
    const custom = str(preset, "items", "");
    const items: string[][] = custom
      ? custom.split("|").map((it) => it.split("~"))
      : mode === "skills"
        ? [
            ["grill-with-docs", "calls grilling + domain-modeling"],
            ["grilling", "interview until shared understanding"],
            ["domain-modeling", "write glossary + decisions down"],
            ["wayfinder", "chart a map of decisions"],
            ["code-review", "standards + spec, two axes"],
          ]
        : [
            ["wayfinder", "charted issue #2"],
            ["grilling", "issue #11 brief"],
            ["code-review", "before PR #27 merged"],
            ["implement", "ticket → shipped steps"],
          ];
    const envs = items.map(([name, body], k) => {
      const e = envelope(bin, name, body);
      const x = (k - (items.length - 1) / 2) * 2.15;
      e.group.position.set(x, mode === "plugins" ? 0.4 : 2.0, mode === "plugins" ? 0 : (k % 2) * -0.6);
      e.setOpen(0);
      object.add(e.group);
      return { e, x, level: 0 };
    });
    let pod: ReturnType<typeof envelope> | null = null;
    if (mode === "plugins") {
      pod = envelope(bin, "mattpocock-skills (plugin)", "skills · commands · hooks");
      pod.group.scale.setScalar(1.4);
      pod.group.position.set(0, 1.6, -2.2);
      object.add(pod.group);
      hotspots.push({ term: "plugin", label: "plugin = bundle", anchor: anchor(object, 0, 3.0, -2.2) });
    } else {
      const spots = str(preset, "spots", "skill~skill|progressive-disclosure~only the name is loaded").split("|");
      spots.forEach((spec, k) => {
        const [term, text] = spec.split("~");
        hotspots.push({ term, label: text, anchor: anchor(object, k ? 2.15 : -4.3, 3.4, 0) });
      });
    }
    let t = 0;
    return {
      object,
      hotspots,
      dispose: () => bin.dispose(),
      update(ctx: FrameContext) {
        t += ctx.dt;
        const cycle = 9;
        const u = (t % cycle) / cycle;
        if (pod) {
          // The pod opens, its contents rise out of it, then everything resets.
          const openPod = Math.min(1, Math.max(0, (u - 0.05) * 4));
          pod.setOpen(u > 0.85 ? Math.max(0, 1 - (u - 0.85) * 8) : openPod);
          envs.forEach((it, k) => {
            const rise = Math.min(1, Math.max(0, (u - 0.25 - k * 0.06) * 4)) * (u > 0.85 ? Math.max(0, 1 - (u - 0.85) * 8) : 1);
            it.e.group.position.set(it.x * rise * 1.3, 1.2 + rise * 2.7 + Math.sin(ctx.time + k) * 0.05 * rise, -2.0 + rise * 2.6);
            it.e.group.scale.setScalar(0.25 + rise * 0.45);
            it.e.setOpen(Math.max(0, rise - 0.6) * 2.5 * 0.9);
          });
          return;
        }
        // Skills: the pointer "calls" the nearest skill; otherwise a script plays.
        let called = Math.floor(t / 3) % envs.length;
        if (ctx.pointer) {
          let best = Infinity;
          envs.forEach((it, k) => {
            const d = Math.abs(ctx.pointer!.x - it.x);
            if (d < best) { best = d; called = k; }
          });
        }
        envs.forEach((it, k) => {
          // grill-with-docs (0) calls grilling (1) and domain-modeling (2).
          const chained = !custom && called === 0 && (k === 1 || k === 2);
          const want = k === called || chained ? 1 : 0;
          it.level = damp(it.level, want, 3.5, ctx.dt);
          it.e.setOpen(it.level);
          it.e.group.position.y = 2.0 + it.level * 0.5;
        });
      },
    };
  }

  if (mode === "prompt") {
    const plane = paperPlane(bin);
    object.add(plane);
    const target = new Mesh(geo(bin, new TorusGeometry(0.8, 0.08, 8, 48).rotateX(Math.PI / 2)), ink(bin));
    target.position.set(3.6, 0.08, -0.5);
    object.add(target);
    const targetMat = target.material as MeshStandardMaterial;
    const vague = label(bin, "“Fix the bug.”", { size: 0.4 });
    const specific = label(bin, "“In UserService, … return a validation error instead of throwing.”", { size: 0.3 });
    vague.position.set(-2, 3.6, 0);
    specific.position.set(-0.4, 3.6, 0);
    object.add(vague, specific);
    hotspots.push({ term: "prompt", label: "what the model was given", anchor: anchor(object, -3.6, 1.6, 0) });
    const planeMat = plane.material as MeshStandardMaterial;
    let t = 0;
    return {
      object,
      hotspots,
      dispose: () => bin.dispose(),
      update(ctx: FrameContext) {
        t += ctx.dt;
        const cycle = 5.5;
        const round = Math.floor(t / cycle);
        const isSpecific = round % 2 === 1;
        const u = Math.min(1, (t % cycle) / 3.6);
        vague.visible = !isSpecific;
        specific.visible = isSpecific;
        // The vague plane wanders and lands wide; the specific one flies true.
        const end = isSpecific ? new Vector3(3.6, 0.25, -0.5) : new Vector3(2.2 + hash(round) * 2.4, 0.25, 1.0 + hash(round + 1) * 0.6);
        const start = new Vector3(-4, 2.2, 0);
        const p = start.clone().lerp(end, u);
        p.y += Math.sin(u * Math.PI) * 1.6;
        if (!isSpecific) {
          p.x += Math.sin(u * 17) * 0.25 * (1 - u);
          p.z += Math.cos(u * 13 + round) * 0.4 * Math.sin(u * Math.PI);
        }
        const ahead = start.clone().lerp(end, Math.min(1, u + 0.02));
        ahead.y += Math.sin(Math.min(1, u + 0.02) * Math.PI) * 1.6;
        plane.position.copy(p);
        if (u < 1) plane.lookAt(ahead);
        plane.rotation.z += isSpecific ? 0 : Math.sin(u * 20) * 0.3;
        plane.scale.setScalar(0.75);
        const landed = u >= 1;
        tint(planeMat, PAPER, isSpecific ? GREEN : ORANGE, landed ? 0.8 : 0);
        tint(targetMat, INK, isSpecific ? GREEN : INK, landed ? 1 : 0);
      },
    };
  }

  if (mode === "spec") {
    const backMat = matte(bin, PAPER);
    backMat.side = BackSide;
    const names = str(preset, "panels", "idea|/specify|/plan · /tasks|verify vs spec").split("|");
    const panels: Group[] = [];
    let parent: Group = object;
    names.forEach((n, k) => {
      const hinge = new Group();
      if (k === 0) hinge.position.set(-3.6, 2.0, 0);
      else hinge.position.set(1.9, 0, 0);
      const texture = cardTexture(bin, n);
      // Printed on the front only; the back is blank paper, so a half-folded
      // panel never shows its text mirrored.
      const panelGeo = geo(bin, new PlaneGeometry(1.8, 1.8).translate(0.9, 0, 0));
      const panel = new Mesh(panelGeo, bin.add(new MeshBasicMaterial({ map: texture, fog: true })));
      const back = new Mesh(panelGeo, backMat);
      hinge.add(panel, back);
      parent.add(hinge);
      panels.push(hinge);
      parent = hinge;
    });
    const check = label(bin, str(preset, "done", "✓ checked before code"), { size: 0.32, color: "#1f8a56" });
    check.position.set(0, 4.0, 0);
    object.add(check);
    const [term, text] = str(preset, "spot", "spec-driven~spec-driven development").split("~");
    hotspots.push({ term, label: text, anchor: anchor(object, -2.7, 3.6, 0) });
    let t = 0;
    return {
      object,
      hotspots,
      dispose: () => bin.dispose(),
      update(ctx: FrameContext) {
        t += ctx.dt;
        const u = (t % 10) / 10;
        // Unfold one panel at a time, hold, then fold back up.
        const open = u < 0.6 ? u / 0.6 : u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15;
        panels.forEach((h, k) => {
          if (k === 0) return;
          const local = Math.min(1, Math.max(0, open * (panels.length - 1) - (k - 1)));
          h.rotation.y = (k % 2 ? -1 : 1) * Math.PI * 0.97 * (1 - local);
        });
        check.visible = open > 0.98;
      },
    };
  }

  // handoff
  plinth(bin, -4, 0, "Computer 2", object);
  plinth(bin, 4, 0, "Computer 1", object);
  const plane = paperPlane(bin);
  plane.scale.setScalar(0.9);
  object.add(plane);
  const note = envelope(bin, "AGENTS.md", "→ docs/agents/ issue-tracker.md");
  note.group.scale.setScalar(1.3);
  object.add(note.group);
  hotspots.push(
    { term: "agents-md", label: "AGENTS.md", anchor: anchor(object, -4, 2.4, 0) },
    { term: "repo-as-memory", label: "the repo carries the state", anchor: anchor(object, 0, 3.6, 0) }
  );
  let t = 0;
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: FrameContext) {
      t += ctx.dt;
      const cycle = 8;
      const leg = Math.floor(t / cycle) % 2; // 0: C2 → C1, 1: C1 → C2
      const u = (t % cycle) / cycle;
      const from = new Vector3(leg ? 4 : -4, 1.5, 0);
      const to = new Vector3(leg ? -4 : 4, 1.5, 0);
      const fly = Math.min(1, Math.max(0, (u - 0.15) / 0.45));
      const p = from.clone().lerp(to, fly);
      p.y += Math.sin(fly * Math.PI) * 2.6;
      const flying = fly > 0 && fly < 1;
      plane.visible = flying;
      plane.position.copy(p);
      const ahead = from.clone().lerp(to, Math.min(1, fly + 0.02));
      ahead.y += Math.sin(Math.min(1, fly + 0.02) * Math.PI) * 2.6;
      if (flying) plane.lookAt(ahead);
      note.group.visible = !flying;
      note.group.position.copy(fly >= 1 ? to : from).add(new Vector3(0, 1.0, 0));
      note.setOpen(fly >= 1 ? Math.min(1, (u - 0.6) * 4) : 0);
    },
  };
};
