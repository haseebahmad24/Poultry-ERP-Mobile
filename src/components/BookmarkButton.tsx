import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/theme';
import {
  addBookmark,
  isBookmarked,
  removeBookmark,
  type BookmarkType,
} from '@/utils/bookmarks';

interface Props {
  type: BookmarkType;
  entityId: number;
  title: string;
  subtitle?: string;
  meta?: string;
  color?: string;
}

export default function BookmarkButton({ type, entityId, title, subtitle, meta, color }: Props) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    isBookmarked(type, entityId).then(setSaved);
  }, [type, entityId]);

  const toggle = useCallback(async () => {
    if (saved) {
      await removeBookmark(type, entityId);
      setSaved(false);
    } else {
      await addBookmark({ type, entityId, title, subtitle, meta });
      setSaved(true);
    }
  }, [saved, type, entityId, title, subtitle, meta]);

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={toggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Feather
        name="bookmark"
        size={20}
        color={color ?? (saved ? Colors.text : Colors.textMuted)}
        style={{ opacity: saved ? 1 : 0.45 }}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
});
