import { Vector3 } from "three";
import type { Section } from "../content/types";
import type { Route } from "../core/state";

/**
 * The unified space. Each section is a region of one continuous map; its
 * steps are stations laid along an ammonite spiral around the region's
 * centre, so moving to the next step is a short walk and jumping sections
 * is a flight across the map. Pure geometry — no three.js scene objects.
 */

export interface Station {
  route: Route;
  /** Global index across all sections, used for stake numbering. */
  index: number;
  position: Vector3;
  /** Where the camera parks to frame this station. */
  eye: Vector3;
  /** What the camera looks at while parked. */
  target: Vector3;
}

export interface Region {
  sectionId: string;
  label: string;
  center: Vector3;
  radius: number;
}

export interface WorldLayout {
  stations: Station[];
  regions: Region[];
  mapEye: Vector3;
  mapTarget: Vector3;
}

const REGION_RING = 210;
const STATION_SPACING = 17;

export function layoutWorld(sections: Section[]): WorldLayout {
  const stations: Station[] = [];
  const regions: Region[] = [];
  let index = 0;

  sections.forEach((section, s) => {
    const a = (s / sections.length) * Math.PI * 2 + Math.PI * 0.25;
    const center = new Vector3(Math.cos(a) * REGION_RING, 0, Math.sin(a) * REGION_RING);
    let theta = s * 1.3;
    let r = 10;
    let radius = r;

    section.steps.forEach((_, k) => {
      // Advance along an Archimedean spiral by a roughly constant arc length,
      // so long sections coil outward instead of trailing off-map.
      if (k > 0) {
        theta += STATION_SPACING / Math.max(r, 8);
        r = 10 + theta * 4.2 - s * 1.3 * 4.2;
      }
      const position = new Vector3(
        center.x + Math.cos(theta) * r,
        0,
        center.z + Math.sin(theta) * r
      );
      const outward = new Vector3(Math.cos(theta), 0, Math.sin(theta));
      const eye = position
        .clone()
        .addScaledVector(outward, 13)
        .add(new Vector3(0, 5.2, 0));
      const target = position.clone().add(new Vector3(0, 2.0, 0));
      stations.push({ route: { sectionId: section.id, stepIndex: k }, index: index++, position, eye, target });
      radius = Math.max(radius, r);
    });

    regions.push({ sectionId: section.id, label: section.label, center, radius: radius + 18 });
  });

  return {
    stations,
    regions,
    mapEye: new Vector3(40, 660, 330),
    mapTarget: new Vector3(40, 0, 40),
  };
}

export function findStation(layout: WorldLayout, route: Route): Station | undefined {
  return layout.stations.find(
    (st) => st.route.sectionId === route.sectionId && st.route.stepIndex === route.stepIndex
  );
}

/** A region overview: camera hovers above the section's spiral. */
export function regionPose(region: Region): { eye: Vector3; target: Vector3 } {
  const outward = region.center.clone().setY(0).normalize();
  return {
    eye: region.center
      .clone()
      .addScaledVector(outward, region.radius * 1.1)
      .add(new Vector3(0, region.radius * 1.3, 0)),
    target: region.center.clone(),
  };
}
