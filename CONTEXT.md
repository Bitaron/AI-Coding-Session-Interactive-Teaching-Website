# AI Coding Session Website

An interactive website used as teaching material for an AI coding session, replacing a traditional slide presentation.

## Language

**Intro to AI section**:
The site section covering AI fundamentals and software-engineering concepts (planning/work-divide/implement, token generation, stateless sessions, model categories & reasoning effort across providers, reasoning/token economics, model selection, prompt, context window, agents, subagents, skills, hooks, loop, graph, memory, plugins, MCP, spec, ADR, TDD, code review), delivered across two live-delivery parts (see **Live-delivery part**).

**Step**:
The atomic unit of navigation within a section — one screen a presenter or reader advances through, addressable at its own real URL (e.g. `/intro/3`, per [the routing decision](https://github.com/Bitaron/AI-Coding-Session-Interactive-Teaching-Website/issues/4)). A section's content is authored as an ordered list of steps; some steps hold one concept, others bundle several when the concepts are one teaching beat (e.g. the cross-provider model-comparison step).

**Live-delivery part**:
A grouping of steps for pacing a single section's live delivery into more than one sitting when content volume exceeds one time slot (e.g. the Intro to AI section's ~45-minute budget). Presenter-facing pacing metadata only — it is not a separate route, page, or IA element; a self-paced reader moves through the section's steps continuously regardless of where a live-delivery-part boundary falls.
_Avoid_: "Session 1"/"Session 2" unqualified — collides with **AI session** (a single, stateless LLM conversation), which is itself core vocabulary inside the Intro to AI section's own content (the "stateless sessions" step).

**Backend dev example**:
The site section presenting a completed Spring Boot file-management-library project as a worked example, illustrated with periodic terminal/browser screenshots already captured across two computers (`backendExample/firstComputer`, `backendExample/secondComputer`).
_Avoid_: Backend example, Backend section

**Frontend dev example**:
The site section presenting *this repo's own build* as a worked example, illustrated with periodic terminal/browser screenshots captured while the site is developed — a self-referential documentation process, distinct from the Backend dev example because its material doesn't exist yet. Its screenshot capture and narrative freeze at this site's launch: it is a fixed case study of this build, not a continuously-updating one (see ADR-0003). The section opens with an explicit callout naming its self-referential nature to the reader.
_Avoid_: Frontend example, Frontend section, living section (this section *was* built live, but does not keep updating after launch — "living" describes its production, not its ongoing behavior)

**Working in an existing project**:
The site section presenting AI-assisted work inside a pre-existing/legacy codebase as a worked example, distinct from Backend dev example and Frontend dev example because those are both built from scratch. Its screenshots are added last, after the other sections' material is in place.
_Avoid_: Existing project section, legacy example
