import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app:bookmarks';
const MAX_BOOKMARKS = 100;

export type BookmarkType = 'po' | 'so' | 'partner' | 'material';

export interface Bookmark {
  id: string;
  type: BookmarkType;
  entityId: number;
  title: string;
  subtitle?: string;
  meta?: string;
  // Extra params needed for navigation (e.g. partner roles)
  navParams?: Record<string, unknown>;
  addedAt: number;
}

function makeId(type: BookmarkType, entityId: number): string {
  return `${type}:${entityId}`;
}

async function readAll(): Promise<Bookmark[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Bookmark[];
  } catch {
    return [];
  }
}

async function writeAll(list: Bookmark[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export async function getBookmarks(): Promise<Bookmark[]> {
  const list = await readAll();
  return list.sort((a, b) => b.addedAt - a.addedAt);
}

export async function addBookmark(
  opts: Omit<Bookmark, 'id' | 'addedAt'>
): Promise<Bookmark> {
  const id = makeId(opts.type, opts.entityId);
  const list = await readAll();
  const filtered = list.filter((b) => b.id !== id);
  const entry: Bookmark = { ...opts, id, addedAt: Date.now() };
  const next = [entry, ...filtered].slice(0, MAX_BOOKMARKS);
  await writeAll(next);
  return entry;
}

export async function removeBookmark(
  type: BookmarkType,
  entityId: number
): Promise<void> {
  const id = makeId(type, entityId);
  const list = await readAll();
  await writeAll(list.filter((b) => b.id !== id));
}

export async function isBookmarked(
  type: BookmarkType,
  entityId: number
): Promise<boolean> {
  const id = makeId(type, entityId);
  const list = await readAll();
  return list.some((b) => b.id === id);
}

export async function clearBookmarks(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
