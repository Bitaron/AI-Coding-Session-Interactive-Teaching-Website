import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, type MeshToonMaterial, type Sprite, type SpriteMaterial, TorusGeometry, Vector3 } from "three";
import { ARMOR, CONCRETE, CYAN, GREEN, INK, ORANGE, STEEL } from "../engine/palette";
import { Bin, anchor, balloon, geo, glow, sfx, tint, toon } from "./kit";
import { damp, hash, type CityFrame, type CityRig, type CityRigFactory, type Hotspot } from "./rig";

/**
 * The prompt as a delivery order. Two drones take turns from the dispatch
 * pad: the one carrying “Fix the bug.” wanders and drops its parcel wide
 * of the landing pad; the one carrying the specific order sets it down in
 * the ring. Same drone, same parcel — the difference is the order.
 */

const VAGUE = "“Fix the bug.”";
const SPECIFIC = "“In UserService, fix the crash when a user signs up without an email — return a validation error instead of throwing.”";

/** Station plinths are 0.3 tall; everything stands on them. */
const FLOOR = 0.3;
const PAD = new Vector3(-4.2, FLOOR + 0.55, 0.6);
const TARGET = new Vector3(3.6, FLOOR + 0.2, -0.4);
const CARDBOARD = new Color("#c99a6b");
/** Parcel centre when resting on the floor or the landing pad. */
const REST = 0.21;
const CYCLE = 7;

function drone(bin: Bin, stripe: MeshToonMaterial) {
  const group = new Group();
  const armor = toon(bin, ARMOR);
  const dark = toon(bin, INK);
  const body = new Mesh(geo(bin, new BoxGeometry(0.9, 0.26, 0.7)), armor);
  group.add(body);
  const band = new Mesh(geo(bin, new BoxGeometry(0.92, 0.08, 0.72)), stripe);
  band.position.y = 0.04;
  group.add(band);
  // A face, so it reads as one of the city's machines.
  const visor = new Mesh(geo(bin, new BoxGeometry(0.5, 0.12, 0.04)), dark);
  visor.position.set(0, 0, 0.36);
  group.add(visor);
  const eye = new Mesh(geo(bin, new BoxGeometry(0.3, 0.04, 0.02)), glow(bin, CYAN));
  eye.position.set(0, 0, 0.385);
  group.add(eye);
  const rotorGeo = geo(bin, new CylinderGeometry(0.32, 0.32, 0.02, 20));
  const rotorMat = toon(bin, INK, { transparent: true, opacity: 0.45 });
  const rotors: Mesh[] = [];
  for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) {
    const arm = new Mesh(geo(bin, new BoxGeometry(0.5, 0.05, 0.06)), dark);
    arm.position.set(x * 0.6, 0.06, z * 0.6);
    arm.rotation.y = Math.atan2(-z, x);
    group.add(arm);
    const rotor = new Mesh(rotorGeo, rotorMat);
    rotor.position.set(x, 0.14, z);
    group.add(rotor);
    rotors.push(rotor);
  }
  // The parcel hangs on a short line until it's released.
  const tether = new Mesh(geo(bin, new CylinderGeometry(0.015, 0.015, 0.5, 4)), dark);
  tether.position.y = -0.38;
  group.add(tether);
  return { group, rotors, tether };
}

function parcel(bin: Bin): Mesh {
  return new Mesh(geo(bin, new BoxGeometry(0.5, 0.42, 0.5)), toon(bin, CARDBOARD));
}

/** Pops a sound-effect sprite in, holds it, fades it out. */
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
      s.visible = age < 1.2;
      s.scale.copy(base).multiplyScalar(0.6 + 0.4 * Math.min(1, age / 0.12));
      (s.material as SpriteMaterial).opacity = 1 - Math.max(0, (age - 0.85) / 0.35);
    },
  };
}

export const drones: CityRigFactory = () => {
  const bin = new Bin();
  const object = new Group();

  // Dispatch pad and landing pad.
  const padMat = toon(bin, CONCRETE);
  const dispatch = new Mesh(geo(bin, new CylinderGeometry(1.1, 1.2, 0.5, 24)), padMat);
  dispatch.position.set(PAD.x, FLOOR + 0.25, PAD.z);
  const landing = new Mesh(geo(bin, new CylinderGeometry(1.2, 1.3, 0.2, 32)), toon(bin, STEEL));
  landing.position.set(TARGET.x, FLOOR + 0.1, TARGET.z);
  const ringMat = toon(bin, INK);
  const ring = new Mesh(geo(bin, new TorusGeometry(0.8, 0.07, 8, 40).rotateX(Math.PI / 2)), ringMat);
  ring.position.set(TARGET.x, TARGET.y + 0.02, TARGET.z);
  object.add(dispatch, landing, ring);

  const vagueStripe = toon(bin, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.2 });
  const specificStripe = toon(bin, GREEN, { emissive: GREEN, emissiveIntensity: 0.2 });
  const fleet = [drone(bin, vagueStripe), drone(bin, specificStripe)];
  fleet.forEach((d) => object.add(d.group));
  const box = parcel(bin);
  object.add(box);
  const boxMat = box.material as MeshToonMaterial;

  // The order each drone flies on, as the human wrote it.
  const orders = [
    balloon(bin, VAGUE, "speech", { height: 0.9 }),
    balloon(bin, SPECIFIC, "speech", { width: 760, height: 1.7 }),
  ];
  orders[0].position.set(-2.6, 4.3, 0);
  orders[1].position.set(-1.0, 4.6, 0);
  object.add(...orders);

  const thud = sfx(bin, "THUD", { color: "#e8611e", size: 0.7, tilt: 0.08 });
  object.add(thud);
  const thudPop = popper(thud);

  const hotspots: Hotspot[] = [{ term: "prompt", label: "what the model was given", anchor: anchor(object, -4.2, 1.6, 0.6) }];

  let t = 0;
  let lastRound = -1;
  let released = false;
  const dropFrom = new Vector3();
  let fallV = 0;
  const p = new Vector3();
  const prev = new Vector3();

  const update = (ctx: CityFrame) => {
    t += ctx.dt;
    const round = Math.floor(t / CYCLE);
    const specific = round % 2 === 1;
    const u = (t % CYCLE) / CYCLE;
    if (round !== lastRound) {
      lastRound = round;
      released = false;
      fallV = 0;
    }
    orders[0].visible = !specific;
    orders[1].visible = specific;
    const active = fleet[specific ? 1 : 0];
    const idle = fleet[specific ? 0 : 1];

    // Idle drone parks on the dispatch pad, off to the back.
    idle.group.position.set(PAD.x - 0.4, PAD.y + 0.15, PAD.z - 1.4);
    idle.group.rotation.set(0, 0.4, 0);
    idle.rotors.forEach((r) => (r.rotation.y += ctx.dt * 2));

    // Where this order ends up: the ring, or somewhere near it.
    const end = specific
      ? TARGET.clone().add(new Vector3(0, REST + 0.85, 0))
      : new Vector3(1.6 + hash(round) * 2.8, 2.4, 1.6 + hash(round + 1) * 0.8);
    // Where the parcel comes to rest: on the pad, or on the bare floor.
    const restY = specific ? TARGET.y + REST : FLOOR + REST;
    const out = Math.min(1, u / 0.42);
    const back = Math.max(0, (u - 0.62) / 0.33);
    prev.copy(active.group.position);
    if (u < 0.62) {
      p.copy(PAD).add(new Vector3(0, 0.2, 0)).lerp(end, out);
      p.y += Math.sin(out * Math.PI) * 2.6;
      if (!specific) {
        // No target, no route: it drifts and second-guesses.
        p.x += Math.sin(out * 15 + round) * 0.45 * Math.sin(out * Math.PI);
        p.z += Math.cos(out * 11) * 0.6 * Math.sin(out * Math.PI);
      }
    } else {
      p.copy(end).lerp(PAD.clone().add(new Vector3(0, 0.2, 0)), Math.min(1, back));
      p.y += Math.sin(Math.min(1, back) * Math.PI) * 2.2;
    }
    active.group.position.copy(p);
    // Bank into the direction of travel.
    const vx = (p.x - prev.x) / Math.max(ctx.dt, 1e-3);
    const vz = (p.z - prev.z) / Math.max(ctx.dt, 1e-3);
    active.group.rotation.z = damp(active.group.rotation.z, -vx * 0.06, 6, ctx.dt);
    active.group.rotation.x = damp(active.group.rotation.x, vz * 0.06, 6, ctx.dt);
    active.group.rotation.y = 0;
    active.rotors.forEach((r) => (r.rotation.y += ctx.dt * 30));

    // The parcel: carried, then set down (specific) or dropped (vague).
    const deliverAt = 0.47;
    if (!released && u >= deliverAt) {
      released = true;
      dropFrom.copy(active.group.position).add(new Vector3(0, -0.85, 0));
      if (!specific) thudPop.fire();
    }
    if (!released) {
      box.position.copy(active.group.position).add(new Vector3(0, -0.85, 0));
      active.tether.visible = true;
    } else {
      active.tether.visible = false;
      if (dropFrom.y > restY) {
        fallV += 9.8 * ctx.dt;
        dropFrom.y = Math.max(restY, dropFrom.y - fallV * ctx.dt);
      }
      box.position.copy(dropFrom);
      if (!specific) thud.position.copy(dropFrom).add(new Vector3(0, 1.0, 0.3));
    }
    idle.tether.visible = false;
    const landed = released && dropFrom.y <= restY + 0.01;
    tint(boxMat, CARDBOARD, specific ? GREEN : ORANGE, landed ? 0.75 : 0);
    tint(ringMat, INK, GREEN, specific && landed ? 1 : 0);
    thudPop.update(ctx.dt);
  };

  const rig: CityRig = { object, hotspots, update, dispose: () => bin.dispose() };
  return rig;
};
