import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors, Spacing, Typography } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  meta?: string;
  action?: React.ReactNode;
};

export default function SectionHeader({ title, subtitle, meta, action }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.right}>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          {action ?? null}
        </View>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { ...Typography.h4 },
  subtitle: { ...Typography.bodySmall, marginTop: 2 },
  meta: { ...Typography.bodySmall },
});
