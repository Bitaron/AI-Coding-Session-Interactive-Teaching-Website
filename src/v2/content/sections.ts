import { backend } from "./backend";
import { existing } from "./existing";
import { frontend } from "./frontend";
import { intro } from "./intro";
import { sandbox } from "./sandbox";
import type { Section } from "./types";

export const sections: Section[] = [intro, backend, frontend, existing, sandbox];

export function findSection(id: string): Section | undefined {
  return sections.find((s) => s.id === id);
}

/** Total steps before this section, for global station numbering. */
export function globalIndex(sectionId: string, stepIndex: number): number {
  let n = 0;
  for (const s of sections) {
    if (s.id === sectionId) return n + stepIndex;
    n += s.steps.length;
  }
  return -1;
}

export const totalSteps = sections.reduce((n, s) => n + s.steps.length, 0);
