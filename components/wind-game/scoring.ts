// Score for clearing a level: start at 1000, lose a bit for every piece still
// standing at the end, every edit along the way and every second it took.

const PER_PIECE = 15;
const PER_EDIT = 3;
const PER_SECOND = 4;
const BEST_KEY = "frogtech-wind-best";

export type Result = {
  score: number;
  stars: 1 | 2 | 3;
  pieces: number;
  edits: number;
  seconds: number;
};

export function scoreRun(pieces: number, edits: number, seconds: number) {
  const score = Math.max(
    0,
    Math.round(
      1000 - pieces * PER_PIECE - edits * PER_EDIT - seconds * PER_SECOND,
    ),
  );
  const stars: Result["stars"] = score >= 750 ? 3 : score >= 450 ? 2 : 1;

  return { score, stars, pieces, edits, seconds: Math.round(seconds) };
}

export function loadBest(): Record<number, Result> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
  } catch {
    return {};
  }
}

// returns the (possibly updated) best results
export function saveBest(level: number, r: Result) {
  const best = loadBest();

  if (!best[level] || r.score > best[level].score) {
    best[level] = r;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {}
  }

  return best;
}
