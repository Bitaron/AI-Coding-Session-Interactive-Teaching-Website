import {
  Clock,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Plane,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Section } from "../../v2/content/types";
import { events, store, type HotspotScreen, type Route } from "../../v2/core/state";
import { CameraRig, type Pose } from "../../v2/engine/camera-rig";
import { cityRig, siteDefs } from "../scenes";
import type { CityRig, Lod } from "../scenes/rig";
import { buildCity, type City } from "./city";
import { Courier } from "./courier";
import { InkPass } from "./ink";
import { findStation, layoutCity, regionPose, type CityLayout, type SitePlacement, type Station } from "./layout";
import { HAZE } from "./palette";
import { buildSky, SUN_DIR, type Sky } from "./sky";

const BUILD_RADIUS = 72;
const DISPOSE_RADIUS = 105;
const SITE_BUILD = 150;
const SITE_DISPOSE = 200;

interface Live {
  /** World placement: a station's position or a site's. */
  position: Vector3;
  rotation: number;
  rig: CityRig;
  /** For station rigs. */
  station?: Station;
  /** For site rigs. */
  site?: SitePlacement;
  pending: number;
  /** Stagger for the distant-update cadence. */
  slot: number;
}

export class WebGLUnavailable extends Error {}

/**
 * v3's world: same contract as v2's engine (reads the store, emits arrival
 * and hotspots, never touches the DOM outside its canvas) with a city in
 * place of the field-guide terrain. Differences from v2:
 *  - shared sites: stations whose cue names a site (house, warehouse,
 *    billboard) all look at one rig, which is told the focused stage;
 *  - a courier robot carries every camera flight;
 *  - the InkPass draws outlines, halftone and speed lines.
 */
export class Engine {
  readonly layout: CityLayout;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private cam: CameraRig;
  private post: InkPass;
  private city: City;
  private courier = new Courier();
  private sky: Sky = buildSky();
  private clock = new Clock();
  private stationRigs = new Map<number, Live>();
  private siteRigs = new Map<string, Live>();
  private cues: Section["steps"][number]["scene"][];
  private raf = 0;
  private time = 0;
  private frame = 0;
  private beat = 0;
  private beatKind = "";
  private evidence = -1;
  private scale = 1;
  private frameMs = 16.7;
  private size = new Vector2();
  private pointerNdc: Vector2 | null = null;
  private raycaster = new Raycaster();
  private groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  private focused: Station | null = null;
  private unsubscribers: (() => void)[] = [];
  private lastHotspotKey = "";
  private lastCam = new Vector3();
  private speed = 0;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement, sections: Section[]) {
    try {
      this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    } catch (err) {
      throw new WebGLUnavailable(String(err));
    }
    if (!this.renderer.getContext()) throw new WebGLUnavailable("no context");
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(HAZE, 1);

    this.layout = layoutCity(sections, siteDefs);
    this.cues = sections.flatMap((s) => s.steps.map((st) => st.scene));

    this.camera = new PerspectiveCamera(42, 1, 0.5, 1400);
    this.cam = new CameraRig(this.camera, { eye: this.layout.mapEye, target: this.layout.mapTarget });

    // Distance fades toward the colour of the horizon air, not to grey.
    this.scene.fog = new Fog(HAZE, 60, 300);
    // Toon materials band whatever light they get: a sky/ground fill plus
    // one low sun from the south-west gives every form a lit and a shaded side.
    // Warm sun, cool sky fill, green bounce from the ground: lit sides glow
    // gold, shaded sides go blue-green, as in a painted background.
    this.scene.add(new HemisphereLight(0xcfe4ff, 0xa9c58a, 1.25));
    const sun = new DirectionalLight(0xfff0d2, 2.7);
    sun.position.copy(SUN_DIR).multiplyScalar(120);
    this.scene.add(sun);

    this.city = buildCity(this.layout);
    this.scene.add(this.sky.group, this.city.group, this.courier.object, this.courier.ribbon);

    this.post = new InkPass(0);

    canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.bindPointer();
    this.unsubscribers.push(
      store.select((s) => s.route, (route) => {
        this.evidence = -1;
        this.goTo(route);
      }),
      store.select((s) => s.inset, () => this.resize()),
      store.select((s) => s.quality, () => this.resize()),
      events.on("beat", ({ kind }) => {
        this.beat = 1;
        this.beatKind = kind;
      }),
      events.on("evidence", ({ index }) => (this.evidence = index))
    );
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
    this.goTo(store.get().route);
    this.loop();
  }

  // --- navigation ----------------------------------------------------------

  private poseFor(route: Route | null): { pose: Pose; station: Station | null } {
    if (!route) return { pose: { eye: this.layout.mapEye, target: this.layout.mapTarget }, station: null };
    const station = findStation(this.layout, route);
    if (!station) {
      const region = this.layout.regions.find((r) => r.sectionId === route.sectionId);
      return { pose: region ? regionPose(region) : { eye: this.layout.mapEye, target: this.layout.mapTarget }, station: null };
    }
    return { pose: { eye: this.fitEye(station), target: station.target }, station };
  }

  /** On portrait screens, back off along the sightline until ~14 units fit across. */
  private fitEye(station: Station): Vector3 {
    const aspect = this.size.x / Math.max(1, this.size.y - store.get().inset.bottom);
    const vfov = (this.camera.fov * Math.PI) / 180;
    const halfH = Math.atan(Math.tan(vfov / 2) * aspect);
    const offset = station.eye.clone().sub(station.target);
    const width = station.site ? offset.length() * 0.62 : 8.6;
    const need = width / Math.tan(halfH);
    const k = Math.min(2.8, Math.max(1, need / offset.length()));
    return station.target.clone().addScaledVector(offset, k);
  }

  private async goTo(route: Route | null, immediate = false): Promise<void> {
    const { pose, station } = this.poseFor(route);
    this.focused = station;
    this.cam.resetOrbit();
    const { reducedMotion } = store.get();
    if (immediate || reducedMotion) {
      if (!immediate) await this.fade(1, 0.18);
      this.cam.cut(pose);
      if (!immediate) this.fade(0, 0.25);
      events.emit("arrived", route);
      return;
    }
    store.set({ travelling: true });
    await this.cam.flyTo(pose);
    if (this.focused === station) {
      store.set({ travelling: false });
      events.emit("arrived", route);
    }
  }

  private fade(to: number, seconds: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const from = to === 1 ? 0 : 1;
      const step = () => {
        const k = Math.min(1, (performance.now() - start) / (seconds * 1000));
        this.post.fade = from + (to - from) * k;
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
  }

  // --- rigs & sites --------------------------------------------------------

  private syncRigs(): void {
    const focus = this.cam.focus;
    for (const st of this.layout.stations) {
      if (st.site) continue;
      const d = Math.hypot(st.position.x - focus.x, st.position.z - focus.z);
      const live = this.stationRigs.get(st.index);
      if (!live && d < BUILD_RADIUS) {
        const cue = this.cues[st.index];
        const rig = cityRig(cue.rig)(cue.preset ?? {});
        this.place(rig, st.position, st.facing);
        this.stationRigs.set(st.index, { position: st.position, rotation: st.facing, rig, station: st, pending: 0, slot: st.index % 3 });
      } else if (live && d > DISPOSE_RADIUS && st !== this.focused) {
        this.drop(live);
        this.stationRigs.delete(st.index);
      }
    }
    this.layout.sites.forEach((site, i) => {
      const d = Math.hypot(site.position.x - focus.x, site.position.z - focus.z);
      const live = this.siteRigs.get(site.def.id);
      const focusedHere = this.focused?.site === site.def.id;
      if (!live && (d < SITE_BUILD || focusedHere)) {
        const rig = site.def.build();
        this.place(rig, site.position, site.rotation);
        this.siteRigs.set(site.def.id, { position: site.position, rotation: site.rotation, rig, site, pending: 0, slot: i % 3 });
      } else if (live && d > SITE_DISPOSE && !focusedHere) {
        this.drop(live);
        this.siteRigs.delete(site.def.id);
      }
    });
  }

  private place(rig: CityRig, position: Vector3, rotation: number): void {
    rig.object.position.copy(position);
    rig.object.rotation.y = rotation;
    this.scene.add(rig.object);
  }

  private drop(live: Live): void {
    this.scene.remove(live.rig.object);
    live.rig.dispose();
  }

  private isFocused(live: Live): boolean {
    if (!this.focused) return false;
    return live.station ? live.station === this.focused : live.site?.def.id === this.focused.site;
  }

  private lodFor(live: Live): Lod {
    const focused = this.isFocused(live);
    if (focused && !this.cam.flying) return 0;
    const d = this.camera.position.distanceTo(live.position);
    const near = live.site ? 90 : 36;
    if (store.get().quality === "low") return d < near * 0.8 ? 1 : 2;
    return d < near ? 1 : 2;
  }

  private pointerOnGround(live: Live): Vector3 | null {
    if (!this.pointerNdc) return null;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = new Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    return hit.sub(live.position).applyAxisAngle(new Vector3(0, 1, 0), -live.rotation);
  }

  // --- frame loop ----------------------------------------------------------

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    this.time += dt;
    this.frame++;
    this.adaptResolution(dt);

    this.cam.update(dt);
    this.updateFog();
    if (this.frame % 10 === 0) this.syncRigs();

    const params = store.get().params;
    this.beat = Math.max(0, this.beat - dt * 1.2);
    const all = [...this.stationRigs.values(), ...this.siteRigs.values()];
    for (const live of all) {
      const lod = this.lodFor(live);
      live.pending += dt;
      if (lod === 2 && this.frame % 3 !== live.slot) continue;
      const focused = this.isFocused(live);
      live.rig.update({
        time: this.time,
        dt: live.pending,
        params,
        pointer: focused ? this.pointerOnGround(live) : null,
        focused,
        beat: focused ? this.beat : 0,
        beatKind: this.beatKind,
        lod,
        stage: live.site && focused ? (this.focused?.stage ?? 0) : null,
        evidence: focused ? this.evidence : -1,
      });
      live.pending = 0;
    }

    this.city.update(this.time);
    this.sky.update(this.time, dt, this.camera);
    this.updateCourier(dt);
    if (this.frame % 2 === 0) this.projectHotspots();
    this.post.render(this.renderer, this.scene, this.camera, this.time);
  };

  private updateCourier(dt: number): void {
    const flying = this.cam.flying;
    // Speed lines follow how fast the camera is actually moving.
    const v = this.camera.position.distanceTo(this.lastCam) / Math.max(dt, 1e-3);
    this.lastCam.copy(this.camera.position);
    const goal = flying ? Math.min(1, Math.max(0, (v - 10) / 70)) : 0;
    this.speed += (goal - this.speed) * (1 - Math.exp(-5 * dt));
    this.post.speed = this.speed;

    let perch: Vector3 | null = null;
    let look: Vector3 | null = null;
    const st = this.focused;
    if (st && !flying) {
      // Hover in the upper right of the free view, a little in front of the scene.
      const eye = this.camera.position;
      const dir = st.target.clone().sub(eye);
      const dist = dir.length() * 0.85;
      dir.normalize();
      const right = dir.clone().cross(new Vector3(0, 1, 0)).normalize();
      const halfH = Math.tan(((this.camera.fov / 2) * Math.PI) / 180) * dist;
      const freeW = this.size.x - store.get().inset.left;
      const halfW = (halfH * freeW) / Math.max(1, this.size.y - store.get().inset.bottom);
      perch = eye.clone().addScaledVector(dir, dist).addScaledVector(right, halfW * 0.66).add(new Vector3(0, halfH * 0.42, 0));
      // Three-quarter view: half toward the scene, half toward the reader.
      look = st.target.clone().lerp(eye, 0.6);
    }
    this.courier.update(dt, this.time, this.camera, flying, perch, look);
  }

  private updateFog(): void {
    const fog = this.scene.fog as Fog;
    const h = Math.max(0, this.camera.position.y);
    fog.near = 45 + h * 2.2;
    fog.far = 260 + h * 3.2;
    this.post.lineFar = 110 + h * 1.5;
  }

  private adaptResolution(dt: number): void {
    const { quality } = store.get();
    this.frameMs = this.frameMs * 0.94 + dt * 1000 * 0.06;
    if (quality !== "auto" || this.frame % 30 !== 0) return;
    const prev = this.scale;
    if (this.frameMs > 19) this.scale = Math.max(0.5, this.scale - 0.08);
    else if (this.frameMs < 14) this.scale = Math.min(1, this.scale + 0.04);
    if (prev !== this.scale) this.applySize();
  }

  private projectHotspots(): void {
    let spots: { term: string; label: string; anchor: import("three").Object3D }[] = [];
    if (this.focused && !this.cam.flying) {
      const live = this.focused.site ? this.siteRigs.get(this.focused.site) : this.stationRigs.get(this.focused.index);
      spots = live?.rig.hotspots ?? [];
    }
    const w = this.size.x;
    const h = this.size.y;
    const p = new Vector3();
    const out: HotspotScreen[] = spots.map((s) => {
      s.anchor.getWorldPosition(p);
      p.project(this.camera);
      return {
        term: s.term,
        label: s.label,
        x: Math.round(((p.x + 1) / 2) * w),
        y: Math.round(((1 - p.y) / 2) * h),
        visible: p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1,
      };
    });
    const key = out.map((o) => `${o.term}${o.x >> 2},${o.y >> 2}`).join("|");
    if (key !== this.lastHotspotKey) {
      this.lastHotspotKey = key;
      events.emit("hotspots", out);
    }
  }

  // --- sizing --------------------------------------------------------------

  private resize = (): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.size.set(Math.max(1, rect.width), Math.max(1, rect.height));
    const { quality } = store.get();
    if (quality === "high") this.scale = 1;
    if (quality === "low") this.scale = 0.6;
    this.applySize();
  };

  private applySize(): void {
    const { quality, inset } = store.get();
    this.dpr = Math.min(window.devicePixelRatio || 1, quality === "low" ? 1 : 1.75);
    const w = this.size.x;
    const h = this.size.y;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    // Supersample for crisp edges: render up to ~2.2 pixels per CSS pixel
    // and let the ink pass average them down. Dynamic resolution scales this.
    const ss = quality === "low" ? 1 : Math.min(1.4, 2.2 / this.dpr);
    const scale = this.scale * ss;
    this.post.setSize(w * this.dpr, h * this.dpr, scale, this.dpr * scale);
    this.post.grain = quality === "low" ? 0.5 : 1;
    this.post.setCenter((inset.left + (w - inset.left) / 2) / w, 1 - (h - inset.bottom) / 2 / h);
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, -inset.left / 2, inset.bottom / 2, w, h);
    this.camera.fov = w < 700 ? 52 : 42;
    this.camera.updateProjectionMatrix();
  }

  // --- input ---------------------------------------------------------------

  private bindPointer(): void {
    let dragging = false;
    let lastX = 0;
    const toNdc = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      return new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    };
    this.canvas.addEventListener("pointermove", (e) => {
      const ndc = toNdc(e);
      this.pointerNdc = ndc;
      if (e.pointerType === "mouse") this.cam.setPointer(ndc.x, ndc.y);
      if (dragging) {
        this.cam.nudgeOrbit((e.clientX - lastX) * -0.004);
        lastX = e.clientX;
      }
    });
    this.canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      this.pointerNdc = toNdc(e);
      this.canvas.setPointerCapture(e.pointerId);
    });
    const end = (e: PointerEvent) => {
      dragging = false;
      if (e.pointerType !== "mouse") this.pointerNdc = null;
    };
    this.canvas.addEventListener("pointerup", end);
    this.canvas.addEventListener("pointercancel", end);
    this.canvas.addEventListener("pointerleave", () => {
      this.pointerNdc = null;
      this.cam.setPointer(null, null);
    });
    this.canvas.addEventListener("dblclick", () => this.cam.resetOrbit());
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (!this.raf) {
      this.clock.getDelta();
      this.loop();
    }
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    store.set({ webgl: false });
  };

  projectRegions(): { sectionId: string; x: number; y: number }[] {
    const p = new Vector3();
    return this.layout.regions.map((r) => {
      p.copy(r.center).project(this.camera);
      return { sectionId: r.sectionId, x: ((p.x + 1) / 2) * this.size.x, y: ((1 - p.y) / 2) * this.size.y };
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.unsubscribers.forEach((u) => u());
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    for (const live of [...this.stationRigs.values(), ...this.siteRigs.values()]) live.rig.dispose();
    this.stationRigs.clear();
    this.siteRigs.clear();
    this.city.dispose();
    this.sky.dispose();
    this.courier.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}
