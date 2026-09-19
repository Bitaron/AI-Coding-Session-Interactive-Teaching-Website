# Curate Backend dev example screenshot narrative

Type: prototype
Status: claimed

## Question

`backendExample/firstComputer/` and `backendExample/secondComputer/` hold ~100 timestamped screenshots documenting the Spring Boot file-management-library build across two computers/developers. The map has already settled the narrative frame (a collaboration/handoff story contrasting how the two developers picked up the same project). This ticket decides: which specific screenshots get featured (a curated subset, not all ~100), what caption or beat each one carries, and how the "handoff" moment between the two computers is visually signposted. Resolve by building a rough draft selection (a prototype: an outline or stub page reacting to the actual images) for the user to react to, per `mattpocock-skills:prototype`.

## Prototype (draft, awaiting reaction)

[Rough curated selection + narrative beats](../assets/01-backend-screenshot-curation-prototype.md). Headline finding: a sample of `secondComputer/` screenshots turned up several unrelated real-client-work captures (BPL Order Engine, admission-service, Grafana/APM dashboards) mixed in with the genuine file-manager work — the same kind of contamination the map already excluded once via the `architecture-review` file.

**Update:** user manually deleted most of the contaminated files (75 → 26 in `secondComputer/`). Re-sampling the survivors found the real backend project ran its own wayfinder map ("File Manager Spec", issue #1 on `Bitaron/spring-boot-file-manager`) and even has a literal handoff-document commit (`docs/agents/issue-tracker.md`) answering "will a different machine's Claude pick this up" — a much stronger anchor for the handoff beat than inferring one from timestamps. Two contaminated files remain (`2026-09-14 22-06-39` BPL Order Engine; two `audify`/`audit-log` sibling-project shots on `2026-09-15`). Four open questions are listed at the end of the draft, including whether to pull real ticket content from the GitHub map for accurate captions.
