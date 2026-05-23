import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '@/theme';
import SkeletonBox from './SkeletonBox';

type Props = {
  /** Show an extra meta line (e.g. amount) */
  showMeta?: boolean;
  /** Show a status badge on the right */
  showBadge?: boolean;
};

export default function SkeletonListItem({ showMeta = true, showBadge = true }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <SkeletonBox width="55%" height={14} />
        <SkeletonBox width="75%" height={12} style={styles.rowGap} />
        {showMeta && <SkeletonBox width="40%" height={12} style={styles.rowGap} />}
      </View>
      {showBadge && (
        <View style={styles.right}>
          <SkeletonBox width={56} height={22} radius={Radius.full} />
          <SkeletonBox width={64} height={14} style={styles.rowGap} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    ...Shadow.card,
  },
  left: {
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
    width: 72,
  },
  rowGap: {
    marginTop: 8,
  },
});
