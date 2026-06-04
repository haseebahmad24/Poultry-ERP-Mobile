import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/theme';

interface Props {
  options: string[];
  selected: number;
  onChange: (index: number) => void;
}

export default function SegmentedControl({ options, selected, onChange }: Props) {
  return (
    <View style={styles.container}>
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt}
          style={[styles.tab, i === selected && styles.tabActive]}
          onPress={() => onChange(i)}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, i === selected && styles.labelActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.md,
    padding: 3,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabActive: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  labelActive: {
    color: Colors.text,
    fontWeight: '600',
  },
});
