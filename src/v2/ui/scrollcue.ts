/**
 * "There's more" cues for anything that scrolls. Content that runs past the
 * edge of a box looks finished unless something says otherwise, so:
 *  - vertical scrollers get a fade and a "more ↓" chip pinned to their
 *    bottom edge until the reader reaches the end (the chip scrolls on);
 *  - horizontal strips get ← → buttons and fades at whichever side hides
 *    something.
 * Cues follow content changes (a replay adding lines) and resizes.
 */

const SLACK = 6;

function watch(el: HTMLElement, update: () => void): void {
  el.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(update).observe(el);
  new MutationObserver(update).observe(el, { childList: true, subtree: true, characterData: true });
  requestAnimationFrame(update);
}

/** Pins a "more ↓" cue to the bottom of a vertical scroller. */
export function scrollCue(scroller: HTMLElement, text = "more"): void {
  const tag = scroller.tagName === "OL" || scroller.tagName === "UL" ? "li" : "div";
  const cue = document.createElement(tag);
  cue.className = "v2-more";
  cue.setAttribute("aria-hidden", "true");
  const chip = document.createElement("button");
  chip.type = "button";
  chip.tabIndex = -1;
  chip.textContent = `${text} ↓`;
  chip.addEventListener("click", () => scroller.scrollBy({ top: scroller.clientHeight * 0.8, behavior: "smooth" }));
  cue.append(chip);
  scroller.append(cue);
  watch(scroller, () => {
    // Keep the cue last as content is added after it.
    if (scroller.lastElementChild !== cue) scroller.append(cue);
    const more = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - SLACK;
    scroller.classList.toggle("has-more", more);
  });
}

/** Adds ← → buttons (placed in `controls`) and edge fades to a horizontal strip. */
export function stripCue(strip: HTMLElement, frame: HTMLElement, controls: HTMLElement): void {
  const mk = (dir: -1 | 1) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "v2-strip-nav";
    b.textContent = dir < 0 ? "←" : "→";
    b.setAttribute("aria-label", dir < 0 ? "Earlier screenshots" : "Later screenshots");
    b.addEventListener("click", () => strip.scrollBy({ left: dir * strip.clientWidth * 0.8, behavior: "smooth" }));
    controls.append(b);
    return b;
  };
  const prev = mk(-1);
  const next = mk(1);
  watch(strip, () => {
    const start = strip.scrollLeft > SLACK;
    const end = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - SLACK;
    frame.classList.toggle("more-start", start);
    frame.classList.toggle("more-end", end);
    prev.disabled = !start;
    next.disabled = !end;
    controls.hidden = !start && !end;
  });
}
