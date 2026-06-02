import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors, Spacing, Typography } from '@/theme';

type Props = {
  title: string;
  meta?: string;
  action?: React.ReactNode;
};

export default function SectionHeader({ title, meta, action }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right}>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {action ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { ...Typography.h4 },
  meta: { ...Typography.bodySmall },
});
