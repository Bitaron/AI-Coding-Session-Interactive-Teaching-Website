import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type Sprite,
  type SpriteMaterial,
  type Texture,
  TextureLoader,
  TorusGeometry,
  Vector3,
} from "three";
import { frontend } from "../../../v2/content/frontend";
import v1Site from "../../assets/v1-site.png";
import { CAPTION, CONCRETE, CYAN, GREEN, INK, ORANGE, STEEL, ARMOR } from "../../engine/palette";
import { anchor, Bin, geo, glow, label, sfx, textTexture, toon } from "../kit";
import type { CityRig, Hotspot, SiteDef, Vantage } from "../rig";
import { damp } from "../rig";
import { buildHead } from "../robotkit";

// The frontend example: a billboard on the media plaza, raised one part per
// real screenshot of the session that designed this site. Some parts are
// steel (mast, truss, catwalk, lamps); some are what the screen shows — the
// prototype screenshots themselves, tried on one after another, until the
// decision lands and the billboard shows v1 of this guide.

type Kind =
  | "mast" | "truss" | "catwalk" | "screen" | "outfit" | "drone" | "plate"
  | "lampL" | "lampR" | "speakerL" | "speakerR" | "rail" | "check" | "crown";

/** One entry per screenshot, in evidence order. `tex`: shows that screenshot on the screen. */
const PLAN: { kind: Kind; tex?: boolean }[][] = [
  [{ kind: "mast" }],
  [{ kind: "truss" }, { kind: "catwalk" }],
  [{ kind: "screen" }, { kind: "outfit", tex: true }, { kind: "outfit", tex: true }, { kind: "outfit", tex: true }, { kind: "outfit", tex: true }, { kind: "drone" }, { kind: "outfit", tex: true }],
  [{ kind: "plate" }, { kind: "plate" }, { kind: "plate" }],
  [{ kind: "outfit", tex: true }, { kind: "lampL" }, { kind: "speakerL" }, { kind: "lampR" }, { kind: "outfit", tex: true }, { kind: "speakerR" }, { kind: "outfit", tex: true }],
  [{ kind: "rail", tex: true }, { kind: "check" }],
  [{ kind: "crown" }, { kind: "outfit", tex: true }],
];

const SFX: Record<Kind, string> = {
  mast: "CLANK!", truss: "KA-CHUNK", catwalk: "CLANG", screen: "FZZT!", outfit: "BLIP!", drone: "WHIRR",
  plate: "TNK!", lampL: "KLIK", lampR: "KLIK", speakerL: "THUMP", speakerR: "THUMP", rail: "ZIIIP", check: "PING!", crown: "TA-DA!",
};

const SPOTS: [string, string, [number, number, number]][][] = [
  [["agent-loop", "the same agent loop", [4.2, 9, 0.6]], ["skill", "frontend-design skill", [-4.2, 4, 0.6]]],
  [["grilling", "one question, one recommendation", [-8.6, 18, 0.4]], ["lazyweb", "“use lazyweb”", [6, 10.6, 1.6]]],
  [["lazyweb", "real UI references", [-5, 18, 0.3]], ["playwright-mcp", "a real browser", [6.5, 11.4, 1.2]]],
  [["lazyweb", "real references", [-4, 8.3, 0.4]], ["code-review", "cite, then check", [4, 8.3, 0.4]]],
  [["css-specificity", "checked in the live DOM", [5, 17, 0.3]]],
  [["playwright-mcp", "a real browser", [0, 20.2, 1]], ["deterministic", "same check, every variant", [7.8, 10.9, 0.8]]],
  [["adr", "a decision with sources", [-6, 21.2, 0.4]], ["human-in-the-loop", "the human picks", [6, 15, 0.3]]],
];

// Site-local framings, front (+z) facing the plaza. The screen spans y 11–20.
const VANTAGES: Vantage[] = [
  { eye: [11, 8, 24], target: [0, 6, 0] },
  { eye: [-14, 14, 24], target: [0, 13, 0] },
  { eye: [5, 15, 30], target: [0, 15, 0] },
  { eye: [-7, 9, 22], target: [0, 8.5, 0] },
  { eye: [14, 16, 27], target: [0, 15, 0] },
  { eye: [-11, 18, 24], target: [0, 16, 0] },
  { eye: [0, 13, 34], target: [0, 15.5, 0] },
];

const SCREEN = { w: 16, h: 9, y: 15.5, z: 0.08 };

interface Part {
  stage: number;
  kind: Kind;
  tex: boolean;
  label: string;
  src: string;
  solid: Group;
  minY: number;
  ghost: LineSegments;
  ghostMat: LineBasicMaterial;
  center: Vector3;
  prog: number;
  dur: number;
  sfx?: Sprite;
  sfxT: number;
  tag?: Sprite;
}

function build(): CityRig {
  const bin = new Bin();
  const object = new Group();
  const steel = toon(bin, STEEL);
  const armor = toon(bin, ARMOR);
  const dark = toon(bin, "#2a2926");
  const ink = toon(bin, INK);

  const pad = new Mesh(geo(bin, new BoxGeometry(14, 0.3, 6)), toon(bin, CONCRETE));
  pad.position.set(0, 0.15, -0.4);
  object.add(pad);

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat = steel, parent?: Object3D) => {
    const m = new Mesh(geo(bin, new BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z);
    parent?.add(m);
    return m;
  };

  // --- the screen: one material whose map is whatever was tried on last
  const screenMat = bin.add(new MeshBasicMaterial({ color: "#2a2926" }));
  const flashMat = glow(bin, 0xffffff, 0);
  flashMat.depthWrite = false;
  const textures = new Map<string, Texture | null>();
  const loader = new TextureLoader();
  const want = (src: string) => {
    if (textures.has(src)) return;
    textures.set(src, null);
    const tex = bin.add(loader.load(src, (t) => textures.set(src, t)));
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
  };
  const ready = (src: string) => textures.get(src) ?? null;

  // --- drone that inspects the screen (part of round 1, sweeps in stage 5)
  const drone = new Group();
  box(0.9, 0.35, 0.7, 0, 0, 0, armor, drone);
  const lens = new Mesh(geo(bin, new CylinderGeometry(0.16, 0.16, 0.12, 12)), glow(bin, CYAN));
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.38;
  drone.add(lens);
  for (const s of [-1, 1]) {
    const rotor = new Mesh(geo(bin, new TorusGeometry(0.28, 0.04, 6, 16)), dark);
    rotor.rotation.x = Math.PI / 2;
    rotor.position.set(s * 0.6, 0.22, 0);
    drone.add(rotor);
  }
  const scanMat = glow(bin, CYAN, 0);
  scanMat.depthWrite = false;
  const scan = new Mesh(geo(bin, new PlaneGeometry(0.3, SCREEN.h + 0.4)), scanMat);
  object.add(scan);
  const bugMat = glow(bin, ORANGE, 0);
  const bug = new Mesh(geo(bin, new TorusGeometry(0.55, 0.1, 8, 24)), bugMat);
  bug.position.set(3.5, 13.2, SCREEN.z + 0.06);
  object.add(bug);
  const DRONE_PARK = new Vector3(6.5, 11.0, 1.2);

  const bulbs: MeshBasicMaterial[] = [];

  /** Geometry for each kind of part, in site space. */
  const make = (kind: Kind, slot: number): Group => {
    const g = new Group();
    switch (kind) {
      case "mast":
        for (const x of [-4.2, 4.2]) box(1, 11, 1, x, 5.5, -0.6, steel, g);
        for (const y of [3.8, 7.6]) box(8.4, 0.35, 0.35, 0, y, -0.6, steel, g);
        break;
      case "truss": {
        box(17.6, 0.4, 0.4, 0, 20.4, -0.6, steel, g);
        box(17.6, 0.4, 0.4, 0, 10.6, -0.6, steel, g);
        for (const x of [-8.6, 8.6]) box(0.4, 10.2, 0.4, x, 15.5, -0.6, steel, g);
        for (const s of [-1, 1]) {
          const d = box(0.25, 19, 0.25, s * 4.2, 15.5, -1.1, steel, g);
          d.rotation.z = s * 1.03;
        }
        break;
      }
      case "catwalk":
        box(17, 0.2, 1.6, 0, 10.3, 0.9, steel, g);
        box(17, 0.08, 0.08, 0, 11.2, 1.65, steel, g);
        for (let x = -8; x <= 8; x += 2) box(0.08, 0.9, 0.08, x, 10.75, 1.65, steel, g);
        break;
      case "screen": {
        box(SCREEN.w + 0.6, SCREEN.h + 0.6, 0.5, 0, SCREEN.y, -0.2, dark, g);
        const face = new Mesh(geo(bin, new PlaneGeometry(SCREEN.w, SCREEN.h)), screenMat);
        face.position.set(0, SCREEN.y, SCREEN.z);
        g.add(face);
        const flash = new Mesh(geo(bin, new PlaneGeometry(SCREEN.w, SCREEN.h)), flashMat);
        flash.position.set(0, SCREEN.y, SCREEN.z + 0.03);
        g.add(flash);
        break;
      }
      case "drone":
        drone.position.copy(DRONE_PARK);
        g.add(drone);
        break;
      case "plate": {
        box(13, 0.3, 0.3, 0, 9.2, 0, steel, g).visible = slot === 0;
        const x = -4.4 + slot * 4.4;
        const { texture, aspect } = textTexture(bin, frontend.steps[3].evidence?.[slot]?.label ?? "ref", { background: "#e9e4d8" });
        const h = 0.9;
        const w = Math.min(4, h * aspect);
        box(w + 0.2, h + 0.2, 0.12, x, 8.3, 0, dark, g);
        const face = new Mesh(geo(bin, new PlaneGeometry(w, h)), bin.add(new MeshBasicMaterial({ map: texture })));
        face.position.set(x, 8.3, 0.07);
        g.add(face);
        break;
      }
      case "lampL":
      case "lampR": {
        const s = kind === "lampL" ? -1 : 1;
        box(0.25, 2.2, 0.25, s * 9.6, 11.4, 1.2, steel, g);
        const head = new Mesh(geo(bin, new CylinderGeometry(0.35, 0.5, 0.8, 12)), dark);
        head.position.set(s * 9.6, 12.7, 1.2);
        head.rotation.z = s * 0.7;
        g.add(head);
        const beamMat = glow(bin, CAPTION, 0.22);
        beamMat.depthWrite = false;
        const beam = new Mesh(geo(bin, new ConeGeometry(2.4, 6.5, 16, 1, true).translate(0, -3.25, 0)), beamMat);
        beam.position.set(s * 9.6, 12.7, 1.2);
        beam.rotation.z = Math.PI + s * 0.7;
        g.add(beam);
        break;
      }
      case "speakerL":
      case "speakerR": {
        const s = kind === "speakerL" ? -1 : 1;
        box(1.6, 3.4, 1.3, s * 9.9, 16.2, -0.4, dark, g);
        for (const y of [15.3, 17.0]) {
          const cone = new Mesh(geo(bin, new CylinderGeometry(0.55, 0.55, 0.1, 16)), ink);
          cone.rotation.x = Math.PI / 2;
          cone.position.set(s * 9.9, y, 0.3);
          g.add(cone);
        }
        break;
      }
      case "rail":
        box(16.4, 0.15, 0.15, 0, 20.05, 0.9, steel, g);
        for (const x of [-8.2, 8.2]) box(0.15, 0.15, 1.5, x, 20.05, 0.2, steel, g);
        break;
      case "check": {
        box(0.6, 0.6, 0.3, 7.8, 10.9, 0.6, dark, g);
        const lamp = new Mesh(geo(bin, new SphereGeometry(0.22, 12, 8)), glow(bin, GREEN));
        lamp.position.set(7.8, 10.9, 0.8);
        g.add(lamp);
        break;
      }
      case "crown":
        box(17.4, 1.0, 0.6, 0, 21.2, -0.4, armor, g);
        for (let i = 0; i < 18; i++) {
          const m = glow(bin, CAPTION);
          bulbs.push(m);
          const b = new Mesh(geo(bin, new SphereGeometry(0.16, 8, 6)), m);
          b.position.set(-8.1 + i * 0.95, 21.2, -0.05);
          g.add(b);
        }
        break;
      case "outfit":
        break;
    }
    return g;
  };

  // --- parts: one per screenshot -----------------------------------------------------
  const parts: Part[] = [];
  const screenBox = new Box3(new Vector3(-SCREEN.w / 2, SCREEN.y - SCREEN.h / 2, -0.3), new Vector3(SCREEN.w / 2, SCREEN.y + SCREEN.h / 2, 0.3));
  PLAN.forEach((list, stage) => {
    const evidence = frontend.steps[stage]?.evidence ?? [];
    if (import.meta.env.DEV && evidence.length !== list.length) {
      console.warn(`billboard: stage ${stage} plans ${list.length} parts for ${evidence.length} screenshots`);
    }
    let plates = 0;
    list.forEach((spec, i) => {
      const solid = make(spec.kind, spec.kind === "plate" ? plates++ : i);
      object.add(solid);
      const bounds = spec.kind === "outfit" ? screenBox.clone() : new Box3().setFromObject(solid);
      const size = bounds.getSize(new Vector3()).addScalar(0.3);
      const ghostMat = bin.add(new LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthWrite: false }));
      const ghost = new LineSegments(geo(bin, new EdgesGeometry(geo(bin, new BoxGeometry(size.x, size.y, size.z)))), ghostMat);
      const center = bounds.getCenter(new Vector3());
      ghost.position.copy(center);
      ghost.visible = false;
      object.add(ghost);
      solid.visible = false;
      parts.push({
        stage,
        kind: spec.kind,
        tex: !!spec.tex,
        label: evidence[i]?.label ?? spec.kind,
        src: evidence[i]?.src ?? "",
        solid,
        minY: bounds.min.y,
        ghost,
        ghostMat,
        center,
        prog: 0,
        dur: spec.kind === "outfit" ? 0.9 : 1.3,
        sfxT: 0,
      });
    });
  });

  // --- the builder: a small robot head on a rotor, with a cyan beam -------------------
  const builder = new Group();
  const bhead = buildHead(bin);
  builder.add(bhead.group);
  const rotor = new Mesh(geo(bin, new TorusGeometry(0.55, 0.05, 6, 24)), dark);
  rotor.rotation.x = Math.PI / 2;
  rotor.position.y = 0.75;
  builder.add(rotor);
  builder.scale.setScalar(0.9);
  const PARK = new Vector3(-7.5, 2.2, 4.5);
  builder.position.copy(PARK);
  object.add(builder);
  const beamMat = glow(bin, CYAN, 0.55);
  beamMat.depthWrite = false;
  const beam = new Mesh(geo(bin, new CylinderGeometry(0.05, 0.05, 1, 6)), beamMat);
  beam.visible = false;
  object.add(beam);

  // --- hotspots per stage ------------------------------------------------------------------
  const spots: Hotspot[][] = SPOTS.map((list) => list.map(([term, text, p]) => ({ term, label: text, anchor: anchor(object, ...p) })));

  let held = -1;
  let settle = 0;
  let doneAt = -1;
  let shown: Texture | null = null;
  let flash = 0;
  const up = new Vector3(0, 1, 0);
  const tmp = new Vector3();

  const showOnScreen = (tex: Texture | null) => {
    if (tex === shown) return;
    const hadMap = !!screenMat.map;
    shown = tex;
    screenMat.map = tex;
    if (hadMap !== !!tex) screenMat.needsUpdate = true;
    flash = 1;
  };

  return {
    object,
    get hotspots() {
      return held >= 0 ? spots[held] : [];
    },
    update(ctx) {
      const { dt, time, lod } = ctx;
      if (ctx.stage !== null && ctx.stage !== held) {
        held = ctx.stage;
        settle = 0;
        doneAt = -1;
      }
      settle = lod === 0 ? settle + dt : ctx.stage === null ? 9 : settle;
      const snap = lod === 2;

      // Build state: earlier stages fast, this stage one part at a time, later ones undone.
      let gate = settle > 0.5;
      let active: Part | null = null;
      for (const p of parts) {
        const before = p.prog;
        if (p.stage < held) p.prog = snap ? 1 : Math.min(1, p.prog + dt * 2.5);
        else if (p.stage > held) p.prog = snap ? 0 : Math.max(0, p.prog - dt * 4);
        else {
          if (gate || snap) p.prog = snap ? 1 : Math.min(1, p.prog + dt / p.dur);
          gate = gate && p.prog >= 1;
          if (!active && p.prog > 0 && p.prog < 1) active = p;
        }
        if (p.tex && p.prog > 0) want(p.src);
        // Completion: one sound effect, only where someone is looking.
        if (before < 1 && p.prog >= 1 && p.stage === held && lod === 0) {
          p.sfx ??= sfx(bin, SFX[p.kind], { size: p.kind === "outfit" ? 1.3 : 0.9, tilt: -0.08 + (parts.indexOf(p) % 3) * 0.07 });
          if (!p.sfx.parent) object.add(p.sfx);
          p.sfx.position.copy(p.center).add(tmp.set(p.kind === "outfit" ? 5 : 1.5, p.kind === "outfit" ? 3.4 : 1.2, 1.5));
          p.sfxT = 1;
          if (p.tex) flash = 1;
        }
        // Solid grows up from its base once the outline has been drawn.
        const s = Math.max(0, Math.min(1, (p.prog - 0.35) / 0.65));
        const e = 1 - Math.pow(1 - s, 3);
        p.solid.visible = s > 0.001;
        p.solid.scale.y = Math.max(0.001, e);
        p.solid.position.y = p.minY * (1 - e);
        p.ghost.visible = p.prog > 0 && p.prog < 1;
        p.ghostMat.color.copy(CYAN);
        p.ghostMat.opacity = p.prog < 0.35 ? p.prog / 0.35 : 1 - s;
        if (p.sfx) {
          p.sfxT = Math.max(0, p.sfxT - dt * 1.1);
          p.sfx.visible = p.sfxT > 0;
          (p.sfx.material as SpriteMaterial).opacity = Math.min(1, p.sfxT * 2.5);
          p.sfx.position.y += dt * 0.4;
        }
      }
      const stageParts = parts.filter((p) => p.stage === held);
      if (held === PLAN.length - 1 && stageParts.every((p) => p.prog >= 1) && doneAt < 0) doneAt = time;

      // Hovered screenshot: outline its part, name it, and show it if it is a screen.
      const hovered = ctx.evidence >= 0 ? stageParts[ctx.evidence] : undefined;
      for (const p of parts) p.tag && (p.tag.visible = false);
      if (hovered) {
        hovered.ghost.visible = true;
        hovered.ghostMat.color.copy(ORANGE);
        hovered.ghostMat.opacity = 0.6 + Math.sin(time * 8) * 0.3;
        hovered.tag ??= label(bin, hovered.label, { size: 0.6, background: "#f2e2a0" });
        if (!hovered.tag.parent) object.add(hovered.tag);
        hovered.tag.visible = true;
        hovered.tag.position.copy(hovered.center).add(tmp.set(0, hovered.kind === "outfit" ? SCREEN.h / 2 + 1.2 : 1.6, 1.2));
        if (hovered.src) want(hovered.src);
      }

      // What the screen shows: hovered screenshot, else v1 once the decision
      // has settled, else the latest screenshot tried on.
      let show: Texture | null = null;
      if (hovered?.tex) show = ready(hovered.src);
      else if (doneAt >= 0 && time - doneAt > 2.5) {
        want(v1Site);
        show = ready(v1Site);
      } else {
        for (const p of parts) if (p.tex && p.prog >= 1 && ready(p.src)) show = ready(p.src);
      }
      if (show || !hovered) showOnScreen(show);
      const screenOn = parts.find((p) => p.kind === "screen")!.prog >= 1;
      if (!screenMat.map) screenMat.color.set(screenOn ? "#46585b" : "#2a2926");
      else screenMat.color.set(0xffffff);
      flash = Math.max(0, flash - dt * 2.2);
      flashMat.opacity = flash * 0.75;

      // Builder flies to the part in progress and beams it up.
      if (lod < 2) {
        const goal = active ? tmp.copy(active.center).add(new Vector3(active.kind === "outfit" ? 6 : 1.8, 0.8, 3.2)) : PARK;
        builder.position.x = damp(builder.position.x, goal.x, 3, dt);
        builder.position.y = damp(builder.position.y, goal.y + Math.sin(time * 2.4) * 0.15, 3, dt);
        builder.position.z = damp(builder.position.z, goal.z, 3, dt);
        rotor.rotation.z += dt * 18;
        bhead.setEyes(active ? 1 : 0.6);
        beam.visible = !!active && active.kind !== "outfit";
        if (active && beam.visible) {
          const from = builder.position;
          const dir = active.center.clone().sub(from);
          const len = dir.length();
          beam.position.copy(from).addScaledVector(dir, 0.5);
          beam.quaternion.setFromUnitVectors(up, dir.normalize());
          beam.scale.set(1, len, 1);
          beamMat.opacity = 0.35 + Math.sin(time * 20) * 0.2;
        }
        builder.lookAt(active ? active.center : tmp.set(0, 6, 20));
      }

      // Stage 5: the drone sweeps the screen, raster-style; the bug lights orange as it passes.
      const sweeping = held === 5 && ctx.focused && lod === 0;
      if (sweeping) {
        const x = Math.sin(time * 0.8) * (SCREEN.w / 2 - 0.6);
        drone.position.x = damp(drone.position.x, x, 6, dt);
        drone.position.y = damp(drone.position.y, 20.6, 4, dt);
        drone.position.z = damp(drone.position.z, 0.9, 4, dt);
      } else {
        drone.position.x = damp(drone.position.x, DRONE_PARK.x, 3, dt);
        drone.position.y = damp(drone.position.y, DRONE_PARK.y, 3, dt);
        drone.position.z = damp(drone.position.z, DRONE_PARK.z, 3, dt);
      }
      scan.visible = sweeping;
      scan.position.set(drone.position.x, SCREEN.y, SCREEN.z + 0.2);
      scanMat.opacity = 0.22;
      bug.visible = held === 5;
      bugMat.opacity = Math.abs(drone.position.x - bug.position.x) < 1.2 ? 1 : 0.35 + Math.sin(time * 6) * 0.15;

      // Marquee chase once the crown is up.
      bulbs.forEach((m, i) => m.color.copy(CAPTION).multiplyScalar(((i + Math.floor(time * 6)) % 3 === 0 ? 1 : 0.55)));
    },
    dispose() {
      bin.dispose();
    },
  };
}

export const billboardSite: SiteDef = {
  id: "billboard",
  vantages: VANTAGES,
  clear: 32,
  build,
};
