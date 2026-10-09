import {
  Camera,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";

/**
 * A one-pass post pipeline. The scene renders into an offscreen target whose
 * size is the canvas size × a dynamic resolution scale; this pass upsamples
 * it to the canvas and prints it onto paper (grain, a faint vignette, ink
 * that bleeds a touch toward warm). A `fade` uniform covers hard cuts for
 * reduced-motion navigation.
 */
export class PaperPass {
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
    this.material = new ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        uTime: { value: 0 },
        uFade: { value: 0 },
        uGrain: { value: 1 },
        uAspect: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform float uTime;
        uniform float uFade;
        uniform float uGrain;
        uniform float uAspect;
        varying vec2 vUv;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          vec3 col = texture2D(tScene, vUv).rgb;
          // Paper tooth: static fibre plus a slow-shifting grain.
          float fibre = hash(floor(vUv * vec2(900.0 * uAspect, 900.0)));
          float grain = hash(vUv * 731.0 + fract(uTime * 0.07));
          col += (fibre - 0.5) * 0.018 * uGrain + (grain - 0.5) * 0.022 * uGrain;
          // Vignette toward deeper paper, not black.
          vec2 d = vUv - 0.5;
          float v = smoothstep(0.35, 0.95, length(d * vec2(uAspect, 1.0)) / max(uAspect, 1.0) * 1.4);
          col = mix(col, col * vec3(0.93, 0.9, 0.84), v * 0.55);
          col = mix(col, vec3(0.925, 0.906, 0.863), uFade);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  setSize(width: number, height: number, scale: number): void {
    this.target.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    this.material.uniforms.uAspect.value = width / Math.max(1, height);
  }

  set fade(v: number) {
    this.material.uniforms.uFade.value = v;
  }

  set grain(v: number) {
    this.material.uniforms.uGrain.value = v;
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: Camera, time: number): void {
    this.material.uniforms.uTime.value = time;
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}
