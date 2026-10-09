import { findSection, sections } from "../content/sections";
import { edition } from "../core/edition";
import { store, type Route } from "../core/state";

// /agentic-coding-guide/v2/                      → the map
// /agentic-coding-guide/v2/<section>/<step-slug> → a station
// Step numbers (/v2/intro/3) are accepted too and rewritten to the slug.
// v3 uses the same scheme under /v3/.
const base = () => `${import.meta.env.BASE_URL}${edition.slug}/`;

export function parse(pathname: string): Route | null {
  const BASE = base();
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : "";
  const [sectionId, stepPart] = rest.split("/").filter(Boolean);
  const section = sectionId ? findSection(sectionId) : undefined;
  if (!section) return null;
  if (!stepPart) return { sectionId: section.id, stepIndex: 0 };
  const bySlug = section.steps.findIndex((s) => s.slug === stepPart);
  if (bySlug >= 0) return { sectionId: section.id, stepIndex: bySlug };
  const n = Number.parseInt(stepPart, 10);
  const stepIndex = Number.isFinite(n) ? Math.min(Math.max(n - 1, 0), section.steps.length - 1) : 0;
  return { sectionId: section.id, stepIndex };
}

export function path(route: Route | null): string {
  if (!route) return base();
  const section = findSection(route.sectionId)!;
  return `${base()}${section.id}/${section.steps[route.stepIndex].slug}`;
}

export function go(route: Route | null, replace = false): void {
  const target = path(route);
  if (target !== location.pathname) {
    history[replace ? "replaceState" : "pushState"](null, "", target);
  }
  store.set({ route });
}

/** Linear order across the whole guide, so "next" can cross section borders. */
export function step(route: Route | null, delta: number): Route | null {
  const flat = sections.flatMap((s) => s.steps.map((_, i) => ({ sectionId: s.id, stepIndex: i })));
  if (!route) return delta > 0 ? flat[0] : null;
  const i = flat.findIndex((r) => r.sectionId === route.sectionId && r.stepIndex === route.stepIndex);
  const j = i + delta;
  if (j < 0) return null;
  return flat[Math.min(j, flat.length - 1)];
}

export function startRouter(): void {
  window.addEventListener("popstate", () => store.set({ route: parse(location.pathname) }));
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-route]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(parse(new URL(a.href).pathname));
  });
  const initial = parse(location.pathname);
  // Canonicalise numeric or partial URLs to the slug form.
  go(initial, true);
}
