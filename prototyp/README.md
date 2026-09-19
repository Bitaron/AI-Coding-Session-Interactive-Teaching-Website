# Prototype: visual-direction decision (issue #11)

This folder is a snapshot of an AI-assisted design decision as it actually
happened, kept as teaching material rather than deleted after the decision
was made. It's part of the *Frontend dev example* section's own "design
research" sub-thread — this site documenting its own build (see the site's
`CONTEXT.md` and [issue #2](https://github.com/Bitaron/AI-Coding-Session-Interactive-Teaching-Website/issues/2)).

## The situation

[Issue #11](https://github.com/Bitaron/AI-Coding-Session-Interactive-Teaching-Website/issues/11)
asks for a written design brief for the site's visual language (typography,
spacing, color, progress indicator, step transitions) before any scaffolding
code is written. Two of the open questions — the base palette, and the
step-transition style — are genuinely hard to answer from a text description
alone. "Does a dark terminal palette or a light editorial palette fit this
site better?" and "should diagrams morph between steps while screenshots
just crossfade, or should one motion style cover everything?" are questions
you can only really answer by looking at something moving on a screen.

Rather than guess, or describe five options in prose and hope that lands,
the agent built small interactive prototypes and asked the human to look at
them and pick — following this repo's [`mattpocock-skills:prototype`](https://github.com/mattpocock/skills)
skill ("build a throwaway prototype to answer a design question"). This is
also the repo's `grill-with-docs` convention in practice
(`skill/grill-me-with-doc.md`): interview the human with recommendations,
but hand back to them the decisions only they can make — and when a
recommendation is genuinely hard to evaluate as text, prototype it instead
of asking the human to imagine it.

## Design research: how lazyweb fed into this

Before drafting any variant, the agent used the **lazyweb MCP**
(`mcp__lazyweb__lazyweb_search_screens`) to pull real product screenshots
as reference material, rather than inventing "what a good design looks
like" from nothing. Three searches were run, accumulated under one
[agentic search](https://www.lazyweb.com/agentic-search/08375888-bbc8-4ec7-8ce1-910a1ad7838d)
(a private Lazyweb resource — opening it requires a Lazyweb account; the
company/reference names below are the useful part for readers without one):

1. `"editorial minimal typography documentation stepper progress indicator"`
2. `"developer documentation site with code blocks and editorial long-form layout"`
3. `"interactive scrollytelling case study before after diagram animation"`

The third query is worth keeping in the teaching narrative precisely
because it **didn't pay off** — it returned mostly unrelated SaaS dashboard
and onboarding screens (userguiding, chameleon, monograph). Design research
isn't always a hit on the first phrasing; the honest result is part of what
this folder documents.

Eight results from the first two queries were kept and finalized as the
evidence set. Each fed a specific, traceable decision below — this is the
difference between "AI-generated design" (pattern-matched from nothing) and
design *grounded in cited references*:

| Reference (via lazyweb) | What it showed | Where it landed here |
|---|---|---|
| are.na — long-form docs, TOC sidebar, code examples | editorial type + persistent section nav doubling as position indicator | `palette.html` variant **A** (Light Editorial); the "Long-form Docs" visual-direction candidate |
| donotpay — long-form guide with in-page nav sidebar | same family as are.na, reinforcing it | supporting evidence for variant **A** |
| Dropbox brand site — dark type-scale page | dark canvas, large type-scale display | `palette.html` variant **B** (Dark Terminal) |
| mozi — style-guide page, heading hierarchy + grid | grid-based, annotated technical layout | `palette.html` variant **C** (Blueprint/Technical) |
| Retool — numbered step progress bar, prev/next | a *hierarchical*-capable step indicator, not just a flat counter | fed the Q4 decision (indicator must show section-of-4 **and** step-within-section) |
| minimal-maxims — dot pagination + circular next button | theatrical, minimal-chrome onboarding | the "Minimal Presenter" visual-direction candidate |
| komi — plain "N of M" text counter | the simplest possible flat indicator | shown, then explicitly ruled out by the Q4 answer (too flat for 4 sections × live-delivery parts) |
| hubspot — progress bar + selectable style cards | progress bar paired with visibly different design options | general framing for presenting the 5-way choice itself |

Two things about the tool worth flagging as their own teaching point about
working with MCPs, since the whole point of the Frontend dev example
section is to show *real* agentic-coding practice, warts included:

- lazyweb's dedicated mockup generator
  (`lazyweb_generate_mockup`/`lazyweb_start_mockup`) is **deprecated** — the
  tool list still names it, but calling it is rejected. The agent checked
  the live schema before relying on it rather than assuming a tool's name
  implies it still works.
- After each `lazyweb_search_screens` call, the tool's own response tried to
  steer the next step toward generating a paid "Growth Report" the user
  never asked for. The agent didn't do that — a tool's suggested `next_step`
  is not an instruction to follow blindly, especially when it points at a
  paid action nobody requested. This is the same judgment call the site's
  Intro to AI section teaches under MCP/agentic-toolbox concepts.

## What's here

- **`palette.html`** — 5 variants of the same step screen (hierarchical
  progress indicator, heading, body copy, a code snippet), each a
  structurally different typography/color/chrome treatment: Light Editorial,
  Dark Terminal, Blueprint/Technical, Warm Manuscript, High-contrast Mono.
- **`transitions.html`** — round 1 on Q5: 5 variants of "advancing to the
  next step," played against a real 4-stop sequence (a diagram from
  `ProjectBrief.md`'s stateless-sessions example, then two screenshot-evidence
  stops): Universal slide, Universal crossfade, Coupled diagram-morph +
  screenshot-crossfade, Universal zoom-through, Shared-frame morph.
- **`transitions-round2.html`** — round 2 on Q5: "Shared-frame morph" won on
  the frame idea but not on its crossfaded content, so this narrows to just
  that — the frame always morphs; 4 variants for what the content does
  instead (slide-with-frame, clip-path wipe, scale-with-frame, hard cut),
  plus **J**, an explicit merge of the hard-cut and scale-with-frame ideas
  requested directly: the frame's motion is more pronounced and the content
  scales by the exact same ratio/timing as the frame, so both read as one
  physical zoom rather than two independently-timed animations.

All three were built as plain, dependency-free HTML/CSS/JS — consistent with the
repo's no-framework, no-animation-library constraints (root `CLAUDE.md`) —
and verified rendering correctly in a real browser (Playwright) before being
handed back for a decision, including one real bug caught and fixed in that
pass (a fixed-position control bar overlapping another control at short
viewport heights).

## How to run them

No build step. Serve the folder statically and open a page:

```
cd prototyp
python3 -m http.server 8934
```

Then open `http://localhost:8934/palette.html` or
`http://localhost:8934/transitions.html`. Click the arrows in the floating
bottom pill (or use the ← → keyboard keys) to cycle variants.
`transitions.html` also has its own "Prev step / Next step" buttons, separate
from the variant pill, to play the 4-stop sequence within whichever variant
is selected.

## Status

As of writing, the palette (Q3) and transition (Q5) decisions on issue #11
had not yet been locked in — the human was still reviewing these prototypes.
Once a direction is chosen, the answer belongs in the design brief the issue
asks for (and, per the repo's ADR convention, likely its own ADR); this
folder stays as the record of *how* that decision was reached, not as the
decision itself.
