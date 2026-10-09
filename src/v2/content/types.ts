import type { Params } from "../core/state";

/** Every 3D metaphor the world knows how to build. See src/v2/scenes/. */
export type RigId =
  | "colony"
  | "loom"
  | "pool"
  | "organism"
  | "tumbler"
  | "origami"
  | "strata"
  | "mycelium"
  | "mobile";

/** Which rig a station shows, plus rig-specific knobs. */
export interface SceneCue {
  rig: RigId;
  preset?: Record<string, number | string | boolean>;
}

/** A line in a scripted terminal replay of the real build. */
export interface ReplayLine {
  who: "user" | "agent" | "tool" | "result" | "catch" | "handoff" | "note";
  text: string;
}

/** A real screenshot backing a replay, shown as evidence. */
export interface Evidence {
  src: string;
  label: string;
  alt: string;
}

export interface Step {
  /** URL slug for this step, unique within its section. */
  slug: string;
  title: string;
  /**
   * One-sentence lede. Terms in `[[id]]` or `[[id|label]]` form become
   * deep-dive links (see glossary.ts).
   */
  lede: string;
  /** Terse supporting points; same term markup. */
  points?: string[];
  /** Optional small table — header row first. */
  table?: string[][];
  scene: SceneCue;
  /** Sandbox knobs surfaced on this step; the scene responds live. */
  knobs?: (keyof Params)[];
  /** A one-line caption that tells the reader what the scene is showing. */
  sceneCaption: string;
  replay?: { title: string; lines: ReplayLine[] };
  evidence?: Evidence[];
}

export interface Section {
  id: string;
  label: string;
  /** Short line under the section name on the map. */
  blurb: string;
  steps: Step[];
}

export interface GlossaryEntry {
  id: string;
  term: string;
  /** One or two sentences. Plain text. */
  definition: string;
  /** Why the term matters in an agentic coding workflow. */
  why?: string;
  links: { label: string; url: string }[];
}
