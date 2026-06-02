import AsyncStorage from '@react-native-async-storage/async-storage';

function noteKey(type: 'vendor' | 'customer', id: number): string {
  return `partner_note:${type}:${id}`;
}

export async function getNote(type: 'vendor' | 'customer', id: number): Promise<string> {
  try {
    return (await AsyncStorage.getItem(noteKey(type, id))) ?? '';
  } catch {
    return '';
  }
}

export async function saveNote(type: 'vendor' | 'customer', id: number, text: string): Promise<void> {
  if (text.trim() === '') {
    await AsyncStorage.removeItem(noteKey(type, id));
  } else {
    await AsyncStorage.setItem(noteKey(type, id), text);
  }
}
