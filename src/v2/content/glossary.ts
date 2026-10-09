import type { GlossaryEntry } from "./types";

// Every deep-dive term on v2. Definitions follow what the guide itself
// teaches; links go to primary sources (vendor docs, specs, the original
// papers or the canonical write-up). Run `npm run check:links` to re-verify.

const entries: GlossaryEntry[] = [
  // --- software building ----------------------------------------------------
  {
    id: "waterfall",
    term: "Plan-driven development",
    definition: "Requirements, analysis and design are settled up front, then handed down to be built. The plan is the hand-off artifact between people.",
    why: "Agentic workflows keep the planning stage but change who does the hand-offs — and how often.",
    links: [{ label: "Waterfall model — Wikipedia", url: "https://en.wikipedia.org/wiki/Waterfall_model" }],
  },
  {
    id: "work-breakdown",
    term: "Work breakdown",
    definition: "Dividing a project into pieces small enough to assign, estimate and track, with their dependencies made explicit.",
    why: "The same move reappears as agent tickets: vertical slices with a dependency graph, one per session.",
    links: [{ label: "Work breakdown structure — Wikipedia", url: "https://en.wikipedia.org/wiki/Work_breakdown_structure" }],
  },
  {
    id: "integration",
    term: "Integration",
    definition: "Bringing each developer's changes back together, verifying the whole still builds and passes its tests.",
    links: [{ label: "Continuous Integration — Martin Fowler", url: "https://martinfowler.com/articles/continuousIntegration.html" }],
  },

  // --- how models work -------------------------------------------------------
  {
    id: "token",
    term: "Token",
    definition: "The unit a model reads and writes — usually a piece of a word, not a whole word. Text is split into tokens before the model sees it.",
    links: [{ label: "Token counting — Anthropic", url: "https://platform.claude.com/docs/en/build-with-claude/token-counting" }],
  },
  {
    id: "next-token",
    term: "Next-token prediction",
    definition: "At each step the model scores every possible next token given the context so far, one is chosen and appended, and the loop repeats.",
    why: "Everything an agent does — plans, tool calls, code — is produced by this one loop.",
    links: [
      { label: "Attention Is All You Need (2017)", url: "https://arxiv.org/abs/1706.03762" },
      { label: "Transformer explainer (interactive)", url: "https://poloclub.github.io/transformer-explainer/" },
    ],
  },
  {
    id: "temperature",
    term: "Temperature",
    definition: "A sampling setting that sharpens (low) or flattens (high) the probability distribution over candidate next tokens. Low is more repeatable; high is more varied.",
    why: "In the loom scene, raise temperature and watch unlikely words start getting picked.",
    links: [{ label: "Messages API parameters — Anthropic", url: "https://platform.claude.com/docs/en/api/messages" }],
  },
  {
    id: "stateless",
    term: "Stateless session",
    definition: "Each model call starts only from the context sent with it. Nothing from another, independent session carries over unless the application puts it back in.",
    links: [{ label: "Messages API — Anthropic", url: "https://platform.claude.com/docs/en/api/messages" }],
  },
  {
    id: "agent-memory",
    term: "Agent memory",
    definition: "Persistence added around the model — files, trackers, databases — that the application reads back into context in a later session.",
    why: "The model never remembers; the workflow does. Where that memory lives decides who can find it.",
    links: [{ label: "Manage Claude's memory — Claude Code docs", url: "https://code.claude.com/docs/en/memory" }],
  },

  // --- models & effort ---------------------------------------------------------
  {
    id: "model-tiers",
    term: "Model tiers",
    definition: "Families offer fast/lightweight, balanced and deep-reasoning models. The tier is about the workload you're matching, not 'bigger is better'.",
    links: [{ label: "Models overview — Anthropic", url: "https://platform.claude.com/docs/en/models/overview" }],
  },
  {
    id: "reasoning-effort",
    term: "Reasoning effort",
    definition: "A per-model control for how much internal reasoning happens before answering. Level names differ by provider, and the same name doesn't guarantee the same compute.",
    why: "Use effort as a relative dial within one model, never as a cross-vendor measurement.",
    links: [
      { label: "Effort — Anthropic", url: "https://platform.claude.com/docs/en/build-with-claude/effort" },
      { label: "Extended thinking — Anthropic", url: "https://platform.claude.com/docs/en/build-with-claude/extended-thinking" },
      { label: "Reasoning models — OpenAI", url: "https://developers.openai.com/api/docs/guides/reasoning" },
      { label: "Thinking mode — DeepSeek", url: "https://api-docs.deepseek.com/guides/reasoning_model" },
    ],
  },
  {
    id: "adaptive-thinking",
    term: "Adaptive thinking",
    definition: "Reasoning depth that responds to both the configured effort and how hard the task actually is, rather than a fixed budget.",
    links: [{ label: "Extended thinking — Anthropic", url: "https://platform.claude.com/docs/en/build-with-claude/extended-thinking" }],
  },
  {
    id: "reasoning-tokens",
    term: "Reasoning tokens",
    definition: "Tokens a model generates while thinking before its visible answer. Providers that report them count them as output tokens.",
    why: "A short answer can still carry a long bill: the thinking is billed even when you never see it.",
    links: [
      { label: "Reasoning model usage — DeepSeek", url: "https://api-docs.deepseek.com/guides/reasoning_model" },
      { label: "Extended thinking — Anthropic", url: "https://platform.claude.com/docs/en/build-with-claude/extended-thinking" },
    ],
  },
  {
    id: "test-time-scaling",
    term: "Test-time scaling",
    definition: "Spending more compute at inference — longer reasoning, more samples — to get better answers from the same model.",
    links: [{ label: "Scaling LLM Test-Time Compute (2024)", url: "https://arxiv.org/abs/2408.03314" }],
  },
  {
    id: "chain-of-thought",
    term: "Chain-of-thought",
    definition: "Producing intermediate reasoning steps before the answer; the idea that today's thinking models build on.",
    links: [{ label: "Chain-of-Thought Prompting (2022)", url: "https://arxiv.org/abs/2201.11903" }],
  },
  {
    id: "token-multiplication",
    term: "Agentic token multiplication",
    definition: "Each agent step re-sends the growing context — prior turns, tool results, reasoning — so total usage grows much faster than the final answer.",
    why: "Watch the orange bead ring around the agent: it thickens every lap, not just at the end.",
    links: [{ label: "Token counting — Anthropic", url: "https://platform.claude.com/docs/en/build-with-claude/token-counting" }],
  },
  {
    id: "model-selection",
    term: "Model selection",
    definition: "Use the least expensive, simplest model that reliably solves the task, and increase model capability or effort only when the task needs it.",
    links: [{ label: "Choosing a model — Anthropic", url: "https://platform.claude.com/docs/en/about-claude/models/choosing-a-model" }],
  },
  {
    id: "latency",
    term: "Latency",
    definition: "Time until the answer arrives. Bigger models and higher effort usually trade latency for capability.",
    links: [{ label: "Reducing latency — Anthropic", url: "https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency" }],
  },

  // --- prompt & context --------------------------------------------------------
  {
    id: "prompt",
    term: "Prompt",
    definition: "The instruction you give the model. It only has what you actually wrote — target, condition and expected behaviour have to be on the page.",
    links: [
      { label: "Be clear and direct — Anthropic", url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#be-clear-and-direct" },
      { label: "Prompt engineering overview — Anthropic", url: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview" },
    ],
  },
  {
    id: "context-window",
    term: "Context window",
    definition: "The maximum number of tokens a model can hold in a single call — the number on the spec sheet. Not every token inside it is equally useful.",
    links: [{ label: "Context windows — Anthropic", url: "https://platform.claude.com/docs/en/build-with-claude/context-windows" }],
  },
  {
    id: "lost-in-the-middle",
    term: "Lost in the middle",
    definition: "Models use information at the start and end of a long context more reliably than information buried in the middle.",
    links: [{ label: "Lost in the Middle (2023)", url: "https://arxiv.org/abs/2307.03172" }],
  },
  {
    id: "context-rot",
    term: "Context rot",
    definition: "Output quality degrading as input grows, well before the window is full. One reason usable context is smaller than advertised context.",
    links: [{ label: "Context Rot — Chroma research", url: "https://www.trychroma.com/research/context-rot" }],
  },
  {
    id: "context-engineering",
    term: "Context engineering",
    definition: "Deciding which tokens go into the context — and which stay out — so the useful share stays high across a long agent run.",
    links: [{ label: "Effective context engineering — Anthropic", url: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents" }],
  },

  // --- agents ---------------------------------------------------------------------
  {
    id: "agent-loop",
    term: "Agent loop",
    definition: "Reason about the goal, act with a tool, observe the result, reason again — repeating until the goal is met rather than answering once.",
    links: [
      { label: "Building effective agents — Anthropic", url: "https://www.anthropic.com/engineering/building-effective-agents" },
      { label: "ReAct: Reasoning + Acting (2022)", url: "https://arxiv.org/abs/2210.03629" },
    ],
  },
  {
    id: "react",
    term: "ReAct pattern",
    definition: "Interleaving reasoning traces with actions and observations — the research name for the think → act → observe loop.",
    links: [{ label: "ReAct (2022)", url: "https://arxiv.org/abs/2210.03629" }],
  },
  {
    id: "tool-use",
    term: "Tool use",
    definition: "The model emits a structured call against a declared tool; the harness runs it and feeds the result back as context.",
    links: [{ label: "Tool use overview — Anthropic", url: "https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview" }],
  },
  {
    id: "tool-schema",
    term: "Tool schema",
    definition: "The JSON Schema describing a tool's name, purpose and parameters. It's all the model knows about the tool, so it is part of the prompt.",
    links: [
      { label: "Defining tools — Anthropic", url: "https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview" },
      { label: "MCP tools spec", url: "https://modelcontextprotocol.io/specification/2025-06-18/server/tools" },
    ],
  },
  {
    id: "subagent",
    term: "Sub-agent",
    definition: "A delegated agent with its own, smaller context. It does focused work — research, implementation, testing — and returns a condensed result.",
    why: "The parent's context only takes the summary, not the churn.",
    links: [{ label: "Subagents — Claude Code docs", url: "https://code.claude.com/docs/en/sub-agents" }],
  },
  {
    id: "skill",
    term: "Skill",
    definition: "A packaged workflow — a SKILL.md with a name and description, plus instructions and files — reused instead of re-explained every time.",
    links: [
      { label: "Agent Skills — Anthropic", url: "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview" },
      { label: "mattpocock/skills", url: "https://github.com/mattpocock/skills" },
      { label: "anthropics/skills", url: "https://github.com/anthropics/skills" },
    ],
  },
  {
    id: "progressive-disclosure",
    term: "Progressive disclosure",
    definition: "Only a skill's name and description sit in context up front; the full instructions load when the skill is actually invoked.",
    links: [{ label: "Agent Skills — how they load", url: "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview" }],
  },
  {
    id: "grilling",
    term: "Grilling",
    definition: "A skill that interviews you relentlessly — one question at a time, each with a recommended answer — until plan and intent are shared.",
    links: [{ label: "mattpocock/skills", url: "https://github.com/mattpocock/skills" }],
  },
  {
    id: "wayfinder",
    term: "Wayfinder map",
    definition: "A skill that turns an idea too big for one session into a destination plus decision tickets on an issue tracker, resolved one ticket per session.",
    links: [{ label: "mattpocock/skills", url: "https://github.com/mattpocock/skills" }],
  },
  {
    id: "one-ticket-per-session",
    term: "One ticket per session",
    definition: "Wayfinder's rule: resolve a single decision, record it, then stop. Each session starts with a clean context and a small, reviewable change.",
    links: [{ label: "mattpocock/skills", url: "https://github.com/mattpocock/skills" }],
  },
  {
    id: "hooks",
    term: "Hooks",
    definition: "Shell commands the harness runs on lifecycle events — PreToolUse, PostToolUse, Stop and others — without the model being asked.",
    links: [{ label: "Hooks reference — Claude Code docs", url: "https://code.claude.com/docs/en/hooks" }],
  },
  {
    id: "deterministic",
    term: "Deterministic check",
    definition: "A check that returns the same verdict for the same input every time, whichever agent — or human — produced the change.",
    links: [{ label: "Hooks guide — Claude Code docs", url: "https://code.claude.com/docs/en/hooks-guide" }],
  },
  {
    id: "workflow-graph",
    term: "Workflow graph",
    definition: "A workflow modelled as states, decisions, dependencies and transitions — so branches and loops are explicit instead of implied.",
    links: [{ label: "LangGraph concepts", url: "https://langchain-ai.github.io/langgraph/concepts/low_level/" }],
  },
  {
    id: "dependency-edge",
    term: "Dependency edge",
    definition: "An edge saying one node can't finish until another has run — here, a fix isn't done until the tests have run again.",
    links: [{ label: "Directed acyclic graph — Wikipedia", url: "https://en.wikipedia.org/wiki/Directed_acyclic_graph" }],
  },
  {
    id: "beads",
    term: "Beads",
    definition: "A lightweight issue and memory tracker for agents that lives in the repository and is committed with Git.",
    links: [{ label: "steveyegge/beads", url: "https://github.com/gastownhall/beads" }],
  },
  {
    id: "plugin",
    term: "Plugin",
    definition: "An installable bundle of skills, commands, hooks and MCP servers, reused across projects.",
    links: [{ label: "Plugins — Claude Code docs", url: "https://code.claude.com/docs/en/plugins" }],
  },
  {
    id: "mcp",
    term: "Model Context Protocol (MCP)",
    definition: "An open standard for connecting agents to external tools and data through MCP servers, so each integration isn't hand-built into the agent.",
    links: [
      { label: "MCP introduction", url: "https://modelcontextprotocol.io/docs/getting-started/intro" },
      { label: "MCP in Claude Code", url: "https://code.claude.com/docs/en/mcp" },
    ],
  },
  {
    id: "playwright-mcp",
    term: "Playwright MCP",
    definition: "An MCP server that lets an agent drive a real browser: open pages, click, read the DOM and take screenshots.",
    links: [
      { label: "microsoft/playwright-mcp", url: "https://github.com/microsoft/playwright-mcp" },
      { label: "playwright.dev", url: "https://playwright.dev" },
    ],
  },
  {
    id: "lazyweb",
    term: "Lazyweb MCP",
    definition: "An MCP server returning real product screenshots and flows, used here to ground design research in shipped UI instead of invented UI.",
    links: [{ label: "Lazyweb", url: "https://www.lazyweb.com" }],
  },

  // --- SE practices ------------------------------------------------------------------
  {
    id: "spec-driven",
    term: "Spec-driven development",
    definition: "Idea → written spec → plan and tasks → implementation → verification against the spec, not against whatever the code happens to do.",
    links: [{ label: "github/spec-kit", url: "https://github.com/github/spec-kit" }],
  },
  {
    id: "adr",
    term: "Architecture Decision Record",
    definition: "A short record of one decision: the problem, the options considered and the consequences, so the same debate doesn't happen twice.",
    links: [
      { label: "adr.github.io", url: "https://adr.github.io/" },
      { label: "Documenting Architecture Decisions — Nygard", url: "https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions" },
    ],
  },
  {
    id: "nygard-adr",
    term: "ADR format",
    definition: "Title, context, decision, status and consequences — Michael Nygard's lightweight template most ADRs still follow.",
    links: [{ label: "Documenting Architecture Decisions — Nygard", url: "https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions" }],
  },
  {
    id: "domain-modeling",
    term: "Domain modeling",
    definition: "Writing the project's shared vocabulary and decisions down as they crystallise — a glossary (CONTEXT.md) and ADRs.",
    links: [{ label: "Ubiquitous Language — Martin Fowler", url: "https://martinfowler.com/bliki/UbiquitousLanguage.html" }],
  },
  {
    id: "tdd",
    term: "Test-driven development",
    definition: "Write a failing test, implement the minimum to pass, run it, refactor without changing behaviour — then repeat.",
    links: [{ label: "Test Driven Development — Martin Fowler", url: "https://martinfowler.com/bliki/TestDrivenDevelopment.html" }],
  },
  {
    id: "independent-verification",
    term: "Independent verification",
    definition: "The check is written or run by something other than the agent that wrote the code, so the implementer can't grade its own work.",
    links: [{ label: "The Practical Test Pyramid — Martin Fowler", url: "https://martinfowler.com/articles/practical-test-pyramid.html" }],
  },
  {
    id: "guardrails",
    term: "GuardRails",
    definition: "Checks enforced by something that runs — tests, hooks, architecture tests — as opposed to rules an agent has to read, remember and choose to follow.",
    why: "A Stop hook that runs the test suite is a guard; a CLAUDE.md line saying 'run the tests' is a rule.",
    links: [
      { label: "ArchUnit", url: "https://www.archunit.org/" },
      { label: "Testcontainers for Java", url: "https://java.testcontainers.org/" },
      { label: "MockMvc — Spring", url: "https://docs.spring.io/spring-framework/reference/testing/mockmvc.html" },
    ],
  },
  {
    id: "soft-rule",
    term: "Soft rule",
    definition: "Guidance written in prose — CLAUDE.md, AGENT.md, a prompt, a spec. It only holds if the agent reads it, remembers it and applies it in every session.",
    links: [{ label: "Manage Claude's memory — Claude Code docs", url: "https://code.claude.com/docs/en/memory" }],
  },
  {
    id: "code-review",
    term: "Code review",
    definition: "Checking every change for correctness, maintainability, security, architecture, requirements and edge cases — folded into the loop, not bolted on at the end.",
    links: [{ label: "Google engineering practices: code review", url: "https://google.github.io/eng-practices/review/" }],
  },
  {
    id: "human-in-the-loop",
    term: "Human in the loop",
    definition: "A person reviews or decides at defined points — the question, the plan, the diff — because the agent won't catch everything a person who knows the system will.",
    links: [{ label: "Building effective agents — Anthropic", url: "https://www.anthropic.com/engineering/building-effective-agents" }],
  },
  {
    id: "agents-md",
    term: "AGENTS.md / CLAUDE.md",
    definition: "A Markdown file of project instructions the agent loads at the start of every session — the lowest-friction place to put day-one knowledge.",
    links: [
      { label: "agents.md", url: "https://agents.md" },
      { label: "Claude Code memory files", url: "https://code.claude.com/docs/en/memory" },
    ],
  },
  {
    id: "repo-as-memory",
    term: "Repo as memory",
    definition: "Putting the state a fresh session needs — where the tracker is, which map is active — into committed files, so it travels with a clone.",
    links: [{ label: "agents.md", url: "https://agents.md" }],
  },
  {
    id: "maven-multi-module",
    term: "Maven multi-module",
    definition: "One parent POM aggregating several modules that build together but publish separately — here core, autoconfigure, starter, storage backends and more.",
    links: [{ label: "Maven: multiple modules", url: "https://maven.apache.org/guides/mini/guide-multiple-modules.html" }],
  },
  {
    id: "deep-module",
    term: "Deep module",
    definition: "A module whose simple interface hides substantial functionality. The backend brief asked for exactly this: 'Deep module with clean interface.'",
    links: [{ label: "A Philosophy of Software Design — Ousterhout", url: "https://web.stanford.edu/~ouster/cgi-bin/book.php" }],
  },
  {
    id: "spring-autoconfigure",
    term: "Spring Boot auto-configuration",
    definition: "Configuration classes that activate only when their conditions hold — a property is set, a class is on the classpath — so a library wires itself in.",
    links: [{ label: "Creating your own auto-configuration — Spring Boot", url: "https://docs.spring.io/spring-boot/reference/features/developing-auto-configuration.html" }],
  },
  {
    id: "plan-mode",
    term: "Plan mode",
    definition: "A Claude Code mode where the agent researches and proposes a plan without editing anything until you approve.",
    links: [{ label: "Common workflows — Claude Code docs", url: "https://code.claude.com/docs/en/common-workflows" }],
  },
  {
    id: "worktree",
    term: "Git worktree",
    definition: "A second working directory on its own branch from the same repository, so an agent's changes stay isolated from yours.",
    links: [{ label: "git-worktree", url: "https://git-scm.com/docs/git-worktree" }],
  },
  {
    id: "csv-injection",
    term: "CSV escaping & injection",
    definition: "Hand-written CSV breaks on commas, quotes and newlines, and cells starting with = or + can execute as spreadsheet formulas.",
    links: [{ label: "CSV Injection — OWASP", url: "https://owasp.org/www-community/attacks/CSV_Injection" }],
  },
  {
    id: "css-specificity",
    term: "CSS specificity",
    definition: "When rules conflict, the more specific selector wins — an ID selector beats any number of classes, silently overriding show/hide logic.",
    links: [{ label: "Specificity — MDN", url: "https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Specificity" }],
  },
];

export const glossary = new Map(entries.map((e) => [e.id, e]));

export function allGlossary(): GlossaryEntry[] {
  return entries;
}
