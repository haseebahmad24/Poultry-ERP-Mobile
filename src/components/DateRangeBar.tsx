import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/theme';

export interface DateRangeValue {
  from: string;
  to: string;
}

interface Props {
  /**
   * 'range' (default) = From + To. 'single' = As-of date only (uses `from`; `to` ignored).
   */
  mode?: 'range' | 'single';
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function weekStartISO() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function monthStartISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function lastMonthRange() {
  const d = new Date();
  d.setDate(0);
  const to = d.toISOString().slice(0, 10);
  d.setDate(1);
  return { from: d.toISOString().slice(0, 10), to };
}
function monthEndISO() {
  const d = new Date();
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

type PresetKey = 'today' | 'week' | 'month' | 'lastMonth' | 'custom';

const RANGE_PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
];

const SINGLE_PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'Month End' },
  { key: 'custom', label: 'Custom' },
];

function detectPreset(value: DateRangeValue, mode: 'range' | 'single'): PresetKey | null {
  const { from, to } = value;
  if (!from && !to) return null;
  const today = todayISO();
  if (mode === 'single') {
    if (from === today) return 'today';
    if (from === monthEndISO()) return 'month';
    return 'custom';
  }
  if (from === today && to === today) return 'today';
  if (from === weekStartISO() && to === today) return 'week';
  if (from === monthStartISO() && to === today) return 'month';
  const lm = lastMonthRange();
  if (from === lm.from && to === lm.to) return 'lastMonth';
  return 'custom';
}

export default function DateRangeBar({ mode = 'range', value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [fromInput, setFromInput] = useState(value.from);
  const [toInput, setToInput] = useState(value.to);

  const activePreset = detectPreset(value, mode);
  const hasValue = !!(value.from || value.to);
  const presets = mode === 'single' ? SINGLE_PRESETS : RANGE_PRESETS;

  const applyPreset = (key: PresetKey) => {
    if (key === 'custom') {
      setFromInput(value.from);
      setToInput(value.to);
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const today = todayISO();
    if (key === 'today') {
      onChange(mode === 'single' ? { from: today, to: '' } : { from: today, to: today });
    } else if (key === 'week') {
      onChange({ from: weekStartISO(), to: today });
    } else if (key === 'month') {
      onChange(mode === 'single' ? { from: monthEndISO(), to: '' } : { from: monthStartISO(), to: today });
    } else if (key === 'lastMonth') {
      onChange(lastMonthRange());
    }
  };

  const commitCustom = () => {
    const validFrom = DATE_RE.test(fromInput) ? fromInput : '';
    const validTo = mode === 'single' ? '' : DATE_RE.test(toInput) ? toInput : '';
    onChange({ from: validFrom, to: validTo });
  };

  const clearAll = () => {
    setShowCustom(false);
    setFromInput('');
    setToInput('');
    onChange({ from: '', to: '' });
  };

  const rangeLabel =
    mode === 'single'
      ? value.from
      : value.from && value.to
        ? `${value.from} → ${value.to}`
        : value.from || value.to;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {presets.map(({ key, label }) => {
          const isActive =
            key === 'custom'
              ? showCustom || activePreset === 'custom'
              : activePreset === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => applyPreset(key)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
        {hasValue && !showCustom && rangeLabel ? (
          <View style={styles.rangeSummary}>
            <Feather name="calendar" size={11} color={Colors.textMuted} />
            <Text style={styles.rangeSummaryText} numberOfLines={1}>{rangeLabel}</Text>
          </View>
        ) : null}
        {hasValue && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
            <Feather name="x" size={11} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {showCustom && (
        <View style={styles.customRow}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>{mode === 'single' ? 'AS OF' : 'FROM'}</Text>
            <TextInput
              style={styles.input}
              value={fromInput}
              onChangeText={setFromInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              onSubmitEditing={commitCustom}
              onBlur={commitCustom}
            />
          </View>
          {mode === 'range' && (
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>TO</Text>
              <TextInput
                style={styles.input}
                value={toInput}
                onChangeText={setToInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                onSubmitEditing={commitCustom}
                onBlur={commitCustom}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  chipRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  chipText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },
  rangeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  rangeSummaryText: { fontSize: 11, color: Colors.textMuted, maxWidth: 160 },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  inputWrap: { flex: 1, gap: 2 },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
});
