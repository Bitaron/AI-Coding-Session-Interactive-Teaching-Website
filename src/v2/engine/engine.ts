import {
  ACESFilmicToneMapping,
  Clock,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Raycaster,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Section } from "../content/types";
import { events, store, type HotspotScreen, type Route } from "../core/state";
import { rigFactories } from "../scenes";
import type { Lod, Rig } from "../scenes/rig";
import { CameraRig, type Pose } from "./camera-rig";
import { buildGround, setGroundFog } from "./ground";
import { INK, PAPER } from "./palette";
import { PaperPass } from "./post";
import { findStation, layoutWorld, regionPose, type Station, type WorldLayout } from "./world";

const BUILD_RADIUS = 72;
const DISPOSE_RADIUS = 105;

interface Live {
  station: Station;
  rig: Rig;
  /** dt accumulated while this rig was skipped by its LOD's update cadence. */
  pending: number;
}

/** Thrown when WebGL can't start; the UI switches to its static fallback. */
export class WebGLUnavailable extends Error {}

/**
 * The single persistent 3D world. Owns the renderer, the camera rig, the
 * ground and every station's rig; listens to the shared store for route,
 * params, quality and layout inset. It never touches the DOM outside its
 * own canvas.
 */
export class Engine {
  readonly layout: WorldLayout;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private cam: CameraRig;
  private post: PaperPass;
  private clock = new Clock();
  private live = new Map<number, Live>();
  private cues: Section["steps"][number]["scene"][];
  private raf = 0;
  private time = 0;
  private frame = 0;
  private beat = 0;
  private beatKind = "";
  private scale = 1;
  private frameMs = 16.7;
  private size = new Vector2();
  private pointerNdc: Vector2 | null = null;
  private raycaster = new Raycaster();
  private groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  private focused: Station | null = null;
  private unsubscribers: (() => void)[] = [];
  private ground: Group;
  private disposeGround: () => void;
  private lastHotspotKey = "";

  constructor(private canvas: HTMLCanvasElement, sections: Section[]) {
    try {
      this.renderer = new WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
      });
    } catch (err) {
      throw new WebGLUnavailable(String(err));
    }
    if (!this.renderer.getContext()) throw new WebGLUnavailable("no context");

    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(PAPER, 1);

    this.layout = layoutWorld(sections);
    this.cues = sections.flatMap((s) => s.steps.map((st) => st.scene));

    this.camera = new PerspectiveCamera(42, 1, 0.5, 1400);
    this.cam = new CameraRig(this.camera, { eye: this.layout.mapEye, target: this.layout.mapTarget });

    this.scene.background = PAPER.clone();
    this.scene.fog = new Fog(PAPER, 60, 260);
    this.scene.add(new HemisphereLight(0xfffaf0, 0xb8ab92, 1.6));
    const sun = new DirectionalLight(0xfff3e0, 1.4);
    sun.position.set(40, 80, 30);
    this.scene.add(sun);

    const ground = buildGround(this.layout);
    this.scene.add(ground.group);
    this.ground = ground.group;
    this.disposeGround = ground.dispose;
    this.scene.add(this.buildPedestals());

    const isWebGL2 = this.renderer.capabilities.isWebGL2;
    this.post = new PaperPass(isWebGL2 && store.get().quality !== "low" ? 4 : 0);

    canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.bindPointer();
    this.unsubscribers.push(
      store.select((s) => s.route, (route) => this.goTo(route)),
      store.select((s) => s.inset, () => this.resize()),
      store.select((s) => s.quality, () => this.resize()),
      events.on("beat", ({ kind }) => {
        this.beat = 1;
        this.beatKind = kind;
      })
    );
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
    // First load flies in from the map, so a deep link still shows where it is.
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

  /**
   * Stations are composed ~12 units wide. On portrait screens the camera
   * backs off along its own sightline until that width fits horizontally.
   */
  private fitEye(station: Station): Vector3 {
    const aspect = this.size.x / Math.max(1, this.size.y - store.get().inset.bottom);
    const vfov = (this.camera.fov * Math.PI) / 180;
    const halfH = Math.atan(Math.tan(vfov / 2) * aspect);
    const need = 7.2 / Math.tan(halfH);
    const offset = station.eye.clone().sub(station.target);
    const k = Math.min(2.8, Math.max(1, need / offset.length()));
    return station.target.clone().addScaledVector(offset, k);
  }

  private async goTo(route: Route | null, immediate = false): Promise<void> {
    const { pose, station } = this.poseFor(route);
    this.focused = station;
    this.cam.resetOrbit();
    const { reducedMotion } = store.get();
    if (immediate || reducedMotion) {
      // Reduced motion: a short paper fade instead of a flight.
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

  // --- stations & rigs -----------------------------------------------------

  private buildPedestals(): Group {
    const group = new Group();
    const geo = new RingGeometry(4.6, 4.75, 64);
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.35, fog: true });
    const rings = new InstancedMesh(geo, mat, this.layout.stations.length);
    const m = new Matrix4();
    this.layout.stations.forEach((st, i) => {
      m.makeTranslation(st.position.x, 0.02, st.position.z);
      rings.setMatrixAt(i, m);
    });
    group.add(rings);
    return group;
  }

  private syncRigs(): void {
    const focus = this.cam.focus;
    for (const st of this.layout.stations) {
      const d = Math.hypot(st.position.x - focus.x, st.position.z - focus.z);
      const live = this.live.get(st.index);
      if (!live && d < BUILD_RADIUS) {
        const cue = this.cues[st.index];
        const rig = rigFactories[cue.rig](cue.preset ?? {});
        rig.object.position.copy(st.position);
        // Face each rig toward its camera so compositions read as authored.
        rig.object.rotation.y = Math.atan2(st.eye.x - st.position.x, st.eye.z - st.position.z);
        this.scene.add(rig.object);
        this.live.set(st.index, { station: st, rig, pending: 0 });
      } else if (live && d > DISPOSE_RADIUS && live.station !== this.focused) {
        this.scene.remove(live.rig.object);
        live.rig.dispose();
        this.live.delete(st.index);
      }
    }
  }

  private lodFor(live: Live): Lod {
    if (live.station === this.focused && !this.cam.flying) return 0;
    const d = this.camera.position.distanceTo(live.station.position);
    if (store.get().quality === "low") return d < 30 ? 1 : 2;
    return d < 36 ? (live.station === this.focused ? 0 : 1) : 2;
  }

  private pointerOnGround(st: Station): Vector3 | null {
    if (!this.pointerNdc) return null;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = new Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    const local = hit.sub(st.position);
    const live = this.live.get(st.index);
    if (live) local.applyAxisAngle(new Vector3(0, 1, 0), -live.rig.object.rotation.y);
    return local;
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
    for (const live of this.live.values()) {
      const lod = this.lodFor(live);
      // Distant rigs tick at a third of the rate; their dt accumulates.
      live.pending += dt;
      if (lod === 2 && this.frame % 3 !== live.station.index % 3) continue;
      const focused = live.station === this.focused;
      live.rig.update({
        time: this.time,
        dt: live.pending,
        params,
        pointer: focused ? this.pointerOnGround(live.station) : null,
        focused,
        beat: focused ? this.beat : 0,
        beatKind: this.beatKind,
        lod,
      });
      live.pending = 0;
    }

    if (this.frame % 2 === 0) this.projectHotspots();
    const fog = this.scene.fog as Fog;
    setGroundFog(this.ground, fog.near, fog.far, this.time);
    this.post.render(this.renderer, this.scene, this.camera, this.time);
  };

  /** Fog follows altitude: tight at ground level, opened up for the map view. */
  private updateFog(): void {
    const fog = this.scene.fog as Fog;
    const h = Math.max(0, this.camera.position.y);
    fog.near = 22 + h * 1.15;
    fog.far = 105 + h * 2.0;
  }

  /**
   * Dynamic resolution: an exponential moving average of frame time steers
   * the offscreen render scale between 0.5× and 1× so heavy scenes on weak
   * GPUs trade sharpness for a steady frame rate instead of stuttering.
   */
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
    const live = this.focused ? this.live.get(this.focused.index) : undefined;
    const spots = !this.cam.flying && live?.rig.hotspots ? live.rig.hotspots : [];
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
    const dpr = Math.min(window.devicePixelRatio || 1, quality === "low" ? 1 : 1.75);
    const w = this.size.x;
    const h = this.size.y;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w * dpr, h * dpr, this.scale);
    this.post.grain = quality === "low" ? 0.5 : 1;
    this.camera.aspect = w / h;
    // Shift the projection centre into the part of the screen the reading
    // panel leaves free, without moving the camera itself.
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

  /** World-space screen position of a region label, for the map's DOM labels. */
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
    for (const live of this.live.values()) live.rig.dispose();
    this.live.clear();
    this.disposeGround();
    this.post.dispose();
    this.renderer.dispose();
  }
}
