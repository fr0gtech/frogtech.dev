"use client";

import { RefObject } from "react";

import { FluidCanvas, MaskDrawer, fontReady } from "@/components/fluid-canvas";
import { FluidSettings } from "@/components/fluid-settings";

// Tiny version of the hero sim with a project's logo as the dye source. Each
// logo has a white-on-black mask and a full-colour version for logoColors.

type Box = { x: number; y: number; w: number; h: number };
type Logo = {
  drawMask: MaskDrawer;
  drawColor: MaskDrawer;
  maskReady?: () => Promise<unknown>;
};

const clear = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fill: string,
) => {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fill;
};

// scale + center a shape with bounds `b` into the canvas with some padding
const fit = (ctx: CanvasRenderingContext2D, w: number, h: number, b: Box) => {
  const s = (Math.min(w, h) * 0.8) / Math.max(b.w, b.h);

  ctx.translate(w / 2 - (b.x + b.w / 2) * s, h / 2 - (b.y + b.h / 2) * s);
  ctx.scale(s, s);
};

const textLogo = (text: string, color: string): Logo => {
  const draw =
    (fill: string): MaskDrawer =>
    (ctx, w, h) => {
      clear(ctx, w, h, fill);
      ctx.font = `700 100px ${getComputedStyle(document.body).fontFamily}`;
      const m = ctx.measureText(text);

      ctx.save();
      fit(ctx, w, h, {
        x: -m.actualBoundingBoxLeft,
        y: -m.actualBoundingBoxAscent,
        w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
        h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
      });
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

  return {
    drawMask: draw("#fff"),
    drawColor: draw(color),
    maskReady: fontReady,
  };
};

const pathLogo = (paths: string[], bounds: Box, color: string): Logo => {
  const draw =
    (fill: string): MaskDrawer =>
    (ctx, w, h) => {
      clear(ctx, w, h, fill);
      ctx.save();
      fit(ctx, w, h, bounds);
      paths.forEach((d) => ctx.fill(new Path2D(d), "evenodd"));
      ctx.restore();
    };

  return { drawMask: draw("#fff"), drawColor: draw(color) };
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// bright pixels of a bitmap logo become the shape, the bitmap itself the colour
const imageLogo = (src: string, threshold: number): Logo => {
  let image: HTMLImageElement | null = null;
  let silhouette: HTMLCanvasElement | null = null;

  const drawFitted =
    (get: () => CanvasImageSource | null): MaskDrawer =>
    (ctx, w, h) => {
      clear(ctx, w, h, "#fff");
      const src = get();

      if (!src || !image) return;
      ctx.save();
      fit(ctx, w, h, { x: 0, y: 0, w: image.width, h: image.height });
      ctx.drawImage(src, 0, 0);
      ctx.restore();
    };

  return {
    maskReady: async () => {
      if (silhouette) return;
      image = await loadImage(src);
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;

      c.width = image.width;
      c.height = image.height;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const px = data.data;

      for (let i = 0; i < px.length; i += 4) {
        const lum =
          (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
        const v = lum * (px[i + 3] / 255) > threshold ? 255 : 0;

        px[i] = px[i + 1] = px[i + 2] = v;
        px[i + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
      silhouette = c;
    },
    drawMask: drawFitted(() => silhouette),
    drawColor: drawFitted(() => image),
  };
};

export const LOGOS = {
  vod: textLogo("v", "#8b5cf6"),
  twitchdictionary: pathLogo(
    [
      "M8 16h22v8h-7v24h-8V24H8z",
      "M34 16h6a16 16 0 0 1 0 32h-6zM42 24v16a8 8 0 0 0 0-16z",
    ],
    { x: 8, y: 16, w: 48, h: 32 },
    "#6fd3a5",
  ),
  subsunday: imageLogo("/logos/sub-sunday.png", 0.5),
  mods: imageLogo("/logos/mods.png", 0.3),
} satisfies Record<string, Logo>;

export type LogoKey = keyof typeof LOGOS;

export function ProjectLogo({
  logo,
  settings,
  interactRef,
  className,
}: {
  logo: LogoKey;
  settings: FluidSettings;
  interactRef?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const l: Logo = LOGOS[logo];

  return (
    <FluidCanvas
      className={className}
      drawColor={l.drawColor}
      drawMask={l.drawMask}
      interactRef={interactRef}
      maskReady={l.maskReady}
      settings={settings}
    />
  );
}
