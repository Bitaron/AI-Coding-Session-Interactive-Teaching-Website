import type { Object3D } from "three";
import type { SceneCue } from "../../v2/content/types";
import type { FrameContext, Hotspot } from "../../v2/scenes/rig";

export { bool, damp, hash, noise1, num, str } from "../../v2/scenes/rig";
export type { Hotspot, Lod } from "../../v2/scenes/rig";

/** v2's frame context plus what the city's shared building sites need. */
export interface CityFrame extends FrameContext {
  /**
   * For a site rig: the stage the focused station asks for, or null while
   * the camera is somewhere else (the site then holds its last stage).
   * Always null for ordinary station rigs.
   */
  stage: number | null;
  /** Screenshot of the current step the reader is pointing at, or -1. */
  evidence: number;
}

/**
 * One self-contained 3D scene, as in v2: placed and fed by the engine,
 * never touching the DOM. `hotspots` may change over time (a site shows the
 * current stage's terms), so the engine re-reads it every projection.
 */
export interface CityRig {
  readonly object: Object3D;
  readonly hotspots?: Hotspot[];
  update(ctx: CityFrame): void;
  dispose(): void;
}

export type CityRigFactory = (preset: NonNullable<SceneCue["preset"]>) => CityRig;

/** Camera framing in a site's local space: [x, y, z] tuples. */
export interface Vantage {
  eye: [number, number, number];
  target: [number, number, number];
}

/**
 * A building site several stations look at from different vantages — the
 * old house, the warehouse, the billboard. One instance lives in the world;
 * each station's cue names the site and the stage it shows.
 */
export interface SiteDef {
  id: string;
  /** One vantage per stage, indexed by the cue's `stage`. */
  vantages: Vantage[];
  /** Keep the city's filler buildings out of this radius. */
  clear: number;
  build: () => CityRig;
}
