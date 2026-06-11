import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/theme';

interface Props {
  onUnlock: () => void;
}

export default function BiometricLockOverlay({ onUnlock }: Props) {
  const [authenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);

  const authenticate = useCallback(async () => {
    setAuthenticating(true);
    setFailed(false);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to continue',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        onUnlock();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setAuthenticating(false);
    }
  }, [onUnlock]);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.inner} edges={['top', 'bottom']}>
        <View style={styles.iconWrap}>
          <Feather name="lock" size={40} color={Colors.text} />
        </View>

        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.subtitle}>
          Authenticate to access Poultry ERP
        </Text>

        {authenticating ? (
          <ActivityIndicator size="small" color={Colors.text} style={styles.indicator} />
        ) : (
          <TouchableOpacity style={styles.unlockBtn} onPress={authenticate} activeOpacity={0.8}>
            <Feather name="unlock" size={16} color={Colors.surface} />
            <Text style={styles.unlockBtnText}>
              {failed ? 'Try Again' : 'Unlock'}
            </Text>
          </TouchableOpacity>
        )}

        {failed && (
          <Text style={styles.failedText}>Authentication failed. Tap to try again.</Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surface,
    zIndex: 9999,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { ...Typography.h1 },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  indicator: { marginTop: Spacing.sm },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.text,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  unlockBtnText: { color: Colors.surface, fontSize: 15, fontWeight: '600' },
  failedText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
