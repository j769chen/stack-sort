import { bestStreak, dailyDate, dailyKey, dailyLabel, dailyStreak, midday, monthCells, previousDay, shareText } from './daily';

describe('daily keys', () => {
  it('keys each local calendar day', () => {
    expect(dailyKey(new Date(2026, 9, 16, 23, 59))).toBe(20261016);
    expect(dailyKey(new Date(2026, 9, 17, 0, 1))).toBe(20261017);
    expect(dailyDate(20261016)).toEqual(new Date(2026, 9, 16, 12));
  });

  it('builds dates at midday, clear of a clock change at midnight', () => {
    for (const key of [20260405, 20260906, 20261101, 20270101]) expect(dailyDate(key).getHours()).toBe(12);
    expect(midday(2026, 8, 6)).toEqual(new Date(2026, 8, 6, 12));
  });

  it('steps back a day across month and year ends', () => {
    expect(previousDay(20261016)).toBe(20261015);
    expect(previousDay(20261101)).toBe(20261031);
    expect(previousDay(20270101)).toBe(20261231);
    expect(previousDay(20280301)).toBe(20280229);
  });

  it('steps back exactly one calendar day across daylight-saving changes', () => {
    expect(previousDay(20260309)).toBe(20260308);
    expect(previousDay(20261102)).toBe(20261101);
    expect(previousDay(20260330)).toBe(20260329);
    expect(previousDay(20261026)).toBe(20261025);
    expect(previousDay(20260406)).toBe(20260405);
    expect(previousDay(20260928)).toBe(20260927);
  });
});

describe('dailyStreak', () => {
  it('counts consecutive solved days ending today', () => {
    expect(dailyStreak({ 20261014: 1, 20261015: 3, 20261016: 2 }, 20261016)).toBe(3);
  });

  it("keeps yesterday's streak alive until today is played", () => {
    expect(dailyStreak({ 20261014: 1, 20261015: 3 }, 20261016)).toBe(2);
  });

  it('breaks on a missed day and runs across month ends', () => {
    expect(dailyStreak({ 20261028: 3, 20261030: 3, 20261031: 1, 20261101: 2 }, 20261101)).toBe(3);
    expect(dailyStreak({ 20261014: 3 }, 20261016)).toBe(0);
    expect(dailyStreak({}, 20261016)).toBe(0);
  });
});

describe('bestStreak', () => {
  it('finds the longest run of solved days, across month ends', () => {
    expect(bestStreak({ 20261029: 1, 20261030: 2, 20261031: 3, 20261101: 3, 20261105: 1, 20261106: 1 })).toBe(4);
    expect(bestStreak({ 20261016: 2 })).toBe(1);
    expect(bestStreak({})).toBe(0);
  });
});

describe('streaks across daylight-saving changes', () => {
  it.each([
    ['US spring forward', [20260307, 20260308, 20260309]],
    ['US fall back', [20261031, 20261101, 20261102]],
    ['EU spring forward', [20260328, 20260329, 20260330]],
    ['NZ spring forward', [20260926, 20260927, 20260928]],
  ])('keeps a streak going through the %s', (_, days) => {
    const solved = Object.fromEntries(days.map((day) => [day, 3]));
    expect(dailyStreak(solved, days[2]!)).toBe(3);
    expect(bestStreak(solved)).toBe(3);
  });
});

describe('monthCells', () => {
  it('lays out a month from Monday, with blanks before the first day', () => {
    const october = monthCells(2026, 9);
    expect(october.slice(0, 4)).toEqual([null, null, null, 20261001]);
    expect(october.filter((key) => key !== null)).toHaveLength(31);
    expect(october.at(-1)).toBe(20261031);
    expect(monthCells(2028, 1).filter((key) => key !== null)).toHaveLength(29);
  });
});

describe('shareText', () => {
  it('shares the date, stars, moves and streak', () => {
    expect(shareText({ key: 20261016, moves: 38, optimal: 36, stars: 2, streak: 4 })).toBe(
      `Stack Puzzles Daily · ${dailyLabel(20261016)}\n★★☆ 38/36 moves\n4-day streak`,
    );
  });

  it('leaves out a streak of one day', () => {
    expect(shareText({ key: 20261016, moves: 36, optimal: 36, stars: 3, streak: 1 })).toBe(
      `Stack Puzzles Daily · ${dailyLabel(20261016)}\n★★★ 36/36 moves`,
    );
  });
});
