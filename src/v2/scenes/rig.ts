import type { Object3D, Vector3 } from "three";
import type { Params } from "../core/state";
import type { SceneCue } from "../content/types";

/** Detail tiers: 0 = focused & full, 1 = neighbour, 2 = distant silhouette. */
export type Lod = 0 | 1 | 2;

export interface FrameContext {
  time: number;
  dt: number;
  params: Params;
  /** The pointer projected onto the station's ground plane, in rig-local space. */
  pointer: Vector3 | null;
  /** True for the station the camera is parked at. */
  focused: boolean;
  /** 0–1, decays after each replay beat; rigs may flare on it. */
  beat: number;
  beatKind: string;
  lod: Lod;
}

export interface Hotspot {
  /** Glossary id this hotspot opens. */
  term: string;
  label: string;
  anchor: Object3D;
}

/**
 * A rig is one self-contained 3D metaphor living at a station. The engine
 * places it, decides its level of detail and feeds it a FrameContext; a rig
 * never touches the DOM or the router.
 */
export interface Rig {
  readonly object: Object3D;
  readonly hotspots?: Hotspot[];
  update(ctx: FrameContext): void;
  dispose(): void;
}

export type RigFactory = (preset: NonNullable<SceneCue["preset"]>) => Rig;

export function num(preset: SceneCue["preset"], key: string, fallback: number): number {
  const v = preset?.[key];
  return typeof v === "number" ? v : fallback;
}

export function str(preset: SceneCue["preset"], key: string, fallback: string): string {
  const v = preset?.[key];
  return typeof v === "string" ? v : fallback;
}

export function bool(preset: SceneCue["preset"], key: string, fallback = false): boolean {
  const v = preset?.[key];
  return typeof v === "boolean" ? v : fallback;
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Cheap deterministic hash noise, enough for organic wobble without a noise library. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}
