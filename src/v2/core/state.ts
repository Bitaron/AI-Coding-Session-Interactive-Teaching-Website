import { Emitter, Store } from "./store";

/** Where the visitor is. A `null` route is the map overview. */
export interface Route {
  sectionId: string;
  stepIndex: number;
}

/**
 * The sandbox knobs. Every scene reads these every frame, so moving a slider
 * changes the 3D world immediately — the "tweak an agent, watch it react" loop.
 */
export interface Params {
  /** Sampling temperature, 0–1.5. Sharpens or flattens choices; adds jitter. */
  temperature: number;
  /** Context fill, 0–1, as a fraction of the window. */
  contextFill: number;
  /** Agent loop steps per task, 1–12. */
  loopSteps: number;
  /** Reasoning effort, 0 (none) – 5 (max), the six-name ladder incl. xhigh. */
  effort: number;
}

export const DEFAULT_PARAMS: Params = {
  temperature: 0.7,
  contextFill: 0.35,
  loopSteps: 4,
  effort: 2,
};

export type Quality = "auto" | "high" | "low";

export interface AppState {
  route: Route | null;
  params: Params;
  quality: Quality;
  sound: boolean;
  /** True while the camera is travelling between stations. */
  travelling: boolean;
  reducedMotion: boolean;
  webgl: boolean;
  /** Screen space covered by the reading panel, so the 3D focus centres in what's left. */
  inset: { left: number; bottom: number };
}

export const store = new Store<AppState>({
  route: null,
  params: { ...DEFAULT_PARAMS },
  quality: (localStorage.getItem("v2.quality") as Quality) || "auto",
  sound: localStorage.getItem("v2.sound") === "1",
  travelling: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  webgl: true,
  inset: { left: 0, bottom: 0 },
});

export interface Events extends Record<string, unknown> {
  /** A scripted replay line appeared — scenes may pulse in response. */
  beat: { kind: "user" | "agent" | "tool" | "result" | "catch" | "handoff" };
  /** Navigation snapped to a new tick (for sound/haptics). */
  tick: { strength: number };
  /** Camera arrived at a station. */
  arrived: Route | null;
  /** Screen positions of the focused scene's term hotspots. */
  hotspots: HotspotScreen[];
  /** The reader is pointing at screenshot `index` of the current step (-1: none). */
  evidence: { index: number };
}

export interface HotspotScreen {
  term: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
}

export const events = new Emitter<Events>();

export function setParam<K extends keyof Params>(key: K, value: Params[K]): void {
  store.set({ params: { ...store.get().params, [key]: value } });
}
