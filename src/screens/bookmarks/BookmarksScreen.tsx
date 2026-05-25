import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import {
  clearBookmarks,
  getBookmarks,
  removeBookmark,
  type Bookmark,
  type BookmarkType,
} from '@/utils/bookmarks';
import { exportBookmarksPDF } from '@/utils/pdfExport';
import { MoreStackParamList } from '@/navigation/MoreNavigator';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

const TYPE_LABELS: Record<BookmarkType, string> = {
  po: 'Purchase Orders',
  so: 'Sales Orders',
  partner: 'Partners',
  material: 'Materials',
};

const TYPE_ICONS: Record<BookmarkType, string> = {
  po: 'shopping-cart',
  so: 'package',
  partner: 'users',
  material: 'layers',
};

const TYPE_ORDER: BookmarkType[] = ['po', 'so', 'partner', 'material'];

function navigateToBookmark(nav: Nav, bookmark: Bookmark) {
  switch (bookmark.type) {
    case 'po':
      nav.navigate('PurchaseOrderDetail', { id: bookmark.entityId });
      break;
    case 'so':
      nav.navigate('SalesOrderDetail', { id: bookmark.entityId });
      break;
    case 'partner':
      nav.navigate('PartnerDetail', {
        partnerId: bookmark.entityId,
        partnerName: bookmark.title,
        isVendor: Boolean(bookmark.navParams?.isVendor),
        isCustomer: Boolean(bookmark.navParams?.isCustomer),
      });
      break;
    case 'material':
      nav.navigate('MaterialDetail', {
        materialId: bookmark.entityId,
        materialName: bookmark.title,
        materialCode: bookmark.navParams?.materialCode as string | undefined,
        materialType: bookmark.navParams?.materialType as string | undefined,
        materialUnit: bookmark.navParams?.materialUnit as string | undefined,
        materialCategory: bookmark.navParams?.materialCategory as string | undefined,
        materialStatus: bookmark.navParams?.materialStatus as string | undefined,
        materialDescription: bookmark.navParams?.materialDescription as string | undefined,
      });
      break;
  }
}

interface BookmarkRowProps {
  bookmark: Bookmark;
  onDelete: (b: Bookmark) => void;
  nav: Nav;
}

function BookmarkRow({ bookmark, onDelete, nav }: BookmarkRowProps) {
  const icon = TYPE_ICONS[bookmark.type] as any;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigateToBookmark(nav, bookmark)}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>
        <Feather name={icon} size={16} color={Colors.text} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{bookmark.title}</Text>
        {bookmark.subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>{bookmark.subtitle}</Text>
        ) : null}
        {bookmark.meta ? (
          <Text style={styles.rowMeta} numberOfLines={1}>{bookmark.meta}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete(bookmark)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="x" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface Section {
  type: BookmarkType;
  label: string;
  data: Bookmark[];
}

function buildSections(bookmarks: Bookmark[]): Section[] {
  const byType: Record<BookmarkType, Bookmark[]> = {
    po: [],
    so: [],
    partner: [],
    material: [],
  };
  for (const b of bookmarks) {
    byType[b.type].push(b);
  }
  return TYPE_ORDER.filter((t) => byType[t].length > 0).map((t) => ({
    type: t,
    label: TYPE_LABELS[t],
    data: byType[t],
  }));
}

export default function BookmarksScreen() {
  const navigation = useNavigation<Nav>();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getBookmarks();
    setBookmarks(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = useCallback((b: Bookmark) => {
    Alert.alert(
      'Remove Bookmark',
      `Remove "${b.title}" from bookmarks?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeBookmark(b.type, b.entityId);
            setBookmarks((prev) => prev.filter((x) => x.id !== b.id));
          },
        },
      ]
    );
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All Bookmarks',
      'Remove all saved bookmarks? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearBookmarks();
            setBookmarks([]);
          },
        },
      ]
    );
  }, []);

  const sections = buildSections(bookmarks);

  const listData: Array<{ key: string } & (
    | { kind: 'sectionHeader'; label: string }
    | { kind: 'bookmark'; bookmark: Bookmark }
  )> = [];

  for (const section of sections) {
    listData.push({ key: `header-${section.type}`, kind: 'sectionHeader', label: section.label });
    for (const b of section.data) {
      listData.push({ key: b.id, kind: 'bookmark', bookmark: b });
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Bookmarks</Text>
          <Text style={styles.headerSub}>
            {bookmarks.length > 0 ? `${bookmarks.length} saved` : 'Quick access to saved items'}
          </Text>
        </View>
        {bookmarks.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => exportBookmarksPDF(bookmarks)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="file-text" size={18} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClearAll}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!loading && bookmarks.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="bookmark" size={32} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No bookmarks yet</Text>
          <Text style={styles.emptyText}>
            Tap the bookmark icon on any Purchase Order, Sales Order, Partner, or Material to save it here for quick access.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.kind === 'sectionHeader') {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>{item.label}</Text>
                </View>
              );
            }
            return (
              <BookmarkRow
                bookmark={item.bookmark}
                onDelete={handleDelete}
                nav={navigation}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  backBtn: { padding: 2 },
  headerText: { flex: 1 },
  headerTitle: { ...Typography.h3 },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIconBtn: { padding: Spacing.xs },
  clearBtn: { padding: Spacing.xs },
  clearBtnText: { fontSize: 13, color: Colors.textSecondary },

  listContent: { padding: Spacing.md, gap: Spacing.xs },

  sectionHeader: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  row: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.textSecondary },
  rowMeta: { fontSize: 11, color: Colors.textMuted },

  deleteBtn: { padding: 4 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: { ...Typography.h4, color: Colors.textSecondary },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
