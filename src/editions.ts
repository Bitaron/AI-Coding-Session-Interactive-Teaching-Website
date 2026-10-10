/**
 * The three editions of the guide — same material, three ways in — so each
 * one can link to the other two.
 */
export interface EditionLink {
  slug: "v1" | "v2" | "v3";
  /** Short name shown next to the slug. */
  name: string;
  /** Tooltip: what you get in that edition. */
  title: string;
  href: string;
}

const BASE = import.meta.env.BASE_URL;

export const EDITIONS: EditionLink[] = [
  { slug: "v1", name: "pages", title: "The original guide, step by step as plain pages", href: BASE },
  { slug: "v2", name: "field guide", title: "The field guide: one continuous map with a model at each station", href: `${BASE}v2/` },
  { slug: "v3", name: "the city", title: "The city: robots build each idea as a scene", href: `${BASE}v3/` },
];
