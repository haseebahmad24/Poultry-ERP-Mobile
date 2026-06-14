import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import {
  clearInbox,
  deleteInboxEntry,
  getInboxEntries,
  markAllRead,
  type InboxEntry,
} from '@/utils/notificationLog';

const SWIPE_THRESHOLD = -80;
const DELETE_BUTTON_WIDTH = 72;

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

function entryBody(entry: InboxEntry): string {
  const parts: string[] = [];
  if (entry.apCount > 0) parts.push(`${entry.apCount} overdue bill${entry.apCount !== 1 ? 's' : ''}`);
  if (entry.arCount > 0) parts.push(`${entry.arCount} overdue invoice${entry.arCount !== 1 ? 's' : ''}`);
  if (entry.stockCount > 0) parts.push(`${entry.stockCount} low-stock item${entry.stockCount !== 1 ? 's' : ''}`);
  return parts.join(' · ') || 'No alerts';
}

interface EntryRowProps {
  entry: InboxEntry;
  onDelete: (id: string) => void;
}

function SwipeableEntryRow({ entry, onDelete }: EntryRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const total = entry.apCount + entry.arCount + entry.stockCount;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (_, gestureState) => {
        const dx = Math.min(0, gestureState.dx);
        translateX.setValue(Math.max(-DELETE_BUTTON_WIDTH, dx));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < SWIPE_THRESHOLD) {
          // Snap open to show delete button
          Animated.spring(translateX, {
            toValue: -DELETE_BUTTON_WIDTH,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Animated.timing(translateX, {
      toValue: -400,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDelete(entry.id);
    });
  };

  return (
    <View style={styles.rowContainer}>
      {/* Delete action behind the card */}
      <View style={styles.deleteAction}>
        <TouchableOpacity style={styles.deleteActionBtn} onPress={handleDelete}>
          <Feather name="trash-2" size={18} color={Colors.surface} />
          <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable card */}
      <Animated.View
        style={[styles.entryCard, !entry.read && styles.entryCardUnread, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.entryIcon}>
          <Feather name="bell" size={16} color={Colors.text} />
          {!entry.read && <View style={styles.unreadDot} />}
        </View>
        <View style={styles.entryBody}>
          <View style={styles.entryHeader}>
            <Text style={[styles.entryTitle, !entry.read && styles.entryTitleUnread]}>
              Action required
            </Text>
            <Text style={styles.entryTime}>{timeAgo(entry.timestamp)}</Text>
          </View>
          <Text style={styles.entryText}>{entryBody(entry)}</Text>
          <View style={styles.chipRow}>
            {entry.apCount > 0 && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>AP {entry.apCount}</Text>
              </View>
            )}
            {entry.arCount > 0 && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>AR {entry.arCount}</Text>
              </View>
            )}
            {entry.stockCount > 0 && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>Stock {entry.stockCount}</Text>
              </View>
            )}
            {total === 0 && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>Clear</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export default function InboxScreen() {
  const navigation = useNavigation();
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getInboxEntries();
    setEntries(data);
    setLoading(false);
    await markAllRead();
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteInboxEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleClearAll = () => {
    Alert.alert(
      'Clear Inbox',
      'Remove all notification history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearInbox();
            setEntries([]);
          },
        },
      ]
    );
  };

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
          <Text style={styles.headerTitle}>Inbox</Text>
          <Text style={styles.headerSub}>
            {entries.length > 0 ? 'Swipe left to delete' : 'Notification history'}
          </Text>
        </View>
        {entries.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearBtnText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {!loading && entries.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.textMuted}
            />
          }
        >
          <View style={styles.emptyIcon}>
            <Feather name="inbox" size={32} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Inbox is empty</Text>
          <Text style={styles.emptyText}>
            Overdue reminders will appear here when notifications are enabled in Settings.
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SwipeableEntryRow entry={item} onDelete={handleDelete} />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.textMuted}
            />
          }
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
  clearBtn: { padding: Spacing.xs },
  clearBtnText: { fontSize: 13, color: Colors.textSecondary },

  listContent: { padding: Spacing.md, gap: Spacing.sm },

  rowContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.md,
  },

  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BUTTON_WIDTH,
    backgroundColor: Colors.text,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionBtn: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteActionText: { color: Colors.surface, fontSize: 11, fontWeight: '600' },

  entryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  entryCardUnread: {
    borderColor: Colors.text,
  },

  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.surface,
  },

  entryBody: { flex: 1, gap: 4 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  entryTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  entryTitleUnread: { fontWeight: '700' },
  entryTime: { fontSize: 11, color: Colors.textMuted },
  entryText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: Colors.surfaceHover,
  },
  chipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },

  separator: { height: Spacing.xs },

  emptyState: {
    flexGrow: 1,
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
