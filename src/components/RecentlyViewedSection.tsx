import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/theme';
import type { RecentItem, RecentItemType } from '@/utils/recentlyViewed';

const TYPE_ICONS: Record<RecentItemType, string> = {
  po: 'shopping-cart',
  so: 'package',
  partner: 'users',
  material: 'layers',
  vendor: 'briefcase',
  customer: 'user',
};

type Props = {
  items: RecentItem[];
  onPress: (item: RecentItem) => void;
};

export default function RecentlyViewedSection({ items, onPress }: Props) {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const icon = TYPE_ICONS[item.type] as any;
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.row}
            onPress={() => onPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrap}>
              <Feather name={icon} size={14} color={Colors.text} />
            </View>
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              {item.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { fontSize: 13, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
});
