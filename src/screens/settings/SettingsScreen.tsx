import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import { getLowStockThreshold, setLowStockThreshold } from '@/utils/settings';
import { clearCache } from '@/utils/cache';

export default function SettingsScreen() {
  const [threshold, setThreshold] = useState('100');
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    getLowStockThreshold().then((v) => setThreshold(String(v)));
  }, []);

  const saveThreshold = useCallback(async () => {
    const n = parseInt(threshold, 10);
    if (isNaN(n) || n < 1) {
      Alert.alert('Invalid value', 'Please enter a positive number for the threshold.');
      return;
    }
    await setLowStockThreshold(n);
    setThresholdSaved(true);
    setTimeout(() => setThresholdSaved(false), 2000);
  }, [threshold]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear cached data',
      'This will remove all locally cached data. The app will re-fetch fresh data on next use.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearCache();
            setCacheCleared(true);
            setTimeout(() => setCacheCleared(false), 2000);
          },
        },
      ]
    );
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Inventory */}
        <Text style={styles.sectionLabel}>INVENTORY</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Low-stock threshold</Text>
              <Text style={styles.settingDesc}>
                Items with quantity below this number are flagged as low stock on the Inventory screen.
              </Text>
            </View>
          </View>
          <View style={styles.settingInputRow}>
            <TextInput
              style={styles.thresholdInput}
              value={threshold}
              onChangeText={(t) => {
                setThresholdSaved(false);
                setThreshold(t.replace(/[^0-9]/g, ''));
              }}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={saveThreshold}
            />
            <Text style={styles.thresholdUnit}>units</Text>
            <TouchableOpacity
              style={[styles.saveBtn, thresholdSaved && styles.saveBtnSuccess]}
              onPress={saveThreshold}
              activeOpacity={0.8}
            >
              {thresholdSaved ? (
                <Feather name="check" size={14} color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Data & Cache */}
        <Text style={styles.sectionLabel}>DATA &amp; CACHE</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={handleClearCache} activeOpacity={0.7}>
            <View style={styles.actionIconWrap}>
              <Feather name="trash-2" size={16} color={Colors.text} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>
                {cacheCleared ? 'Cache cleared' : 'Clear cached data'}
              </Text>
              <Text style={styles.actionDesc}>
                Removes all locally stored data. Useful when data looks stale.
              </Text>
            </View>
            {cacheCleared ? (
              <Feather name="check" size={16} color={Colors.textMuted} />
            ) : (
              <Feather name="chevron-right" size={16} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <View style={[styles.settingRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight }]}>
            <Text style={styles.settingTitle}>App</Text>
            <Text style={styles.settingValue}>Poultry ERP Mobile</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingTitle}>Version</Text>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: { ...Typography.h2 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.md, paddingHorizontal: Spacing.md },

  sectionLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  settingInfo: { flex: 1 },
  settingTitle: { ...Typography.h4 },
  settingDesc: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  settingValue: { ...Typography.bodySmall, color: Colors.textSecondary },

  settingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  thresholdInput: {
    width: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    backgroundColor: Colors.background,
    textAlign: 'center',
  },
  thresholdUnit: { ...Typography.bodySmall, color: Colors.textSecondary },
  saveBtn: {
    marginLeft: 'auto',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    backgroundColor: Colors.text,
    borderRadius: Radius.sm,
    minWidth: 56,
    alignItems: 'center',
  },
  saveBtnSuccess: { backgroundColor: Colors.textSecondary },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: { flex: 1 },
  actionTitle: { ...Typography.h4 },
  actionDesc: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
});
