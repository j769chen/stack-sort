import { deadEndTask } from './deadEnd';
import { type Rods, canPour, generateLevel, hoopsRules, isHoopsSolved, levelSpec, pour } from './hoops/logic';
import { type Task, runTask } from './task';
import { canStack, generateTower, isTowerSolved, solveTower, towerRules, towerSpec } from './towersort/logic';
import type { Move } from './useHistory';

const ringSort = (cap: number) =>
  [
    (rods: Rods, from: number, to: number) => canPour(rods, from, to, cap),
    (rods: Rods) => isHoopsSolved(rods, cap),
    hoopsRules(cap).movesLeft,
  ] as const;

const towerSort = (sizes: number) =>
  [
    (rods: Rods, from: number, to: number) => canStack(rods, from, to, sizes),
    (rods: Rods) => isTowerSolved(rods, sizes),
    towerRules(sizes).movesLeft,
  ] as const;

const isDeadEnd = (...args: Parameters<typeof deadEndTask>) => runTask(deadEndTask(...args));

function check(task: Task<boolean>) {
  for (let steps = 0; ; steps++) {
    const step = task.next();
    if (step.done) return { dead: step.value, steps };
  }
}

function boardsAlong(start: Rods, solution: Move[]) {
  const boards = [start];
  for (const [from, to] of solution) boards.push(pour(boards.at(-1)!, from, to));
  return boards;
}

const LEVEL_50_DEAD_END = [
  [3, 4, 2, 4, 5, 5],
  [4, 9, 5, 8, 0, 6],
  [8, 8, 2, 5, 9, 6],
  [7, 3, 0, 1, 0],
  [3, 4, 7, 0, 7],
  [1, 9, 5, 2, 4, 0],
  [5, 1, 1, 1, 8, 3],
  [1, 4, 6, 6, 7, 6],
  [9, 0, 6, 3],
  [8, 2, 7, 7, 3, 8],
  [2, 2],
  [9, 9],
];

const LEVEL_91_DEAD_END = [
  [8, 0, 2, 2, 2, 2],
  [6, 0, 2, 4],
  [8, 7, 8, 3, 7, 7],
  [0, 5, 7, 8, 5, 5],
  [9, 3, 3, 2, 9, 7],
  [1, 5, 6, 5, 4, 4],
  [1, 0, 0, 4],
  [4, 1, 3, 7, 3, 3],
  [1, 1, 9, 9, 9, 9],
  [1, 5, 4, 8, 8],
  [6, 6, 6, 6],
  [0],
];

describe('deadEndTask', () => {
  it('finds a dead end with no legal move', () => {
    expect(isDeadEnd([[1, 0, 1, 0], [2, 0, 2, 0], [1, 2, 1, 2], [2]], ...ringSort(4))).toBe(true);
  });

  it('finds a dead end that still has legal moves', () => {
    const rods = [[1, 2], [2, 0, 0, 0], [2, 1, 0, 2], [1, 1]];
    expect(canPour(rods, 2, 0, 4)).toBe(true);
    expect(isDeadEnd(rods, ...ringSort(4))).toBe(true);
  });

  it('finds dead ends on 10-color boards that take thousands of positions to prove', () => {
    expect(isDeadEnd(LEVEL_50_DEAD_END, ...ringSort(6))).toBe(true);
    expect(isDeadEnd(LEVEL_91_DEAD_END, ...ringSort(6))).toBe(true);
  });

  it('is not a dead end when the puzzle can still be solved', () => {
    expect(isDeadEnd([[1, 2, 1], [2, 0, 0, 0], [2, 1, 0, 2], [1]], ...ringSort(4))).toBe(false);
    expect(isDeadEnd(generateLevel(10).rods, ...ringSort(levelSpec(10).capacity))).toBe(false);
  });

  it('is not a dead end once solved', () => {
    expect(isDeadEnd([[0, 0, 0, 0], [1, 1, 1, 1], []], ...ringSort(4))).toBe(false);
  });

  it('does not call a position a dead end when it runs out of room to prove it', () => {
    expect(isDeadEnd(LEVEL_50_DEAD_END, ...ringSort(6), 300)).toBe(false);
  });

  it('heads for a solution, so a board that can still be solved takes few positions to clear', () => {
    const { rods, solution } = generateLevel(100);
    const ringChecks = boardsAlong(rods, solution).map((board) => check(deadEndTask(board, ...ringSort(6))));
    expect(ringChecks.filter(({ dead, steps }) => dead || steps >= 1000)).toEqual([]);

    const { sizes } = towerSpec(30);
    const tower = generateTower(30);
    const towerChecks = boardsAlong(tower, solveTower(tower, sizes)!).map((board) => check(deadEndTask(board, ...towerSort(sizes))));
    expect(towerChecks.filter(({ dead, steps }) => dead || steps >= 1000)).toEqual([]);
  });

  it('pauses between positions so it can run in slices', () => {
    expect(deadEndTask(LEVEL_50_DEAD_END, ...ringSort(6)).next().done).toBe(false);
  });

  it('works with Tower Sort rules', () => {
    expect(isDeadEnd(generateTower(5), ...towerSort(towerSpec(5).sizes))).toBe(false);
    expect(isDeadEnd([[2, 1], [5, 4, 3], [8, 7, 6], [0], []], ...towerSort(3))).toBe(false);
  });
});
