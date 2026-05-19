import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useCompany } from '@/context/CompanyContext';
import { Colors, Radius, Spacing } from '@/theme';

interface Props {
  /** When true, includes an "All Companies" option that sets selectedCompany to null */
  showAll?: boolean;
}

export default function CompanySelector({ showAll = false }: Props) {
  const { companies, selectedCompany, setSelectedCompany } = useCompany();
  const [open, setOpen] = useState(false);

  if (companies.length <= 1 && !showAll) return null;

  const displayName = selectedCompany
    ? (selectedCompany.code ?? selectedCompany.name)
    : 'All Companies';

  type Item = { id: string | null; label: string };

  const items: Item[] = [
    ...(showAll ? [{ id: null, label: 'All Companies' }] : []),
    ...companies.map((c) => ({ id: c.id, label: c.code ?? c.name })),
  ];

  const handleSelect = (item: Item) => {
    if (item.id === null) {
      setSelectedCompany(null);
    } else {
      const found = companies.find((c) => c.id === item.id) ?? null;
      setSelectedCompany(found);
    }
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Feather name="briefcase" size={14} color={Colors.textSecondary} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {displayName}
        </Text>
        <Feather name="chevron-down" size={14} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Company</Text>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id ?? '__all__'}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const isActive =
                  item.id === null
                    ? selectedCompany === null
                    : selectedCompany?.id === item.id;
                return (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                      {item.label}
                    </Text>
                    {isActive && (
                      <Feather name="check" size={16} color={Colors.text} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  triggerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  optionTextActive: {
    fontWeight: '700',
    color: Colors.text,
  },
});
