import { theme } from '../../theme';
import type { Rods } from '../hoops/logic';
import type { SortRules } from '../hoops/RodSortGame';
import { LevelSortScreen } from '../LevelSortScreen';
import { towerDeals } from './deals';
import { canStack, isTowerComplete, ringColor, ringSize, towerRules, towerSpec } from './logic';

function towerSortRules(sizes: number): SortRules {
  const colorName = (ring: number) => theme.ringNames[ringColor(ring, sizes)];
  const ringName = (ring: number) => `${colorName(ring)} ${ringSize(ring, sizes) + 1}`;
  return {
    capacity: sizes,
    sizes,
    goal: 'Sort each color onto its own rod. A ring only fits on a bigger one.',
    canPour: (rods, from, to) => canStack(rods, from, to, sizes),
    movesLeft: towerRules(sizes).movesLeft,
    isRodComplete: (rod) => isTowerComplete(rod, sizes),
    ringName,
    rodLabel: (rods: Rods, rod: number) => {
      const rings = rods[rod]!;
      let contents = 'empty';
      if (isTowerComplete(rings, sizes)) contents = `complete, ${colorName(rings[0]!)}`;
      else if (rings.length) contents = `${rings.map(ringName).join(', ')} from the bottom`;
      return `Rod ${rod + 1}, ${contents}`;
    },
  };
}

const levelRules = (level: number) => towerSortRules(towerSpec(level).sizes);
const asRods = (rods: Rods) => rods;

export function TowerSortScreen({ onBack }: { onBack: () => void }) {
  return (
    <LevelSortScreen game="towersort" title="Tower Sort" deals={towerDeals} rules={levelRules} start={asRods} onBack={onBack} />
  );
}
