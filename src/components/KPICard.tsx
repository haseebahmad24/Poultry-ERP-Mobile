import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/theme';

type Props = {
  label: string;
  value: string;
  subtext?: string;
  valueColor?: string;
  onPress?: () => void;
  /** Percentage change vs prior period. null = no comparison data available. */
  trendPct?: number | null;
  /** When true, a positive trend is bad (e.g. Expenses going up). */
  trendInverted?: boolean;
};

export default function KPICard({ label, value, subtext, valueColor, onPress, trendPct, trendInverted }: Props) {
  let trendNode: React.ReactNode = null;
  if (trendPct != null && isFinite(trendPct)) {
    const up = trendPct >= 0;
    const good = trendInverted ? !up : up;
    const color = trendPct === 0 ? Colors.textMuted : good ? '#16a34a' : '#dc2626';
    const icon: any = up ? 'trending-up' : 'trending-down';
    const trendLabel = `${up ? '+' : ''}${trendPct.toFixed(1)}% vs last mo`;
    trendNode = (
      <View style={styles.trendRow}>
        <Feather name={icon} size={10} color={color} />
        <Text style={[styles.trendText, { color }]}>{trendLabel}</Text>
      </View>
    );
  }

  const inner = (
    <>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {onPress && <Feather name="chevron-right" size={11} color={Colors.textMuted} />}
      </View>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
      {trendNode}
      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.card}>{inner}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flex: 1,
    minWidth: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    marginBottom: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '500',
  },
  subtext: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
});
