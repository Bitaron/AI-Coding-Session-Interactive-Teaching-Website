# Map: AI Coding Session Website — content/IA spec

## Destination

A full content/information-architecture spec for the teaching website's three named sections — Intro to AI, Backend dev example, Frontend dev example — decisions-only. A separate build effort executes the spec afterward; this map does not include implementation.

## Notes

- Consult `skill/grilling.md` + `skill/domain-modeling.md` (via the `grill-with-docs` convention in `skill/grill-me-with-doc.md`) for any decision ticket — this repo's author uses that pairing before starting any feature.
- Consult `.claude/skills/create-section/SKILL.md` for how an individual section/concept gets produced (objective → audience → representation type → research → design → implement → browser-verify → iterate). That per-section production process is already decided; this map does not re-decide *how* any single concept is represented — only structure, grouping, and narrative.
- Repo-wide constraints (from root `CLAUDE.md`): pure JS/TS, GitHub-hosted, editorial/non-generic-AI-slop design philosophy, restrained purposeful animation only.

**Standing decisions (settled during charting, not tracked as tickets):**
- Navigation model: stepped / slide-deck-like (this replaces a live presentation — attendees follow step by step, not scroll-hunt).
- Tech stack: plain Vite + TypeScript, no framework, unless a specific section later proves a clear need.
- Animation: pure JS/CSS only — no animation libraries (explicit user constraint).
- Deployment: GitHub Pages.
- Intro to AI section audience: dual — live session attendees and later self-paced readers.
- Intro to AI section grouping: three clusters — (1) how software is traditionally built (planning/work-divide/implement), (2) AI/agent concepts (prompt, context window, agents, subagents, skills, hooks, loop, graph, memory, plugins, MCP), (3) software-engineering practice concepts (spec, ADR, TDD, code review).
- Backend dev example narrative: a collaboration/handoff story — contrasting how two different developers picked up the same Spring Boot file-management-library project (per `ProjectInfo.txt`'s own framing).
- Frontend dev example section skeleton: two sub-threads — design research via lazyweb MCP, and browser testing via Playwright MCP — framed as a living case study of this very site's build.

## Decisions so far

_(empty — no tickets resolved yet)_

## Not yet specified

- Frontend dev example section's detailed screenshot selection and narrative beats: blocked on screenshots that don't exist yet — they're captured while this site itself is built. Graduates into a ticket (likely `prototype`, mirroring [Curate Backend dev example screenshot narrative](issues/01-backend-screenshot-curation.md)) once real captures exist to react to.

## Out of scope

- `architecture review/architecture-review-20260907T043028Z.html`: a real architecture review of an unrelated production system ("orderEngine") — not one of the two named worked examples (Spring Boot backend library, this repo's own frontend build). User confirmed (2026-09-19) it needs no security remediation as-is, but it still sits outside this map's destination and is not folded into any section.
