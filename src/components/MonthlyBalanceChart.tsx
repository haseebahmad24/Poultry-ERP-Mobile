import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/theme';

type Entry = { date: string; balance: number };

function computeMonthlyBalances(entries: Entry[]): Array<{ monthLabel: string; balance: number; isCurrent: boolean }> {
  const sorted = [...entries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const endStr = endOfMonth.toISOString().slice(0, 10);
    const before = sorted.filter((e) => e.date && e.date <= endStr);
    const balance = Math.max(0, before[before.length - 1]?.balance ?? 0);
    const monthLabel = d.toLocaleString('default', { month: 'short' });
    const isCurrent = i === 5;
    return { monthLabel, balance, isCurrent };
  });
}

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 100_000) return `${Math.round(v / 1_000)}K`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

type Props = { entries: Entry[] };

export default function MonthlyBalanceChart({ entries }: Props) {
  const months = computeMonthlyBalances(entries);
  const maxBalance = Math.max(...months.map((m) => m.balance), 1);
  const hasData = months.some((m) => m.balance > 0);
  if (!hasData) return null;

  return (
    <View style={styles.container}>
      {months.map((m, idx) => {
        const heightPct = m.balance / maxBalance;
        const barHeight = Math.max(4, Math.round(heightPct * 44));
        return (
          <View key={`${m.monthLabel}-${idx}`} style={styles.col}>
            <Text style={[styles.valueLabel, m.isCurrent && styles.valueLabelActive]}>
              {m.balance > 0 ? fmtShort(m.balance) : ''}
            </Text>
            <View style={styles.barWrap}>
              <View
                style={[
                  styles.bar,
                  { height: barHeight },
                  m.isCurrent && styles.barActive,
                ]}
              />
            </View>
            <Text style={[styles.monthLabel, m.isCurrent && styles.monthLabelActive]}>
              {m.monthLabel}
            </Text>
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
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  barWrap: {
    height: 44,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 18,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  barActive: {
    backgroundColor: Colors.text,
  },
  valueLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  valueLabelActive: {
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  monthLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  monthLabelActive: {
    color: Colors.text,
    fontWeight: '700',
  },
});
