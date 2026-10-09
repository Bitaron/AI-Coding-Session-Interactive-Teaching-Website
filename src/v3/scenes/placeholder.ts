import { CylinderGeometry, Group, Mesh } from "three";
import { STEEL } from "../engine/palette";
import { Bin, geo, label, toon } from "./kit";
import type { CityRig, SiteDef, Vantage } from "./rig";
import { buildHead } from "./robotkit";

/** Stand-in while a scene is being built: a head on a post, named. */
export function placeholder(name: string): CityRig {
  const bin = new Bin();
  const object = new Group();
  const post = new Mesh(geo(bin, new CylinderGeometry(0.15, 0.2, 2.4, 8)), toon(bin, STEEL));
  post.position.y = 1.2;
  const head = buildHead(bin);
  head.group.position.y = 3;
  head.group.scale.setScalar(1.4);
  const tag = label(bin, name, { size: 0.4 });
  tag.position.y = 4.4;
  object.add(post, head.group, tag);
  return {
    object,
    update(ctx) {
      head.group.rotation.y = Math.sin(ctx.time) * 0.3;
    },
    dispose: () => bin.dispose(),
  };
}

export function fanVantages(count: number, radius: number, height: number, targetY: number): Vantage[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / Math.max(1, count - 1) - 0.5) * 1.4;
    return { eye: [Math.sin(a) * radius, height, Math.cos(a) * radius], target: [0, targetY, 0] };
  });
}

export function placeholderSite(id: string, stages: number, clear: number): SiteDef {
  return { id, clear, vantages: fanVantages(stages, clear * 0.9, clear * 0.4, 3), build: () => placeholder(id) };
}
