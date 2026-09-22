import { useEffect, useRef, useState } from 'react';
import type { WeightUnit } from '../systemHealth/types';
import {
  formatWeight,
  validateWeightKg,
  weightToKg,
} from '../systemHealth/units';
import { parsePositiveDecimal } from './entry';
import {
  defaultWeightPreferences,
  logPreferenceFailure,
  weightPreferences,
  WeightPreferences,
} from '../preferences/weightPreferences';

export type WeightDraft = { text: string; kg: number | null };
export function editWeight(text: string, unit: WeightUnit): WeightDraft {
  const value = parsePositiveDecimal(text);
  return { text, kg: value === null ? null : weightToKg(value, unit) };
}
export function displayWeight(
  kg: number | null,
  unit: WeightUnit,
): WeightDraft {
  return { text: kg === null ? '' : formatWeight(kg, unit), kg };
}
export function weightEntry(draft: WeightDraft, unit: WeightUnit) {
  const value = validateWeightKg(draft.kg ?? NaN, unit);
  // Never reconstruct canonical kg from rounded display text or round-trip through lb.
  return { value, unit: 'kg' as const };
}

export function useWeightInput() {
  const [ready, setReady] = useState(false);
  const [unit, setUnit] = useState<WeightUnit>('lb');
  const [draft, setDraft] = useState<WeightDraft>({ text: '', kg: null });
  const preferences = useRef<WeightPreferences>({
    ...defaultWeightPreferences,
  });
  const pendingSave = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    weightPreferences
      .load()
      .then(value => {
        if (active) {
          preferences.current = value;
          setUnit(value.unit);
          setDraft(displayWeight(value.lastEnteredWeightKg, value.unit));
        }
      })
      .catch(logPreferenceFailure)
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function persist(next: WeightPreferences) {
    preferences.current = next;
    // Keep toggles and acknowledged writes in order; failures never escape into a health write.
    pendingSave.current = pendingSave.current
      .then(() => weightPreferences.save(next))
      .catch(logPreferenceFailure);
  }
  function selectUnit(next: WeightUnit) {
    if (!ready) {
      return;
    }
    setUnit(next);
    setDraft(displayWeight(draft.kg, next));
    persist({ ...preferences.current, unit: next });
  }
  function rememberSuccess(kg: number) {
    persist({ ...preferences.current, lastEnteredWeightKg: kg });
  }
  return {
    ready,
    unit,
    draft,
    selectUnit,
    switchUnit: () => selectUnit(unit === 'lb' ? 'kg' : 'lb'),
    rememberSuccess,
    setText: (text: string) => setDraft(editWeight(text, unit)),
  };
}
