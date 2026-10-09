import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, Line, LineBasicMaterial, Mesh, SphereGeometry, Sprite } from "three";
import { GREEN, INK, ORANGE } from "../engine/palette";
import { Bin, anchor, geo, ink, label, matte, tint } from "./kit";
import { type FrameContext, type Hotspot, type RigFactory } from "./rig";

/**
 * Model selection as a Calder mobile. A task hangs on one end of the beam;
 * the model you pick hangs on the other, with its cost and latency dangling
 * beneath it. The effort knob sets how heavy a model you reach for. Balance
 * is the goal: too light and the task drags it down (unreliable), too heavy
 * and you're paying for capability the task never needed.
 */

const TASKS = [
  { name: "rename a variable", weight: 1.0, fit: "fast model · low effort" },
  { name: "implement a feature", weight: 2.3, fit: "balanced model · medium–high" },
  { name: "untangle an architecture bug", weight: 3.7, fit: "deep model · high–max" },
];

function wire(bin: Bin, parent: Group, length: number): Line {
  const g = geo(bin, new BufferGeometry());
  g.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, -length, 0], 3));
  const l = new Line(g, bin.add(new LineBasicMaterial({ color: INK })));
  parent.add(l);
  return l;
}

export const mobile: RigFactory = () => {
  const bin = new Bin();
  const object = new Group();
  const pivot = new Group();
  pivot.position.set(0, 4.7, 0);
  object.add(pivot);
  const top = wire(bin, object, 1.4);
  top.position.set(0, 6.1, 0);

  const beam = new Mesh(geo(bin, new CylinderGeometry(0.05, 0.05, 6.4, 8)), ink(bin));
  beam.rotation.z = Math.PI / 2;
  pivot.add(beam);

  // Left: the task.
  const left = new Group();
  left.position.x = -3.1;
  pivot.add(left);
  wire(bin, left, 1.6);
  const taskMat = matte(bin, 0xcfc6b3, { flat: true });
  const task = new Mesh(geo(bin, new IcosahedronGeometry(0.5, 0)), taskMat);
  task.position.y = -2.1;
  left.add(task);

  // Right: the model, with cost and latency hanging from a sub-beam.
  const right = new Group();
  right.position.x = 3.1;
  pivot.add(right);
  wire(bin, right, 1.0);
  const sub = new Group();
  sub.position.y = -1.0;
  right.add(sub);
  const subBeam = new Mesh(geo(bin, new CylinderGeometry(0.035, 0.035, 2.2, 8)), ink(bin));
  subBeam.rotation.z = Math.PI / 2;
  sub.add(subBeam);
  const modelMat = matte(bin, INK);
  const model = new Mesh(geo(bin, new SphereGeometry(0.5, 20, 14)), modelMat);
  model.position.set(0, -0.8, 0);
  sub.add(model);
  const costG = new Group();
  costG.position.x = -1.1;
  sub.add(costG);
  wire(bin, costG, 1.1);
  const cost = new Mesh(geo(bin, new CylinderGeometry(0.38, 0.38, 0.08, 24)), matte(bin, ORANGE));
  cost.position.y = -1.3;
  costG.add(cost);
  const latG = new Group();
  latG.position.x = 1.1;
  sub.add(latG);
  wire(bin, latG, 1.4);
  const latency = new Mesh(geo(bin, new SphereGeometry(0.3, 12, 10)), ink(bin));
  latency.scale.y = 1.5;
  latency.position.y = -1.7;
  latG.add(latency);

  const tags = {
    cost: label(bin, "cost", { size: 0.26 }),
    latency: label(bin, "latency", { size: 0.26 }),
  };
  tags.cost.position.set(0, -1.75, 0);
  costG.add(tags.cost);
  tags.latency.position.set(0, -2.35, 0);
  latG.add(tags.latency);

  const taskTags = TASKS.map((t) => {
    const s = label(bin, t.name, { size: 0.3 });
    s.position.set(0, -2.85, 0);
    s.visible = false;
    left.add(s);
    return s;
  });
  const verdicts: Record<string, Sprite> = {
    under: label(bin, "too light: unreliable", { size: 0.32, color: "#e8611e" }),
    over: label(bin, "too heavy: paying for unused capability", { size: 0.32, color: "#e8611e" }),
    fit: label(bin, "balanced", { size: 0.32, color: "#1f8a56" }),
  };
  Object.values(verdicts).forEach((v) => {
    v.position.set(0, 6.9, 0);
    object.add(v);
  });
  const fitTags = TASKS.map((t) => {
    const s = label(bin, `fits: ${t.fit}`, { size: 0.26, color: "#5d584d" });
    s.position.set(0, 6.45, 0);
    object.add(s);
    return s;
  });

  const hotspots: Hotspot[] = [
    { term: "model-selection", label: "least model that reliably works", anchor: anchor(object, 0, 4.9, 0) },
    { term: "latency", label: "latency", anchor: anchor(object, 4.2, 1.9, 0) },
  ];

  let angle = 0;
  let vel = 0;
  let t = 0;

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: FrameContext) {
      t += ctx.dt;
      const which = Math.floor(t / 8) % TASKS.length;
      const taskW = TASKS[which].weight;
      // Effort 0–5 → model weight 0.8–4.2; cost and latency ride along with it.
      const e = ctx.params.effort;
      const modelW = 0.8 + e * 0.68;
      task.scale.setScalar(0.6 + taskW * 0.35);
      model.scale.setScalar(0.5 + modelW * 0.22);
      cost.scale.set(0.5 + modelW * 0.3, 1, 0.5 + modelW * 0.3);
      latency.scale.set(0.6 + modelW * 0.15, (0.6 + modelW * 0.15) * 1.5, 0.6 + modelW * 0.15);

      // Torque balance with damping; a "dead zone" counts as balanced.
      const torque = (modelW - taskW) * -0.5;
      vel += (torque - angle * 1.2 - vel * 1.8) * ctx.dt;
      angle += vel * ctx.dt;
      angle = Math.max(-0.45, Math.min(0.45, angle));
      pivot.rotation.z = angle;
      // Hanging parts stay plumb.
      left.rotation.z = -angle;
      right.rotation.z = -angle;
      sub.rotation.z = Math.sin(ctx.time * 0.7) * 0.05;
      pivot.rotation.y = Math.sin(ctx.time * 0.25) * 0.25;

      const diff = modelW - taskW;
      const state = Math.abs(diff) < 0.6 ? "fit" : diff < 0 ? "under" : "over";
      Object.entries(verdicts).forEach(([k, v]) => (v.visible = k === state));
      taskTags.forEach((s, i) => (s.visible = i === which));
      fitTags.forEach((s, i) => (s.visible = i === which));
      tint(modelMat, INK, state === "fit" ? GREEN : ORANGE, 0.6);
    },
  };
};
