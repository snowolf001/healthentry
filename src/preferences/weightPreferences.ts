import nativePreferences from '../../specs/NativeWeightPreferences';
import type { WeightUnit } from '../systemHealth/types';
import { MIN_WEIGHT_KG, MAX_WEIGHT_KG } from '../systemHealth/units';

export type WeightPreferences = {
  unit: WeightUnit;
  lastEnteredWeightKg: number | null;
};
export const defaultWeightPreferences: WeightPreferences = {
  unit: 'lb',
  lastEnteredWeightKg: null,
};

export function parseWeightPreferences(json: string): WeightPreferences {
  const input: unknown = JSON.parse(json);
  if (!input || typeof input !== 'object') {
    return { ...defaultWeightPreferences };
  }
  const fields = input as Partial<WeightPreferences>;
  const kg = fields.lastEnteredWeightKg;
  return {
    unit: fields.unit === 'kg' ? 'kg' : 'lb',
    lastEnteredWeightKg:
      typeof kg === 'number' &&
      Number.isFinite(kg) &&
      kg >= MIN_WEIGHT_KG &&
      kg <= MAX_WEIGHT_KG
        ? kg
        : null,
  };
}
function nativeStore() {
  if (!nativePreferences) {
    throw new Error('Weight preferences are unavailable on this platform.');
  }
  return nativePreferences;
}
export const weightPreferences = {
  async load(): Promise<WeightPreferences> {
    return parseWeightPreferences(await nativeStore().load());
  },
  async save(value: WeightPreferences): Promise<void> {
    // Explicit whitelist, so future UI state can never silently become stored history.
    await nativeStore().save(
      JSON.stringify({
        unit: value.unit,
        lastEnteredWeightKg: value.lastEnteredWeightKg,
      }),
    );
  },
};
export function logPreferenceFailure() {
  if (__DEV__) {
    console.warn(
      '[WeightPreferences] Could not persist/load input preferences; health write status is unchanged.',
    );
  }
}
