import {
  CanvasTexture,
  type ColorRepresentation,
  DataTexture,
  DoubleSide,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  Sprite,
  SpriteMaterial,
  type Side,
} from "three";
import { Bin } from "../../v2/scenes/kit";
import { CYAN, GREEN, INK, ORANGE } from "../engine/palette";

export { anchor, Bin, budget, cardTexture, geo, label, textTexture, tint } from "../../v2/scenes/kit";

// --- materials -------------------------------------------------------------

let gradient: DataTexture | null = null;

/** Three hard tone steps — shadow, mid, lit — shared by every toon material. */
function toonRamp(): DataTexture {
  if (!gradient) {
    gradient = new DataTexture(new Uint8Array([165, 215, 255]), 3, 1, RedFormat);
    gradient.minFilter = NearestFilter;
    gradient.magFilter = NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export interface ToonOpts {
  emissive: ColorRepresentation;
  emissiveIntensity: number;
  transparent: boolean;
  opacity: number;
  side: Side;
  map: CanvasTexture;
}

/** Cel-shaded surface: flat colour in three tones. The ink pass draws its outline. */
export function toon(bin: Bin, color: ColorRepresentation, opts: Partial<ToonOpts> = {}): MeshToonMaterial {
  const mat = new MeshToonMaterial({
    color,
    gradientMap: toonRamp(),
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    map: opts.map ?? null,
  });
  if (opts.side !== undefined) mat.side = opts.side;
  return bin.add(mat);
}

/** Unlit colour: screens, eyes, holograms — light the machine gives off. */
export function glow(bin: Bin, color: ColorRepresentation, opacity = 1): MeshBasicMaterial {
  return bin.add(
    new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: DoubleSide })
  );
}

export const inkMat = (bin: Bin) => toon(bin, INK);
export const orangeMat = (bin: Bin) => toon(bin, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.25 });
export const greenMat = (bin: Bin) => toon(bin, GREEN, { emissive: GREEN, emissiveIntensity: 0.2 });
export const cyanGlow = (bin: Bin, opacity = 1) => glow(bin, CYAN, opacity);

// --- comic lettering -----------------------------------------------------------

const LETTERING = '"Arial Black", "Helvetica Neue", Impact, system-ui, sans-serif';
const HAND = '"Comic Neue", "Segoe Print", "Bradley Hand", ui-rounded, system-ui, sans-serif';

function spriteFrom(bin: Bin, canvas: HTMLCanvasElement, height: number): Sprite {
  const tex = bin.add(new CanvasTexture(canvas));
  tex.anisotropy = 4;
  const mat = bin.add(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
  const sprite = new Sprite(mat);
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}

/**
 * A sound effect drawn into the scene — CLANK, WHIRR, BZZT — the comic way
 * to say "this just happened". Use one per event, never as decoration.
 */
export function sfx(bin: Bin, text: string, opts: { color?: string; size?: number; tilt?: number } = {}): Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const px = 110;
  const font = `italic 900 ${px}px ${LETTERING}`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 60;
  canvas.width = w;
  canvas.height = px + 60;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.translate(30, canvas.height / 2);
  ctx.rotate(opts.tilt ?? -0.06);
  ctx.lineWidth = 16;
  ctx.strokeStyle = "#1b1a17";
  ctx.strokeText(text, 0, 4);
  ctx.fillStyle = opts.color ?? "#f2e2a0";
  ctx.fillText(text, 0, 4);
  return spriteFrom(bin, canvas, opts.size ?? 0.9);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export type BalloonKind = "speech" | "robot" | "thought" | "caption" | "shout";

/**
 * Comic balloons. `speech` (round, a human talking), `robot` (square
 * corners, a machine talking), `thought` (a cloud — reasoning nobody sees),
 * `caption` (a narration box) and `shout` (a spiky interruption — the human
 * catch). The tail points down-left unless `tail` is "right" or "none".
 */
export function balloon(
  bin: Bin,
  text: string,
  kind: BalloonKind = "speech",
  opts: { width?: number; height?: number; tail?: "left" | "right" | "none"; fill?: string; color?: string } = {}
): Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const px = 46;
  const robot = kind === "robot";
  const font = robot ? `600 ${px - 4}px ui-monospace, "SF Mono", Menlo, monospace` : kind === "caption" ? `700 ${px - 6}px ${LETTERING}` : `700 ${px}px ${HAND}`;
  ctx.font = font;
  const maxW = opts.width ?? 560;
  const lines = wrap(ctx, kind === "caption" ? text.toUpperCase() : text, maxW);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const lh = px * 1.18;
  const padX = kind === "thought" ? 70 : 44;
  const padY = kind === "thought" ? 50 : 32;
  const tailH = opts.tail === "none" || kind === "caption" ? 0 : 54;
  const bw = textW + padX * 2;
  const bh = lines.length * lh + padY * 2;
  canvas.width = Math.ceil(bw + 24);
  canvas.height = Math.ceil(bh + tailH + 24);
  ctx.translate(12, 12);
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1b1a17";
  ctx.fillStyle = opts.fill ?? (kind === "caption" ? "#f2e2a0" : "#fbf8f1");

  const tailX = opts.tail === "right" ? bw * 0.72 : bw * 0.26;
  ctx.beginPath();
  if (kind === "thought") {
    // A cloud of overlapping lobes, then two trailing puffs.
    const lobes = 9;
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2;
      ctx.moveTo(bw / 2 + Math.cos(a) * bw * 0.4 + bh * 0.3, bh / 2 + Math.sin(a) * bh * 0.36);
      ctx.ellipse(bw / 2 + Math.cos(a) * bw * 0.4, bh / 2 + Math.sin(a) * bh * 0.36, bh * 0.3, bh * 0.3, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bw / 2, bh / 2, bw * 0.44, bh * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (tailH) {
      ctx.beginPath();
      ctx.arc(tailX, bh + 10, 13, 0, Math.PI * 2);
      ctx.moveTo(tailX - 22 + 8, bh + 40);
      ctx.arc(tailX - 22, bh + 40, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (kind === "shout") {
    const spikes = 18;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const k = i % 2 === 0 ? 1 : 0.84;
      const x = bw / 2 + Math.cos(a) * (bw / 2) * k;
      const y = bh / 2 + Math.sin(a) * (bh / 2) * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const r = robot || kind === "caption" ? 4 : Math.min(bh / 2, 60);
    ctx.roundRect(0, 0, bw, bh, r);
    ctx.fill();
    ctx.stroke();
    if (tailH) {
      ctx.beginPath();
      ctx.moveTo(tailX - 20, bh - 4);
      ctx.lineTo(tailX + (opts.tail === "right" ? 34 : -34), bh + tailH);
      ctx.lineTo(tailX + 20, bh - 4);
      ctx.fill();
      ctx.stroke();
      // Hide the balloon's own outline where the tail joins it.
      ctx.fillRect(tailX - 16, bh - 8, 32, 8);
    }
  }

  ctx.fillStyle = opts.color ?? "#1b1a17";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, bw / 2, padY + lh * (i + 0.5)));
  return spriteFrom(bin, canvas, opts.height ?? 0.35 * (canvas.height / 100));
}
