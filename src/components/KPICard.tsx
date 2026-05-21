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
};

export default function KPICard({ label, value, subtext, valueColor, onPress }: Props) {
  const inner = (
    <>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {onPress && <Feather name="chevron-right" size={11} color={Colors.textMuted} />}
      </View>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
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
  subtext: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
});
