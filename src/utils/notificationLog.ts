import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'inbox:entries';
const MAX_ENTRIES = 50;

export interface InboxEntry {
  id: string;
  timestamp: number;
  apCount: number;
  arCount: number;
  stockCount: number;
  read: boolean;
}

async function readEntries(): Promise<InboxEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as InboxEntry[];
  } catch {
    return [];
  }
}

async function writeEntries(entries: InboxEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // ignore write failures
  }
}

export async function logNotificationEvent(params: {
  apCount: number;
  arCount: number;
  stockCount: number;
}): Promise<void> {
  const entries = await readEntries();
  const entry: InboxEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    apCount: params.apCount,
    arCount: params.arCount,
    stockCount: params.stockCount,
    read: false,
  };
  // Prepend newest first, cap at MAX_ENTRIES
  const updated = [entry, ...entries].slice(0, MAX_ENTRIES);
  await writeEntries(updated);
}

export async function getInboxEntries(): Promise<InboxEntry[]> {
  return readEntries();
}

export async function getUnreadCount(): Promise<number> {
  const entries = await readEntries();
  return entries.filter((e) => !e.read).length;
}

export async function markAllRead(): Promise<void> {
  const entries = await readEntries();
  const updated = entries.map((e) => ({ ...e, read: true }));
  await writeEntries(updated);
}

export async function deleteInboxEntry(id: string): Promise<void> {
  const entries = await readEntries();
  await writeEntries(entries.filter((e) => e.id !== id));
}

export async function clearInbox(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
