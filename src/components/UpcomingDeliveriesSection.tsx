import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';
import { formatShortDate } from '@/utils/currency';
import type { PurchaseOrder } from '@/api/purchaseOrders';
import type { SalesOrder } from '@/api/salesOrders';

interface DeliveryEntry {
  type: 'po' | 'so';
  id: number;
  label: string;
  party: string;
  deliveryDate: string;
  urgency: 'overdue' | 'today' | 'urgent' | 'soon';
  daysLabel: string;
}

const URGENCY_COLORS = {
  overdue: '#dc2626',
  today: '#d97706',
  urgent: '#2563eb',
  soon: '#059669',
};

const URGENCY_BG: Record<string, string> = {
  overdue: '#fef2f2',
  today: '#fffbeb',
  urgent: '#eff6ff',
  soon: '#f0fdf4',
};

function computeUrgency(dateStr: string): { urgency: DeliveryEntry['urgency']; daysLabel: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { urgency: 'overdue', daysLabel: `${Math.abs(days)}d overdue` };
  if (days === 0) return { urgency: 'today', daysLabel: 'Due today' };
  if (days <= 3) return { urgency: 'urgent', daysLabel: `${days}d` };
  if (days <= 14) return { urgency: 'soon', daysLabel: `${days}d` };
  return null;
}

interface Props {
  pos: PurchaseOrder[];
  sos: SalesOrder[];
  onPressEntry: (type: 'po' | 'so', id: number) => void;
  onPressViewAll: () => void;
}

export default function UpcomingDeliveriesSection({ pos, sos, onPressEntry, onPressViewAll }: Props) {
  const entries: DeliveryEntry[] = [];

  for (const po of pos) {
    if (!po.delivery_date) continue;
    const u = computeUrgency(po.delivery_date.slice(0, 10));
    if (!u) continue;
    entries.push({
      type: 'po',
      id: po.id,
      label: po.po_number ?? `PO #${po.id}`,
      party: po.vendor ?? 'Vendor',
      deliveryDate: po.delivery_date.slice(0, 10),
      urgency: u.urgency,
      daysLabel: u.daysLabel,
    });
  }

  for (const so of sos) {
    if (!so.delivery_date) continue;
    const u = computeUrgency(so.delivery_date.slice(0, 10));
    if (!u) continue;
    entries.push({
      type: 'so',
      id: so.id,
      label: so.so_number ?? `SO #${so.id}`,
      party: so.customer ?? 'Customer',
      deliveryDate: so.delivery_date.slice(0, 10),
      urgency: u.urgency,
      daysLabel: u.daysLabel,
    });
  }

  if (entries.length === 0) return null;

  entries.sort((a, b) => {
    const urgencyOrder = { overdue: 0, today: 1, urgent: 2, soon: 3 };
    const od = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (od !== 0) return od;
    return a.deliveryDate.localeCompare(b.deliveryDate);
  });

  const visible = entries.slice(0, 5);

  return (
    <View style={styles.card}>
      {visible.map((entry, idx) => {
        const color = URGENCY_COLORS[entry.urgency];
        const bg = URGENCY_BG[entry.urgency];
        return (
          <TouchableOpacity
            key={`${entry.type}-${entry.id}`}
            style={[styles.row, idx < visible.length - 1 && styles.rowBorder]}
            onPress={() => onPressEntry(entry.type, entry.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.typeDot, { backgroundColor: entry.type === 'po' ? Colors.text : '#7c3aed' }]} />
            <View style={styles.info}>
              <Text style={styles.label} numberOfLines={1}>{entry.label}</Text>
              <Text style={styles.party} numberOfLines={1}>{entry.party}</Text>
            </View>
            <View style={[styles.urgencyChip, { backgroundColor: bg }]}>
              <Text style={[styles.urgencyText, { color }]}>{entry.daysLabel}</Text>
            </View>
            <Feather name="chevron-right" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={styles.footer} onPress={onPressViewAll} activeOpacity={0.7}>
        <Feather name="calendar" size={13} color={Colors.textSecondary} />
        <Text style={styles.footerText}>
          {entries.length > 5 ? `View all ${entries.length} deliveries` : 'View delivery calendar'}
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
    ...Shadow.card,
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
  typeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    flexShrink: 0,
  },
  info: { flex: 1 },
  label: { ...Typography.body, fontSize: 13, fontWeight: '600' },
  party: { ...Typography.bodySmall, color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  urgencyChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  urgencyText: { fontSize: 11, fontWeight: '600' },
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
