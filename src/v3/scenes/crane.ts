import { BoxGeometry, CylinderGeometry, Group, Mesh, Sprite } from "three";
import { ARMOR, CYAN, GREEN, INK, ORANGE, STEEL } from "../engine/palette";
import { anchor, Bin, geo, glow, label, tint, toon } from "./kit";
import type { CityRigFactory, Hotspot } from "./rig";

/**
 * Model selection as a balance crane. The task hangs from the jib on the
 * left; the model you pick is the counterweight on the right, with its cost
 * and latency hanging beneath it. The effort knob sets how heavy a model you
 * reach for. Balance is the goal: too light and the task drags the jib down
 * (unreliable), too heavy and you're paying for capability the task never
 * needed. Same weights as v2's mobile.
 */

const TASKS = [
  { name: "rename a variable", weight: 1.0, fit: "fast model · low effort" },
  { name: "implement a feature", weight: 2.3, fit: "balanced model · medium–high" },
  { name: "untangle an architecture bug", weight: 3.7, fit: "deep model · high–max" },
];

const PIVOT_Y = 5.0;

function cable(bin: Bin, parent: Group, length: number): Mesh {
  const c = new Mesh(geo(bin, new CylinderGeometry(0.025, 0.025, length, 5).translate(0, -length / 2, 0)), toon(bin, INK));
  parent.add(c);
  return c;
}

export const crane: CityRigFactory = () => {
  const bin = new Bin();
  const object = new Group();
  const steel = toon(bin, STEEL);
  const armor = toon(bin, ARMOR);

  // Mast: a slim tower with cross-braces, cab on top.
  const mast = new Mesh(geo(bin, new BoxGeometry(0.5, PIVOT_Y - 0.4, 0.5)), steel);
  mast.position.set(0, (PIVOT_Y - 0.4) / 2, -0.4);
  object.add(mast);
  for (let i = 0; i < 5; i++) {
    const brace = new Mesh(geo(bin, new BoxGeometry(0.7, 0.07, 0.07)), armor);
    brace.position.set(0, 0.6 + i * 0.85, -0.12);
    brace.rotation.z = i % 2 ? 0.6 : -0.6;
    object.add(brace);
  }
  const base = new Mesh(geo(bin, new BoxGeometry(1.6, 0.3, 1.6)), steel);
  base.position.set(0, 0.15, -0.4);
  object.add(base);

  const pivot = new Group();
  pivot.position.set(0, PIVOT_Y, -0.4);
  object.add(pivot);
  const cab = new Mesh(geo(bin, new BoxGeometry(0.9, 0.7, 0.8)), armor);
  cab.position.set(0.2, -0.05, 0.35);
  pivot.add(cab);
  const glass = new Mesh(geo(bin, new BoxGeometry(0.5, 0.25, 0.02)), glow(bin, CYAN));
  glass.position.set(0.25, 0.02, 0.76);
  pivot.add(glass);
  const jib = new Mesh(geo(bin, new BoxGeometry(7.0, 0.28, 0.32)), toon(bin, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.15 }));
  jib.position.set(-0.2, 0.4, 0);
  pivot.add(jib);
  const apex = new Mesh(geo(bin, new BoxGeometry(0.16, 1.2, 0.16)), steel);
  apex.position.set(0, 1.05, 0);
  pivot.add(apex);

  // Left: the task, on a hook.
  const left = new Group();
  left.position.set(-3.4, 0.3, 0);
  pivot.add(left);
  cable(bin, left, 1.5);
  const hook = new Mesh(geo(bin, new BoxGeometry(0.22, 0.14, 0.22)), toon(bin, INK));
  hook.position.y = -1.55;
  left.add(hook);
  const taskMat = toon(bin, "#cfc6b3");
  const task = new Mesh(geo(bin, new BoxGeometry(1, 1, 1).translate(0, -0.5, 0)), taskMat);
  task.position.y = -1.65;
  left.add(task);

  // Right: the model as a counterweight, cost and latency hanging under it.
  const right = new Group();
  right.position.set(3.0, 0.3, 0);
  pivot.add(right);
  cable(bin, right, 0.5);
  const modelMat = toon(bin, INK);
  const model = new Mesh(geo(bin, new BoxGeometry(1, 1, 1).translate(0, -0.5, 0)), modelMat);
  model.position.y = -0.5;
  right.add(model);
  const sub = new Group();
  sub.position.y = -1.5;
  right.add(sub);
  const bar = new Mesh(geo(bin, new BoxGeometry(2.0, 0.06, 0.06)), steel);
  sub.add(bar);
  const costG = new Group();
  costG.position.x = -0.85;
  sub.add(costG);
  cable(bin, costG, 0.7);
  const cost = new Mesh(geo(bin, new CylinderGeometry(0.34, 0.34, 0.1, 24)), toon(bin, ORANGE));
  cost.position.y = -0.8;
  costG.add(cost);
  const latG = new Group();
  latG.position.x = 0.85;
  sub.add(latG);
  cable(bin, latG, 0.9);
  const latency = new Mesh(geo(bin, new CylinderGeometry(0.06, 0.3, 0.5, 16)), toon(bin, INK));
  latency.position.y = -1.15;
  latG.add(latency);
  const costTag = label(bin, "cost", { size: 0.26 });
  costTag.position.y = -1.2;
  costG.add(costTag);
  const latTag = label(bin, "latency", { size: 0.26 });
  latTag.position.y = -1.7;
  latG.add(latTag);

  const taskTags = TASKS.map((t) => {
    const s = label(bin, t.name, { size: 0.3, background: "#f2e2a0" });
    s.visible = false;
    object.add(s);
    return s;
  });
  const verdicts: Record<string, Sprite> = {
    under: label(bin, "too light: unreliable", { size: 0.32, color: "#e8611e" }),
    over: label(bin, "too heavy: paying for unused capability", { size: 0.32, color: "#e8611e" }),
    fit: label(bin, "balanced", { size: 0.32, color: "#1f8a56" }),
  };
  Object.values(verdicts).forEach((v) => {
    v.position.set(0, 7.3, -0.4);
    object.add(v);
  });
  const fitTags = TASKS.map((t) => {
    const s = label(bin, `fits: ${t.fit}`, { size: 0.26, color: "#5d584d" });
    s.position.set(0, 6.85, -0.4);
    object.add(s);
    return s;
  });

  const hotspots: Hotspot[] = [
    { term: "model-selection", label: "least model that reliably works", anchor: anchor(object, 0, 5.9, -0.4) },
    { term: "latency", label: "latency", anchor: anchor(object, 3.9, 2.4, -0.4) },
  ];

  let angle = 0;
  let vel = 0;
  let t = 0;

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx) {
      t += ctx.dt;
      const which = Math.floor(t / 8) % TASKS.length;
      const taskW = TASKS[which].weight;
      // Effort 0–5 → model weight 0.8–4.2; cost and latency ride along with it.
      const modelW = 0.8 + ctx.params.effort * 0.68;
      task.scale.setScalar(0.5 + taskW * 0.3);
      const m = 0.45 + modelW * 0.22;
      model.scale.set(m * 1.3, m, m);
      sub.position.y = -0.6 - m;
      cost.scale.set(0.5 + modelW * 0.3, 1, 0.5 + modelW * 0.3);
      latency.scale.setScalar(0.6 + modelW * 0.15);

      // Torque balance with damping; the jib tips toward the heavier side.
      const torque = (modelW - taskW) * -0.5;
      vel += (torque - angle * 1.2 - vel * 1.8) * ctx.dt;
      angle = Math.max(-0.4, Math.min(0.4, angle + vel * ctx.dt));
      pivot.rotation.z = angle;
      // Hanging parts stay plumb.
      left.rotation.z = -angle;
      right.rotation.z = -angle;
      sub.rotation.z = Math.sin(ctx.time * 0.7) * 0.05;
      left.rotation.x = Math.sin(ctx.time * 0.9) * 0.04;

      const diff = modelW - taskW;
      const state = Math.abs(diff) < 0.6 ? "fit" : diff < 0 ? "under" : "over";
      Object.entries(verdicts).forEach(([k, v]) => (v.visible = k === state));
      // The task's tag follows the load wherever the jib carries it.
      left.getWorldPosition(taskTags[which].position);
      object.worldToLocal(taskTags[which].position);
      taskTags[which].position.y -= 1.9 + task.scale.y + 0.3;
      taskTags.forEach((s, i) => (s.visible = i === which));
      fitTags.forEach((s, i) => (s.visible = i === which));
      tint(modelMat, INK, state === "fit" ? GREEN : ORANGE, 0.6);
    },
  };
};
