import "./style.css";
import { sections, findSection, nextSection } from "./sections";
import { onRouteChange, navigate, routePath, type Route } from "./router";
import { initImageModal, closeImageModal } from "./image-modal";
import { EDITIONS } from "./editions";

initImageModal();

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="shell" id="shell">
    <nav class="editions" aria-label="Editions">${EDITIONS.map((e) =>
      e.slug === "v1"
        ? `<span aria-current="page" title="${e.title} (you are here)">${e.slug}</span>`
        : `<a href="${e.href}" title="${e.title}">${e.slug}</a>`
    ).join("")}</nav>
    <aside class="sidebar">
      <button class="toggle" id="toggle" aria-label="Expand navigation">☰</button>
      <div class="dot-rail" id="dotRail"></div>
      <nav class="nav" id="nav">
        <div class="site-label">AI Coding Session</div>
        <div id="navSections"></div>
      </nav>
    </aside>
    <main class="main">
      <div class="frame" id="frame">
        <div class="panel" id="panel">
          <div class="title-card">
            <div class="ghost-num" id="ghostNum"></div>
            <div class="meta" id="meta"></div>
            <h1 id="heading"></h1>
          </div>
          <div class="content" id="content"></div>
          <div class="step-nav">
            <button id="prevStep">← Prev</button>
            <button id="nextStep">Next →</button>
          </div>
        </div>
      </div>
      <footer class="site-footer">
        <span>AI Coding Session — teaching material, not a product</span>
        <span class="site-footer-links">
          Also as:
          ${EDITIONS.filter((e) => e.slug !== "v1")
            .map((e) => `<a href="${e.href}" title="${e.title}">${e.slug} · ${e.name}</a>`)
            .join("")}
        </span>
        <span class="site-footer-links">
          <a href="https://github.com/Bitaron/agentic-coding-guide" target="_blank" rel="noopener">Source</a>
          <a href="https://github.com/Bitaron/agentic-coding-guide/issues" target="_blank" rel="noopener">Report an issue</a>
        </span>
      </footer>
    </main>
  </div>
`;

const shell = document.getElementById("shell")!;
const toggle = document.getElementById("toggle")!;
const dotRail = document.getElementById("dotRail")!;
const navSections = document.getElementById("navSections")!;
const frame = document.getElementById("frame")!;
const panel = document.getElementById("panel")!;
const ghostNum = document.getElementById("ghostNum")!;
const meta = document.getElementById("meta")!;
const heading = document.getElementById("heading")!;
const content = document.getElementById("content")!;
const prevStep = document.getElementById("prevStep") as HTMLButtonElement;
const nextStep = document.getElementById("nextStep") as HTMLButtonElement;

toggle.addEventListener("click", () => {
  const expanding = !shell.classList.contains("expanded");
  shell.classList.toggle("expanded");
  toggle.textContent = expanding ? "×" : "☰";
  toggle.setAttribute(
    "aria-label",
    expanding ? "Collapse navigation" : "Expand navigation"
  );
});

// On phone widths the expanded nav is a full-screen overlay (see the
// max-width:640px rule in style.css), so picking a step should close it —
// on desktop it stays open as a persistent panel, per docs/design-brief.md.
navSections.addEventListener("click", (event) => {
  const toggleSectionId = (
    event.target as HTMLElement
  ).closest<HTMLButtonElement>("[data-toggle-section]")?.dataset.toggleSection;
  if (toggleSectionId) {
    if (expandedSections.has(toggleSectionId)) {
      expandedSections.delete(toggleSectionId);
    } else {
      expandedSections.add(toggleSectionId);
    }
    renderNav(activeRoute);
    return;
  }

  const isStepLink = (event.target as HTMLElement).closest("a[data-route]");
  if (isStepLink && window.matchMedia("(max-width: 640px)").matches) {
    shell.classList.remove("expanded");
    toggle.textContent = "☰";
    toggle.setAttribute("aria-label", "Expand navigation");
  }
});

function link(route: Route, label: string, className: string): string {
  return `<a class="${className}" data-route href="${routePath(route)}">${label}</a>`;
}

function renderDotRail(route: Route): void {
  const section = findSection(route.sectionId)!;
  dotRail.innerHTML = section.steps
    .map((_, i) => {
      const state =
        i === route.stepIndex ? "current" : i < route.stepIndex ? "done" : "";
      const target: Route = { sectionId: section.id, stepIndex: i };
      return `<a class="dot ${state}" data-route href="${routePath(
        target
      )}" aria-label="${section.label} step ${i + 1}"></a>`;
    })
    .join("");
}

// Section step-lists beyond the current section stay collapsed by default;
// toggling one open is independent of navigation, so browsing another
// section's steps doesn't move you off your current step.
const expandedSections = new Set<string>();

function renderNav(route: Route): void {
  navSections.innerHTML = sections
    .map((section) => {
      const isCurrent = section.id === route.sectionId;
      const isOpen = isCurrent || expandedSections.has(section.id);
      const heading = link(
        { sectionId: section.id, stepIndex: 0 },
        `${section.label} <span class="n">${
          isCurrent ? `${route.stepIndex + 1}/${section.steps.length}` : "→"
        }</span>`,
        "section-heading"
      );
      const toggleButton = isCurrent
        ? ""
        : `<button type="button" class="section-toggle" data-toggle-section="${
            section.id
          }" aria-expanded="${isOpen}" aria-label="${
            isOpen ? "Collapse" : "Expand"
          } ${section.label} steps">${isOpen ? "▴" : "▾"}</button>`;
      const steps = isOpen
        ? `<div class="steps">${section.steps
            .map((step, i) =>
              link(
                { sectionId: section.id, stepIndex: i },
                step.title,
                `step${i === route.stepIndex ? " current" : ""}`
              )
            )
            .join("")}</div>`
        : "";
      return `<div class="section${isCurrent ? " current" : ""}"><div class="section-row">${heading}${toggleButton}</div>${steps}</div>`;
    })
    .join("");
}

let activeStepCleanup: (() => void) | undefined;

function renderStep(route: Route): void {
  window.scrollTo(0, 0);
  closeImageModal();
  activeStepCleanup?.();
  activeStepCleanup = undefined;

  const section = findSection(route.sectionId)!;
  const step = section.steps[route.stepIndex];

  ghostNum.textContent = String(route.stepIndex + 1).padStart(2, "0");
  meta.textContent = `${section.label} · Step ${route.stepIndex + 1} of ${
    section.steps.length
  }`;
  heading.textContent = step.title;
  content.classList.toggle("wide", Boolean(step.wide));
  content.innerHTML = "";

  if (step.mount) {
    activeStepCleanup = step.mount(content) ?? undefined;
  } else if (step.body) {
    content.innerHTML = `<p>${step.body}</p>`;
  }

  const onLastStep = route.stepIndex === section.steps.length - 1;
  const upcomingSection = onLastStep ? nextSection(route.sectionId) : undefined;

  prevStep.disabled = route.stepIndex === 0;
  nextStep.disabled = onLastStep && !upcomingSection;
  nextStep.textContent = upcomingSection
    ? `Next: ${upcomingSection.label} →`
    : "Next →";
}

let activeRoute: Route;

function render(route: Route): void {
  activeRoute = route;
  renderDotRail(route);
  renderNav(route);
  renderStep(route);

  document.title = `${findSection(route.sectionId)!.label} — AI Coding Session`;
}

// Step transition: the frame and the step content scale together, on the
// same ratio/timing, with no opacity fade — variant J from
// prototype/transitions-round2.html. Communicates "this step is becoming
// the next", not a crossfade swap. See docs/design-brief.md.
const TRANSITION_MS = 450;

function transitionTo(route: Route): void {
  frame.classList.add("pulsing-strong");
  panel.classList.add("scale-together", "scale-together-out");

  window.setTimeout(() => {
    render(route);
    panel.classList.remove("scale-together-out");
    panel.classList.add("scale-together-in-start");

    requestAnimationFrame(() => {
      panel.classList.remove("scale-together-in-start");
    });
  }, TRANSITION_MS / 2);

  window.setTimeout(() => {
    frame.classList.remove("pulsing-strong");
    panel.classList.remove("scale-together");
  }, TRANSITION_MS);
}

let hasRenderedOnce = false;

onRouteChange((route) => {
  if (!hasRenderedOnce) {
    render(route);
    hasRenderedOnce = true;
    return;
  }
  transitionTo(route);
});

function goTo(route: Route): void {
  navigate(route);
  transitionTo(route);
}

prevStep.addEventListener("click", () => {
  goTo({ sectionId: activeRoute.sectionId, stepIndex: activeRoute.stepIndex - 1 });
});

nextStep.addEventListener("click", () => {
  const section = findSection(activeRoute.sectionId)!;
  if (activeRoute.stepIndex < section.steps.length - 1) {
    goTo({ sectionId: activeRoute.sectionId, stepIndex: activeRoute.stepIndex + 1 });
    return;
  }

  const upcomingSection = nextSection(activeRoute.sectionId);
  if (upcomingSection) {
    goTo({ sectionId: upcomingSection.id, stepIndex: 0 });
  }
});
