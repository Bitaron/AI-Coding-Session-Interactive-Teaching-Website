import {
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { INK, INK_SOFT, ORANGE, PAPER_DEEP } from "../engine/palette";
import { Bin, anchor, geo, label, matte, textTexture, tint } from "./kit";
import { damp, hash, str, type FrameContext, type Hotspot, type RigFactory } from "./rig";

/**
 * Token generation as a loom. A spinneret weighs a fan of candidate next
 * tokens — stalk height is probability after temperature — picks one, and
 * spins it into a ribbon of everything generated so far. In "reasoning"
 * mode, each visible token is preceded by a run of dark, unlabeled thinking
 * tokens whose count grows with the effort knob: the output looks the same
 * length, the bill does not.
 */

const SCRIPT: { words: string[]; logits: number[] }[] = [
  { words: ["The", "A", "This", "Our", "Bananas"], logits: [2.4, 1.2, 0.9, 0.4, -2] },
  { words: ["agent", "model", "test", "user", "moon"], logits: [2.2, 1.6, 0.5, 0.4, -2.2] },
  { words: ["reads", "edits", "runs", "skips", "sings"], logits: [2.0, 1.5, 1.2, -0.4, -2.4] },
  { words: ["the", "every", "one", "no", "purple"], logits: [2.6, 0.8, 0.6, -0.6, -2.5] },
  { words: ["file", "test", "spec", "diff", "song"], logits: [1.9, 1.7, 1.0, 0.8, -2.1] },
];

const MAX_TILES = 46;

export const loom: RigFactory = (preset) => {
  const reasoning = str(preset, "mode", "generate") === "reasoning";
  const bin = new Bin();
  const object = new Group();

  // Spinneret: a soft, slightly lumpy seed.
  const seedGeo = geo(bin, new IcosahedronGeometry(0.9, 3));
  const basePos = seedGeo.attributes.position.array.slice() as Float32Array;
  const seed = new Mesh(seedGeo, matte(bin, PAPER_DEEP, { flat: true }));
  seed.scale.setScalar(0.75);
  seed.position.set(-4.4, 2.0, -0.6);
  object.add(seed);

  // Candidate fan.
  const stalkGeo = geo(bin, new CylinderGeometry(0.06, 0.06, 1, 8).translate(0, 0.5, 0));
  const fan = Array.from({ length: 5 }, (_, k) => {
    const mat = matte(bin, INK);
    const stalk = new Mesh(stalkGeo, mat);
    // Spread across the view (rigs face the camera along +z).
    stalk.position.set(-2.4 + k * 0.95, 0, 0.6 - Math.abs(k - 2) * 0.35);
    object.add(stalk);
    return { stalk, mat, height: 0.1, tag: null as Sprite | null };
  });

  // Ribbon path from the spinneret, curling out and up.
  const curve = new CatmullRomCurve3([
    new Vector3(-3.0, 1.7, 0),
    new Vector3(-0.5, 2.6, -1.5),
    new Vector3(2.0, 2.2, -0.4),
    new Vector3(3.4, 3.2, 1.6),
    new Vector3(2.4, 4.6, 2.8),
    new Vector3(0.2, 5.4, 1.4),
  ]);

  // Tiles are sprites so a word always reads the right way round.
  const wordMats = new Map<string, { mat: SpriteMaterial; aspect: number }>();
  const wordMat = (w: string) => {
    let entry = wordMats.get(w);
    if (!entry) {
      const { texture, aspect } = textTexture(bin, w, { background: "#f7f3ea", size: 1 });
      entry = { mat: bin.add(new SpriteMaterial({ map: texture, fog: true })), aspect };
      wordMats.set(w, entry);
    }
    return entry;
  };
  const thinkMat = bin.add(new SpriteMaterial({ color: INK_SOFT, fog: true }));
  const tiles: { mesh: Sprite; s: number; w: number }[] = [];

  // Live counter for reasoning mode.
  const counterCanvas = document.createElement("canvas");
  counterCanvas.width = 768;
  counterCanvas.height = 160;
  const counterTex = bin.add(new CanvasTexture(counterCanvas));
  const counter = new Sprite(bin.add(new SpriteMaterial({ map: counterTex, transparent: true, depthWrite: false })));
  counter.scale.set(4.2, 0.875, 1);
  counter.position.set(3.6, 5.0, -0.6);
  if (reasoning) object.add(counter);
  let visibleCount = 0;
  let thinkingCount = 0;
  const drawCounter = () => {
    const c = counterCanvas.getContext("2d")!;
    c.clearRect(0, 0, 768, 160);
    c.font = '500 46px ui-monospace, "SF Mono", Menlo, monospace';
    c.fillStyle = "#5d584d";
    c.fillText(`thinking  ${String(thinkingCount).padStart(4)}`, 10, 60);
    c.fillStyle = "#1b1a17";
    c.fillText(`visible   ${String(visibleCount).padStart(4)}`, 10, 130);
    counterTex.needsUpdate = true;
  };
  drawCounter();

  const hotspots: Hotspot[] = [
    { term: "next-token", label: "next-token distribution", anchor: anchor(object, -1.6, 2.6, 0) },
    { term: "temperature", label: "temperature", anchor: anchor(object, -1.4, 0.4, 1.6) },
  ];
  if (reasoning) hotspots.push({ term: "reasoning-tokens", label: "reasoning tokens", anchor: anchor(object, 3.6, 4.4, -0.6) });

  let step = 0;
  let timer = 0;
  let pendingThinking = 0;
  let flash = 0;
  let chosen = -1;

  function setFan(): number[] {
    const { words, logits } = SCRIPT[step % SCRIPT.length];
    fan.forEach((f, k) => {
      if (f.tag) {
        object.remove(f.tag);
        f.tag.material.map?.dispose();
        f.tag.material.dispose();
      }
      f.tag = label(new Bin(), words[k], { size: 0.32 });
      f.tag.position.copy(f.stalk.position);
      object.add(f.tag);
    });
    return logits;
  }
  let logits = setFan();

  function probabilities(temp: number): number[] {
    const t = Math.max(temp, 0.05);
    const ex = logits.map((l) => Math.exp(l / t));
    const sum = ex.reduce((a, b) => a + b, 0);
    return ex.map((e) => e / sum);
  }

  function emit(word: string | null): void {
    const entry = word ? wordMat(word) : null;
    const mesh = new Sprite(entry ? entry.mat : thinkMat);
    if (entry) mesh.scale.set(0.42 * entry.aspect, 0.42, 1);
    else mesh.scale.set(0.2, 0.2, 1);
    object.add(mesh);
    tiles.unshift({ mesh, s: 0, w: word ? 0.09 : 0.032 });
    while (tiles.length > MAX_TILES) {
      const t = tiles.pop()!;
      object.remove(t.mesh);
    }
  }

  function update(ctx: FrameContext): void {
    const { temperature, effort } = ctx.params;
    const probs = probabilities(temperature);
    timer += ctx.dt;

    // Thinking tokens tick out quickly ahead of each visible pick.
    const period = 1.5;
    if (reasoning && pendingThinking > 0 && timer > 0.09) {
      timer = 0;
      pendingThinking--;
      thinkingCount++;
      emit(null);
      drawCounter();
    } else if (timer > period) {
      timer = 0;
      // Deterministic sampling so the scene is reproducible for a presenter.
      const r = hash(step * 9.13 + Math.floor(ctx.time));
      let acc = 0;
      chosen = probs.length - 1;
      for (let k = 0; k < probs.length; k++) {
        acc += probs[k];
        if (r <= acc) { chosen = k; break; }
      }
      emit(SCRIPT[step % SCRIPT.length].words[chosen]);
      visibleCount++;
      flash = 1;
      step++;
      logits = setFan();
      if (reasoning) {
        pendingThinking = Math.round(Math.pow(effort, 1.7) * 2.2 + hash(step) * effort * 2);
        drawCounter();
      }
    }

    flash = Math.max(0, flash - ctx.dt * 1.8);
    fan.forEach((f, k) => {
      f.height = damp(f.height, 0.25 + probs[k] * 3.6, 6, ctx.dt);
      f.stalk.scale.y = f.height;
      if (f.tag) f.tag.position.y = f.height + 0.35;
      tint(f.mat, INK, ORANGE, k === chosen ? flash : 0);
    });

    // Advance the ribbon; thinking tokens travel the same path, tighter.
    const speed = reasoning ? 0.1 : 0.06;
    let s = 0;
    for (const t of tiles) {
      t.s = damp(t.s, s, 5, ctx.dt);
      s += t.w * (reasoning ? 0.55 : 1) * (speed / 0.06);
      const u = Math.min(t.s, 1);
      curve.getPoint(u, t.mesh.position);
      t.mesh.visible = u < 1;
    }

    // The seed breathes harder on each pick.
    const arr = seedGeo.attributes.position.array as Float32Array;
    const swell = 1 + flash * 0.12;
    for (let i = 0; i < arr.length; i += 3) {
      const n = Math.sin(basePos[i] * 3 + ctx.time * 1.4) * Math.cos(basePos[i + 1] * 3 + ctx.time) * 0.06;
      arr[i] = basePos[i] * (swell + n);
      arr[i + 1] = basePos[i + 1] * (swell + n);
      arr[i + 2] = basePos[i + 2] * (swell + n);
    }
    seedGeo.attributes.position.needsUpdate = true;
    if (ctx.lod === 0) seedGeo.computeVertexNormals();
  }

  return {
    object,
    hotspots,
    update,
    dispose: () => {
      fan.forEach((f) => {
        f.tag?.material.map?.dispose();
        f.tag?.material.dispose();
      });
      bin.dispose();
    },
  };
};
