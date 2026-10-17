import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { dailyLabel } from '../daily';
import { loadStars, recordStars } from '../stars';
import { DailyHistory } from './DailyHistory';

const TODAY = 20261016;

let mockWidth = 750;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 1334, scale: 2, fontScale: 1 }),
}));

afterEach(() => {
  mockWidth = 750;
});

type Node = { props: { style?: StyleProp<ViewStyle> } };

const columnOf = (key: number) => {
  let node = screen.getByLabelText(new RegExp(`^${dailyLabel(key)},`));
  while (StyleSheet.flatten(node.parent!.props.style)?.flexDirection !== 'row') node = node.parent!;
  return node;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await loadStars();
});

describe('DailyHistory', () => {
  it('sums up streaks, days solved and stars', async () => {
    recordStars('daily', 20260929, 3);
    recordStars('daily', 20260930, 3);
    recordStars('daily', 20261001, 3);
    recordStars('daily', 20261015, 2);
    recordStars('daily', 20261016, 1);
    await render(<DailyHistory today={TODAY} onBack={jest.fn()} />);
    expect(screen.getByLabelText('Streak, 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Best streak, 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Days solved, 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Stars, 12')).toBeOnTheScreen();
  });

  it("shows this month's days with their stars, today and upcoming days", async () => {
    recordStars('daily', 20261015, 2);
    await render(<DailyHistory today={TODAY} onBack={jest.fn()} />);
    const month = new Date(2026, 9, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    expect(screen.getByRole('header', { name: month })).toBeOnTheScreen();
    expect(screen.getByLabelText(`${dailyLabel(20261015)}, 2 of 3 stars`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${dailyLabel(20261014)}, not solved`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${dailyLabel(20261017)}, upcoming`)).toBeOnTheScreen();
  });

  it('puts every day of the month in its weekday column, in rows of seven', async () => {
    await render(<DailyHistory today={TODAY} onBack={jest.fn()} />);
    for (let day = 1; day <= 31; day++) {
      const column = columnOf(20261000 + day);
      const week = column.parent!;
      expect(week.children).toHaveLength(7);
      expect(week.children.indexOf(column)).toBe((new Date(2026, 9, day).getDay() + 6) % 7);
    }
  });

  it('sizes blank and day columns alike so partial weeks line up with full ones', async () => {
    await render(<DailyHistory today={20260930} onBack={jest.fn()} />);
    for (const key of [20260901, 20260930]) {
      const week = columnOf(key).parent!;
      expect(week.children.map((column: Node) => StyleSheet.flatten(column.props.style))).toEqual(Array(7).fill({ flex: 1 }));
    }
  });

  it.each([320, 390, 1024])('caps day text so a number and its stars stay inside the cell at %p points wide', async (width) => {
    mockWidth = width;
    recordStars('daily', 20261015, 2);
    await render(<DailyHistory today={TODAY} onBack={jest.fn()} />);
    const inside = (Math.min(width, 480) - 16 * 2 - 6 * 6) / 7 - 2 * 2;
    const number = screen.getByText('15');
    const stars = screen.getByLabelText('2 of 3 stars');
    const scale = number.props.maxFontSizeMultiplier;
    expect(stars.props.maxFontSizeMultiplier).toBe(scale);
    expect(scale).toBeGreaterThanOrEqual(1);
    const lines = StyleSheet.flatten(number.props.style).fontSize + StyleSheet.flatten(stars.props.style).fontSize;
    expect(1.2 * lines * scale).toBeLessThanOrEqual(inside + 1e-9);
  });

  it('pages back as far as the first solved month and no further than this one', async () => {
    recordStars('daily', 20260830, 1);
    await render(<DailyHistory today={TODAY} onBack={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByLabelText(`${dailyLabel(20260830)}, 1 of 3 stars`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByLabelText(`${dailyLabel(20260901)}, not solved`)).toBeOnTheScreen();
  });

  it('gives the month arrows full-size touch targets', async () => {
    await render(<DailyHistory today={TODAY} onBack={jest.fn()} />);
    for (const name of ['Previous month', 'Next month']) {
      const style = StyleSheet.flatten(screen.getByRole('button', { name }).props.style);
      expect(style).toMatchObject({ minWidth: 44, minHeight: 44 });
    }
  });

  it('closes on Back and on the hardware back button', async () => {
    const onBack = jest.fn();
    const add = jest.spyOn(BackHandler, 'addEventListener');
    await render(<DailyHistory today={TODAY} onBack={onBack} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    let handled: ReturnType<Parameters<typeof BackHandler.addEventListener>[1]>;
    await act(() => {
      handled = add.mock.calls[0]![1]({ type: 'hardwareBackPress', timeStamp: 0 });
    });
    expect(handled).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(2);
    add.mockRestore();
  });
});
