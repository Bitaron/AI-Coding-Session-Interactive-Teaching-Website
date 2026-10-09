import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  type Sprite,
  type SpriteMaterial,
  Vector3,
} from "three";
import { ARMOR, CYAN, INK, STEEL, TIMBER } from "../engine/palette";
import { Bin, anchor, cardTexture, geo, glow, label, sfx, toon } from "./kit";
import { damp, str, type CityFrame, type CityRig, type CityRigFactory, type Hotspot } from "./rig";
import { buildHead } from "./robotkit";

/**
 * Skills as cartridges: knowledge packed small until it's needed.
 *  - skills:  a rack of cartridges shows only their labels (the description
 *             is all that sits in context). Point at one and it flies into
 *             the robot's head slot; only then does its card of
 *             instructions unfold. grill-with-docs pulls in two more.
 *  - plugins: a shipping crate opens and the cartridges it carries rise out.
 */

const FLOOR = 0.3;
const SLOT_Y = FLOOR + 1.7;

interface Cartridge {
  group: Group;
  card: Object3D;
  level: number;
  home: Vector3;
}

function cartridge(bin: Bin, name: string, body: string, k: number, cardMat: (body: string) => MeshBasicMaterial): Cartridge {
  const group = new Group();
  const shell = new Mesh(geo(bin, new BoxGeometry(0.9, 1.2, 0.3)), toon(bin, ARMOR));
  group.add(shell);
  // A window on the face where the label would sit on a real cartridge.
  const face = new Mesh(geo(bin, new BoxGeometry(0.64, 0.5, 0.02)), toon(bin, INK));
  face.position.set(0, 0.2, 0.16);
  group.add(face);
  const stripe = new Mesh(geo(bin, new BoxGeometry(0.5, 0.06, 0.02)), glow(bin, CYAN));
  stripe.position.set(0, 0.2, 0.175);
  group.add(stripe);
  // Contacts along the bottom edge — the end that plugs in.
  const pins = new Mesh(geo(bin, new BoxGeometry(0.7, 0.12, 0.2)), toon(bin, STEEL));
  pins.position.y = -0.64;
  group.add(pins);
  // The name stays visible even when packed: that's what's in context.
  const tag = label(bin, name, { size: 0.24, background: "#fbf8f1" });
  tag.position.set(0, k % 2 ? -1.5 : -1.05, 0.2);
  group.add(tag);
  // The instructions: a card hinged at its bottom edge, folded flat until loaded.
  const card = new Object3D();
  card.position.set(0, 0.75, 0);
  const sheet = new Mesh(geo(bin, new PlaneGeometry(1.7, 1.7).translate(0, 0.85, 0)), cardMat(body));
  card.add(sheet);
  card.scale.set(1, 0.001, 1);
  card.visible = false;
  group.add(card);
  return { group, card, level: 0, home: new Vector3() };
}

function setCard(c: Cartridge, open: number, size = 1): void {
  const k = Math.max(0, Math.min(1, open));
  c.card.visible = k > 0.02;
  c.card.scale.set((0.4 + 0.6 * k) * size, Math.max(0.001, k) * size, size);
}

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
      s.visible = age < 1.1;
      s.scale.copy(base).multiplyScalar(0.6 + 0.4 * Math.min(1, age / 0.12));
      (s.material as SpriteMaterial).opacity = 1 - Math.max(0, (age - 0.8) / 0.3);
    },
  };
}

const SKILLS = [
  ["grill-with-docs", "calls grilling + domain-modeling"],
  ["grilling", "interview until shared understanding"],
  ["domain-modeling", "write glossary + decisions down"],
  ["wayfinder", "chart a map of decisions"],
  ["code-review", "standards + spec, two axes"],
];
const PLUGIN_SKILLS = [
  ["wayfinder", "charted issue #2"],
  ["grilling", "issue #11 brief"],
  ["code-review", "before PR #27 merged"],
  ["implement", "ticket → shipped steps"],
];

export const cartridges: CityRigFactory = (preset) => {
  const mode = str(preset, "mode", "skills");
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];
  const custom = str(preset, "items", "");
  const items = custom ? custom.split("|").map((it) => it.split("~")) : mode === "plugins" ? PLUGIN_SKILLS : SKILLS;
  const cardMat = (body: string) => bin.add(new MeshBasicMaterial({ map: cardTexture(bin, body), fog: true }));
  const carts = items.map(([name, body], k) => {
    const c = cartridge(bin, name, body, k, cardMat);
    object.add(c.group);
    return c;
  });

  if (mode === "plugins") return plugins(bin, object, carts, hotspots);

  // --- skills: rack on the left, the robot head on the right ------------------------
  const rack = new Mesh(geo(bin, new BoxGeometry(carts.length * 1.4 + 0.4, 0.16, 1.0)), toon(bin, STEEL));
  const rackX = -4.2 + ((carts.length - 1) * 1.4) / 2;
  rack.position.set(rackX, SLOT_Y - 0.72, -0.2);
  object.add(rack);
  for (const side of [-1, 1]) {
    const leg = new Mesh(geo(bin, new BoxGeometry(0.16, SLOT_Y - 0.8 - FLOOR, 0.16)), toon(bin, STEEL));
    leg.position.set(rackX + side * (carts.length * 0.7), FLOOR + (SLOT_Y - 0.8 - FLOOR) / 2, -0.2);
    object.add(leg);
  }
  carts.forEach((c, k) => {
    c.home.set(-4.2 + k * 1.4, SLOT_Y, -0.2);
    c.group.position.copy(c.home);
  });

  const head = buildHead(bin);
  head.group.scale.setScalar(1.8);
  head.group.position.set(3.9, FLOOR + 1.9, -0.6);
  head.group.rotation.y = -0.35;
  object.add(head.group);
  // The slot on top of the skull, where a cartridge plugs in.
  const slot = new Mesh(geo(bin, new BoxGeometry(1.0, 0.12, 0.42)), toon(bin, INK));
  slot.position.set(3.9, FLOOR + 1.9 + 0.86, -0.6);
  slot.rotation.y = -0.35;
  object.add(slot);
  const plugged = new Vector3(3.9, FLOOR + 1.9 + 1.2, -0.6);

  const click = sfx(bin, "CLICK", { size: 0.6, tilt: -0.1 });
  click.position.set(5.0, FLOOR + 3.9, -0.2);
  object.add(click);
  const clickPop = popper(click);

  const spots = str(preset, "spots", "skill~skill|progressive-disclosure~only the name is loaded").split("|");
  spots.forEach((spec, k) => {
    const [term, text] = spec.split("~");
    hotspots.push({ term, label: text, anchor: k ? anchor(object, -4.2, FLOOR + 0.6, 0.4) : anchor(object, 3.9, FLOOR + 3.2, -0.6) });
  });

  let t = 0;
  const update = (ctx: CityFrame) => {
    t += ctx.dt;
    // The pointer calls the nearest cartridge; otherwise a script plays.
    let called = Math.floor(t / 3.5) % carts.length;
    if (ctx.pointer && ctx.pointer.x < 2.6) {
      let best = Infinity;
      carts.forEach((c, k) => {
        const d = Math.abs(ctx.pointer!.x - c.home.x);
        if (d < best) {
          best = d;
          called = k;
        }
      });
    }
    carts.forEach((c, k) => {
      // grill-with-docs (0) calls grilling (1) and domain-modeling (2): they
      // rise and open in place.
      const chained = !custom && called === 0 && (k === 1 || k === 2);
      const want = k === called ? 1 : chained ? 0.35 : 0;
      const prev = c.level;
      c.level = damp(c.level, want, 3, ctx.dt);
      if (k === called && prev < 0.97 && c.level >= 0.97) clickPop.fire();
      const l = Math.min(1, c.level);
      if (k === called || c.level > 0.4) {
        // Fly in an arc from the rack to the head slot.
        c.group.position.copy(c.home).lerp(plugged, l);
        c.group.position.y += Math.sin(l * Math.PI) * 1.4;
      } else {
        c.group.position.copy(c.home);
        c.group.position.y += c.level * 1.6;
      }
      c.group.rotation.y = k === called ? -0.35 * l : 0;
      setCard(c, k === called ? (l - 0.85) / 0.15 : chained ? (c.level - 0.25) / 0.1 : 0, k === called ? 1 : 0.75);
    });
    head.setEyes(0.4 + 0.6 * Math.min(1, carts[called].level));
    clickPop.update(ctx.dt);
  };

  return { object, hotspots, update, dispose: () => bin.dispose() };
};

/** A shipping crate opens; the cartridges it bundles rise out and unfold. */
function plugins(bin: Bin, object: Group, carts: Cartridge[], hotspots: Hotspot[]): CityRig {
  const crate = new Group();
  crate.position.set(0, FLOOR, -1.6);
  object.add(crate);
  const wood = toon(bin, TIMBER);
  const base = new Mesh(geo(bin, new BoxGeometry(3.4, 0.2, 1.8)), wood);
  base.position.y = 0.1;
  crate.add(base);
  const back = new Mesh(geo(bin, new BoxGeometry(3.4, 1.8, 0.14)), wood);
  back.position.set(0, 1.0, -0.83);
  crate.add(back);
  for (const side of [-1, 1]) {
    const wall = new Mesh(geo(bin, new BoxGeometry(0.14, 1.8, 1.8)), wood);
    wall.position.set(side * 1.63, 1.0, 0);
    crate.add(wall);
  }
  // Front wall hinged at the bottom; lid hinged at the back.
  const front = new Object3D();
  front.position.set(0, 0.2, 0.86);
  const frontPanel = new Mesh(geo(bin, new BoxGeometry(3.4, 1.7, 0.14).translate(0, 0.85, 0)), wood);
  front.add(frontPanel);
  const stencil = label(bin, "mattpocock-skills (plugin)", { size: 0.26, color: "#1b1a17" });
  stencil.position.set(0, 0.9, 0.12);
  front.add(stencil);
  crate.add(front);
  const lid = new Object3D();
  lid.position.set(0, 1.9, -0.86);
  lid.add(new Mesh(geo(bin, new BoxGeometry(3.4, 0.14, 1.8).translate(0, 0, 0.9)), wood));
  crate.add(lid);

  const creak = sfx(bin, "KRAK", { size: 0.6, color: "#f2e2a0" });
  creak.position.set(2.2, FLOOR + 2.8, -1.2);
  object.add(creak);
  const creakPop = popper(creak);

  hotspots.push({ term: "plugin", label: "plugin = bundle", anchor: anchor(object, 0, FLOOR + 2.4, -1.6) });

  let t = 0;
  let lastCycle = -1;
  const inside = new Vector3(0, FLOOR + 0.9, -1.6);
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx) {
      t += ctx.dt;
      const cycle = 10;
      const n = Math.floor(t / cycle);
      const u = (t % cycle) / cycle;
      if (n !== lastCycle) {
        lastCycle = n;
        creakPop.fire();
      }
      const closing = u > 0.85 ? Math.max(0, 1 - (u - 0.85) * 8) : 1;
      const open = Math.min(1, u * 6) * closing;
      front.rotation.x = open * 1.45;
      lid.rotation.x = -open * 1.9;
      carts.forEach((c, k) => {
        const rise = Math.min(1, Math.max(0, (u - 0.18 - k * 0.07) * 4)) * closing;
        const x = (k - (carts.length - 1) / 2) * 2.2;
        const out = new Vector3(x, FLOOR + 3.0 + (k % 2) * 0.35, 0.4);
        c.group.position.copy(inside).lerp(out, rise);
        c.group.position.y += Math.sin(ctx.time * 1.5 + k) * 0.05 * rise;
        c.group.scale.setScalar(0.5 + rise * 0.4);
        c.group.visible = rise > 0.02;
        setCard(c, (rise - 0.75) * 4);
      });
      creakPop.update(ctx.dt);
    },
  };
}
