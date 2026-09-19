# Design brief — visual language

Written for [issue #11](https://github.com/Bitaron/AI-Coding-Session-Interactive-Teaching-Website/issues/11).
Covers typography, spacing rhythm, color approach, the progress-indicator
treatment, and step-transition feel. Every section-content ticket and the
scaffold ticket ([#12](https://github.com/Bitaron/AI-Coding-Session-Interactive-Teaching-Website/issues/12))
build against this rather than re-deciding it per section.

Reached via real UI references pulled with the lazyweb MCP and interactive
HTML/CSS/JS prototypes, not from description alone — the full process,
including two rejected rounds, is recorded at [`prototyp/`](../prototyp/README.md).
The settled prototypes are [`prototyp/palette-q3-final.html`](../prototyp/palette-q3-final.html)
(layout/color/type) and [`prototyp/transitions-round2.html`](../prototyp/transitions-round2.html)
variant J (step transition).

## Audience priority

Self-paced reading is primary; live-session delivery is secondary. The site
explicitly needs to "remain useful as standalone learning material after
the live session" (`ProjectBrief.md` §1) — that's the artifact that outlives
the one-time event. Every choice below defaults to legibility and
scannability for a returning reader, not stage presence.

## Typography

- **Display headings** (`h1` per step): bold, ~800 weight, tight negative
  letter-spacing (-0.02 to -0.03em), sans-serif system stack
  (`-apple-system, "Segoe UI", Helvetica, Arial, sans-serif` — no webfont
  dependency, consistent with the no-added-dependency stance).
- **Body copy**: 1.05rem, 1.65 line-height, same sans stack, max measure
  ~62ch so paragraphs stay scannable at any viewport width.
- **Code / terminal content**: monospace (`SF Mono, Menlo, monospace`),
  rendered as genuine code — a flat panel with a soft warm-gray background
  (`#EDE7D8`), not a dark "hacker" terminal skin. Real terminal screenshots
  (Backend/Frontend dev example sections) keep their own authentic chrome;
  this rule is for authored code snippets only.
- **Navigation / meta text** (step counters, section labels): small
  (0.68–0.82rem), uppercase with wide letter-spacing for labels, regular
  weight for nav items — kept visually quiet relative to heading/body.

## Color approach

Light, editorial paper canvas — not dark, not terminal-coded:

- **Background**: warm off-white, `#F7F5F0`.
- **Ink**: near-black, `#171614`.
- **Functional accents only**, never decorative: orange `#E8611E` marks
  "done" progress, green `#1f8a56`/`#2FB673` marks "current." These carry
  real meaning (position in the site), so they're exempt from the
  no-decoration rule — but nothing else on the page uses saturated color.
- No gradients anywhere. No dark-mode-as-default — a dark canvas with
  monospace type was explicitly tried (`palette.html` variant B, `palette-round2.html`
  variant A/D explorations) and dropped for reading during this site's real
  intended lifetime, and because "dark + monospace" reads as generic
  AI-tool marketing rather than this site's own voice.

## Spacing / whitespace rhythm

Generous, asymmetric whitespace used as a structural device, not padding
for its own sake:

- Step content sits in generous vertical rhythm (~10vh top padding, ~6vw
  horizontal) rather than a cramped card.
- The title-card treatment (see below) deliberately overlaps a huge ghost
  numeral behind the heading — negative space is used to create hierarchy
  (the numeral recedes, the heading reads first) rather than everything
  sitting in its own neatly-bordered box.
- No card borders/shadows around body content — sections are separated by
  position and type scale, not by boxing everything in.

## Layout: title-card content + expandable navigation sidebar

Settled in [`palette-q3-final.html`](../prototyp/palette-q3-final.html),
combining two structurally distinct references pulled via lazyweb (not a
reskin of a single template — see `prototyp/README.md` for why that
mattered):

- **Content**: each step opens with a "title card" — a large, faint ghost
  numeral (the step number) positioned behind and overlapping the bold
  step heading, with a small uppercase meta line (section · part · step
  count) above. Body copy and code sit below in a normal reading column.
- **Sidebar**: a persistent left rail, collapsible via a toggle button
  (☰ / ×), animated via a `grid-template-columns` transition (~260ms).
  - **Collapsed** (72px): a minimal dot rail — one dot per step in the
    current section, filled for done, larger/green for current. Lowest
    chrome, best for live delivery.
  - **Expanded** (300px): real site navigation — the 4 named sections
    (Intro to AI, Backend dev example, Frontend dev example, Working in an
    existing project) as headings, with the current section's steps nested
    underneath and the current step highlighted. This is real navigation,
    not just a progress readout — a self-paced reader can jump anywhere in
    the site from here.
  - The sidebar shares the body's exact background, ink color, and font —
    no separate dark-chrome treatment. Only the hairline right border and
    the functional accent colors distinguish it from the content area.

## Step-transition feel

Settled in [`transitions-round2.html`](../prototyp/transitions-round2.html)
variant **J**: the step's frame (the visual "window" a step content sits
in) and the content inside it scale together, on the exact same ratio and
timing, with **no opacity fade**. The frame's chrome (border-radius, subtle
scale) and the content itself move as one continuous physical motion — a
single coordinated zoom — rather than two independently-timed animations
layered on top of each other (which is what made the earlier crossfade-based
version feel disconnected).

This satisfies `ProjectBrief.md`'s "architecture transformations" / "code →
result transformations" animation guidance directly: motion communicates
that one step is *becoming* the next, not being swapped for it. For steps
built from constructed diagrams specifically (mostly the Intro to AI
section), individual diagram elements can additionally morph in place
(demonstrated in `transitions.html`'s "coupled" variant from round 1) —
that's a refinement available per-diagram, not a change to the frame/content
rule above, which applies universally.

Pure CSS transitions/transforms only — no animation library, consistent
with root `CLAUDE.md`.

## Progress indicator: hierarchical, not flat

The indicator (both the sidebar and any inline "Section X of 4 · Step Y of
N" meta line) must always be able to express **both** which of the 4
sections a reader is in and which step within it — a flat counter or dot
row (tried and rejected: `komi`'s "N of M", `minimal-maxims`' dot pagination)
doesn't scale to 4 sections plus the Intro to AI section's two live-delivery
parts. The expandable sidebar is how that hierarchy is made navigable
rather than just displayed.

## Checked against root `CLAUDE.md`'s avoid list

| Avoid | Status |
|---|---|
| Purple gradients | None used anywhere; no gradients at all |
| Excessive glassmorphism | None — flat opaque surfaces only |
| Excessive rounded cards | None — code/quote blocks are flat rectangles; the only rounding is the sidebar's subtle frame-morph transition and small UI controls (toggle button, dots) |
| Unnecessary shadows | None in the settled design (the floating variant-switcher pill visible in the prototypes is prototype-only tooling, not part of the shipped design) |
| Generic SaaS dashboards | Rejected explicitly in round 1 (see `prototyp/README.md`); settled layout is an editorial title-card page, not a dashboard |
| Excessive icons | One functional icon (sidebar toggle, ☰/×) |
| Decorative animation | Step transitions communicate a state change (frame+content becoming the next step); nothing animates without meaning |
| Meaningless statistics | Progress numbers (step counts, section position) are real navigational state, not vanity metrics |

## Open for later section-content tickets

- Diagram-specific morph treatments (per the Intro to AI section's many
  conceptual diagrams) follow the universal frame/content rule above but
  can add element-level morphing where a diagram genuinely transforms
  step-to-step — a per-diagram decision, not a per-section one.
- The sidebar's collapsed dot-rail currently shows steps for the *current*
  section only; whether it should show a lighter marker for other sections'
  presence isn't decided and doesn't block the scaffold ticket.
