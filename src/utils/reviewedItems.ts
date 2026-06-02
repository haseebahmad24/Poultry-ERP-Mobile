import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_BILLS = 'reviewed_bills';
const KEY_INVOICES = 'reviewed_invoices';

function keyFor(type: 'bill' | 'invoice') {
  return type === 'bill' ? KEY_BILLS : KEY_INVOICES;
}

export async function getReviewedIds(type: 'bill' | 'invoice'): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(type));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

export async function toggleReviewed(type: 'bill' | 'invoice', id: number): Promise<boolean> {
  const ids = await getReviewedIds(type);
  if (ids.has(id)) {
    ids.delete(id);
  } else {
    ids.add(id);
  }
  await AsyncStorage.setItem(keyFor(type), JSON.stringify([...ids]));
  return ids.has(id);
}

export async function clearAllReviewed(type: 'bill' | 'invoice'): Promise<void> {
  await AsyncStorage.removeItem(keyFor(type));
}
