import {
  BoxGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { GREEN, INK, ORANGE } from "../engine/palette";
import { Bin, anchor, geo, ink, label, matte, tint } from "./kit";
import { damp, str, type FrameContext, type Hotspot, type RigFactory } from "./rig";

/**
 * Deterministic machinery: rings with a single gap, like a combination
 * lock. Work (a pellet) only passes when every ring's gap lines up — and a
 * ring decides the same way every time, no matter who sent the pellet.
 *
 *  - hooks:     tool calls pass PreToolUse → tool → PostToolUse; a dangerous one is turned back
 *  - tdd:       the test ring starts misaligned (red); each attempt turns it until it passes (green)
 *  - mcp:       key-and-lock — differently shaped tools share one standard collar and dock into one socket
 *  - providers: effort dials; each provider's dial only has notches for the levels it supports
 */

const LEVELS = ["none", "low", "medium", "high", "xhigh", "max"];

function gappedRing(bin: Bin, radius: number, mat: MeshStandardMaterial): Mesh {
  // A torus arc with its gap centred on +Y once rotated.
  const gap = 0.55;
  const g = geo(bin, new TorusGeometry(radius, 0.13, 10, 72, Math.PI * 2 - gap));
  g.rotateZ(Math.PI / 2 + gap / 2);
  return new Mesh(g, mat);
}

export const tumbler: RigFactory = (preset) => {
  const mode = str(preset, "mode", "hooks");
  if (mode === "mcp") return keyAndLock(preset);
  if (mode === "providers") return dials(str(preset, "dials", ""));
  return lock(mode === "tdd", preset);
};

const list = (v: string) => v.split("|").filter(Boolean);

/** hooks + tdd share the pellet-through-rings mechanism. */
function lock(tdd: boolean, preset: Parameters<RigFactory>[0]) {
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];

  const gateNames = list(str(preset, "gates", tdd ? "test" : "PreToolUse|PostToolUse"));
  const gateDefs = gateNames.map((name, k) => ({
    name,
    x: gateNames.length === 1 ? 1.2 : -1.8 + (k * 4) / (gateNames.length - 1),
  }));
  /** Calls containing this text are turned back by the first gate. */
  const blocks = list(str(preset, "blocks", "rm -rf"));
  const gates = gateDefs.map((d) => {
    const mat = matte(bin, INK);
    const ring = gappedRing(bin, 1.6, mat);
    ring.position.set(d.x, 2, 0);
    // Three-quarter turn toward the camera so the ring reads as a ring.
    ring.rotation.y = Math.PI / 2 - 0.75;
    object.add(ring);
    const tag = label(bin, d.name, { size: 0.36 });
    tag.position.set(d.x, 4.1, 0);
    object.add(tag);
    return { ring, mat, angle: 0, goal: 0 };
  });

  // The tool itself, between the hooks: a turning artifact.
  let tool: Mesh | null = null;
  if (!tdd) {
    tool = new Mesh(geo(bin, new DodecahedronGeometry(0.55)), matte(bin, 0xcfc6b3, { flat: true }));
    tool.position.set(0.2, 3.6, 0);
    object.add(tool);
    str(preset, "spots", "hooks~PreToolUse hook|deterministic~same result every time")
      .split("|")
      .forEach((spec, k) => {
        const [term, text] = spec.split("~");
        const x = gateDefs[Math.min(k, gateDefs.length - 1)].x + (k >= gateDefs.length ? 1.6 : 0);
        hotspots.push({ term, label: text, anchor: anchor(object, x, 3.7, 0) });
      });
  } else {
    hotspots.push(
      { term: "tdd", label: "red → green → refactor", anchor: anchor(object, 1.2, 3.7, 0) },
      { term: "independent-verification", label: "independent check", anchor: anchor(object, 3.4, 2.4, 0) }
    );
  }

  const calls = list(
    str(preset, "calls", tdd ? "attempt 1|attempt 2|attempt 3|refactor" : "Edit src/app.ts|Bash npm test|Bash rm -rf /|Write README.md")
  );
  const callLabels = calls.map((c) => {
    const l = label(bin, c, { size: 0.3 });
    l.visible = false;
    object.add(l);
    return l;
  });

  const pelletMat = matte(bin, INK);
  const pellet = new Mesh(geo(bin, new SphereGeometry(0.22, 16, 12)), pelletMat);
  object.add(pellet);
  const statusRed = label(bin, "red", { size: 0.42, color: "#e8611e" });
  const statusGreen = label(bin, "green", { size: 0.42, color: "#1f8a56" });
  statusRed.position.set(1.2, 0.5, 1.4);
  statusGreen.position.copy(statusRed.position);
  if (tdd) object.add(statusRed, statusGreen);

  let call = 0;
  let x = -5;
  let bounced = false;
  let attempts = 0;

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: FrameContext) {
      const dt = ctx.dt;
      const name = calls[call % calls.length];
      const dangerous = !tdd && blocks.some((b) => name.includes(b));
      // Each gate decides from the input alone — that's the point.
      gates.forEach((g, gi) => {
        let open = true;
        if (dangerous && gi === 0) open = false;
        if (tdd) open = attempts >= 2;
        // Misalignment shrinks with each TDD attempt, so progress is visible.
        g.goal = open ? 0 : tdd ? (2 - attempts) * 0.9 : 1.3;
        g.angle = damp(g.angle, g.goal, 5, dt);
        g.ring.rotation.x = g.angle;
        const near = Math.abs(x - gateDefs[gi].x) < 1.2;
        tint(g.mat, INK, open ? GREEN : ORANGE, near || tdd ? 0.85 : 0);
      });
      if (tdd) {
        statusRed.visible = attempts < 2;
        statusGreen.visible = attempts >= 2;
      }

      // Move the pellet; bounce at the first closed gate.
      const speed = 2.4;
      x += (bounced ? -speed * 1.4 : speed) * dt;
      const blockedAt = gates.findIndex((g, gi) => Math.abs(g.goal) > 0.2 && x > gateDefs[gi].x - 0.35 && !bounced);
      if (blockedAt >= 0) bounced = true;
      if (tool) tool.rotation.y += dt * (Math.abs(x - 0.2) < 1 ? 5 : 0.4);
      const arc = tool && !bounced && x > -1.5 && x < 1.9 ? Math.sin(((x + 1.5) / 3.4) * Math.PI) * 1.4 : 0;
      // Travel along the rings' top edge, where their gaps sit when aligned.
      pellet.position.set(x, 2 + 1.6 + arc, 0);
      tint(pelletMat, INK, bounced ? ORANGE : GREEN, bounced ? 1 : x > gateDefs[gateDefs.length - 1].x ? 1 : 0);
      callLabels.forEach((l, k) => {
        l.visible = k === call % calls.length;
        l.position.set(pellet.position.x, pellet.position.y + 0.55, 0);
      });

      if (x > 5.5 || (bounced && x < -5)) {
        if (tdd) attempts = bounced ? attempts + 1 : attempts >= 2 && call % calls.length === 3 ? 0 : attempts;
        call++;
        x = -5;
        bounced = false;
      }
    },
  };
}

/** Many tool shapes, one standard collar, one socket. */
function keyAndLock(preset: Parameters<RigFactory>[0]) {
  const bin = new Bin();
  const object = new Group();
  const socketMat = ink(bin);
  const socket = new Mesh(geo(bin, new TorusGeometry(1.1, 0.28, 12, 6)), socketMat);
  socket.position.set(0, 2.2, 0);
  socket.rotation.y = 1.0;
  object.add(socket);
  const host = label(bin, str(preset, "socket", "agent (MCP client)"), { size: 0.36 });
  host.position.set(0, 3.8, 0);
  object.add(host);

  const forms = [
    () => new OctahedronGeometry(0.5),
    () => new IcosahedronGeometry(0.5, 0),
    () => new CylinderGeometry(0.4, 0.4, 0.7, 12),
    () => new BoxGeometry(0.6, 0.6, 0.6),
  ];
  const shapes = list(str(preset, "keys", "Playwright|Lazyweb|your database|your API")).map((name, k) => ({
    name,
    g: forms[k % forms.length](),
  }));
  const keys = shapes.map((s, k) => {
    const g = new Group();
    const head = new Mesh(geo(bin, s.g), matte(bin, 0xcfc6b3, { flat: true }));
    // The shared collar: every server presents the same hexagonal plug.
    const collar = new Mesh(geo(bin, new CylinderGeometry(0.62, 0.62, 0.24, 6)), matte(bin, INK));
    collar.rotation.z = Math.PI / 2;
    collar.position.x = 0.75;
    g.add(head, collar);
    const tag = label(bin, s.name, { size: 0.3 });
    tag.position.y = 0.85;
    g.add(tag);
    g.scale.setScalar(0.75);
    object.add(g);
    return { g, angle: (k / shapes.length) * Math.PI * 2 };
  });

  const hotspots: Hotspot[] = list(str(preset, "spots", "mcp~one standard socket|tool-schema~tool schema")).map((spec, k) => {
    const [term, text] = spec.split("~");
    return { term, label: text, anchor: anchor(object, k ? -3.2 : 0, k ? 1.5 : 2.2, 0) };
  });

  let t = 0;
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: FrameContext) {
      t += ctx.dt;
      const turn = Math.floor(t / 3) % keys.length;
      const local = (t % 3) / 3;
      const dock = local < 0.5 ? local * 2 : 1 - (local - 0.5) * 2;
      keys.forEach((k, i) => {
        k.angle += ctx.dt * 0.25;
        const orbit = new Vector3(Math.cos(k.angle) * 3.6, 1.6 + Math.sin(k.angle * 2 + i) * 0.3, Math.sin(k.angle) * 2.4);
        const docked = new Vector3(-1.85, 2.2, 0);
        const docking = i === turn ? Math.min(1, dock * 1.6) : 0;
        k.g.position.copy(orbit).lerp(docked, docking);
        k.g.rotation.y = docking > 0.5 ? 0 : -k.angle;
      });
      socket.rotation.z += ctx.dt * 0.3;
      tint(socketMat, INK, GREEN, dock > 0.6 ? (dock - 0.6) * 2.5 : 0);
    },
  };
}

/** One dial per provider/model; notches only where that model has a level. */
function dials(spec: string) {
  const bin = new Bin();
  const object = new Group();
  const rows = spec.split(";").filter(Boolean).map((r) => {
    const [name, levels] = r.split(":");
    return { name, levels: levels.split(",").map(Number) };
  });
  const width = 2.25;
  const dialsOut = rows.map((row, k) => {
    const g = new Group();
    g.position.set((k - (rows.length - 1) / 2) * width, 2.1, 0);
    g.scale.setScalar(0.85);
    const face = new Mesh(geo(bin, new CylinderGeometry(1.05, 1.1, 0.16, 48)), matte(bin, 0xe6dfd0, { emissive: 0x6b675e }));
    face.rotation.x = Math.PI / 2;
    g.add(face);
    LEVELS.forEach((_, li) => {
      const a = Math.PI * 0.85 - (li / (LEVELS.length - 1)) * Math.PI * 1.7;
      const has = row.levels.includes(li);
      const notch = new Mesh(geo(bin, new BoxGeometry(0.07, has ? 0.3 : 0.1, 0.06)), has ? ink(bin) : matte(bin, INK, { transparent: true, opacity: 0.2 }));
      notch.position.set(Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0.1);
      notch.rotation.z = a - Math.PI / 2;
      g.add(notch);
    });
    const needleMat = matte(bin, INK);
    const needle = new Mesh(geo(bin, new BoxGeometry(0.06, 0.72, 0.05).translate(0, 0.36, 0)), needleMat);
    needle.position.z = 0.14;
    g.add(needle);
    const tag = label(bin, row.name, { size: 0.28 });
    tag.position.set(0, -1.45, 0);
    g.add(tag);
    const readout = LEVELS.map((lv) => {
      const r = label(bin, lv, { size: 0.24, color: "#5d584d" });
      r.position.set(0, 1.4, 0);
      r.visible = false;
      g.add(r);
      return r;
    });
    object.add(g);
    return { row, needle, needleMat, readout, angle: 0 };
  });

  const hotspots: Hotspot[] = [
    { term: "reasoning-effort", label: "same name ≠ same compute", anchor: anchor(object, 0, 3.8, 0) },
  ];

  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: FrameContext) {
      const want = Math.round(ctx.params.effort);
      dialsOut.forEach((d) => {
        // Snap to the nearest level this model actually has.
        const got = d.row.levels.reduce((best, l) => (Math.abs(l - want) < Math.abs(best - want) ? l : best), d.row.levels[0]);
        const a = Math.PI * 0.85 - (got / (LEVELS.length - 1)) * Math.PI * 1.7 - Math.PI / 2;
        d.angle = damp(d.angle, a, 7, ctx.dt);
        d.needle.rotation.z = d.angle;
        tint(d.needleMat, INK, ORANGE, got === want ? 0 : 1);
        d.readout.forEach((r, i) => (r.visible = i === got));
      });
    },
  };
}
