import { FE, shot } from "./evidence";
import type { Section } from "./types";

// The frontend dev example: this site's own design session on Sep 19
// (frontendExample/, 22 shots, 4:34–7:12 PM). Frozen at launch per ADR-0003.
// Captions here follow what each frame actually shows — several v1 captions
// were attached to the neighbouring frame and are corrected here.

export const frontend: Section = {
  id: "frontend",
  label: "Frontend dev example",
  blurb: "This guide's own design session — research, prototypes, rejection, browser checks.",
  steps: [
    {
      slug: "kickoff",
      title: "This site is the example",
      lede: "You're looking at the result. The visual direction of this guide came out of one recorded session: a ticket, a skill, five options, two rejections, and a decision.",
      points: [
        "The section is a fixed record of that build, not a live feed (ADR-0003).",
        "Requirement → design research → implementation → browser testing → visual review → iteration → final UI.",
      ],
      scene: { rig: "organism", preset: { mode: "agent", tools: "gh issue view,frontend-design,lazyweb,playwright,Edit" } },
      sceneCaption: "The same agent loop as the Intro — this time its tools are the ones the session actually used.",
      knobs: ["loopSteps"],
      replay: {
        title: "Sep 19, 4:34 PM — Sonnet 5, high effort",
        lines: [
          { who: "user", text: "Pull issue #1. Use frontend design skill. grill me where needed. Show atleast 5 alternate options to choose from" },
          { who: "tool", text: "$ gh issue view 1 --repo Bitaron/AI-Coding-Session-Interactive-Teaching-Website --comments" },
        ],
      },
      evidence: [shot(FE, "2026-09-19 16-34-37", "4:34 PM · kickoff", "The kickoff prompt; the agent reads the GitHub issue with gh.")],
    },
    {
      slug: "grill",
      title: "Grilled, with recommendations",
      lede: "Five questions, each with the agent's recommended answer. Three are approved as written; for palette and transitions the developer wants to see it, not read it.",
      points: [
        "Recommended: light-first — a dark, monospace default “reads as generic right now”.",
        "Then an interruption that changes the method: “Use lazyweb to show 5 different prototype”.",
      ],
      scene: {
        rig: "origami",
        preset: {
          mode: "skills",
          items: "Q1 audience~self-paced first|Q2 uniformity~one shared system|Q3 palette~need visual|Q4 progress~hierarchical|Q5 transitions~need visual",
          spots: "grilling~one question, one recommendation|lazyweb~“use lazyweb”",
        },
      },
      sceneCaption: "Each question is a sealed answer. Point at one to open it.",
      replay: {
        title: "Sep 19, 5:45 → 5:48 PM",
        lines: [
          { who: "agent", text: "❓ Q3 — Base palette: Dark-first canvas […] or light-first editorial canvas […]? ➡ My recommendation: light-first. A dark, monospace-forward default is exactly the kind of “AI-tool-coded” look that reads as generic right now…" },
          { who: "user", text: "Q3 need visual. prototype q5 also need visual prottype. rest ok" },
          { who: "agent", text: "Got it — you approved Q1, Q2, and Q4 […] For Q3 (palette) and Q5 (transitions) you want to see it, not just read it." },
          { who: "catch", text: "Q3 need visual. prototype q5 also need visual prottype. rest ok. Use lazyweb to show 5 different prototype for me to choose from" },
        ],
      },
      evidence: [
        shot(FE, "2026-09-19 17-45-07", "5:45 PM · Q2–Q5", "Grilling questions Q2 to Q5, each with a recommendation."),
        shot(FE, "2026-09-19 17-48-51", "5:48 PM · “need visual”", "The developer asks for visual prototypes, then interrupts to add lazyweb."),
      ],
    },
    {
      slug: "round-one",
      title: "Round 1: one layout in five outfits",
      lede: "A local server, an automated browser, and the same “Stateless sessions” step dressed as Dark Terminal, Blueprint, Warm Manuscript and High-contrast Mono — captured with [[playwright-mcp|Playwright]].",
      points: [
        "“calling playwright 12 times … palette-B2.png” — the agent screenshots its own variants.",
        "Transitions variant A: one universal slide for every kind of content.",
      ],
      scene: { rig: "colony", preset: { mode: "converge" } },
      sceneCaption: "Reference cards drift, gather into five candidate directions, and one is picked — for now.",
      knobs: ["temperature"],
      replay: {
        title: "Sep 19, 5:51 → 5:58 PM",
        lines: [
          { who: "tool", text: "$ python3 -m http.server 8934" },
          { who: "tool", text: "localhost:8934/palette.html?variant=B — B (Dark Terminal)" },
          { who: "tool", text: "variant=C — C (Blueprint / Technical)  ·  D (Warm Manuscript)  ·  E (High-contrast Mono)" },
          { who: "agent", text: "Editing 2 files +529, searching for 1 pattern, reading 4 files, calling playwright 12 times […] ⎿ palette-B2.png" },
          { who: "tool", text: "transitions.html?variant=A — A (Universal slide (same for all content))" },
        ],
      },
      evidence: [
        shot(FE, "2026-09-19 17-51-15", "5:51 PM · automated browser", "A local http.server starts and an automation-launched Chrome opens."),
        shot(FE, "2026-09-19 17-51-47", "B · Dark Terminal", "Palette variant B: near-black canvas, monospace heading."),
        shot(FE, "2026-09-19 17-51-52", "C · Blueprint", "Palette variant C: grid-lined off-white canvas."),
        shot(FE, "2026-09-19 17-51-57", "D · Warm Manuscript", "Palette variant D: parchment and serif type."),
        shot(FE, "2026-09-19 17-52-02", "E · High-contrast Mono", "Palette variant E: pure white, heavy black borders."),
        shot(FE, "2026-09-19 17-52-50", "5:52 PM · 12 Playwright calls", "The terminal reports twelve Playwright calls while saving palette-B2.png."),
        shot(FE, "2026-09-19 17-58-35", "5:58 PM · transition A", "Transitions variant A, a universal slide, mid-animation."),
      ],
    },
    {
      slug: "traceable",
      title: "Making the research traceable",
      lede: "Asked how [[lazyweb|Lazyweb]] was used, the agent writes it down — three real queries (one admitted mostly noise) and a table from reference to variant — then puts citations on the prototypes themselves.",
      points: [
        "Variants without a reference say so: “Original exploration — no direct lazyweb reference”.",
        "It catches its own copy-paste error: Retool linked to mozi's URL.",
        "Verdict: “q3 all are generic. q5 liked Shared-frame morph but crossfade not.”",
      ],
      scene: {
        rig: "strata",
        preset: {
          mode: "adr",
          layers: "query 1 · editorial documentation stepper|query 2 · developer docs, long-form|query 3 · scrollytelling (mostly noise)|are.na → variant A|Dropbox → variant B|mozi → variant C",
          question: "“where did this variant come from?”",
          answer: "4",
          spots: "lazyweb~real references|code-review~cite, then check",
        },
      },
      sceneCaption: "Each layer is a query or a reference→variant link. Ask where a variant came from and its source slides out.",
      replay: {
        title: "Sep 19, 6:43 → 6:50 PM",
        lines: [
          { who: "user", text: "Need description on how layweb was used for these prototype to add as frontend teaching material" },
          { who: "agent", text: "prototyp/README.md now has a “Design research: how lazyweb fed into this” section that: – Lists the 3 actual search queries run (including the one that returned mostly noise […])" },
          { who: "user", text: "add lazyweb reference to each prototype html so that it can be used" },
          { who: "agent", text: "I also caught and fixed a mistake before committing — I'd initially linked “Retool” to mozi's URL by copy-paste error…" },
          { who: "catch", text: "q3 all are generic. q5 liked Shared-frame morph but crossfade not." },
        ],
      },
      evidence: [
        shot(FE, "2026-09-19 18-43-10", "6:43 PM · write it down", "Prototypes pushed; the developer asks for a lazyweb write-up."),
        shot(FE, "2026-09-19 18-50-20", "6:50 PM · cited on page", "Citations added to each prototype; the developer calls round 1 generic."),
        shot(FE, "2026-09-19 18-50-53", "6:50 PM · the README", "The README's design-research section: queries and reference table."),
      ],
    },
    {
      slug: "round-two",
      title: "Round 2: narrower, sharper",
      lede: "Transitions keep the liked frame-morph and only vary the content: slide, clip-wipe, scale, hard cut. The palette is rebuilt from sharper queries — four compositions, not new colours on the old box.",
      points: [
        "“combine I and H, frame animates, content scale with frame (No fade)” → variant J: one physical zoom.",
        "Sharper sources: bold-typography portfolios and The Economist's data-journalism grid.",
        "A real [[css-specificity|CSS specificity]] bug caught: an ID selector silently overriding show/hide.",
      ],
      scene: {
        rig: "origami",
        preset: {
          mode: "spec",
          panels: "F · slide|G · clip-wipe|H · scale with frame|I · hard cut",
          done: "J = H + I, no fade",
          spot: "css-specificity~checked in the live DOM",
        },
      },
      sceneCaption: "Four content behaviours unfold one by one; the developer's pick fuses two of them.",
      replay: {
        title: "Sep 19, 6:52 → 7:09 PM",
        lines: [
          { who: "tool", text: "transitions-round2.html?variant=H — H (Scale with frame (no fade))" },
          { who: "agent", text: "Variant H (scale-with-frame) works correctly. Let's verify I (hard cut) the same way." },
          { who: "user", text: "combine I and H , frame animates, content scale with frame(No fade)" },
          { who: "tool", text: "calling playwright, lazyweb 30 times […] ⎿ prototyp/palette-round2.html" },
          { who: "agent", text: "Went back to lazyweb with sharper queries (bold-typography portfolios, The Economist's data-journalism grid) […] Caught and fixed a real CSS specificity bug along the way" },
          { who: "tool", text: "via lazyweb: wandelmaier — D (Flat Color-Blocked Chrome)" },
          { who: "tool", text: "via lazyweb: olivier-guillard — B (Title-Card Overlap)" },
        ],
      },
      evidence: [
        shot(FE, "2026-09-19 18-52-39", "6:52 PM · variant H", "Round-2 transition variant H: content scales with the frame."),
        shot(FE, "2026-09-19 18-54-46", "6:54 PM · 27 Playwright calls", "H verified in the browser; the developer asks to combine I and H."),
        shot(FE, "2026-09-19 18-57-54", "6:57 PM · committed", "The round-2 transitions commit."),
        shot(FE, "2026-09-19 19-03-19", "7:03 PM · back to lazyweb", "Thirty lazyweb and Playwright calls while building palette round 2."),
        shot(FE, "2026-09-19 19-05-31", "D · Flat Color-Blocked Chrome", "Round-2 palette D: a black rail of progress dots, colour-blocked labels."),
        shot(FE, "2026-09-19 19-06-41", "7:06 PM · summary", "Round 2 summary: variant J, four new compositions, the specificity bug."),
        shot(FE, "2026-09-19 19-09-49", "B · Title-Card Overlap", "Round-2 palette B: a ghost numeral behind a large bold heading."),
      ],
    },
    {
      slug: "browser-testing",
      title: "Browser testing — Playwright MCP",
      lede: "Every variant was opened in a real browser, clicked through and checked in the live DOM — 12, 8, 27, 6 and 11 calls in this session alone. The loop iterates on what the browser showed.",
      points: [
        "Implement → run → open → interact → validate → capture → review → improve.",
        "“Clean result: stop: 1, correct active panel, no stray transition classes left.”",
      ],
      scene: {
        rig: "tumbler",
        preset: {
          mode: "hooks",
          gates: "open in browser|check live DOM",
          calls: "variant H|variant I|ID selector overrides show/hide|variant J",
          blocks: "ID selector",
          spots: "playwright-mcp~a real browser|deterministic~same check, every variant",
        },
      },
      sceneCaption: "Each variant passes through the browser and a DOM check; the specificity bug is the one that bounces.",
      replay: {
        title: "Sep 19 — what the terminal reported",
        lines: [
          { who: "tool", text: "calling playwright 12 times — round 1 captures" },
          { who: "tool", text: "called playwright 8 times — citations verified in-browser" },
          { who: "tool", text: "called playwright 27 times — round-2 transitions" },
          { who: "result", text: "Clean result: stop: 1, correct active panel, no stray transition classes left, frame class cleaned up." },
          { who: "tool", text: "calling playwright 6 times · calling playwright 11 times — final prototype" },
        ],
      },
      evidence: [
        shot(FE, "2026-09-19 18-52-39", "the browser view", "The automation-launched browser showing transition variant H."),
        shot(FE, "2026-09-19 18-54-46", "the verification", "The terminal reporting the clean Playwright verification of H."),
      ],
    },
    {
      slug: "decision",
      title: "The decision",
      lede: "“Combine B + side bar frm D + side bar should be expand and minimize.” Two references, one original extension — and the next tweak already typed before the commit lands.",
      points: [
        "B gave the title card with a ghost numeral; D gave the sidebar as chrome; expand/collapse was asked for directly.",
        "Queued next: “side bar color doesn't match with body.”",
        "v1 of this guide shipped that direction. This edition is the same content, rebuilt as a place.",
      ],
      scene: {
        rig: "strata",
        preset: {
          mode: "adr",
          layers: "B · title card + ghost numeral|D · sidebar as chrome|expand / minimise (asked directly)|headings to navigate",
          question: "“side bar color doesn't match”",
          answer: "1",
          spots: "adr~a decision with sources|human-in-the-loop~the human picks",
        },
      },
      sceneCaption: "The final direction as a stack of its parts. The follow-up complaint pulls the sidebar layer straight back out.",
      replay: {
        title: "Sep 19, 7:12 PM",
        lines: [
          { who: "user", text: "q3: Combine B + side bar frm D + side bar should be expand and minimize. Side bar should have headings to easily navigate the site." },
          { who: "tool", text: "calling playwright 11 times […] git commit -m “Settle Q3: combine title-card content with an expandable nav sidebar”" },
          { who: "user", text: "side bar color doesn't match with body. change side bar color and text font to match body." },
        ],
      },
      evidence: [
        shot(FE, "2026-09-19 19-12-13", "7:12 PM · the instruction", "The terminal with the Combine B + side bar from D instruction and the queued follow-up."),
        shot(FE, "2026-09-19 19-12-16", "7:12 PM · the settled page", "The settled prototype: dark expandable sidebar and a ghost 06 title card."),
      ],
    },
  ],
};
