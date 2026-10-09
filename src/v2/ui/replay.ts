import type { ReplayLine } from "../content/types";
import { events, store } from "../core/state";
import { el, escapeHtml } from "./markup";
import { scrollCue } from "./scrollcue";

const WHO_LABEL: Record<ReplayLine["who"], string> = {
  user: "human",
  agent: "agent",
  tool: "tool",
  result: "result",
  catch: "human catch",
  handoff: "handoff",
  note: "",
};

/**
 * A scripted re-run of a real session. Lines arrive one at a time — the
 * human's typed lines are typed out — and each arrival is broadcast as a
 * beat so the 3D scene can answer it. Reduced motion shows everything at once.
 */
export class Replay {
  readonly root: HTMLElement;
  private list: HTMLOListElement;
  private button: HTMLButtonElement;
  private timer = 0;
  private next = 0;
  private playing = false;

  constructor(title: string, private lines: ReplayLine[]) {
    this.root = el("section", "v2-replay");
    this.root.setAttribute("aria-label", `Replay: ${title}`);
    const head = el("header", "v2-replay-head");
    head.append(el("span", "v2-replay-title", escapeHtml(title)));
    this.button = el("button", "v2-replay-btn", "Play") as HTMLButtonElement;
    this.button.type = "button";
    this.button.addEventListener("click", () => (this.playing ? this.pause() : this.next >= lines.length ? this.restart() : this.play()));
    const all = el("button", "v2-replay-btn ghost", "Show all") as HTMLButtonElement;
    all.type = "button";
    all.addEventListener("click", () => this.showAll());
    head.append(this.button, all);
    this.list = el("ol", "v2-replay-lines");
    this.root.append(head, this.list);
    scrollCue(this.list);
  }

  play(): void {
    if (store.get().reducedMotion) return this.showAll();
    this.playing = true;
    this.button.textContent = "Pause";
    this.tick();
  }

  pause(): void {
    this.playing = false;
    clearTimeout(this.timer);
    this.button.textContent = this.next >= this.lines.length ? "Replay" : "Resume";
  }

  restart(): void {
    this.list.innerHTML = "";
    this.next = 0;
    this.play();
  }

  showAll(): void {
    clearTimeout(this.timer);
    while (this.next < this.lines.length) this.append(this.lines[this.next++], false);
    this.playing = false;
    this.button.textContent = "Replay";
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.playing = false;
  }

  private tick = (): void => {
    if (!this.playing) return;
    if (this.next >= this.lines.length) return this.pause();
    const line = this.lines[this.next++];
    const typed = this.append(line, line.who === "user" || line.who === "catch");
    events.emit("beat", { kind: line.who === "note" ? "result" : line.who });
    // Reading time scales with length; typed lines wait for their typing.
    const wait = typed + Math.min(2600, 700 + line.text.length * 14);
    this.timer = window.setTimeout(this.tick, wait);
  };

  private atBottom(): boolean {
    const l = this.list;
    return l.scrollTop + l.clientHeight >= l.scrollHeight - 40;
  }

  /** Scroll only the transcript, never the surrounding panel. */
  private toBottom(): void {
    this.list.scrollTop = this.list.scrollHeight;
  }

  /** Appends a line; returns how long its typing animation takes (ms). */
  private append(line: ReplayLine, type: boolean): number {
    const li = el("li", `v2-line v2-line-${line.who}`);
    const who = WHO_LABEL[line.who];
    if (who) li.append(el("span", "v2-line-who", who));
    const body = el("span", "v2-line-text");
    li.append(body);
    // Follow the newest line only if the reader is already at the bottom;
    // someone scrolled up to reread keeps their place.
    const follow = this.atBottom();
    this.list.insertBefore(li, this.list.querySelector(".v2-more"));
    if (!type) {
      body.textContent = line.text;
      if (follow) this.toBottom();
      return 0;
    }
    if (follow) this.toBottom();
    // Typewriter for human input: fast, but slow enough to read as typing.
    // The line grows after it is placed, so keep its end in view as it types.
    const per = Math.max(8, Math.min(28, 1400 / line.text.length));
    let i = 0;
    const step = () => {
      const stay = this.atBottom();
      body.textContent = line.text.slice(0, ++i);
      if (i < line.text.length && this.playing) window.setTimeout(step, per);
      else body.textContent = line.text;
      if (stay) this.toBottom();
    };
    step();
    return per * line.text.length;
  }
}
