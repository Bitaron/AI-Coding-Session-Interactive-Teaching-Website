import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  type Sprite,
  type SpriteMaterial,
  TorusGeometry,
  Vector3,
} from "three";
import { ARMOR, ASPHALT, CYAN, GREEN, INK, ORANGE, STEEL } from "../engine/palette";
import { Bin, anchor, geo, glow, label, sfx, tint, toon } from "./kit";
import { damp, str, type CityFrame, type CityRig, type CityRigFactory, type Hotspot } from "./rig";
import { buildHead } from "./robotkit";

/**
 * Deterministic machinery in the city.
 *  - hooks: a road through checkpoint arches. Every tool call is a little
 *           vehicle: PreToolUse → the tool's workshop → PostToolUse. The
 *           dangerous one meets the barrier and is turned back — every
 *           time, by the same rule, whoever is driving.
 *  - dock:  MCP. Machines of every shape carry the same hex plug and dock
 *           into the agent's one socket in turn.
 */

const FLOOR = 0.3;
const TOOL = new Color("#cfc6b3");
const list = (v: string) => v.split("|").filter(Boolean);

function popper(s: Sprite) {
  const base = s.scale.clone();
  let age = 9;
  s.visible = false;
  return {
    fire() {
      age = 0;
    },
    update(dt: number) {
      age += dt;
      s.visible = age < 1.2;
      s.scale.copy(base).multiplyScalar(0.6 + 0.4 * Math.min(1, age / 0.12));
      (s.material as SpriteMaterial).opacity = 1 - Math.max(0, (age - 0.85) / 0.35);
    },
  };
}

export const gate: CityRigFactory = (preset) => (str(preset, "mode", "hooks") === "dock" ? dock(preset) : hooks(preset));

// --- hooks ---------------------------------------------------------------------------

function hooks(preset: Parameters<CityRigFactory>[0]): CityRig {
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];

  const road = new Mesh(geo(bin, new PlaneGeometry(13, 2.4)), toon(bin, ASPHALT));
  road.rotation.x = -Math.PI / 2;
  road.position.y = FLOOR + 0.01;
  object.add(road);
  const dash = geo(bin, new BoxGeometry(0.6, 0.02, 0.08));
  const dashMat = toon(bin, "#f4efe4");
  for (let i = 0; i < 9; i++) {
    const d = new Mesh(dash, dashMat);
    d.position.set(-5.6 + i * 1.4, FLOOR + 0.02, 0);
    object.add(d);
  }

  const names = list(str(preset, "gates", "PreToolUse|PostToolUse"));
  const blocks = list(str(preset, "blocks", "rm -rf"));
  const calls = list(str(preset, "calls", "Edit src/app.ts|Bash npm test|Bash rm -rf /|Write README.md"));
  const steel = toon(bin, STEEL);
  const postGeo = geo(bin, new BoxGeometry(0.22, 2.7, 0.22));
  const gates = names.map((name, k) => {
    const x = names.length === 1 ? -2 : -2.6 + (k * 5.2) / (names.length - 1);
    for (const z of [-1.45, 1.45]) {
      const post = new Mesh(postGeo, steel);
      post.position.set(x, FLOOR + 1.35, z);
      object.add(post);
    }
    const beam = new Mesh(geo(bin, new BoxGeometry(0.3, 0.32, 3.2)), steel);
    beam.position.set(x, FLOOR + 2.8, 0);
    object.add(beam);
    const lamp = glow(bin, CYAN);
    const bulb = new Mesh(geo(bin, new SphereGeometry(0.18, 12, 8)), lamp);
    bulb.position.set(x, FLOOR + 3.1, 0);
    object.add(bulb);
    const sign = label(bin, name, { size: 0.36, background: "#fbf8f1" });
    sign.position.set(x, FLOOR + 3.65, 0);
    object.add(sign);
    // Barrier arm, hinged on the near post; raised by default.
    const arm = new Object3D();
    arm.position.set(x + 0.18, FLOOR + 1.0, 1.35);
    const armMat = toon(bin, ORANGE, { emissive: ORANGE, emissiveIntensity: 0.2 });
    arm.add(new Mesh(geo(bin, new BoxGeometry(0.1, 0.12, 2.6).translate(0, 0, -1.3)), armMat));
    object.add(arm);
    return { x, lamp, arm, lift: 1.45 };
  });

  // The tool's workshop, set back between the hooks.
  const toolX = names.length > 1 ? (gates[0].x + gates[gates.length - 1].x) / 2 : 1.6;
  const shop = new Mesh(geo(bin, new BoxGeometry(1.8, 1.4, 1.2)), toon(bin, ARMOR));
  shop.position.set(toolX, FLOOR + 0.7, -2.3);
  object.add(shop);
  const toolMat = toon(bin, TOOL);
  const tool = new Mesh(geo(bin, new DodecahedronGeometry(0.42)), toolMat);
  tool.position.set(toolX, FLOOR + 1.95, -2.3);
  object.add(tool);
  const shopSign = label(bin, "tool", { size: 0.3 });
  shopSign.position.set(toolX, FLOOR + 2.65, -2.3);
  object.add(shopSign);

  str(preset, "spots", "hooks~PreToolUse hook|deterministic~same result every time")
    .split("|")
    .forEach((spec, k) => {
      const [term, text] = spec.split("~");
      const g = gates[Math.min(k, gates.length - 1)];
      hotspots.push({ term, label: text, anchor: anchor(object, g.x + (k >= gates.length ? 1.6 : 0), FLOOR + 3.1, 0) });
    });

  // One vehicle per call, in turn.
  const car = new Group();
  const shell = toon(bin, ARMOR);
  const body = new Mesh(geo(bin, new BoxGeometry(1.1, 0.42, 0.72)), shell);
  body.position.y = 0.36;
  car.add(body);
  const stripeMat = toon(bin, INK);
  const stripe = new Mesh(geo(bin, new BoxGeometry(1.12, 0.1, 0.74)), stripeMat);
  stripe.position.y = 0.42;
  car.add(stripe);
  const cabin = new Mesh(geo(bin, new BoxGeometry(0.55, 0.3, 0.6)), glow(bin, "#7fb7bd"));
  cabin.position.set(-0.1, 0.72, 0);
  car.add(cabin);
  const wheelGeo = geo(bin, new CylinderGeometry(0.15, 0.15, 0.1, 12).rotateX(Math.PI / 2));
  for (const [x, z] of [[-0.35, 0.37], [0.35, 0.37], [-0.35, -0.37], [0.35, -0.37]]) {
    const w = new Mesh(wheelGeo, toon(bin, INK));
    w.position.set(x, 0.15, z);
    car.add(w);
  }
  object.add(car);
  const tags = calls.map((c) => {
    const l = label(bin, c, { size: 0.32, background: "#fbf8f1" });
    l.visible = false;
    object.add(l);
    return l;
  });

  const denied = sfx(bin, "DENIED", { color: "#e8611e", size: 0.7 });
  object.add(denied);
  const deniedPop = popper(denied);

  type Phase = "drive" | "tool" | "blocked" | "reverse";
  let phase: Phase = "drive";
  let call = 0;
  let x = -6.2;
  let wait = 0;
  let usedTool = false;

  const update = (ctx: CityFrame) => {
    const dt = ctx.dt;
    const name = calls[call % calls.length];
    const dangerous = blocks.some((b) => name.includes(b));
    const firstGate = gates[0];

    if (phase === "drive") {
      x += 2.3 * dt;
      if (dangerous && x > firstGate.x - 1.15) {
        x = firstGate.x - 1.15;
        phase = "blocked";
        wait = 0.9;
        denied.position.set(firstGate.x - 1.2, FLOOR + 2.1, 0.8);
        deniedPop.fire();
      } else if (!usedTool && x > toolX) {
        x = toolX;
        phase = "tool";
        wait = 0.8;
        usedTool = true;
      } else if (x > 6.4) {
        call++;
        x = -6.2;
        usedTool = false;
      }
    } else if (phase === "tool" || phase === "blocked") {
      wait -= dt;
      if (wait <= 0) phase = phase === "tool" ? "drive" : "reverse";
    } else {
      x -= 3.2 * dt;
      if (x < -6.2) {
        call++;
        phase = "drive";
        usedTool = false;
      }
    }

    car.position.set(x, FLOOR, 0);
    car.rotation.y = 0;
    const passedAll = x > gates[gates.length - 1].x;
    tint(stripeMat, INK, phase === "blocked" || phase === "reverse" ? ORANGE : GREEN, phase === "blocked" || phase === "reverse" || passedAll ? 1 : 0);
    tags.forEach((l, k) => {
      l.visible = k === call % calls.length;
      l.position.set(x, FLOOR + 1.45, 0);
    });

    // Each gate decides from the call alone.
    gates.forEach((g, gi) => {
      const closed = dangerous && gi === 0 && phase !== "reverse" ? x > g.x - 3.2 : false;
      g.lift = damp(g.lift, closed ? 0 : 1.45, 6, dt);
      g.arm.rotation.x = g.lift;
      const near = Math.abs(x - g.x) < 1.3;
      const col = closed || (dangerous && gi === 0 && phase === "reverse") ? ORANGE : near ? GREEN : CYAN;
      g.lamp.color.copy(col);
    });
    tool.rotation.y += dt * (phase === "tool" ? 6 : 0.4);
    tint(toolMat, TOOL, GREEN, phase === "tool" ? 0.7 : 0);
    deniedPop.update(dt);
  };

  return { object, hotspots, update, dispose: () => bin.dispose() };
}

// --- dock (MCP) ----------------------------------------------------------------------------

function dock(preset: Parameters<CityRigFactory>[0]): CityRig {
  const bin = new Bin();
  const object = new Group();

  // The host: a pillar with the socket on its face and the agent's head on top.
  const host = new Group();
  host.position.set(2.2, 0, -0.4);
  host.rotation.y = -0.75;
  object.add(host);
  const pillar = new Mesh(geo(bin, new BoxGeometry(1.0, 3.0, 2.4)), toon(bin, STEEL));
  pillar.position.set(0.5, FLOOR + 1.5, 0);
  host.add(pillar);
  const SOCKET = new Vector3(-0.08, FLOOR + 1.8, 0);
  const socket = new Mesh(geo(bin, new TorusGeometry(0.75, 0.2, 10, 6)), toon(bin, INK));
  socket.rotation.y = Math.PI / 2;
  socket.position.copy(SOCKET);
  host.add(socket);
  const ringMat = glow(bin, CYAN);
  const ring = new Mesh(geo(bin, new TorusGeometry(0.75, 0.06, 6, 6)), ringMat);
  ring.rotation.y = Math.PI / 2;
  ring.position.copy(SOCKET).add(new Vector3(-0.12, 0, 0));
  host.add(ring);
  const head = buildHead(bin);
  head.group.scale.setScalar(1.3);
  head.group.position.set(0.5, FLOOR + 3.7, 0);
  head.group.rotation.y = 0.75;
  host.add(head.group);
  const hostTag = label(bin, str(preset, "socket", "agent (MCP client)"), { size: 0.34, background: "#fbf8f1" });
  hostTag.position.set(0.5, FLOOR + 4.75, 0);
  host.add(hostTag);
  host.updateMatrix();

  const forms = [
    () => new OctahedronGeometry(0.5),
    () => new IcosahedronGeometry(0.5, 0),
    () => new CylinderGeometry(0.4, 0.4, 0.7, 12),
    () => new BoxGeometry(0.62, 0.62, 0.62),
  ];
  const accents = ["#9cc6ca", "#cfc6b3", "#e7b829", "#c3cbcd"];
  const machines = list(str(preset, "keys", "Playwright|Lazyweb|your database|your API")).map((name, k) => {
    const g = new Group();
    const shape = new Mesh(geo(bin, forms[k % forms.length]()), toon(bin, accents[k % accents.length]));
    g.add(shape);
    // The shared plug: every server presents the same hex collar.
    const collar = new Mesh(geo(bin, new CylinderGeometry(0.5, 0.5, 0.22, 6)), toon(bin, INK));
    collar.rotation.z = Math.PI / 2;
    collar.position.x = 0.7;
    const pin = new Mesh(geo(bin, new CylinderGeometry(0.18, 0.18, 0.3, 6)), toon(bin, ARMOR));
    pin.rotation.z = Math.PI / 2;
    pin.position.x = 0.92;
    g.add(collar, pin);
    const tag = label(bin, name, { size: 0.3, background: "#fbf8f1" });
    tag.position.y = 0.85;
    g.add(tag);
    g.scale.setScalar(0.8);
    object.add(g);
    return { g, angle: (k / 4) * Math.PI * 2 + 0.4 };
  });

  // Where a plug sits when docked, in the rig's space.
  const docked = SOCKET.clone().add(new Vector3(-1.0 * 0.8 - 0.05, 0, 0)).applyMatrix4(host.matrix);

  const chunk = sfx(bin, "KA-CHUNK", { size: 0.6 });
  chunk.position.copy(docked).add(new Vector3(-0.4, 1.3, 0.6));
  object.add(chunk);
  const chunkPop = popper(chunk);

  const hotspots: Hotspot[] = list(str(preset, "spots", "mcp~one standard socket|tool-schema~tool schema")).map((spec, k) => {
    const [term, text] = spec.split("~");
    const at = k ? new Vector3(-3.4, FLOOR + 1.2, 0.8) : docked.clone().add(new Vector3(0.3, 0.9, 0));
    return { term, label: text, anchor: anchor(object, at.x, at.y, at.z) };
  });

  let t = 0;
  let lastTurn = -1;
  const orbit = new Vector3();
  const update = (ctx: CityFrame) => {
    t += ctx.dt;
    const turn = Math.floor(t / 3.2) % machines.length;
    const local = (t % 3.2) / 3.2;
    const dockK = local < 0.5 ? local * 2 : 1 - (local - 0.5) * 2;
    let seated = 0;
    machines.forEach((m, i) => {
      m.angle += ctx.dt * 0.3;
      orbit.set(-1.8 + Math.cos(m.angle) * 2.6, FLOOR + 1.9 + Math.sin(m.angle * 2 + i) * 0.35, 0.7 + Math.sin(m.angle) * 1.4);
      const k = i === turn ? Math.min(1, dockK * 1.6) : 0;
      m.g.position.copy(orbit).lerp(docked, k);
      // Line the plug up with the socket as it comes in.
      m.g.rotation.y = k > 0.4 ? host.rotation.y : -m.angle * 0.5;
      if (i === turn) seated = k;
    });
    if (seated >= 0.999 && lastTurn !== Math.floor(t / 3.2)) {
      lastTurn = Math.floor(t / 3.2);
      chunkPop.fire();
    }
    tint(ringMat, CYAN, GREEN, seated > 0.9 ? 1 : 0);
    head.setEyes(0.5 + 0.5 * seated);
    chunkPop.update(ctx.dt);
  };

  return { object, hotspots, update, dispose: () => bin.dispose() };
}
