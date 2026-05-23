import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';
import type { VoucherTypeStat } from '@/api/dashboard';

type Props = {
  stats: VoucherTypeStat[];
};

export default function VoucherActivityChart({ stats }: Props) {
  if (stats.length === 0) return null;

  const maxCount = Math.max(...stats.map((s) => s.count));
  // Show top 6 types max
  const visible = stats.slice(0, 6);

  return (
    <View style={styles.card}>
      {visible.map((s) => {
        const barPct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
        return (
          <View key={s.type} style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.typeLabel} numberOfLines={1}>{s.type}</Text>
            </View>
            <View style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${barPct}%` }]} />
              </View>
            </View>
            <View style={styles.valueCol}>
              <Text style={styles.countText}>{s.count}</Text>
              <Text style={styles.amountText} numberOfLines={1}>{formatCurrency(s.amount)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    gap: Spacing.sm,
  },
  labelCol: { width: 48 },
  typeLabel: { fontSize: 11, fontWeight: '700', color: Colors.text, letterSpacing: 0.4 },
  barCol: { flex: 1 },
  barTrack: {
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.text,
    borderRadius: Radius.full,
    minWidth: 4,
  },
  valueCol: { width: 80, alignItems: 'flex-end' },
  countText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  amountText: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
});
