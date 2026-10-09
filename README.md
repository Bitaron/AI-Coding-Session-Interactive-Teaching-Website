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

## Deployment

The site is deployed to GitHub Pages as a project site, served from `/agentic-coding-guide/` (see `vite.config.ts`).
