import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bestStreak, dailyDate, dailyLabel, dailyStreak, midday, monthCells } from '../daily';
import { MAX_STARS, totalStars, useStars } from '../stars';
import { themedStyles } from '../theme';
import { Header } from './Header';
import { Stars } from './Stars';

const SIDE = 16;
const GAP = 6;
const BORDER = 2;
const DAY_FONT = 15;
const LINE_HEIGHT = 1.2;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type Props = { today: number; onBack: () => void };

export function DailyHistory({ today, onBack }: Props) {
  const styles = useStyles();
  const solved = useStars('daily');
  const { width } = useWindowDimensions();
  const cell = (Math.min(width, 480) - SIDE * 2 - GAP * 6) / 7;
  const starSize = Math.min(10, cell / 5);
  const maxTextScale = Math.max(1, (cell - BORDER * 2) / (LINE_HEIGHT * (DAY_FONT + starSize)));

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const now = dailyDate(today);
  const months = (date: Date) => date.getFullYear() * 12 + date.getMonth();
  const first = Math.min(months(now), ...Object.keys(solved).map((key) => months(dailyDate(Number(key)))));
  const [shown, setShown] = useState(months(now));
  const year = Math.floor(shown / 12);
  const month = shown % 12;
  const monthName = midday(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const cells = monthCells(year, month);
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => cells[week * 7 + day] ?? null),
  );

  const stats = [
    ['Streak', dailyStreak(solved, today)],
    ['Best streak', bestStreak(solved)],
    ['Days solved', Object.keys(solved).length],
    ['Stars', totalStars(solved)],
  ] as const;

  return (
    <SafeAreaView style={styles.root} accessibilityViewIsModal>
      <Header title="History" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stats}>
          {stats.map(([label, value]) => (
            <View key={label} style={styles.stat} accessible accessibilityLabel={`${label}, ${value}`}>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.monthBar}>
          <Pressable
            onPress={() => setShown(shown - 1)}
            disabled={shown <= first}
            hitSlop={12}
            style={styles.arrow}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: shown <= first }}
          >
            <Text style={[styles.link, shown <= first && styles.faded]}>‹</Text>
          </Pressable>
          <Text style={styles.month} accessibilityRole="header">
            {monthName}
          </Text>
          <Pressable
            onPress={() => setShown(shown + 1)}
            disabled={shown >= months(now)}
            hitSlop={12}
            style={styles.arrow}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: shown >= months(now) }}
          >
            <Text style={[styles.link, shown >= months(now) && styles.faded]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.calendar}>
          <View style={styles.week}>
            {WEEKDAYS.map((day, i) => (
              <Text key={i} style={styles.weekday} importantForAccessibility="no">
                {day}
              </Text>
            ))}
          </View>
          {weeks.map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((key, d) => {
                if (key === null) return <View key={`blank${d}`} style={styles.day} />;
                const stars = solved[key] ?? 0;
                let label = dailyLabel(key);
                if (key > today) label += ', upcoming';
                else label += stars ? `, ${stars} of ${MAX_STARS} stars` : ', not solved';
                return (
                  <View key={key} style={styles.day}>
                    <View
                      style={[styles.cell, key === today && styles.today, key > today && styles.faded]}
                      accessible
                      accessibilityLabel={label}
                    >
                      <Text style={styles.dayNumber} maxFontSizeMultiplier={maxTextScale}>
                        {key % 100}
                      </Text>
                      {stars > 0 && <Stars count={stars} size={starSize} maxFontSizeMultiplier={maxTextScale} />}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = themedStyles((colors) =>
  StyleSheet.create({
    root: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg },
    link: { fontSize: 17, fontWeight: '600', color: colors.accent },
    arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: SIDE, paddingTop: 12, paddingBottom: SIDE, gap: 20, alignSelf: 'center', maxWidth: 480, width: '100%' },
    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, backgroundColor: colors.card, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 2 },
    statValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
    statLabel: { fontSize: 12, color: colors.muted, textAlign: 'center' },
    monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
    month: { fontSize: 18, fontWeight: '700', color: colors.ink },
    faded: { opacity: 0.35 },
    calendar: { gap: GAP },
    week: { flexDirection: 'row', gap: GAP },
    weekday: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: colors.muted },
    day: { flex: 1 },
    cell: {
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: BORDER,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    today: { borderColor: colors.accent },
    dayNumber: { fontSize: DAY_FONT, fontWeight: '700', color: colors.ink },
  }),
);
