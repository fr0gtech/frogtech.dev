"use client";

import { useEffect, useState } from "react";

import { DEFAULT_LOOK, GameLook } from "@/components/wind-game/engine";

// Tuning panel for how the game's air looks and moves. Shown in dev or with
// ?tune, like the hero panels.

const STORAGE_KEY = "frogtech-wind-look";

type NumKey = {
  [K in keyof GameLook]: GameLook[K] extends number ? K : never;
}[keyof GameLook];
type ColorKey = Exclude<keyof GameLook, NumKey>;

const groups: {
  title: string;
  rows: [NumKey, string, number, number, number][];
}[] = [
  {
    title: "look",
    rows: [
      ["opacity", "smoke opacity", 0.2, 4, 0.05],
      ["brightness", "brightness", 0.2, 2, 0.05],
      ["speedScale", "speed for top colour", 10, 200, 1],
      ["pixelSize", "pixel size", 1, 6, 1],
      ["needleDensity", "wind needles per cell", 1, 4, 1],
      ["needleLength", "wind needle length", 0.02, 0.5, 0.01],
      ["needleOpacity", "needles in speed view", 0, 1, 0.05],
    ],
  },
  {
    title: "air",
    rows: [
      ["curl", "swirl", 0, 40, 0.5],
      ["flutter", "vent flutter", 0, 0.6, 0.01],
      ["breeze", "ambient breeze", 0, 40, 0.5],
      ["coanda", "wall hugging", 0, 20, 0.5],
      ["airFade", "air fade", 0, 3, 0.05],
      ["smokeFade", "smoke fade", 0, 3, 0.05],
    ],
  },
];

const colors: [ColorKey, string][] = [
  ["ramp0", "still"],
  ["ramp1", "slow"],
  ["ramp2", "medium"],
  ["ramp3", "fast"],
  ["ramp4", "fastest"],
];

export function LookPanel({ onChange }: { onChange: (l: GameLook) => void }) {
  const [look, setLook] = useState<GameLook>(DEFAULT_LOOK);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const l = { ...DEFAULT_LOOK, ...JSON.parse(saved) };

        setLook(l);
        onChange(l);
      }
    } catch {}
  }, []);

  const update = (patch: Partial<GameLook>) => {
    const next = { ...look, ...patch };

    setLook(next);
    onChange(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const copy = async () => {
    const text = JSON.stringify(look, null, 2);

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("copy these settings", text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed right-4 top-4 z-40 max-h-[calc(100svh-2rem)] w-72 overflow-y-auto rounded-lg border border-white/10 bg-black/80 text-xs text-white/80 backdrop-blur">
      <button
        className="flex w-full items-center justify-between px-3 py-2 font-bold text-white"
        onClick={() => setOpen(!open)}
      >
        tune game look <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-4 px-3 pb-3">
          <div className="space-y-1">
            <div className="uppercase tracking-widest text-white/40">
              speed colours
            </div>
            {colors.map(([key, label]) => (
              <label key={key} className="flex items-center justify-between">
                {label}
                <span className="flex items-center gap-2">
                  <span className="text-white/40">{look[key]}</span>
                  <input
                    className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                    type="color"
                    value={look[key]}
                    onChange={(e) => update({ [key]: e.target.value })}
                  />
                </span>
              </label>
            ))}
          </div>
          {groups.map((g) => (
            <div key={g.title} className="space-y-2">
              <div className="uppercase tracking-widest text-white/40">
                {g.title}
              </div>
              {g.rows.map(([key, label, min, max, step]) => (
                <label key={key} className="block">
                  <span className="flex justify-between">
                    {label}
                    <span className="text-white/40">{look[key]}</span>
                  </span>
                  <input
                    className="w-full accent-white"
                    max={max}
                    min={min}
                    step={step}
                    type="range"
                    value={look[key]}
                    onChange={(e) => update({ [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
          ))}
          <div className="flex gap-1">
            <button
              className="flex-1 rounded bg-white px-2 py-1.5 font-bold text-black hover:bg-white/80"
              onClick={copy}
            >
              {copied ? "copied!" : "copy settings"}
            </button>
            <button
              className="rounded bg-white/10 px-2 py-1.5 hover:bg-white/20"
              onClick={() => update(DEFAULT_LOOK)}
            >
              reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
