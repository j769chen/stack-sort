import { dailyDate } from '../../daily';
import { type SearchRules, searchRods } from '../search';
import { type Task, firstFound, runTask } from '../task';
import type { Move } from '../useHistory';

export type Rods = number[][];

export const EMPTY_RODS = 2;
export const MAX_COLORS = 10;

const LEVELS_PER_COLOR = 3;
const TIERS = [
  { capacity: 4, firstColors: 3 },
  { capacity: 5, firstColors: 7 },
  { capacity: 6, firstColors: 7 },
];

export type LevelSpec = { colors: number; capacity: number };

export function levelSpec(level: number): LevelSpec {
  let tierStart = 1;
  for (const { capacity, firstColors } of TIERS) {
    const tierLevels = (MAX_COLORS - firstColors + 1) * LEVELS_PER_COLOR;
    if (level < tierStart + tierLevels) {
      return { capacity, colors: firstColors + Math.floor((level - tierStart) / LEVELS_PER_COLOR) };
    }
    tierStart += tierLevels;
  }
  return { capacity: TIERS[TIERS.length - 1]!.capacity, colors: MAX_COLORS };
}

export function topRun(rod: number[]): number {
  const top = rod.at(-1);
  let n = 0;
  for (let i = rod.length - 1; i >= 0 && rod[i] === top; i--) n++;
  return n;
}

function isUniform(rod: number[]): boolean {
  return rod.every((c) => c === rod[0]);
}

export function canPour(rods: Rods, from: number, to: number, cap: number): boolean {
  if (from === to) return false;
  const src = rods[from]!;
  const dst = rods[to]!;
  if (src.length === 0 || dst.length >= cap) return false;
  return dst.length === 0 || dst.at(-1) === src.at(-1);
}

export function pour(rods: Rods, from: number, to: number): Rods {
  const next = rods.map((r) => [...r]);
  next[to]!.push(next[from]!.pop()!);
  return next;
}

export function isRodComplete(rod: number[], cap: number): boolean {
  return rod.length === cap && isUniform(rod);
}

export function isHoopsSolved(rods: Rods, cap: number): boolean {
  return rods.every((r) => r.length === 0 || isRodComplete(r, cap));
}

const NODE_LIMIT = 200_000;
export const MAX_DEAL_ATTEMPTS = 50;

function bottomRun(rod: string): number {
  let run = 1;
  while (run < rod.length && rod.charCodeAt(run) === rod.charCodeAt(0)) run++;
  return run;
}

export function hoopsRules(cap: number): SearchRules {
  const runSums = new Array<number>(MAX_COLORS);
  const runMaxes = new Array<number>(MAX_COLORS);
  const uniform = (rod: string) => rod.length === 0 || bottomRun(rod) === rod.length;
  return {
    capacity: cap,
    shortest: true,
    isComplete: (rod) => rod.length === cap && uniform(rod),
    canStack: (ring, onto) => ring === onto,
    staysOffEmpty: uniform,
    movesLeft: (rods) => {
      runSums.fill(0);
      runMaxes.fill(0);
      let bound = 0;
      for (const rod of rods) {
        if (rod.length === 0) continue;
        const run = bottomRun(rod);
        const color = rod.charCodeAt(0);
        bound += rod.length - run;
        runSums[color]! += run;
        runMaxes[color] = Math.max(runMaxes[color]!, run);
      }
      for (let color = 0; color < MAX_COLORS; color++) bound += runSums[color]! - runMaxes[color]!;
      return bound;
    },
  };
}

function searchHoops(start: Rods, cap: number, nodeLimit: number): Task<Move[] | null> {
  return searchRods(start, hoopsRules(cap), nodeLimit);
}

export function solveHoops(start: Rods, cap: number, nodeLimit = NODE_LIMIT): Move[] | null {
  return runTask(searchHoops(start, cap, nodeLimit));
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Deal = { rods: Rods; solution: Move[] };

export type DailySpec = LevelSpec & { moves: [number, number] };

const DAILY_SPECS: DailySpec[] = [
  { colors: 9, capacity: 5, moves: [45, 50] },
  { colors: 5, capacity: 4, moves: [15, 18] },
  { colors: 6, capacity: 4, moves: [20, 23] },
  { colors: 7, capacity: 4, moves: [24, 27] },
  { colors: 8, capacity: 4, moves: [28, 31] },
  { colors: 7, capacity: 5, moves: [33, 37] },
  { colors: 8, capacity: 5, moves: [39, 43] },
];

export function dailySpec(key: number): DailySpec {
  return DAILY_SPECS[dailyDate(key).getDay()]!;
}

export function levelTask(level: number): Task<Deal> {
  return dealTask(levelSpec(level), level * 9973 + 17);
}

export function generateLevel(level: number): Deal {
  return runTask(levelTask(level));
}

export function dailyTask(key: number): Task<Deal> {
  const spec = dailySpec(key);
  const [min, max] = spec.moves;
  return dealTask(spec, key * 7919 + 1, (length) => length >= min && length <= max);
}

export function generateDaily(key: number): Deal {
  return runTask(dailyTask(key));
}

function dealTask({ colors, capacity: cap }: LevelSpec, seed: number, fits = (_length: number) => true): Task<Deal> {
  const rand = mulberry32(seed);
  return firstFound(function* () {
    const rings = Array.from({ length: colors * cap }, (_, i) => Math.floor(i / cap));
    for (let i = rings.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [rings[i], rings[j]] = [rings[j]!, rings[i]!];
    }
    const rods: Rods = Array.from({ length: colors }, (_, i) => rings.slice(i * cap, (i + 1) * cap));
    for (let i = 0; i < EMPTY_RODS; i++) rods.push([]);

    if (rods.some((r) => isRodComplete(r, cap))) return null;
    const solution = yield* searchHoops(rods, cap, NODE_LIMIT);
    return solution && fits(solution.length) ? { rods, solution } : null;
  }, MAX_DEAL_ATTEMPTS);
}
