import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius } from '@/theme';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const MUTED_STATUSES = new Set(['closed', 'cancelled', 'inactive', 'rejected']);

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const key = status?.toLowerCase() ?? '';
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : '—';
  const isMuted = MUTED_STATUSES.has(key);
  return (
    <View style={[styles.badge, size === 'sm' && styles.sm, isMuted && styles.badgeMuted]}>
      <Text style={[styles.text, size === 'sm' && styles.textSm, isMuted && styles.textMuted]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  badgeMuted: { opacity: 0.5 },
  sm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  textSm: { fontSize: 11 },
  textMuted: { color: Colors.textSecondary },
});
