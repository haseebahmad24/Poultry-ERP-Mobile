import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { formatCurrency, formatShortDate } from '@/utils/currency';
import type { APBill } from '@/api/accountsPayable';
import type { ARInvoice } from '@/api/accountsReceivable';

interface PaymentEntry {
  kind: 'bill' | 'invoice';
  id: number;
  ref: string;
  party: string;
  dueDate: string;
  amount: number;
  daysLeft: number;
}

function daysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / 86_400_000);
}

interface Props {
  bills: APBill[];
  invoices: ARInvoice[];
  dueSoonDays: number;
  onPressBills: () => void;
  onPressInvoices: () => void;
  onPressViewAll: () => void;
}

export default function DueSoonPaymentsSection({
  bills,
  invoices,
  dueSoonDays,
  onPressBills,
  onPressInvoices,
  onPressViewAll,
}: Props) {
  const entries: PaymentEntry[] = [];

  for (const b of bills) {
    if (!b.due_date) continue;
    const d = daysUntilDue(b.due_date);
    if (d < 0 || d > dueSoonDays) continue;
    entries.push({
      kind: 'bill',
      id: b.id,
      ref: b.bill_number ?? `Bill #${b.id}`,
      party: b.vendor ?? '—',
      dueDate: b.due_date,
      amount: b.outstanding ?? b.amount ?? 0,
      daysLeft: d,
    });
  }

  for (const inv of invoices) {
    if (!inv.due_date) continue;
    const d = daysUntilDue(inv.due_date);
    if (d < 0 || d > dueSoonDays) continue;
    entries.push({
      kind: 'invoice',
      id: inv.id,
      ref: inv.invoice_number ?? `Inv #${inv.id}`,
      party: inv.customer ?? '—',
      dueDate: inv.due_date,
      amount: inv.outstanding ?? inv.amount ?? 0,
      daysLeft: d,
    });
  }

  if (entries.length === 0) return null;

  entries.sort((a, b) => a.daysLeft - b.daysLeft);

  const visible = entries.slice(0, 5);

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderLabel}>
          {`${entries.length} payment${entries.length !== 1 ? 's' : ''} due in ${dueSoonDays}d`}
        </Text>
        <Text style={styles.cardHeaderAmount}>{formatCurrency(totalAmount)}</Text>
      </View>
      {visible.map((entry, idx) => {
        const isBill = entry.kind === 'bill';
        return (
          <TouchableOpacity
            key={`${entry.kind}-${entry.id}`}
            style={[styles.row, idx < visible.length - 1 && styles.rowBorder]}
            onPress={isBill ? onPressBills : onPressInvoices}
            activeOpacity={0.7}
          >
            <View style={[styles.kindDot, { backgroundColor: isBill ? Colors.text : Colors.textSecondary }]} />
            <View style={styles.info}>
              <Text style={styles.ref} numberOfLines={1}>{entry.ref}</Text>
              <Text style={styles.party} numberOfLines={1}>{entry.party} · {formatShortDate(entry.dueDate)}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.amount}>{formatCurrency(entry.amount)}</Text>
              <View style={[styles.daysChip, entry.daysLeft === 0 && styles.daysChipToday]}>
                <Text style={styles.daysChipText}>
                  {entry.daysLeft === 0 ? 'due today' : `${entry.daysLeft}d left`}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={styles.footer} onPress={onPressViewAll} activeOpacity={0.7}>
        <Feather name="trending-up" size={13} color={Colors.textSecondary} />
        <Text style={styles.footerText}>
          {entries.length > 5 ? `View all ${entries.length} upcoming payments` : 'View cash flow'}
        </Text>
        <Feather name="chevron-right" size={13} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surfaceHover,
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  cardHeaderAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  kindDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.full,
    flexShrink: 0,
  },
  info: { flex: 1 },
  ref: { ...Typography.body, fontSize: 13, fontWeight: '600' },
  party: { ...Typography.bodySmall, color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 12, fontWeight: '600', color: Colors.text },
  daysChip: {
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  daysChipToday: {
    borderStyle: 'solid',
  },
  daysChipText: { fontSize: 10, fontWeight: '600', color: Colors.text },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  footerText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, fontWeight: '500' },
});
