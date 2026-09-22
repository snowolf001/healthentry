import {
  editWeight,
  displayWeight,
  weightEntry,
} from '../src/home/weightInput';
import {
  formatWeight,
  KG_PER_LB,
  validateCaffeine,
  validateWeight,
  weightToKg,
} from '../src/systemHealth/units';
import nativeStore from '../specs/NativeWeightPreferences';
import {
  parseWeightPreferences,
  weightPreferences,
} from '../src/preferences/weightPreferences';

jest.mock('../specs/NativeWeightPreferences', () => ({
  __esModule: true,
  default: { load: jest.fn(), save: jest.fn() },
}));
beforeEach(() => jest.resetAllMocks());

test('exact lb conversion and kg display rounding', () => {
  expect(weightToKg(165.2, 'lb')).toBe(74.933459524);
  expect(weightToKg(74.933459524, 'kg')).toBe(74.933459524);
  expect(formatWeight(74.933459524, 'kg')).toBe('74.9');
  expect(formatWeight(74.933459524, 'lb')).toBe('165.2');
});
test('switching units repeatedly preserves canonical precision and never reinterprets input', () => {
  let draft = editWeight('165.2', 'lb');
  for (let i = 0; i < 10; i++) {
    draft = displayWeight(draft.kg, 'kg');
    expect(draft.text).toBe('74.9');
    expect(weightEntry(draft, 'kg').value).toBe(74.933459524);
    draft = displayWeight(draft.kg, 'lb');
    expect(draft.text).toBe('165.2');
  }
  expect(draft.kg).toBe(74.933459524);
});
test.each([1, 95, 63, 1000])('accepts caffeine boundary/default %s', mg =>
  expect(validateCaffeine(mg)).toBe(mg),
);
test.each([NaN, Infinity, -1, 0, 0.999, 1000.001])('rejects caffeine %s', mg =>
  expect(() => validateCaffeine(mg)).toThrow(),
);
test.each([
  ['lb', 10 / KG_PER_LB],
  ['lb', 450 / KG_PER_LB],
  ['kg', 10],
  ['kg', 450],
] as const)('accepts %s boundary %s', (unit, value) => {
  expect(validateWeight(value, unit)).toBe(weightToKg(value, unit));
  expect(() =>
    weightEntry(editWeight(String(value), unit), unit),
  ).not.toThrow();
});
test.each([
  ['lb', 19.999],
  ['lb', 1000.001],
  ['kg', 9.999],
  ['kg', 450.001],
  ['kg', NaN],
  ['lb', Infinity],
] as const)('rejects %s value %s', (unit, value) =>
  expect(() => validateWeight(value, unit)).toThrow(),
);
test.each([9.999, 10, 74.933459524, 450, 450.0001])(
  'canonical %s kg has identical validity after unit switching',
  kg => {
    const valid = kg >= 10 && kg <= 450;
    for (const unit of ['lb', 'kg', 'lb', 'kg'] as const) {
      const draft = displayWeight(kg, unit);
      if (valid) {
        expect(weightEntry(draft, unit)).toEqual({ value: kg, unit: 'kg' });
      } else {
        expect(() => weightEntry(draft, unit)).toThrow('Enter weight within');
      }
      expect(draft.kg).toBe(kg);
    }
  },
);
test.each([20, 1000])(
  'old independent lb boundary %s is invalid in both units',
  lb => {
    const draft = editWeight(String(lb), 'lb');
    expect(() => weightEntry(draft, 'lb')).toThrow();
    expect(() => weightEntry(displayWeight(draft.kg, 'kg'), 'kg')).toThrow();
  },
);
test.each([10, 450])(
  'unit conversion boundary %s kg accepts exact equivalent lb',
  kg => {
    expect(validateWeight(kg / KG_PER_LB, 'lb')).toBeCloseTo(kg, 12);
    expect(() =>
      validateWeight((kg === 10 ? 9.999999 : 450.000001) / KG_PER_LB, 'lb'),
    ).toThrow();
  },
);
test('out-of-range old preferences are not restored as valid input', () => {
  expect(
    parseWeightPreferences('{"unit":"lb","lastEnteredWeightKg":9.5}'),
  ).toEqual({ unit: 'lb', lastEnteredWeightKg: null });
  expect(
    parseWeightPreferences('{"unit":"kg","lastEnteredWeightKg":453}'),
  ).toEqual({ unit: 'kg', lastEnteredWeightKg: null });
});
test('missing and invalid stored fields fall back safely', () => {
  expect(parseWeightPreferences('{}')).toEqual({
    unit: 'lb',
    lastEnteredWeightKg: null,
  });
  expect(
    parseWeightPreferences('{"unit":"stone","lastEnteredWeightKg":-1}'),
  ).toEqual({ unit: 'lb', lastEnteredWeightKg: null });
  expect(() => parseWeightPreferences('broken')).toThrow();
});
test('storage only serializes two preference fields, never timestamps/history', async () => {
  await weightPreferences.save({
    unit: 'kg',
    lastEnteredWeightKg: 74.933459524,
    timestamp: 'never store',
    history: [1, 2],
    systolic: 120,
    diastolic: 80,
    recordId: 'never store',
  } as Parameters<typeof weightPreferences.save>[0]);
  expect(nativeStore!.save).toHaveBeenCalledWith(
    '{"unit":"kg","lastEnteredWeightKg":74.933459524}',
  );
});
test('storage loads the canonical last value and surfaces failures to its isolated caller', async () => {
  jest
    .mocked(nativeStore!.load)
    .mockResolvedValue('{"unit":"kg","lastEnteredWeightKg":74.933459524}');
  await expect(weightPreferences.load()).resolves.toEqual({
    unit: 'kg',
    lastEnteredWeightKg: 74.933459524,
  });
  jest.mocked(nativeStore!.save).mockRejectedValue(new Error('disk full'));
  await expect(
    weightPreferences.save({ unit: 'lb', lastEnteredWeightKg: null }),
  ).rejects.toThrow('disk full');
});
