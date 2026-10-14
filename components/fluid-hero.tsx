"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";

import { FluidCanvas, fontReady } from "@/components/fluid-canvas";
import { FluidPanel, isTuning } from "@/components/fluid-panel";
import { DEFAULT_SETTINGS, FluidSettings } from "@/components/fluid-settings";
import { frogPath } from "@/components/icons";

// frog logo + "frogtech" wordmark, side by side or stacked on narrow screens
function drawWordmark(ctx: CanvasRenderingContext2D, w: number, h: number) {
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
  const [failed, setFailed] = useState(false);
  const [settings, setSettings] = useState<FluidSettings>(DEFAULT_SETTINGS);
  const [tuning, setTuning] = useState(false);
  const router = useRouter();

  // old links: frogtech.dev/?play goes to the game's own page
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("play"))
      router.replace("/pond");
  }, [router]);

  useEffect(() => setTuning(isTuning()), []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--frog-bg",
      settings.background,
    );
  }, [settings.background]);

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
        <FluidCanvas
          className="absolute inset-0 h-full w-full touch-pan-y"
          drawMask={drawWordmark}
          maskReady={fontReady}
          settings={settings}
          onFail={() => setFailed(true)}
        />
      )}
      {!failed && (
        <NextLink
          className="group absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-black/40 py-1.5 pl-1.5 pr-5 text-xs text-white/70 backdrop-blur transition-all hover:border-white/50 hover:text-white"
          href="/pond"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black transition-transform group-hover:scale-110">
            ▶
          </span>
          <span>
            <span className="font-bold uppercase tracking-[0.25em]">play</span>
            <span className="text-white/40"> · a tiny wind-physics pond</span>
          </span>
        </NextLink>
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
