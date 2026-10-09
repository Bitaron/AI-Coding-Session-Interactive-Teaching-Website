import { glossary } from "../content/glossary";
import { globalIndex, sections } from "../content/sections";
import { store, type Route } from "../core/state";
import { el, escapeHtml } from "./markup";
import { go, path } from "./router";
import { scrollCue } from "./scrollcue";

/**
 * The page finder: every station in one searchable list. Opened from the
 * top bar (or "/"); choosing a page closes it and travels there, so the
 * camera (and in v3 the guide robot) flies to it like any other jump.
 * Matches titles first, then section names, ledes and scene captions.
 */

interface Entry {
  route: Route;
  num: string;
  title: string;
  section: string;
  /** Lower-cased text searched beyond the title. */
  body: string;
  /** First sentence of the lede, plain. */
  gist: string;
}

/** `[[id|label]]` → label, `[[id]]` → the glossary term. */
function plain(text: string): string {
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, id: string, label?: string) => label ?? glossary.get(id)?.term ?? id);
}

function entries(): Entry[] {
  return sections.flatMap((s) =>
    s.steps.map((st, i) => {
      const lede = plain(st.lede);
      return {
        route: { sectionId: s.id, stepIndex: i },
        num: String(globalIndex(s.id, i) + 1).padStart(2, "0"),
        title: st.title,
        section: s.label,
        // The scene's own names count too: in v3, "warehouse" finds every
        // backend page and "head" every robot-head scene.
        body: [s.label, lede, ...(st.points ?? []).map(plain), plain(st.sceneCaption), st.scene.rig, st.scene.preset?.site ?? ""]
          .join(" ")
          .toLowerCase(),
        gist: lede.split(/(?<=[.!?])\s/)[0],
      };
    })
  );
}

const ICON = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
  <path d="M2 4h8M2 9h6M2 14h5"/><circle cx="13.5" cy="11.5" r="3.6"/><path d="M16.2 14.2 19 17"/></svg>`;

export interface Finder {
  button: HTMLButtonElement;
  open(): void;
  isOpen(): boolean;
}

export function mountFinder(root: HTMLElement): Finder {
  const all = entries();
  const button = el("button", "v2-ctl v2-finder-btn", `${ICON}<span>pages</span>`) as HTMLButtonElement;
  button.type = "button";
  button.title = "Browse and search every page ( / )";
  button.setAttribute("aria-haspopup", "dialog");

  const dialog = el("dialog", "v2-finder");
  dialog.setAttribute("aria-label", "Browse pages");
  dialog.innerHTML = `
    <header>
      <input type="search" placeholder="Search ${all.length} pages…" aria-label="Search pages" autocomplete="off" spellcheck="false" />
      <button type="button" class="v2-close" data-close>Close</button>
    </header>
    <ol class="v2-finder-list" role="listbox" aria-label="Pages"></ol>
    <p class="v2-finder-empty" hidden>No page mentions that. Try a shorter word.</p>`;
  root.append(dialog);
  const input = dialog.querySelector("input")!;
  const list = dialog.querySelector("ol")!;
  const empty = dialog.querySelector<HTMLElement>(".v2-finder-empty")!;
  scrollCue(list);
  let shown: Entry[] = [];
  let active = 0;

  const render = () => {
    const q = input.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    // Words match from their start, so "house" doesn't find "warehouse".
    const patterns = words.map((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    const score = (e: Entry) => {
      if (!patterns.length) return 1;
      const t = e.title.toLowerCase();
      let s = 0;
      for (const p of patterns) {
        if (p.test(t)) s += 3;
        else if (p.test(e.body)) s += 1;
        else return 0;
      }
      return s;
    };
    shown = all
      .map((e) => ({ e, s: score(e) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => (words.length ? b.s - a.s : 0))
      .map((x) => x.e);
    const current = store.get().route;
    active = Math.max(0, Math.min(active, shown.length - 1));
    let lastSection = "";
    list.innerHTML = shown
      .map((e, i) => {
        // Section headings only make sense in the unfiltered, ordered list.
        const head = !words.length && e.section !== lastSection ? `<li class="v2-finder-sec" role="presentation">${escapeHtml(e.section)}</li>` : "";
        lastSection = e.section;
        const isCurrent = current?.sectionId === e.route.sectionId && current.stepIndex === e.route.stepIndex;
        return `${head}<li role="option" aria-selected="${i === active}" data-i="${i}">
          <a data-route href="${path(e.route)}" class="${isCurrent ? "current" : ""}" tabindex="-1">
            <span class="v2-finder-num">${e.num}</span>
            <span class="v2-finder-title">${escapeHtml(e.title)}</span>
            <span class="v2-finder-where">${escapeHtml(words.length ? e.section : "")}</span>
            <span class="v2-finder-gist">${escapeHtml(e.gist)}</span>
          </a></li>`;
      })
      .join("");
    empty.hidden = shown.length > 0;
  };

  const highlight = (i: number) => {
    active = Math.max(0, Math.min(i, shown.length - 1));
    list.querySelectorAll<HTMLElement>('[role="option"]').forEach((li) => {
      const on = Number(li.dataset.i) === active;
      li.setAttribute("aria-selected", String(on));
      if (on) li.scrollIntoView({ block: "nearest" });
    });
  };

  const choose = (i: number) => {
    const e = shown[i];
    if (!e) return;
    dialog.close();
    go(e.route);
  };

  const open = () => {
    input.value = "";
    const current = store.get().route;
    active = current ? all.findIndex((e) => e.route.sectionId === current.sectionId && e.route.stepIndex === current.stepIndex) : 0;
    render();
    dialog.showModal();
    input.focus();
    highlight(active);
  };

  button.addEventListener("click", open);
  input.addEventListener("input", () => {
    active = 0;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") highlight(active + 1);
    else if (e.key === "ArrowUp") highlight(active - 1);
    else if (e.key === "Enter") choose(active);
    else return;
    e.preventDefault();
  });
  dialog.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (e.target === dialog || t.closest("[data-close]")) return dialog.close();
    const li = t.closest<HTMLElement>('[role="option"]');
    if (li) {
      // The router would also catch the link; going here keeps one path.
      e.preventDefault();
      e.stopPropagation();
      choose(Number(li.dataset.i));
    }
  });
  list.addEventListener("pointermove", (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[role="option"]');
    if (li && Number(li.dataset.i) !== active) highlight(Number(li.dataset.i));
  });

  return { button, open, isOpen: () => dialog.open };
}
