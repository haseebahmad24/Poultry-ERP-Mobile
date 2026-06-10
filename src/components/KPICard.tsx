import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '@/theme';

type MiniChart = {
  prev: number;
  curr: number;
  prevLabel?: string;
  currLabel?: string;
};

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
  /** Optional 2-bar mini chart comparing prev vs current period. */
  miniChart?: MiniChart;
};

function MiniBarChart({ prev, curr, prevLabel = 'Last', currLabel = 'This' }: MiniChart & { prevLabel?: string; currLabel?: string }) {
  const max = Math.max(Math.abs(prev), Math.abs(curr), 1);
  const prevH = Math.max(3, Math.round((Math.abs(prev) / max) * 28));
  const currH = Math.max(3, Math.round((Math.abs(curr) / max) * 28));
  return (
    <View style={miniStyles.container}>
      <View style={miniStyles.col}>
        <View style={miniStyles.barWrap}>
          <View style={[miniStyles.bar, miniStyles.barPrev, { height: prevH }]} />
        </View>
        <Text style={miniStyles.barLabel}>{prevLabel}</Text>
      </View>
      <View style={miniStyles.col}>
        <View style={miniStyles.barWrap}>
          <View style={[miniStyles.bar, miniStyles.barCurr, { height: currH }]} />
        </View>
        <Text style={[miniStyles.barLabel, miniStyles.barLabelCurr]}>{currLabel}</Text>
      </View>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  col: { alignItems: 'center', gap: 2 },
  barWrap: { height: 28, justifyContent: 'flex-end' },
  bar: { width: 14, borderRadius: Radius.sm },
  barPrev: { backgroundColor: Colors.borderLight },
  barCurr: { backgroundColor: Colors.textSecondary },
  barLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '500' },
  barLabelCurr: { color: Colors.textSecondary, fontWeight: '700' },
});

export default function KPICard({
  label,
  value,
  subtext,
  valueColor,
  onPress,
  trendPct,
  trendInverted,
  miniChart,
}: Props) {
  let trendNode: React.ReactNode = null;
  if (trendPct != null && isFinite(trendPct)) {
    const up = trendPct >= 0;
    const color = trendPct === 0 ? Colors.textMuted : Colors.textSecondary;
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
      {miniChart && (
        <MiniBarChart {...miniChart} />
      )}
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
