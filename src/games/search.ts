import type { Task } from './task';
import type { Move } from './useHistory';

export class MinHeap<T> {
  private items: T[] = [];

  constructor(private readonly before: (a: T, b: T) => boolean) {}

  get size() {
    return this.items.length;
  }

  push(value: T) {
    const items = this.items;
    items.push(value);
    for (let i = items.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (!this.before(items[i]!, items[parent]!)) break;
      [items[i], items[parent]] = [items[parent]!, items[i]!];
      i = parent;
    }
  }

  pop(): T {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length === 0) return top;
    items[0] = last;
    for (let i = 0; ; ) {
      const left = 2 * i + 1;
      const right = left + 1;
      let first = i;
      if (left < items.length && this.before(items[left]!, items[first]!)) first = left;
      if (right < items.length && this.before(items[right]!, items[first]!)) first = right;
      if (first === i) return top;
      [items[i], items[first]] = [items[first]!, items[i]!];
      i = first;
    }
  }
}

export type SearchRules = {
  capacity: number;
  shortest: boolean;
  isComplete: (rod: string) => boolean;
  canStack: (ring: number, onto: number) => boolean;
  staysOffEmpty?: (rod: string) => boolean;
  movesLeft: (rods: string[]) => number;
};

type SearchNode = {
  rods: string[];
  key: string;
  cost: number;
  estimatedLength: number;
  parent: SearchNode | null;
  move: Move | null;
};

const YIELD_EVERY = 64;

const byEstimate = (a: SearchNode, b: SearchNode) => a.estimatedLength < b.estimatedLength;

const byEstimateThenDepth = (a: SearchNode, b: SearchNode) =>
  a.estimatedLength !== b.estimatedLength ? a.estimatedLength < b.estimatedLength : a.cost > b.cost;

const stateKey = (rods: string[]) => rods.slice().sort().join('|');

export function* searchRods(start: number[][], rules: SearchRules, nodeLimit: number): Task<Move[] | null> {
  const { capacity, shortest, isComplete, canStack, staysOffEmpty, movesLeft } = rules;
  const startRods = start.map((rod) => String.fromCharCode(...rod));
  const startKey = stateKey(startRods);
  const bestCost = new Map([[startKey, 0]]);
  const open = new MinHeap<SearchNode>(shortest ? byEstimateThenDepth : byEstimate);
  open.push({ rods: startRods, key: startKey, cost: 0, estimatedLength: movesLeft(startRods), parent: null, move: null });

  for (let expanded = 0; open.size > 0 && expanded < nodeLimit; ) {
    const node = open.pop();
    if (bestCost.get(node.key)! < node.cost) continue;
    const { rods } = node;
    if (rods.every((rod) => rod.length === 0 || isComplete(rod))) {
      const path: Move[] = [];
      for (let n: SearchNode | null = node; n?.move; n = n.parent) path.unshift(n.move);
      return path;
    }
    expanded++;
    if (expanded % YIELD_EVERY === 0) yield;
    const cost = node.cost + 1;
    for (let f = 0; f < rods.length; f++) {
      const src = rods[f]!;
      if (src.length === 0 || isComplete(src)) continue;
      const ring = src.charCodeAt(src.length - 1);
      let usedEmpty = false;
      for (let t = 0; t < rods.length; t++) {
        const dst = rods[t]!;
        if (t === f || dst.length >= capacity) continue;
        if (dst.length === 0) {
          if (usedEmpty || staysOffEmpty?.(src)) continue;
          usedEmpty = true;
        } else if (!canStack(ring, dst.charCodeAt(dst.length - 1))) continue;
        const next = rods.slice();
        next[t] = dst + src[src.length - 1];
        next[f] = src.slice(0, -1);
        const key = stateKey(next);
        const known = bestCost.get(key);
        if (known !== undefined && (!shortest || known <= cost)) continue;
        bestCost.set(key, cost);
        open.push({ rods: next, key, cost, estimatedLength: cost + movesLeft(next), parent: node, move: [f, t] });
      }
    }
  }
  return null;
}
