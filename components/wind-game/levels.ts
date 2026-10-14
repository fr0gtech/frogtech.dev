// Levels for the wind game. Everything is in grid cells, x right, y down.

export const COLS = 32;
export const ROWS = 18;

export type Rect = { x: number; y: number; w: number; h: number };
export type EmitterKind = "inflow" | "fan" | "drain";
export type Emitter = {
  kind: EmitterKind;
  x: number;
  y: number;
  dir: number; // index into DIRS
  fixed?: boolean;
};
export type Tool = "wall" | "fan" | "inflow" | "drain";
export type Level = {
  name: string;
  hint: string;
  walls: Rect[]; // stones
  pads: Rect[]; // lily pads (solid, one row high), including the goal pad
  emitters: Emitter[];
  target: Rect; // the space just above the goal pad
  goal: Rect; // the goal lily pad itself
  start: { x: number; y: number }; // where the frog spawns
  budget: Partial<Record<Tool, number>>;
};

// screen directions, clockwise starting at "right"
export const DIRS: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const R = 0;
const L = 4;
const U = 6;

// the bottom row is the pond: fall in and the frog swims back to the start
export const WATER_Y = ROWS - 1;

const pad = (x: number, y: number, w: number): Rect => ({ x, y, w, h: 1 });

// a level, with the goal pad's landing area worked out
function level(
  l: Omit<Level, "target" | "pads" | "goal"> & { pads: Rect[]; goal: Rect },
): Level {
  return {
    ...l,
    pads: [...l.pads, l.goal],
    target: { x: l.goal.x, y: l.goal.y - 2, w: l.goal.w, h: 2 },
  };
}

// Every level: get the frog from its lily pad onto the one with the lotus,
// and let it sit there while the flower opens.
export const LEVELS: Level[] = [
  level({
    name: "first hop",
    hint: "the wind throws the frog short. build a ramp so it lands on the lotus pad.",
    walls: [],
    pads: [pad(3, 8, 3)],
    goal: pad(26, 13, 3),
    emitters: [{ kind: "inflow", x: 1, y: 7, dir: R, fixed: true }],
    start: { x: 4, y: 7 },
    budget: { wall: 14 },
  }),
  level({
    name: "updraft",
    hint: "nudge the frog into the updraft with a fan, then bend the wind with walls.",
    walls: [],
    pads: [pad(3, 11, 5)],
    goal: pad(25, 7, 3),
    emitters: [{ kind: "inflow", x: 12, y: 16, dir: U, fixed: true }],
    start: { x: 5, y: 10 },
    budget: { fan: 1, wall: 16 },
  }),
  level({
    name: "the wall",
    hint: "knock the frog into the wind, under the big rock and over the next.",
    walls: [
      { x: 15, y: 0, w: 2, h: 11 },
      { x: 21, y: 6, w: 1, h: 11 },
    ],
    pads: [pad(3, 11, 3)],
    goal: pad(27, 10, 3),
    emitters: [{ kind: "inflow", x: 1, y: 14, dir: R, fixed: true }],
    start: { x: 4, y: 10 },
    budget: { wall: 30, fan: 1 },
  }),
  level({
    name: "the thief",
    hint: "drains pull the air (and your frog) towards them. wall them off.",
    walls: [],
    pads: [pad(4, 9, 3)],
    goal: pad(26, 13, 3),
    emitters: [
      { kind: "inflow", x: 2, y: 8, dir: R, fixed: true },
      { kind: "drain", x: 14, y: 12, dir: R, fixed: true },
      { kind: "drain", x: 15, y: 12, dir: R, fixed: true },
    ],
    start: { x: 5, y: 8 },
    budget: { wall: 12, fan: 1 },
  }),
  level({
    name: "bring your own",
    hint: "no vent this time. place your own inflow and aim it.",
    walls: [],
    pads: [pad(4, 10, 5)],
    goal: pad(26, 12, 3),
    emitters: [],
    start: { x: 6, y: 9 },
    budget: { inflow: 1, fan: 1, wall: 16 },
  }),
  level({
    name: "venturi",
    hint: "headwind. a drain pulls the air towards it, use that to steer.",
    walls: [],
    pads: [pad(4, 16, 3)],
    goal: pad(27, 9, 3),
    emitters: [
      { kind: "inflow", x: 2, y: 15, dir: R, fixed: true },
      { kind: "fan", x: 20, y: 11, dir: L, fixed: true },
      { kind: "fan", x: 20, y: 12, dir: L, fixed: true },
    ],
    start: { x: 5, y: 15 },
    budget: { drain: 1, fan: 1, wall: 20 },
  }),
];

// fans, inflows and drains can't sit this close to the target
export const KEEP_OUT = 3;
// nothing can be built this close (in cells) to the level's own pieces
export const NO_BUILD = 1;
