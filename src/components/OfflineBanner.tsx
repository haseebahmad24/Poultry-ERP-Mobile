import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '@/theme';

interface Props {
  visible: boolean;
  message?: string;
}

export default function OfflineBanner({ visible, message }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Feather name="wifi-off" size={13} color={Colors.textSecondary} />
      <Text style={styles.text}>{message ?? 'Showing cached data — pull to refresh'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceHover,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  text: { ...Typography.bodySmall, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
});
