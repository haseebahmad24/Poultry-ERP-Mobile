import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Employee, fetchEmployees } from '@/api/auth';
import { useAuth } from '@/context/AuthContext';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/theme';

export default function LoginScreen() {
  const { loginAs } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchEmployees();
      setEmployees(list);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogin = async (emp: Employee) => {
    setLoggingIn(emp.id);
    setError(null);
    try {
      await loginAs(emp.id);
    } catch (e: any) {
      setError(String(e?.message ?? 'Login failed'));
      setLoggingIn(null);
    }
  };

  const roleColor = (role: string | null) => {
    if (!role) return Colors.textMuted;
    const r = role.toLowerCase();
    if (r.includes('admin')) return Colors.primary;
    if (r.includes('manager')) return Colors.success;
    if (r.includes('account')) return Colors.warning;
    return Colors.textSecondary;
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>🐔</Text>
        </View>
        <Text style={styles.appName}>Poultry ERP</Text>
        <Text style={styles.tagline}>Select your account to continue</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading accounts…</Text>
          </View>
        ) : employees.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No accounts found.</Text>
            <Text style={styles.emptySubText}>
              Make sure the server is running and the database is seeded.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {employees.length} account{employees.length !== 1 ? 's' : ''} available
            </Text>
            <FlatList
              data={employees}
              keyExtractor={(e) => e.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: emp }) => {
                const busy = loggingIn === emp.id;
                return (
                  <TouchableOpacity
                    style={[styles.card, busy && styles.cardBusy]}
                    onPress={() => handleLogin(emp)}
                    disabled={loggingIn !== null}
                    activeOpacity={0.75}
                  >
                    {/* Avatar */}
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(emp.name)}</Text>
                    </View>

                    {/* Info */}
                    <View style={styles.cardInfo}>
                      <Text style={styles.empName}>{emp.name}</Text>
                      {emp.email && (
                        <Text style={styles.empEmail}>{emp.email}</Text>
                      )}
                      {emp.role && (
                        <View style={[styles.roleBadge, { borderColor: roleColor(emp.role) }]}>
                          <Text style={[styles.roleText, { color: roleColor(emp.role) }]}>
                            {emp.role}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Action */}
                    <View style={styles.cardAction}>
                      {busy ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <View style={styles.arrowWrap}>
                          <Text style={styles.arrow}>›</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Poultry ERP v1.0 · Powered by Next.js</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl + 8,
    paddingHorizontal: Spacing.lg,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: { fontSize: 36 },
  appName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '400' },

  body: { flex: 1, paddingTop: Spacing.md },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fce4ec',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.sm,
    padding: Spacing.sm + 2,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  errorText: { color: Colors.danger, fontSize: 13, flex: 1 },
  retryText: { color: Colors.primary, fontSize: 13, fontWeight: '600', marginLeft: 8 },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: 8,
  },
  loadingText: { color: Colors.textSecondary, marginTop: 8 },
  emptyText: { ...Typography.h3, textAlign: 'center' },
  emptySubText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },

  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, gap: 10 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 12,
    ...Shadow.card,
  },
  cardBusy: { opacity: 0.7 },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: Colors.primary },

  cardInfo: { flex: 1, gap: 2 },
  empName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  empEmail: { fontSize: 12, color: Colors.textSecondary },
  roleBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 1,
    marginTop: 3,
  },
  roleText: { fontSize: 11, fontWeight: '500' },

  cardAction: { width: 32, alignItems: 'center' },
  arrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: { fontSize: 20, color: Colors.primary, marginTop: -2 },

  footer: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  footerText: { fontSize: 11, color: Colors.textMuted },
});
