import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/theme';
import SkeletonBox from './SkeletonBox';
import SkeletonListItem from './SkeletonListItem';

type Props = {
  /** How many summary tiles to show (default 4) */
  tileCount?: number;
  /** How many list items in body */
  listCount?: number;
  showList?: boolean;
};

function SummaryTile() {
  return (
    <View style={styles.tile}>
      <SkeletonBox width="50%" height={10} />
      <SkeletonBox width="75%" height={20} style={styles.tileNumber} />
    </View>
  );
}

export default function DetailSkeleton({ tileCount = 4, listCount = 5, showList = true }: Props) {
  const rows = Math.ceil(tileCount / 2);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
    >
      {/* Summary tiles */}
      {[...Array(rows)].map((_, rowIdx) => (
        <View key={rowIdx} style={[styles.tileRow, rowIdx > 0 && styles.tileRowGap]}>
          <SummaryTile />
          {rowIdx * 2 + 1 < tileCount && <SummaryTile />}
        </View>
      ))}

      {/* Section header placeholder */}
      <SkeletonBox width={100} height={12} style={styles.sectionLabel} />

      {/* List items */}
      {showList && [...Array(listCount)].map((_, i) => (
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
  tileRowGap: {
    marginTop: Spacing.sm,
  },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  tileNumber: {
    marginTop: 8,
  },
  sectionLabel: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
