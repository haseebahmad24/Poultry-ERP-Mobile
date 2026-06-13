import AsyncStorage from '@react-native-async-storage/async-storage';

export type JEPreset = {
  id: string;
  name: string;
  search: string;
  selectedType: string;
  from: string;
  to: string;
  pickedAccount?: string;
  pickedAccountName?: string;
};

const MAX_PRESETS = 10;

function storageKey(companyId: string | number | null | undefined) {
  return `je-presets:${companyId ?? 'all'}`;
}

export async function loadJEPresets(
  companyId: string | number | null | undefined,
): Promise<JEPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(companyId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveJEPreset(
  companyId: string | number | null | undefined,
  preset: JEPreset,
): Promise<JEPreset[]> {
  const existing = await loadJEPresets(companyId);
  const filtered = existing.filter((p) => p.id !== preset.id);
  const updated = [preset, ...filtered].slice(0, MAX_PRESETS);
  await AsyncStorage.setItem(storageKey(companyId), JSON.stringify(updated));
  return updated;
}

export async function deleteJEPreset(
  companyId: string | number | null | undefined,
  presetId: string,
): Promise<JEPreset[]> {
  const existing = await loadJEPresets(companyId);
  const updated = existing.filter((p) => p.id !== presetId);
  await AsyncStorage.setItem(storageKey(companyId), JSON.stringify(updated));
  return updated;
}
