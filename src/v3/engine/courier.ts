import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  PerspectiveCamera,
  Vector3,
} from "three";
import { Bin, geo, glow, toon } from "../scenes/kit";
import { buildBody, type RobotBody } from "../scenes/robotkit";
import { ORANGE, STEEL } from "./palette";

const SCARF = 9;

/**
 * The guide. Every transition is carried by this small jet-pack robot: when
 * the camera sets off it swoops into frame and flies ahead, scarf
 * streaming, so a jump across the map reads as being taken somewhere;
 * on arrival it peels off and hovers at the edge of the scene, watching.
 * It is the "transition by a robot", and the only thing that moves between
 * stations — the stations themselves never do.
 */
export class Courier {
  readonly object = new Group();
  private bin = new Bin();
  private body: RobotBody;
  private flames: Mesh[] = [];
  private scarf: Mesh;
  private scarfPos: Float32Array;
  private trail: Vector3[] = [];
  private rel = new Vector3(0, -3, 6);
  private last = new Vector3();
  private vel = new Vector3();
  private lean = 0;
  private ready = false;
  // Squash-and-stretch spring: a crouch before take-off, a settle on landing.
  private wasFlying = false;
  private flutter = 0;
  private squash = 0;
  private squashVel = 0;

  constructor() {
    const b = this.bin;
    this.body = buildBody(b);
    this.body.group.scale.setScalar(0.62);
    this.object.add(this.body.group);

    // Jet pack: two pods on the back, a flame under each.
    const pack = new Group();
    pack.position.set(0, 0.95, -0.28);
    this.body.torso.add(pack);
    for (const side of [-1, 1]) {
      const pod = new Mesh(geo(b, new CylinderGeometry(0.1, 0.12, 0.42, 12)), toon(b, STEEL));
      pod.position.set(side * 0.15, 0, 0);
      pack.add(pod);
      // Tip down, base at the origin, so scaling y lengthens the flame.
      const flame = new Mesh(geo(b, new ConeGeometry(0.09, 0.5, 10).rotateX(Math.PI).translate(0, -0.25, 0)), glow(b, ORANGE));
      flame.position.set(side * 0.15, -0.22, 0);
      pack.add(flame);
      this.flames.push(flame);
    }

    // The scarf is a ribbon through the neck's recent positions, in world space.
    this.scarfPos = new Float32Array(SCARF * 2 * 3);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(this.scarfPos, 3));
    const index: number[] = [];
    for (let i = 0; i < SCARF - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(index);
    this.scarf = new Mesh(geo(b, g), toon(b, ORANGE, { side: DoubleSide, emissive: ORANGE, emissiveIntensity: 0.15 }));
    this.scarf.frustumCulled = false;
  }

  /** The scarf lives in world space, so it is added to the scene, not the robot. */
  get ribbon(): Mesh {
    return this.scarf;
  }

  /**
   * `perch` is where to hover while parked (world space), or null on the
   * map, where the guide waits out of sight.
   */
  update(dt: number, time: number, camera: PerspectiveCamera, flying: boolean, perch: Vector3 | null, lookAt: Vector3 | null): void {
    const forward = camera.getWorldDirection(new Vector3());
    const up = new Vector3(0, 1, 0);
    const right = forward.clone().cross(up).normalize();
    const camUp = right.clone().cross(forward).normalize();

    let goal: Vector3;
    const hidden = !flying && !perch;
    if (flying) {
      // Ahead of the camera and a touch below, swaying.
      goal = camera.position
        .clone()
        .addScaledVector(forward, 8.5)
        .addScaledVector(camUp, -1.6 + Math.sin(time * 2.1) * 0.25)
        .addScaledVector(right, Math.sin(time * 1.3) * 0.7);
    } else if (perch) {
      goal = perch.clone().add(new Vector3(0, Math.sin(time * 1.8) * 0.18, 0));
    } else {
      goal = camera.position.clone().addScaledVector(camUp, 40);
    }
    // Damp in camera-relative space: the guide keeps up with any flight
    // speed, but still eases into and out of its slot.
    const relGoal = goal.sub(camera.position);
    if (!this.ready) {
      this.rel.copy(relGoal);
      this.ready = true;
    }
    this.rel.lerp(relGoal, 1 - Math.exp(-(flying ? 5 : 2.6) * dt));
    const pos = camera.position.clone().add(this.rel);
    this.vel.lerp(pos.clone().sub(this.last).divideScalar(Math.max(dt, 1e-3)), 1 - Math.exp(-6 * dt));
    this.last.copy(pos);
    this.object.position.copy(pos);
    this.object.visible = !hidden && camera.position.y < 160;
    this.scarf.visible = this.object.visible;

    // Face the way it's going when moving fast; otherwise watch the scene.
    const speed = this.vel.length();
    const heading = speed > 4 ? this.vel.clone().setY(0) : lookAt ? lookAt.clone().sub(pos).setY(0) : forward.clone().setY(0);
    if (heading.lengthSq() > 1e-4) {
      const yaw = Math.atan2(heading.x, heading.z);
      let d = yaw - this.object.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.object.rotation.y += d * (1 - Math.exp(-6 * dt));
    }
    // Superhero lean while flying; upright when hovering.
    const leanGoal = Math.min(1, speed / 25) * 1.15;
    this.lean += (leanGoal - this.lean) * (1 - Math.exp(-4 * dt));
    this.body.group.rotation.x = this.lean;
    if (flying !== this.wasFlying) {
      this.squashVel += flying ? 9 : 7;
      this.wasFlying = flying;
    }
    this.squashVel += (-70 * this.squash - 9 * this.squashVel) * dt;
    this.squash += this.squashVel * dt;
    const sq = Math.max(-0.4, Math.min(0.4, this.squash));
    this.body.group.scale.set(0.62 * (1 + sq * 0.35), 0.62 * (1 - sq * 0.55), 0.62 * (1 + sq * 0.35));
    this.body.head.group.rotation.x = -this.lean * 0.7;
    const k = Math.min(1, speed / 25);
    this.body.reach("R", new Vector3(0.45, 1.25 + k * 0.6, 0.3 + k * 0.5), 0.3 + k * 0.7);
    this.body.reach("L", new Vector3(-0.5, 0.85, -0.1 - k * 0.2), 0.6);
    this.body.legL.root.rotation.x = -0.15 - k * 0.25 + Math.sin(time * 3) * 0.08;
    this.body.legR.root.rotation.x = 0.1 - k * 0.1 - Math.sin(time * 3) * 0.08;
    this.body.legL.joint.rotation.x = 0.4;
    this.body.legR.joint.rotation.x = 0.6;
    this.body.head.setEyes(1);
    for (const f of this.flames) f.scale.set(1, 0.6 + k * 0.8 + Math.sin(time * 40 + f.id) * 0.1, 1);

    this.updateScarf(dt, right);
  }

  private updateScarf(dt: number, right: Vector3): void {
    this.flutter += dt;
    this.object.updateMatrixWorld();
    const neck = this.body.neck.getWorldPosition(new Vector3());
    // Each point trails the one before it with a little droop.
    if (this.trail.length !== SCARF) this.trail = Array.from({ length: SCARF }, () => neck.clone());
    this.trail[0].copy(neck);
    for (let i = 1; i < SCARF; i++) {
      const p = this.trail[i];
      p.y -= dt * 0.6;
      // The breeze lifts and flutters the loose end.
      p.x += Math.sin(this.flutter * 7 + i * 0.9) * dt * 0.35 * (i / SCARF);
      p.y += Math.cos(this.flutter * 5 + i * 1.3) * dt * 0.25 * (i / SCARF);
      const prev = this.trail[i - 1];
      const d = p.clone().sub(prev);
      const len = d.length();
      const seg = 0.09;
      if (len > seg) p.copy(prev).addScaledVector(d, seg / len);
    }
    const w = right.clone().multiplyScalar(0.07);
    for (let i = 0; i < SCARF; i++) {
      const p = this.trail[i];
      const taper = 1 - i / SCARF / 1.4;
      this.scarfPos.set([p.x - w.x * taper, p.y + 0.02, p.z - w.z * taper, p.x + w.x * taper, p.y - 0.02, p.z + w.z * taper], i * 6);
    }
    (this.scarf.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    this.scarf.geometry.computeVertexNormals();
  }

  dispose(): void {
    this.bin.dispose();
  }
}
