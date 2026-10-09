import {
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  type MeshBasicMaterial,
  QuadraticBezierCurve3,
  Quaternion,
  SphereGeometry,
  type Sprite,
  type SpriteMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { ARMOR, CYAN, GREEN, INK, ORANGE, STEEL } from "../engine/palette";
import { Bin, anchor, geo, glow, label, sfx, tint, toon } from "./kit";
import { damp, type CityFrame, type CityRig, type CityRigFactory, type Hotspot } from "./rig";

/**
 * A workflow graph as a metro line. Stations are states, the junction is
 * the decision, and the dashed track is the dependency: fix isn't finished
 * until the tests run again. The train fails twice — out to fix, back
 * through run tests — before the junction sends it on to done.
 */

const FLOOR = 0.3;

const STATIONS: { name: string; p: Vector3 }[] = [
  { name: "write code", p: new Vector3(-4.3, 2.0, 0.3) },
  { name: "run tests", p: new Vector3(-1.5, 2.8, -0.8) },
  { name: "tests pass?", p: new Vector3(1.4, 2.2, 0.2) },
  { name: "done", p: new Vector3(4.3, 3.0, -0.6) },
  { name: "fix", p: new Vector3(-0.1, 1.2, 2.0) },
];

/** [from, to, lift, dependency?] */
const EDGES: [number, number, number, boolean][] = [
  [0, 1, 0.6, false],
  [1, 2, 0.6, false],
  [2, 3, 0.7, false],
  [2, 4, -0.2, false],
  [4, 1, 0.3, true],
];
const PASS_EDGE = 2;
const FAIL_EDGES = [3, 4];

/** Fails twice, then passes. Edge indices. */
const ROUTE = [0, 1, 3, 4, 1, 3, 4, 1, 2];
const TRAVEL = 1.3;
const DWELL = 0.4;

function popper(s: Sprite) {
  const base = s.scale.clone();
  let age = 9;
  s.visible = false;
  return {
    fire() {
      age = 0;
    },
    update(dt: number) {
      age += dt;
      s.visible = age < 1.6;
      s.scale.copy(base).multiplyScalar(0.6 + 0.4 * Math.min(1, age / 0.12));
      (s.material as SpriteMaterial).opacity = 1 - Math.max(0, (age - 1.2) / 0.4);
    },
  };
}

export const transit: CityRigFactory = () => {
  const bin = new Bin();
  const object = new Group();
  const steel = toon(bin, STEEL);
  const armor = toon(bin, ARMOR);

  // Stations: a platform on a pylon, a signal lamp, a name board.
  const lamps: MeshBasicMaterial[] = [];
  STATIONS.forEach((s) => {
    const pylon = new Mesh(geo(bin, new CylinderGeometry(0.08, 0.12, s.p.y - FLOOR, 8)), steel);
    pylon.position.set(s.p.x, FLOOR + (s.p.y - FLOOR) / 2, s.p.z);
    const deck = new Mesh(geo(bin, new CylinderGeometry(0.6, 0.6, 0.16, 20)), armor);
    deck.position.copy(s.p).add(new Vector3(0, -0.1, 0));
    const lamp = glow(bin, CYAN);
    lamps.push(lamp);
    const bulb = new Mesh(geo(bin, new SphereGeometry(0.13, 12, 8)), lamp);
    bulb.position.copy(s.p).add(new Vector3(0.45, 0.45, 0));
    const board = label(bin, s.name, { size: 0.3, background: "#fbf8f1" });
    board.position.copy(s.p).add(new Vector3(0, 0.75, 0));
    object.add(pylon, deck, bulb, board);
  });

  // Track: solid tubes, and a dashed one for the dependency edge.
  const up = new Vector3(0, 1, 0);
  const tracks = EDGES.map(([a, b, lift, dashed], k) => {
    const pa = STATIONS[a].p;
    const pb = STATIONS[b].p;
    const mid = pa.clone().lerp(pb, 0.5).add(new Vector3(0, lift, k === 3 || k === 4 ? 0.8 : 0));
    const curve = new QuadraticBezierCurve3(pa.clone(), mid, pb.clone());
    const mat = toon(bin, INK);
    if (!dashed) {
      object.add(new Mesh(geo(bin, new TubeGeometry(curve, 36, 0.06, 6)), mat));
    } else {
      const dash = geo(bin, new CylinderGeometry(0.06, 0.06, 0.18, 6));
      for (let i = 0; i < 11; i++) {
        const t = (i + 0.5) / 11;
        const d = new Mesh(dash, mat);
        d.position.copy(curve.getPoint(t));
        d.quaternion.copy(new Quaternion().setFromUnitVectors(up, curve.getTangent(t)));
        object.add(d);
      }
    }
    return { curve, mat, heat: 0 };
  });

  // The train.
  const train = new Group();
  const carMat = toon(bin, ARMOR);
  const car = new Mesh(geo(bin, new CapsuleGeometry(0.17, 0.55, 4, 10).rotateX(Math.PI / 2)), carMat);
  const stripeMat = toon(bin, CYAN, { emissive: CYAN, emissiveIntensity: 0.3 });
  const stripe = new Mesh(geo(bin, new CapsuleGeometry(0.175, 0.4, 2, 10).rotateX(Math.PI / 2)), stripeMat);
  stripe.scale.set(1, 0.35, 1);
  train.add(car, stripe);
  object.add(train);

  const done = sfx(bin, "DONE!", { color: "#1f8a56", size: 0.7 });
  done.position.copy(STATIONS[3].p).add(new Vector3(-0.2, 1.5, 0.4));
  object.add(done);
  const donePop = popper(done);

  const hotspots: Hotspot[] = [
    { term: "workflow-graph", label: "states + decisions", anchor: anchor(object, 1.4, 2.7, 0.2) },
    { term: "dependency-edge", label: "fix depends on re-test", anchor: anchor(object, -0.9, 2.3, 1.6) },
  ];

  const stripeBase = CYAN.clone();
  const idle = new Color(CYAN);
  let leg = 0;
  let u = 0;
  let dwell = DWELL;
  let hold = 0;
  let verdict: "none" | "fail" | "pass" = "none";
  /** The station the train is standing at, or -1 between stations. */
  let atNode = 0;
  const ahead = new Vector3();

  const update = (ctx: CityFrame) => {
    const dt = ctx.dt;
    if (hold > 0) {
      // Parked at done; then the next piece of work starts over.
      hold -= dt;
      if (hold <= 0) {
        leg = 0;
        u = 0;
        dwell = DWELL;
        verdict = "none";
        atNode = 0;
      }
    } else if (dwell > 0) {
      dwell -= dt;
    } else {
      atNode = -1;
      u += dt / TRAVEL;
      if (u >= 1) {
        u = 0;
        const arrived = EDGES[ROUTE[leg]][1];
        atNode = arrived;
        leg++;
        dwell = DWELL;
        if (arrived === 3) {
          hold = 2.6;
          leg = ROUTE.length - 1;
          u = 1;
          donePop.fire();
        } else if (arrived === 2) {
          // The junction decides from the result alone.
          verdict = FAIL_EDGES.includes(ROUTE[leg]) ? "fail" : "pass";
        }
      }
    }

    const edge = ROUTE[Math.min(leg, ROUTE.length - 1)];
    const curve = tracks[edge].curve;
    const k = Math.min(1, u);
    train.position.copy(curve.getPoint(k)).add(new Vector3(0, 0.2, 0));
    curve.getPoint(Math.min(1, k + 0.02), ahead).add(new Vector3(0, 0.2, 0));
    if (k < 0.98) train.lookAt(ahead);

    // The track under the train lights with what it means.
    tracks.forEach((tr, i) => {
      tr.heat = damp(tr.heat, i === edge && dwell <= 0 && hold <= 0 ? 1 : 0, 4, dt);
      const col = i === PASS_EDGE ? GREEN : FAIL_EDGES.includes(i) ? ORANGE : CYAN;
      tint(tr.mat, INK, col, tr.heat);
    });
    const failing = FAIL_EDGES.includes(edge);
    tint(stripeMat, stripeBase, failing ? ORANGE : edge === PASS_EDGE || hold > 0 ? GREEN : idle, failing || edge === PASS_EDGE || hold > 0 ? 1 : 0);

    // Lamps: cyan where the train is, the junction shows its verdict, done goes green.
    lamps.forEach((m, i) => {
      if (i === 2 && verdict !== "none") m.color.copy(verdict === "fail" ? ORANGE : GREEN);
      else if (i === 3 && hold > 0) m.color.copy(GREEN);
      else m.color.copy(INK).lerp(CYAN, i === atNode ? 1 : 0.25);
    });
    donePop.update(dt);
  };

  const rig: CityRig = { object, hotspots, update, dispose: () => bin.dispose() };
  return rig;
};
