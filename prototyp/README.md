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

## What's here

- **`palette.html`** — 5 variants of the same step screen (hierarchical
  progress indicator, heading, body copy, a code snippet), each a
  structurally different typography/color/chrome treatment: Light Editorial,
  Dark Terminal, Blueprint/Technical, Warm Manuscript, High-contrast Mono.
- **`transitions.html`** — 5 variants of "advancing to the next step,"
  played against a real 4-stop sequence (a diagram from `ProjectBrief.md`'s
  stateless-sessions example, then two screenshot-evidence stops): Universal
  slide, Universal crossfade, Coupled diagram-morph + screenshot-crossfade,
  Universal zoom-through, Shared-frame morph.

Both were built as plain, dependency-free HTML/CSS/JS — consistent with the
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
