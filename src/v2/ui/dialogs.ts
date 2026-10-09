import { glossary } from "../content/glossary";
import type { Evidence } from "../content/types";
import { el, escapeHtml } from "./markup";

/**
 * Two modal layers built on <dialog>: the deep-dive term card and the
 * evidence lightbox. Native dialogs give focus trapping, Esc-to-close and
 * an inert background for free.
 */

const termDialog = el("dialog", "v2-term");
const shotDialog = el("dialog", "v2-shot");

export function mountDialogs(root: HTMLElement): void {
  root.append(termDialog, shotDialog);
  for (const d of [termDialog, shotDialog]) {
    // Click on the backdrop (the dialog box itself, not its content) closes.
    d.addEventListener("click", (e) => {
      if (e.target === d || (e.target as HTMLElement).closest("[data-close]")) d.close();
    });
  }
  // Any term button anywhere — panel copy, replay, 3D hotspot — opens its card.
  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-term]");
    if (btn) openTerm(btn.dataset.term!);
  });
}

export function openTerm(id: string): void {
  const entry = glossary.get(id);
  if (!entry) return;
  termDialog.innerHTML = `
    <article>
      <header>
        <span class="v2-kicker">Deep dive</span>
        <h2>${escapeHtml(entry.term)}</h2>
      </header>
      <p class="v2-term-def">${escapeHtml(entry.definition)}</p>
      ${entry.why ? `<p class="v2-term-why"><span>Why it matters</span>${escapeHtml(entry.why)}</p>` : ""}
      <ul class="v2-term-links">
        ${entry.links
          .map((l) => `<li><a href="${l.url}" target="_blank" rel="noopener">${escapeHtml(l.label)}<span aria-hidden="true"> ↗</span></a></li>`)
          .join("")}
      </ul>
      <button type="button" class="v2-close" data-close aria-label="Close">Close</button>
    </article>`;
  if (!termDialog.open) termDialog.showModal();
}

let gallery: Evidence[] = [];
let index = 0;

export function openShot(list: Evidence[], i: number): void {
  gallery = list;
  index = i;
  renderShot();
  if (!shotDialog.open) shotDialog.showModal();
}

function renderShot(): void {
  const s = gallery[index];
  shotDialog.innerHTML = `
    <figure>
      <img src="${s.src}" alt="${escapeHtml(s.alt)}" />
      <figcaption>
        <span>${escapeHtml(s.label)}</span>
        <span class="v2-shot-count">${index + 1} / ${gallery.length}</span>
      </figcaption>
    </figure>
    <nav>
      <button type="button" data-shot="-1" ${index === 0 ? "disabled" : ""}>← Earlier</button>
      <button type="button" data-close>Close</button>
      <button type="button" data-shot="1" ${index === gallery.length - 1 ? "disabled" : ""}>Later →</button>
    </nav>`;
  shotDialog.querySelectorAll<HTMLButtonElement>("[data-shot]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      index = Math.max(0, Math.min(gallery.length - 1, index + Number(b.dataset.shot)));
      renderShot();
    })
  );
}

export function anyDialogOpen(): boolean {
  return termDialog.open || shotDialog.open;
}

shotDialog.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" && index < gallery.length - 1) {
    index++;
    renderShot();
  } else if (e.key === "ArrowLeft" && index > 0) {
    index--;
    renderShot();
  }
});
