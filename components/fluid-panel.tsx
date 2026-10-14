"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_SETTINGS,
  FluidSettings,
  PRESETS,
} from "@/components/fluid-settings";

// Tuning panel for the hero sim. Shown in dev, or anywhere with ?tune.

const STORAGE_KEY = "frogtech-fluid-settings";

export function isTuning() {
  return (
    process.env.NODE_ENV === "development" ||
    new URLSearchParams(window.location.search).has("tune")
  );
}

type NumKey = {
  [K in keyof FluidSettings]: FluidSettings[K] extends number ? K : never;
}[keyof FluidSettings];
type BoolKey = {
  [K in keyof FluidSettings]: FluidSettings[K] extends boolean ? K : never;
}[keyof FluidSettings];
type ColorKey = "colorA" | "colorB" | "background";

const sliders: {
  title: string;
  rows: [NumKey, string, number, number, number][];
}[] = [
  {
    title: "grid",
    rows: [
      ["dyeRes", "dye resolution (pixel size)", 30, 1024, 1],
      ["simRes", "sim resolution", 16, 256, 1],
    ],
  },
  {
    title: "motion",
    rows: [
      ["force", "mouse force", 0, 10000, 50],
      ["radius", "mouse radius", 0.02, 2, 0.01],
      ["curl", "swirl (curl)", 0, 60, 1],
      ["velocityDissipation", "motion fade", 0, 5, 0.05],
      ["dyeDissipation", "smoke fade", 0, 6, 0.05],
      ["inflowRate", "glyph refill speed", 0, 80, 1],
      ["scrollInertia", "scroll push", 0, 4, 0.05],
    ],
  },
  {
    title: "color",
    rows: [
      ["colorSpeed", "color shift speed", 0, 4, 0.05],
      ["colorSpread", "color spread", 0, 20, 0.1],
    ],
  },
];

const toggles: [BoolKey, string][] = [
  ["pixel", "pixelated"],
  ["inflow", "glyphs emit dye"],
  ["masked", "only show inside glyphs"],
];

const colors: [ColorKey, string][] = [
  ["colorA", "color A"],
  ["colorB", "color B"],
  ["background", "background"],
];

export function FluidPanel({
  settings,
  onChange,
}: {
  settings: FluidSettings;
  onChange: (s: FluidSettings) => void;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) onChange({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  const update = (patch: Partial<FluidSettings>) => {
    const next = { ...settings, ...patch };

    onChange(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const copy = async () => {
    const text = JSON.stringify(settings, null, 2);

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("copy these settings", text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      data-fluid-panel
      className="absolute right-4 top-4 z-30 max-h-[calc(100svh-2rem)] w-72 overflow-y-auto rounded-lg border border-white/10 bg-black/75 text-xs text-white/80 backdrop-blur"
    >
      <button
        className="flex w-full items-center justify-between px-3 py-2 font-bold text-white"
        onClick={() => setOpen(!open)}
      >
        tune fluid <span>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-4 px-3 pb-3">
          <div className="flex gap-1">
            {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((p) => (
              <button
                key={p}
                className="flex-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20"
                onClick={() => update(PRESETS[p])}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            {toggles.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  checked={settings[key]}
                  type="checkbox"
                  onChange={(e) => update({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="space-y-1">
            {colors.map(([key, label]) => (
              <label key={key} className="flex items-center justify-between">
                {label}
                <span className="flex items-center gap-2">
                  <span className="text-white/40">{settings[key]}</span>
                  <input
                    className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                    type="color"
                    value={settings[key]}
                    onChange={(e) => update({ [key]: e.target.value })}
                  />
                </span>
              </label>
            ))}
          </div>

          {sliders.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="uppercase tracking-widest text-white/40">
                {group.title}
              </div>
              {group.rows.map(([key, label, min, max, step]) => (
                <label key={key} className="block">
                  <span className="flex justify-between">
                    {label}
                    <span className="text-white/40">{settings[key]}</span>
                  </span>
                  <input
                    className="w-full accent-emerald-400"
                    max={max}
                    min={min}
                    step={step}
                    type="range"
                    value={settings[key]}
                    onChange={(e) => update({ [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
          ))}

          <div className="flex gap-1">
            <button
              className="flex-1 rounded bg-emerald-500/80 px-2 py-1.5 font-bold text-black hover:bg-emerald-400"
              onClick={copy}
            >
              {copied ? "copied!" : "copy settings"}
            </button>
            <button
              className="rounded bg-white/10 px-2 py-1.5 hover:bg-white/20"
              onClick={() => update(DEFAULT_SETTINGS)}
            >
              reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
