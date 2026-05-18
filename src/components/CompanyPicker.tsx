import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/theme';
import { useCompany } from '@/context/CompanyContext';

interface Props {
  showAll?: boolean;
}

export default function CompanyPicker({ showAll = false }: Props) {
  const { companies, selectedCompany, setSelectedCompany } = useCompany();

  if (companies.length <= 1 && !showAll) return null;

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {showAll && (
          <TouchableOpacity
            style={[styles.chip, !selectedCompany && styles.chipActive]}
            onPress={() => setSelectedCompany(null)}
          >
            <Text style={[styles.chipText, !selectedCompany && styles.chipTextActive]}>
              All Companies
            </Text>
          </TouchableOpacity>
        )}
        {companies.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, selectedCompany?.id === c.id && styles.chipActive]}
            onPress={() => setSelectedCompany(c)}
          >
            <Text
              style={[styles.chipText, selectedCompany?.id === c.id && styles.chipTextActive]}
              numberOfLines={1}
            >
              {c.code ?? c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    maxWidth: 120,
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
