import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from "three";
import { CYAN, GREEN, INK, ORANGE, PAPER, STEEL } from "../engine/palette";
import { anchor, balloon, Bin, budget, geo, glow, label, textTexture, toon } from "./kit";
import { damp, hash, str, type CityFrame, type CityRig, type CityRigFactory, type Hotspot } from "./rig";
import { buildHead, type RobotHead } from "./robotkit";

/**
 * The robot head — the model itself, standing in the new city.
 *  - "tokens": candidate next words rise as bars beside the head (height =
 *    probability after temperature); one is picked and spoken from the
 *    mouth onto the ticker in front of it.
 *  - "reasoning": the same, with the lid open — dark thinking tokens churn
 *    inside the skull before each visible word; a counter keeps the bill.
 *  - "drive": the lid open on a hard drive. Each token is a block written
 *    along the platter's spiral track; past the green track (60%) blocks
 *    turn orange, and the middle of a long context fades.
 *  - "twins": two heads, two sessions. Each answers from what's poured in,
 *    then powers down and forgets; every other pair, the app's memory
 *    cartridge carries a few chips across.
 */

const Y = new Vector3(0, 1, 0);
const ease = (t: number) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

function standingHead(bin: Bin, object: Group, x: number, y: number, scale: number, bay: boolean): RobotHead {
  const h = buildHead(bin, { bay });
  h.group.scale.setScalar(scale);
  h.group.position.set(x, y, 0);
  const collarH = Math.max(0.2, y - scale * 0.47);
  const collar = new Mesh(geo(bin, new CylinderGeometry(scale * 0.2, scale * 0.34, collarH, 20)), toon(bin, STEEL));
  collar.position.set(x, collarH / 2, 0);
  object.add(h.group, collar);
  return h;
}

// --- tokens & reasoning ---------------------------------------------------------

const SCRIPT: { words: string[]; logits: number[] }[] = [
  { words: ["The", "A", "This", "Our", "Bananas"], logits: [2.4, 1.2, 0.9, 0.4, -2] },
  { words: ["agent", "model", "test", "user", "moon"], logits: [2.2, 1.6, 0.5, 0.4, -2.2] },
  { words: ["reads", "edits", "runs", "skips", "sings"], logits: [2.0, 1.5, 1.2, -0.4, -2.4] },
  { words: ["the", "every", "one", "no", "purple"], logits: [2.6, 0.8, 0.6, -0.6, -2.5] },
  { words: ["file", "test", "spec", "diff", "song"], logits: [1.9, 1.7, 1.0, 0.8, -2.1] },
];

const TICKER_RIGHT = 4.9;
const TICKER_LEFT = -4.3;
const THINKERS = 40;

function speaker(reasoning: boolean): CityRig {
  const bin = new Bin();
  const object = new Group();
  const S = 2.6;
  const HX = -2.7;
  const head = standingHead(bin, object, HX, 2.3, S, reasoning);
  head.group.rotation.y = 0.3;
  const mouth = new Vector3(0, -0.27, 0.55).multiplyScalar(S).applyAxisAngle(Y, 0.3).add(head.group.position);

  // Projector pad and candidate bars: "generated" light is cyan.
  const pad = new Mesh(geo(bin, new BoxGeometry(4.4, 0.16, 1.3)), toon(bin, STEEL));
  pad.position.set(1.4, 0.08, 0.2);
  object.add(pad);
  const barGeo = geo(bin, new BoxGeometry(0.42, 1, 0.42).translate(0, 0.5, 0));
  const fan = SCRIPT[0].words.map((_, k) => {
    const mat = glow(bin, CYAN, 0.9);
    const bar = new Mesh(barGeo, mat);
    bar.position.set(-0.3 + k * 0.85, 0.16, 0.2);
    object.add(bar);
    return { bar, mat, height: 0.1 };
  });
  // Every candidate label up front; only the current step's are shown.
  const tags = SCRIPT.map((s) =>
    s.words.map((w, k) => {
      const t = label(bin, w, { size: 0.34 });
      t.position.set(fan[k].bar.position.x, 1, 0.2);
      t.visible = false;
      object.add(t);
      return t;
    })
  );

  // The ticker: everything said so far, newest on the right.
  const ticker = new Mesh(geo(bin, new BoxGeometry(TICKER_RIGHT - TICKER_LEFT + 0.6, 0.75, 0.25)), toon(bin, INK));
  ticker.position.set((TICKER_RIGHT + TICKER_LEFT) / 2, 0.45, 2.3);
  object.add(ticker);
  const wordMats = new Map<string, { mat: SpriteMaterial; aspect: number }>();
  const wordMat = (w: string) => {
    let entry = wordMats.get(w);
    if (!entry) {
      const { texture, aspect } = textTexture(bin, w, { background: "#f7f3ea" });
      entry = { mat: bin.add(new SpriteMaterial({ map: texture, fog: true })), aspect };
      wordMats.set(w, entry);
    }
    return entry;
  };
  const tiles: { sprite: Sprite; w: number; x: number; fly: number }[] = [];

  // Thinking tokens: dark cubes orbiting inside the open skull.
  const thinkers = new InstancedMesh(geo(bin, new BoxGeometry(0.07, 0.07, 0.07)), toon(bin, "#3a3833"), THINKERS);
  thinkers.instanceMatrix.setUsage(DynamicDrawUsage);
  thinkers.count = 0;
  if (reasoning) head.bay!.add(thinkers);
  const ages: number[] = [];

  const counterCanvas = document.createElement("canvas");
  counterCanvas.width = 768;
  counterCanvas.height = 160;
  const counterTex = bin.add(new CanvasTexture(counterCanvas));
  const counter = new Sprite(bin.add(new SpriteMaterial({ map: counterTex, transparent: true, depthWrite: false })));
  counter.scale.set(3.6, 0.75, 1);
  counter.position.set(2.4, 5.0, -0.4);
  if (reasoning) object.add(counter);
  let visibleCount = 0;
  let thinkingCount = 0;
  const drawCounter = () => {
    const c = counterCanvas.getContext("2d")!;
    c.clearRect(0, 0, 768, 160);
    c.font = '600 46px ui-monospace, "SF Mono", Menlo, monospace';
    c.fillStyle = "#5d584d";
    c.fillText(`thinking  ${String(thinkingCount).padStart(4)}`, 10, 60);
    c.fillStyle = "#1b1a17";
    c.fillText(`visible   ${String(visibleCount).padStart(4)}`, 10, 130);
    counterTex.needsUpdate = true;
  };
  drawCounter();

  const hotspots: Hotspot[] = [
    { term: "next-token", label: "next-token distribution", anchor: anchor(object, 1.4, 3.0, 0.2) },
    { term: "temperature", label: "temperature", anchor: anchor(object, 2.6, 0.3, 1.0) },
  ];
  if (reasoning) hotspots.push({ term: "reasoning-tokens", label: "reasoning tokens", anchor: anchor(object, HX, 3.9, 0) });

  let step = 0;
  let timer = 0;
  let pendingThinking = 0;
  let flash = 0;
  let chosen = -1;
  const o = new Object3D();
  const bright = CYAN.clone();

  const probabilities = (temp: number) => {
    const t = Math.max(temp, 0.05);
    const ex = SCRIPT[step % SCRIPT.length].logits.map((l) => Math.exp(l / t));
    const sum = ex.reduce((a, b) => a + b, 0);
    return ex.map((e) => e / sum);
  };

  const speak = (word: string) => {
    const { mat, aspect } = wordMat(word);
    const sprite = new Sprite(mat);
    sprite.scale.set(0.42 * aspect, 0.42, 1);
    sprite.position.copy(mouth);
    object.add(sprite);
    tiles.unshift({ sprite, w: 0.42 * aspect + 0.1, x: TICKER_RIGHT, fly: 0 });
  };

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: CityFrame) {
      const { temperature, effort } = ctx.params;
      const probs = probabilities(temperature);
      timer += ctx.dt;

      if (reasoning && pendingThinking > 0 && timer > 0.09) {
        timer = 0;
        pendingThinking--;
        thinkingCount++;
        if (ages.length < budget(ctx.lod, THINKERS)) ages.push(0);
        drawCounter();
      } else if (timer > 1.5 && pendingThinking === 0) {
        timer = 0;
        // Deterministic sampling, so a presenter sees the same run twice.
        const r = hash(step * 9.13 + Math.floor(ctx.time));
        let acc = 0;
        chosen = probs.length - 1;
        for (let k = 0; k < probs.length; k++) {
          acc += probs[k];
          if (r <= acc) {
            chosen = k;
            break;
          }
        }
        speak(SCRIPT[step % SCRIPT.length].words[chosen]);
        visibleCount++;
        flash = 1;
        step++;
        if (reasoning) {
          pendingThinking = Math.round(Math.pow(effort, 1.7) * 2.2 + hash(step) * effort * 2);
          drawCounter();
        }
      }
      flash = Math.max(0, flash - ctx.dt * 1.8);
      head.talk(flash > 0.4 ? 1 : 0);
      head.setEyes(1, bright);
      if (head.lid) head.lid.rotation.x = damp(head.lid.rotation.x, -1.9, 3, ctx.dt);

      const now = tags[step % SCRIPT.length];
      tags.forEach((row) => row.forEach((t) => (t.visible = row === now)));
      const nowProbs = probabilities(temperature);
      fan.forEach((f, k) => {
        f.height = damp(f.height, 0.2 + nowProbs[k] * 3.2, 6, ctx.dt);
        f.bar.scale.y = f.height;
        now[k].position.y = 0.16 + f.height + 0.35;
        f.mat.color.copy(CYAN).lerp(ORANGE, k === chosen ? flash : 0);
      });

      // Tiles fly from the mouth, then slide left as newer words arrive.
      let right = TICKER_RIGHT;
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const slot = right - t.w / 2;
        right -= t.w;
        t.x = damp(t.x, slot, 6, ctx.dt);
        t.fly = Math.min(1, t.fly + ctx.dt * 2.2);
        const e = ease(t.fly);
        t.sprite.position.set(mouth.x + (t.x - mouth.x) * e, mouth.y + (0.45 - mouth.y) * e + Math.sin(e * Math.PI) * 1.1, mouth.z + (2.47 - mouth.z) * e);
        t.sprite.visible = t.x - t.w / 2 > TICKER_LEFT;
        if (t.x < TICKER_LEFT - 2) {
          object.remove(t.sprite);
          tiles.splice(i--, 1);
        }
      }

      // Each thought orbits in the skull for a moment, then is spent.
      for (let i = ages.length - 1; i >= 0; i--) {
        ages[i] += ctx.dt;
        if (ages[i] > 1.6) ages.splice(i, 1);
      }
      thinkers.count = ages.length;
      ages.forEach((age, i) => {
        const a = age * 4 + i * 2.1;
        const r = 0.12 + (i % 3) * 0.08;
        o.position.set(Math.cos(a) * r, 0.04 + age * 0.22, Math.sin(a) * r);
        o.rotation.set(age * 3, a, 0);
        o.scale.setScalar(age > 1.2 ? (1.6 - age) / 0.4 : 1);
        o.updateMatrix();
        thinkers.setMatrixAt(i, o.matrix);
      });
      thinkers.instanceMatrix.needsUpdate = true;
    },
  };
}

// --- drive -------------------------------------------------------------------------

const CAPACITY = 260;
const USABLE = 0.6;

function drive(): CityRig {
  const bin = new Bin();
  const object = new Group();
  const S = 4.2;
  const head = standingHead(bin, object, 0, 2.2, S, true);
  head.setEyes(1);

  // The drive, in head units, sticking up out of the open skull and tilted
  // toward the camera so the platter reads face-on.
  const mount = new Group();
  mount.position.set(0, 0.35, 0.02);
  mount.rotation.x = 0.95;
  head.bay!.add(mount);
  const platter = new Group();
  mount.add(platter);
  platter.add(new Mesh(geo(bin, new CylinderGeometry(0.42, 0.42, 0.025, 72)), toon(bin, STEEL)));
  const spindle = new Mesh(geo(bin, new CylinderGeometry(0.05, 0.05, 0.06, 16)), toon(bin, INK));
  mount.add(spindle);

  // Spiral track, inside out, constant spacing along the groove.
  const track: { r: number; a: number }[] = [];
  const pitch = 0.05;
  let theta = 0;
  for (let k = 0; k < CAPACITY; k++) {
    const r = 0.1 + (pitch * theta) / (Math.PI * 2);
    track.push({ r, a: theta });
    theta += 0.034 / r;
  }
  const blocks = new InstancedMesh(geo(bin, new BoxGeometry(0.03, 0.018, 0.026)), toon(bin, 0xffffff), CAPACITY);
  const o = new Object3D();
  track.forEach(({ r, a }, k) => {
    o.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    o.rotation.set(0, -a, 0);
    o.updateMatrix();
    blocks.setMatrixAt(k, o.matrix);
  });
  blocks.count = 0;
  platter.add(blocks);

  const usableR = track[Math.round(CAPACITY * USABLE)].r + pitch / 2;
  const usable = new Mesh(geo(bin, new TorusGeometry(usableR, 0.006, 6, 96).rotateX(Math.PI / 2)), glow(bin, GREEN));
  usable.position.y = 0.022;
  mount.add(usable);

  // The read arm pivots outside the platter and swings its tip to the last write.
  const P = new Vector3(0.44, 0.05, 0.26);
  const L = Math.hypot(P.x, P.z);
  const arm = new Group();
  arm.position.copy(P);
  const beam = new Mesh(geo(bin, new BoxGeometry(L, 0.02, 0.035).translate(L / 2, 0, 0)), toon(bin, INK));
  const pivot = new Mesh(geo(bin, new CylinderGeometry(0.04, 0.04, 0.05, 12)), toon(bin, ORANGE));
  arm.add(beam, pivot);
  mount.add(arm);
  const towardCenter = Math.atan2(P.z, -P.x);

  // Labels sit where the drive is, measured once in rig space.
  object.updateMatrixWorld(true);
  const at = (local: Vector3) => mount.localToWorld(local.clone());
  const tWindow = label(bin, "context window", { size: 0.36 });
  tWindow.position.set(-3.4, 4.9, 0);
  const tUsable = label(bin, "usable", { size: 0.32, color: "#1f8a56" });
  tUsable.position.copy(at(new Vector3(-usableR, 0.08, -0.05))).add(new Vector3(-0.5, 0, 0.2));
  object.add(tWindow, tUsable);
  const hotspots: Hotspot[] = [
    { term: "context-window", label: "context window", anchor: anchor(object, -2.4, 3.2, 0.4) },
    { term: "lost-in-the-middle", label: "lost in the middle", anchor: anchor(object, ...at(new Vector3(0, 0.05, 0)).toArray()) },
    { term: "context-rot", label: "context rot", anchor: anchor(object, ...at(new Vector3(0.4, 0.05, 0.2)).toArray()) },
  ];

  let shown = 0;
  let pour = 0;
  let tipR = 0.1;
  const col = new Color();

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: CityFrame) {
      if (head.lid) head.lid.rotation.x = damp(head.lid.rotation.x, -2.1, 3, ctx.dt);
      platter.rotation.y += ctx.dt * 0.35;

      // Tokens are written one at a time, so moving the slider pours or erases.
      const target = Math.round(ctx.params.contextFill * CAPACITY);
      pour += ctx.dt;
      if (pour > 0.04 && shown !== target) {
        pour = 0;
        const n = Math.ceil(Math.max(1, Math.abs(target - shown) / 12));
        shown += Math.sign(target - shown) * Math.min(n, Math.abs(target - shown));
      }
      blocks.count = shown;
      for (let k = 0; k < shown; k++) {
        // Attention is U-shaped over position: strong at both ends.
        const u = shown > 1 ? k / (shown - 1) : 0;
        const attention = shown < 40 ? 1 : 0.2 + 0.8 * Math.pow(Math.abs(u - 0.5) * 2, 1.6);
        if (k >= CAPACITY * USABLE) col.copy(ORANGE);
        else col.copy(PAPER).lerp(INK, attention);
        blocks.setColorAt(k, col);
      }
      if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;

      tipR = damp(tipR, shown ? track[shown - 1].r : 0.1, 8, ctx.dt);
      const delta = Math.acos(Math.max(-1, Math.min(1, 1 - (tipR * tipR) / (2 * L * L))));
      arm.rotation.y = towardCenter + delta;
    },
  };
}

// --- twins -------------------------------------------------------------------------

const SESSION = 7;

function twins(): CityRig {
  const bin = new Bin();
  const object = new Group();
  const chipGeo = geo(bin, new BoxGeometry(0.09, 0.05, 0.09));
  const sides = [-3, 3].map((x, i) => {
    const head = standingHead(bin, object, x, 2.0, 1.9, true);
    const chips = new InstancedMesh(chipGeo, toon(bin, INK), 14);
    chips.count = 0;
    head.bay!.add(chips);
    const o = new Object3D();
    for (let k = 0; k < 14; k++) {
      const a = k * 2.39996;
      const r = Math.sqrt(k + 0.5) * 0.075;
      o.position.set(Math.cos(a) * r, 0.03 + (k % 3) * 0.04, Math.sin(a) * r);
      o.rotation.y = a;
      o.updateMatrix();
      chips.setMatrixAt(k, o.matrix);
    }
    const tag = label(bin, i === 0 ? "session A" : "session B", { size: 0.34 });
    tag.position.set(x, 0.4, 1.5);
    object.add(tag);
    const bay = head.group.position.clone().add(new Vector3(0, 0.3 * 1.9, 0));
    const say = (text: string, kind: "speech" | "robot", px: number, py: number) => {
      const b = balloon(bin, text, kind, { height: 0.62, tail: px > x ? "left" : "right" });
      b.position.set(px, py, 0.6);
      object.add(b);
      return b;
    };
    const out = i === 0 ? -1 : 1;
    const asks = i === 0 ? [say("My name is Sam.", "speech", x + out * 0.2, 4.6), say("Keep answers short.", "speech", x + out * 0.2, 3.9)] : [say("What's my name?", "speech", x + out * 0.2, 4.3)];
    const replies =
      i === 0 ? [say("Got it, Sam.", "robot", x - out * 2.0, 2.9)] : [say("I don't know your name.", "robot", x - out * 2.0, 2.9), say("You're Sam.", "robot", x - out * 2.0, 2.9)];
    return { head, chips, bay, asks, replies };
  });

  // The application's memory: a cartridge between the sessions.
  const cart = new Group();
  cart.position.set(0, 0, 1.0);
  const stand = new Mesh(geo(bin, new CylinderGeometry(0.35, 0.45, 0.6, 16)), toon(bin, STEEL));
  stand.position.y = 0.3;
  const box = new Mesh(geo(bin, new BoxGeometry(0.9, 0.5, 0.6)), toon(bin, STEEL));
  box.position.y = 0.85;
  const stripe = new Mesh(geo(bin, new BoxGeometry(0.92, 0.12, 0.62)), toon(bin, ORANGE));
  stripe.position.y = 0.95;
  cart.add(stand, box, stripe);
  object.add(cart);
  const memOff = label(bin, "app memory: off", { size: 0.3 });
  const memOn = label(bin, "app memory: on", { size: 0.3, color: "#1f8a56" });
  memOff.position.set(0, 1.55, 1.0);
  memOn.position.copy(memOff.position);
  object.add(memOff, memOn);
  const carried = new InstancedMesh(geo(bin, new BoxGeometry(0.17, 0.1, 0.17)), toon(bin, CYAN, { emissive: CYAN, emissiveIntensity: 0.3 }), 3);
  carried.instanceMatrix.setUsage(DynamicDrawUsage);
  carried.count = 0;
  object.add(carried);
  const slot = new Vector3(0, 1.15, 1.0);

  const hotspots: Hotspot[] = [
    { term: "stateless", label: "stateless session", anchor: anchor(object, -3, 3.1, 0.5) },
    { term: "agent-memory", label: "external memory", anchor: anchor(object, 0, 1.1, 1.3) },
  ];

  let clock = 0;
  const o = new Object3D();
  const v = new Vector3();
  const opacity = (s: Sprite, k: number) => {
    s.material.opacity = k;
    s.visible = k > 0.01;
  };

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: CityFrame) {
      clock += ctx.dt;
      const session = Math.floor(clock / SESSION);
      const t = clock % SESSION;
      const activeIndex = session % 2;
      const remember = Math.floor(session / 2) % 2 === 1;
      memOn.visible = remember;
      memOff.visible = !remember;
      const fade = t < 5 ? 1 : Math.max(0, 1 - (t - 5) / 1.2);

      sides.forEach((side, i) => {
        const active = i === activeIndex;
        const awake = active ? fade : 0;
        side.head.setEyes(awake);
        if (side.head.lid) side.head.lid.rotation.x = damp(side.head.lid.rotation.x, active && t < 5.6 ? -1.8 : 0, 4, ctx.dt);
        // Context pours in with each balloon; it all drains when the session ends.
        side.asks.forEach((b, k) => opacity(b, active && t > 0.3 + k ? fade : 0));
        const said = side.asks.filter((_, k) => t > 0.3 + k).length;
        const inherited = i === 1 && remember && t > 1.2 ? 3 : 0;
        side.chips.count = active && t < 6 ? Math.round((said * 4 + inherited) * fade) : 0;
        const replyIndex = i === 1 && remember ? 1 : 0;
        side.replies.forEach((b, k) => opacity(b, active && k === replyIndex && t > 2.6 ? fade : 0));
        if (active) side.head.talk(t > 2.6 && t < 3.4 ? Math.abs(Math.sin(t * 14)) : 0);
      });

      // With memory on, three chips leave A as it shuts down, wait in the
      // cartridge, and land in B as it starts.
      carried.count = 0;
      const leaving = activeIndex === 0 && t > 5;
      const arriving = activeIndex === 1 && t < 1.2;
      if (remember && (leaving || arriving)) {
        const from = leaving ? sides[0].bay : slot;
        const to = leaving ? slot : sides[1].bay;
        const p = leaving ? ease((t - 5) / 1.2) : ease(t / 1.2);
        carried.count = 3;
        for (let c = 0; c < 3; c++) {
          o.position.copy(v.copy(from).lerp(to, p)).add(new Vector3((c - 1) * 0.2, Math.sin(p * Math.PI) * 1.2, 0));
          o.updateMatrix();
          carried.setMatrixAt(c, o.matrix);
        }
        carried.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

export const head: CityRigFactory = (preset) => {
  const mode = str(preset, "mode", "tokens");
  if (mode === "drive") return drive();
  if (mode === "twins") return twins();
  return speaker(mode === "reasoning");
};
