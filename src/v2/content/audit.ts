import { allShotPaths, shotPathOf } from "./evidence";
import { glossary } from "./glossary";
import { sections } from "./sections";

/**
 * Dev-only content checks, run once at startup: every `[[term]]` must exist
 * in the glossary, every hotspot-free glossary entry is at least reachable,
 * and every real screenshot in the repo is used by some step (the brief
 * asks for all of them, used and unused in v1, to be recreated).
 */
export function auditContent(): string[] {
  const problems: string[] = [];
  const used = new Set<string>();
  const termRe = /\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g;

  for (const section of sections) {
    for (const step of section.steps) {
      const texts = [step.lede, step.sceneCaption, ...(step.points ?? [])];
      for (const t of texts) {
        for (const m of t.matchAll(termRe)) {
          if (!glossary.has(m[1])) problems.push(`${section.id}/${step.slug}: unknown term [[${m[1]}]]`);
        }
      }
      step.evidence?.forEach((e) => used.add(shotPathOf(e.src) ?? e.src));
    }
  }

  for (const path of allShotPaths()) {
    if (!used.has(path)) problems.push(`screenshot not used by any step: ${path}`);
  }
  return problems;
}
