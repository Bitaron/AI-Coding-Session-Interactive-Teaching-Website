import { glossary } from "../content/glossary";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Turns `[[id]]` / `[[id|label]]` into deep-dive term buttons. Unknown ids
 * throw in dev so a typo can't silently ship as plain text.
 */
export function rich(text: string): string {
  return escapeHtml(text).replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id: string, label?: string) => {
    const entry = glossary.get(id);
    if (!entry) {
      if (import.meta.env.DEV) throw new Error(`Unknown glossary term: ${id}`);
      return label ?? id;
    }
    return `<button type="button" class="term" data-term="${id}" aria-haspopup="dialog">${label ?? entry.term}</button>`;
  });
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, html?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
