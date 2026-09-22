import nativeWidget from '../../specs/NativeWidgetActions';
import { parsePositiveDecimal } from '../home/entry';

export type CoffeeWidgetDefault =
  | 'ask'
  | 'coffee8'
  | 'coffee12'
  | 'coffee16'
  | 'espresso1'
  | 'espresso2'
  | 'espresso3';
export type WidgetPreferences = {
  waterOz: number;
  coffeeDefault: CoffeeWidgetDefault;
};
export const defaultWidgetPreferences: WidgetPreferences = {
  waterOz: 8,
  coffeeDefault: 'ask',
};
export const waterPresets = [8, 12, 16, 20, 24] as const;
export const coffeeDefaults: readonly CoffeeWidgetDefault[] = [
  'ask',
  'coffee8',
  'coffee12',
  'coffee16',
  'espresso1',
  'espresso2',
  'espresso3',
];

export function validateWaterWidgetValue(text: string): number {
  const value = parsePositiveDecimal(text) ?? NaN;
  if (!Number.isFinite(value) || value < 1 || value > 99) {
    throw new Error('Enter water between 1 and 99 oz.');
  }
  return value;
}
export function coffeeDefaultLabel(value: CoffeeWidgetDefault) {
  if (value === 'ask') return 'Ask Every Time';
  const match = /^(coffee|espresso)(\d+)$/.exec(value)!;
  const amount = Number(match[2]);
  return match[1] === 'coffee'
    ? `${amount} oz Coffee`
    : `${amount} ${amount === 1 ? 'shot' : 'shots'} Espresso`;
}
export function parseWidgetPreferences(json: string): WidgetPreferences {
  try {
    const input = JSON.parse(json) as Partial<WidgetPreferences>;
    return {
      waterOz:
        typeof input.waterOz === 'number' &&
        input.waterOz >= 1 &&
        input.waterOz <= 99
          ? input.waterOz
          : 8,
      coffeeDefault: coffeeDefaults.includes(
        input.coffeeDefault as CoffeeWidgetDefault,
      )
        ? (input.coffeeDefault as CoffeeWidgetDefault)
        : 'ask',
    };
  } catch {
    return { ...defaultWidgetPreferences };
  }
}
function bridge() {
  if (!nativeWidget) throw new Error('Widget preferences are unavailable.');
  return nativeWidget;
}
export const widgetPreferences = {
  async load() {
    return parseWidgetPreferences(await bridge().loadPreferences());
  },
  async save(value: WidgetPreferences) {
    await bridge().savePreferences(value.waterOz, value.coffeeDefault);
  },
};
