import { Color } from "three";

// v3's city, painted the way Studio Ghibli paints a town: a deep blue sky
// fading to a pale, hazy horizon; warm sunlight; saturated greens; white
// walls and terracotta roofs. Distance turns everything toward the sky
// colour (aerial perspective) instead of grey.
//
// Orange and green stay functional (problem / pass). Cyan marks the
// machine side — robot eyes, holograms, anything "generated".

/** UI paper, the reduced-motion fade and comic balloons. */
export const PAPER = new Color("#ece7dc");
export const INK = new Color("#2a2420");
export const ORANGE = new Color("#f0631e");
export const GREEN = new Color("#1f9a5a");
export const CYAN = new Color("#1fb4d2");
/** Comic narration boxes. */
export const CAPTION = new Color("#f2e2a0");

// Sky
export const SKY_TOP = new Color("#3f8fd6");
export const SKY_HORIZON = new Color("#d9ecf2");
/** Fog and the far city: the colour of air at the horizon. */
export const HAZE = new Color("#cfe4ec");

// Machines
export const ARMOR = new Color("#fbf8f1");
export const STEEL = new Color("#c7d6dc");
export const GLASS = new Color("#7cc4d8");

// Old town
export const BRICK = new Color("#cf6a43");
export const CONCRETE = new Color("#efe2c4");
export const TIMBER = new Color("#9a6840");
export const ROOF = new Color("#c4553a");
export const LEAF = new Color("#4f9a45");

// Ground
export const GRASS = new Color("#86b862");
export const GROUND = new Color("#ece2c6");
export const ASPHALT = new Color("#8e8a84");
export const WATER = new Color("#5fb3cc");
