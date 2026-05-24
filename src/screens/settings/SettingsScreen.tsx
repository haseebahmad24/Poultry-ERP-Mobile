import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import BackButton from '@/components/BackButton';
import {
  getLowStockThreshold,
  setLowStockThreshold,
  getAutoRefreshInterval,
  setAutoRefreshInterval,
  getSessionTimeout,
  setSessionTimeout,
  getBiometricEnabled,
  setBiometricEnabled,
  getNotificationHour,
  setNotificationHour,
  getNotifyApOverdue,
  setNotifyApOverdue,
  getNotifyArOverdue,
  setNotifyArOverdue,
  getNotifyLowStock,
  setNotifyLowStock,
} from '@/utils/settings';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
  requestNotificationPermissions,
  cancelOverdueReminder,
} from '@/utils/notifications';
import { clearCache } from '@/utils/cache';

const REFRESH_OPTIONS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '1 min', value: 1 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '30 min', value: 30 },
];

const NOTIFICATION_HOUR_OPTIONS: { label: string; value: number }[] = [
  { label: '6 AM', value: 6 },
  { label: '7 AM', value: 7 },
  { label: '8 AM', value: 8 },
  { label: '9 AM', value: 9 },
  { label: '10 AM', value: 10 },
  { label: '12 PM', value: 12 },
  { label: '5 PM', value: 17 },
  { label: '6 PM', value: 18 },
];

const TIMEOUT_OPTIONS: { label: string; value: number }[] = [
  { label: 'Off', value: 0 },
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
];

export default function SettingsScreen() {
  const [threshold, setThreshold] = useState('100');
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [sessionTimeout, setSessionTimeoutState] = useState(0);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [notificationHour, setNotificationHourState] = useState(9);
  const [notifyAP, setNotifyAPState] = useState(true);
  const [notifyAR, setNotifyARState] = useState(true);
  const [notifyStock, setNotifyStockState] = useState(true);

  useEffect(() => {
    getLowStockThreshold().then((v) => setThreshold(String(v)));
    getAutoRefreshInterval().then((v) => setRefreshInterval(v));
    getSessionTimeout().then((v) => setSessionTimeoutState(v));
    getBiometricEnabled().then((v) => setBiometricEnabledState(v));
    getNotificationsEnabled().then((v) => setNotificationsEnabledState(v));
    getNotificationHour().then((v) => setNotificationHourState(v));
    getNotifyApOverdue().then((v) => setNotifyAPState(v));
    getNotifyArOverdue().then((v) => setNotifyARState(v));
    getNotifyLowStock().then((v) => setNotifyStockState(v));
    LocalAuthentication.hasHardwareAsync().then((has) => {
      if (has) LocalAuthentication.isEnrolledAsync().then((enrolled) => setBiometricAvailable(enrolled));
    });
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

  const handleRefreshIntervalChange = useCallback(async (minutes: number) => {
    setRefreshInterval(minutes);
    await setAutoRefreshInterval(minutes);
  }, []);

  const handleSessionTimeoutChange = useCallback(async (minutes: number) => {
    setSessionTimeoutState(minutes);
    await setSessionTimeout(minutes);
  }, []);

  const handleBiometricToggle = useCallback(async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable biometric lock',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (!result.success) return;
    }
    setBiometricEnabledState(value);
    await setBiometricEnabled(value);
  }, []);

  const handleNotificationsToggle = useCallback(async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Permission denied',
          'Please enable notifications for Poultry ERP in your device Settings to use this feature.'
        );
        return;
      }
    } else {
      await cancelOverdueReminder();
    }
    setNotificationsEnabledState(value);
    await setNotificationsEnabled(value);
  }, []);

  const handleNotificationHourChange = useCallback(async (hour: number) => {
    setNotificationHourState(hour);
    await setNotificationHour(hour);
  }, []);

  const handleNotifyAPToggle = useCallback(async (value: boolean) => {
    setNotifyAPState(value);
    await setNotifyApOverdue(value);
  }, []);

  const handleNotifyARToggle = useCallback(async (value: boolean) => {
    setNotifyARState(value);
    await setNotifyArOverdue(value);
  }, []);

  const handleNotifyStockToggle = useCallback(async (value: boolean) => {
    setNotifyStockState(value);
    await setNotifyLowStock(value);
  }, []);

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

        {/* Dashboard */}
        <Text style={styles.sectionLabel}>DASHBOARD</Text>
        <View style={styles.card}>
          <View style={[styles.settingRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight }]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Auto-refresh interval</Text>
              <Text style={styles.settingDesc}>
                Dashboard KPIs and vouchers refresh automatically at this interval.
              </Text>
            </View>
          </View>
          <View style={styles.refreshOptionsRow}>
            {REFRESH_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.refreshChip, refreshInterval === opt.value && styles.refreshChipActive]}
                onPress={() => handleRefreshIntervalChange(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.refreshChipText, refreshInterval === opt.value && styles.refreshChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Security */}
        <Text style={styles.sectionLabel}>SECURITY</Text>
        <View style={styles.card}>
          <View style={[styles.settingRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight }]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Session timeout</Text>
              <Text style={styles.settingDesc}>
                Automatically sign out after the app is in the background for this long.
              </Text>
            </View>
          </View>
          <View style={styles.refreshOptionsRow}>
            {TIMEOUT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.refreshChip, sessionTimeout === opt.value && styles.refreshChipActive]}
                onPress={() => handleSessionTimeoutChange(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.refreshChipText, sessionTimeout === opt.value && styles.refreshChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {biometricAvailable && (
            <View style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderLight }]}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Biometric lock</Text>
                <Text style={styles.settingDesc}>
                  Require fingerprint or Face ID when resuming the app from background.
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: Colors.border, true: Colors.text }}
                thumbColor={Colors.surface}
              />
            </View>
          )}
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={[styles.settingRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight }]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Overdue reminders</Text>
              <Text style={styles.settingDesc}>
                Daily notification when there are overdue bills, invoices, or low-stock items.
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: Colors.border, true: Colors.text }}
              thumbColor={Colors.surface}
            />
          </View>

          {notificationsEnabled && (
            <>
              <View style={[styles.settingRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight }]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Notification time</Text>
                  <Text style={styles.settingDesc}>Daily reminder fires at this hour.</Text>
                </View>
              </View>
              <View style={styles.refreshOptionsRow}>
                {NOTIFICATION_HOUR_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.refreshChip, notificationHour === opt.value && styles.refreshChipActive]}
                    onPress={() => handleNotificationHourChange(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.refreshChipText, notificationHour === opt.value && styles.refreshChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight }]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Notify about</Text>
                  <Text style={styles.settingDesc}>Choose which alert types trigger a notification.</Text>
                </View>
              </View>
              <View style={[styles.settingRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight }]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Overdue bills (AP)</Text>
                </View>
                <Switch
                  value={notifyAP}
                  onValueChange={handleNotifyAPToggle}
                  trackColor={{ false: Colors.border, true: Colors.text }}
                  thumbColor={Colors.surface}
                />
              </View>
              <View style={[styles.settingRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight }]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Overdue invoices (AR)</Text>
                </View>
                <Switch
                  value={notifyAR}
                  onValueChange={handleNotifyARToggle}
                  trackColor={{ false: Colors.border, true: Colors.text }}
                  thumbColor={Colors.surface}
                />
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Low-stock items</Text>
                </View>
                <Switch
                  value={notifyStock}
                  onValueChange={handleNotifyStockToggle}
                  trackColor={{ false: Colors.border, true: Colors.text }}
                  thumbColor={Colors.surface}
                />
              </View>
            </>
          )}
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

  refreshOptionsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  refreshChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  refreshChipActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  refreshChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  refreshChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

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
