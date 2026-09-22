import type { BloodPressureInput, WaterInput } from './types';

// US fluid ounces, not imperial ounces. Round to 0.1 mL at the boundary,
// preserving the spike's 8 oz = 236.6 mL payload.
export function waterToMilliliters({ value, unit }: WaterInput): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Enter a water amount greater than zero.');
  }
  const milliliters = unit === 'us-fl-oz' ? value * 29.5735295625 : value;
  const rounded = Math.round(milliliters * 10) / 10;
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new Error('Water amount is too small or too large.');
  }
  return rounded;
}

// Input sanity limits only; these are not medical recommendations.
export function validateCaffeine(milligrams: number): number {
  if (!Number.isFinite(milligrams) || milligrams < 1 || milligrams > 1000) {
    throw new Error('Enter caffeine between 1 and 1000 mg.');
  }
  return milligrams;
}

export const MIN_SYSTOLIC_MMHG = 20;
export const MAX_SYSTOLIC_MMHG = 200;
export const MIN_DIASTOLIC_MMHG = 10;
export const MAX_DIASTOLIC_MMHG = 180;
export function validateBloodPressure({
  systolic,
  diastolic,
}: BloodPressureInput): BloodPressureInput {
  if (
    !Number.isFinite(systolic) ||
    systolic < MIN_SYSTOLIC_MMHG ||
    systolic > MAX_SYSTOLIC_MMHG
  ) {
    throw new Error('Enter systolic pressure between 20 and 200 mmHg.');
  }
  if (
    !Number.isFinite(diastolic) ||
    diastolic < MIN_DIASTOLIC_MMHG ||
    diastolic > MAX_DIASTOLIC_MMHG
  ) {
    throw new Error('Enter diastolic pressure between 10 and 180 mmHg.');
  }
  if (systolic <= diastolic) {
    throw new Error(
      'Systolic pressure must be higher than diastolic pressure.',
    );
  }
  return { systolic, diastolic };
}

export const KG_PER_LB = 0.45359237;
export function weightToKg(value: number, unit: 'lb' | 'kg'): number {
  return unit === 'lb' ? value * KG_PER_LB : value;
}
export function weightFromKg(kg: number, unit: 'lb' | 'kg'): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}
export function validateWeight(value: number, unit: 'lb' | 'kg'): number {
  return validateWeightKg(weightToKg(value, unit), unit);
}

export const MIN_WEIGHT_KG = 10;
export const MAX_WEIGHT_KG = 450;
export function weightRangeLabel(unit: 'lb' | 'kg'): string {
  return unit === 'kg' ? '10–450 kg' : '22.0–992.1 lb';
}
export function validateWeightKg(
  kg: number,
  displayUnit: 'lb' | 'kg' = 'kg',
): number {
  if (!Number.isFinite(kg) || kg < MIN_WEIGHT_KG || kg > MAX_WEIGHT_KG) {
    throw new Error(`Enter weight within ${weightRangeLabel(displayUnit)}.`);
  }
  return kg;
}

// Display rounding never feeds back into the canonical kg value.
export function formatWeight(kg: number, unit: 'lb' | 'kg'): string {
  return String(Number(weightFromKg(kg, unit).toFixed(1)));
}
