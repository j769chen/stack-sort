import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, renderAsync, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Alert } from 'react-native';
import { feedback } from '../../feedback';
import { getStars, loadStars } from '../../stars';
import { HanoiScreen } from './HanoiScreen';
import * as logic from './logic';
import { type MockBoardProps, answerAlert, drag, move, rod, rodText } from '../mockBoard';

const { HANOI_MAX_LEVEL, minMoves } = logic;

let mockScreenReader = false;
jest.mock('../../useScreenReader', () => ({ useScreenReader: () => mockScreenReader }));

type MockHanoiBoardProps = Omit<MockBoardProps, 'rods'> & { state: number[][] };

jest.mock('./HanoiBoard', () => {
  const { MockBoard } = jest.requireActual<typeof import('../mockBoard')>('../mockBoard');
  return { HanoiBoard: ({ state, ...props }: MockHanoiBoardProps) => <MockBoard rods={state} {...props} /> };
});

async function start(level?: number) {
  if (level) await AsyncStorage.setItem('hanoi.level', String(level));
  await renderAsync(<HanoiScreen onBack={jest.fn()} />);
  await screen.findByText(`Level ${level ?? 1}`);
}

describe('dragging', () => {
  it('moves the disk when it is dropped on a legal peg', async () => {
    await start();
    await drag(0, 2);
    expect(rodText(2)).toBe('1');
    expect(screen.getByText('Moves 1/7')).toBeOnTheScreen();
  });

  it('puts the disk back when it is dropped on a peg it cannot go on', async () => {
    await start();
    await move(0, 2);
    await drag(0, 2);
    expect(rodText(0)).toBe('3,2');
    expect(rodText(2)).toBe('1');
    expect(screen.getByText('Moves 1/7')).toBeOnTheScreen();
  });
});

const SOLVE_THREE: [number, number][] = [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2]];

async function play(moves: [number, number][]) {
  for (const [from, to] of moves) await move(from, to);
  await act(() => jest.advanceTimersByTime(650));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await loadStars();
});
afterEach(() => jest.restoreAllMocks());

describe('HanoiScreen', () => {
  it('shows a loading screen with a working Back while saved progress loads', async () => {
    let finishRead: (value: string | null) => void = () => {};
    jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise((resolve) => (finishRead = resolve)));
    const onBack = jest.fn();
    await renderAsync(<HanoiScreen onBack={onBack} />);
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Tower Stack' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    await act(async () => finishRead('2'));
    expect(await screen.findByText('Level 2')).toBeOnTheScreen();
  });

  it('starts level 1 with three disks on the left peg', async () => {
    await start();
    expect(rodText(0)).toBe('3,2,1');
    expect(screen.getByText('Move all 3 disks to another peg')).toBeOnTheScreen();
  });

  it('selects, moves and counts', async () => {
    await start();
    await fireEvent.press(rod(0));
    expect(rodText(0)).toBe('*3,2,1');
    await fireEvent.press(rod(2));
    expect(rodText(2)).toBe('1');
    expect(screen.getByText('Moves 1/7')).toBeOnTheScreen();
  });

  it('deselects on a second tap and ignores empty pegs', async () => {
    await start();
    await fireEvent.press(rod(1));
    expect(rodText(1)).toBe('');
    await fireEvent.press(rod(0));
    await fireEvent.press(rod(0));
    expect(rodText(0)).toBe('3,2,1');
  });

  it('switches selection on an illegal move', async () => {
    await start();
    await move(0, 2);
    await move(0, 2);
    expect(rodText(2)).toBe('*1');
    expect(screen.getByText('Moves 1/7')).toBeOnTheScreen();
  });

  it('undoes, and restarts once confirmed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await start();
    await move(0, 2);
    await move(0, 1);
    await fireEvent.press(screen.getByText('Undo'));
    expect(rodText(1)).toBe('');
    expect(screen.getByText('Moves 1/7')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Restart'));
    expect(screen.getByText('Moves 1/7')).toBeOnTheScreen();
    await answerAlert('Restart');
    expect(rodText(0)).toBe('3,2,1');
    expect(screen.getByText('Moves 0/7')).toBeOnTheScreen();
  });

  it('gives feedback when picking up and dropping a disk', async () => {
    const pick = jest.spyOn(feedback, 'pick');
    const drop = jest.spyOn(feedback, 'drop');
    await start();
    await fireEvent.press(rod(1));
    expect(pick).not.toHaveBeenCalled();
    await move(0, 2);
    expect(pick).toHaveBeenCalledTimes(1);
    expect(drop).toHaveBeenCalledTimes(1);
  });

  describe('with a screen reader', () => {
    beforeEach(() => (mockScreenReader = true));
    afterEach(() => (mockScreenReader = false));

    it('describes each peg and plays through the peg buttons', async () => {
      await start();
      const left = await screen.findByRole('button', { name: 'left peg, disks 3, 2, 1 from the bottom' });
      expect(screen.getByRole('button', { name: 'right peg, empty' })).toBeOnTheScreen();

      await fireEvent.press(left);
      expect(screen.getByRole('button', { name: /^left peg/ })).toBeSelected();
      await fireEvent.press(screen.getByRole('button', { name: 'right peg, empty' }));
      expect(screen.getByRole('button', { name: 'right peg, disks 1 from the bottom' })).toBeOnTheScreen();
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Moved disk 1 to the right peg');
    });

    it('says there is nothing to pick up on an empty peg', async () => {
      await start();
      expect(screen.getByRole('button', { name: /^left peg/ }).props.accessibilityHint).toBe('Picks up the top');
      const empty = screen.getByRole('button', { name: 'middle peg, empty' });
      expect(empty.props.accessibilityHint).toBe('Nothing to pick up');
      await fireEvent.press(empty);
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith('Nothing to pick up');
      expect(screen.getByRole('button', { name: 'middle peg, empty' })).not.toBeSelected();
    });

    it('tells which pegs a picked-up disk cannot go on, and what tapping them does', async () => {
      await start();
      await move(0, 2);
      await fireEvent.press(rod(0));
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith('Picked up disk 2 from the left peg');
      expect(screen.getByRole('button', { name: 'right peg, disks 1 from the bottom' }).props.accessibilityHint).toBe(
        "Can't move here",
      );
      expect(screen.getByRole('button', { name: 'middle peg, empty' }).props.accessibilityHint).toBe('Moves here');
      await fireEvent.press(rod(2));
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith(
        "Can't move disk 2 to the right peg. Picked up disk 1 instead",
      );
      await fireEvent.press(rod(2));
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith('Put disk 1 back');
    });
  });

  describe('level select', () => {
    it('replays an earlier level without locking the later ones', async () => {
      await start(3);
      await fireEvent.press(screen.getByRole('button', { name: 'Levels' }));
      expect(screen.getByRole('button', { name: 'Level 3, not solved' })).toBeSelected();
      expect(screen.getByRole('button', { name: 'Level 4, locked' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Level 1, not solved' }));
      expect(await screen.findByText('Level 1')).toBeOnTheScreen();
      expect(rodText(0)).toBe('3,2,1');

      await fireEvent.press(screen.getByRole('button', { name: 'Levels' }));
      expect(screen.getByRole('button', { name: 'Level 3, not solved' })).toBeEnabled();
    });

    it('returns to the game in progress', async () => {
      await start();
      await move(0, 2);
      await fireEvent.press(screen.getByRole('button', { name: 'Levels' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      expect(screen.queryByRole('button', { name: /^Level 1,/ })).toBeNull();
      expect(screen.getByText('Moves 1/7')).toBeOnTheScreen();
    });

    it('asks before a picked level throws away moves, and starts it afresh', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      await start();
      await move(0, 2);
      await fireEvent.press(screen.getByRole('button', { name: 'Levels' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Level 1, not solved' }));
      expect(Alert.alert).toHaveBeenCalledWith('Leave this puzzle?', 'Your moves so far will be lost.', expect.any(Array), {
        cancelable: true,
      });
      expect(screen.getByRole('button', { name: 'Level 1, not solved' })).toBeOnTheScreen();
      await answerAlert('Leave');
      expect(screen.queryByRole('button', { name: /^Level 1,/ })).toBeNull();
      expect(screen.getByText('Moves 0/7')).toBeOnTheScreen();
      expect(rodText(0)).toBe('3,2,1');
    });
  });

  describe('winning', () => {
    beforeEach(() => jest.useFakeTimers());

    it('praises a perfect solve and saves the next level', async () => {
      await start();
      await play(SOLVE_THREE);
      expect(screen.getByText(`Perfect! ${minMoves(3)} moves, the minimum possible.`)).toBeOnTheScreen();
      expect(getStars('hanoi')).toEqual({ 1: 3 });
      await fireEvent.press(screen.getByText('Next level'));
      expect(await screen.findByText('Level 2')).toBeOnTheScreen();
      expect(await AsyncStorage.getItem('hanoi.level')).toBe('2');
    });

    it('saves the next level as soon as the level is won, even when leaving without Next', async () => {
      await start();
      await play(SOLVE_THREE);
      expect(await AsyncStorage.getItem('hanoi.level')).toBe('2');
      await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      await screen.unmountAsync();
      await renderAsync(<HanoiScreen onBack={jest.fn()} />);
      expect(await screen.findByText('Level 2')).toBeOnTheScreen();
    });

    it('ignores taps between the winning move and the win card', async () => {
      jest.spyOn(logic, 'disksForLevel').mockReturnValue(1);
      await start();
      await move(0, 2);
      await fireEvent.press(rod(2));
      expect(rodText(2)).toBe('1');
      expect(screen.getByText('Moves 1/1')).toBeOnTheScreen();
    });

    it('plays a won level again from the win card', async () => {
      await start();
      await play([[0, 1], [1, 2], ...SOLVE_THREE.slice(1)]);
      expect(screen.getByText(`8 moves. Solve it in ${minMoves(3)} for three stars.`)).toBeOnTheScreen();
      await fireEvent.press(screen.getByText('Play again'));
      expect(screen.queryByText('Solved!')).toBeNull();
      expect(screen.getByText('Moves 0/7')).toBeOnTheScreen();
      expect(rodText(0)).toBe('3,2,1');
      await play(SOLVE_THREE);
      expect(getStars('hanoi')).toEqual({ 1: 3 });
    });

    it('starts a won level afresh when it is picked again, without asking', async () => {
      const alert = jest.spyOn(Alert, 'alert');
      await start();
      await play(SOLVE_THREE);
      await fireEvent.press(screen.getByRole('button', { name: 'Levels' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Level 1, 3 of 3 stars' }));
      expect(alert).not.toHaveBeenCalled();
      await act(() => jest.advanceTimersByTime(650));
      expect(screen.queryByText('Solved!')).toBeNull();
      expect(screen.getByText('Moves 0/7')).toBeOnTheScreen();
      expect(rodText(0)).toBe('3,2,1');
    });

    it('reports extra moves', async () => {
      await start();
      await play([[0, 1], [1, 2], ...SOLVE_THREE.slice(1)]);
      expect(screen.getByText(`${minMoves(3) + 1} moves. Solve it in ${minMoves(3)} for three stars.`)).toBeOnTheScreen();
      expect(screen.getByLabelText('2 of 3 stars')).toBeOnTheScreen();
    });

    it('wraps to level 1 after the last level', async () => {
      jest.spyOn(logic, 'disksForLevel').mockReturnValue(1);
      await AsyncStorage.setItem('hanoi.level', String(HANOI_MAX_LEVEL));
      await renderAsync(<HanoiScreen onBack={jest.fn()} />);
      await act(() => jest.runAllTimersAsync());
      const drop = jest.spyOn(feedback, 'drop');
      const win = jest.spyOn(feedback, 'win');
      await move(0, 2);
      expect(drop).not.toHaveBeenCalled();
      expect(win).toHaveBeenCalledTimes(1);
      await act(() => jest.advanceTimersByTime(650));
      await fireEvent.press(screen.getByText('Play again from level 1'));
      await act(() => jest.runAllTimersAsync());
      expect(screen.getByText('Level 1')).toBeOnTheScreen();
    });
  });
});
