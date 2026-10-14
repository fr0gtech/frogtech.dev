import { COLS, WATER_Y } from "@/components/wind-game/levels";

// The thing you blow around: a light frog that gets dragged along by the air
// around it, falls under gravity and bounces off walls. Units are grid cells.

export const RADIUS = 0.75;
const DRAG = 3.2; // how quickly it picks up the air's sideways speed (1/s)
// the body itself is fairly dense: little vertical drag, so it drops with
// some weight; the umbrella is what makes it float
const DRAG_V = 1.2;
const GRAVITY = 12; // cells/s²
const BOUNCE = 0.3;
const FRICTION = 1.5; // sliding speed lost per second against a wall
const CALM = 2; // cells/s of air the frog shrugs off
const GRIP = 9; // extra sideways damping while standing, so breezes don't slide it
// jelly: squash spring that gets kicked by impacts and wobbles back
const JELLY_K = 260;
const JELLY_DAMP = 9;
const JELLY_KICK = 0.06;

// umbrella: open whenever the frog is airborne. It swings to point the way the
// wind blows (like a sail held out in front, straight up in calm air) and its
// canopy catches air along its axis: lift in updrafts, slow falls, and a pull
// downwind in a crosswind.
export const UMBRELLA_REACH = 1.35; // cells from the frog to the canopy
const UMB_DRAG = 4.5;
const UMB_SWING = 10; // how fast it turns towards the wind
const UMB_DAMP = 4;
const UMB_FULL_WIND = 6; // cells/s of wind for it to point fully downwind
const UMB_SPEED = 3.5; // opens/closes per second
// after spawning the frog hovers in place so the wind can get going
const SPAWN_HOLD = 1.2;

export type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  squash: number; // < 0 flattened along squashAngle, > 0 stretched
  squashV: number;
  squashAngle: number;
  hold: number; // seconds left hovering at the spawn point
  ground: number; // > 0 while standing on something
  facing: 1 | -1;
  umbrella: number; // 0 closed .. 1 open
  umbAngle: number; // 0 = straight up, radians
  umbAngV: number;
};

// where the canopy is, so the sim can be sampled there
export const canopyAt = (b: Body): [number, number] => [
  b.x + Math.sin(b.umbAngle) * UMBRELLA_REACH,
  b.y - Math.cos(b.umbAngle) * UMBRELLA_REACH,
];

export const spawn = (p: { x: number; y: number }): Body => ({
  x: p.x + 0.5,
  y: p.y + 0.5,
  vx: 0,
  vy: 0,
  squash: 0,
  squashV: 0,
  squashAngle: 0,
  hold: SPAWN_HOLD,
  ground: 0,
  facing: 1,
  umbrella: 0,
  umbAngle: 0,
  umbAngV: 0,
});

// returns false once the frog has left the board or fallen in the water
export function stepBody(
  b: Body,
  dt: number,
  air: [number, number],
  solidAt: (x: number, y: number) => boolean,
  canopyAir: [number, number] = air,
  furl = false, // fold the umbrella (e.g. above the goal pad, to land)
) {
  if (b.hold > 0) {
    b.hold -= dt;

    return true;
  }
  // light air (the ambient breeze, small eddies) doesn't move the frog,
  // only real wind from vents, fans and drains does
  const airSpeed = Math.hypot(air[0], air[1]);
  const felt = Math.min(1, Math.max(0, (airSpeed - CALM) / CALM));

  air = [air[0] * felt, air[1] * felt];
  b.vx += (air[0] - b.vx) * DRAG * dt;
  b.vy += ((air[1] - b.vy) * DRAG_V + GRAVITY) * dt;

  // umbrella
  const wantOpen = b.ground <= 0 && !furl ? 1 : 0;

  b.umbrella += Math.max(
    -UMB_SPEED * dt,
    Math.min(UMB_SPEED * dt, wantOpen - b.umbrella),
  );
  if (b.umbrella > 0.02) {
    const cs = Math.hypot(canopyAir[0], canopyAir[1]);
    const cf = Math.min(1, Math.max(0, (cs - CALM) / CALM));
    const ux = canopyAir[0] * cf;
    const uy = canopyAir[1] * cf;
    // air relative to the canopy, pushing along the umbrella's axis
    const ax = Math.sin(b.umbAngle);
    const ay = -Math.cos(b.umbAngle);
    const along = (ux - b.vx) * ax + (uy - b.vy) * ay;

    b.vx += ax * along * UMB_DRAG * b.umbrella * dt;
    b.vy += ay * along * UMB_DRAG * b.umbrella * dt;

    // point downwind, more so the stronger the wind; straight up when calm
    const strength = Math.min(1, Math.hypot(ux, uy) / UMB_FULL_WIND);
    const downwind = Math.max(-1.6, Math.min(1.6, Math.atan2(ux, -uy)));

    b.umbAngV +=
      ((downwind * strength - b.umbAngle) * UMB_SWING - b.umbAngV * UMB_DAMP) *
      dt;
  } else {
    b.umbAngV += (-b.umbAngle * UMB_SWING - b.umbAngV * UMB_DAMP) * dt;
  }
  b.umbAngle = Math.max(-1.6, Math.min(1.6, b.umbAngle + b.umbAngV * dt));
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // push out of any solid cell we overlap, closest point on the cell box
  for (let cy = Math.floor(b.y - RADIUS); cy <= Math.floor(b.y + RADIUS); cy++)
    for (
      let cx = Math.floor(b.x - RADIUS);
      cx <= Math.floor(b.x + RADIUS);
      cx++
    ) {
      if (!solidAt(cx, cy)) continue;
      const px = Math.min(Math.max(b.x, cx), cx + 1);
      const py = Math.min(Math.max(b.y, cy), cy + 1);
      let nx = b.x - px;
      let ny = b.y - py;
      const d = Math.hypot(nx, ny);

      if (d >= RADIUS) continue;
      if (d < 1e-6) {
        // centre inside the cell: push out the way we came
        nx = -b.vx;
        ny = -b.vy;
      }
      const len = Math.hypot(nx, ny) || 1;

      nx /= len;
      ny /= len;
      b.x += nx * (RADIUS - d);
      b.y += ny * (RADIUS - d);
      const vn = b.vx * nx + b.vy * ny;

      // a surface under the frog: it's standing
      if (ny < -0.5) b.ground = 0.15;
      if (vn < 0) {
        // hard hits squash it against the surface
        if (-vn > 1) {
          b.squashV -= -vn * JELLY_KICK * 10;
          b.squashAngle = Math.atan2(ny, nx);
        }
        // bounce the normal part, rub off some of the sliding part
        const tx = b.vx - vn * nx;
        const ty = b.vy - vn * ny;

        const keep = Math.exp(-FRICTION * dt);

        b.vx = tx * keep - vn * BOUNCE * nx;
        b.vy = ty * keep - vn * BOUNCE * ny;
      }
    }

  // grip only holds against light air, a real wind still pushes it off
  if (b.ground > 0) b.vx *= Math.exp(-GRIP * (1 - felt) * dt);
  b.ground -= dt;
  // face where the umbrella pulls when it's held out sideways
  if (b.umbrella > 0.5 && Math.abs(b.umbAngle) > 0.5)
    b.facing = b.umbAngle > 0 ? 1 : -1;
  else if (Math.abs(b.vx) > 0.8) b.facing = b.vx > 0 ? 1 : -1;
  b.squashV += (-JELLY_K * b.squash - JELLY_DAMP * b.squashV) * dt;
  b.squash = Math.max(-0.45, Math.min(0.45, b.squash + b.squashV * dt));

  // the top edge is a ceiling, the sides are open, the bottom is the pond
  if (b.y < RADIUS) {
    b.y = RADIUS;
    b.vy = Math.abs(b.vy) * BOUNCE;
  }

  return b.x > -1 && b.x < COLS + 1 && b.y < WATER_Y + 0.4;
}

// Side-on frog drawn from shapes so it can pose: tucked legs when sitting,
// legs streaming back when flying, splayed when dropping. Lit from above.
export function drawBody(
  ctx: CanvasRenderingContext2D,
  b: Body,
  cell: number,
  glow: number,
  time = 0,
) {
  const R = RADIUS * cell;
  const speed = Math.hypot(b.vx, b.vy);
  const sitting = b.ground > 0 || b.hold > 0;
  // 0 = tucked, 1 = fully stretched out behind
  // umbrella overhead: legs dangle; held out in front: legs stream behind
  const sail = b.umbrella > 0.5 ? Math.min(1, Math.abs(b.umbAngle) / 1.2) : 0;
  const stretch = sitting
    ? 0
    : b.umbrella > 0.5
      ? sail
      : Math.min(1, speed / 8);
  const falling = !sitting && (b.umbrella > 0.5 ? sail < 0.4 : b.vy > 2);

  // squash/stretch the whole frog, keeping roughly the same area
  const deform = (angle: number, amount: number) => {
    ctx.rotate(angle);
    ctx.scale(1 + amount, 1 - amount * 0.8);
    ctx.rotate(-angle);
  };
  const bob = b.hold > 0 ? Math.sin(b.hold * 10) * 0.08 * cell : 0;

  ctx.save();
  ctx.translate(b.x * cell, b.y * cell + bob);
  deform(b.squashAngle, b.squash);
  if (speed > 0.5) deform(Math.atan2(b.vy, b.vx), Math.min(speed * 0.012, 0.2));
  // nose follows the direction of travel a bit in the air
  const tilt =
    sitting || b.umbrella > 0.5
      ? Math.abs(b.umbAngle) * 0.35 * b.umbrella
      : sitting
        ? 0
        : Math.max(
            -0.6,
            Math.min(0.6, Math.atan2(b.vy, Math.abs(b.vx) + 2) * 0.6),
          );

  ctx.scale(b.facing, 1);
  ctx.rotate(tilt);

  if (glow > 0) {
    ctx.shadowColor = `rgba(255,190,220,${glow * 0.8})`;
    ctx.shadowBlur = cell * glow;
  }

  const skinDark = "#2d6b33";
  const skin = "#5cb54f";
  const skinLight = "#9fdc78";

  // --- back leg (behind the body) ---
  ctx.strokeStyle = skinDark;
  ctx.fillStyle = skinDark;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = R * 0.32;
  const hipX = -R * 0.45;
  const hipY = R * 0.25;

  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  if (falling) {
    // splayed down and out
    ctx.lineTo(hipX - R * 0.35, hipY + R * 0.55);
    ctx.lineTo(hipX - R * 0.1, hipY + R * 0.95);
  } else {
    // knee swings from tucked forward to straight back
    const kx = hipX + R * (0.35 - stretch * 0.9);
    const ky = hipY + R * (0.4 - stretch * 0.25);
    const fx = hipX + R * (-0.05 - stretch * 1.15);
    const fy = hipY + R * (0.55 - stretch * 0.35);

    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
  }
  ctx.stroke();

  // --- body: rounded, lit from the top ---
  const g = ctx.createRadialGradient(
    -R * 0.1,
    -R * 0.45,
    R * 0.1,
    0,
    0,
    R * 1.15,
  );

  g.addColorStop(0, skinLight);
  g.addColorStop(0.55, skin);
  g.addColorStop(1, skinDark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, R * 0.05, R * 0.95, R * 0.7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // pale belly
  ctx.fillStyle = "rgba(230,240,190,0.85)";
  ctx.beginPath();
  ctx.ellipse(R * 0.15, R * 0.42, R * 0.55, R * 0.25, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // spots
  ctx.fillStyle = "rgba(30,80,35,0.5)";
  for (const [sx, sy, sr] of [
    [-0.35, -0.3, 0.12],
    [-0.05, -0.45, 0.09],
    [-0.6, 0.0, 0.08],
  ])
    ctx.beginPath(),
      ctx.arc(sx * R, sy * R, sr * R, 0, Math.PI * 2),
      ctx.fill();

  // --- front leg ---
  ctx.strokeStyle = skin;
  ctx.lineWidth = R * 0.2;
  ctx.beginPath();
  ctx.moveTo(R * 0.45, R * 0.35);
  if (sitting) ctx.lineTo(R * 0.55, R * 0.72);
  else ctx.lineTo(R * (0.6 + stretch * 0.35), R * (0.6 - stretch * 0.3));
  ctx.stroke();

  // --- eye on a bump at the front ---
  const ex = R * 0.5;
  const ey = -R * 0.5;

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(ex, ey + R * 0.08, R * 0.32, 0, Math.PI * 2);
  ctx.fill();
  // blink every few seconds
  const blink = (time + b.x * 0.37) % 3.7 < 0.12;

  if (blink) {
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = R * 0.07;
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.18, ey);
    ctx.lineTo(ex + R * 0.18, ey);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#f4f1d8";
    ctx.beginPath();
    ctx.arc(ex, ey, R * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(
      ex + R * 0.05,
      ey + R * 0.02,
      R * 0.09,
      R * 0.13,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(ex - R * 0.04, ey - R * 0.07, R * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // smile
  ctx.strokeStyle = "rgba(20,50,25,0.7)";
  ctx.lineWidth = Math.max(1, R * 0.05);
  ctx.beginPath();
  ctx.arc(R * 0.55, R * 0.05, R * 0.3, 0.2, 1.1);
  ctx.stroke();

  ctx.restore();
}

// umbrella above the frog: drawn in world space, before or after the frog
export function drawUmbrella(
  ctx: CanvasRenderingContext2D,
  b: Body,
  cell: number,
) {
  if (b.umbrella < 0.02) return;
  const open = b.umbrella;
  const [tx, ty] = canopyAt(b);
  const ax = Math.sin(b.umbAngle);
  const ay = -Math.cos(b.umbAngle);
  const hand = [b.x + ax * 0.45, b.y + ay * 0.45];

  ctx.save();
  ctx.lineCap = "round";

  // arm from the frog's shoulder up to the handle
  ctx.strokeStyle = "#5cb54f";
  ctx.lineWidth = cell * 0.13;
  ctx.beginPath();
  ctx.moveTo((b.x + b.facing * 0.25) * cell, (b.y - 0.1) * cell);
  ctx.lineTo(hand[0] * cell, hand[1] * cell);
  ctx.stroke();

  // shaft with a little J hook at the bottom
  ctx.strokeStyle = "#3a2a1c";
  ctx.lineWidth = Math.max(1.5, cell * 0.06);
  ctx.beginPath();
  ctx.moveTo(hand[0] * cell, hand[1] * cell);
  ctx.lineTo(tx * cell, ty * cell);
  ctx.stroke();

  // canopy
  ctx.translate(tx * cell, ty * cell);
  ctx.rotate(b.umbAngle);
  const W = cell * (0.3 + 1.05 * open);
  const H = cell * (0.95 - 0.3 * open);
  const ribs = 6;

  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = cell * 0.3;
  for (let i = 0; i < ribs; i++) {
    const a0 = Math.PI + (i / ribs) * Math.PI;
    const a1 = Math.PI + ((i + 1) / ribs) * Math.PI;
    const x0 = Math.cos(a0) * W;
    const x1 = Math.cos(a1) * W;

    ctx.fillStyle = i % 2 ? "#f1a4b0" : "#e46a7c";
    ctx.beginPath();
    ctx.moveTo(0, -H);
    ctx.lineTo(x0, Math.sin(a0) * H * 0.25);
    // scalloped edge between two ribs
    ctx.quadraticCurveTo(
      (x0 + x1) / 2,
      Math.sin((a0 + a1) / 2) * H * 0.25 - cell * 0.12 * open,
      x1,
      Math.sin(a1) * H * 0.25,
    );
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // top highlight + tip
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.ellipse(-W * 0.3, -H * 0.55, W * 0.25, H * 0.15, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a2a1c";
  ctx.beginPath();
  ctx.moveTo(0, -H);
  ctx.lineTo(0, -H - cell * 0.18);
  ctx.stroke();
  ctx.restore();
}
