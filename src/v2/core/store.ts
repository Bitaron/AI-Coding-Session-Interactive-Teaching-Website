// A minimal observable store. The 3D engine and the DOM overlay never call
// each other directly — both read and write this shared state, which keeps
// scene management decoupled from UI logic.

export type Listener<T> = (state: T, prev: T) => void;

export class Store<T extends object> {
  private state: T;
  private listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  set(patch: Partial<T>): void {
    const prev = this.state;
    const next = { ...prev, ...patch };
    const changed = (Object.keys(patch) as (keyof T)[]).some((k) => prev[k] !== next[k]);
    if (!changed) return;
    this.state = next;
    for (const l of this.listeners) l(next, prev);
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Subscribe to one derived slice; fires only when that slice changes. */
  select<S>(pick: (s: T) => S, listener: (slice: S, prev: S) => void): () => void {
    return this.subscribe((s, p) => {
      const a = pick(s);
      const b = pick(p);
      if (a !== b) listener(a, b);
    });
  }
}

/** Fire-and-forget events that aren't state (a replay line landed, a dial tick). */
export class Emitter<E extends Record<string, unknown>> {
  private handlers: { [K in keyof E]?: Set<(payload: E[K]) => void> } = {};

  on<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void {
    (this.handlers[type] ??= new Set()).add(fn);
    return () => this.handlers[type]?.delete(fn);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    this.handlers[type]?.forEach((fn) => fn(payload));
  }
}
