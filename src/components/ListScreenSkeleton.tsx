import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/theme';
import SkeletonBox from './SkeletonBox';
import SkeletonListItem from './SkeletonListItem';

type Props = {
  count?: number;
  showTabs?: boolean;
  showSearch?: boolean;
  showMeta?: boolean;
  showBadge?: boolean;
};

/**
 * Inline skeleton — mounts inside a screen that already renders its own header.
 * The screen wraps this in its SafeAreaView / header, then renders this for the body.
 */
export default function ListScreenSkeleton({
  count = 6,
  showTabs = true,
  showSearch = true,
  showMeta = true,
  showBadge = true,
}: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
    >
      {showSearch && (
        <SkeletonBox height={40} radius={8} style={styles.search} />
      )}
      {showTabs && (
        <View style={styles.tabRow}>
          {[...Array(3)].map((_, i) => (
            <SkeletonBox key={i} width={72} height={30} radius={6} />
          ))}
        </View>
      )}
      {[...Array(count)].map((_, i) => (
        <SkeletonListItem key={i} showMeta={showMeta} showBadge={showBadge} />
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
  search: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
});
