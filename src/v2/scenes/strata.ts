import { BoxGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Sprite, TorusGeometry, Vector3 } from "three";
import { GREEN, ORANGE, PAPER } from "../engine/palette";
import { Bin, anchor, geo, ink, label, matte, tint } from "./kit";
import { damp, hash, str, type FrameContext, type Hotspot, type RigFactory } from "./rig";

/**
 * Memory as sediment. Each session or decision settles as a sheet on a
 * stack; recalling it slides that sheet back out.
 *  - memory: three stacks — a loose Markdown pile, an indexed tracker, a
 *            git-bound Beads stack — the pointer (or a script) recalls from one
 *  - adr:    one stack of real ADRs from this repo; a returning question
 *            drifts in and the sheet that already answers it slides out
 */

interface Sheet {
  mesh: Mesh;
  mat: MeshStandardMaterial;
  base: Vector3;
  out: number;
  tag?: Sprite;
}

function stack(bin: Bin, parent: Group, x: number, count: number, opts: { loose?: boolean; names?: string[]; w?: number }): Sheet[] {
  const g = geo(bin, new BoxGeometry(opts.w ?? 2.2, 0.06, 1.6));
  return Array.from({ length: count }, (_, k) => {
    const mat = matte(bin, PAPER);
    const mesh = new Mesh(g, mat);
    const jitter = opts.loose ? 0.35 : 0.04;
    const base = new Vector3(x + (hash(k + x) - 0.5) * jitter, 0.1 + k * (opts.names ? 0.34 : 0.1), (hash(k * 2 + x) - 0.5) * jitter);
    mesh.position.copy(base);
    mesh.rotation.y = (hash(k * 3 + x) - 0.5) * (opts.loose ? 0.7 : 0.05);
    parent.add(mesh);
    const sheet: Sheet = { mesh, mat, base, out: 0 };
    if (opts.names?.[k]) {
      sheet.tag = label(bin, opts.names[k], { size: 0.22 });
      parent.add(sheet.tag);
    }
    return sheet;
  });
}

export const strata: RigFactory = (preset) => {
  const mode = str(preset, "mode", "memory");
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];

  if (mode === "adr") {
    const names = str(
      preset,
      "layers",
      "ADR-0001 wayfinder map → decisions-only IA spec|ADR-0002 pushState routes + 404.html fallback|ADR-0003 frontend example freezes at launch|ADR-0004 title card + shared-frame morph"
    ).split("|");
    const answerAt = Math.min(names.length - 1, Math.max(0, Number(str(preset, "answer", "1"))));
    // Shifted left so the index-tab labels on the right stay in frame.
    const sheets = stack(bin, object, -1.8, names.length, { names, w: 3 });
    const question = new Mesh(geo(bin, new SphereGeometry(0.22, 16, 12)), matte(bin, ORANGE));
    object.add(question);
    const qLabel = label(bin, str(preset, "question", "“why not hash routing?”"), { size: 0.3 });
    object.add(qLabel);
    str(preset, "spots", "adr~architecture decision record|nygard-adr~problem · options · consequences")
      .split("|")
      .forEach((spec, k) => {
        const [term, text] = spec.split("~");
        hotspots.push({ term, label: text, anchor: anchor(object, k ? -3.8 : -1.8, k ? 0.6 : 1.6, k ? 0.8 : 0) });
      });
    let t = 0;
    return {
      object,
      hotspots,
      dispose: () => bin.dispose(),
      update(ctx: FrameContext) {
        t += ctx.dt;
        const u = (t % 7) / 7;
        // The question drifts in from the side and meets ADR-0002.
        const target = sheets[answerAt].base.clone().add(new Vector3(-2.6, 0.2, 0));
        const from = new Vector3(-5.5, 3.2, 1.2);
        const arrive = Math.min(1, u / 0.4);
        question.position.copy(from).lerp(target, arrive);
        question.visible = u < 0.9;
        qLabel.position.copy(question.position).add(new Vector3(0, 0.5, 0));
        qLabel.visible = question.visible;
        sheets.forEach((s, k) => {
          const want = k === answerAt && u > 0.4 && u < 0.9 ? 1 : 0;
          s.out = damp(s.out, want, 4, ctx.dt);
          s.mesh.position.copy(s.base).add(new Vector3(-s.out * 1.4, s.out * 0.1, 0));
          tint(s.mat, PAPER, GREEN, s.out * 0.5);
          // Labels hang off the right edge like index tabs, left-aligned.
          if (s.tag) s.tag.position.set(s.base.x + 1.7 + s.tag.scale.x / 2, s.mesh.position.y, s.base.z);
        });
      },
    };
  }

  // memory: three kinds of store
  const md = stack(bin, object, -3.4, 14, { loose: true });
  const tracker = stack(bin, object, 0, 14, {});
  const beads = stack(bin, object, 3.4, 14, {});
  // Index tabs on the tracker; a git binding ring through the Beads stack.
  tracker.forEach((s, k) => {
    if (k % 3) return;
    const tab = new Mesh(geo(bin, new BoxGeometry(0.3, 0.06, 0.2)), ink(bin));
    tab.position.set(1.15, 0, -0.5 + (k % 5) * 0.25);
    s.mesh.add(tab);
  });
  for (const y of [0.35, 1.0]) {
    const ring = new Mesh(geo(bin, new TorusGeometry(0.28, 0.04, 6, 24)), ink(bin));
    ring.position.set(3.4 - 0.9, y, 0);
    ring.rotation.y = Math.PI / 2;
    object.add(ring);
  }
  const names = [
    ["Markdown file", -3.4],
    ["issue tracker", 0],
    ["Beads (in git)", 3.4],
  ] as const;
  names.forEach(([n, x]) => {
    const t = label(bin, n, { size: 0.32 });
    t.position.set(x, 2.3, 0);
    object.add(t);
  });
  hotspots.push(
    { term: "agent-memory", label: "memory lives outside the model", anchor: anchor(object, -3.4, 1.8, 0) },
    { term: "beads", label: "Beads", anchor: anchor(object, 3.4, 1.8, 0) }
  );
  const stacks = [md, tracker, beads];
  let t = 0;
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: FrameContext) {
      t += ctx.dt;
      let which = Math.floor(t / 3) % 3;
      if (ctx.pointer) which = ctx.pointer.x < -1.7 ? 0 : ctx.pointer.x > 1.7 ? 2 : 1;
      // A loose pile can be searched but not queried: recall pulls a random,
      // wrong-ish sheet first. Structured stores go straight to the right one.
      const pick = which === 0 ? Math.floor(t * 1.3) % 14 : 9;
      stacks.forEach((st, si) => {
        st.forEach((s, k) => {
          const want = si === which && k === pick ? 1 : 0;
          s.out = damp(s.out, want, 5, ctx.dt);
          s.mesh.position.copy(s.base).add(new Vector3(0, s.out * 0.1, s.out * 1.3));
          tint(s.mat, PAPER, si === 0 ? ORANGE : GREEN, s.out * 0.6);
          if (si === 0) s.mesh.rotation.z = Math.sin(ctx.time * 0.8 + k) * 0.04;
        });
      });
    },
  };
};
