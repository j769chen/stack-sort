import { EMPTY_RODS, MAX_DEAL_ATTEMPTS, type Rods, mulberry32 } from '../hoops/logic';
import { type SearchRules, searchRods } from '../search';
import { type Task, firstFound, runTask } from '../task';
import type { Move } from '../useHistory';

export type TowerSpec = { colors: number; sizes: number };

const TIERS = [
  { colors: 3, sizes: 3, levels: 4 },
  { colors: 4, sizes: 3, levels: 4 },
  { colors: 3, sizes: 4, levels: 4 },
  { colors: 4, sizes: 4, levels: 8 },
];
const LAST: TowerSpec = { colors: 5, sizes: 4 };

export function towerSpec(level: number): TowerSpec {
  let tierStart = 1;
  for (const { colors, sizes, levels } of TIERS) {
    if (level < tierStart + levels) return { colors, sizes };
    tierStart += levels;
  }
  return LAST;
}

export const ringColor = (ring: number, sizes: number) => Math.floor(ring / sizes);
export const ringSize = (ring: number, sizes: number) => ring % sizes;

export function canStack(rods: Rods, from: number, to: number, sizes: number): boolean {
  const ring = rods[from]!.at(-1);
  if (from === to || ring === undefined) return false;
  const under = rods[to]!.at(-1);
  return under === undefined || ringSize(under, sizes) > ringSize(ring, sizes);
}

function settled(rod: number[], sizes: number): number {
  let n = 0;
  while (n < rod.length && ringColor(rod[n]!, sizes) === ringColor(rod[0]!, sizes) && ringSize(rod[n]!, sizes) === sizes - 1 - n) n++;
  return n;
}

export function isTowerComplete(rod: number[], sizes: number): boolean {
  return rod.length === sizes && settled(rod, sizes) === sizes;
}

export function isTowerSolved(rods: Rods, sizes: number): boolean {
  return rods.every((rod) => rod.length === 0 || isTowerComplete(rod, sizes));
}

const NODE_LIMIT = 50_000;

export function towerRules(sizes: number): SearchRules {
  const size = (rod: string, i: number) => rod.charCodeAt(i) % sizes;
  const color = (rod: string, i: number) => Math.floor(rod.charCodeAt(i) / sizes);
  const settledCount = (rod: string) => {
    let n = 0;
    while (n < rod.length && color(rod, n) === color(rod, 0) && size(rod, n) === sizes - 1 - n) n++;
    return n;
  };
  return {
    capacity: sizes,
    shortest: false,
    isComplete: (rod) => rod.length === sizes && settledCount(rod) === sizes,
    canStack: (ring, onto) => onto % sizes > ring % sizes,
    movesLeft: (rods) => 3 * rods.reduce((sum, rod) => sum + rod.length - settledCount(rod), 0),
  };
}

function searchTower(start: Rods, sizes: number, nodeLimit: number): Task<Move[] | null> {
  return searchRods(start, towerRules(sizes), nodeLimit);
}

export function solveTower(start: Rods, sizes: number, nodeLimit = NODE_LIMIT): Move[] | null {
  return runTask(searchTower(start, sizes, nodeLimit));
}

function deal({ colors, sizes }: TowerSpec, rand: () => number): Rods {
  const rods: Rods = Array.from({ length: colors + EMPTY_RODS }, () => []);
  const bases = rods.map((_, i) => i);
  for (let i = bases.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bases[i], bases[j]] = [bases[j]!, bases[i]!];
  }
  for (let color = 0; color < colors; color++) rods[bases[color]!]!.push(color * sizes + sizes - 1);
  for (let size = sizes - 2; size >= 0; size--) {
    for (let color = 0; color < colors; color++) {
      const fits = bases.filter((rod) => rods[rod]!.length === 0 || ringSize(rods[rod]!.at(-1)!, sizes) > size);
      rods[fits[Math.floor(rand() * fits.length)]!]!.push(color * sizes + size);
    }
  }
  return rods;
}

export function towerTask(level: number): Task<Rods> {
  const spec = towerSpec(level);
  const rand = mulberry32(level * 7727 + 3);
  return firstFound(function* () {
    const rods = deal(spec, rand);
    if (rods.some((rod) => isTowerComplete(rod, spec.sizes))) return null;
    return (yield* searchTower(rods, spec.sizes, NODE_LIMIT)) ? rods : null;
  }, MAX_DEAL_ATTEMPTS);
}

export function generateTower(level: number): Rods {
  return runTask(towerTask(level));
}
