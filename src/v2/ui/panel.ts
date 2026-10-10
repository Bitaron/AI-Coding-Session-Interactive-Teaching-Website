import { EDITIONS } from "../../editions";
import { findSection, globalIndex, sections, totalSteps } from "../content/sections";
import type { Section, Step } from "../content/types";
import { edition } from "../core/edition";
import { events, setParam, store, type Params, type Route } from "../core/state";
import { openShot } from "./dialogs";
import { el, escapeHtml, rich } from "./markup";
import { Replay } from "./replay";
import { scrollCue, stripCue } from "./scrollcue";
import { path, step as stepRoute } from "./router";

const EFFORT_NAMES = ["none", "low", "medium", "high", "xhigh", "max"];

const KNOBS: Record<keyof Params, { label: string; min: number; max: number; step: number; show: (v: number) => string; term: string }> = {
  temperature: { label: "Temperature", min: 0, max: 1.5, step: 0.05, show: (v) => v.toFixed(2), term: "temperature" },
  contextFill: { label: "Context fill", min: 0, max: 1, step: 0.01, show: (v) => `${Math.round(v * 100)}%`, term: "context-window" },
  loopSteps: { label: "Loop steps", min: 1, max: 12, step: 1, show: (v) => String(v), term: "agent-loop" },
  effort: { label: "Reasoning effort", min: 0, max: 5, step: 1, show: (v) => EFFORT_NAMES[v] ?? String(v), term: "reasoning-effort" },
};

/**
 * The reading panel. Content swaps the moment the route changes (so text is
 * never held hostage by a camera flight); the replay starts when the camera
 * lands, so the scene and the transcript begin together.
 */
export class Panel {
  readonly root = el("aside", "v2-panel");
  private body = el("div", "v2-panel-body");
  private replay: Replay | null = null;
  private renderToken = 0;

  constructor() {
    this.root.setAttribute("aria-live", "polite");
    this.root.append(this.body);
    scrollCue(this.root);
    store.select((s) => s.route, (r) => this.render(r));
    window.addEventListener("resize", () => this.fitTitle());
    events.on("arrived", (r) => {
      if (r && this.replay && store.get().route === r) this.replay.play();
      this.root.classList.add("arrived");
    });
    this.render(store.get().route);
  }

  private render(route: Route | null): void {
    const token = ++this.renderToken;
    this.replay?.dispose();
    this.replay = null;
    this.root.classList.remove("arrived");
    this.body.classList.add("leaving");
    const swap = () => {
      if (token !== this.renderToken) return;
      this.body.innerHTML = "";
      this.body.scrollTop = 0;
      this.root.scrollTop = 0;
      if (!route) this.renderMap();
      else this.renderStep(findSection(route.sectionId)!, route);
      this.fitTitle();
      this.body.classList.remove("leaving");
    };
    if (store.get().reducedMotion || !this.body.childElementCount) swap();
    else window.setTimeout(swap, 170);
  }

  /**
   * A long word in a title ("recommendations,", set in capitals in v3) can
   * be wider than the column. Shrink the title until its widest word fits,
   * so nothing is cut off or pushes the panel sideways.
   */
  private fitTitle(): void {
    const h = this.body.querySelector<HTMLElement>(".v2-title");
    if (!h) return;
    h.style.fontSize = "";
    h.style.overflowWrap = "";
    let size = Math.ceil(parseFloat(getComputedStyle(h).fontSize));
    while (h.scrollWidth > h.clientWidth + 1 && size > 18) h.style.fontSize = `${(size -= 1)}px`;
    if (h.scrollWidth > h.clientWidth + 1) h.style.overflowWrap = "anywhere";
  }

  private renderMap(): void {
    const b = this.body;
    b.append(
      el("p", "v2-kicker", escapeHtml(edition.kicker)),
      el("h1", "v2-title", edition.title),
      el("p", "v2-lede", rich(edition.lede))
    );
    const list = el("ol", "v2-map-list");
    sections.forEach((s) => {
      const li = el("li");
      li.innerHTML = `<a data-route href="${path({ sectionId: s.id, stepIndex: 0 })}">
          <span class="v2-map-name">${escapeHtml(s.label)}</span>
          <span class="v2-map-count">${s.steps.length} stations</span>
          <span class="v2-map-blurb">${escapeHtml(s.blurb)}</span>
        </a>`;
      list.append(li);
    });
    b.append(list);
    const how = el(
      "p",
      "v2-how",
      "Scroll or drag the dial to travel · ← → keys step · <kbd>M</kbd> map · drag the scene to look around"
    );
    b.append(how);
    const others = EDITIONS.filter((e) => e.slug !== edition.slug)
      .map((e) => `<a href="${e.href}" title="${escapeHtml(e.title)}">${e.slug} · ${e.name}</a>`)
      .join(" or ");
    b.append(el("p", "v2-legacy", `The same material, another way in: ${others}.`));
  }

  private renderStep(section: Section, route: Route): void {
    const s: Step = section.steps[route.stepIndex];
    const b = this.body;
    const n = globalIndex(section.id, route.stepIndex) + 1;
    b.append(
      el(
        "p",
        "v2-kicker",
        `<a data-route href="${path(null)}">Map</a> / ${escapeHtml(section.label)} · ${route.stepIndex + 1} of ${section.steps.length}`
      )
    );
    const titleRow = el("div", "v2-title-row");
    titleRow.append(el("span", "v2-station", String(n).padStart(2, "0")), el("h1", "v2-title", escapeHtml(s.title)));
    b.append(titleRow, el("p", "v2-lede", rich(s.lede)));

    if (s.table) {
      const [head, ...rows] = s.table;
      const t = el("table", "v2-table");
      t.innerHTML = `<thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      b.append(t);
    }
    if (s.points?.length) {
      const ul = el("ul", "v2-points");
      s.points.forEach((p) => ul.append(el("li", undefined, rich(p))));
      b.append(ul);
    }

    const scene = el("figure", "v2-scene-note");
    scene.innerHTML = `<figcaption><span class="v2-scene-tag">In the scene</span>${rich(s.sceneCaption)}</figcaption>`;
    if (s.knobs?.length) scene.append(this.knobs(s.knobs));
    b.append(scene);

    if (s.replay) {
      this.replay = new Replay(s.replay.title, s.replay.lines);
      b.append(this.replay.root);
    }

    if (s.evidence?.length) {
      const ev = el("section", "v2-evidence");
      const head = el("h2", "v2-evidence-head", `The real screenshots <span>${s.evidence.length}</span>`);
      const navs = el("span", "v2-strip-navs");
      head.append(navs);
      ev.append(head);
      const strip = el("div", "v2-strip");
      s.evidence.forEach((shot, i) => {
        const btn = el("button", "v2-thumb") as HTMLButtonElement;
        btn.type = "button";
        btn.innerHTML = `<img src="${shot.src}" alt="${escapeHtml(shot.alt)}" loading="lazy" decoding="async" /><span>${escapeHtml(shot.label)}</span>`;
        btn.addEventListener("click", () => openShot(s.evidence!, i));
        // Lets a scene point at the part this screenshot stands for.
        const point = (index: number) => () => events.emit("evidence", { index });
        btn.addEventListener("pointerenter", point(i));
        btn.addEventListener("focus", point(i));
        btn.addEventListener("pointerleave", point(-1));
        btn.addEventListener("blur", point(-1));
        strip.append(btn);
      });
      ev.append(strip);
      b.append(ev);
      stripCue(strip, ev, navs);
    }

    const nav = el("nav", "v2-stepnav");
    const prev = stepRoute(route, -1);
    const next = stepRoute(route, 1);
    const isLast = n === totalSteps;
    nav.innerHTML = `
      ${prev ? `<a data-route href="${path(prev)}" rel="prev">← ${escapeHtml(this.titleOf(prev))}</a>` : `<a data-route href="${path(null)}">← Map</a>`}
      ${isLast ? `<a data-route href="${path(null)}">Back to the map →</a>` : next ? `<a data-route href="${path(next)}" rel="next">${escapeHtml(this.titleOf(next))} →</a>` : ""}`;
    b.append(nav);
  }

  private titleOf(r: Route): string {
    return findSection(r.sectionId)!.steps[r.stepIndex].title;
  }

  private knobs(keys: (keyof Params)[]): HTMLElement {
    const wrap = el("div", "v2-knobs");
    for (const key of keys) {
      const k = KNOBS[key];
      const row = el("div", "v2-knob");
      const value = el("output", "v2-knob-value", k.show(store.get().params[key]));
      const input = el("input") as HTMLInputElement;
      input.type = "range";
      input.min = String(k.min);
      input.max = String(k.max);
      input.step = String(k.step);
      input.value = String(store.get().params[key]);
      input.setAttribute("aria-label", k.label);
      input.addEventListener("input", () => {
        const v = Number(input.value);
        setParam(key, v);
        value.textContent = k.show(v);
      });
      row.append(el("span", "v2-knob-label", `<button type="button" class="term quiet" data-term="${k.term}">${k.label}</button>`), input, value);
      wrap.append(row);
    }
    return wrap;
  }
}
