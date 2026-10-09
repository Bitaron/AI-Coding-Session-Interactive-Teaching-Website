/**
 * Which edition of the spatial guide is running. v2 (the field guide) and
 * v3 (the city) share the reading panel, dial, router and content; each
 * entry point sets this before booting.
 */
export interface Edition {
  /** URL segment and storage prefix, e.g. "v2". */
  slug: string;
  brand: string;
  kicker: string;
  /** HTML; may contain <br/>. */
  title: string;
  /** May contain [[term]] markup. */
  lede: string;
}

export const edition: Edition = {
  slug: "v2",
  brand: "Agentic Coding <em>field guide</em>",
  kicker: "A field guide · v2",
  title: "Agentic coding,<br/>walked through.",
  lede: "One continuous map. Each station is one idea, with a living model of it you can poke. Terms like [[context-rot|context rot]] or [[tool-schema|tool schema]] open a deep dive. Two real builds — a Spring Boot library and this guide itself — are replayed from their screenshots.",
};

export function setEdition(next: Edition): void {
  Object.assign(edition, next);
}
