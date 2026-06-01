import AsyncStorage from '@react-native-async-storage/async-storage';

type FlagType = 'bill' | 'invoice';

const key = (type: FlagType) => `flagged:${type}`;

async function readIds(type: FlagType): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(key(type));
    if (!raw) return new Set();
    const arr: number[] = JSON.parse(raw);
    return new Set(arr);
  } catch {
    return new Set();
  }
}

async function writeIds(type: FlagType, ids: Set<number>): Promise<void> {
  await AsyncStorage.setItem(key(type), JSON.stringify([...ids]));
}

/** Returns all flagged IDs for the given type. */
export async function getFlaggedIds(type: FlagType): Promise<Set<number>> {
  return readIds(type);
}

/** Toggles the flagged state for an item. Returns the new state (true = now flagged). */
export async function toggleFlagged(type: FlagType, id: number): Promise<boolean> {
  const ids = await readIds(type);
  if (ids.has(id)) {
    ids.delete(id);
    await writeIds(type, ids);
    return false;
  } else {
    ids.add(id);
    await writeIds(type, ids);
    return true;
  }
}

/** Returns true if the given item is flagged. */
export async function isFlagged(type: FlagType, id: number): Promise<boolean> {
  const ids = await readIds(type);
  return ids.has(id);
}

/** Clears all flags for the given type. */
export async function clearAllFlagged(type: FlagType): Promise<void> {
  await AsyncStorage.removeItem(key(type));
}
