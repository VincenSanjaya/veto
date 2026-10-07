import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const vertex = `attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0., 1.); }`;
const fragment = `precision highp float;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uEntrance;
uniform float uMobile;
uniform float uScroll;
float settle(float t) { return 1. - exp(-3.3*t)*cos(6.9*t); }
float shape(vec3 p, float side) {
  float t = min(uEntrance, 2.8);
  float arrived = uEntrance >= 2.8 ? 1. : settle(t);
  float scale = mix(2.62, 1.55, uMobile);
  float viewportEdge = 4. * uResolution.x / uResolution.y;
  // Centers beyond the viewport edge crop roughly 60% of each desktop form.
  float center = viewportEdge + scale * mix(.28, .85, uMobile);
  float scrollOut = uScroll * mix(2.2, .75, uMobile);
  float drift = sin(uTime*.55 + side*2.)*.10;
  p.x -= side*(center + scrollOut + (1.-arrived)*16.) + uPointer.x*.17;
  p.y -= side*.45 + drift + uPointer.y*.12;
  float jelly = sin(t*9. + side*.35)*exp(-t*1.8)*.24;
  p /= scale;
  p.x /= 1. + jelly + uScroll*.045;
  p.y /= 1. - jelly*.7 - uScroll*.025;
  float turn = side*.55 + sin(uTime*.35)*.07 + uPointer.x*.06 + side*uScroll*mix(.16,.07,uMobile);
  p.xy = mat2(cos(turn), -sin(turn), sin(turn), cos(turn))*p.xy;
  p.z += p.x*.37 + p.y*.21;
  float a = atan(p.y, p.x);
  float ring = 1.12 + sin(a*3.+side+uScroll*.2)*.16 + cos(a*2.-side)*.11;
  float tube = .41 + sin(a*2.+side)*.055;
  return (length(vec2(length(p.xy)-ring, p.z)) - tube)*scale*.8;
}
float scene(vec3 p) { return min(shape(p, -1.), shape(p, 1.)); }
vec3 normal(vec3 p) { vec2 e = vec2(.003,0.); return normalize(vec3(scene(p+e.xyy)-scene(p-e.xyy), scene(p+e.yxy)-scene(p-e.yxy), scene(p+e.yyx)-scene(p-e.yyx))); }
vec3 environment(vec3 ray) {
  vec3 color = vec3(.085,.092,.079);
  float ribbon = pow(max(0., 1.-abs(ray.y + ray.x*.65 - .38)*2.), 16.);
  float strip = pow(max(0., 1.-abs(ray.x - ray.y*.4 + .4)*3.), 28.);
  float lime = pow(max(0., dot(normalize(ray), normalize(vec3(-.6,.65,.3)))), 12.);
  color += vec3(.86,.92,.80)*ribbon*1.25 + vec3(.35,.40,.32)*strip*1.5;
  color += vec3(.39,.55,.24)*lime*.52;
  float softbox = pow(max(0., dot(normalize(ray), normalize(vec3(.4,.9,.6)))), 5.);
  color += vec3(.66,.70,.62)*softbox*1.05;
  return color;
}
void main() {
  vec2 uv = (gl_FragCoord.xy*2.-uResolution.xy)/uResolution.y;
  vec3 ro = vec3(0.,0.,7.);
  vec3 rd = normalize(vec3(uv*4., -7.));
  float depth = 0.; float hit = 0.;
  for (int i=0; i<84; i++) {
    if (uMobile > .5 && i > 53) break;
    vec3 p = ro + rd*depth;
    float d = scene(p);
    if (d < .004) { hit=1.; break; }
    depth += max(d,.005);
    if (depth > 14.) break;
  }
  if (hit < .5) { gl_FragColor=vec4(0.); return; }
  vec3 p = ro + rd*depth;
  vec3 n = normal(p);
  vec3 reflected = reflect(rd,n);
  vec3 bent = refract(rd,n,1./1.46);
  // Trace inside the volume to estimate optical thickness and an exit normal.
  vec3 inside = p + bent*.035;
  float thickness = .035;
  for (int j=0; j<18; j++) {
    if (uMobile > .5 && j > 10) break;
    float distanceInside = scene(inside);
    if (distanceInside > .006) break;
    float stepSize = max(abs(distanceInside)*.75,.018);
    inside += bent*stepSize; thickness += stepSize;
  }
  vec3 exitRay = refract(bent, -normal(inside), 1.46);
  if (length(exitRay) < .1) exitRay = bent;
  float fresnel = .055 + .945*pow(1.-max(0.,dot(-rd,n)),4.);
  vec3 transmissionRay = exitRay + vec3(.07, -.08, .2);
  vec3 transmitted = environment(transmissionRay);
  // Slight dispersion, restrained tint, and transmitted background rather than opaque metal.
  transmitted.r = mix(transmitted.r, environment(transmissionRay+vec3(.008,0.,0.)).r, .08);
  transmitted.b = mix(transmitted.b, environment(transmissionRay-vec3(.008,0.,0.)).b, .08);
  transmitted *= exp(-vec3(.14,.07,.2)*thickness);
  vec3 color = mix(transmitted*.78, environment(reflected), fresnel*.9);
  float edge = pow(1.-max(0.,dot(-rd,n)),2.5);
  color += vec3(.58,.72,.42)*edge*.2;
  color += vec3(.10,.115,.095)*pow(1.-max(0.,dot(-rd,n)),1.8);
  float spec = pow(max(0.,dot(reflected,normalize(vec3(-.4,1.,1.)))),65.);
  color += vec3(.85,.93,.79)*spec*1.15;
  gl_FragColor = vec4(color, .94);
}`;

// No WebGL library or assets: two ray-marched glass volumes in a single decorative canvas.
export function LiquidGlass({
  entrance,
  reduced,
  scroll,
}: {
  entrance: boolean;
  reduced: boolean;
  scroll: RefObject<number>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const entranceRef = useRef(entrance);
  entranceRef.current = entrance;
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const scene = canvas.current!.parentElement!;
    const hero = scene.parentElement!;
    const fitViewport = () => {
      const rect = hero.getBoundingClientRect();
      // Keep the padded content exactly where it is. Only decoration breaks out.
      // clientWidth excludes the browser's vertical scrollbar, unlike 100vw.
      scene.style.setProperty(
        "--glass-viewport-width",
        `${document.documentElement.clientWidth}px`,
      );
      scene.style.setProperty("--glass-viewport-left", `${-rect.left}px`);
      scene.style.setProperty("--glass-content-width", `${rect.width}px`);
    };
    fitViewport();
    const observer = new ResizeObserver(fitViewport);
    observer.observe(hero);
    observer.observe(document.documentElement);
    window.addEventListener("resize", fitViewport, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fitViewport);
    };
  }, []);
  useEffect(() => {
    if (ready || reduced) return;
    const scene = canvas.current!.parentElement!;
    const hero = scene.parentElement!;
    const move = (event: PointerEvent) => {
      if (window.matchMedia("(max-width: 700px)").matches) return;
      const rect = hero.getBoundingClientRect();
      const x = Math.max(
        -1,
        Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
      );
      const y = Math.max(
        -1,
        Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
      scene.style.setProperty("--glass-pointer-x", `${x * 5}px`);
      scene.style.setProperty("--glass-pointer-y", `${y * 5}px`);
    };
    const reset = () => {
      scene.style.setProperty("--glass-pointer-x", "0px");
      scene.style.setProperty("--glass-pointer-y", "0px");
    };
    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", reset);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", reset);
      reset();
    };
  }, [ready, reduced]);
  useEffect(() => {
    const node = canvas.current!;
    const scene = node.parentElement!;
    const gl = node.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const shaders: WebGLShader[] = [];
    let frame = 0;
    let disposed = false;
    let contextLost = false;
    let inView = true;
    const started = performance.now();
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const interaction = node.parentElement!.parentElement!;
    const mobile = window.matchMedia("(max-width: 700px)");
    function resize() {
      const rect = scene.getBoundingClientRect();
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        mobile.matches ? 0.85 : 1.25,
      );
      node.width = Math.max(1, Math.round(rect.width * ratio));
      node.height = Math.max(1, Math.round(rect.height * ratio));
      gl!.viewport(0, 0, node.width, node.height);
    }
    const move = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      pointer.targetX = Math.max(
        -1,
        Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
      );
      pointer.targetY = Math.max(
        -1,
        Math.min(1, 1 - ((event.clientY - rect.top) / rect.height) * 2),
      );
    };
    const leave = () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
    };
    const lost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frame);
      setReady(false);
    };
    const observer = new ResizeObserver(resize);
    try {
      for (const [type, source] of [
        [gl.VERTEX_SHADER, vertex],
        [gl.FRAGMENT_SHADER, fragment],
      ] as const) {
        const shader = gl.createShader(type)!;
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error("Glass shader unavailable");
      }
      program = gl.createProgram()!;
      shaders.forEach((shader) => gl.attachShader(program!, shader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Glass renderer unavailable");
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const uniforms = Object.fromEntries(
        [
          "uResolution",
          "uPointer",
          "uTime",
          "uEntrance",
          "uMobile",
          "uScroll",
        ].map((name) => [name, gl.getUniformLocation(program!, name)]),
      );
      observer.observe(scene);
      resize();
      const draw = (now: number) => {
        if (disposed || contextLost) return;
        pointer.x += (pointer.targetX - pointer.x) * 0.035;
        pointer.y += (pointer.targetY - pointer.y) * 0.035;
        gl.uniform2f(uniforms.uResolution, node.width, node.height);
        gl.uniform2f(
          uniforms.uPointer,
          reduced || mobile.matches ? 0 : pointer.x,
          reduced || mobile.matches ? 0 : pointer.y,
        );
        gl.uniform1f(uniforms.uTime, reduced ? 0 : (now - started) / 1000);
        gl.uniform1f(
          uniforms.uEntrance,
          entranceRef.current && !reduced ? (now - started) / 1000 : 3,
        );
        gl.uniform1f(uniforms.uMobile, mobile.matches ? 1 : 0);
        gl.uniform1f(uniforms.uScroll, reduced ? 0 : scroll.current);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (!reduced && !document.hidden && inView)
          frame = requestAnimationFrame(draw);
      };
      const visibility = () => {
        cancelAnimationFrame(frame);
        if (!document.hidden && inView) frame = requestAnimationFrame(draw);
      };
      const intersection = new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        visibility();
      });
      intersection.observe(node);
      document.addEventListener("visibilitychange", visibility);
      if (!reduced) {
        interaction.addEventListener("pointermove", move);
        interaction.addEventListener("pointerleave", leave);
      }
      node.addEventListener("webglcontextlost", lost);
      draw(performance.now());
      setReady(true);
      // Reduced motion remains static, but redraws after responsive size changes.
      const redrawResize = new ResizeObserver(() => {
        resize();
        if (reduced) draw(performance.now());
      });
      redrawResize.observe(scene);
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        intersection.disconnect();
        redrawResize.disconnect();
        document.removeEventListener("visibilitychange", visibility);
        interaction.removeEventListener("pointermove", move);
        interaction.removeEventListener("pointerleave", leave);
        node.removeEventListener("webglcontextlost", lost);
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        shaders.forEach((shader) => gl.deleteShader(shader));
      };
    } catch {
      observer.disconnect();
      shaders.forEach((shader) => gl.deleteShader(shader));
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      setReady(false);
    }
  }, [reduced, scroll]);
  return (
    <div
      className={`liquid-scene ${ready ? "glass-webgl" : "glass-fallback"}`}
      aria-hidden="true"
    >
      <div className="glass-scroll-layer glass-scroll-left">
        <div className="fallback-glass glass-left" />
      </div>
      <div className="glass-scroll-layer glass-scroll-right">
        <div className="fallback-glass glass-right" />
      </div>
      <canvas ref={canvas} className="glass-canvas" />
    </div>
  );
}
