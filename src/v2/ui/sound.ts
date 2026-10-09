import { events, store } from "../core/state";

/**
 * Optional, synthesised micro-feedback — no audio files. Off by default.
 * A dry click per dial tick, a low filtered breath while the camera
 * travels, a soft two-note landing. Touch devices get a short vibration
 * on ticks instead of (or as well as) the click.
 */
export function mountSound(): void {
  let ctx: AudioContext | null = null;
  const audio = () => {
    if (!store.get().sound) return null;
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  const blip = (freq: number, dur: number, gain: number, when = 0) => {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + when;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  events.on("tick", ({ strength }) => {
    blip(1900 + strength * 600, 0.03, 0.05);
    if (store.get().sound && "vibrate" in navigator) navigator.vibrate?.(4);
  });

  store.select(
    (s) => s.travelling,
    (travelling) => {
      const a = audio();
      if (!a || !travelling) return;
      // A second of shaped noise through a low-pass that opens then closes.
      const len = a.sampleRate * 1.4;
      const buf = a.createBuffer(1, len, a.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = a.createBufferSource();
      src.buffer = buf;
      const lp = a.createBiquadFilter();
      lp.type = "lowpass";
      const t = a.currentTime;
      lp.frequency.setValueAtTime(200, t);
      lp.frequency.linearRampToValueAtTime(900, t + 0.6);
      lp.frequency.linearRampToValueAtTime(180, t + 1.4);
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.4);
      src.connect(lp).connect(g).connect(a.destination);
      src.start();
    }
  );

  events.on("arrived", (route) => {
    if (!route) return;
    blip(660, 0.18, 0.04);
    blip(990, 0.25, 0.03, 0.08);
  });

  events.on("beat", ({ kind }) => {
    if (kind === "catch") blip(440, 0.2, 0.04);
  });
}
