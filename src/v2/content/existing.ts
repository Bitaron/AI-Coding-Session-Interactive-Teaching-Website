import type { Section } from "./types";

// "Working in an existing project" — v1's narrated transcript for the
// fictional Riverside Ticketing app (Express + jQuery + SQLite, one
// 1,200-line routes.js, no tests). Lines are carried over from v1's
// src/steps/existing-project-*.ts. The throughline: almost every catch is
// human-initiated.

export const existing: Section = {
  id: "existing-project",
  label: "Working in an existing project",
  blurb: "A messy legacy app, an ordinary agent, and the human catches that matter.",
  steps: [
    {
      slug: "ask",
      title: "Ask about the project and the change",
      lede: "Riverside Ticketing: a small, messy internal support app. The request — status filtering and CSV export — sounds simple. The agent is ready to start; the human isn't.",
      points: [
        "The agent here is deliberately ordinary, not exceptionally sharp.",
        "First catch: who may export what? Agents their own tickets; admins everyone's.",
      ],
      scene: { rig: "organism", preset: { mode: "agent", tools: "Read routes.js,Grep,Edit,Bash" } },
      sceneCaption: "An eager loop with nothing yet to anchor it — the creature reaches before it knows the terrain.",
      knobs: ["loopSteps"],
      replay: {
        title: "Riverside Ticketing",
        lines: [
          { who: "user", text: "Add status filtering + CSV export to the tickets list." },
          { who: "agent", text: "Sure, I can add that. I'll take a look at the codebase and get started." },
          { who: "catch", text: "Hold on, don't start yet. Not everyone should be able to export everything — agents can only export their own tickets, admins get everyone's. Did you check who's using this and how before diving in?" },
          { who: "agent", text: "I hadn't gotten to permissions yet — good to know. I'll make sure export respects that split." },
        ],
      },
    },
    {
      slug: "context",
      title: "Build context",
      lede: "The agent reads routes.js and proposes a WHERE status = ? — a surface-level read. The human knows what the code doesn't say.",
      points: [
        "status is free text, not an enum; old rows say “Closed” as well as “closed”.",
        "Don't hand-roll CSV — [[csv-injection|escaping bugs]] have bitten this team before. Use a small, well-used library.",
      ],
      scene: { rig: "mycelium", preset: { mode: "legacy" } },
      sceneCaption: "The agent's probe lights what it reads in the tangle. Orange spots are what the human flagged — the probe would have walked past them.",
      replay: {
        title: "routes.js",
        lines: [
          { who: "agent", text: "GET /tickets: admin → SELECT * FROM tickets; otherwise WHERE assignee_id = ? with req.session.userId. I'll add a status condition to that query." },
          { who: "catch", text: "status is just a free-text column, not an enum. There's old data with weird casing, like “Closed” instead of “closed”. If you match it exactly you'll silently drop rows." },
          { who: "agent", text: "I'll compare case-insensitively." },
          { who: "catch", text: "don't hand-roll the writing yourself. I've seen comma/quote escaping bugs from homemade CSV code before. Just pull in a small, well-used library." },
          { who: "agent", text: "I'll add json2csv." },
        ],
      },
    },
    {
      slug: "agent-md",
      title: "Write AGENT.md",
      lede: "The agent's first [[agents-md|AGENT.md]] only records what it was just told. The human adds the two things the next person needs on day one.",
      points: [
        "“All routes live in routes.js (1,200+ lines). Don't split it as a side effect of an unrelated change.”",
        "Auth: role is admin or agent; agents act only where assignee_id = req.session.userId. “Any new ticket-scoped route must respect this.”",
        "Even the core-knowledge artifact needed a nudge.",
      ],
      scene: {
        rig: "strata",
        preset: {
          mode: "adr",
          layers: "status: free text, compare case-insensitively|CSV: use an audited dependency|routes.js: don't split it casually|auth: agents see only their own tickets",
          question: "“can I add a route here?”",
          answer: "3",
          spots: "agents-md~day-one knowledge|soft-rule~still a written rule",
        },
      },
      sceneCaption: "AGENT.md as layers: the agent's two, then the human's two. A future question pulls out the auth rule.",
      replay: {
        title: "AGENT.md",
        lines: [
          { who: "agent", text: "Draft: status is free text — compare case-insensitively. No CSV utility — use an audited dependency." },
          { who: "catch", text: "This is missing the access-control rule we just talked about, and there's nothing about routes.js being one giant file people shouldn't casually split. Add both — that's exactly the kind of thing the next person needs on day one." },
          { who: "result", text: "+ All routes live in routes.js (1,200+ lines). Don't split it as a side effect of an unrelated change.  + Any new ticket-scoped route must respect this." },
        ],
      },
    },
    {
      slug: "plan",
      title: "Plan → review",
      lede: "A technically fine plan that quietly drops ownership scoping. The human reviews the plan, not just the diff — the cheapest point to catch it.",
      points: [
        "Plan: ?status= case-insensitive · /tickets/export.csv via json2csv · a dropdown and an Export CSV link.",
        "Catch: export needs the same admin/agent scoping, and the link must carry the on-screen filter.",
      ],
      scene: {
        rig: "origami",
        preset: {
          mode: "spec",
          panels: "?status= filter|export.csv route|dropdown + link|same role scoping",
          done: "✓ reviewed before code",
          spot: "human-in-the-loop~review the plan",
        },
      },
      sceneCaption: "The plan unfolds panel by panel; the last panel is the one the human had to add.",
      replay: {
        title: "Plan review",
        lines: [
          { who: "agent", text: "1. ?status= matched case-insensitively. 2. /tickets/export.csv route using json2csv. 3. A status dropdown plus an “Export CSV” link." },
          { who: "catch", text: "the export route needs the same admin/agent scoping as the list route — don't let it become an unfiltered admin-only assumption by accident. And the export link should carry whatever status filter is currently on screen, not export everything." },
          { who: "agent", text: "Reusing the same role/ownership branch; the link carries the current ?status=." },
        ],
      },
    },
    {
      slug: "review",
      title: "Code review",
      lede: "The diff checks the role but not that a session exists. No test would have caught it — there are none. Comparing against the codebase's own pattern did.",
      points: [
        "Fix: if (!req.session.userId) return res.sendStatus(401); — the guard every other route uses.",
        "[[code-review|Review]] found what the agent didn't flag.",
      ],
      scene: { rig: "colony", preset: { mode: "sieve" } },
      sceneCaption: "The review lens catches flagged changes and sends them back; they return fixed.",
      knobs: ["temperature"],
      replay: {
        title: "Diff review",
        lines: [
          { who: "catch", text: "the export route checks req.session.role === 'admin' … but there's no check that req.session.userId even exists first. What happens if someone hits this URL without a session?" },
          { who: "agent", text: "You're right, that would throw instead of returning 401. Fixing it to match the guard the other routes use." },
          { who: "result", text: "if (!req.session.userId) return res.sendStatus(401);" },
          { who: "user", text: "That matches the pattern everywhere else now. Approved — merge it." },
        ],
      },
    },
  ],
};
