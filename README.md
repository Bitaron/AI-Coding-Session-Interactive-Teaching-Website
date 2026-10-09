# AI Coding Session Website

**Start learning: [bitaron.github.io/agentic-coding-guide](https://bitaron.github.io/agentic-coding-guide)**

An interactive website used as teaching material for an AI coding session, replacing a traditional slide presentation. Built with plain TypeScript and Vite, hosted on GitHub Pages.

## Purpose

This site walks through what it takes to code effectively with AI agents, structured as four sections:

- **Intro to AI** — fundamentals such as planning/work-divide/implement, token generation, reasoning effort, context windows, agents, subagents, skills, hooks, memory, MCP, specs/ADRs, TDD, and code review
- **Backend dev example** — a completed Spring Boot file-management-library project walked through as a worked example
- **Frontend dev example** — this site's own build, documented as it was made
- **Working in an existing project** — AI-assisted work inside a pre-existing/legacy codebase

Content is organized into sections, each broken into steps — individual screens a reader advances through at their own pace, each addressable at its own URL.

See [ProjectBrief.md](ProjectBrief.md) for the full content brief and [AGENT.md](AGENT.md) for design philosophy and coding guidelines.

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build    # type-check and build for production
npm run preview  # preview the production build locally
```

## Project structure

- `src/main.ts`, `src/router.ts`, `src/sections.ts` — app entry point, client-side routing, and section registry
- `src/steps/` — one module per content step (e.g. `agents.ts`, `mcp.ts`, `tdd.ts`), each an atomic unit of navigation within a section
- `src/style.css` — global styles
- `backendExample/`, `frontendExample/`, `prototype/` — worked-example material and screenshots referenced by the site's content
- `docs/adr/` — architecture decision records
- `docs/agents/issue-tracker.md` — how issues and the active `/wayfinder` map are tracked

## v2 — the spatial guide (`/v2/`)

A second entry point re-presents the same material as one continuous 3D map: each step is a station with a living model you can poke, the camera flies between them, and an orbital dial replaces the sidebar. The backend and frontend examples are replayed line by line from their real screenshots. Decisions are in [docs/adr/0005-v2-spatial-redesign.md](docs/adr/0005-v2-spatial-redesign.md).

- Local: `npm run dev`, then open `http://localhost:5173/agentic-coding-guide/v2/`
- `src/v2/core/` — shared store and events (the only link between 3D and DOM)
- `src/v2/engine/` — renderer, camera flights, world layout, terrain, dynamic resolution
- `src/v2/scenes/` — the 3D metaphors ("rigs"), one file per family
- `src/v2/ui/` — reading panel, replays, dial, deep-dive dialogs, hotspots, sound
- `src/v2/content/` — sections, glossary (deep-dive terms + links), screenshot evidence
- `npm run check:links` — verify every deep-dive URL still resolves

## v3 — the city (`/v3/`)

The same content again, as an anime/comic city painted after Studio Ghibli. The old town across the river builds software the traditional way, by hand. In the new city, robots do the building: token generation is a robot head, the context window is a hard drive inside one, an agent is a head with hands and legs, and each model provider is its own robot. A guide robot carries you between stations; the "pages" button (or `/`) searches every page and flies you there. The backend example starts with a jungle maze (wayfinder, grilling, domain modeling), then raises a warehouse one screenshot at a time. The frontend example builds a billboard that ends on v1 of this site, and the existing-project example renovates the old house from the first station. Decisions are in [docs/adr/0006-v3-comic-city.md](docs/adr/0006-v3-comic-city.md).

- Local: `npm run dev`, then open `http://localhost:5173/agentic-coding-guide/v3/`
- Shares v2's shell and content (`src/v2/app.ts`, `src/v2/core/edition.ts`); `src/v3/content/cues.ts` swaps in the city scenes
- `src/v3/engine/` — city layout and backdrop, shared building sites, courier robot, ink/halftone pass
- `src/v3/scenes/` — city scenes; `robotkit.ts` is the shared cast; `sites/` holds the house, warehouse and billboard

## Deployment

The site is deployed to GitHub Pages as a project site, served from `/agentic-coding-guide/` (see `vite.config.ts`).
