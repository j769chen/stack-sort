import { type Rods, pour } from './hoops/logic';
import { MinHeap } from './search';
import type { Task } from './task';

type Pending = { key: string; estimate: number; order: number };

const stateKey = (rods: Rods) => rods.map((rod) => String.fromCharCode(...rod)).sort().join('|');

const fromKey = (key: string) => key.split('|').map((rod) => Array.from(rod, (ring) => ring.charCodeAt(0)));

const byEstimateThenNewest = (a: Pending, b: Pending) =>
  a.estimate !== b.estimate ? a.estimate < b.estimate : a.order > b.order;

export function* deadEndTask(
  start: Rods,
  canPour: (rods: Rods, from: number, to: number) => boolean,
  isSolved: (rods: Rods) => boolean,
  movesLeft: (rods: string[]) => number,
  limit = 20_000,
): Task<boolean> {
  const seen = new Set<string>();
  const pending = new MinHeap(byEstimateThenNewest);
  const add = (key: string) => {
    seen.add(key);
    pending.push({ key, estimate: movesLeft(key.split('|')), order: seen.size });
  };
  add(stateKey(start));
  while (pending.size > 0) {
    const rods = fromKey(pending.pop().key);
    if (isSolved(rods)) return false;
    for (let from = 0; from < rods.length; from++) {
      for (let to = 0; to < rods.length; to++) {
        if (!canPour(rods, from, to)) continue;
        const key = stateKey(pour(rods, from, to));
        if (seen.has(key)) continue;
        if (seen.size >= limit) return false;
        add(key);
      }
    }
    yield;
  }
  return true;
}
