import {
  COLS,
  DIRS,
  Emitter,
  Level,
  NO_BUILD,
  ROWS,
  Rect,
  WATER_Y,
} from "@/components/wind-game/levels";
import {
  Build,
  ToolOrErase,
  canPlace,
  emitterAt,
  idx,
  isPad,
  left,
  oldestWall,
} from "@/components/wind-game/rules";

// Everything on the board that isn't fluid: grid, walls, target, emitters and
// the placement ghost. Drawn on a 2D canvas laid over the WebGL one.

export const PALETTE = {
  fixed: "#e4e4e7",
  player: "#6ee7b7",
  invalid: "#f87171",
  target: "#34d399",
};

export function drawEmitter(
  ctx: CanvasRenderingContext2D,
  e: Pick<Emitter, "kind" | "dir">,
  cx: number,
  cy: number,
  cell: number,
  color: string,
  time: number,
) {
  const [dx, dy] = DIRS[e.dir];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const lw = Math.max(1.5, cell * 0.08);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = cell * 0.35;

  // little triangle on the rim pointing the way the piece blows
  const pointer = (r: number, size: number) => {
    const tx = cx + ux * (r + size);
    const ty = cy + uy * (r + size);

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(cx + ux * r - uy * size * 0.8, cy + uy * r + ux * size * 0.8);
    ctx.lineTo(cx + ux * r + uy * size * 0.8, cy + uy * r - ux * size * 0.8);
    ctx.closePath();
    ctx.fill();
  };

  if (e.kind === "inflow") {
    const pulse = (time * 1.4) % 1;

    ctx.globalAlpha = 1 - pulse;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * (0.3 + pulse * 0.35), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
    pointer(cell * 0.3, cell * 0.16);
  } else if (e.kind === "fan") {
    const r = cell * 0.4;

    ctx.beginPath();
    ctx.roundRect(cx - r, cy - r, r * 2, r * 2, cell * 0.12);
    ctx.stroke();
    ctx.shadowBlur = 0;
    const a = time * 9;

    for (let i = 0; i < 4; i++) {
      const t = a + (i * Math.PI) / 2;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(
        cx + Math.cos(t) * r * 0.6,
        cy + Math.sin(t) * r * 0.6,
        cx + Math.cos(t + 0.6) * r * 0.75,
        cy + Math.sin(t + 0.6) * r * 0.75,
      );
      ctx.stroke();
    }
    ctx.shadowBlur = cell * 0.35;
    pointer(r + lw, cell * 0.16);
  } else {
    // rings sliding inwards
    for (let i = 0; i < 3; i++) {
      const p = (time * 0.8 + i / 3) % 1;

      ctx.globalAlpha = p;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * (0.12 + (1 - p) * 0.32), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
) {
  const px = x * cell;
  const py = y * cell;
  // per-cell variation so stone walls don't look tiled
  const hash = (k: number) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;

    return n - Math.floor(n);
  };
  const v = hash(0);
  const g = 46 + Math.round(v * 14);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = cell * 0.35;
  ctx.shadowOffsetY = cell * 0.08;
  const body = ctx.createLinearGradient(px, py, px, py + cell);

  body.addColorStop(0, `rgb(${g + 18},${g + 20},${g + 22})`);
  body.addColorStop(1, `rgb(${g - 14},${g - 12},${g - 10})`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(px + 0.5, py + 0.5, cell - 1, cell - 1, cell * 0.22);
  ctx.fill();
  ctx.restore();
  // speckles and a mossy top now and then
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle =
      hash(i + 1) > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.18)";
    ctx.fillRect(
      px + hash(i + 10) * cell * 0.8 + cell * 0.1,
      py + hash(i + 20) * cell * 0.8 + cell * 0.1,
      Math.max(1, cell * 0.06),
      Math.max(1, cell * 0.06),
    );
  }
  if (v > 0.6) {
    ctx.fillStyle = "rgba(90,140,80,0.55)";
    ctx.beginPath();
    ctx.ellipse(
      px + cell * 0.5,
      py + cell * 0.08,
      cell * 0.38,
      cell * 0.08,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawPlank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
) {
  const px = x * cell;
  const py = y * cell;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = cell * 0.3;
  ctx.shadowOffsetY = cell * 0.08;
  const wood = ctx.createLinearGradient(px, py, px, py + cell);

  wood.addColorStop(0, "#b58a56");
  wood.addColorStop(1, "#7d5c37");
  ctx.fillStyle = wood;
  ctx.fillRect(px, py, cell, cell);
  ctx.restore();
  ctx.fillStyle = "rgba(255,230,190,0.18)";
  ctx.fillRect(px, py, cell, Math.max(1, cell * 0.08));
  // grain
  ctx.strokeStyle = "rgba(60,40,20,0.4)";
  ctx.lineWidth = Math.max(1, cell * 0.035);
  ctx.beginPath();
  ctx.moveTo(px + cell * 0.05, py + cell * 0.35);
  ctx.bezierCurveTo(
    px + cell * 0.4,
    py + cell * 0.3,
    px + cell * 0.6,
    py + cell * 0.45,
    px + cell * 0.95,
    py + cell * 0.38,
  );
  ctx.moveTo(px + cell * 0.1, py + cell * 0.66);
  ctx.bezierCurveTo(
    px + cell * 0.35,
    py + cell * 0.72,
    px + cell * 0.65,
    py + cell * 0.6,
    px + cell * 0.9,
    py + cell * 0.68,
  );
  ctx.stroke();
  // nails
  ctx.fillStyle = "rgba(30,25,20,0.8)";
  for (const nx of [0.15, 0.85]) {
    ctx.beginPath();
    ctx.arc(
      px + cell * nx,
      py + cell * 0.5,
      Math.max(1, cell * 0.045),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawWater(
  ctx: CanvasRenderingContext2D,
  w: number,
  cell: number,
  time: number,
) {
  const top = WATER_Y * cell + cell * 0.25;
  const g = ctx.createLinearGradient(0, top, 0, top + cell);

  g.addColorStop(0, "rgba(56,120,160,0.55)");
  g.addColorStop(1, "rgba(20,50,80,0.75)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, top + cell);
  for (let x = 0; x <= w; x += Math.max(1, cell / 4))
    ctx.lineTo(
      x,
      top +
        Math.sin(x / cell + time * 2) * cell * 0.06 +
        Math.sin(x / (cell * 0.37) - time * 3) * cell * 0.03,
    );
  ctx.lineTo(w, top + cell);
  ctx.fill();
  // glints
  ctx.fillStyle = "rgba(180,220,255,0.35)";
  for (let i = 0; i < COLS; i += 3) {
    const x = ((i * cell + time * cell * 0.6) % w) + cell * 0.3;

    ctx.fillRect(x, top + cell * 0.3, cell * 0.5, Math.max(1, cell * 0.04));
  }
}

// the leaf's ellipse, shared by the drawing and the fluid's obstacle mask
export const padShape = (p: Rect, cell: number) => ({
  cx: (p.x + p.w / 2) * cell,
  cy: (p.y + 0.45) * cell,
  rx: (p.w / 2) * cell * 1.02,
  ry: cell * 0.42,
});

// white where air can't go: full cells for stones/planks, leaf shapes for pads
export function drawObstacleMask(
  ctx: CanvasRenderingContext2D,
  level: Level,
  b: Build,
  cell: number,
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, COLS * cell, ROWS * cell);
  ctx.fillStyle = "#fff";
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const i = idx(x, y);

      if ((b.fixedGrid[i] && !isPad(level, x, y)) || b.walls.has(i))
        ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  for (const p of level.pads) {
    const { cx, cy, rx, ry } = padShape(p, cell);

    ctx.beginPath();
    ctx.ellipse(cx, cy + cell * 0.04, rx, ry + cell * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// a lily pad leaf: a flat ellipse with a notch, sitting on its cell row
function drawPad(
  ctx: CanvasRenderingContext2D,
  p: Rect,
  cell: number,
  shine: number,
) {
  const { cx, cy, rx, ry } = padShape(p, cell);
  const water = (WATER_Y + 0.35) * cell;

  ctx.save();
  // stem down to the pond so pads read as plants, not floating platforms
  if (cy + ry < water) {
    ctx.strokeStyle = "#24502f";
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.1, cy + ry * 0.6);
    ctx.bezierCurveTo(
      cx + rx * 0.25,
      cy + (water - cy) * 0.4,
      cx - rx * 0.3,
      cy + (water - cy) * 0.7,
      cx + rx * 0.05,
      water,
    );
    ctx.stroke();
  }
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = cell * 0.4;
  ctx.shadowOffsetY = cell * 0.1;
  ctx.fillStyle = "#2f6b3f";
  ctx.beginPath();
  ctx.ellipse(cx, cy + cell * 0.08, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);

  ctx.shadowColor = "transparent";
  g.addColorStop(0, "rgba(120,190,110,0.95)");
  g.addColorStop(1, "#3c8a4c");
  ctx.fillStyle = g;
  ctx.beginPath();
  // leaf with a wedge cut out towards the centre
  ctx.ellipse(cx, cy, rx, ry, 0, -1.25, Math.PI * 2 - 1.75);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
  // veins
  ctx.strokeStyle = `rgba(200,240,190,${shine})`;
  ctx.lineWidth = Math.max(1, cell * 0.03);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = 0.6 + (i / 5) * (Math.PI * 2 - 2.6) + Math.PI * 0.2;

    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * rx * 0.85, cy + Math.sin(a) * ry * 0.85);
  }
  ctx.stroke();
  ctx.restore();
}

// lotus on the goal pad: a closed bud that opens as the frog sits there
function drawLotus(
  ctx: CanvasRenderingContext2D,
  p: Rect,
  cell: number,
  progress: number,
  time: number,
) {
  const cx = (p.x + p.w - 0.55) * cell;
  const base = (p.y + 0.25) * cell;
  const open = progress;
  const size = cell * (0.45 + open * 0.25);
  const sway = Math.sin(time * 1.5) * 0.05;

  ctx.save();
  ctx.translate(cx, base);
  ctx.rotate(sway);
  // glow that builds up while the frog sits on the pad
  if (open > 0) {
    const glow = ctx.createRadialGradient(
      0,
      -size * 0.6,
      0,
      0,
      -size * 0.6,
      size * 2.2,
    );

    glow.addColorStop(0, `rgba(255,170,210,${0.35 * open})`);
    glow.addColorStop(1, "rgba(255,170,210,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-size * 2.2, -size * 2.8, size * 4.4, size * 4.4);
  }
  // petals fan out from straight up (bud) to spread (open)
  const petals = 7;

  for (let layer = 0; layer < 2; layer++)
    for (let i = 0; i < petals; i++) {
      const t = i / (petals - 1) - 0.5; // -0.5..0.5
      const spread = (0.25 + open * (layer ? 1.2 : 1.6)) * t;
      const len = size * (layer ? 0.75 : 1);

      ctx.save();
      ctx.rotate(spread);
      ctx.fillStyle = layer ? "#ffd6e7" : "#f29ac0";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.35, -len * 0.5, 0, -len);
      ctx.quadraticCurveTo(-len * 0.35, -len * 0.5, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  if (open > 0.6) {
    ctx.fillStyle = `rgba(255,220,120,${(open - 0.6) * 2.5})`;
    ctx.beginPath();
    ctx.arc(0, -size * 0.3, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// the parts of the board that only change when something is built
export function drawStatic(
  ctx: CanvasRenderingContext2D,
  w: number,
  level: Level,
  b: Build,
) {
  const cell = w / COLS;

  ctx.clearRect(0, 0, w, ctx.canvas.height);
  // grid dots
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let y = 1; y < ROWS; y++)
    for (let x = 1; x < COLS; x++)
      ctx.fillRect(x * cell - 1, y * cell - 1, 2, 2);

  // stones (the level) and planks (yours); pads are drawn as leaves below
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const i = idx(x, y);

      if (b.fixedGrid[i] && !isPad(level, x, y)) drawStone(ctx, x, y, cell);
      else if (b.walls.has(i)) drawPlank(ctx, x, y, cell);
    }

  for (const p of level.pads) {
    const goal = p === level.goal;

    drawPad(ctx, p, cell, goal ? 0.5 : 0.2);
  }
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  staticLayer: HTMLCanvasElement,
  level: Level,
  b: Build,
  opts: {
    progress: number;
    hover: [number, number] | null;
    tool: ToolOrErase;
    time: number;
  },
) {
  const cell = w / COLS;
  const { progress, hover, tool, time } = opts;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(staticLayer, 0, 0);

  // no-build zones around the level's own pieces while placing
  if (tool !== "erase") {
    ctx.fillStyle = "rgba(239,68,68,0.08)";
    for (const e of level.emitters.filter((e) => e.kind !== "drain"))
      ctx.fillRect(
        (e.x - NO_BUILD) * cell,
        (e.y - NO_BUILD) * cell,
        (NO_BUILD * 2 + 1) * cell,
        (NO_BUILD * 2 + 1) * cell,
      );
  }

  drawWater(ctx, w, cell, time);

  drawLotus(ctx, level.goal, cell, progress, time);

  const center = (e: { x: number; y: number }) =>
    [(e.x + 0.5) * cell, (e.y + 0.5) * cell] as const;

  level.emitters.forEach((e) =>
    drawEmitter(ctx, e, ...center(e), cell, PALETTE.fixed, time),
  );
  b.emitters.forEach((e) =>
    drawEmitter(ctx, e, ...center(e), cell, PALETTE.player, time),
  );

  // out of walls: mark the one that gets recycled next
  if (tool === "wall" && left(level, b, "wall") <= 0) {
    const old = oldestWall(b);

    if (old !== undefined) {
      ctx.strokeStyle = PALETTE.invalid;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        (old % COLS) * cell + 2,
        Math.floor(old / COLS) * cell + 2,
        cell - 4,
        cell - 4,
      );
      ctx.setLineDash([]);
    }
  }

  if (!hover) return;
  const [hx, hy] = hover;
  const mine = b.emitters.find((e) => e.x === hx && e.y === hy);

  if (tool === "smoke") {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc((hx + 0.5) * cell, (hy + 0.5) * cell, cell * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    return;
  }

  if (tool === "erase") {
    const removable = b.walls.has(idx(hx, hy)) || !!mine;

    ctx.strokeStyle = removable ? PALETTE.invalid : "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(hx * cell + 2, hy * cell + 2, cell - 4, cell - 4);
    if (removable) {
      ctx.beginPath();
      ctx.moveTo(hx * cell + cell * 0.25, hy * cell + cell * 0.25);
      ctx.lineTo(hx * cell + cell * 0.75, hy * cell + cell * 0.75);
      ctx.moveTo(hx * cell + cell * 0.75, hy * cell + cell * 0.25);
      ctx.lineTo(hx * cell + cell * 0.25, hy * cell + cell * 0.75);
      ctx.stroke();
    }

    return;
  }

  // hovering your own fan/inflow with its tool: hint that a click rotates it
  if (mine && mine.kind === tool && tool !== "drain") {
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(
      hx * cell + cell / 2,
      hy * cell + cell / 2,
      cell * 0.62,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.setLineDash([]);

    return;
  }

  const ok = canPlace(level, b, hx, hy, tool);

  ctx.globalAlpha = 0.5;
  if (tool === "wall") {
    ctx.fillStyle = ok ? PALETTE.player : PALETTE.invalid;
    ctx.fillRect(hx * cell, hy * cell, cell, cell);
  } else if (!emitterAt(level, b, hx, hy))
    drawEmitter(
      ctx,
      { kind: tool, dir: 0 },
      (hx + 0.5) * cell,
      (hy + 0.5) * cell,
      cell,
      ok ? PALETTE.player : PALETTE.invalid,
      time,
    );
  ctx.globalAlpha = 1;
}

// droplets thrown up where the frog hit the water; age in seconds
export function drawSplash(
  ctx: CanvasRenderingContext2D,
  x: number,
  age: number,
  cell: number,
) {
  const y0 = (WATER_Y + 0.3) * cell;

  ctx.save();
  ctx.fillStyle = `rgba(170,215,255,${Math.max(0, 1 - age / 0.8)})`;
  for (let i = 0; i < 9; i++) {
    const vx = (i - 4) * 1.1;
    const vy = -4 - (i % 3) * 1.3;
    const px = (x + vx * age) * cell;
    const py = y0 + (vy * age + 9 * age * age) * cell;

    if (py > y0 + cell * 0.2) continue;
    ctx.beginPath();
    ctx.arc(px, py, cell * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  // ring on the surface
  ctx.strokeStyle = `rgba(170,215,255,${Math.max(0, 0.6 - age)})`;
  ctx.lineWidth = Math.max(1, cell * 0.04);
  ctx.beginPath();
  ctx.ellipse(
    x * cell,
    y0 + cell * 0.1,
    cell * (0.3 + age * 2),
    cell * 0.12,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}
