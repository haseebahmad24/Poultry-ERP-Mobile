import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius } from '@/theme';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open:     { bg: '#e3f2fd', fg: '#1565c0' },
  approved: { bg: '#e8f5e9', fg: '#2e7d32' },
  closed:   { bg: '#f5f5f5', fg: '#616161' },
  pending:  { bg: '#fff3e0', fg: '#e65100' },
  draft:    { bg: '#f3e5f5', fg: '#6a1b9a' },
  active:   { bg: '#e8f5e9', fg: '#2e7d32' },
  inactive: { bg: '#f5f5f5', fg: '#9e9e9e' },
  received: { bg: '#e8f5e9', fg: '#2e7d32' },
  partial:  { bg: '#fff3e0', fg: '#e65100' },
  rejected: { bg: '#fce4ec', fg: '#c62828' },
  cancelled:{ bg: '#f5f5f5', fg: '#9e9e9e' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const key = status?.toLowerCase() ?? '';
  const colors = STATUS_COLORS[key] ?? { bg: Colors.primaryBg, fg: Colors.primary };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : '—';
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, size === 'sm' && styles.sm]}>
      <Text style={[styles.text, { color: colors.fg }, size === 'sm' && styles.textSm]}>
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
  },
  sm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 11,
  },
});
