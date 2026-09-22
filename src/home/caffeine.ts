import { parsePositiveDecimal } from './entry';
import { validateCaffeine } from '../systemHealth/units';

export type CaffeineKind = 'Coffee' | 'Espresso' | 'Caffeine';
export const COFFEE_MG_PER_OZ = 95 / 8;
export const ESPRESSO_MG_PER_SHOT = 63;
export const caffeinePresets = { Coffee: [8, 12, 16], Espresso: [1, 2, 3] };

export function caffeineEntry(kind: CaffeineKind, text: string) {
  const value = parsePositiveDecimal(text) ?? NaN;
  let milligrams: number;
  if (kind === 'Coffee') {
    if (!Number.isFinite(value) || value < 1 || value > 64) {
      throw new Error('Enter coffee between 1 and 64 oz.');
    }
    // Round all coffee estimates to the nearest 5 mg, with ties down.
    // Thus 12 oz (142.5 mg before rounding) consistently becomes 140 mg.
    milligrams = Math.ceil((value * COFFEE_MG_PER_OZ) / 5 - 0.5) * 5;
  } else if (kind === 'Espresso') {
    if (!Number.isFinite(value) || value < 0.25 || value > 15) {
      throw new Error('Enter espresso between 0.25 and 15 shots.');
    }
    milligrams = Math.round(value * ESPRESSO_MG_PER_SHOT * 100) / 100;
  } else {
    milligrams = value;
  }
  validateCaffeine(milligrams);
  const amount =
    kind === 'Coffee'
      ? `${value} oz coffee`
      : `${value} ${value === 1 ? 'shot' : 'shots'} espresso`;
  return {
    input: { label: kind, milligrams },
    success:
      kind === 'Caffeine'
        ? `Added ${milligrams} mg caffeine`
        : `Added ${amount} (~${milligrams} mg caffeine)`,
  };
}
