import { useMemo } from 'react';
import { theme } from '../../theme';
import { LevelSortScreen } from '../LevelSortScreen';
import { levelDeals } from './deals';
import { type Deal, type Rods, canPour, hoopsRules, isRodComplete, levelSpec, topRun } from './logic';
import { RodSortGame, type ShellProps, type SortRules } from './RodSortGame';

const colorName = (color: number) => theme.ringNames[color]!;

function rodLabel(rods: Rods, rod: number, capacity: number) {
  const rings = rods[rod]!;
  let contents = 'empty';
  if (isRodComplete(rings, capacity)) contents = `complete, ${colorName(rings[0]!)}`;
  else if (rings.length) {
    const top = `${topRun(rings)} ${colorName(rings[rings.length - 1]!)}`;
    contents = `${rings.map(colorName).join(', ')} from the bottom, top ${top}`;
  }
  return `Rod ${rod + 1}, ${contents}`;
}

const levelRules = (level: number) => ringSortRules(levelSpec(level).capacity);
const dealRods = (deal: Deal) => deal.rods;

export function HoopScreen({ onBack }: { onBack: () => void }) {
  return (
    <LevelSortScreen game="hoops" title="Ring Sort" deals={levelDeals} rules={levelRules} start={dealRods} onBack={onBack} />
  );
}

function ringSortRules(capacity: number): SortRules {
  return {
    capacity,
    goal: 'Sort each color onto its own rod',
    canPour: (rods, from, to) => canPour(rods, from, to, capacity),
    movesLeft: hoopsRules(capacity).movesLeft,
    isRodComplete: (rod) => isRodComplete(rod, capacity),
    ringName: colorName,
    rodLabel: (rods, rod) => rodLabel(rods, rod, capacity),
  };
}

type GameProps = ShellProps & { deal: Deal; capacity: number };

export function RingSortGame({ deal, capacity, ...shell }: GameProps) {
  const rules = useMemo(() => ringSortRules(capacity), [capacity]);
  return <RodSortGame {...shell} start={deal.rods} rules={rules} />;
}
