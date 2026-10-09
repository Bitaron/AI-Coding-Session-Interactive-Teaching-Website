import type { Section } from "./types";

// Playgrounds: the same rigs as the Intro, with every knob exposed. Nothing
// here is a new claim — each station points back to the step it extends.

export const sandbox: Section = {
  id: "sandbox",
  label: "Sandbox",
  blurb: "Every knob exposed. Tweak the agent, watch the world react.",
  steps: [
    {
      slug: "agent",
      title: "Agent playground",
      lede: "Loop steps, effort and temperature at once. Watch how fast the token ring grows compared with the work actually done — [[token-multiplication|token multiplication]], live.",
      points: ["Try: loop steps 12, effort max. Then loop steps 1, effort none."],
      scene: { rig: "organism", preset: { mode: "agent" } },
      sceneCaption: "Drag the creature with your cursor; tweak the knobs mid-loop.",
      knobs: ["loopSteps", "effort", "temperature"],
    },
    {
      slug: "context",
      title: "Context playground",
      lede: "Pour tokens into the [[context-window|window]] and watch where attention thins and where the usable ring ends.",
      points: ["Try: fill past the green ring, then drain back below it."],
      scene: { rig: "pool", preset: { mode: "context" } },
      sceneCaption: "Each drop is a token; orange chips sit past usable context.",
      knobs: ["contextFill"],
    },
    {
      slug: "sampling",
      title: "Sampling playground",
      lede: "The loom with both knobs: [[temperature|temperature]] changes which word wins; effort changes how much hidden thinking precedes it.",
      points: ["Try: temperature 0 — the sentence is the same every run. Then 1.5."],
      scene: { rig: "loom", preset: { mode: "reasoning" } },
      sceneCaption: "Light tiles are visible output; dark tiles are thinking.",
      knobs: ["temperature", "effort"],
    },
  ],
};
