"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

import {
  drawBoard,
  drawObstacleMask,
  drawStatic,
  drawSplash,
} from "@/components/wind-game/draw";
import { GameLook, OBSTACLE_RES, WindSim } from "@/components/wind-game/engine";
import { LookPanel } from "@/components/wind-game/look-panel";
import { isTuning } from "@/components/fluid-panel";
import { drawBackground, drawFireflies } from "@/components/wind-game/scenery";
import {
  Body,
  drawBody,
  canopyAt,
  drawUmbrella,
  spawn,
  stepBody,
} from "@/components/wind-game/frog-body";
import { ToolIcon, View, ViewIcon } from "@/components/wind-game/icons";
import { PondAudio } from "@/components/wind-game/sound";
import {
  Result,
  loadBest,
  saveBest,
  scoreRun,
} from "@/components/wind-game/scoring";
import {
  COLS,
  DIRS,
  EmitterKind,
  LEVELS,
  ROWS,
  Tool,
} from "@/components/wind-game/levels";
import {
  Build,
  ToolOrErase,
  canPlace,
  idx,
  left,
  levelGrid,
  oldestWall,
} from "@/components/wind-game/rules";

const HOLD = 1.5; // seconds the frog has to stay in the basket
const SLIP = 0.8; // progress lost per second while it's outside
const PROGRESS_KEY = "frogtech-wind-progress";
const VIEWS: View[] = ["speed", "smoke", "wind", "both"];

const TOOL_INFO: Record<ToolOrErase, { name: string; tip: string }> = {
  wall: { name: "wall", tip: "drag to build" },
  fan: { name: "fan", tip: "pushes air · click it again (or E) to rotate" },
  inflow: {
    name: "inflow",
    tip: "your own vent · click it again (or E) to rotate",
  },
  drain: { name: "drain", tip: "sucks air in, eats smoke" },
  erase: { name: "erase", tip: "drag to remove · or right-click anything" },
  smoke: { name: "smoke", tip: "hold to puff smoke and see the air · free" },
};

export function WindGame({ onExit }: { onExit?: () => void }) {
  const glRef = useRef<HTMLCanvasElement>(null);
  const uiRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<WindSim | null>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<PondAudio | null>(null);
  const [muted, setMuted] = useState(false);

  // sound: created up front, started by the first click/tap/key (browsers
  // block audio until the player interacts)
  useEffect(() => {
    const audio = new PondAudio();

    audioRef.current = audio;
    setMuted(audio.muted);
    const start = () => audio.start();

    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);

    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      audio.dispose();
      audioRef.current = null;
    };
  }, []);
  const [boardPx, setBoardPx] = useState(0);

  // the biggest 16:9 board that fits the screen. Measured from the root, which
  // nothing inside changes, so there's no resize feedback loop. An exact 16:9
  // box also keeps planks lined up with the air they block.
  useEffect(() => {
    const el = areaRef.current;

    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;

      setBoardPx(Math.floor(Math.min(width, (height * COLS) / ROWS)));
    });

    ro.observe(el);

    return () => ro.disconnect();
  }, []);
  const lookRef = useRef<GameLook | null>(null);
  const maskRef = useRef<HTMLCanvasElement>(null!);
  const staticRef = useRef<HTMLCanvasElement>(null!);

  if (!maskRef.current && typeof document !== "undefined") {
    maskRef.current = document.createElement("canvas");
    staticRef.current = document.createElement("canvas");
  }

  const [levelIndex, setLevelIndex] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [tool, setTool] = useState<ToolOrErase>("wall");
  const [progress, setProgress] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("speed");
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<Record<number, Result>>({});

  useEffect(() => setBest(loadBest()), []);
  const [tuning, setTuning] = useState(false);

  useEffect(() => setTuning(isTuning()), []);
  const [, forceRender] = useState(0);

  const level = LEVELS[levelIndex];
  const levelRef = useRef(level);

  levelRef.current = level;

  // mutable game state the render loop reads
  const state = useRef({
    build: {
      fixedGrid: levelGrid(level),
      walls: new Set<number>(),
      emitters: [],
    } as Build,
    body: spawn(level.start) as Body,
    progress: 0,
    cleared: false,
    hover: null as [number, number] | null,
    splashes: [] as { x: number; age: number }[],
    puff: null as [number, number] | null, // smoke tool held here (cells)
    staticDirty: true,
    edits: 0,
    startedAt: 0,
    tool: "wall" as ToolOrErase,
  });

  state.current.tool = tool;
  const build = state.current.build;
  const rerender = () => forceRender((n) => n + 1);

  // ---------- level setup ----------
  const sync = useCallback(() => {
    const sim = simRef.current;
    const b = state.current.build;

    state.current.staticDirty = true;
    if (!sim) return;
    const mask = maskRef.current;

    mask.width = COLS * OBSTACLE_RES;
    mask.height = ROWS * OBSTACLE_RES;
    drawObstacleMask(mask.getContext("2d")!, level, b, OBSTACLE_RES);
    sim.setObstacles(mask);
    sim.setEmitters([...level.emitters, ...b.emitters]);
  }, [level]);

  // a change to the build made by the player: counts towards the score
  const commit = () => {
    state.current.edits++;
    sync();
    rerender();
  };

  const loadLevel = useCallback(() => {
    const s = state.current;

    s.edits = 0;
    s.startedAt = performance.now();
    setResult(null);

    s.build = { fixedGrid: levelGrid(level), walls: new Set(), emitters: [] };
    s.body = spawn(level.start);
    s.progress = 0;
    s.cleared = false;
    setProgress(0);
    setCleared(false);
    simRef.current?.clear();
    sync();
    const first = (Object.keys(level.budget) as Tool[])[0];

    if (first) setTool(first);
    rerender();
  }, [level, sync]);

  useEffect(() => {
    let u = 0;

    try {
      u = Number(localStorage.getItem(PROGRESS_KEY)) || 0;
    } catch {}
    // /pond?level=3 opens that level, so levels can be shared
    const n = Number(new URLSearchParams(window.location.search).get("level"));

    if (n >= 1 && n <= LEVELS.length) {
      setLevelIndex(n - 1);
      u = Math.max(u, n - 1);
    }
    setUnlocked(u);
  }, []);

  // keep the address bar pointing at the current level
  useEffect(() => {
    const url = new URL(window.location.href);

    url.searchParams.set("level", String(levelIndex + 1));
    window.history.replaceState(window.history.state, "", url);
  }, [levelIndex]);

  useEffect(loadLevel, [loadLevel]);

  // ---------- sim + render loop ----------
  useEffect(() => {
    let sim: WindSim;

    try {
      sim = new WindSim(glRef.current!);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setFailed(true);

      return;
    }
    simRef.current = sim;
    if (lookRef.current) sim.look = lookRef.current;
    sync();

    let raf = 0;
    let last = performance.now();
    let frame = 0;
    let avgMs = 16;

    const loop = (now: number) => {
      const frameMs = now - last;
      const dt = Math.min(frameMs / 1000, 1 / 30);
      const s = state.current;

      last = now;
      // adaptive quality: fewer pressure iterations when frames run long
      avgMs = avgMs * 0.95 + frameMs * 0.05;
      if (frame % 60 === 0) {
        if (avgMs > 22 && sim.pressureIters > 16) sim.pressureIters -= 8;
        else if (avgMs < 13 && sim.pressureIters < 40) sim.pressureIters += 4;
      }
      if (s.puff && s.tool === "smoke") sim.puff(s.puff[0], s.puff[1], dt);
      sim.step(dt);
      sim.render();

      // the frog: dragged by the air where it is, respawns if it falls off
      const lv = levelRef.current;
      const g = s.build;
      const solidAt = (x: number, y: number) =>
        x >= 0 &&
        x < COLS &&
        y >= 0 &&
        y < ROWS &&
        (g.fixedGrid[idx(x, y)] === 1 || g.walls.has(idx(x, y)));

      // probes come back a frame late (no GPU stall), plenty for a frog
      sim.setProbes([[s.body.x, s.body.y], canopyAt(s.body)]);
      const air = sim.probe(0);
      const canopyAir = sim.probe(1);

      g.frog = s.body;

      // right above the goal pad the frog folds its umbrella to drop onto it
      const goal = lv.goal;
      const overGoal =
        s.body.x > goal.x - 0.3 &&
        s.body.x < goal.x + goal.w + 0.3 &&
        s.body.y < goal.y;

      for (let i = 0; i < 3; i++)
        if (!stepBody(s.body, dt / 3, air, solidAt, canopyAir, overGoal)) {
          if (s.body.y > ROWS / 2) {
            s.splashes.push({ x: s.body.x, age: 0 });
            audioRef.current?.splash();
          }
          s.body = spawn(lv.start);
          break;
        }
      s.splashes = s.splashes.filter((p) => (p.age += dt) < 1);

      if (!s.cleared) {
        const t = lv.target;
        const b = s.body;
        const inside =
          b.x > t.x && b.x < t.x + t.w && b.y > t.y && b.y < t.y + t.h;

        s.progress = Math.min(
          1,
          Math.max(0, s.progress + (inside ? dt / HOLD : -dt * SLIP)),
        );
        if (s.progress >= 1) {
          s.cleared = true;
          audioRef.current?.clear();
          const r = scoreRun(
            s.build.walls.size + s.build.emitters.length,
            s.edits,
            (now - s.startedAt) / 1000,
          );

          setResult(r);
          setBest(saveBest(LEVELS.indexOf(lv), r));
          setCleared(true);
        }
      }
      if (++frame % 6 === 0) {
        audioRef.current?.wind(Math.hypot(air[0], air[1]));
        setProgress(s.progress);
        uiRef.current?.setAttribute(
          "data-frog",
          `${s.body.x.toFixed(1)},${s.body.y.toFixed(1)},${s.body.umbrella.toFixed(2)}`,
        );
      }

      const c = uiRef.current;

      // nothing to draw until the board has been measured (a 0px cell would
      // make the per-cell loops in the drawing code never finish)
      if (c && c.clientWidth >= COLS) {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.floor(c.clientWidth * dpr);
        const h = Math.floor(c.clientHeight * dpr);

        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const ctx = c.getContext("2d")!;

        if (bgRef.current && bgRef.current.width !== w) {
          bgRef.current.width = w;
          bgRef.current.height = h;
          drawBackground(bgRef.current.getContext("2d")!, w, h);
        }
        // stones, planks and pads only change when something is built
        const st = staticRef.current;

        if (st.width !== w || st.height !== h || s.staticDirty) {
          st.width = w;
          st.height = h;
          drawStatic(st.getContext("2d")!, w, levelRef.current, s.build);
          s.staticDirty = false;
        }
        drawBoard(ctx, w, h, st, levelRef.current, s.build, {
          progress: s.progress,
          hover: s.hover,
          tool: s.tool,
          time: now / 1000,
        });
        drawFireflies(ctx, w, now / 1000);
        drawBody(ctx, s.body, w / COLS, s.progress, now / 1000);
        drawUmbrella(ctx, s.body, w / COLS);
        for (const p of s.splashes) drawSplash(ctx, p.x, p.age, w / COLS);
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      sim.dispose();
      simRef.current = null;
    };
  }, []);

  useEffect(sync, [sync]);

  useEffect(() => {
    if (simRef.current)
      simRef.current.view = {
        dye: view !== "wind",
        // the speed view also gets faint needles so still air reads too
        wind: view !== "smoke",
        speed: view === "speed",
      };
  }, [view, failed]);

  useEffect(() => {
    if (!cleared) return;
    setUnlocked((u) => {
      const next = Math.max(u, levelIndex + 1);

      try {
        localStorage.setItem(PROGRESS_KEY, String(next));
      } catch {}

      return next;
    });
  }, [cleared, levelIndex]);

  // ---------- editing ----------
  const removeAt = (x: number, y: number) => {
    const b = state.current.build;

    if (b.walls.delete(idx(x, y))) return true;
    const before = b.emitters.length;

    b.emitters = b.emitters.filter((e) => !(e.x === x && e.y === y));

    return b.emitters.length !== before;
  };

  const rotateAt = (x: number, y: number) => {
    const mine = state.current.build.emitters.find(
      (e) => e.x === x && e.y === y,
    );

    if (!mine || mine.kind === "drain") return false;
    mine.dir = (mine.dir + 1) % DIRS.length;

    return true;
  };

  const applyAt = (x: number, y: number, first: boolean) => {
    const b = state.current.build;
    const t = state.current.tool;
    let changed = false;

    let sound: "place" | "remove" | "rotate" = "place";

    if (t === "smoke") return;
    if (t === "erase") {
      changed = removeAt(x, y);
      sound = "remove";
    } else if (t === "wall") {
      if (canPlace(level, b, x, y, "wall")) {
        // out of walls: the oldest one goes, the new one takes its place
        if (left(level, b, "wall") <= 0) {
          const old = oldestWall(b);

          if (old !== undefined) b.walls.delete(old);
        }
        b.walls.add(idx(x, y));
        changed = true;
      }
    } else if (first) {
      const mine = b.emitters.find((e) => e.x === x && e.y === y);

      if (mine) {
        changed = mine.kind === t && rotateAt(x, y);
        sound = "rotate";
      } else if (canPlace(level, b, x, y, t)) {
        b.emitters.push({ kind: t as EmitterKind, x, y, dir: 0 });
        changed = true;
      }
    }
    if (changed) {
      audioRef.current?.[sound]();
      commit();
    }
  };

  const drag = useRef<{ last: [number, number] | null; erase: boolean }>({
    last: null,
    erase: false,
  });

  const cellAt = (e: React.PointerEvent): [number, number] | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * COLS);
    const y = Math.floor(((e.clientY - r.top) / r.height) * ROWS);

    return x >= 0 && x < COLS && y >= 0 && y < ROWS ? [x, y] : null;
  };

  // every cell between two points so fast drags don't leave gaps
  const line = (a: [number, number], b: [number, number]) => {
    const out: [number, number][] = [];
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);

    for (let i = 1; i <= n; i++)
      out.push([
        Math.round(a[0] + ((b[0] - a[0]) * i) / n),
        Math.round(a[1] + ((b[1] - a[1]) * i) / n),
      ]);

    return out;
  };

  const pointAt = (e: React.PointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();

    return [
      ((e.clientX - r.left) / r.width) * COLS,
      ((e.clientY - r.top) / r.height) * ROWS,
    ];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (state.current.tool === "smoke" && e.button === 0) {
      e.currentTarget.setPointerCapture(e.pointerId);
      state.current.puff = pointAt(e);

      return;
    }
    if (state.current.cleared) return;
    const c = cellAt(e);

    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { last: c, erase: e.button === 2 };
    if (e.button === 2) {
      if (removeAt(...c)) {
        audioRef.current?.remove();
        commit();
      }
    } else applyAt(c[0], c[1], true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const c = cellAt(e);

    state.current.hover = c;
    if (state.current.puff) {
      state.current.puff = pointAt(e);

      return;
    }
    const d = drag.current;

    if (!c || !d.last || state.current.cleared) return;
    if (c[0] === d.last[0] && c[1] === d.last[1]) return;
    for (const [x, y] of line(d.last, c)) {
      if (d.erase) {
        if (removeAt(x, y)) {
          audioRef.current?.remove();
          commit();
        }
      } else applyAt(x, y, false);
    }
    d.last = c;
  };

  const tools = [
    ...(Object.keys(level.budget) as Tool[]),
    "erase",
    "smoke",
  ] as ToolOrErase[];

  // put the frog back at the start, keep everything you built
  const restartFrog = () => {
    const s = state.current;

    s.body = spawn(level.start);
    if (!s.cleared) s.progress = 0;
    // calm air again, so every run starts the same way
    simRef.current?.clear();
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);

      if (n >= 1 && n <= tools.length) setTool(tools[n - 1]);
      else if (e.key === "v" || e.key === "V")
        setView((v) => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length]);
      else if (e.key === "r" || e.key === "R") restartFrog();
      else if ((e.key === "e" || e.key === "E") && state.current.hover) {
        if (rotateAt(...state.current.hover)) {
          audioRef.current?.rotate();
          commit();
        }
      } else if (e.key === "Escape") onExit?.();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  });

  const isLast = levelIndex === LEVELS.length - 1;
  const segments = 20;
  const panel =
    "rounded-lg border border-white/10 bg-black/45 backdrop-blur-sm";

  if (failed)
    return (
      <div className="absolute inset-0 flex items-center justify-center text-white/60">
        your browser can&apos;t run the wind sim, sorry.
        {onExit && (
          <button className="ml-4 underline" onClick={onExit}>
            back
          </button>
        )}
      </div>
    );

  const iconButton = (
    label: string,
    title: string,
    onClick: () => void,
    path: string,
  ) => (
    <button
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white md:h-10 md:w-10"
      title={title}
      onClick={onClick}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d={path} />
      </svg>
    </button>
  );

  return (
    // full screen: the board is the biggest 16:9 area that fits, the HUD
    // floats over it and only its buttons take clicks
    <div
      ref={areaRef}
      className="absolute inset-0 select-none overflow-hidden bg-[#050b0e] text-white"
      data-progress={progress.toFixed(3)}
    >
      {tuning && (
        <LookPanel
          onChange={(l) => {
            lookRef.current = l;
            if (simRef.current) simRef.current.look = l;
          }}
        />
      )}

      {/* ---------- board ---------- */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
        style={{ width: boardPx, height: (boardPx * ROWS) / COLS }}
      >
        <canvas ref={bgRef} className="absolute inset-0 h-full w-full" />
        <canvas ref={glRef} className="absolute inset-0 h-full w-full" />
        <canvas
          ref={uiRef}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={onPointerDown}
          onPointerLeave={() => (state.current.hover = null)}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            drag.current.last = null;
            state.current.puff = null;
          }}
        />
        {cleared && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40">
            <div className="text-4xl font-bold tracking-[0.2em] md:text-6xl">
              {isLast ? "ALL CLEAR" : "CLEARED"}
            </div>
            {result && (
              <div className="flex flex-col items-center gap-1">
                <div className="text-3xl tracking-widest">
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      className={
                        n <= result.stars ? "text-amber-200" : "text-white/20"
                      }
                    >
                      ★
                    </span>
                  ))}
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {result.score}
                </div>
                <div className="text-xs text-white/60">
                  {result.pieces} pieces · {result.edits} edits ·{" "}
                  {result.seconds}s
                  {best[levelIndex] &&
                    best[levelIndex].score > result.score &&
                    ` · best ${best[levelIndex].score}`}
                  {best[levelIndex]?.score === result.score && " · new best!"}
                </div>
              </div>
            )}
            <div className="pointer-events-auto flex gap-2">
              <button
                className="rounded-md border border-white/20 bg-black/60 px-4 py-2 text-sm hover:border-white/50"
                onClick={loadLevel}
              >
                replay
              </button>
              {!isLast && (
                <button
                  className="rounded-md bg-white px-4 py-2 text-sm font-bold text-black hover:bg-white/80"
                  onClick={() => setLevelIndex(levelIndex + 1)}
                >
                  next level →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------- hud ---------- */}
      <div className="pointer-events-none absolute inset-0">
        {/* level, top left */}
        <div
          className={clsx(
            panel,
            "pointer-events-auto absolute left-2 top-2 flex max-w-[34%] items-center gap-2.5 py-1.5 pl-1.5 pr-3 lg:max-w-[36%]",
          )}
        >
          <div className="rounded-md bg-white/10 px-2 py-0.5 text-center leading-none">
            <div className="text-[8px] tracking-[0.3em] text-white/50">LVL</div>
            <div className="text-lg font-bold tabular-nums">
              {String(levelIndex + 1).padStart(2, "0")}
            </div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight">
              {level.name}
            </div>
            <div className="hidden truncate text-[11px] text-white/55 lg:block">
              {level.hint}
            </div>
            {/* small screens have no room for the gauge, show the % here */}
            <div className="text-[11px] tabular-nums text-white/55 lg:hidden">
              {Math.floor(progress * 100)}%
            </div>
          </div>
        </div>

        {/* fill gauge, top centre */}
        <div
          className={clsx(
            panel,
            "absolute left-1/2 top-2 hidden -translate-x-1/2 items-center gap-2 px-3 py-2 lg:flex",
          )}
        >
          <div className="flex gap-[3px]">
            {Array.from({ length: segments }, (_, i) => (
              <div
                key={i}
                className={clsx(
                  "h-2.5 w-1.5 rounded-[1px] transition-colors duration-200",
                  i < Math.round(progress * segments)
                    ? "bg-white"
                    : "bg-white/15",
                )}
              />
            ))}
          </div>
          <div className="w-9 text-right text-sm font-bold tabular-nums">
            {Math.floor(progress * 100)}
            <span className="text-[10px] text-white/50">%</span>
          </div>
        </div>

        {/* levels, views, exit: top right */}
        <div className="pointer-events-auto absolute right-2 top-2 flex items-center gap-1.5">
          <div className={clsx(panel, "flex gap-1 p-1")}>
            {LEVELS.map((l, i) => {
              const stars = best[i]?.stars ?? 0;

              return (
                <button
                  key={l.name}
                  aria-label={`level ${i + 1}`}
                  className={clsx(
                    "flex h-6 w-6 items-center justify-center rounded-[4px] text-[10px] tabular-nums transition-colors",
                    i === levelIndex
                      ? "bg-white text-black"
                      : i <= unlocked
                        ? "text-white/70 hover:bg-white/15"
                        : "text-white/20",
                  )}
                  disabled={i > unlocked}
                  title={`${i + 1}. ${l.name}${
                    best[i]
                      ? ` · best ${best[i].score} (${"★".repeat(stars)})`
                      : ""
                  }`}
                  onClick={() => setLevelIndex(i)}
                >
                  {stars ? (
                    <span className={i === levelIndex ? "" : "text-amber-200"}>
                      {stars}★
                    </span>
                  ) : (
                    i + 1
                  )}
                </button>
              );
            })}
          </div>
          <div className={clsx(panel, "hidden gap-0.5 p-1 sm:flex")}>
            {VIEWS.map((v) => (
              <button
                key={v}
                aria-label={v}
                className={clsx(
                  "flex h-6 w-6 items-center justify-center rounded-[4px] transition-colors",
                  v === view
                    ? "bg-white/20 text-white"
                    : "text-white/45 hover:text-white",
                )}
                title={`${v} view (V)`}
                onClick={() => setView(v)}
              >
                <ViewIcon className="h-4 w-4" view={v} />
              </button>
            ))}
          </div>
          <button
            aria-label={muted ? "unmute" : "mute"}
            className={clsx(
              panel,
              "flex h-8 w-8 items-center justify-center text-white/60 hover:text-white",
            )}
            title={muted ? "sound off" : "sound on"}
            onClick={() => {
              const m = !muted;

              setMuted(m);
              audioRef.current?.setMuted(m);
            }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M4 9h4l5-4v14l-5-4H4z" />
              {muted ? (
                <path d="M17 9l5 6M22 9l-5 6" />
              ) : (
                <path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />
              )}
            </svg>
          </button>
          {onExit && (
            <button
              className={clsx(
                panel,
                "flex h-8 w-8 items-center justify-center text-xs text-white/60 hover:text-white",
              )}
              title="exit (esc)"
              onClick={onExit}
            >
              ✕
            </button>
          )}
        </div>

        {/* tools: vertical bar on the right edge */}
        <div
          className={clsx(
            panel,
            "pointer-events-auto absolute right-2 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5 p-1.5",
          )}
        >
          {tools.map((t, i) => {
            const count =
              t === "erase" || t === "smoke" ? null : left(level, build, t);
            const active = t === tool;

            return (
              <button
                key={t}
                aria-label={t}
                className={clsx(
                  "relative flex h-10 w-10 items-center justify-center rounded-md border-2 transition-all md:h-12 md:w-12",
                  active
                    ? "-translate-x-1 border-white bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white",
                  count === 0 && t !== "wall" && !active && "opacity-40",
                )}
                title={`${TOOL_INFO[t].name} (${i + 1}): ${TOOL_INFO[t].tip}`}
                onClick={() => setTool(t)}
              >
                <ToolIcon className="h-5 w-5 md:h-6 md:w-6" tool={t} />
                <span className="absolute left-1 top-0.5 hidden text-[8px] text-white/40 md:block">
                  {i + 1}
                </span>
                {count !== null && (
                  <span
                    className={clsx(
                      "absolute -bottom-1.5 -left-1.5 min-w-[18px] rounded-full px-1 text-[10px] font-bold tabular-nums",
                      count > 0
                        ? "bg-white text-black"
                        : "bg-red-500/80 text-white",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <div className="my-0.5 h-px w-full bg-white/10" />
          {iconButton(
            "restart frog",
            "restart frog (R)",
            restartFrog,
            "M6 4v16M6 5h10l-2 3.5 2 3.5H6",
          )}
          {iconButton(
            "reset",
            "reset level (clears what you built)",
            loadLevel,
            "M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4",
          )}
        </div>

        {/* what the selected tool does + keys, bottom left */}
        <div
          className={clsx(
            panel,
            "absolute bottom-2 left-2 hidden max-w-[40%] px-3 py-1.5 text-[11px] md:block",
          )}
        >
          <span className="font-bold">{TOOL_INFO[tool].name}</span>
          <span className="text-white/55"> · {TOOL_INFO[tool].tip}</span>
          <div className="text-[10px] text-white/35">
            1-{tools.length} tools · E rotate · V view · R restart frog
            {onExit && " · esc exits"}
          </div>
        </div>

        <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 text-[11px] text-white/45 portrait:block md:portrait:hidden">
          tip: turn your phone sideways for a bigger pond
        </div>
      </div>
    </div>
  );
}
