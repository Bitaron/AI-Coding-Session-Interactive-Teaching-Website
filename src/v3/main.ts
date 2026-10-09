import "../v2/style.css";
import "./style.css";
import { boot } from "../v2/app";
import { setEdition } from "../v2/core/edition";
import { applyCityCues } from "./content/cues";

// v3 shares v2's shell (panel, dial, router, replays, deep dives) and its
// content; it swaps in city scenes and its own engine.

setEdition({
  slug: "v3",
  brand: "Agentic Coding <em>the city</em>",
  kicker: "The city · v3",
  title: "Agentic coding,<br/>built like a city.",
  lede: "West of the river, software is built the old way — by hand, crew to crew. East of it, robots do the building. A guide robot flies you between stations; every idea is a scene you can poke, and terms like [[context-rot|context rot]] or [[tool-schema|tool schema]] open a deep dive. Two real builds rise piece by piece from their screenshots: a warehouse for the backend, a billboard for this site.",
});
applyCityCues();

boot({ rootClass: "v3", finder: true, loadEngine: async () => (await import("./engine/engine")).Engine });
