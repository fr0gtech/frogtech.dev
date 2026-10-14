import {
  COLS,
  Emitter,
  KEEP_OUT,
  Level,
  NO_BUILD,
  ROWS,
  WATER_Y,
  Rect,
  Tool,
} from "@/components/wind-game/levels";

export type ToolOrErase = Tool | "erase" | "smoke";

// what the player has built on top of the level
export type Build = {
  fixedGrid: Uint8Array;
  walls: Set<number>;
  emitters: Emitter[];
  // where the frog is right now; nothing can be built on top of it
  frog?: { x: number; y: number };
};

// how close (cells, from the frog's centre) a new piece may get
const FROG_CLEARANCE = 0.9;

export const touchesFrog = (b: Build, x: number, y: number) => {
  if (!b.frog) return false;
  const px = Math.min(Math.max(b.frog.x, x), x + 1);
  const py = Math.min(Math.max(b.frog.y, y), y + 1);

  return Math.hypot(b.frog.x - px, b.frog.y - py) < FROG_CLEARANCE;
};

export const idx = (x: number, y: number) => y * COLS + x;

export const inRect = (x: number, y: number, r: Rect, pad = 0) =>
  x >= r.x - pad &&
  x < r.x + r.w + pad &&
  y >= r.y - pad &&
  y < r.y + r.h + pad;

export const isPad = (level: Level, x: number, y: number) =>
  level.pads.some((p) => inRect(x, y, p));

export function levelGrid(level: Level) {
  const g = new Uint8Array(COLS * ROWS);

  for (const r of [...level.walls, ...level.pads])
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++)
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[idx(x, y)] = 1;

  return g;
}

// walls are kept in placement order, so the first one is the oldest
export const oldestWall = (b: Build) =>
  b.walls.values().next().value as number | undefined;

export const used = (b: Build, t: Tool) =>
  t === "wall" ? b.walls.size : b.emitters.filter((e) => e.kind === t).length;

export const left = (level: Level, b: Build, t: Tool) =>
  (level.budget[t] ?? 0) - used(b, t);

export const emitterAt = (level: Level, b: Build, x: number, y: number) =>
  [...level.emitters, ...b.emitters].find((e) => e.x === x && e.y === y);

export const occupied = (level: Level, b: Build, x: number, y: number) =>
  b.fixedGrid[idx(x, y)] === 1 ||
  b.walls.has(idx(x, y)) ||
  !!emitterAt(level, b, x, y);

// within NO_BUILD cells of a piece that came with the level
export const nearFixed = (level: Level, x: number, y: number) =>
  level.emitters.some(
    (e) =>
      e.kind !== "drain" &&
      Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) <= NO_BUILD,
  );

// can a new piece of this tool go on this cell?
export function canPlace(
  level: Level,
  b: Build,
  x: number,
  y: number,
  t: Tool,
  // walls recycle the oldest one when you run out, so budget doesn't block them
  ignoreBudget = t === "wall",
) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  if (occupied(level, b, x, y)) return false;
  if (!ignoreBudget && left(level, b, t) <= 0) return false;
  if (t === "wall" && (level.budget.wall ?? 0) <= 0) return false;
  if (touchesFrog(b, x, y)) return false;
  if (nearFixed(level, x, y)) return false;
  if (y >= WATER_Y) return false;
  if (t === "wall") return !inRect(x, y, level.target);

  return !inRect(x, y, level.target, KEEP_OUT);
}
