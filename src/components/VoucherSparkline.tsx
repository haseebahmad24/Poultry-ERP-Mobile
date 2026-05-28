import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/theme';

type Day = { date: string; count: number };

type Props = {
  days: Day[];
};

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
}

export default function VoucherSparkline({ days }: Props) {
  const maxCount = Math.max(...days.map((d) => d.count), 1);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <View style={styles.container}>
      {days.map((day) => {
        const isToday = day.date === todayStr;
        const heightPct = day.count / maxCount;
        const barHeight = Math.max(4, Math.round(heightPct * 36));
        return (
          <View key={day.date} style={styles.col}>
            <View style={styles.barWrap}>
              <View
                style={[
                  styles.bar,
                  { height: barHeight },
                  isToday && styles.barToday,
                ]}
              />
            </View>
            <Text style={[styles.label, isToday && styles.labelToday]}>
              {shortDay(day.date)}
            </Text>
            {day.count > 0 && (
              <Text style={[styles.count, isToday && styles.countToday]}>
                {day.count}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  barWrap: {
    height: 36,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 16,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  barToday: {
    backgroundColor: Colors.text,
  },
  label: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  labelToday: {
    color: Colors.text,
    fontWeight: '700',
  },
  count: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  countToday: {
    color: Colors.text,
    fontWeight: '700',
  },
});
