import {
  Camera,
  DepthTexture,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { INK, PAPER } from "./palette";

/**
 * The comic print pass, in one draw. The scene renders offscreen at a
 * dynamic resolution with its depth; this pass then
 *  - inks outlines where depth breaks (silhouettes) or bends (creases),
 *    found from the Laplacian of 1/depth, which is zero on any flat face;
 *  - screens the shaded tones with halftone dots, like a printed page;
 *  - draws anime speed lines while the camera travels (`speed`);
 *  - adds paper grain, and a paper `fade` for reduced-motion cuts.
 * Outlines thin out with distance so the skyline stays quiet.
 */
export class InkPass {
  readonly target: WebGLRenderTarget;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: ShaderMaterial;

  constructor(samples: number) {
    this.target = new WebGLRenderTarget(1, 1, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      samples,
    });
    this.target.depthTexture = new DepthTexture(1, 1, UnsignedIntType);
    this.target.depthTexture.minFilter = NearestFilter;
    this.target.depthTexture.magFilter = NearestFilter;
    this.material = new ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uTexel: { value: new Vector2(1, 1) },
        uNear: { value: 0.5 },
        uFar: { value: 1400 },
        uLineFar: { value: 160 },
        uPx: { value: 1 },
        uTime: { value: 0 },
        uFade: { value: 0 },
        uGrain: { value: 1 },
        uSpeed: { value: 0 },
        uCenter: { value: new Vector2(0.5, 0.5) },
        uAspect: { value: 1 },
        uInk: { value: INK },
        uPaper: { value: PAPER },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform sampler2D tDepth;
        uniform vec2 uTexel;
        uniform float uNear, uFar, uLineFar, uPx, uTime, uFade, uGrain, uSpeed, uAspect;
        uniform vec2 uCenter;
        uniform vec3 uInk, uPaper;
        varying vec2 vUv;

        float viewZ(vec2 uv) {
          float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
          return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
        }

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

        void main() {
          vec3 col = texture2D(tScene, vUv).rgb;

          // --- halftone: dots grow as tone darkens; highlights stay clean
          // Tone is judged as printed (sRGB), not in linear light.
          float lum = dot(pow(col, vec3(0.4545)), vec3(0.299, 0.587, 0.114));
          vec2 px = gl_FragCoord.xy / (5.0 * uPx);
          vec2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071) * px;
          float r = smoothstep(0.52, 0.12, lum) * 0.6;
          float d = length(fract(rot) - 0.5);
          float dots = 1.0 - smoothstep(r - 0.07, r + 0.02, d);
          col = mix(col, col * 0.62, dots * step(0.01, r));

          // --- ink: Laplacian of 1/z flags silhouettes and creases
          float zc = viewZ(vUv);
          vec2 o = uTexel * max(1.0, uPx * 1.4);
          float wc = 1.0 / zc;
          float wl = 1.0 / viewZ(vUv - vec2(o.x, 0.0));
          float wr = 1.0 / viewZ(vUv + vec2(o.x, 0.0));
          float wd = 1.0 / viewZ(vUv - vec2(0.0, o.y));
          float wu = 1.0 / viewZ(vUv + vec2(0.0, o.y));
          float lap = (abs(wl + wr - 2.0 * wc) + abs(wu + wd - 2.0 * wc)) / wc;
          float edge = smoothstep(0.005, 0.018, lap);
          // Thin out with distance; the sky never gets a line.
          edge *= 1.0 - smoothstep(uLineFar * 0.35, uLineFar, zc);
          edge *= step(zc, uFar * 0.98);
          col = mix(col, uInk, edge);

          // --- speed lines, radiating from the centre of the free view
          if (uSpeed > 0.01) {
            vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0);
            float ang = atan(p.y, p.x) / 6.2831853 + 0.5;
            float rays = 150.0;
            float id = floor(ang * rays);
            float seed = hash1(id + floor(uTime * 14.0) * 7.31);
            float start = 0.42 + hash1(id * 3.7) * 0.5;
            float width = abs(fract(ang * rays) - 0.5) * 2.0;
            float line = step(0.72, seed) * (1.0 - smoothstep(0.0, 0.35, width));
            line *= smoothstep(start, start + 0.18, length(p));
            col = mix(col, uInk, line * uSpeed * 0.7);
          }

          // --- paper: static fibre plus a slow grain
          float fibre = hash(floor(vUv * vec2(900.0 * uAspect, 900.0)));
          float grain = hash(vUv * 731.0 + fract(uTime * 0.07));
          col += (fibre - 0.5) * 0.02 * uGrain + (grain - 0.5) * 0.02 * uGrain;
          col = mix(col, uPaper, uFade);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /** `px` is device pixels per CSS pixel × render scale, so dots and lines keep their size. */
  setSize(width: number, height: number, scale: number, dpr: number): void {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    this.target.setSize(w, h);
    const u = this.material.uniforms;
    u.uTexel.value.set(1 / w, 1 / h);
    u.uAspect.value = width / Math.max(1, height);
    u.uPx.value = dpr;
  }

  set fade(v: number) {
    this.material.uniforms.uFade.value = v;
  }

  set grain(v: number) {
    this.material.uniforms.uGrain.value = v;
  }

  set speed(v: number) {
    this.material.uniforms.uSpeed.value = v;
  }

  /** Centre of the speed lines, in 0–1 screen space. */
  setCenter(x: number, y: number): void {
    this.material.uniforms.uCenter.value.set(x, y);
  }

  /** Outlines fade out by this view distance. */
  set lineFar(v: number) {
    this.material.uniforms.uLineFar.value = v;
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: Camera, time: number): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    if (camera instanceof PerspectiveCamera) {
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
    }
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.material.dispose();
  }
}
