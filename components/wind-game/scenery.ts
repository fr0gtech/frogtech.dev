import { COLS, ROWS, WATER_Y } from "@/components/wind-game/levels";

// Static night-pond backdrop behind the fluid: sky, moon, tree line, reeds and
// mist. Seeded so it looks the same every time.

function rng(seed: number) {
  let s = seed;

  return () => {
    s = (s * 16807) % 2147483647;

    return s / 2147483647;
  };
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const cell = w / COLS;
  const water = (WATER_Y + 0.25) * cell;
  const rand = rng(42);

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, water);

  sky.addColorStop(0, "#04080c");
  sky.addColorStop(0.55, "#071413");
  sky.addColorStop(1, "#0b221d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // stars
  for (let i = 0; i < 70; i++) {
    const x = rand() * w;
    const y = rand() * water * 0.55;

    ctx.fillStyle = `rgba(220,235,255,${0.15 + rand() * 0.35})`;
    ctx.fillRect(x, y, rand() < 0.15 ? 2 : 1, 1);
  }

  // moon with a soft halo
  const mx = w * 0.82;
  const my = h * 0.16;
  const halo = ctx.createRadialGradient(mx, my, 0, mx, my, cell * 6);

  halo.addColorStop(0, "rgba(220,235,210,0.18)");
  halo.addColorStop(1, "rgba(220,235,210,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(mx - cell * 6, my - cell * 6, cell * 12, cell * 12);
  ctx.fillStyle = "rgba(230,240,220,0.75)";
  ctx.beginPath();
  ctx.arc(mx, my, cell * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // distant tree line
  ctx.fillStyle = "#06110e";
  ctx.beginPath();
  ctx.moveTo(0, water);
  for (let x = 0; x <= w; x += Math.max(1, cell * 0.5)) {
    const t = x / w;
    const y =
      water -
      cell *
        (3.2 +
          Math.sin(t * 9) * 0.8 +
          Math.sin(t * 23 + 1) * 0.45 +
          Math.sin(t * 61) * 0.2);

    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, water);
  ctx.fill();

  // mist hanging over the water
  const mist = ctx.createLinearGradient(0, water - cell * 2.5, 0, water);

  mist.addColorStop(0, "rgba(160,200,190,0)");
  mist.addColorStop(1, "rgba(160,200,190,0.07)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, water - cell * 2.5, w, cell * 2.5);

  // reeds and cattails along the shore, two depths
  for (const [count, color, scale] of [
    [26, "#0a1b15", 0.8],
    [16, "#0f2a1f", 1.1],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const tall = cell * (1.2 + rand() * 2.6) * scale;
      const lean = (rand() - 0.5) * cell * 0.8;

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, cell * 0.07 * scale);
      ctx.beginPath();
      ctx.moveTo(x, water + cell * 0.2);
      ctx.quadraticCurveTo(x, water - tall * 0.5, x + lean, water - tall);
      ctx.stroke();
      if (rand() < 0.45) {
        ctx.fillStyle = "#1a120b";
        ctx.beginPath();
        ctx.ellipse(
          x + lean * 0.9,
          water - tall * 0.88,
          cell * 0.1 * scale,
          cell * 0.32 * scale,
          lean / tall,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  // moon reflection on the water
  ctx.fillStyle = "rgba(220,235,210,0.12)";
  for (let i = 0; i < 6; i++)
    ctx.fillRect(
      mx - cell * (0.9 - i * 0.12),
      water + cell * (0.15 + i * 0.12),
      cell * (1.8 - i * 0.24),
      Math.max(1, cell * 0.05),
    );

  // vignette
  const v = ctx.createRadialGradient(
    w / 2,
    h / 2,
    h * 0.4,
    w / 2,
    h / 2,
    w * 0.75,
  );

  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

// a handful of fireflies drifting about, drawn on top every frame
export function drawFireflies(
  ctx: CanvasRenderingContext2D,
  w: number,
  time: number,
) {
  const cell = w / COLS;

  ctx.save();
  for (let i = 0; i < 7; i++) {
    const x =
      (((i * 4.7 + Math.sin(time * 0.3 + i) * 2.5) % COLS) + COLS) % COLS;
    const y =
      3 + ((i * 2.3) % (ROWS - 6)) + Math.sin(time * 0.7 + i * 1.7) * 1.2;
    const blink = Math.max(0, Math.sin(time * 1.3 + i * 2.1));
    const g = ctx.createRadialGradient(
      x * cell,
      y * cell,
      0,
      x * cell,
      y * cell,
      cell * 0.5,
    );

    g.addColorStop(0, `rgba(230,255,140,${0.8 * blink})`);
    g.addColorStop(1, "rgba(230,255,140,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x * cell - cell / 2, y * cell - cell / 2, cell, cell);
  }
  ctx.restore();
}
