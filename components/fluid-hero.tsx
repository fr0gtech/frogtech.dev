"use client";

import { useEffect, useRef, useState } from "react";

import { FluidPanel, isTuning } from "@/components/fluid-panel";
import { DEFAULT_SETTINGS, FluidSettings } from "@/components/fluid-settings";
import { frogPath } from "@/components/icons";

// Stable-fluids grid (WebGL2) behind the frog logo + "frogtech" wordmark.
// The glyphs can act as density inflows, as a mask for pointer-painted dye,
// or both. All knobs live in FluidSettings so they can be tuned live.

const PRESSURE_ITERS = 20;

const vert = `#version 300 es
precision highp float;
in vec2 aPos;
uniform vec2 texel;
out vec2 vUv, vL, vR, vT, vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texel.x, 0.0);
  vR = vUv + vec2(texel.x, 0.0);
  vT = vUv + vec2(0.0, texel.y);
  vB = vUv - vec2(0.0, texel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const head = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 o;
`;

const frag = {
  splat: `${head}
uniform sampler2D uTarget;
uniform float aspect, radius;
uniform vec3 color;
uniform vec2 point;
void main() {
  vec2 p = vUv - point;
  p.x *= aspect;
  vec3 s = exp(-dot(p, p) / radius) * color;
  o = vec4(texture(uTarget, vUv).xyz + s, 1.0);
}`,
  advect: `${head}
uniform sampler2D uVelocity, uSource;
uniform vec2 texel;
uniform float dt, dissipation;
void main() {
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texel;
  o = texture(uSource, coord) / (1.0 + dissipation * dt);
}`,
  divergence: `${head}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
  curl: `${head}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
  vorticity: `${head}
uniform sampler2D uVelocity, uCurl;
uniform float curl, dt;
void main() {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + force * dt;
  o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`,
  push: `${head}
uniform sampler2D uVelocity;
uniform vec2 delta;
void main() { o = vec4(texture(uVelocity, vUv).xy + delta, 0.0, 1.0); }`,
  clear: `${head}
uniform sampler2D uTexture;
uniform float value;
void main() { o = value * texture(uTexture, vUv); }`,
  pressure: `${head}
uniform sampler2D uPressure, uDivergence;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float div = texture(uDivergence, vUv).x;
  o = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradient: `${head}
uniform sampler2D uPressure, uVelocity;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  o = vec4(v, 0.0, 1.0);
}`,
  inflow: `${head}
uniform sampler2D uDye, uMask;
uniform vec3 colorA, colorB;
uniform float time, amount, speed, spread;
void main() {
  float m = texture(uMask, vUv).r;
  float k = 0.5 + 0.5 * sin(time * speed + vUv.x * spread + 0.6 * sin(time * speed * 0.57 - vUv.y * spread));
  vec3 d = texture(uDye, vUv).rgb;
  o = vec4(mix(d, mix(colorA, colorB, k), m * amount), 1.0);
}`,
  display: `${head}
uniform sampler2D uDye, uMask;
uniform vec2 dyeSize;
uniform bool pixel, masked;
uniform vec3 bg;
void main() {
  vec2 uv = pixel ? (floor(vUv * dyeSize) + 0.5) / dyeSize : vUv;
  vec3 c = texture(uDye, uv).rgb;
  if (masked) {
    float m = texture(uMask, vUv).r;
    // thin rim so the letters are findable before anything is stirred
    float n = texture(uMask, vL).r + texture(uMask, vR).r + texture(uMask, vT).r + texture(uMask, vB).r;
    float edge = clamp(abs(4.0 * m - n), 0.0, 1.0);
    c = c * m + vec3(0.05) * m + vec3(0.18) * edge;
  }
  float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  o = vec4(bg * (1.0 - a) + c, 1.0);
}`,
};

type FBO = {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
  attach: (unit: number) => number;
};
type DoubleFBO = { read: FBO; write: FBO; swap: () => void };
type Program = { use: () => void; u: Record<string, WebGLUniformLocation> };

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);

  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function drawMask(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const family = getComputedStyle(document.body).fontFamily;
  const word = "frogtech";

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";

  ctx.font = `700 100px ${family}`;
  const m = ctx.measureText(word);
  const tw = m.width / 100;
  const asc = m.actualBoundingBoxAscent / 100;
  const desc = m.actualBoundingBoxDescent / 100;
  const frogAspect = 286 / 301;
  const landscape = w / h > 1.15;

  let size: number, frogH: number, frogX: number, frogY: number;
  let textX: number, textY: number;

  if (landscape) {
    // frog | frogtech, frog roughly as tall as the glyphs incl. descender
    const fh = asc + desc + 0.15;
    const gap = 0.28;

    size = Math.min((w * 0.86) / (fh * frogAspect + gap + tw), (h * 0.5) / fh);
    frogH = fh * size;
    const total = frogH * frogAspect + gap * size + tw * size;

    frogX = (w - total) / 2;
    frogY = (h - frogH) / 2;
    textX = frogX + frogH * frogAspect + gap * size;
    textY = h / 2 + ((asc - desc) / 2) * size;
  } else {
    size = Math.min((w * 0.88) / tw, h * 0.2);
    frogH = Math.min(h * 0.32, w * 0.55);
    const gap = size * 0.35;
    const total = frogH + gap + (asc + desc) * size;
    const top = (h - total) / 2;

    frogX = (w - frogH * frogAspect) / 2;
    frogY = top;
    textX = (w - tw * size) / 2;
    textY = top + frogH + gap + asc * size;
  }

  ctx.font = `700 ${size}px ${family}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(word, textX, textY);

  ctx.save();
  ctx.translate(frogX, frogY);
  ctx.scale(frogH / 301, frogH / 301);
  ctx.fill(new Path2D(frogPath), "evenodd");
  ctx.restore();
}

export function FluidHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [settings, setSettings] = useState<FluidSettings>(DEFAULT_SETTINGS);
  const [tuning, setTuning] = useState(false);
  const settingsRef = useRef(settings);

  settingsRef.current = settings;

  useEffect(() => setTuning(isTuning()), []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--frog-bg",
      settings.background,
    );
  }, [settings.background]);

  useEffect(() => {
    const S = () => settingsRef.current;
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });

    if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
      setFailed(true);

      return;
    }
    gl.getExtension("OES_texture_float_linear");

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // ---------- gl helpers ----------
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;

      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? "shader error");

      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vert);
    const program = (src: string): Program => {
      const p = gl.createProgram()!;

      gl.attachShader(p, vs);
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
      gl.bindAttribLocation(p, 0, "aPos");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p) ?? "link error");
      const u: Record<string, WebGLUniformLocation> = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);

      for (let i = 0; i < n; i++) {
        const name = gl.getActiveUniform(p, i)!.name;

        u[name] = gl.getUniformLocation(p, name)!;
      }

      return { use: () => gl.useProgram(p), u };
    };

    let progs: Record<keyof typeof frag, Program>;

    try {
      progs = Object.fromEntries(
        Object.entries(frag).map(([k, src]) => [k, program(src)]),
      ) as Record<keyof typeof frag, Program>;
    } catch {
      setFailed(true);

      return;
    }

    const vao = gl.createVertexArray();

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const blit = (target: FBO | null) => {
      if (target) {
        gl.viewport(0, 0, target.w, target.h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      } else {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const textures: WebGLTexture[] = [];
    const framebuffers: WebGLFramebuffer[] = [];

    const fbo = (
      w: number,
      h: number,
      internal: number,
      format: number,
    ): FBO => {
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture()!;

      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internal,
        w,
        h,
        0,
        format,
        gl.HALF_FLOAT,
        null,
      );
      const fb = gl.createFramebuffer()!;

      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0,
      );
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      textures.push(tex);
      framebuffers.push(fb);

      return {
        tex,
        fbo: fb,
        w,
        h,
        attach(unit) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, tex);

          return unit;
        },
      };
    };
    const double = (
      w: number,
      h: number,
      internal: number,
      format: number,
    ): DoubleFBO => {
      const d = {
        read: fbo(w, h, internal, format),
        write: fbo(w, h, internal, format),
        swap() {
          [d.read, d.write] = [d.write, d.read];
        },
      };

      return d;
    };
    const resFor = (res: number) => {
      let a = gl.drawingBufferWidth / gl.drawingBufferHeight;

      if (a < 1) a = 1 / a;
      const lo = Math.round(res);
      const hi = Math.round(res * a);

      return gl.drawingBufferWidth > gl.drawingBufferHeight
        ? { w: hi, h: lo }
        : { w: lo, h: hi };
    };

    // ---------- state ----------
    let velocity: DoubleFBO, dye: DoubleFBO, pressure: DoubleFBO;
    let divergence: FBO, curl: FBO;
    let simRes = 0;
    let dyeResolution = 0;
    const maskTex = gl.createTexture()!;
    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d")!;

    const init = () => {
      textures.forEach((t) => gl.deleteTexture(t));
      framebuffers.forEach((f) => gl.deleteFramebuffer(f));
      textures.length = 0;
      framebuffers.length = 0;

      simRes = S().simRes;
      dyeResolution = S().dyeRes;
      const sim = resFor(simRes);
      const dyeRes = resFor(dyeResolution);

      velocity = double(sim.w, sim.h, gl.RG16F, gl.RG);
      pressure = double(sim.w, sim.h, gl.R16F, gl.RED);
      divergence = fbo(sim.w, sim.h, gl.R16F, gl.RED);
      curl = fbo(sim.w, sim.h, gl.R16F, gl.RED);
      dye = double(dyeRes.w, dyeRes.h, gl.RGBA16F, gl.RGBA);
    };

    const updateMask = () => {
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      drawMask(maskCtx, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        maskCanvas,
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width === w && canvas.height === h && velocity) return;
      canvas.width = w;
      canvas.height = h;
      init();
      updateMask();
    };

    const splat = (
      x: number,
      y: number,
      dx: number,
      dy: number,
      scale = 1,
      color?: number[],
    ) => {
      const aspect = canvas.width / canvas.height;
      let radius = (S().radius * scale) / 100;

      if (aspect > 1) radius *= aspect;

      progs.splat.use();
      gl.uniform1i(progs.splat.u.uTarget, velocity.read.attach(0));
      gl.uniform1f(progs.splat.u.aspect, aspect);
      gl.uniform2f(progs.splat.u.point, x, y);
      gl.uniform3f(progs.splat.u.color, dx, dy, 0);
      gl.uniform1f(progs.splat.u.radius, radius);
      blit(velocity.write);
      velocity.swap();

      if (color) {
        gl.uniform1i(progs.splat.u.uTarget, dye.read.attach(0));
        gl.uniform3f(progs.splat.u.color, color[0], color[1], color[2]);
        blit(dye.write);
        dye.swap();
      }
    };

    // add a constant velocity to the whole field
    const push = (vx: number, vy: number) => {
      progs.push.use();
      gl.uniform1i(progs.push.u.uVelocity, velocity.read.attach(0));
      gl.uniform2f(progs.push.u.delta, vx, vy);
      blit(velocity.write);
      velocity.swap();
    };

    // somewhere between the two theme colours
    const color = (boost = 1) => {
      const a = hex(S().colorA);
      const b = hex(S().colorB);
      const k = Math.random();

      return a.map((v, i) => (v + (b[i] - v) * k) * 0.3 * boost);
    };

    // initial dye for the masked look, which has no inflow
    const randomSplats = (n: number, force: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;

        splat(
          0.15 + Math.random() * 0.7,
          0.3 + Math.random() * 0.4,
          Math.cos(a) * force,
          Math.sin(a) * force,
          1.5,
          color(6),
        );
      }
    };

    const step = (dt: number, time: number) => {
      gl.disable(gl.BLEND);

      if (S().inflow) {
        progs.inflow.use();
        gl.uniform1i(progs.inflow.u.uDye, dye.read.attach(0));
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, maskTex);
        gl.uniform1i(progs.inflow.u.uMask, 1);
        gl.uniform1f(progs.inflow.u.time, time);
        gl.uniform1f(progs.inflow.u.amount, 1 - Math.exp(-S().inflowRate * dt));
        gl.uniform3fv(progs.inflow.u.colorA, hex(S().colorA));
        gl.uniform3fv(progs.inflow.u.colorB, hex(S().colorB));
        gl.uniform1f(progs.inflow.u.speed, S().colorSpeed);
        gl.uniform1f(progs.inflow.u.spread, S().colorSpread);
        blit(dye.write);
        dye.swap();
      }

      const tx = 1 / velocity.read.w;
      const ty = 1 / velocity.read.h;

      progs.curl.use();
      gl.uniform2f(progs.curl.u.texel, tx, ty);
      gl.uniform1i(progs.curl.u.uVelocity, velocity.read.attach(0));
      blit(curl);

      progs.vorticity.use();
      gl.uniform2f(progs.vorticity.u.texel, tx, ty);
      gl.uniform1i(progs.vorticity.u.uVelocity, velocity.read.attach(0));
      gl.uniform1i(progs.vorticity.u.uCurl, curl.attach(1));
      gl.uniform1f(progs.vorticity.u.curl, S().curl);
      gl.uniform1f(progs.vorticity.u.dt, dt);
      blit(velocity.write);
      velocity.swap();

      progs.divergence.use();
      gl.uniform2f(progs.divergence.u.texel, tx, ty);
      gl.uniform1i(progs.divergence.u.uVelocity, velocity.read.attach(0));
      blit(divergence);

      progs.clear.use();
      gl.uniform1i(progs.clear.u.uTexture, pressure.read.attach(0));
      gl.uniform1f(progs.clear.u.value, 0.8);
      blit(pressure.write);
      pressure.swap();

      progs.pressure.use();
      gl.uniform2f(progs.pressure.u.texel, tx, ty);
      gl.uniform1i(progs.pressure.u.uDivergence, divergence.attach(0));
      for (let i = 0; i < PRESSURE_ITERS; i++) {
        gl.uniform1i(progs.pressure.u.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
      }

      progs.gradient.use();
      gl.uniform2f(progs.gradient.u.texel, tx, ty);
      gl.uniform1i(progs.gradient.u.uPressure, pressure.read.attach(0));
      gl.uniform1i(progs.gradient.u.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      progs.advect.use();
      gl.uniform2f(progs.advect.u.texel, tx, ty);
      gl.uniform1f(progs.advect.u.dt, dt);
      gl.uniform1i(progs.advect.u.uVelocity, velocity.read.attach(0));
      gl.uniform1i(progs.advect.u.uSource, velocity.read.attach(0));
      gl.uniform1f(progs.advect.u.dissipation, S().velocityDissipation);
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(progs.advect.u.uVelocity, velocity.read.attach(0));
      gl.uniform1i(progs.advect.u.uSource, dye.read.attach(1));
      gl.uniform1f(progs.advect.u.dissipation, S().dyeDissipation);
      blit(dye.write);
      dye.swap();
    };

    const render = () => {
      progs.display.use();
      gl.uniform2f(progs.display.u.texel, 1 / canvas.width, 1 / canvas.height);
      gl.uniform2f(progs.display.u.dyeSize, dye.read.w, dye.read.h);
      gl.uniform1i(progs.display.u.pixel, S().pixel ? 1 : 0);
      gl.uniform1i(progs.display.u.masked, S().masked ? 1 : 0);
      gl.uniform3fv(progs.display.u.bg, hex(S().background));
      gl.uniform1i(progs.display.u.uDye, dye.read.attach(0));
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.uniform1i(progs.display.u.uMask, 1);
      blit(null);
    };

    // ---------- input ----------
    const pointer = { x: 0, y: 0, dx: 0, dy: 0, moved: false, init: false };

    const onMove = (cx: number, cy: number) => {
      const r = canvas.getBoundingClientRect();
      const x = (cx - r.left) / r.width;
      const y = 1 - (cy - r.top) / r.height;

      if (x < 0 || x > 1 || y < 0 || y > 1) {
        pointer.init = false;

        return;
      }
      if (pointer.init) {
        let dx = x - pointer.x;
        let dy = y - pointer.y;
        const aspect = r.width / r.height;

        if (aspect < 1) dx *= aspect;
        else dy /= aspect;
        pointer.dx += dx;
        pointer.dy += dy;
        pointer.moved = true;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.init = true;
    };
    const mouse = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-fluid-panel]")) {
        pointer.init = false;

        return;
      }
      onMove(e.clientX, e.clientY);
    };
    const touch = (e: TouchEvent) => {
      const t = e.touches[0];

      if (t) onMove(t.clientX, t.clientY);
    };
    const touchEnd = () => (pointer.init = false);

    // page scroll shoves the whole field along with it
    let lastScroll = window.scrollY;
    let scrolled = 0;
    const onScroll = () => {
      scrolled += window.scrollY - lastScroll;
      lastScroll = window.scrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", mouse);
    window.addEventListener("touchmove", touch, { passive: true });
    window.addEventListener("touchend", touchEnd);

    // ---------- loop ----------
    let visible = true;
    let raf = 0;
    let last = performance.now();

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });

    io.observe(canvas);

    const ro = new ResizeObserver(() => resize());

    ro.observe(canvas);

    function frame(now: number) {
      raf = 0;
      if (!visible) return;
      const dt = Math.min((now - last) / 1000, 1 / 30);

      last = now;
      resize();
      if (S().simRes !== simRes || S().dyeRes !== dyeResolution) init();
      if (S().masked && !wasMasked) randomSplats(6, 900);
      wasMasked = S().masked;

      if (scrolled !== 0) {
        // px -> sim texels; v0 = d * dissipation travels ~d before it decays
        const texels = (scrolled / canvas.clientHeight) * velocity.read.h;
        const vy = texels * S().velocityDissipation * S().scrollInertia;

        scrolled = 0;
        push(0, vy);
      }
      if (pointer.moved) {
        splat(
          pointer.x,
          pointer.y,
          pointer.dx * S().force,
          pointer.dy * S().force,
          1,
          S().masked ? color(3) : undefined,
        );
        pointer.dx = pointer.dy = 0;
        pointer.moved = false;
      }

      step(dt, now / 1000);
      render();
      raf = requestAnimationFrame(frame);
    }

    resize();
    // redraw the mask once the webfont is actually available
    document.fonts.ready.then(() => {
      const family = getComputedStyle(document.body).fontFamily;

      document.fonts.load(`700 100px ${family}`).then(updateMask, updateMask);
    });
    let wasMasked = S().masked;

    if (wasMasked) randomSplats(reducedMotion ? 3 : 6, 900);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", mouse);
      window.removeEventListener("touchmove", touch);
      window.removeEventListener("touchend", touchEnd);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div
      className="relative h-[100svh] w-full overflow-hidden"
      style={{ background: settings.background }}
    >
      <h1 className="sr-only">frogtech</h1>
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-6xl md:text-9xl font-bold text-white/90">
          frogtech
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="absolute inset-0 h-full w-full touch-pan-y"
        />
      )}
      <a
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/80 transition-colors"
        href="#projects"
      >
        projects ↓
      </a>
      {tuning && <FluidPanel settings={settings} onChange={setSettings} />}
    </div>
  );
}
