import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Typography } from '@/theme';

interface Props {
  visible: boolean;
  message?: string;
}

export default function OfflineBanner({ visible, message }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>📵</Text>
      <Text style={styles.text}>{message ?? 'Showing cached data — pull to refresh'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.warningBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '40',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  icon: { fontSize: 13 },
  text: { ...Typography.bodySmall, color: Colors.warning, fontWeight: '600', flex: 1 },
});
