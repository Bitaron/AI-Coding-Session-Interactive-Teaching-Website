import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from "three";

export interface Pose {
  eye: Vector3;
  target: Vector3;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Flies the camera between poses through one continuous space. Short hops
 * (next step) glide along the ground; long jumps (another section, the map)
 * arc upward so the visitor sees where they are going before landing.
 * Pointer parallax is layered on top so a parked camera still breathes.
 */
export class CameraRig {
  private eye = new Vector3();
  private target = new Vector3();
  private flight: {
    path: CatmullRomCurve3;
    lookFrom: Vector3;
    lookVia: Vector3;
    lookTo: Vector3;
    t: number;
    duration: number;
    resolve: () => void;
  } | null = null;
  private parallax = new Vector3();
  private parallaxGoal = new Vector3();
  private orbit = 0;
  private orbitGoal = 0;

  constructor(private camera: PerspectiveCamera, start: Pose) {
    this.eye.copy(start.eye);
    this.target.copy(start.target);
  }

  get flying(): boolean {
    return this.flight !== null;
  }

  /** Current (un-parallaxed) look target — used for LOD distances. */
  get focus(): Vector3 {
    return this.target;
  }

  cut(pose: Pose): void {
    this.flight?.resolve();
    this.flight = null;
    this.eye.copy(pose.eye);
    this.target.copy(pose.target);
  }

  flyTo(pose: Pose, speed = 1): Promise<void> {
    this.flight?.resolve();
    const from = this.eye.clone();
    const dist = from.distanceTo(pose.eye);
    const lift = Math.min(dist * 0.32, 150);
    const mid = from.clone().lerp(pose.eye, 0.5);
    mid.y = Math.max(from.y, pose.eye.y) + lift;
    const path = new CatmullRomCurve3([from, mid, pose.eye.clone()], false, "centripetal");
    const lookVia = this.target.clone().lerp(pose.target, 0.5);
    lookVia.y = Math.min(lookVia.y, 0);
    const duration = Math.min(Math.max(0.9 + dist / 140, 1.1), 3.4) / speed;
    return new Promise((resolve) => {
      this.flight = {
        path,
        lookFrom: this.target.clone(),
        lookVia,
        lookTo: pose.target.clone(),
        t: 0,
        duration,
        resolve,
      };
    });
  }

  /** Pointer in -1..1 NDC; null when the pointer leaves the canvas. */
  setPointer(x: number | null, y: number | null): void {
    if (x === null || y === null) this.parallaxGoal.set(0, 0, 0);
    else this.parallaxGoal.set(x * 0.9, y * 0.5, 0);
  }

  /** Drag-to-orbit around the parked station (radians, clamped). */
  nudgeOrbit(delta: number): void {
    this.orbitGoal = Math.max(-0.9, Math.min(0.9, this.orbitGoal + delta));
  }

  resetOrbit(): void {
    this.orbitGoal = 0;
  }

  update(dt: number): void {
    const f = this.flight;
    if (f) {
      f.t = Math.min(1, f.t + dt / f.duration);
      const k = easeInOut(f.t);
      f.path.getPoint(k, this.eye);
      // Quadratic Bézier for the look target: glance at the midpoint
      // terrain mid-flight so long jumps read as travelling over the map.
      const a = f.lookFrom.clone().lerp(f.lookVia, k);
      const b = f.lookVia.clone().lerp(f.lookTo, k);
      this.target.copy(a.lerp(b, k));
      if (f.t >= 1) {
        this.flight = null;
        f.resolve();
      }
    }

    const lerp = 1 - Math.exp(-4 * dt);
    this.parallax.lerp(this.parallaxGoal, lerp);
    this.orbit += (this.orbitGoal - this.orbit) * (1 - Math.exp(-6 * dt));

    // Orbit the eye around the target on the ground plane.
    const offset = this.eye.clone().sub(this.target);
    const c = Math.cos(this.orbit);
    const s = Math.sin(this.orbit);
    const ox = offset.x * c - offset.z * s;
    const oz = offset.x * s + offset.z * c;

    const right = new Vector3(ox, 0, oz).cross(new Vector3(0, 1, 0)).normalize();
    this.camera.position
      .set(this.target.x + ox, this.target.y + offset.y, this.target.z + oz)
      .addScaledVector(right, -this.parallax.x)
      .add(new Vector3(0, this.parallax.y, 0));
    this.camera.lookAt(this.target);
  }
}
