import {
  validateBloodPressure,
  waterToMilliliters,
} from '../src/systemHealth/units';
import { unsupportedSystemHealth } from '../src/systemHealth/unsupported';
import { createEntryGuard, parsePositiveDecimal } from '../src/home/entry';

test.each([
  [8, 236.6],
  [12, 354.9],
  [1, 29.6],
])('converts %s US fl oz to %s mL', (value, expected) => {
  expect(waterToMilliliters({ value, unit: 'us-fl-oz' })).toBe(expected);
});
test('mL inputs remain mL', () =>
  expect(waterToMilliliters({ value: 250, unit: 'mL' })).toBe(250));
test.each([0, -1, NaN, Infinity, 0.00001, Number.MAX_VALUE])(
  'rejects invalid amount %s',
  value => {
    expect(() => waterToMilliliters({ value, unit: 'us-fl-oz' })).toThrow();
  },
);
test.each(['', '-5', '0', '1.2.3', '12kg', 'Infinity', '1e2'])(
  'rejects invalid input %s',
  value => {
    expect(parsePositiveDecimal(value)).toBeNull();
  },
);
test('accepts dot and comma decimal input', () => {
  expect(parsePositiveDecimal(' 72.5 ')).toBe(72.5);
  expect(parsePositiveDecimal('72,5')).toBe(72.5);
});
test.each([
  [20, 10],
  [120, 80],
  [200, 180],
])(
  'accepts Health Connect-compatible blood pressure %s/%s',
  (systolic, diastolic) => {
    expect(validateBloodPressure({ systolic, diastolic })).toEqual({
      systolic,
      diastolic,
    });
  },
);
test.each([
  [19, 10],
  [201, 80],
  [120, 9],
  [181, 181],
  [NaN, 80],
  [120, Infinity],
])('rejects invalid blood pressure %s/%s', (systolic, diastolic) => {
  expect(() => validateBloodPressure({ systolic, diastolic })).toThrow();
});
test('guard releases after rejection', async () => {
  const guard = createEntryGuard();
  await expect(
    guard(async () => {
      throw new Error('failed');
    }),
  ).rejects.toThrow('failed');
  const write = jest.fn().mockResolvedValue(undefined);
  await guard(write);
  expect(write).toHaveBeenCalledTimes(1);
});
test('unimplemented platform cannot acknowledge writes', async () => {
  await expect(
    unsupportedSystemHealth.getAvailability(),
  ).resolves.toMatchObject({ status: 'unavailable' });
  await expect(
    unsupportedSystemHealth.addWater({ value: 8, unit: 'us-fl-oz' }),
  ).rejects.toMatchObject({ code: 'unsupported' });
  await expect(
    unsupportedSystemHealth.addCaffeine({ milligrams: 95 }),
  ).rejects.toMatchObject({ code: 'unsupported' });
  await expect(
    unsupportedSystemHealth.addWeight({ value: 70, unit: 'kg' }),
  ).rejects.toMatchObject({ code: 'unsupported' });
  await expect(
    unsupportedSystemHealth.addBloodPressure({ systolic: 120, diastolic: 80 }),
  ).rejects.toMatchObject({ code: 'unsupported' });
});
