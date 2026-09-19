# Prototype (draft): Backend dev example screenshot curation

Rough draft for [Curate Backend dev example screenshot narrative](../issues/01-backend-screenshot-curation.md). This is a sample-based pass, not an exhaustive review — built to react to, not a final answer.

## Update (after user's manual cleanup pass)

The user deleted ~49 of the original 75 `secondComputer/` files, narrowing the range from 2026-07-21→09-15 down to 2026-09-10→09-15. Re-sampling 15 of the remaining 26 turned up something important, and two lingering contamination spots.

**Major discovery: the backend project's real spec lives on GitHub, and it was built with wayfinder too.** A 2026-09-11 02:20 AM screenshot (`wayfinder skill setup — claude`) shows the file-manager project has its own active wayfinder map — **"File Manager Spec"**, issue #1 on `Bitaron/spring-boot-file-manager` — with 9 decisions already recorded and 9 frontier tickets (#11–#19) at that point. The Sep 10–11 block of screenshots is that map being worked ticket-by-ticket: baseline versions (#11), a v1 scope lock (folders + metadata + trash, quotas deferred), a public/private file access model (opaque `ShareToken`, not the raw file id), a "library mode" shape decision (thin HTTP client, matching the sibling project's `audit-log-java-client` pattern, full embedding deferred to v2), and a "does state survive a machine switch" question that ends with a `docs/agents/issue-tracker.md` handoff pointer being written and committed.

That last point makes the cross-machine handoff **literal and citable**, not just inferred from timestamps: the ticket asks "if I open this project in different pc with different claude will it start from here? if not create handoff document," and the answer is the `docs/agents/issue-tracker.md` file, committed and pushed, specifically so a session on another machine can pick the map back up. **This is the real "handoff" artifact** — better evidence than juxtaposing a Sep-11 and a Sep-15 screenshot and calling it a handoff.

Since the real decisions are recorded as closed GitHub issues on `Bitaron/spring-boot-file-manager`, it may be worth **fetching that map and its resolved tickets directly** (rather than reading captions off screenshots) to caption this beat accurately — flagged as an open question below rather than done here, since it means reading from a different repo.

**Remaining contamination (not caught by the user's pass):**
- `2026-09-14 22-06-39` — a BPL Order Engine ticket tree ("notification module integration"), same unrelated client project as before. Still off-topic.
- `2026-09-15 10-21-02` and `2026-09-15 10-33-10` — both show the `audify`/`audit-log-*` module tree. This is *not* file-manager's own code, but it's not random noise either: it's `spring-boot-activity-log`, the sibling project explicitly named in the Sep-11 baseline and "library mode" tickets as the precedent file-manager's module shape was measured against. Worth keeping only if captioned as "the sibling project referenced in the ticket," otherwise it reads as another stray capture.

**Correction to the original draft:** the two July screenshots I'd flagged (an `AI_Hardware_Procurement_Proposal_Rev2.docx` and a "LLMs & Agentic Coding" title-slide) were mixed up in my notes — one was `2026-07-22`, the other `2026-07-28`. Moot now: the user's cleanup already removed both.

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

1. Can I delete `2026-09-14 22-06-39.png` (BPL Order Engine) from `secondComputer/` — same category you already cleaned out?
2. Keep or drop the two `audify`/`audit-log` shots (`2026-09-15 10-21-02`, `2026-09-15 10-33-10`)? They're the sibling project referenced in the baseline ticket, not file-manager itself — usable only with a caption explaining that, otherwise best cut.
3. Want me to fetch the actual resolved tickets from the "File Manager Spec" map (issue #1) on `Bitaron/spring-boot-file-manager` on GitHub, so captions quote the real recorded decisions instead of what's visible in a terminal screenshot? That repo is outside this one, so I'd need to confirm you want me reading from it.
4. Beat 3 (the handoff) can now cite the actual `docs/agents/issue-tracker.md` handoff-document commit instead of just a module-tree screenshot — good enough as the anchor for that beat, or still want a fuller pass over the ~9 unreviewed Sep 10–11 shots and the ~6 unreviewed `firstComputer` shots first?
