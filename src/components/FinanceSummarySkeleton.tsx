import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '@/theme';
import SkeletonBox from './SkeletonBox';
import SkeletonListItem from './SkeletonListItem';

function SummaryTileSkeleton() {
  return (
    <View style={styles.tile}>
      <SkeletonBox width="60%" height={10} />
      <SkeletonBox width="80%" height={20} style={{ marginTop: 8 }} />
    </View>
  );
}

export default function FinanceSummarySkeleton() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
    >
      {/* Summary tiles */}
      <View style={styles.tileRow}>
        <SummaryTileSkeleton />
        <SummaryTileSkeleton />
      </View>
      <View style={[styles.tileRow, { marginTop: Spacing.sm }]}>
        <SummaryTileSkeleton />
        <SummaryTileSkeleton />
      </View>

      {/* Aging bar */}
      <SkeletonBox height={60} radius={Radius.md} style={styles.agingBar} />

      {/* Tab bar */}
      <View style={styles.tabRow}>
        {[...Array(3)].map((_, i) => (
          <SkeletonBox key={i} width={72} height={30} radius={6} />
        ))}
      </View>

      {/* List items */}
      {[...Array(5)].map((_, i) => (
        <SkeletonListItem key={i} showMeta showBadge />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  tileRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  agingBar: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
});
