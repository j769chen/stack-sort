import { useState } from 'react';
import { GameShell, type Progress, confirmDiscard } from '../../components/GameShell';
import { LevelSelect } from '../../components/LevelSelect';
import { LoadingScreen } from '../../components/LoadingScreen';
import { WithOverlay } from '../../components/WithOverlay';
import { RodButtons } from '../../components/RodButtons';
import { useStars } from '../../stars';
import { useProgress } from '../useProgress';
import { useRodGame } from '../useRodGame';
import {
  HANOI_MAX_LEVEL,
  type HanoiState,
  canMoveDisk,
  createHanoi,
  disksForLevel,
  isHanoiSolved,
  minMoves,
} from './logic';
import { HanoiBoard } from './HanoiBoard';

const PEG_NAMES = ['left', 'middle', 'right'];

function pegLabel(state: HanoiState, peg: number) {
  const disks = state[peg]!;
  const contents = disks.length ? `disks ${disks.join(', ')} from the bottom` : 'empty';
  return `${PEG_NAMES[peg]} peg, ${contents}`;
}

export function HanoiScreen({ onBack }: { onBack: () => void }) {
  const stars = useStars('hanoi');
  const { level, unlocked, goTo, complete, loaded } = useProgress('hanoi', HANOI_MAX_LEVEL, stars);
  const [picking, setPicking] = useState(false);
  const [round, setRound] = useState(0);
  const [progress, setProgress] = useState<Progress>('new');
  if (!loaded) return <LoadingScreen title="Tower Stack" onBack={onBack} />;
  const next = level >= HANOI_MAX_LEVEL ? 1 : level + 1;
  const levels = picking && (
    <LevelSelect
      title="Tower Stack"
      count={HANOI_MAX_LEVEL}
      unlocked={unlocked}
      current={level}
      stars={stars}
      onPick={(picked) =>
        confirmDiscard(progress, 'Leave', () => {
          goTo(picked);
          setRound((r) => r + 1);
          setPicking(false);
        })
      }
      onBack={() => setPicking(false)}
    />
  );
  return (
    <WithOverlay overlay={levels}>
      <HanoiGame
        key={`${level}.${round}`}
        level={level}
        onBack={onBack}
        onLevels={() => setPicking(true)}
        onNext={() => goTo(next)}
        onWin={() => complete(next)}
        onProgress={setProgress}
      />
    </WithOverlay>
  );
}

type GameProps = {
  level: number;
  onBack: () => void;
  onLevels: () => void;
  onNext: () => void;
  onWin: () => void;
  onProgress: (progress: Progress) => void;
};

function HanoiGame({ level, onBack, onLevels, onNext, onWin, onProgress }: GameProps) {
  const disks = disksForLevel(level);
  const game = useRodGame(() => createHanoi(disks), {
    canMove: canMoveDisk,
    isRodComplete: () => false,
    isSolved: (state) => isHanoiSolved(state, disks),
    pieceName: (disk) => `disk ${disk}`,
    placeName: (peg) => `the ${PEG_NAMES[peg]} peg`,
  });
  const state = game.rods;

  return (
    <GameShell
      {...game.controls}
      title="Tower Stack"
      label={`Level ${level}`}
      message={`Move all ${disks} disks to another peg`}
      onBack={onBack}
      onLevels={onLevels}
      scoring={{ game: 'hanoi', key: level, optimal: minMoves(disks) }}
      nextLabel={level >= HANOI_MAX_LEVEL ? 'Play again from level 1' : 'Next level'}
      onNext={onNext}
      onWin={onWin}
      onProgress={onProgress}
    >
      <HanoiBoard state={state} disks={disks} selected={game.selected} onPress={game.press} onDrop={game.drop} />
      <RodButtons
        labels={state.map((_, peg) => pegLabel(state, peg))}
        rowSizes={[state.length]}
        selected={game.selected}
        canMoveTo={game.canMoveTo}
        cantPick={game.cantPick}
        onPress={game.press}
      />
    </GameShell>
  );
}
