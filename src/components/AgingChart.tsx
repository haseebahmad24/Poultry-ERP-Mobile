import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { formatCurrency } from '@/utils/currency';

export interface AgingBucket {
  label: string;
  shortLabel: string;
  amount: number;
  fill: string;
}

interface Props {
  buckets: AgingBucket[];
  /** Height of the stacked bar in pixels (default 12) */
  barHeight?: number;
}

export default function AgingChart({ buckets, barHeight = 12 }: Props) {
  const total = buckets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <View style={styles.root}>
      {/* Stacked horizontal bar */}
      <View style={[styles.bar, { height: barHeight }]}>
        {total === 0 ? (
          <View style={[styles.segment, { flex: 1, backgroundColor: Colors.borderLight }]} />
        ) : (
          buckets
            .filter((b) => b.amount > 0)
            .map((b) => {
              const flex = b.amount / total;
              return (
                <View
                  key={b.label}
                  style={[styles.segment, { flex, backgroundColor: b.fill }]}
                />
              );
            })
        )}
      </View>

      {/* Legend grid — 2 columns */}
      <View style={styles.legend}>
        {buckets.map((b) => {
          const pct = total > 0 ? ((b.amount / total) * 100).toFixed(0) : '0';
          return (
            <View key={b.label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: b.fill }]} />
              <View style={styles.legendText}>
                <Text style={styles.legendLabel}>{b.shortLabel}</Text>
                <Text style={styles.legendAmount}>{formatCurrency(b.amount)}</Text>
                <Text style={styles.legendPct}>{pct}%</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.md },

  bar: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
  },
  segment: { height: '100%' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    // roughly half width to get 2-column on narrow phones, 3-column on wide
    minWidth: '30%',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    marginTop: 3,
  },
  legendText: { flex: 1 },
  legendLabel: { ...Typography.label, textTransform: 'uppercase', marginBottom: 1 },
  legendAmount: { fontSize: 12, fontWeight: '600', color: Colors.text },
  legendPct: { ...Typography.bodySmall, color: Colors.textMuted },
});
