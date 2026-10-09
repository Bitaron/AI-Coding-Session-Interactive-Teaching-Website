import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { ARMOR, CYAN, GREEN, INK, ORANGE, STEEL } from "../engine/palette";
import { anchor, Bin, geo, glow, label, tint, toon } from "./kit";
import { damp, str, type CityRigFactory, type Hotspot } from "./rig";
import { buildBody } from "./robotkit";

/**
 * Effort across providers: every company's models are their own robot —
 * a different build per family, so "same word, different machine" is the
 * first thing you see. Each robot holds its effort dial. The one effort
 * lever (the knob) is asked of all of them, but a needle can only rest on
 * a notch its model actually has; when it snaps to the nearest one the
 * needle and lamp turn orange and the robot shakes its head.
 * Preset `dials`: "Name:0,1,2;Other:1,3,5" (levels 0–5).
 *
 * The designs are invented silhouettes, not company logos: they only
 * need to tell the families apart.
 */

const LEVELS = ["none", "low", "medium", "high", "xhigh", "max"];
const SWEEP = Math.PI * 1.5;
const START = Math.PI * 0.75; // angle of level 0, measured from +x

interface Design {
  armor: Color;
  /** Builds the head onto the neck mount; origin at the head's centre. */
  head: (bin: Bin, mount: Object3D) => void;
  scale: number;
}

const DARK = new Color("#2e2d2a");

/** Tall and smooth: a round head, full-face visor and a floating ring. */
function haloHead(bin: Bin, mount: Object3D): void {
  const shell = new Mesh(geo(bin, new SphereGeometry(0.46, 28, 18)), toon(bin, ARMOR));
  const visor = new Mesh(geo(bin, new SphereGeometry(0.47, 28, 12, -1.1 + Math.PI / 2, 2.2, 1.05, 1.0)), toon(bin, INK));
  const ring = new Mesh(geo(bin, new TorusGeometry(0.3, 0.035, 8, 40)), glow(bin, CYAN));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.66;
  mount.add(shell, visor, ring);
  for (const side of [-1, 1]) {
    const eye = new Mesh(geo(bin, new SphereGeometry(0.05, 10, 8)), glow(bin, CYAN));
    eye.position.set(side * 0.14, 0.02, 0.45);
    mount.add(eye);
  }
}

/** Angular and dark: a slab head cut by one bright diagonal visor. */
function slabHead(bin: Bin, mount: Object3D): void {
  const slab = new Mesh(geo(bin, new BoxGeometry(0.86, 0.74, 0.74)), toon(bin, DARK));
  const slash = new Mesh(geo(bin, new BoxGeometry(0.9, 0.09, 0.04)), glow(bin, "#f4f1ea"));
  slash.position.set(0, 0.04, 0.38);
  slash.rotation.z = 0.32;
  const fin = new Mesh(geo(bin, new BoxGeometry(0.08, 0.3, 0.5)), toon(bin, ARMOR));
  fin.position.y = 0.5;
  mount.add(slab, slash, fin);
}

/** Deep-sea diver: a bulb helmet with a round porthole and one eye. */
function diverHead(bin: Bin, mount: Object3D): void {
  const bulb = new Mesh(geo(bin, new SphereGeometry(0.5, 28, 18)), toon(bin, "#8eabc2"));
  const rim = new Mesh(geo(bin, new TorusGeometry(0.24, 0.05, 8, 32)), toon(bin, STEEL));
  rim.position.z = 0.45;
  const glass = new Mesh(geo(bin, new CylinderGeometry(0.22, 0.22, 0.03, 28)), toon(bin, INK));
  glass.rotation.x = Math.PI / 2;
  glass.position.z = 0.44;
  const eye = new Mesh(geo(bin, new SphereGeometry(0.08, 12, 8)), glow(bin, CYAN));
  eye.position.z = 0.47;
  mount.add(bulb, rim, glass, eye);
  for (const a of [0.6, 1.6, 2.6, 3.6, 4.6, 5.6]) {
    const bolt = new Mesh(geo(bin, new SphereGeometry(0.035, 6, 4)), toon(bin, STEEL));
    bolt.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.42);
    mount.add(bolt);
  }
}

/** Small and round: a capsule head with two round eyes and a crescent antenna. */
function crescentHead(bin: Bin, mount: Object3D): void {
  const pod = new Mesh(geo(bin, new SphereGeometry(0.44, 24, 16)), toon(bin, "#e6d6a3"));
  pod.scale.set(1.15, 0.9, 1);
  const face = new Mesh(geo(bin, new BoxGeometry(0.62, 0.3, 0.1)), toon(bin, INK));
  face.position.set(0, 0, 0.38);
  mount.add(pod, face);
  for (const side of [-1, 1]) {
    const eye = new Mesh(geo(bin, new SphereGeometry(0.06, 10, 8)), glow(bin, CYAN));
    eye.position.set(side * 0.14, 0, 0.44);
    mount.add(eye);
  }
  const stalk = new Mesh(geo(bin, new CylinderGeometry(0.025, 0.025, 0.25, 6)), toon(bin, INK));
  stalk.position.y = 0.48;
  const moon = new Mesh(geo(bin, new TorusGeometry(0.14, 0.035, 8, 24, Math.PI * 1.3)), toon(bin, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.2 }));
  moon.position.y = 0.7;
  moon.rotation.z = 1.1; // gap faces right: a crescent, not a hook
  mount.add(stalk, moon);
}

/** The house robot, for any model without a family of its own. */
function plainHead(bin: Bin, mount: Object3D): void {
  mount.add(new Mesh(geo(bin, new SphereGeometry(0.46, 24, 16)), toon(bin, ARMOR)));
}

function designFor(name: string): Design {
  const n = name.toLowerCase();
  if (n.startsWith("gpt")) return { armor: ARMOR.clone(), head: haloHead, scale: 1.55 };
  // Siblings share a build; the newer one stands a little taller.
  if (n.startsWith("grok")) return { armor: new Color("#4a4844"), head: slabHead, scale: n.includes("4.5") ? 1.5 : 1.38 };
  if (n.startsWith("deepseek")) return { armor: new Color("#a9bfd0"), head: diverHead, scale: 1.45 };
  if (n.startsWith("kimi")) return { armor: new Color("#efe3bb"), head: crescentHead, scale: 1.3 };
  return { armor: ARMOR.clone(), head: plainHead, scale: 1.4 };
}

export const gauges: CityRigFactory = (preset) => {
  const bin = new Bin();
  const object = new Group();
  const rows = str(preset, "dials", "Model:0,1,2,3,4,5")
    .split(";")
    .filter(Boolean)
    .map((r) => {
      const [name, levels] = r.split(":");
      return { name, levels: levels.split(",").map(Number) };
    });

  const spacing = 2.6;
  const face = toon(bin, "#f7f3ea", { emissive: "#f7f3ea", emissiveIntensity: 0.25 });
  const ink = toon(bin, INK);
  const faint = toon(bin, INK, { transparent: true, opacity: 0.22 });
  const rimMat = toon(bin, STEEL);

  const out = rows.map((row, k) => {
    const design = designFor(row.name);
    const body = buildBody(bin, { armor: design.armor, crest: false });
    body.head.group.visible = false;
    const head = new Group();
    head.position.y = 0.48;
    body.neck.add(head);
    design.head(bin, head);
    body.group.scale.setScalar(design.scale);
    body.group.position.x = (k - (rows.length - 1) / 2) * spacing;
    object.add(body.group);

    // The dial, held in front of the chest with both hands.
    const dial = new Group();
    dial.position.set(0, 1.0, 0.42);
    body.group.add(dial);
    const disc = new Mesh(geo(bin, new CylinderGeometry(0.36, 0.36, 0.04, 36)), face);
    disc.rotation.x = Math.PI / 2;
    const rim = new Mesh(geo(bin, new TorusGeometry(0.36, 0.03, 8, 36)), rimMat);
    dial.add(disc, rim);
    LEVELS.forEach((_, li) => {
      const a = START - (li / (LEVELS.length - 1)) * SWEEP;
      const has = row.levels.includes(li);
      const notch = new Mesh(geo(bin, new BoxGeometry(0.035, has ? 0.12 : 0.05, 0.03)), has ? ink : faint);
      notch.position.set(Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.03);
      notch.rotation.z = a - Math.PI / 2;
      dial.add(notch);
    });
    const needleMat = toon(bin, INK);
    const needle = new Mesh(geo(bin, new BoxGeometry(0.035, 0.25, 0.03).translate(0, 0.125, 0)), needleMat);
    needle.position.z = 0.05;
    dial.add(needle);
    const lampMat = glow(bin, GREEN);
    const lamp = new Mesh(geo(bin, new SphereGeometry(0.05, 10, 8)), lampMat);
    lamp.position.set(0.26, 0.26, 0.04);
    dial.add(lamp);
    body.reach("L", new Vector3(-0.34, 0.98, 0.42), 1);
    body.reach("R", new Vector3(0.34, 0.98, 0.42), 1);

    const plate = label(bin, row.name, { size: 0.26, background: "#f2e2a0" });
    plate.position.set(body.group.position.x, 0.62, 1.15);
    object.add(plate);
    const top = 2.5 * design.scale + 0.35;
    const readout = LEVELS.map((lv) => {
      const r = label(bin, lv, { size: 0.26, color: "#5d584d" });
      r.position.set(body.group.position.x, top, 0);
      r.visible = false;
      object.add(r);
      return r;
    });
    return { row, body, head, needle, needleMat, lampMat, readout, angle: START - Math.PI / 2, shake: 0, last: -1, phase: k * 1.7 };
  });

  const hotspots: Hotspot[] = [
    { term: "reasoning-effort", label: "same name ≠ same compute", anchor: anchor(object, 0, 4.6, 0) },
  ];

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx) {
      const want = Math.round(ctx.params.effort);
      for (const d of out) {
        // Snap to the nearest level this model actually has.
        const got = d.row.levels.reduce((best, l) => (Math.abs(l - want) < Math.abs(best - want) ? l : best), d.row.levels[0]);
        const a = START - (got / (LEVELS.length - 1)) * SWEEP - Math.PI / 2;
        d.angle = damp(d.angle, a, 7, ctx.dt);
        d.needle.rotation.z = d.angle;
        const snapped = got === want ? 0 : 1;
        tint(d.needleMat, INK, ORANGE, snapped);
        d.lampMat.color.copy(snapped ? ORANGE : GREEN);
        d.readout.forEach((r, i) => (r.visible = i === got));
        // A head shake when the request didn't fit; a small nod when it did.
        if (want !== d.last) {
          d.shake = 1;
          d.last = want;
        }
        d.shake = Math.max(0, d.shake - ctx.dt * 0.9);
        const wobble = Math.sin(ctx.time * 14) * d.shake;
        d.head.rotation.y = snapped ? wobble * 0.45 : 0;
        d.head.rotation.x = snapped ? 0 : Math.abs(wobble) * 0.25;
        // Idle breathing so they read as machines that are on.
        d.body.torso.position.y = 0.6 + Math.sin(ctx.time * 1.6 + d.phase) * 0.012;
      }
    },
  };
};
