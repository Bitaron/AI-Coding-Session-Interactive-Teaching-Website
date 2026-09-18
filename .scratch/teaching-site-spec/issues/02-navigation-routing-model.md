# Decide navigation/routing implementation for the stepped structure

Type: grilling
Status: open

## Question

The map has settled on a stepped/slide-deck-like navigation model (site-wide). This ticket decides the implementation shape of that model: does each step get its own URL/route (deep-linkable, shareable, browser back/forward works per-step), or is it a single-page app holding step position in client-side state only? Also decide whether a progress indicator (e.g. "3 of 12") is part of the spec, and how the three top-level sections (Intro to AI, Backend dev example, Frontend dev example) relate to the step sequence — one continuous sequence across all three, or three separately-steppable sub-decks.
