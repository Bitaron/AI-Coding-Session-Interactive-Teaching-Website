import { events, store, type HotspotScreen } from "../core/state";
import { el, escapeHtml } from "./markup";

/**
 * Term hotspots pinned to parts of the 3D scene. The engine projects each
 * anchor to screen space; this layer only places buttons there, so the
 * deep-dive links live in the DOM (focusable, readable by screen readers)
 * rather than inside the canvas.
 */
export function mountHotspots(host: HTMLElement): void {
  const layer = el("div", "v2-hotspots");
  layer.setAttribute("aria-label", "Terms in the scene");
  host.append(layer);
  const pool = new Map<string, HTMLButtonElement>();

  events.on("hotspots", (spots: HotspotScreen[]) => {
    const seen = new Set<string>();
    for (const s of spots) {
      seen.add(s.term);
      let b = pool.get(s.term);
      if (!b) {
        b = el("button", "v2-hotspot") as HTMLButtonElement;
        b.type = "button";
        b.dataset.term = s.term;
        b.innerHTML = `<i aria-hidden="true"></i><span>${escapeHtml(s.label)}</span>`;
        layer.append(b);
        pool.set(s.term, b);
      }
      b.style.transform = `translate(${s.x}px, ${s.y}px)`;
      // Near the right edge the label hangs to the left of its pin instead.
      b.classList.toggle("flip", s.x > window.innerWidth - 200);
      b.classList.toggle("off", !s.visible);
    }
    for (const [term, b] of pool) {
      if (!seen.has(term)) {
        b.remove();
        pool.delete(term);
      }
    }
  });

  // Hide while travelling so labels don't smear across the flight.
  store.select((s) => s.travelling, (t) => layer.classList.toggle("travelling", t));
}
