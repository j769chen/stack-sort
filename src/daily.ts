import { type LevelStars, MAX_STARS } from './stars';

export function dailyKey(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export const midday = (year: number, month: number, day: number) => new Date(year, month, day, 12);

export function dailyDate(key: number): Date {
  return midday(Math.floor(key / 10000), (Math.floor(key / 100) % 100) - 1, key % 100);
}

function addDays(key: number, days: number): number {
  const date = dailyDate(key);
  date.setDate(date.getDate() + days);
  return dailyKey(date);
}

export const previousDay = (key: number) => addDays(key, -1);
const nextDay = (key: number) => addDays(key, 1);

export function dailyStreak(solved: LevelStars, today: number): number {
  let day = today in solved ? today : previousDay(today);
  let streak = 0;
  for (; day in solved; day = previousDay(day)) streak++;
  return streak;
}

export function bestStreak(solved: LevelStars): number {
  let best = 0;
  for (const start of Object.keys(solved).map(Number)) {
    if (previousDay(start) in solved) continue;
    let run = 0;
    for (let day = start; day in solved; day = nextDay(day)) run++;
    best = Math.max(best, run);
  }
  return best;
}

export function monthCells(year: number, month: number): (number | null)[] {
  const lead = (midday(year, month, 1).getDay() + 6) % 7;
  const days = midday(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => dailyKey(midday(year, month, i + 1))),
  ];
}

export function dailyLabel(key: number): string {
  return dailyDate(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

type Result = { key: number; moves: number; optimal: number; stars: number; streak: number };

export function shareText({ key, moves, optimal, stars, streak }: Result): string {
  const lines = [
    `Stack Puzzles Daily · ${dailyLabel(key)}`,
    `${'★'.repeat(stars)}${'☆'.repeat(MAX_STARS - stars)} ${moves}/${optimal} moves`,
  ];
  if (streak > 1) lines.push(`${streak}-day streak`);
  return lines.join('\n');
}
