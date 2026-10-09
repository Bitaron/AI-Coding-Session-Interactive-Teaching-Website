import {
  CanvasTexture,
  Color,
  type ColorRepresentation,
  Material,
  MeshStandardMaterial,
  Object3D,
  Sprite,
  SpriteMaterial,
  type BufferGeometry,
  type Texture,
} from "three";
import { GREEN, INK, ORANGE, PAPER } from "../engine/palette";

/** Tracks every GPU resource a rig creates so dispose() can't miss one. */
export class Bin {
  private items: { dispose(): void }[] = [];
  add<T extends { dispose(): void }>(item: T): T {
    this.items.push(item);
    return item;
  }
  dispose(): void {
    this.items.forEach((i) => i.dispose());
    this.items = [];
  }
}

export function matte(bin: Bin, color: ColorRepresentation, opts: Partial<{ emissive: ColorRepresentation; transparent: boolean; opacity: number; flat: boolean }> = {}): MeshStandardMaterial {
  return bin.add(
    new MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      flatShading: opts.flat ?? false,
      emissive: opts.emissive ?? 0x000000,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    })
  );
}

export const ink = (bin: Bin) => matte(bin, INK);
export const paper = (bin: Bin) => matte(bin, PAPER);
export const orange = (bin: Bin) => matte(bin, ORANGE, { emissive: ORANGE.clone().multiplyScalar(0.25) });
export const green = (bin: Bin) => matte(bin, GREEN, { emissive: GREEN.clone().multiplyScalar(0.2) });

/** Mixes a material's color between two palette colors, in place. */
export function tint(mat: Material & { color: Color }, a: Color, b: Color, t: number): void {
  mat.color.copy(a).lerp(b, Math.max(0, Math.min(1, t)));
}

export interface LabelOpts {
  size?: number;
  color?: string;
  background?: string;
  weight?: string;
  mono?: boolean;
}

function textCanvas(text: string, opts: LabelOpts): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const px = 64;
  const font = `${opts.weight ?? "500"} ${px}px ${opts.mono === false ? 'Georgia, "Iowan Old Style", serif' : 'ui-monospace, "SF Mono", Menlo, monospace'}`;
  ctx.font = font;
  const pad = opts.background ? 22 : 8;
  canvas.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
  canvas.height = px + pad * 1.4;
  ctx.font = font;
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = opts.color ?? "#1b1a17";
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad, canvas.height / 2 + 2);
  return canvas;
}

/** A camera-facing ink label. `size` is the world-space height. */
export function label(bin: Bin, text: string, opts: LabelOpts = {}): Sprite {
  const canvas = textCanvas(text, opts);
  const tex = bin.add(new CanvasTexture(canvas));
  tex.anisotropy = 4;
  const mat = bin.add(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
  const sprite = new Sprite(mat);
  const h = opts.size ?? 0.5;
  sprite.scale.set((h * canvas.width) / canvas.height, h, 1);
  return sprite;
}

/** A texture of text for flat surfaces (tiles, sheets). */
export function textTexture(bin: Bin, text: string, opts: LabelOpts = {}): { texture: Texture; aspect: number } {
  const canvas = textCanvas(text, opts);
  const texture = bin.add(new CanvasTexture(canvas));
  texture.anisotropy = 4;
  return { texture, aspect: canvas.width / canvas.height };
}

/** A square paper card with wrapped text, for faces that unfold. */
export function cardTexture(bin: Bin, text: string): Texture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#1b1a17";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, size - 6, size - 6);
  ctx.fillStyle = "#1b1a17";
  ctx.font = '500 52px ui-monospace, "SF Mono", Menlo, monospace';
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > size - 80 && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  const lh = 64;
  let y = size / 2 - ((lines.length - 1) * lh) / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const l of lines) {
    ctx.fillText(l, size / 2, y);
    y += lh;
  }
  const tex = bin.add(new CanvasTexture(canvas));
  tex.anisotropy = 4;
  return tex;
}

/** An invisible object to pin a DOM hotspot to. */
export function anchor(parent: Object3D, x: number, y: number, z: number): Object3D {
  const o = new Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

export function geo<T extends BufferGeometry>(bin: Bin, g: T): T {
  return bin.add(g);
}

/** Particle budget for a level of detail. */
export function budget(lod: number, full: number): number {
  return lod === 0 ? full : lod === 1 ? Math.ceil(full * 0.5) : Math.ceil(full * 0.2);
}
