import type { RigId } from "../content/types";
import { colony } from "./colony";
import { loom } from "./loom";
import { mobile } from "./mobile";
import { mycelium } from "./mycelium";
import { organism } from "./organism";
import { origami } from "./origami";
import { pool } from "./pool";
import type { RigFactory } from "./rig";
import { strata } from "./strata";
import { tumbler } from "./tumbler";

const rigFactories: Record<RigId, RigFactory> = {
  colony,
  loom,
  pool,
  organism,
  tumbler,
  origami,
  strata,
  mycelium,
  mobile,
};

export function rigFactory(id: string): RigFactory {
  const factory = (rigFactories as Record<string, RigFactory | undefined>)[id];
  if (!factory) throw new Error(`Unknown rig: ${id}`);
  return factory;
}
