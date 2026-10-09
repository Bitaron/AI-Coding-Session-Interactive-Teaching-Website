# v3: the same guide as an anime/comic city, at /v3/

v3 retells v2's content as a city drawn in the style of anime and comics, painted after Studio Ghibli. West of a river is the old town (present-day, brick and timber), where software is built the traditional way. East of it is the new city, where robots do the building. It lives at `/v3/` as a third Vite entry (`v3/index.html` → `src/v3/main.ts`). v1 at `/` and v2 at `/v2/` are untouched apart from the shared shell described below. `public/404.html` keeps two path segments for `/v3/` deep links, exactly as it does for `/v2/`.

**One shell, two worlds.** v2's composition root became `src/v2/app.ts` (`boot()`), and a small `src/v2/core/edition.ts` holds the URL slug and the map copy. Each edition's `main.ts` sets its edition and passes its own engine to `boot()`. The reading panel, dial, router, replays, deep-dive dialogs, hotspots and sound are shared, and so is the content (sections, glossary, screenshots). v3 does not fork the text. `src/v3/content/cues.ts` swaps only each step's scene cue, scene caption and knobs at startup, and it throws if a step has no city scene. v2 gained one small hook: hovering a screenshot thumbnail emits an `evidence` event, so a scene can point at the part that screenshot stands for.

**Its own engine, same contract.** `src/v3/engine/` copies v2's engine shape: it reads the store, flies the camera, builds and disposes rigs by distance, uses LOD tiers and dynamic resolution, and falls back to static mode. On top of that it adds:
- *Shared sites.* The old house, the warehouse and the billboard are each one object that several stations look at from their own vantages. A station's cue names the site and a `stage`, and the site rig is told the focused stage. That is what lets the backend example raise one warehouse a screenshot at a time (55 parts), the frontend example build one billboard (22 parts, ending on a capture of v1), and the final example renovate the intro's old house.
- *A courier robot.* A small jet-pack robot carries every camera flight: it flies ahead of the camera, then hovers at the edge of the scene. This is the "transition by a robot", and it is the only thing that moves between stations.
- *The ink pass* (`ink.ts`). In one post-processing draw it adds:
  - outlines from the Laplacian of 1/depth, which is zero on flat faces and non-zero at silhouettes and creases;
  - halftone dots in shaded tones;
  - speed lines while travelling;
  - paper grain.

  Together with three-step toon materials this gives the cel-shaded comic look without per-mesh outline geometry.
- *The city* (`city.ts`): instanced filler buildings with windows painted from world position, kept out of every camera's sightline, plus a river, a bridge, a ring avenue, an elevated train and a central tower topped by a giant robot head, which works as the map's landmark.

**The cast is built from one kit.** `src/v3/scenes/robotkit.ts` provides:
- a chibi mecha head (white armour, ink visor, cyan eyes, orange crest, and an optional flip-top skull with a bay inside, used for the context drive and visible thinking);
- a body with two-bone-IK arms and a walk cycle, with a chest token meter;
- plain human figures for the old town.

Comic conventions are used only where they carry meaning:
- balloons tell you who is talking: round for a human, square for a machine, a cloud for thinking, spiky for a human catch;
- caption boxes are narration;
- one sound effect marks one event.

**Painted like a Ghibli town.** The developer asked for the look and motion of Studio Ghibli films, sharper and more vibrant. Most of the treatment is painterly; the ink outlines and speed lines are the comic part:
- a gradient sky dome (deep zenith blue to a pale, hazy horizon, warm near the sun) with painted cumulus clouds drifting at the edge of the world;
- fog in the horizon's colour, so distance turns toward the sky, not grey;
- a warm sun with a cool sky fill and green ground bounce;
- a painted meadow under almost everything, white towers with sky-glass windows and rooftop gardens, an old town of plaster walls and terracotta roofs, a blue river;
- lumpy multi-green trees that sway in the breeze, and a few flocks of birds;
- the guide robot crouches before take-off and settles with a squash on landing (anticipation and follow-through), and its scarf flutters.

For sharpness, the scene renders supersampled (up to ~2.2 render pixels per CSS pixel, still under dynamic resolution) and the ink pass averages it down. Halftone shrinks to an accent in the deepest shade, grain is faint, and a mild vibrance lift saturates the image.

**Colour stays functional.** Orange and green keep v1/v2's meanings (problem / pass). Cyan is the one new signal: it marks the machine side, such as eyes, holograms and generated text.

**Three skills as one maze.** In the backend brief, the agent says it will chart a wayfinder map and "pin down the destination via grilling + domain-modeling". The warehouse site's first two stages show this as a modern-jungle maze between the road and the plot:
- *Wayfinder:* the agent explores the maze, hits dead ends and charts every cell it walks.
- *Grilling:* at each fork it asks the human on the terrace, giving its own recommendation; some answers overrule it.
- *Domain modeling:* every answer goes into a hologram map, and once the map is complete the agent walks the maze without asking.

From stage 2 on, the hedges sink, leaving the charted route.

**Providers are different machines.** The model-comparison station gives each company's models their own robot build (invented silhouettes, not logos); the two Grok versions are siblings. Each robot holds its own effort dial.

**A page finder.** A "pages" button in the top bar (or `/`) opens a searchable list of every station. Search matches titles first, then section, lede, scene caption and scene or site names, at word starts. Choosing a page flies there like any other jump, guide robot and all. It is an option of the shared shell, enabled for v3.

Considered and rejected:
- *Re-skinning v2's rigs with toon materials.* Jellyfish and mycelium don't belong in a city, and the brief asked for robots.
- *Per-mesh inverted-hull outlines.* They double the draw calls and miss instanced buildings.
- *A generic engine shared by v2 and v3.* The engines differ in sites, the courier and the post pass, and two readable ~450-line files beat one configurable one.
