import { frag, head, vert } from "@/components/fluid-canvas";
import { COLS, DIRS, Emitter, ROWS } from "@/components/wind-game/levels";

// Fluid solver for the game: same stable-fluids steps as the hero, plus solid
// cells (an obstacle texture at grid resolution) and emitters that blow, add
// dye or suck it away.

const SUB = 5; // sim texels per grid cell
const DYE_SUB = 10; // dye texels per grid cell

export const OBSTACLE_RES = DYE_SUB; // obstacle mask px per grid cell
const MAX_PROBES = 4;
const MAX_EMITTERS = 24;
const MAX_SPEED = 180; // texels/s, hard cap so feedback loops can't explode

// everything about how the game's air looks and behaves that's worth tuning
export type GameLook = {
  speedScale: number; // air speed (texels/s) that gets the top colour
  opacity: number; // how opaque the smoke is over the scenery
  brightness: number;
  pixelSize: number; // 1 = finest, bigger = chunkier pixels
  needleDensity: number; // wind needles per cell
  needleLength: number; // seconds of travel a needle shows
  needleOpacity: number; // how visible the needles are in the speed view
  ramp0: string;
  ramp1: string;
  ramp2: string;
  ramp3: string;
  ramp4: string;
  curl: number; // swirl boost
  flutter: number; // radians vents/fans wobble by
  breeze: number; // ambient drift strength
  coanda: number; // how hard air hugs walls
  airFade: number;
  smokeFade: number;
};

export const DEFAULT_LOOK: GameLook = {
  speedScale: 80,
  opacity: 0.85,
  brightness: 0.78,
  pixelSize: 1,
  needleDensity: 2,
  needleLength: 0.15,
  needleOpacity: 0.35,
  ramp0: "#14424f",
  ramp1: "#338c73",
  ramp2: "#8cd173",
  ramp3: "#e0f5b3",
  ramp4: "#ffedb8",
  curl: 9,
  flutter: 0.14,
  breeze: 5,
  coanda: 6,
  airFade: 0.3,
  smokeFade: 0.25,
};

const hex3 = (c: string) => {
  const n = parseInt(c.slice(1), 16);

  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// speed: velocity the emitter blows at (sim texels/s); flow: mass it adds
// (+) or removes (-) per texel, which the pressure solve turns into real
// outflow/suction.
const SPEED = { inflow: 80, fan: 90, drain: 40 };
const RADIUS = { inflow: 0.9, fan: 1.2, drain: 1.6 };
const FLOW = { inflow: 6, fan: 0, drain: -6 };
const KIND = { inflow: 0, fan: 1, drain: 2 };

// screen edges are open (air can leave), walls come from the obstacle texture
const solid = `
uniform sampler2D uObs;
bool outside(vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
}
float solid(vec2 uv) {
  return outside(uv) ? 0.0 : texture(uObs, uv).r;
}
`;

const emitters = `
uniform vec4 em[${MAX_EMITTERS}];
uniform vec4 ep[${MAX_EMITTERS}];
uniform int count;
uniform vec2 cells;
float falloff(int i) {
  vec2 d = (vUv - em[i].xy) * cells;
  return exp(-dot(d, d) / (ep[i].y * ep[i].y));
}
`;

const shaders = {
  advect: `${head}${solid}
uniform sampler2D uVelocity, uSource;
uniform vec2 texel;
uniform float dt, dissipation;
void main() {
  if (solid(vUv) > 0.5) { o = vec4(0.0); return; }
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texel;
  // air blowing in from beyond the board is clean and still; sampling the
  // clamped edge instead would keep feeding whatever sits on the border back in
  if (outside(coord)) { o = vec4(0.0); return; }
  vec4 v = texture(uSource, coord) / (1.0 + dissipation * dt);
  // a NaN would spread over the whole sim, never let one through
  if (any(isnan(v)) || any(isinf(v))) v = vec4(0.0);
  o = v;
}`,
  divergence: `${head}${solid}${emitters}
uniform sampler2D uVelocity;
float vx(vec2 uv) { return solid(uv) > 0.5 ? 0.0 : texture(uVelocity, uv).x; }
float vy(vec2 uv) { return solid(uv) > 0.5 ? 0.0 : texture(uVelocity, uv).y; }
void main() {
  float div = 0.5 * (vx(vR) - vx(vL) + vy(vT) - vy(vB));
  // sources/sinks: after projection the field keeps exactly this divergence
  for (int i = 0; i < ${MAX_EMITTERS}; i++) {
    if (i >= count) break;
    div -= ep[i].w * falloff(i);
  }
  o = vec4(solid(vUv) > 0.5 ? 0.0 : div, 0.0, 0.0, 1.0);
}`,
  pressure: `${head}${solid}
uniform sampler2D uPressure, uDivergence;
float P(vec2 uv, float C) {
  return outside(uv) ? 0.0 : solid(uv) > 0.5 ? C : texture(uPressure, uv).x;
}
void main() {
  float C = texture(uPressure, vUv).x;
  float L = P(vL, C);
  float R = P(vR, C);
  float T = P(vT, C);
  float B = P(vB, C);
  float div = texture(uDivergence, vUv).x;
  o = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradient: `${head}${solid}
uniform sampler2D uPressure, uVelocity;
float P(vec2 uv, float C) {
  return outside(uv) ? 0.0 : solid(uv) > 0.5 ? C : texture(uPressure, uv).x;
}
void main() {
  if (solid(vUv) > 0.5) { o = vec4(0.0); return; }
  float C = texture(uPressure, vUv).x;
  float L = P(vL, C);
  float R = P(vR, C);
  float T = P(vT, C);
  float B = P(vB, C);
  vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  o = vec4(v, 0.0, 1.0);
}`,
  // em: x, y (uv), dir x, dir y   ep: kind, radius (cells), speed
  // swirl boost, faded out next to walls where it would feed instabilities
  vorticity: `${head}${solid}
uniform sampler2D uVelocity, uCurl;
uniform vec2 cellSize;
uniform float curl, dt;
void main() {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  float near = max(
    max(solid(vUv + vec2(cellSize.x, 0.0)), solid(vUv - vec2(cellSize.x, 0.0))),
    max(solid(vUv + vec2(0.0, cellSize.y)), solid(vUv - vec2(0.0, cellSize.y)))
  );
  // and along the open edges of the board
  vec2 edge = min(vUv, 1.0 - vUv) / cellSize;
  near = max(near, 1.0 - clamp(min(edge.x, edge.y) - 0.5, 0.0, 1.0));
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C * (1.0 - near);
  force.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + force * dt;
  o = vec4(v, 0.0, 1.0);
}`,
  // pull air that slides along a wall onto it, so streams follow walls
  coanda: `${head}${solid}
uniform sampler2D uVelocity;
uniform vec2 cellSize;
uniform float strength, dt;
void main() {
  vec2 v = texture(uVelocity, vUv).xy;
  vec2 n = vec2(0.0);
  for (float k = 1.0; k <= 2.0; k += 1.0) {
    vec2 ox = vec2(cellSize.x * k, 0.0);
    vec2 oy = vec2(0.0, cellSize.y * k);
    n += (vec2(solid(vUv + ox) - solid(vUv - ox), solid(vUv + oy) - solid(vUv - oy))) / k;
  }
  float speed = length(v);
  if (solid(vUv) < 0.5 && length(n) > 0.0 && speed > 1.0) {
    n = normalize(n);
    // only flow that runs along the wall, not into or away from it
    float along = 1.0 - abs(dot(v / speed, n));
    v += n * speed * strength * along * dt;
  }
  float s = length(v);
  if (s > ${MAX_SPEED}.0) v *= ${MAX_SPEED}.0 / s;
  if (any(isnan(v)) || any(isinf(v))) v = vec2(0.0);
  o = vec4(v, 0.0, 1.0);
}`,
  emitVelocity: `${head}${solid}${emitters}
uniform sampler2D uVelocity;
uniform float dt, time, flutter, breeze;
vec2 rotate(vec2 v, float a) {
  return vec2(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a));
}
void main() {
  vec2 v = texture(uVelocity, vUv).xy;
  // slow swirly breeze: velocity of a moving stream function, divergence free
  vec2 p = vUv * cells;
  float a1 = p.x * 0.45 + time * 0.31, b1 = p.y * 0.6 - time * 0.23;
  float a2 = p.x * 0.9 - time * 0.17, b2 = p.y * 0.35 + time * 0.41;
  vec2 drift = vec2(
    0.6 * sin(a1) * cos(b1) + 0.35 * sin(a2) * cos(b2),
    -0.45 * cos(a1) * sin(b1) - 0.9 * cos(a2) * sin(b2)
  );
  v += drift * breeze * dt;
  for (int i = 0; i < ${MAX_EMITTERS}; i++) {
    if (i >= count) break;
    vec2 d = (vUv - em[i].xy) * cells;
    float f = falloff(i);
    float fi = float(i);
    // each vent/fan wobbles on its own, so jets flap like gusts
    float wobble = flutter * (sin(time * 2.3 + fi * 1.7) + 0.5 * sin(time * 5.1 + fi * 0.9));
    vec2 dir = ep[i].x > 1.5 ? -d / (length(d) + 0.3) : rotate(em[i].zw, wobble);
    v = mix(v, dir * ep[i].z, clamp(f * 10.0 * dt, 0.0, 1.0));
  }
  if (solid(vUv) > 0.5) v = vec2(0.0);
  o = vec4(v, 0.0, 1.0);
}`,
  emitDye: `${head}${solid}${emitters}
uniform sampler2D uDye;
uniform float dt;
void main() {
  vec3 c = texture(uDye, vUv).rgb;
  for (int i = 0; i < ${MAX_EMITTERS}; i++) {
    if (i >= count) break;
    float f = falloff(i);
    if (ep[i].x < 0.5) c = mix(c, vec3(1.0), clamp(f * 12.0 * dt, 0.0, 1.0));
    // fans give off a fainter smoke so their stream is visible too
    else if (ep[i].x < 1.5) c = max(c, mix(c, vec3(0.55), clamp(f * 8.0 * dt, 0.0, 1.0)));
    else if (ep[i].x > 1.5) c *= 1.0 - clamp(f * 8.0 * dt, 0.0, 1.0);
  }
  if (solid(vUv) > 0.5) c = vec3(0.0);
  o = vec4(c, 1.0);
}`,
  // dye as chunky pixels, plus a needle per half cell showing the velocity
  // one pixel per probe point: the air velocity there
  probe: `${head}
uniform sampler2D uVelocity;
uniform vec2 points[${MAX_PROBES}];
void main() {
  int i = int(gl_FragCoord.x);
  o = vec4(texture(uVelocity, points[i]).xy, 0.0, 1.0);
}`,
  // smoke puffed in by the player to see the air; doesn't push anything
  puff: `${head}
uniform sampler2D uDye;
uniform vec2 point, cells;
uniform float amount;
void main() {
  vec2 d = (vUv - point) * cells;
  float f = exp(-dot(d, d) / 0.5);
  vec3 c = texture(uDye, vUv).rgb;
  o = vec4(mix(c, vec3(0.85), clamp(f * amount, 0.0, 1.0)), 1.0);
}`,
  display: `${head}
uniform sampler2D uDye, uVelocity;
uniform vec2 dyeSize, cells, simTexel;
uniform bool showDye, showWind, showSpeed;
uniform float speedScale, opacity, brightness, pixelSize, needleDensity, needleLength, needleAlpha;
uniform vec3 rampC[5];
// night pond: still teal -> moss green -> pale lime -> warm moonlight
vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 a = mix(rampC[0], rampC[1], smoothstep(0.0, 0.3, t));
  a = mix(a, rampC[2], smoothstep(0.3, 0.6, t));
  a = mix(a, rampC[3], smoothstep(0.6, 0.85, t));
  return mix(a, rampC[4], smoothstep(0.85, 1.0, t));
}
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  vec3 c = vec3(0.0);
  if (showDye) {
    vec2 px = dyeSize / pixelSize;
    vec2 uv = (floor(vUv * px) + 0.5) / px;
    c = min(texture(uDye, uv).rgb, vec3(1.0)) * (showWind ? 0.75 : 1.0);
    if (showSpeed) c = c.r * ramp(length(texture(uVelocity, uv).xy) / speedScale);
  }
  if (showWind) {
    vec2 g = cells * needleDensity;
    vec2 center = (floor(vUv * g) + 0.5) / g;
    vec2 vel = texture(uVelocity, center).xy;
    float speed = length(vel);
    // needle length in grid units: how far the air goes in ~0.15s, capped
    vec2 d = vel * simTexel * g * needleLength;
    float len = length(d);
    if (len > 0.45) d *= 0.45 / len;
    vec2 p = (vUv - center) * g;
    float line = smoothstep(0.09, 0.03, segment(p, -d, d));
    float tip = smoothstep(0.16, 0.06, length(p - d));
    float k = clamp(speed / (speedScale * 0.75), 0.0, 1.0);
    vec3 col = mix(vec3(0.15, 0.35, 0.6), vec3(0.45, 1.0, 0.75), k);
    c = max(c, col * max(line, tip) * (0.25 + 0.75 * k) * step(0.5, speed) * needleAlpha);
  }
  // premultiplied: as opaque as it is bright
  c *= brightness;
  o = vec4(c, clamp(max(c.r, max(c.g, c.b)) * opacity, 0.0, 1.0));
}`,
};

type FBO = {
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
  attach: (unit: number) => number;
};
type DoubleFBO = { read: FBO; write: FBO; swap: () => void };
type Program = { bind: () => void; u: Record<string, WebGLUniformLocation> };

export class WindSim {
  private gl: WebGL2RenderingContext;
  private progs: Record<string, Program>;
  private velocity: DoubleFBO;
  private pressure: DoubleFBO;
  private dye: DoubleFBO;
  private divergence: FBO;
  private curl: FBO;
  private time = 0;
  private obsTex: WebGLTexture;
  private emitters: Emitter[] = [];
  view = { dye: true, wind: true, speed: false };
  look: GameLook = { ...DEFAULT_LOOK };
  // lowered by the game on slow devices; the pressure solve is the big cost
  pressureIters = 40;
  private disposables: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    // transparent so the pond scenery behind shows through
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });

    if (!gl || !gl.getExtension("EXT_color_buffer_float"))
      throw new Error("WebGL2 float render targets not supported");
    gl.getExtension("OES_texture_float_linear");
    this.gl = gl;

    const vs = this.compile(gl.VERTEX_SHADER, vert);

    this.progs = Object.fromEntries(
      Object.entries({
        ...shaders,
        clear: frag.clear,
        curl: frag.curl,
      }).map(([k, src]) => [k, this.program(vs, src)]),
    );

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

    const sw = COLS * SUB;
    const sh = ROWS * SUB;

    this.velocity = this.double(sw, sh, gl.RG16F, gl.RG);
    this.pressure = this.double(sw, sh, gl.R16F, gl.RED);
    this.divergence = this.fbo(sw, sh, gl.R16F, gl.RED);
    this.curl = this.fbo(sw, sh, gl.R16F, gl.RED);
    this.dye = this.double(COLS * DYE_SUB, ROWS * DYE_SUB, gl.RGBA16F, gl.RGBA);

    this.obsTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.obsTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const empty = document.createElement("canvas");

    empty.width = COLS;
    empty.height = ROWS;
    this.setObstacles(empty);
  }

  // ---------- setup helpers ----------
  private compile(type: number, src: string) {
    const gl = this.gl;
    const s = gl.createShader(type)!;

    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) ?? "shader error");

    return s;
  }

  private program(vs: WebGLShader, src: string): Program {
    const gl = this.gl;
    const p = gl.createProgram()!;

    gl.attachShader(p, vs);
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) ?? "link error");
    const u: Record<string, WebGLUniformLocation> = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);

    for (let i = 0; i < n; i++) {
      // arrays report as "em[0]"; strip so we can address them as "em"
      const name = gl.getActiveUniform(p, i)!.name.replace(/\[0\]$/, "");

      u[name] = gl.getUniformLocation(p, name)!;
    }

    return { bind: () => gl.useProgram(p), u };
  }

  private fbo(w: number, h: number, internal: number, format: number): FBO {
    const gl = this.gl;
    const tex = gl.createTexture()!;

    gl.activeTexture(gl.TEXTURE0);
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
    this.disposables.push(() => {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fb);
    });

    return {
      fbo: fb,
      w,
      h,
      attach(unit) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);

        return unit;
      },
    };
  }

  private double(
    w: number,
    h: number,
    internal: number,
    format: number,
  ): DoubleFBO {
    const d = {
      read: this.fbo(w, h, internal, format),
      write: this.fbo(w, h, internal, format),
      swap() {
        [d.read, d.write] = [d.write, d.read];
      },
    };

    return d;
  }

  private blit(target: FBO | null) {
    const gl = this.gl;

    if (target) {
      gl.viewport(0, 0, target.w, target.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private bindObs(p: Program, unit: number) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.obsTex);
    gl.uniform1i(p.u.uObs, unit);
  }

  // ---------- public api ----------

  // add a puff of smoke at a point in grid cells
  puff(x: number, y: number, dt: number) {
    const gl = this.gl;
    const P = this.progs.puff;

    P.bind();
    gl.uniform1i(P.u.uDye, this.dye.read.attach(0));
    gl.uniform2f(P.u.point, x / COLS, 1 - y / ROWS);
    gl.uniform2f(P.u.cells, COLS, ROWS);
    gl.uniform1f(P.u.amount, 12 * dt);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  // white = solid. Drawn by the caller at OBSTACLE_RES px per cell so curved
  // things (lily pads) block exactly the shape you see, not whole cells.
  setObstacles(mask: HTMLCanvasElement) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.obsTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  setEmitters(list: Emitter[]) {
    this.emitters = list.slice(0, MAX_EMITTERS);
  }

  clear() {
    const gl = this.gl;

    for (const d of [this.velocity, this.pressure, this.dye])
      for (const f of [d.read, d.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
  }

  private emitterUniforms(p: Program) {
    const gl = this.gl;
    const em = new Float32Array(MAX_EMITTERS * 4);
    const ep = new Float32Array(MAX_EMITTERS * 4);

    const list = this.emitters;

    list.forEach((e, i) => {
      const [dx, dy] = DIRS[e.dir];
      const len = Math.hypot(dx, dy);

      em.set(
        [(e.x + 0.5) / COLS, 1 - (e.y + 0.5) / ROWS, dx / len, -dy / len],
        i * 4,
      );
      ep.set(
        [KIND[e.kind], RADIUS[e.kind], SPEED[e.kind], FLOW[e.kind]],
        i * 4,
      );
    });
    gl.uniform4fv(p.u.em, em);
    gl.uniform4fv(p.u.ep, ep);
    gl.uniform1i(p.u.count, list.length);
    gl.uniform2f(p.u.cells, COLS, ROWS);
  }

  step(dt: number) {
    this.time += dt;
    const gl = this.gl;
    const P = this.progs;
    const v = this.velocity;
    const tx = 1 / v.read.w;
    const ty = 1 / v.read.h;

    gl.disable(gl.BLEND);

    P.emitVelocity.bind();
    gl.uniform2f(P.emitVelocity.u.texel, tx, ty);
    gl.uniform1i(P.emitVelocity.u.uVelocity, v.read.attach(0));
    this.bindObs(P.emitVelocity, 1);
    gl.uniform1f(P.emitVelocity.u.dt, dt);
    gl.uniform1f(P.emitVelocity.u.time, this.time);
    gl.uniform1f(P.emitVelocity.u.flutter, this.look.flutter);
    gl.uniform1f(P.emitVelocity.u.breeze, this.look.breeze);
    this.emitterUniforms(P.emitVelocity);
    this.blit(v.write);
    v.swap();

    P.emitDye.bind();
    gl.uniform2f(P.emitDye.u.texel, tx, ty);
    gl.uniform1i(P.emitDye.u.uDye, this.dye.read.attach(0));
    this.bindObs(P.emitDye, 1);
    gl.uniform1f(P.emitDye.u.dt, dt);
    this.emitterUniforms(P.emitDye);
    this.blit(this.dye.write);
    this.dye.swap();

    // swirl boost so eddies curl up instead of smoothing away
    P.curl.bind();
    gl.uniform2f(P.curl.u.texel, tx, ty);
    gl.uniform1i(P.curl.u.uVelocity, v.read.attach(0));
    this.blit(this.curl);

    P.vorticity.bind();
    gl.uniform2f(P.vorticity.u.texel, tx, ty);
    gl.uniform1i(P.vorticity.u.uVelocity, v.read.attach(0));
    gl.uniform1i(P.vorticity.u.uCurl, this.curl.attach(1));
    gl.uniform1f(P.vorticity.u.curl, this.look.curl);
    gl.uniform2f(P.vorticity.u.cellSize, 1 / COLS, 1 / ROWS);
    this.bindObs(P.vorticity, 2);
    gl.uniform1f(P.vorticity.u.dt, dt);
    this.blit(v.write);
    v.swap();

    P.coanda.bind();
    gl.uniform2f(P.coanda.u.texel, tx, ty);
    gl.uniform2f(P.coanda.u.cellSize, 1 / COLS, 1 / ROWS);
    gl.uniform1f(P.coanda.u.strength, this.look.coanda);
    gl.uniform1f(P.coanda.u.dt, dt);
    gl.uniform1i(P.coanda.u.uVelocity, v.read.attach(0));
    this.bindObs(P.coanda, 1);
    this.blit(v.write);
    v.swap();

    P.divergence.bind();
    gl.uniform2f(P.divergence.u.texel, tx, ty);
    gl.uniform1i(P.divergence.u.uVelocity, v.read.attach(0));
    this.bindObs(P.divergence, 1);
    this.emitterUniforms(P.divergence);
    this.blit(this.divergence);

    P.clear.bind();
    gl.uniform1i(P.clear.u.uTexture, this.pressure.read.attach(0));
    gl.uniform1f(P.clear.u.value, 0.8);
    this.blit(this.pressure.write);
    this.pressure.swap();

    P.pressure.bind();
    gl.uniform2f(P.pressure.u.texel, tx, ty);
    gl.uniform1i(P.pressure.u.uDivergence, this.divergence.attach(0));
    this.bindObs(P.pressure, 2);
    for (let i = 0; i < this.pressureIters; i++) {
      gl.uniform1i(P.pressure.u.uPressure, this.pressure.read.attach(1));
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    P.gradient.bind();
    gl.uniform2f(P.gradient.u.texel, tx, ty);
    gl.uniform1i(P.gradient.u.uPressure, this.pressure.read.attach(0));
    gl.uniform1i(P.gradient.u.uVelocity, v.read.attach(1));
    this.bindObs(P.gradient, 2);
    this.blit(v.write);
    v.swap();

    P.advect.bind();
    gl.uniform2f(P.advect.u.texel, tx, ty);
    gl.uniform1f(P.advect.u.dt, dt);
    this.bindObs(P.advect, 2);
    gl.uniform1i(P.advect.u.uVelocity, v.read.attach(0));
    gl.uniform1i(P.advect.u.uSource, v.read.attach(0));
    gl.uniform1f(P.advect.u.dissipation, this.look.airFade);
    this.blit(v.write);
    v.swap();

    gl.uniform1i(P.advect.u.uVelocity, v.read.attach(0));
    gl.uniform1i(P.advect.u.uSource, this.dye.read.attach(1));
    gl.uniform1f(P.advect.u.dissipation, this.look.smokeFade);
    this.blit(this.dye.write);
    this.dye.swap();

    this.updateProbes();
  }

  render() {
    const gl = this.gl;
    const P = this.progs.display;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    P.bind();
    gl.uniform2f(P.u.texel, 1 / w, 1 / h);
    gl.uniform2f(P.u.dyeSize, this.dye.read.w, this.dye.read.h);
    gl.uniform2f(P.u.cells, COLS, ROWS);
    gl.uniform2f(
      P.u.simTexel,
      1 / this.velocity.read.w,
      1 / this.velocity.read.h,
    );
    gl.uniform1i(P.u.showDye, this.view.dye ? 1 : 0);
    gl.uniform1i(P.u.showWind, this.view.wind ? 1 : 0);
    gl.uniform1i(P.u.showSpeed, this.view.speed ? 1 : 0);
    const L = this.look;

    gl.uniform1f(P.u.speedScale, L.speedScale);
    gl.uniform1f(P.u.opacity, L.opacity);
    gl.uniform1f(P.u.brightness, L.brightness);
    gl.uniform1f(P.u.pixelSize, L.pixelSize);
    gl.uniform1f(P.u.needleDensity, L.needleDensity);
    gl.uniform1f(P.u.needleLength, L.needleLength);
    gl.uniform1f(P.u.needleAlpha, this.view.speed ? L.needleOpacity : 1);
    gl.uniform3fv(
      P.u.rampC,
      [L.ramp0, L.ramp1, L.ramp2, L.ramp3, L.ramp4].flatMap(hex3),
    );
    gl.uniform1i(P.u.uDye, this.dye.read.attach(0));
    gl.uniform1i(P.u.uVelocity, this.velocity.read.attach(1));
    this.blit(null);
  }

  // ---------- async velocity probes ----------
  // The frog needs the air speed at a couple of points every frame. Reading
  // straight back from the GPU stalls the pipeline, so the probe values are
  // rendered into a tiny strip, copied into a buffer, and picked up a frame
  // or two later once the GPU is done.
  private probePoints: [number, number][] = [];
  private probeOut = new Float32Array(MAX_PROBES * 4);
  private probeFbo: FBO | null = null;
  private pbo: WebGLBuffer | null = null;
  private fence: WebGLSync | null = null;

  setProbes(points: [number, number][]) {
    this.probePoints = points.slice(0, MAX_PROBES);
  }

  // air velocity at probe i in cells/s, screen space (y down)
  probe(i: number): [number, number] {
    return [this.probeOut[i * 4] / SUB, -this.probeOut[i * 4 + 1] / SUB];
  }

  private updateProbes() {
    const gl = this.gl;

    if (!this.probeFbo) {
      this.probeFbo = this.fbo(MAX_PROBES, 1, gl.RGBA16F, gl.RGBA);
      this.pbo = gl.createBuffer();
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, MAX_PROBES * 16, gl.STREAM_READ);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    }

    if (this.fence) {
      const status = gl.clientWaitSync(this.fence, 0, 0);

      if (status === gl.TIMEOUT_EXPIRED) return;
      gl.deleteSync(this.fence);
      this.fence = null;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.probeOut);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    }

    const P = this.progs.probe;
    const pts = new Float32Array(MAX_PROBES * 2);

    this.probePoints.forEach(([x, y], i) =>
      pts.set([x / COLS, 1 - y / ROWS], i * 2),
    );
    P.bind();
    gl.uniform2fv(P.u.points, pts);
    gl.uniform1i(P.u.uVelocity, this.velocity.read.attach(0));
    this.blit(this.probeFbo);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.readPixels(0, 0, MAX_PROBES, 1, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  }

  dispose() {
    // don't lose the context: React may remount on the same canvas in dev
    this.disposables.forEach((d) => d());
  }
}
