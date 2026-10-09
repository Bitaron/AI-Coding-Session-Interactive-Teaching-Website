import { sections } from "../../v2/content/sections";
import type { SceneCue } from "../../v2/content/types";
import type { Params } from "../../v2/core/state";

/**
 * v3 tells the same story as v2 — same text, terms, replays and screenshots
 * — in a different world. Each step gets a city scene in place of its v2
 * metaphor, a caption for that scene, and (optionally) different knobs.
 * Applied once at startup, before anything renders.
 *
 * `keep` copies named v2 preset keys across (tool lists, dial specs) so the
 * facts those carry are stated once, in the v2 content.
 */
interface CityCue {
  rig: string;
  preset?: SceneCue["preset"];
  keep?: string[];
  caption: string;
  /** Replaces the v2 knobs; `[]` removes them. Omit to keep v2's. */
  knobs?: (keyof Params)[];
}

const site = (id: string, stage: number, caption: string): CityCue => ({ rig: "site", preset: { site: id, stage }, caption, knobs: [] });

const CUES: Record<string, Record<string, CityCue>> = {
  intro: {
    traditional: site(
      "house",
      0,
      "The old town, the old way. An architect plans, a foreman splits the job between crews, the crews build. Every brick changes hands on the way — the dropped ones (orange) are context lost at a hand-off."
    ),
    "token-generation": {
      rig: "head",
      preset: { mode: "tokens" },
      caption: "Across the river, a robot reads the sentence so far. Candidate words rise beside its head — bar height is probability — and the chosen one is spoken onto the ticker. Raise temperature and the long shots start winning.",
    },
    stateless: {
      rig: "head",
      preset: { mode: "twins" },
      caption: "Two heads, two sessions. Each answers from what is poured into it, then powers down and forgets. Every other round a memory drive carries a few notes across — the application's doing, not the model's.",
    },
    "model-categories": {
      rig: "robot",
      preset: { mode: "trio" },
      caption: "Three builds: a small quick bot, a balanced one, a big deliberate one. Thought bubbles are effort — how many each one thinks before it acts.",
    },
    providers: {
      rig: "gauges",
      keep: ["dials"],
      caption: "Every company builds its own robot — the two Groks are siblings. One effort lever is asked of all of them, but each dial can only rest on a notch its model has: when it snaps to the nearest one, needle and lamp turn orange and the robot shakes its head.",
    },
    "token-economics": {
      rig: "head",
      preset: { mode: "reasoning" },
      caption: "Lid open: the dark tiles churning inside the head are thinking tokens; the light tiles on the ticker are the answer. Raise effort — the answer stays the same length, the thinking doesn't.",
    },
    "model-selection": {
      rig: "crane",
      caption: "A tower crane: the task hangs from the jib, your model is the counterweight — with its cost and latency. The task changes every few seconds; rebalance with the effort lever.",
    },
    prompt: {
      rig: "drones",
      caption: "Two delivery drones, two orders. The vague one wanders and drops its parcel wide; the specific one lands on the pad.",
    },
    "context-window": {
      rig: "head",
      preset: { mode: "drive" },
      caption: "Lid open on a hard drive: that is its context. Each token is written as a block on the platter. Fill it with the slider — the middle fades, and past the green track the blocks turn orange.",
    },
    agents: {
      rig: "robot",
      preset: { mode: "agent" },
      keep: ["tools"],
      caption: "An agent is a head with hands and legs: think (bubbles), walk to a tool, use it, read the result back. The chest meter is tokens — it fills every lap. It turns to watch your cursor.",
    },
    "sub-agents": {
      rig: "robot",
      preset: { mode: "subagents" },
      caption: "Three helper bots run off to their own benches and churn through tools. Each brings back one chip — the main robot's meter barely moves while theirs fill.",
    },
    skills: {
      rig: "cartridges",
      preset: { mode: "skills" },
      keep: ["items", "spots"],
      caption: "Skill cartridges sit in a rack showing only their label. Point at one to plug it into the head — its instructions unfold only then. grill-with-docs lifts two more out of the rack.",
    },
    hooks: {
      rig: "gate",
      preset: { mode: "hooks" },
      keep: ["gates", "calls", "blocks", "spots"],
      caption: "Each tool call drives through PreToolUse, the tool, then PostToolUse. The dangerous one meets the barrier — every time, by the same rule.",
    },
    "agentic-loop": {
      rig: "robot",
      preset: { mode: "agent" },
      keep: ["tools"],
      caption: "Set the loop steps and watch the robot lap its tools before the answer (green) pops up.",
    },
    graph: {
      rig: "transit",
      caption: "A metro line: write code → run tests → tests pass? The train fails twice — out to fix, back through run tests on the dashed track — before the junction sends it on to done.",
    },
    memory: {
      rig: "archive",
      preset: { mode: "memory" },
      caption: "Point at a store to recall from it. The heap hands back a different sheet each time; the indexed stores hand back the right drawer.",
    },
    plugins: {
      rig: "cartridges",
      preset: { mode: "plugins" },
      keep: ["items", "spots"],
      caption: "A plugin is a shipping crate: it opens, and the skills it carries rise out ready to plug in.",
    },
    mcp: {
      rig: "gate",
      preset: { mode: "dock" },
      keep: ["socket", "keys", "spots"],
      caption: "Different machines, one shared plug. Each MCP server docks into the same socket in turn.",
    },
    specification: {
      rig: "blueprint",
      keep: ["panels", "done", "spot"],
      caption: "The blueprint unrolls one panel at a time; only a fully drawn spec gets the stamp.",
    },
    adr: {
      rig: "archive",
      preset: { mode: "adr" },
      keep: ["layers", "question", "answer", "spots"],
      caption: "A returning question flies in; the drawer holding the decision that already answers it slides out.",
    },
    tdd: {
      rig: "printer",
      keep: ["gates", "calls", "spots"],
      caption: "The test is a slot in the fixture, outlined red. The printer arm prints a part and tries it — wrong shape, then an arm too long — until the third drops in and the fixture turns green; a refactored print still fits.",
    },
    guardrails: {
      rig: "conveyor",
      preset: { mode: "fence" },
      caption: "Sloppy crates (orange) roll past the painted line; the hard barrier sends every one back. Raise temperature to make the work sloppier.",
    },
    "code-review": {
      rig: "conveyor",
      preset: { mode: "sieve" },
      caption: "The review scanner catches flagged crates and sends them back; they return fixed (green).",
    },
  },

  backend: {
    brief: site("warehouse", 0, "A warehouse for a file manager, in the east docks. Kickoff: the survey drone stakes out the plot; “too big for one session” splits it into lots — one per decision. Each screenshot builds one piece; point at a screenshot to see which."),
    grilling: site("warehouse", 1, "Eight screenshots, eight foundation slabs. A slab with an orange edge is a decision the human overrode."),
    tracker: site("warehouse", 2, "The site board goes up: issue #1 and its decision tickets #11–#19 as lights. Four screenshots: legs, panel, header, lights."),
    baseline: site("warehouse", 3, "Ticket #11: the first corner column. A helper drone researched in the background while the crew asked the human."),
    handoff: site("warehouse", 4, "Computer 2's cabin writes the missing state down — tracker doc, AGENTS.md pointer — packs it, and the crate flies to Computer 1, which lights up the frontier."),
    modules: site("warehouse", 5, "Module structure as the frame: five portal frames, the beams, the rafters — then a green flag: ticket closed."),
    "context-hygiene": site("warehouse", 6, "Context hygiene: each screenshot hauls a pile of clutter off site and lays clean floor in its place."),
    "storage-contract": site("warehouse", 7, "Two storage backends, one loading dock. Each screenshot fits a piece of the contract; whichever module the property selects docks."),
    decisions: site("warehouse", 8, "Every decision in its own session: each screenshot adds a mezzanine floor."),
    "spec-to-code": site("warehouse", 9, "Map → spec → tickets → scaffold: wall panels and roof go on, one per screenshot."),
    refusal: site("warehouse", 10, "A guardrail that holds: the security gate goes in, and the same request in different words meets the same barrier."),
    built: site("warehouse", 11, "What got built: the façade sign and eleven module bays lit — the realised module tree."),
  },

  frontend: {
    kickoff: site("billboard", 0, "This site is the example — so it gets a billboard on the plaza. The kickoff screenshot raises the mast. Each screenshot builds one piece; point at a screenshot to see which."),
    grill: site("billboard", 1, "Grilled with recommendations: frame and catwalk, one per screenshot."),
    "round-one": site("billboard", 2, "Round 1: the screen goes up and tries on outfits — the real prototype screenshots, one after another — and an inspection drone docks for the Playwright run."),
    traceable: site("billboard", 3, "Research made traceable: a citation plate bolted under the screen for each screenshot."),
    "round-two": site("billboard", 4, "Round 2, narrower and sharper: new variants flash on the screen while lights and speakers fill in the frame."),
    "browser-testing": site("billboard", 5, "The inspection drone sweeps along the top of the screen the way Playwright drove the browser; the specificity bug lights orange."),
    decision: site("billboard", 6, "The decision — B plus D's sidebar — and the billboard lights up with v1 of this guide, the site that direction became."),
  },

  "existing-project": {
    ask: site("house", 1, "Back across the river: the old house from the start. A robot with a toolbox runs for the door; the owner stops it: “Hold on — don’t start yet.” Who may export what?"),
    context: site("house", 2, "The robot scans the house; the X-ray shows the tangle it read. Orange flags are what the owner pointed out — the scan walked straight past them."),
    "agent-md": site("house", 3, "A manual plate by the door: the robot's two lines, then the owner's two."),
    plan: site("house", 4, "The renovation plan unfolds over the house as a hologram; the last panel is the one the owner had to add."),
    review: site("house", 5, "The renovation: old parts swap for new ones, the review scanner follows each one. The door — the export route without a session check — comes back once, then returns green. The old house is a new one."),
  },

  sandbox: {
    agent: {
      rig: "robot",
      preset: { mode: "agent" },
      caption: "Your robot. It turns to watch your cursor; change the knobs mid-loop.",
    },
    context: {
      rig: "head",
      preset: { mode: "drive" },
      caption: "Each block on the platter is a token; orange blocks sit past usable context.",
    },
    sampling: {
      rig: "head",
      preset: { mode: "reasoning" },
      caption: "Both knobs: temperature changes which word wins; effort changes how much thinking churns before it.",
    },
  },
};

export function applyCityCues(): void {
  for (const section of sections) {
    for (const step of section.steps) {
      const cue = CUES[section.id]?.[step.slug];
      if (!cue) throw new Error(`v3: no city scene for ${section.id}/${step.slug}`);
      const kept: Record<string, number | string | boolean> = {};
      for (const key of cue.keep ?? []) {
        const v = step.scene.preset?.[key];
        if (v !== undefined) kept[key] = v;
      }
      step.scene = { rig: cue.rig, preset: { ...kept, ...cue.preset } };
      step.sceneCaption = cue.caption;
      if (cue.knobs) step.knobs = cue.knobs.length ? cue.knobs : undefined;
    }
  }
}
