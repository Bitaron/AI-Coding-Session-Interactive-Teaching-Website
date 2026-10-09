import { findSection, sections, totalSteps } from "../content/sections";
import { edition } from "../core/edition";
import { events, store, type Route } from "../core/state";
import { el, escapeHtml } from "./markup";
import { go, path } from "./router";

const SVG = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;
const GAP = 1.6; // tick-widths of empty arc between sections

interface Tick {
  route: Route;
  global: number;
  angle: number;
  line: SVGLineElement;
}

/** Shortest signed angular distance. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The orbital dial: every station in the guide is a tick on one ring, with
 * a gap between sections. The ring turns so the current station sits at
 * twelve o'clock. Drag it, flick it, or scroll over the scene: it carries
 * momentum, magnetically snaps to the nearest station and travels there.
 * Ticks near the pointer stretch toward it. Clicking the hub opens the index.
 */
export class Dial {
  readonly root = el("nav", "v2-dial");
  private svg = document.createElementNS(SVG, "svg");
  private ring = document.createElementNS(SVG, "g");
  private hub = el("button", "v2-dial-hub") as HTMLButtonElement;
  private index = el("div", "v2-index");
  private ticks: Tick[] = [];
  private angle = 0;
  private velocity = 0;
  private target = 0;
  private dragging = false;
  private settleTimer = 0;
  private raf = 0;
  private hover: { angle: number; near: boolean } | null = null;
  private lastTop = -1;
  private visited = new Set<number>(JSON.parse(localStorage.getItem(`${edition.slug}.visited`) ?? "[]"));
  private readonly R = 100;
  /** Where "current" sits: twelve o'clock on desktop, nine o'clock as an edge wheel on phones. */
  private orient = 0;
  private pointerMark = document.createElementNS(SVG, "path");
  private edge = window.matchMedia("(max-width: 899px)");

  constructor(host: HTMLElement) {
    this.root.setAttribute("aria-label", "Stations");
    this.svg.setAttribute("viewBox", "-130 -130 260 260");
    this.svg.setAttribute("class", "v2-dial-svg");
    this.svg.setAttribute("tabindex", "0");
    this.svg.setAttribute("role", "slider");
    this.svg.setAttribute("aria-label", "Station dial");
    this.svg.setAttribute("aria-valuemin", "1");
    this.svg.setAttribute("aria-valuemax", String(totalSteps));

    this.pointerMark.setAttribute("d", "M -6 -126 L 6 -126 L 0 -116 Z");
    this.pointerMark.setAttribute("class", "v2-dial-pointer");
    this.svg.append(this.ring, this.pointerMark);
    const orient = () => {
      this.orient = this.edge.matches ? -Math.PI / 2 : 0;
      this.pointerMark.setAttribute("transform", `rotate(${(this.orient * 180) / Math.PI})`);
      this.kick();
    };
    this.edge.addEventListener("change", orient);
    orient();
    this.buildTicks();

    this.hub.type = "button";
    this.hub.setAttribute("aria-expanded", "false");
    this.hub.setAttribute("aria-controls", "v2-index");
    this.hub.addEventListener("click", () => this.toggleIndex());

    this.index.id = "v2-index";
    this.index.hidden = true;
    this.buildIndex();

    this.root.append(this.svg, this.hub);
    host.append(this.root, this.index);

    this.bind();
    store.select((s) => s.route, (r) => this.onRoute(r));
    this.onRoute(store.get().route, true);
  }

  // --- structure -------------------------------------------------------------

  private buildTicks(): void {
    const slots = totalSteps + GAP * sections.length;
    const per = TAU / slots;
    let slot = GAP / 2;
    let global = 0;
    sections.forEach((section) => {
      const arcStart = slot * per;
      section.steps.forEach((_, i) => {
        const angle = slot * per;
        const line = document.createElementNS(SVG, "line");
        line.setAttribute("class", "v2-tick");
        this.ring.append(line);
        this.ticks.push({ route: { sectionId: section.id, stepIndex: i }, global: global++, angle, line });
        slot += 1;
      });
      // A faint arc under each section's ticks names the grouping.
      const arcEnd = (slot - 1) * per;
      const arc = document.createElementNS(SVG, "path");
      const r = this.R - 14;
      const p = (a: number) => `${Math.sin(a) * r} ${-Math.cos(a) * r}`;
      arc.setAttribute("d", `M ${p(arcStart)} A ${r} ${r} 0 ${arcEnd - arcStart > Math.PI ? 1 : 0} 1 ${p(arcEnd)}`);
      arc.setAttribute("class", "v2-dial-arc");
      arc.dataset.section = section.id;
      this.ring.prepend(arc);
      slot += GAP;
    });
  }

  private buildIndex(): void {
    this.index.setAttribute("role", "dialog");
    this.index.setAttribute("aria-label", "Index of stations");
    let n = 0;
    const cols = sections
      .map((s) => {
        const items = s.steps
          .map((st, i) => {
            n++;
            return `<li><a data-route href="${path({ sectionId: s.id, stepIndex: i })}"><span>${String(n).padStart(2, "0")}</span>${escapeHtml(st.title)}</a></li>`;
          })
          .join("");
        return `<section><h2>${escapeHtml(s.label)}</h2><ol>${items}</ol></section>`;
      })
      .join("");
    this.index.innerHTML = `<div class="v2-index-inner"><header><a data-route href="${path(null)}">The map</a><button type="button" data-close-index>Close</button></header><div class="v2-index-cols">${cols}</div></div>`;
    this.index.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-close-index]") || t.closest("a[data-route]") || t === this.index) this.toggleIndex(false);
    });
  }

  toggleIndex(open = this.index.hidden): void {
    this.index.hidden = !open;
    this.hub.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("v2-index-open", open);
    if (open) this.index.querySelector<HTMLElement>("a.current, a")?.focus();
  }

  // --- route sync ------------------------------------------------------------

  private tickFor(route: Route | null): Tick | undefined {
    return route ? this.ticks.find((t) => t.route.sectionId === route.sectionId && t.route.stepIndex === route.stepIndex) : undefined;
  }

  private onRoute(route: Route | null, immediate = false): void {
    const t = this.tickFor(route);
    if (t) {
      this.visited.add(t.global);
      localStorage.setItem(`${edition.slug}.visited`, JSON.stringify([...this.visited]));
      // Turn the short way round to bring this tick to twelve o'clock.
      this.target = this.angle + wrap(-t.angle - this.angle);
      if (immediate) this.angle = this.target;
    }
    this.index.querySelectorAll("a.current").forEach((a) => a.classList.remove("current"));
    if (route) this.index.querySelector(`a[href="${path(route)}"]`)?.classList.add("current");
    this.renderHub(route);
    this.root.classList.toggle("on-map", !route);
    this.kick();
  }

  private renderHub(route: Route | null, preview?: Route): void {
    const r = preview ?? route;
    if (!r) {
      this.hub.innerHTML = `<span class="v2-hub-sec">The map</span><span class="v2-hub-num">${totalSteps}</span><span class="v2-hub-title">stations · open index</span>`;
      this.svg.setAttribute("aria-valuenow", "0");
      this.svg.setAttribute("aria-valuetext", "Map");
      return;
    }
    const section = findSection(r.sectionId)!;
    const t = this.tickFor(r)!;
    this.hub.innerHTML = `<span class="v2-hub-sec">${escapeHtml(section.label)}</span><span class="v2-hub-num">${String(t.global + 1).padStart(2, "0")}</span><span class="v2-hub-title">${escapeHtml(section.steps[r.stepIndex].title)}</span>`;
    this.hub.classList.toggle("preview", Boolean(preview));
    this.svg.setAttribute("aria-valuenow", String(t.global + 1));
    this.svg.setAttribute("aria-valuetext", section.steps[r.stepIndex].title);
  }

  // --- interaction -----------------------------------------------------------

  private pointerAngle(e: PointerEvent | MouseEvent): { a: number; d: number } {
    const rect = this.svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 260 - 130;
    const y = ((e.clientY - rect.top) / rect.height) * 260 - 130;
    return { a: wrap(Math.atan2(x, -y) - this.orient), d: Math.hypot(x, y) };
  }

  /** The tick currently under the twelve o'clock pointer. */
  private topTick(angle = this.angle): Tick {
    let best = this.ticks[0];
    let bestD = Infinity;
    for (const t of this.ticks) {
      const d = Math.abs(wrap(t.angle + angle));
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private bind(): void {
    let lastA = 0;
    let lastT = 0;
    let moved = 0;
    this.svg.addEventListener("pointerdown", (e) => {
      const { a, d } = this.pointerAngle(e);
      if (d < 55) return;
      this.dragging = true;
      moved = 0;
      lastA = a;
      lastT = performance.now();
      this.velocity = 0;
      this.svg.setPointerCapture(e.pointerId);
      this.root.classList.add("dragging");
    });
    this.svg.addEventListener("pointermove", (e) => {
      const { a, d } = this.pointerAngle(e);
      this.hover = { angle: a, near: d > 70 && d < 135 };
      if (this.dragging) {
        const da = wrap(a - lastA);
        const now = performance.now();
        this.angle += da;
        this.target = this.angle;
        this.velocity = (da / Math.max(1, now - lastT)) * 1000;
        moved += Math.abs(da);
        lastA = a;
        lastT = now;
        this.preview();
      }
      this.kick();
    });
    const release = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.root.classList.remove("dragging");
      if (moved < 0.03) {
        // A tap on the ring: go to the tick under the finger.
        const { a } = this.pointerAngle(e);
        const t = this.nearestTo(a - this.angle);
        go(t.route);
        return;
      }
      // Momentum: coast on the release velocity, then snap.
      this.commit(this.angle + this.velocity * 0.22);
    };
    this.svg.addEventListener("pointerup", release);
    this.svg.addEventListener("pointercancel", release);
    this.svg.addEventListener("pointerleave", () => {
      this.hover = null;
      this.kick();
    });

    this.svg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") this.stepBy(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") this.stepBy(-1);
      else return;
      e.preventDefault();
    });
  }

  private nearestTo(ringAngle: number): Tick {
    let best = this.ticks[0];
    let bestD = Infinity;
    for (const t of this.ticks) {
      const d = Math.abs(wrap(t.angle - ringAngle));
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private wheelAcc = 0;
  private wheelBase: number | null = null;

  /**
   * Wheel or trackpad over the scene: velocity-sensitive travel. Deltas
   * accumulate from the dial's settled position (never a mid-spring angle);
   * about one mouse-wheel notch moves one station, a hard flick carries
   * several, and a nudge under the dead zone springs back without moving.
   */
  wheel(e: WheelEvent): void {
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const px = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * scale;
    if (this.wheelBase === null) {
      this.wheelBase = this.target;
      this.wheelAcc = 0;
    }
    this.wheelAcc += px;
    const per = TAU / (totalSteps + GAP * sections.length);
    this.angle = this.wheelBase - (this.wheelAcc / 110) * per;
    this.target = this.angle;
    this.preview();
    this.kick();
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      const base = this.wheelBase!;
      const moved = Math.abs(this.wheelAcc) >= 40;
      this.wheelBase = null;
      if (moved) this.commit(this.angle);
      else {
        this.target = base;
        this.renderHub(store.get().route);
        this.kick();
      }
    }, 170);
  }

  stepBy(delta: number): void {
    const cur = this.tickFor(store.get().route);
    const next = cur ? this.ticks[Math.max(0, Math.min(this.ticks.length - 1, cur.global + delta))] : this.ticks[0];
    go(next.route);
  }

  private commit(angle: number): void {
    const t = this.topTick(angle);
    this.renderHub(store.get().route);
    const cur = store.get().route;
    if (!cur || cur.sectionId !== t.route.sectionId || cur.stepIndex !== t.route.stepIndex) go(t.route);
    else {
      this.target = this.angle + wrap(-t.angle - this.angle);
      this.kick();
    }
  }

  private preview(): void {
    const t = this.topTick();
    if (t.global !== this.lastTop) {
      this.lastTop = t.global;
      events.emit("tick", { strength: Math.min(1, Math.abs(this.velocity) / 8) });
      this.renderHub(store.get().route, t.route);
    }
  }

  // --- animation -------------------------------------------------------------

  private kick(): void {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (): void => {
    this.raf = 0;
    if (!this.dragging) {
      // Critically-damped spring toward the target angle.
      const k = store.get().reducedMotion ? 1 : 0.16;
      this.angle += (this.target - this.angle) * k;
    }
    this.draw();
    const moving = Math.abs(this.target - this.angle) > 0.0005 || this.dragging || this.hover;
    if (moving) this.kick();
  };

  private draw(): void {
    this.ring.setAttribute("transform", `rotate(${((this.angle + this.orient) * 180) / Math.PI})`);
    const current = this.tickFor(store.get().route);
    for (const t of this.ticks) {
      let len = 9;
      if (this.hover?.near) {
        // Magnetic proximity: ticks near the pointer stretch toward it.
        const d = wrap(t.angle + this.angle - this.hover.angle);
        len += 13 * Math.exp(-(d * d) / 0.02);
      }
      const isCur = t === current;
      if (isCur) len = 22;
      const r0 = this.R - 4;
      const r1 = r0 + len;
      t.line.setAttribute("x1", String(Math.sin(t.angle) * r0));
      t.line.setAttribute("y1", String(-Math.cos(t.angle) * r0));
      t.line.setAttribute("x2", String(Math.sin(t.angle) * r1));
      t.line.setAttribute("y2", String(-Math.cos(t.angle) * r1));
      t.line.classList.toggle("current", isCur);
      t.line.classList.toggle("visited", this.visited.has(t.global) && !isCur);
    }
  }
}
