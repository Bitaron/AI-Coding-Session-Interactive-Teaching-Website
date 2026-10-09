import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { ARMOR, CYAN, GREEN, INK, ORANGE } from "../engine/palette";
import { Bin, geo, glow, toon } from "./kit";

// The city's cast, built from primitives so every scene shares one design:
// a chibi mecha head (white armour, ink visor, cyan eyes, orange crest),
// an optional body with arms and legs, and plain human figures for the old
// town. Sizes are in world units at scale 1.

// --- head ------------------------------------------------------------------------

export interface RobotHead {
  /** Origin at the centre of the head; about 1 unit tall. */
  group: Group;
  eyeMat: MeshBasicMaterial;
  /** Hinged at the back of the mouth; rotate x to talk. */
  jaw: Object3D;
  /** Present with `bay`: the flip-top lid, hinged at the back. Rotate x (negative) to open. */
  lid?: Object3D;
  /** Present with `bay`: an empty mount inside the skull, at the cut. */
  bay?: Group;
  /** 0 = off (dark eyes), 1 = on. Colour defaults to cyan. */
  setEyes(on: number, color?: Color): void;
  /** Mouth open 0–1. */
  talk(open: number): void;
}

export interface HeadOpts {
  /** Flip-top skull with a mount inside (for the context drive, thinking). */
  bay?: boolean;
  /** Orange V-crest on the forehead. */
  crest?: boolean;
  /** Armour colour; white by default. */
  armor?: Color;
}

const CUT = 0.95; // polar angle (radians from the top) where the lid separates

export function buildHead(bin: Bin, opts: HeadOpts = {}): RobotHead {
  const group = new Group();
  const armor = toon(bin, opts.armor ?? ARMOR);
  const ink = toon(bin, INK);
  const accent = toon(bin, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.2 });
  const eyeMat = glow(bin, CYAN);

  const R = 0.5;
  const skull = new Group();
  skull.scale.set(1.08, 0.95, 1);
  group.add(skull);

  let lid: Object3D | undefined;
  let bay: Group | undefined;
  if (opts.bay) {
    // Lower skull: everything below the cut, open at the top.
    const lower = new Mesh(geo(bin, new SphereGeometry(R, 32, 20, 0, Math.PI * 2, CUT, Math.PI - CUT)), armor);
    skull.add(lower);
    // Inner wall, so the open skull reads as a shell, not a hole.
    const inner = new Mesh(geo(bin, new SphereGeometry(R * 0.96, 32, 20, 0, Math.PI * 2, CUT, Math.PI - CUT)), toon(bin, "#3a3833", { side: 1 }));
    skull.add(inner);
    const cutY = Math.cos(CUT) * R;
    const cutR = Math.sin(CUT) * R;
    // Lid: hinged on the back edge of the cut.
    const hinge = new Object3D();
    hinge.position.set(0, cutY, -cutR);
    const cap = new Mesh(geo(bin, new SphereGeometry(R, 32, 12, 0, Math.PI * 2, 0, CUT)), armor);
    cap.position.set(0, -cutY, cutR);
    hinge.add(cap);
    skull.add(hinge);
    lid = hinge;
    bay = new Group();
    bay.position.set(0, cutY, 0);
    // Undo the skull's squash so bay contents keep their proportions.
    bay.scale.set(1 / 1.08, 1 / 0.95, 1);
    skull.add(bay);
  } else {
    skull.add(new Mesh(geo(bin, new SphereGeometry(R, 32, 20)), armor));
  }

  // Visor: a band of ink wrapped round the face, eyes set into it.
  // Cylinder theta 0 is +z, so an arc from -1 to +1 rad faces forward.
  const visor = new Mesh(geo(bin, new CylinderGeometry(R * 1.02, R * 1.02, 0.27, 32, 1, true, -1.0, 2.0)), ink);
  visor.position.y = 0.02;
  visor.scale.set(1.08, 1, 1);
  group.add(visor);
  for (const side of [-1, 1]) {
    const eye = new Mesh(geo(bin, new BoxGeometry(0.17, 0.065, 0.04)), eyeMat);
    const a = side * 0.33;
    eye.position.set(Math.sin(a) * R * 1.1, 0.03, Math.cos(a) * R * 1.03);
    eye.rotation.y = a;
    eye.rotation.z = side * -0.12;
    group.add(eye);
  }

  // Mouth: a grille on a hinged jaw.
  const jaw = new Object3D();
  jaw.position.set(0, -0.2, 0.22);
  const plate = new Mesh(geo(bin, new BoxGeometry(0.4, 0.15, 0.24)), armor);
  plate.position.set(0, -0.06, 0.18);
  jaw.add(plate);
  for (let i = -1; i <= 1; i++) {
    const slit = new Mesh(geo(bin, new BoxGeometry(0.035, 0.08, 0.02)), ink);
    slit.position.set(i * 0.08, -0.06, 0.305);
    jaw.add(slit);
  }
  group.add(jaw);

  // Ear pods with orange caps.
  for (const side of [-1, 1]) {
    const pod = new Mesh(geo(bin, new CylinderGeometry(0.15, 0.15, 0.14, 20)), armor);
    pod.rotation.z = Math.PI / 2;
    pod.position.set(side * 0.55, 0, 0);
    group.add(pod);
    const cap = new Mesh(geo(bin, new CylinderGeometry(0.1, 0.1, 0.04, 20)), accent);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(side * 0.63, 0, 0);
    group.add(cap);
  }

  if (opts.crest !== false) {
    for (const side of [-1, 1]) {
      const fin = new Mesh(geo(bin, new BoxGeometry(0.3, 0.05, 0.04)), accent);
      fin.position.set(side * 0.12, 0.3, 0.43);
      fin.rotation.z = side * 0.55;
      fin.rotation.x = -0.35;
      group.add(fin);
    }
  }

  const base = CYAN.clone();
  const off = new Color("#2a2926");
  return {
    group,
    eyeMat,
    jaw,
    lid,
    bay,
    setEyes(on, color) {
      eyeMat.color.copy(off).lerp(color ?? base, Math.max(0, Math.min(1, on)));
    },
    talk(open) {
      jaw.rotation.x = Math.max(0, Math.min(1, open)) * 0.35;
    },
  };
}

// --- body ------------------------------------------------------------------------

export interface Limb {
  /** Rotates the whole limb. */
  root: Object3D;
  /** Bends the middle joint (rotation.x). */
  joint: Object3D;
  /** The hand or foot; attach held things here. */
  end: Object3D;
}

export interface RobotBody {
  /** Origin between the feet; about 2.2 units tall. */
  group: Group;
  /** The torso pivot — lean, bob and twist here. */
  torso: Group;
  head: RobotHead;
  /** Pivot under the head; turn it to look. */
  neck: Object3D;
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
  /** Chest token meter, 0–1; segments past `warn` turn orange. */
  setMeter(fill: number, warn?: number): void;
  /** Walk cycle: `phase` in radians, `amount` 0–1 (0 stands still). */
  walk(phase: number, amount: number): void;
  /** Aim a hand at a point in body-local space; `k` blends from rest. */
  reach(side: "L" | "R", target: Vector3, k: number): void;
}

const UPPER = 0.27;
const LOWER = 0.25;
const METER_SEGMENTS = 6;

function limb(bin: Bin, armor: Mesh["material"], joint: Mesh["material"], upper: number, lower: number, r: number, endGeo: Mesh): Limb {
  const root = new Object3D();
  const a = new Mesh(geo(bin, new CapsuleGeometry(r, upper - r * 2, 4, 10)), armor);
  a.position.y = -upper / 2;
  root.add(a);
  const knee = new Object3D();
  knee.position.y = -upper;
  root.add(knee);
  const ball = new Mesh(geo(bin, new SphereGeometry(r * 1.15, 12, 8)), joint);
  knee.add(ball);
  const b = new Mesh(geo(bin, new CapsuleGeometry(r * 0.92, lower - r * 2, 4, 10)), armor);
  b.position.y = -lower / 2;
  knee.add(b);
  const end = new Object3D();
  end.position.y = -lower;
  end.add(endGeo);
  knee.add(end);
  return { root, joint: knee, end };
}

export function buildBody(bin: Bin, opts: HeadOpts = {}): RobotBody {
  const group = new Group();
  const armor = toon(bin, opts.armor ?? ARMOR);
  const dark = toon(bin, "#3a3833");
  const accent = toon(bin, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.2 });

  const torso = new Group();
  torso.position.y = 0.6;
  group.add(torso);
  const chest = new Mesh(geo(bin, new CapsuleGeometry(0.27, 0.2, 6, 16)), armor);
  chest.scale.set(1.2, 1, 0.85);
  chest.position.y = 0.34;
  torso.add(chest);
  const plate = new Mesh(geo(bin, new BoxGeometry(0.34, 0.26, 0.05)), accent);
  plate.position.set(0, 0.4, 0.22);
  torso.add(plate);
  const hips = new Mesh(geo(bin, new BoxGeometry(0.42, 0.12, 0.26)), dark);
  hips.position.y = 0.02;
  torso.add(hips);

  // Token meter: segments on the chest plate.
  const meterMats: MeshBasicMaterial[] = [];
  for (let i = 0; i < METER_SEGMENTS; i++) {
    const m = glow(bin, "#2a2926");
    meterMats.push(m);
    const seg = new Mesh(geo(bin, new BoxGeometry(0.04, 0.16, 0.02)), m);
    seg.position.set(-0.125 + i * 0.05, 0.4, 0.252);
    torso.add(seg);
  }

  const neck = new Object3D();
  neck.position.y = 0.78;
  torso.add(neck);
  const collar = new Mesh(geo(bin, new CylinderGeometry(0.1, 0.13, 0.1, 12)), dark);
  neck.add(collar);
  const head = buildHead(bin, opts);
  head.group.position.y = 0.48;
  neck.add(head.group);

  const hand = () => new Mesh(geo(bin, new SphereGeometry(0.085, 12, 8)), dark);
  const armL = limb(bin, armor, dark, UPPER, LOWER, 0.07, hand());
  const armR = limb(bin, armor, dark, UPPER, LOWER, 0.07, hand());
  armL.root.position.set(-0.38, 0.55, 0);
  armR.root.position.set(0.38, 0.55, 0);
  torso.add(armL.root, armR.root);

  const foot = () => {
    const f = new Mesh(geo(bin, new BoxGeometry(0.17, 0.08, 0.26)), dark);
    f.position.set(0, -0.02, 0.05);
    return f;
  };
  const legL = limb(bin, armor, dark, 0.28, 0.26, 0.085, foot());
  const legR = limb(bin, armor, dark, 0.28, 0.26, 0.085, foot());
  legL.root.position.set(-0.14, 0.6, 0);
  legR.root.position.set(0.14, 0.6, 0);
  group.add(legL.root, legR.root);

  const rest = (l: Limb, side: number) => {
    l.root.quaternion.identity();
    l.root.rotation.z = side * 0.12;
    l.joint.rotation.x = -0.15;
  };
  rest(armL, -1);
  rest(armR, 1);

  const shoulder = new Vector3();
  const dir = new Vector3();
  const down = new Vector3(0, -1, 0);
  const q = new Quaternion();
  const bend = new Quaternion();
  const xAxis = new Vector3(1, 0, 0);

  const lit = CYAN.clone();
  const warnCol = ORANGE.clone();
  const offCol = new Color("#2a2926");

  return {
    group,
    torso,
    head,
    neck,
    armL,
    armR,
    legL,
    legR,
    setMeter(fill, warn = 1) {
      const n = fill * METER_SEGMENTS;
      meterMats.forEach((m, i) => {
        const on = Math.max(0, Math.min(1, n - i));
        m.color.copy(offCol).lerp(i / METER_SEGMENTS >= warn ? warnCol : lit, on);
      });
    },
    walk(phase, amount) {
      const s = Math.sin(phase) * amount;
      legL.root.rotation.x = s * 0.6;
      legR.root.rotation.x = -s * 0.6;
      legL.joint.rotation.x = Math.max(0, -Math.sin(phase - 0.6)) * 0.8 * amount;
      legR.joint.rotation.x = Math.max(0, Math.sin(phase - 0.6)) * 0.8 * amount;
      torso.position.y = 0.6 + Math.abs(Math.cos(phase)) * 0.04 * amount;
      torso.rotation.y = s * 0.08;
      armL.root.rotation.x = -s * 0.5;
      armR.root.rotation.x = s * 0.5;
    },
    reach(side, target, k) {
      const arm = side === "L" ? armL : armR;
      const sgn = side === "L" ? -1 : 1;
      // Shoulder in body space (torso may bob; close enough for a gesture).
      shoulder.set(sgn * 0.38, torso.position.y + 0.55, 0);
      dir.copy(target).sub(shoulder);
      const dist = Math.min(Math.max(dir.length(), 0.08), UPPER + LOWER - 0.01);
      dir.normalize();
      const a1 = Math.acos(Math.min(1, (UPPER * UPPER + dist * dist - LOWER * LOWER) / (2 * UPPER * dist)));
      const a2 = Math.acos(Math.min(1, (UPPER * UPPER + LOWER * LOWER - dist * dist) / (2 * UPPER * LOWER)));
      q.setFromUnitVectors(down, dir);
      bend.setFromAxisAngle(xAxis, a1);
      q.multiply(bend);
      const restQ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), sgn * 0.12);
      arm.root.quaternion.copy(restQ).slerp(q, Math.max(0, Math.min(1, k)));
      arm.joint.rotation.x = -0.15 * (1 - k) - (Math.PI - a2) * k;
    },
  };
}

// --- people ------------------------------------------------------------------------

export interface Person {
  /** Origin between the feet; about 1.7 units tall. */
  group: Group;
  armL: Object3D;
  armR: Object3D;
  legL: Object3D;
  legR: Object3D;
  walk(phase: number, amount: number): void;
}

const SKIN = new Color("#d6a47e");

/** A plain old-town human: no armour, no glow. `hat` adds a builder's hard hat. */
export function buildPerson(bin: Bin, opts: { shirt?: Color | string; hat?: Color | string | false } = {}): Person {
  const group = new Group();
  const shirt = toon(bin, opts.shirt ?? "#5f7f99");
  const trousers = toon(bin, "#45403a");
  const skin = toon(bin, SKIN);
  const body = new Mesh(geo(bin, new CapsuleGeometry(0.19, 0.42, 4, 12)), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new Mesh(geo(bin, new SphereGeometry(0.15, 14, 10)), skin);
  head.position.y = 1.52;
  group.add(head);
  if (opts.hat !== false) {
    const hat = new Mesh(geo(bin, new SphereGeometry(0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(bin, opts.hat ?? "#e7b829"));
    hat.position.y = 1.56;
    group.add(hat);
    const brim = new Mesh(geo(bin, new CylinderGeometry(0.21, 0.21, 0.025, 16)), toon(bin, opts.hat ?? "#e7b829"));
    brim.position.y = 1.56;
    group.add(brim);
  }
  const mkArm = (side: number) => {
    const pivot = new Object3D();
    pivot.position.set(side * 0.24, 1.32, 0);
    const arm = new Mesh(geo(bin, new CapsuleGeometry(0.06, 0.42, 4, 8)), shirt);
    arm.position.y = -0.26;
    pivot.add(arm);
    const hand = new Mesh(geo(bin, new SphereGeometry(0.065, 8, 6)), skin);
    hand.position.y = -0.52;
    pivot.add(hand);
    group.add(pivot);
    return pivot;
  };
  const mkLeg = (side: number) => {
    const pivot = new Object3D();
    pivot.position.set(side * 0.1, 0.74, 0);
    const leg = new Mesh(geo(bin, new CapsuleGeometry(0.075, 0.58, 4, 8)), trousers);
    leg.position.y = -0.37;
    pivot.add(leg);
    group.add(pivot);
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  const legL = mkLeg(-1);
  const legR = mkLeg(1);
  return {
    group,
    armL,
    armR,
    legL,
    legR,
    walk(phase, amount) {
      const s = Math.sin(phase) * amount;
      legL.rotation.x = s * 0.55;
      legR.rotation.x = -s * 0.55;
      armL.rotation.x = -s * 0.45;
      armR.rotation.x = s * 0.45;
      group.position.y = Math.abs(Math.cos(phase)) * 0.03 * amount;
    },
  };
}

/** Status lights for robots and machines: green pass, orange problem. */
export const SIGNAL = { ok: GREEN, warn: ORANGE, gen: CYAN } as const;
