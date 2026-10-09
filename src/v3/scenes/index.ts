import { archive } from "./archive";
import { blueprint } from "./blueprint";
import { cartridges } from "./cartridges";
import { conveyor } from "./conveyor";
import { crane } from "./crane";
import { drones } from "./drones";
import { gate } from "./gate";
import { gauges } from "./gauges";
import { head } from "./head";
import { printer } from "./printer";
import type { CityRigFactory, SiteDef } from "./rig";
import { robot } from "./robot";
import { billboardSite } from "./sites/billboard";
import { houseSite } from "./sites/house";
import { warehouseSite } from "./sites/warehouse";
import { transit } from "./transit";

/** Every station scene in the city. Site stations use `site` (see siteDefs). */
const factories: Record<string, CityRigFactory> = {
  head,
  robot,
  gauges,
  crane,
  drones,
  cartridges,
  gate,
  transit,
  archive,
  blueprint,
  printer,
  conveyor,
};

export function cityRig(id: string): CityRigFactory {
  const f = factories[id];
  if (!f) throw new Error(`Unknown city rig: ${id}`);
  return f;
}

/** The shared building sites, by id. */
export const siteDefs: Record<string, SiteDef> = {
  house: houseSite,
  warehouse: warehouseSite,
  billboard: billboardSite,
};
