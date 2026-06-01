import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';

export type WeekBucket = {
  label: string;
  sublabel: string;
  amount: number;
  count: number;
  isOverdue?: boolean;
};

type Props = {
  buckets: WeekBucket[];
  emptyLabel?: string;
};

export default function WeeklyScheduleCard({ buckets, emptyLabel = 'No upcoming payments' }: Props) {
  const nonEmpty = buckets.filter((b) => b.amount > 0);
  if (nonEmpty.length === 0) return null;

  const maxAmount = Math.max(...nonEmpty.map((b) => b.amount), 1);

  return (
    <View style={styles.container}>
      {nonEmpty.map((bucket, idx) => {
        const barWidth = Math.max(8, Math.round((bucket.amount / maxAmount) * 100));
        return (
          <View key={`${bucket.label}-${idx}`} style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={[styles.weekLabel, bucket.isOverdue && styles.weekLabelOverdue]}>
                {bucket.label}
              </Text>
              <Text style={styles.sublabel}>{bucket.sublabel}</Text>
            </View>
            <View style={styles.barArea}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { width: `${barWidth}%` },
                    bucket.isOverdue && styles.barOverdue,
                  ]}
                />
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.amount, bucket.isOverdue && styles.amountOverdue]}>
                {formatCurrency(bucket.amount)}
              </Text>
              {bucket.count > 0 && (
                <Text style={styles.countLabel}>{bucket.count} item{bucket.count !== 1 ? 's' : ''}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  rowLeft: {
    width: 72,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  weekLabelOverdue: {
    fontWeight: '800',
  },
  sublabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  barArea: {
    flex: 1,
  },
  barTrack: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.textSecondary,
  },
  barOverdue: {
    backgroundColor: Colors.text,
  },
  rowRight: {
    width: 80,
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  amountOverdue: {
    fontWeight: '800',
  },
  countLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
