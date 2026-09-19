# Prototype (draft): Backend dev example screenshot curation

Rough draft for [Curate Backend dev example screenshot narrative](../issues/01-backend-screenshot-curation.md). This is a sample-based pass (24 of ~107 screenshots opened), not an exhaustive review — built to react to, not a final answer.

## Headline finding: `secondComputer/` is contaminated with unrelated work

The periodic screenshot tool on the "secondComputer" machine appears to have run continuously across weeks (2026-07-21 → 2026-09-15), capturing whatever was on screen — not just file-manager work. Of 12 `secondComputer/` shots sampled, only 2 were genuinely about the Spring Boot file-manager project. The rest were:

- A **BPL Order Engine** Claude Code session and a BPL org-structure task tree (2026-09-09, 2026-09-14) — a different real client project, same category as the `architecture-review` file already ruled **out of scope** on the map.
- An **admission-service / NDUB_ADMISSION_API** IntelliJ session (2026-09-08) — another unrelated real client project.
- A **Grafana Postgres alerting** dashboard and an **APM latency** dashboard (2026-08-06, 2026-08-30) — unrelated production monitoring, likely also client work.
- A **BPL Public Client Registration** process diagram (2026-07-21) and an **AI Hardware Procurement Proposal** Word doc (2026-07-28) — unrelated documents.
- A slide from this teaching session's own outline ("LLMs & Agentic Coding", 2026-09-14) — meta, arguably belongs in the Intro to AI section instead, not here.

The two genuine hits were both from **2026-09-15**, right at the end of the range, showing the final Maven module tree (`file-manager-api`, `file-manager-core`, `file-manager-storage-*`, etc.) alongside an unrelated `audify`/`audit-log` module group in the same project tree view.

By contrast, `firstComputer/` (8 of 32 shots sampled, all on-topic) reads as consistently genuine: Claude Code terminal sessions in `~/Projects/personal/spring-boot-file-manager`, working through wayfinder tickets, ADRs, the Maven module tree design, and a spec-kit-generated spec, dated 2026-09-11 through 2026-09-13.

**This overturns the assumed narrative shape.** The map already frames this as "a collaboration/handoff story contrasting how two developers picked up the same project" — but the evidence so far shows almost all the *documented planning/design work* happened on firstComputer in a 2-day window (Sep 11–13), while secondComputer's genuine contribution (visible so far) is just the final module-structure confirmation on Sep 15, sandwiched inside weeks of unrelated captures. There may be more genuine secondComputer material earlier in its range that this sample missed — a full pass is needed to know for sure.

## Rough curated selection (from confirmed on-topic shots only)

**Beat 1 — Planning & spec (firstComputer, Sep 11)**
- `2026-09-11 19-43-05` — wayfinder skill loaded, choosing chart-vs-work-through-map mode. *Caption: "Every feature starts as a decision, not code."*
- `2026-09-12 18-17-42` — `/mattpocock-skills:to-spec` synthesizing the resolved wayfinder map into `Spec.md`. *Caption: "21 decisions later, the map becomes a spec."*

**Beat 2 — Structural decisions (firstComputer, Sep 11–12)**
- `2026-09-11 20-16-29` / `2026-09-11 22-24-05` — grilling the Maven module tree into its final shape (`file-manager-core`, `-api`, `-storage-*`, `-standalone-server`, `-usage-example`). *Caption: "The module boundary is the argument."*
- `2026-09-12 18-56-04` — TDD skill scaffolding `pom.xml` in an isolated worktree. *Caption: "Tests and structure, before a line of business logic."*

**Beat 3 — Handoff / continuation (secondComputer, Sep 15)**
- `2026-09-15 10-19-18` — the realized module tree in IntelliJ, matching the plan from Beat 2. *Caption: "Two weeks later, on a different machine: the plan held."*

That's a thin Beat 3 — one screenshot carrying the entire "second developer" side of the story. Whether that's sufficient, or whether a fuller secondComputer review turns up more, is the open question below.

## Open questions for the user

1. Should the ~5 confirmed off-topic `secondComputer` shots (and any others like them found on a full pass) just be **left in the folder and ignored** by the curation, or **removed from the repo** entirely as stray captures?
2. Is a single-screenshot "second developer" beat acceptable, or does someone need to do a **full manual pass** over the remaining ~63 unreviewed `secondComputer` shots to find more genuine handoff material before the narrative is finalized?
3. Does the "LLMs & Agentic Coding" title-slide screenshot belong here at all, or should it move to the Intro to AI section as a self-referential artifact?
