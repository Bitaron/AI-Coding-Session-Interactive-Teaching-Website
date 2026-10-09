import { sections } from "./content/sections";
import type { Section } from "./content/types";
import { edition } from "./core/edition";
import { store, type Quality } from "./core/state";
import { Dial } from "./ui/dial";
import { anyDialogOpen, mountDialogs } from "./ui/dialogs";
import { mountHotspots } from "./ui/hotspots";
import { el, escapeHtml } from "./ui/markup";
import { Panel } from "./ui/panel";
import { go, path, startRouter } from "./ui/router";
import { mountSound } from "./ui/sound";

// Composition root. The engine (3D) and the overlay (DOM) only meet here
// and through the shared store in core/state.ts. Each edition's entry
// (src/v2/main.ts, src/v3/main.ts) sets the edition and hands in its engine.

/** What the shell needs from a 3D engine. */
export interface EngineLike {
  projectRegions(): { sectionId: string; x: number; y: number }[];
}

export type EngineClass = new (canvas: HTMLCanvasElement, sections: Section[]) => EngineLike;

export interface BootOptions {
  /** Loaded lazily, after the reading panel has painted. */
  loadEngine: () => Promise<EngineClass>;
  /** Extra class on the root, for edition-specific styles. */
  rootClass?: string;
}

export function boot({ loadEngine, rootClass }: BootOptions): void {
  const root = document.getElementById("app")!;
  root.className = rootClass ? `v2 ${rootClass}` : "v2";

  const canvas = el("canvas", "v2-canvas") as HTMLCanvasElement;
  canvas.setAttribute("aria-hidden", "true");
  const stage = el("div", "v2-stage");
  stage.append(canvas);

  const top = el("header", "v2-top");
  top.innerHTML = `
    <a class="v2-brand" data-route href="${path(null)}">${edition.brand}</a>
    <div class="v2-controls">
      <a class="v2-ctl" href="${import.meta.env.BASE_URL}" title="The original, page-by-page guide">v1</a>
      <button type="button" class="v2-ctl" data-ctl="quality" title="Rendering quality"></button>
      <button type="button" class="v2-ctl" data-ctl="sound" aria-pressed="false" title="Sound"></button>
    </div>`;

  const mapLabels = el("div", "v2-map-labels");
  mapLabels.innerHTML = sections
    .map((s) => `<a data-route data-region="${s.id}" href="${path({ sectionId: s.id, stepIndex: 0 })}">${escapeHtml(s.label)}</a>`)
    .join("");

  const panel = new Panel();
  const sheetHandle = el("button", "v2-sheet-handle", "<span></span>") as HTMLButtonElement;
  sheetHandle.type = "button";
  sheetHandle.setAttribute("aria-label", "Expand or collapse the reading panel");
  panel.root.prepend(sheetHandle);
  sheetHandle.addEventListener("click", () => panel.root.classList.toggle("expanded"));

  root.append(stage, mapLabels, top, panel.root);
  mountHotspots(root);
  const dial = new Dial(root);
  mountDialogs(root);
  mountSound();

  // --- controls ------------------------------------------------------------

  const qualityBtn = top.querySelector<HTMLButtonElement>('[data-ctl="quality"]')!;
  const soundBtn = top.querySelector<HTMLButtonElement>('[data-ctl="sound"]')!;
  const QUALITY_ORDER: Quality[] = ["auto", "high", "low"];
  const renderControls = () => {
    const { quality, sound, webgl } = store.get();
    qualityBtn.textContent = webgl ? `quality: ${quality}` : "static mode";
    qualityBtn.disabled = !webgl;
    soundBtn.textContent = sound ? "sound: on" : "sound: off";
    soundBtn.setAttribute("aria-pressed", String(sound));
  };
  // Quality and sound preferences are shared by every edition.
  qualityBtn.addEventListener("click", () => {
    const next = QUALITY_ORDER[(QUALITY_ORDER.indexOf(store.get().quality) + 1) % QUALITY_ORDER.length];
    localStorage.setItem("v2.quality", next);
    store.set({ quality: next });
  });
  soundBtn.addEventListener("click", () => {
    const sound = !store.get().sound;
    localStorage.setItem("v2.sound", sound ? "1" : "0");
    store.set({ sound });
  });
  store.subscribe(renderControls);
  renderControls();

  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => store.set({ reducedMotion: e.matches }));

  // --- layout inset: keep the 3D focus in the part of the screen the panel leaves free

  const wide = window.matchMedia("(min-width: 900px)");
  const updateInset = () => {
    const r = panel.root.getBoundingClientRect();
    store.set({
      inset: wide.matches ? { left: Math.round(r.right), bottom: 0 } : { left: 0, bottom: Math.round(window.innerHeight - r.top) },
    });
  };
  new ResizeObserver(updateInset).observe(panel.root);
  window.addEventListener("resize", updateInset);
  panel.root.addEventListener("transitionend", updateInset);

  // --- 3D engine, loaded lazily so text paints first --------------------------

  let engine: EngineLike | null = null;

  function goStatic(): void {
    store.set({ webgl: false });
    root.classList.add("v2-static");
    canvas.remove();
    mapLabels.innerHTML = "";
  }

  store.select((s) => s.webgl, (ok) => !ok && goStatic());

  async function startEngine(): Promise<void> {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!gl) return goStatic();
    try {
      const Engine = await loadEngine();
      engine = new Engine(canvas, sections);
      root.classList.add("v2-live");
    } catch (err) {
      console.warn(`${edition.slug}: falling back to static mode`, err);
      goStatic();
    }
  }

  // Region labels float over the map while it's in view.
  function placeMapLabels(): void {
    requestAnimationFrame(placeMapLabels);
    const onMap = !store.get().route;
    root.classList.toggle("v2-on-map", onMap);
    if (!engine || !onMap) return;
    for (const p of engine.projectRegions()) {
      const a = mapLabels.querySelector<HTMLElement>(`[data-region="${p.sectionId}"]`);
      if (a) a.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }

  // --- input ----------------------------------------------------------------

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      dial.wheel(e);
    },
    { passive: false }
  );

  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (anyDialogOpen() || t.matches("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") dial.toggleIndex(false);
    if (t.closest(".v2-dial-svg")) return; // the dial handles its own arrows
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === "j") dial.stepBy(1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "k") dial.stepBy(-1);
    else if (e.key === "m") go(null);
    else if (e.key === "i") dial.toggleIndex();
    else return;
    e.preventDefault();
  });

  if (import.meta.env.DEV) {
    void import("./content/audit").then(({ auditContent }) => {
      const problems = auditContent();
      if (problems.length) console.warn(`${edition.slug} content audit:\n${problems.join("\n")}`);
      else console.info(`${edition.slug} content audit: all terms resolve, all screenshots used`);
    });
  }

  startRouter();
  updateInset();
  placeMapLabels();
  void startEngine();
}
