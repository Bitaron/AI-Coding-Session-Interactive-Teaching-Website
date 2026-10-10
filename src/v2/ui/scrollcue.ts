/**
 * "There's more" cues for anything that scrolls. Content that runs past the
 * edge of a box looks finished unless something says otherwise, so:
 *  - vertical scrollers get a fade and a "more ↓" chip pinned to their
 *    bottom edge until the reader reaches the end (the chip scrolls on);
 *  - they also get an always-visible scroll rail;
 *  - horizontal strips get ← → buttons and fades at whichever side hides
 *    something.
 * Cues follow content changes (a replay adding lines) and resizes.
 */

const SLACK = 6;

function watch(el: HTMLElement, update: () => void): void {
  el.addEventListener("scroll", update, { passive: true });
  // Entrance animations shift content (and the scroll extent) without resizing anything.
  el.addEventListener("animationend", update);
  el.addEventListener("transitionend", update);
  // The box and its children: content can grow without a DOM change (an image loads).
  const sizes = new ResizeObserver(update);
  const observe = () => [el, ...el.children].forEach((c) => sizes.observe(c));
  observe();
  new MutationObserver(() => {
    observe();
    update();
  }).observe(el, { childList: true, subtree: true, characterData: true });
  requestAnimationFrame(update);
}

/**
 * Our own scrollbar: overlay scrollbars (GNOME, macOS, phones) hide until
 * you scroll, so a box that runs on can look finished. The rail is always
 * drawn while there is more than fits, and it drags and pages like a
 * native one.
 */
function scrollRail(scroller: HTMLElement, tag: string): () => void {
  const rail = document.createElement(tag);
  rail.className = "v2-rail";
  rail.setAttribute("aria-hidden", "true");
  const thumb = document.createElement("span");
  rail.append(thumb);
  scroller.prepend(rail);
  scroller.classList.add("v2-railed");

  // Clicking the track pages toward the click; dragging the thumb scrolls 1:1.
  rail.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (e.target !== thumb) {
      const dir = e.clientY > thumb.getBoundingClientRect().top ? 1 : -1;
      scroller.scrollBy({ top: dir * scroller.clientHeight * 0.85, behavior: "smooth" });
      return;
    }
    const y0 = e.clientY;
    const top0 = scroller.scrollTop;
    const ratio = scroller.scrollHeight / scroller.clientHeight;
    const move = (m: PointerEvent) => (scroller.scrollTop = top0 + (m.clientY - y0) * ratio);
    const up = () => {
      thumb.classList.remove("dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    thumb.classList.add("dragging");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });

  return () => {
    if (scroller.firstElementChild !== rail) scroller.prepend(rail);
    const { scrollTop, scrollHeight, clientHeight } = scroller;
    const over = scrollHeight > clientHeight + 1;
    scroller.classList.toggle("has-rail", over);
    if (!over) return;
    const h = Math.max(28, (clientHeight * clientHeight) / scrollHeight);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - h);
    rail.style.setProperty("--rail-h", `${clientHeight}px`);
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translateY(${top}px)`;
  };
}

/** Pins a "more ↓" cue to the bottom of a vertical scroller, plus a visible rail. */
export function scrollCue(scroller: HTMLElement, text = "more"): void {
  const tag = scroller.tagName === "OL" || scroller.tagName === "UL" ? "li" : "div";
  const rail = scrollRail(scroller, tag);
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
    rail();
    // "More" means more to read: the blank space kept at the end doesn't count.
    const last = cue.previousElementSibling as HTMLElement | null;
    let more = false;
    if (last && !last.classList.contains("v2-rail")) {
      const end = last.getBoundingClientRect().bottom - parseFloat(getComputedStyle(last).paddingBottom);
      more = end > scroller.getBoundingClientRect().bottom - SLACK;
    }
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
