import type { Evidence } from "./types";

// Every real screenshot, keyed by its path under the repo root. Vite turns
// each into a hashed asset URL; images only load when a reader opens them.
const files = import.meta.glob(["../../../backendExample/**/*.png", "../../../frontendExample/*.png"], {
  eager: true,
  import: "default",
}) as Record<string, string>;

const byPath = new Map(Object.entries(files).map(([k, url]) => [k.replace("../../../", ""), url]));

/** `dir` is e.g. "backendExample/secondComputer"; `stamp` is "2026-09-10 17-57-29". */
export function shot(dir: string, stamp: string, label: string, alt: string): Evidence {
  const path = `${dir}/Screenshot From ${stamp}.png`;
  const src = byPath.get(path);
  if (!src) throw new Error(`Missing screenshot: ${path}`);
  return { src, label, alt };
}

export const C1 = "backendExample/firstComputer";
export const C2 = "backendExample/secondComputer";
export const FE = "frontendExample";

/** For a completeness check: every screenshot path on disk. */
export function allShotPaths(): string[] {
  return [...byPath.keys()];
}

const byUrl = new Map([...byPath].map(([path, url]) => [url, path]));

export function shotPathOf(url: string): string | undefined {
  return byUrl.get(url);
}
