import { Vector3 } from "three";
import type { Section } from "../../v2/content/types";
import type { Route } from "../../v2/core/state";
import type { SiteDef } from "../scenes/rig";

/**
 * The city map. West of the river is the old town, where software gets
 * built the traditional way (and where the old house stands). East of it,
 * the new city: the Intro's stations line a curved avenue round the
 * central plaza, the backend warehouse rises in the east docks, the
 * frontend billboard faces the plaza from the south, and the sandbox sits
 * in the plaza itself. Pure geometry — no scene objects.
 */

export interface Station {
  route: Route;
  index: number;
  position: Vector3;
  eye: Vector3;
  target: Vector3;
  /** Rig yaw so its +z faces the camera. */
  facing: number;
  /** Set when this station looks at a shared site instead of its own rig. */
  site?: string;
  stage?: number;
}

export interface Region {
  sectionId: string;
  label: string;
  center: Vector3;
  radius: number;
}

export interface SitePlacement {
  def: SiteDef;
  position: Vector3;
  rotation: number;
}

export interface CityLayout {
  stations: Station[];
  regions: Region[];
  sites: SitePlacement[];
  mapEye: Vector3;
  mapTarget: Vector3;
  /** x of the river's centre line: old town is west of it. */
  riverX: number;
  /** The avenue's ring radius around the plaza. */
  avenue: number;
}

export const RIVER_X = -165;
export const AVENUE_R = 120;

/** Where each shared site stands, and which way its front (+z) faces. */
const SITE_POSE: Record<string, { x: number; z: number; rotation: number }> = {
  // Front faces east, so the old town is the backdrop.
  house: { x: -222, z: 64, rotation: Math.PI / 2 },
  // Front faces west, toward the plaza.
  warehouse: { x: 222, z: 78, rotation: -Math.PI / 2 },
  // Faces north, across the plaza.
  billboard: { x: 18, z: 214, rotation: Math.PI },
};

/** Intro stations (after the first) along the avenue: angles in degrees, x = cos, z = sin. */
const AVENUE_FROM = 190;
const AVENUE_TO = 350;

export function layoutCity(sections: Section[], siteDefs: Record<string, SiteDef>): CityLayout {
  const stations: Station[] = [];
  const regions: Region[] = [];
  const sites = new Map<string, SitePlacement>();
  let index = 0;

  const placeSite = (id: string): SitePlacement => {
    let s = sites.get(id);
    if (!s) {
      const def = siteDefs[id];
      const pose = SITE_POSE[id];
      if (!def || !pose) throw new Error(`Unknown site: ${id}`);
      s = { def, position: new Vector3(pose.x, 0, pose.z), rotation: pose.rotation };
      sites.set(id, s);
    }
    return s;
  };
  const toWorld = (s: SitePlacement, p: [number, number, number]) =>
    new Vector3(...p).applyAxisAngle(new Vector3(0, 1, 0), s.rotation).add(s.position);

  for (const section of sections) {
    const avenueSteps = section.steps.filter((st) => !st.scene.preset?.site).length;
    let k = 0;
    section.steps.forEach((step, stepIndex) => {
      const route = { sectionId: section.id, stepIndex };
      const site = step.scene.preset?.site;
      if (typeof site === "string") {
        const placement = placeSite(site);
        const stage = Number(step.scene.preset?.stage ?? 0);
        const v = placement.def.vantages[stage];
        if (!v) throw new Error(`Site ${site} has no vantage for stage ${stage}`);
        stations.push({
          route,
          index: index++,
          position: placement.position.clone(),
          eye: toWorld(placement, v.eye),
          target: toWorld(placement, v.target),
          facing: placement.rotation,
          site,
          stage,
        });
        return;
      }
      let position: Vector3;
      let outward: Vector3;
      if (section.id === "sandbox") {
        // A small arc in the plaza, looking north at the central tower.
        const a = ((55 + (k / Math.max(1, avenueSteps - 1)) * 70) * Math.PI) / 180;
        outward = new Vector3(Math.cos(a), 0, Math.sin(a));
        position = outward.clone().multiplyScalar(30);
      } else {
        const t = avenueSteps > 1 ? k / (avenueSteps - 1) : 0;
        const a = ((AVENUE_FROM + t * (AVENUE_TO - AVENUE_FROM)) * Math.PI) / 180;
        outward = new Vector3(Math.cos(a), 0, Math.sin(a));
        position = outward.clone().multiplyScalar(AVENUE_R);
      }
      // The camera stands outside the station looking in, so the backdrop
      // is always the new city: the plaza and the central tower.
      const eye = position.clone().addScaledVector(outward, 17).add(new Vector3(0, 6.6, 0));
      const target = position.clone().add(new Vector3(0, 2.4, 0));
      stations.push({
        route,
        index: index++,
        position,
        eye,
        target,
        facing: Math.atan2(eye.x - position.x, eye.z - position.z),
      });
      k++;
    });

    // Label a region where most of it is: the Intro's one station at the
    // old house shouldn't drag its label across the river.
    const all = stations.filter((s) => s.route.sectionId === section.id);
    const onAvenue = all.filter((s) => !s.site);
    const own = onAvenue.length ? onAvenue : all;
    const center = own.reduce((c, s) => c.add(s.position), new Vector3()).divideScalar(own.length);
    const radius = Math.max(30, ...own.map((s) => s.position.distanceTo(center))) + 20;
    regions.push({ sectionId: section.id, label: section.label, center, radius });
  }

  return {
    stations,
    regions,
    sites: [...sites.values()],
    mapEye: new Vector3(-10, 720, 560),
    mapTarget: new Vector3(-10, 0, 40),
    riverX: RIVER_X,
    avenue: AVENUE_R,
  };
}

export function findStation(layout: CityLayout, route: Route): Station | undefined {
  return layout.stations.find((st) => st.route.sectionId === route.sectionId && st.route.stepIndex === route.stepIndex);
}

export function regionPose(region: Region): { eye: Vector3; target: Vector3 } {
  const outward = region.center.clone().setY(0).normalize();
  return {
    eye: region.center.clone().addScaledVector(outward, region.radius * 1.1).add(new Vector3(0, region.radius * 1.3, 0)),
    target: region.center.clone(),
  };
}
