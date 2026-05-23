import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, Radius, Shadow, Spacing } from '@/theme';
import SkeletonBox from './SkeletonBox';
import SkeletonKPICard from './SkeletonKPICard';
import SkeletonListItem from './SkeletonListItem';

function QuickActionSkeleton() {
  return (
    <View style={styles.quickTile}>
      <SkeletonBox width={28} height={28} radius={Radius.md} />
      <SkeletonBox width={48} height={10} style={styles.tileLabel} />
    </View>
  );
}

export default function DashboardSkeleton() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Top bar placeholder */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <SkeletonBox width={140} height={16} />
          <SkeletonBox width={180} height={12} style={styles.topBarSub} />
        </View>
        <View style={styles.topBarRight}>
          <SkeletonBox width={32} height={32} radius={Radius.full} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollEnabled={false}
      >
        {/* KPI row 1 */}
        <View style={styles.kpiRow}>
          <SkeletonKPICard />
          <View style={styles.kpiGap} />
          <SkeletonKPICard />
        </View>

        {/* KPI row 2 */}
        <View style={[styles.kpiRow, { marginTop: Spacing.sm }]}>
          <SkeletonKPICard />
          <View style={styles.kpiGap} />
          <SkeletonKPICard />
        </View>

        {/* Section label */}
        <SkeletonBox width={120} height={12} style={styles.sectionLabel} />

        {/* Quick actions grid */}
        <View style={styles.quickGrid}>
          {[...Array(6)].map((_, i) => <QuickActionSkeleton key={i} />)}
        </View>

        {/* Section label */}
        <SkeletonBox width={100} height={12} style={styles.sectionLabel} />

        {/* Voucher list */}
        {[...Array(4)].map((_, i) => (
          <SkeletonListItem key={i} showMeta showBadge />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topBarLeft: {
    flex: 1,
  },
  topBarSub: {
    marginTop: 6,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
  },
  kpiGap: {
    width: Spacing.sm,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickTile: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    width: '30.5%',
    alignItems: 'center',
    gap: 8,
    ...Shadow.card,
  },
  tileLabel: {
    marginTop: 0,
  },
  sectionLabel: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
