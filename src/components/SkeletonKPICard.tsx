import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '@/theme';
import SkeletonBox from './SkeletonBox';

export default function SkeletonKPICard() {
  return (
    <View style={styles.card}>
      <SkeletonBox width={80} height={11} />
      <SkeletonBox width={100} height={22} style={styles.number} />
      <SkeletonBox width={60} height={10} style={styles.sub} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  number: {
    marginTop: 10,
  },
  sub: {
    marginTop: 8,
  },
});
