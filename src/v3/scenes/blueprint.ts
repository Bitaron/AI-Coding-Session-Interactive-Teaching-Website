import {
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Texture,
} from "three";
import { CYAN, GREEN, STEEL, TIMBER } from "../engine/palette";
import { anchor, Bin, geo, glow, label, sfx, toon } from "./kit";
import { str, type CityFrame, type CityRigFactory, type Hotspot } from "./rig";

/**
 * Specification as a blueprint. A drafting table projects the spec as a
 * cyan hologram that unrolls one panel at a time — idea, /specify, /plan ·
 * /tasks, verify — each panel drawn in as it opens. Only a fully drawn
 * spec gets the green stamp; then it rolls back up and starts again.
 */

const PANEL = 1.8;

/** Blueprint paper: deep teal, a white grid, the panel's name in white. */
function blueprintTexture(bin: Bin, text: string): Texture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1d5f69";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  for (let i = 32; i < size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f4f1ea";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, size - 28, size - 28);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = '600 50px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > size - 90 && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, size / 2, size / 2 + (i - (lines.length - 1) / 2) * 62));
  const tex = bin.add(new CanvasTexture(canvas));
  tex.anisotropy = 4;
  return tex;
}

export const blueprint: CityRigFactory = (preset) => {
  const bin = new Bin();
  const object = new Group();
  const hotspots: Hotspot[] = [];

  // The drafting table and its projector strip.
  const names = str(preset, "panels", "idea|/specify|/plan · /tasks|verify vs spec").split("|");
  const width = names.length * PANEL;
  const table = new Group();
  const top = new Mesh(geo(bin, new BoxGeometry(width + 0.6, 0.14, 1.5)), toon(bin, TIMBER));
  top.position.y = 0.95;
  table.add(top);
  const legGeo = geo(bin, new CylinderGeometry(0.07, 0.07, 0.95, 8));
  const legMat = toon(bin, STEEL);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new Mesh(legGeo, legMat);
      leg.position.set(sx * (width / 2), 0.47, sz * 0.55);
      table.add(leg);
    }
  }
  const strip = new Mesh(geo(bin, new BoxGeometry(width + 0.2, 0.08, 0.16)), glow(bin, CYAN));
  strip.position.set(0, 1.06, -0.4);
  table.add(strip);
  object.add(table);

  // Panels hinge one off the next, like an accordion; printed on the front
  // only, so a half-open panel never shows mirrored text.
  const backMat = bin.add(new MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.25, side: BackSide, depthWrite: false }));
  const panelGeo = geo(bin, new PlaneGeometry(PANEL, PANEL).translate(PANEL / 2, 0, 0));
  const panels: { hinge: Group; mat: MeshBasicMaterial }[] = [];
  let parent: Group = object;
  names.forEach((n, k) => {
    const hinge = new Group();
    if (k === 0) hinge.position.set(-width / 2, 2.3, -0.4);
    else hinge.position.set(PANEL, 0, 0);
    const mat = bin.add(new MeshBasicMaterial({ map: blueprintTexture(bin, n), transparent: true, opacity: 0.2, fog: true }));
    hinge.add(new Mesh(panelGeo, mat), new Mesh(panelGeo, backMat));
    parent.add(hinge);
    panels.push({ hinge, mat });
    parent = hinge;
  });

  // The pen of light that draws each panel as it opens.
  const scan = new Mesh(geo(bin, new BoxGeometry(0.05, PANEL, 0.05)), glow(bin, CYAN));
  object.add(scan);

  // The approval stamp: a green seal that slams onto the open spec.
  const stamp = new Group();
  const seal = new Mesh(geo(bin, new CylinderGeometry(0.55, 0.55, 0.12, 32)), toon(bin, GREEN, { emissive: GREEN, emissiveIntensity: 0.3 }));
  seal.rotation.x = Math.PI / 2;
  const grip = new Mesh(geo(bin, new CylinderGeometry(0.16, 0.2, 0.6, 12)), toon(bin, TIMBER));
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.36;
  stamp.add(seal, grip);
  object.add(stamp);
  const check = label(bin, str(preset, "done", "✓ checked before code"), { size: 0.34, color: "#1f8a56" });
  check.position.set(width / 2 - 0.9, 3.7, 0.2);
  object.add(check);
  const bang = sfx(bin, "STAMP!", { size: 0.7, color: "#1f8a56", tilt: -0.1 });
  bang.position.set(width / 2 - 1.8, 3.9, 0.6);
  object.add(bang);

  const [term, text] = str(preset, "spot", "spec-driven~spec-driven development").split("~");
  hotspots.push({ term, label: text, anchor: anchor(object, -width / 2 + 0.9, 3.5, -0.4) });

  let t = 0;
  return {
    object,
    hotspots,
    dispose: () => bin.dispose(),
    update(ctx: CityFrame) {
      t += ctx.dt;
      const u = (t % 11) / 11;
      // Unroll panel by panel, hold for the stamp, roll back up.
      const open = u < 0.55 ? u / 0.55 : u < 0.88 ? 1 : 1 - (u - 0.88) / 0.12;
      const steps = panels.length - 1;
      let drawing = -1;
      let frac = 0;
      panels.forEach(({ hinge, mat }, k) => {
        const local = k === 0 ? Math.min(1, open * 4) : Math.min(1, Math.max(0, open * steps - (k - 1)));
        if (k > 0) hinge.rotation.y = (k % 2 ? -1 : 1) * Math.PI * 0.97 * (1 - local);
        // A panel is drawn in as it opens: faint while folded, solid once flat.
        mat.opacity = 0.2 + 0.75 * local;
        if (local > 0.05 && local < 0.95) {
          drawing = k;
          frac = local;
        }
      });
      scan.visible = drawing >= 0 && u < 0.55;
      if (scan.visible) scan.position.set(-width / 2 + (drawing + frac) * PANEL, 2.3, -0.35);
      // The stamp only lands on a fully open spec.
      const s = u < 0.6 ? 0 : Math.min(1, (u - 0.6) / 0.06);
      const done = open > 0.98 && s > 0;
      stamp.visible = done || (u > 0.6 && u < 0.88);
      stamp.position.set(width / 2 - 0.9, 2.3, 2.6 - 2.92 * s);
      check.visible = s >= 1 && open > 0.98;
      bang.visible = s >= 1 && u < 0.72;
      if (bang.visible) bang.material.rotation = Math.sin(t * 20) * 0.03;
    },
  };
};
