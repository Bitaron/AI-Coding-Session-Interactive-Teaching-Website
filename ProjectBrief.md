# AI Coding Session — Interactive Teaching Website

## 1. Project Purpose

This project is an **interactive website used to conduct a session on AI-assisted software development and agentic coding**.

It intentionally replaces a traditional slide deck.

The website should serve two purposes simultaneously:

1. **Session material** — used live by the presenter to explain AI coding concepts.
2. **Development case study** — the website itself demonstrates how an agentic frontend development process can be performed using Claude Code, MCPs, Skills, browser automation, iterative review, and other AI-assisted engineering practices.

The final website will be hosted publicly through **GitHub Pages** and should remain useful as standalone learning material after the live session.

The presentation should feel like an **interactive technical experience**, not a collection of conventional slides.

---

# 2. Core Presentation Philosophy

The website should prioritize:

* visual storytelling
* interactive demonstrations
* animations
* progressive disclosure
* real project evidence
* diagrams and visual relationships
* actual development artifacts
* screenshots from the development process

Avoid simply presenting information as:

> Heading → bullets → paragraph

Whenever practical, use:

> Concept → interaction → visual transformation → explanation

The site should demonstrate the same principles that it teaches.

---

# 3. Presentation Structure

## Intro into AI

This section introduces the evolution from traditional software development to AI-assisted and agentic software development.

### 3.1 Traditional Software Development

Explain a conventional software development process through three major stages:

#### Planning

* Requirements
* Analysis
* Architecture/design
* Planning

#### Work Division

* Divide work among developers
* Assign responsibilities
* Coordinate implementation
* Manage dependencies

#### Implementation

* Developers inspect the codebase
* Implement features
* Run tests
* Debug
* Review and integrate changes

The presentation should visually demonstrate how work moves between humans, plans, developers, and code.

---

## 3.2 AI Basics

Introduce the basic mechanism behind modern generative AI.

### Token Generation

Explain that, at a fundamental level, an LLM generates the next tokens based on the context available to it.

The presentation should make this understandable visually rather than through a highly mathematical explanation.

### Stateless Sessions

Explain that a normal model interaction does not inherently mean the model permanently remembers another independent session.

Demonstrate the difference between:

```text id="1jlpmt"
Session A
   ↓
Context
   ↓
Response

Session B
   ↓
New context
   ↓
Response
```

and an application that adds persistence through external memory or stored state.

---

# 4. AI / Agentic Development Concepts

Create a dedicated section explaining the major concepts used in modern AI coding workflows.

Each concept should have a concise explanation and, where useful, an interactive or animated example.

---

## 4.1 Model Categories and Reasoning Effort

Introduce the idea that modern AI models can be thought of in **capability/effort categories**, using the Anthropic model family as an intuitive reference.

This is a **conceptual classification**, not a claim that models from different vendors are directly equivalent.

### Anthropic as the reference model family

Use the following conceptual model categories:

| Category                      | Anthropic reference | Typical role                                                         |
| ----------------------------- | ------------------- | -------------------------------------------------------------------- |
| **Fast / Lightweight**        | **Haiku**           | Fast responses, simple tasks, high-throughput work                   |
| **Balanced**                  | **Sonnet**          | General software development, analysis, agentic work                 |
| **Deep Reasoning / Frontier** | **Opus**            | Difficult reasoning, architecture, complex coding, long-horizon work |

Anthropic currently describes Haiku as optimized for speed/high throughput, Sonnet as a balance of intelligence and speed, and Opus as the higher-capability family for demanding reasoning and long-running agentic work.

### Reasoning Effort

Explain that model capability and **reasoning effort** are separate concepts.

A model may support different amounts of internal reasoning before producing the final answer.

Use a conceptual scale:

```text id="m9n3q4"
NONE
 │
 ▼
LOW
 │
 ▼
MEDIUM
 │
 ▼
HIGH
 │
 ▼
XHIGH / MAX
```

Higher effort generally means:

* more computation/thinking
* potentially better performance on difficult tasks
* higher latency
* potentially more reasoning tokens
* potentially higher token consumption

Anthropic's newer models use adaptive thinking, where reasoning depth depends on both the configured `effort` and task complexity. Anthropic specifically notes that higher effort can increase thinking tokens and latency.

### Important teaching point

Do **not** represent effort levels as a universal standard.

For example:

* One provider may support `none / low / medium / high / xhigh`.
* Another may support only `low / high / max`.
* Some reasoning models may not allow reasoning to be disabled.
* The same effort name does not guarantee the same amount of computation or tokens across providers.

Therefore, use effort as a **relative control within a model/provider**, not as a universal cross-model measurement.

---

## 4.2 OpenAI Model Categories

Show how OpenAI models can be placed into the same conceptual framework.

For example, the current GPT-5.6 family can be presented as:

| Conceptual category           | Example       | Role                                     |
| ----------------------------- | ------------- | ---------------------------------------- |
| **Fast / Cost-sensitive**     | GPT-5.6 Luna  | High-volume and cost-sensitive workloads |
| **Balanced**                  | GPT-5.6 Terra | Balance of capability and cost           |
| **Frontier / Deep reasoning** | GPT-5.6 Sol   | Complex professional work and coding     |

These models support configurable reasoning levels including `none`, `low`, `medium`, `high`, `xhigh`, and `max`.

The website should visually show that the **category is about workload selection**, not simply "bigger model = better."

---

## 4.3 SpaceXAI Model Categories

For SpaceXAI models, demonstrate the same concept using Grok.

For example:

| Model        | Reasoning effort                   |
| ------------ | ---------------------------------- |
| **Grok 4.3** | none / low / medium / high / xhigh |
| **Grok 4.5** | low / medium / high / xhigh        |

Grok 4.3 supports configurable reasoning from none through xhigh, while Grok 4.5 supports low through xhigh and defaults to high.

Use this to demonstrate an important difference:

```text id="u5f8r2"
Same provider
      +
Different model
      +
Different effort
      ↓
Different reasoning/cost/latency behavior
```

SpaceXAI also exposes `reasoning_tokens` in usage information for supported reasoning models.

---

## 4.4 Chinese Model Ecosystem

Show that the same reasoning/effort concept is also appearing across Chinese model providers.

Use current examples such as:

### DeepSeek

DeepSeek V4.1-Flash and V4-Pro support thinking and offer configurable effort such as:

```text
low
high
max
```

DeepSeek describes low as suitable for simpler tasks, high for daily agent workflows, and max for more complex tasks.

### Qwen

Use Qwen's reasoning models as an example of the same broader **thinking-model** category. Qwen describes Qwen3-Max-Thinking as a flagship reasoning model with additional test-time scaling and agent capabilities.

### Kimi

Kimi's current coding models support reasoning effort such as:

```text
low
high
max
```

with different models having different defaults. Kimi's coding documentation also exposes model-level effort configuration and sub-agent effort binding.

Present these models as **examples in the broader reasoning-model ecosystem**, not as exact equivalents of Anthropic's Haiku/Sonnet/Opus categories.

---

# 4.5 Reasoning Effort and Token Consumption

This subsection is important because users often assume:

> "Higher intelligence only means a better model."

Explain that **reasoning effort can also affect how many tokens are consumed**.

A simplified conceptual model is:

```text id="t6gk11"
Total Token Consumption
        │
        ├── Input tokens
        │     ├── system prompt
        │     ├── user request
        │     ├── context
        │     └── tool results
        │
        └── Output tokens
              ├── visible answer
              └── reasoning / thinking tokens
```

For providers that expose reasoning tokens, reasoning tokens are explicitly reflected in usage. DeepSeek, for example, exposes `reasoning_tokens` and defines total usage as input plus output, with reasoning tokens included in output usage.

### Effort → reasoning tokens

Illustrate the relationship conceptually:

| Effort          | Reasoning work                | Typical token impact    |
| --------------- | ----------------------------- | ----------------------- |
| **None**        | Minimal/no explicit reasoning | Lowest                  |
| **Low**         | Small reasoning budget/work   | Low                     |
| **Medium**      | More reasoning                | Moderate                |
| **High**        | Substantial reasoning         | Higher                  |
| **XHigh / Max** | Maximum/deeper reasoning      | Potentially much higher |

**Do not assign a fixed multiplier** such as "high = 3× tokens."

The actual number of reasoning tokens depends on:

* model
* task complexity
* context
* effort setting
* tool usage
* agent loop length
* model-specific reasoning behavior

Anthropic explicitly notes that higher effort can increase thinking tokens, while adaptive thinking also responds to task complexity.

---

## 4.6 Agentic Token Multiplication

Explain that **agentic systems consume tokens differently from a single prompt/response**.

A simple interaction:

```text id="k2pj1d"
User
 ↓
Model
 ↓
Answer
```

may consume:

```text
Input + Output
```

An agentic interaction can become:

```text id="n8v24q"
User
 ↓
Model
 ↓
Tool call
 ↓
Tool result
 ↓
Model
 ↓
Tool call
 ↓
Tool result
 ↓
Model
 ↓
Final answer
```

Now the system may repeatedly process:

* previous context
* new instructions
* tool results
* reasoning
* new actions

Therefore:

```text id="wzv9lc"
More agent steps
       +
More tool results
       +
More reasoning
       ↓
More total token usage
```

This is one reason why **agentic coding can use considerably more tokens than a simple chatbot interaction**, even when the final answer itself is short.

---

## 4.7 Context Window vs Usable Context

Connect token consumption with the context-window discussion.

A model may advertise a very large context window, but that does not mean every additional token is equally useful.

Explain:

```text id="y0b1e2"
Context Window
     │
     ├── Useful context
     │
     ├── Relevant but expensive context
     │
     └── Noisy / irrelevant context
                 ↓
         reduced efficiency
```

Avoid stating that a fixed number such as **120K tokens is universally usable**.

Instead explain that practical effective context depends on the model, task, information distribution, and agent workflow.

Anthropic's current documentation explicitly discusses context awareness, multi-window workflows, and the need to manage long-horizon context rather than assuming that a large context window alone solves the problem.

---

# 4.8 Model Selection as an Engineering Decision

Use the section to introduce the idea that model selection is an engineering trade-off.

The decision should consider:

```text id="b9vx2j"
Task complexity
      +
Required reasoning
      +
Latency
      +
Token consumption
      +
Cost
      +
Tool usage
      +
Context size
      +
Reliability
          ↓
      Model choice
```

Do not teach:

> "Always use the strongest model."

Instead teach:

> **Use the least expensive/simplest model that reliably solves the task, and increase reasoning/model capability when the task requires it.**

For agentic development, this may mean using different models or effort levels for different roles:

```text id="j17m4c"
Simple task
    ↓
Fast model / low effort

Implementation
    ↓
Balanced model / medium-high effort

Architecture / difficult debugging
    ↓
Deep reasoning model / high-max effort
```

---

## 4.9 Prompt

Explain how instructions are provided to an AI model and how prompt quality affects results.

---

## 4.10 Context Window

Explain:

* what a context window is
* why larger context does not automatically mean proportionally better results
* how irrelevant or excessive context can reduce effective performance

Use the distinction between **maximum available context** and **practically useful context**.

---

## 4.11 Agents

Explain how an agent differs from a simple prompt/response interaction.

Show the basic loop:

```text id="9hcyh8"
Goal
 ↓
Reason
 ↓
Use tools
 ↓
Observe result
 ↓
Reason again
 ↓
Continue
```

---

## 4.12 Sub-agents

Explain how an agent can delegate specialized work to other agents.

Example:

```text id="2eye8l"
Main Agent
 ├── Research Agent
 ├── Architecture Agent
 ├── Implementation Agent
 └── Testing Agent
```

Show why delegation can be useful for larger tasks.

---

## 4.13 Skills

Explain reusable procedural knowledge and workflows.

Use this project as a concrete example.

There will be a Skill named:

```text id="yikhoy"
grill-me-with-doc
```

Before starting a feature, this Skill is used to trigger a structured questioning process involving:

* grilling
* domain modeling
* requirement clarification

The website should show the actual Skill structure from the repository as an example.

---

## 4.14 Hooks

Explain how hooks can automatically trigger actions based on development events or tool execution.

Use simple examples and visual workflows.

---

## 4.15 Agentic Loop

Explain the repeated cycle of:

```text id="9texya"
Plan
→ Act
→ Observe
→ Evaluate
→ Correct
→ Continue
```

Show how this differs from simply asking an AI to generate code once.

---

## 4.16 Graph

Explain how an agentic workflow can be represented as a graph of states, decisions, dependencies, and transitions.

Where useful, visualize this instead of explaining it only with text.

---

## 4.17 Memory

Explain that an AI coding system can use external persistence to retain information beyond an individual model interaction.

The default approach may be a Markdown file, but Markdown-based memory has limitations.

Explain that memory can instead be backed by other systems such as:

* Jira
* GitHub Issues
* project management systems
* other persistent stores

For this project, **Beads** is used as an example of lightweight local task/memory management that:

* stays with the source repository
* can be committed to Git
* can be pushed with the project
* allows collaboration across developers

Show this as a practical example rather than presenting Markdown memory as the only possible solution.

---

## 4.18 Plugins

Explain how plugins extend the capabilities and workflows available to the coding agent.

Where possible, relate this to the actual plugins used in this project.

---

## 4.19 MCP

Explain the Model Context Protocol and demonstrate it through the frontend-development example.

The frontend section should contain a real MCP-based workflow rather than only a conceptual explanation.

---

# 5. Software Engineering Concepts in Agentic Development

This section connects established software engineering practices with AI-assisted development.

## Specification

Use **Spec Kit** as the concrete example.

Demonstrate how a project requirement can be turned into a structured specification before implementation begins.

Show the relationship:

```text id="ralahb"
Idea
 ↓
Specification
 ↓
Implementation
 ↓
Verification
```

## ADR — Architecture Decision Records

Use the `grill-me-with` workflow and domain-modeling process to record architectural decisions.

Explain:

* why decisions are recorded
* what problem the decision solves
* alternatives considered
* consequences of the decision

Show real ADR artifacts from the project where appropriate.

## TDD

Explain Test-Driven Development:

```text id="iz2y8k"
Write test
 ↓
Implement
 ↓
Run test
 ↓
Refactor
```

For the example project, demonstrate the use of different agents or delegated responsibilities for:

* test creation
* implementation
* verification

The purpose is to show how agentic development can support disciplined engineering practices rather than bypass them.

## Code Review

Explain that code review remains an important part of agentic development.

AI-generated code should still be reviewed for:

* correctness
* maintainability
* security
* architecture
* business requirements
* edge cases

Code review should be presented as an integral part of the development loop, not as an optional final step.

---

# 6. Backend Development Example

## Project

The backend example is a **generic Spring Boot file management library**.

The project is used to demonstrate agentic backend development from initial requirements through implementation and collaboration.

## Project Description

The original project description is stored at:

```text id="tf5358"
backendExample/ProjectDescription.txt
```

The coding agent should use this file as the source of truth for the backend example.

Do not invent project requirements that are not present in the source material.

---

## Development Evidence

Periodic screenshots are captured throughout development.

Screenshot filenames include timestamps so that the development process can be reconstructed chronologically.

The screenshots should be used as evidence of the actual development process.

### `firstComputer`

This directory contains screenshots from the computer where the project was initially developed.

### `secondComputer`

This directory contains screenshots from the computer where development was completed.

This setup intentionally demonstrates a collaboration scenario in which a different developer/computer continues work on the same project.

The presentation should use these screenshots to demonstrate:

* continuity of project context
* source-controlled development
* task handover
* collaboration between developers
* how another developer can continue an agentic workflow

Where useful, present screenshots as a timeline.

Example:

```text id="dii4xn"
Project Start
     ↓
Initial Development
     ↓
Feature Work
     ↓
Testing
     ↓
Second Developer
     ↓
Continuation
     ↓
Completion
```

---

# 7. Frontend Development Example

## Project

**This website is the frontend development example.**

The website is therefore both:

1. the presentation itself, and
2. a live demonstration of agentic frontend development.

The development process should be documented as part of the final material.

---

## Development Evidence

During frontend development, periodically capture screenshots of:

* Claude Code terminal/TUI
* browser state
* application UI
* important development milestones
* major iterations
* testing and validation

These screenshots should make it possible for someone reading the material later to understand how the website evolved.

Where appropriate, include a timeline:

```text id="prfyay"
Requirement
 ↓
Design Research
 ↓
Implementation
 ↓
Browser Testing
 ↓
Visual Review
 ↓
Iteration
 ↓
Final UI
```

---

# 8. Lazyweb MCP as a Design Research Example

A major goal of the frontend section is to demonstrate how AI can use external design knowledge instead of inventing generic UI.

Use **Lazyweb MCP** as a concrete example of design research.

The presentation should show how the agent can:

1. identify a UX/design problem
2. research real-world products
3. inspect existing UX patterns
4. compare alternatives
5. derive a design direction
6. implement the design
7. validate the result

The goal is explicitly to reduce generic, repetitive, AI-generated UI patterns.

Do not treat inspiration from a single product as a template to copy.

The preferred workflow is:

```text id="oc1s75"
Research multiple real products
        ↓
Identify patterns and differences
        ↓
Understand the UX rationale
        ↓
Create a differentiated design
        ↓
Implement
```

---

# 9. Playwright MCP as a Testing Example

Use **Playwright MCP** to demonstrate browser-based validation of the frontend.

The workflow should include:

```text id="r5wl1h"
Implement
   ↓
Run application
   ↓
Open in browser
   ↓
Interact
   ↓
Validate behavior
   ↓
Capture screenshot
   ↓
Review
   ↓
Improve
```

The presentation should make it clear that the agent does not simply generate frontend code and stop.

It can:

* run the application
* inspect the rendered UI
* interact with the browser
* validate behavior
* capture evidence
* iterate based on the result

---

# 10. Animation Requirements

JavaScript-driven browser animation is an important part of the project.

Animations should be used primarily to explain concepts and relationships.

Good uses include:

* process flows
* architecture diagrams
* agent loops
* state transitions
* before/after comparisons
* code-to-result transformations
* progressive disclosure
* timeline playback

Avoid animation that exists only for decoration.

The visual language should feel intentional and coherent.

---

# 11. Design Requirements

This is a technical presentation, but the website should also function as a **frontend design reference**.

Avoid generic "AI-generated" visual patterns such as:

* unnecessary gradients
* excessive glassmorphism
* repetitive rounded cards
* generic SaaS dashboards
* decorative statistics
* excessive shadows
* meaningless animations
* excessive icon usage
* visually repetitive layouts

The design should instead emphasize:

* strong hierarchy
* typography
* composition
* meaningful whitespace
* visual rhythm
* purposeful motion
* clear information architecture
* distinctive but consistent visual language

The implementation should favor a small number of well-designed visual patterns over a large number of generic components.

---

# 12. Source-of-Truth Principle

This website is documenting a **real development process**.

Therefore:

* do not fabricate development history
* do not claim tools were used when they were not
* do not invent screenshots
* do not invent project decisions
* do not invent backend requirements
* do not present fictional development results as real evidence

When demonstrating a concept that was not actually used in the project, clearly identify it as a conceptual example.

Real project artifacts should be distinguished from explanatory examples.

---

# 13. Expected Outcome

The finished website should allow someone to understand:

### AI fundamentals

```text id="g9py1q"
Token generation
Context
Sessions
Memory
```

### Model concepts

```text id="2uq9ax"
Model categories
Reasoning models
Effort levels
Reasoning tokens
Token consumption
Context efficiency
Model selection
```

### Agentic concepts

```text id="mue6p5"
Agents
Sub-agents
Skills
Hooks
Loops
Graphs
Plugins
MCP
```

### Software engineering practices

```text id="lzfx9w"
Specification
ADR
TDD
Testing
Code review
```

### Real agentic development

```text id="tx9prl"
Backend Example
       +
Frontend Example
       +
Development Evidence
       +
Interactive Demonstrations
```

The final result should feel like an **interactive technical workshop captured as a website**, rather than a website version of PowerPoint.

The implementation process itself should also become part of the teaching material, showing how Claude Code can be used to:

```text id="tfobix"
Understand
   ↓
Research
   ↓
Plan
   ↓
Design
   ↓
Implement
   ↓
Test
   ↓
Review
   ↓
Iterate
```

The website should therefore demonstrate the same agentic development principles that it teaches.

