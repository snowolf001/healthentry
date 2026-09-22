import { caffeineEntry } from '../src/home/caffeine';

test.each([
  ['Coffee', '8', 95],
  ['Coffee', '12', 140],
  ['Coffee', '16', 190],
  ['Coffee', '10', 120],
  ['Coffee', '20', 235],
  ['Espresso', '1', 63],
  ['Espresso', '2', 126],
  ['Espresso', '3', 189],
  ['Espresso', '4', 252],
  ['Espresso', '1,5', 94.5],
  ['Caffeine', '125.5', 125.5],
] as const)('%s %s converts to %s mg', (kind, text, milligrams) => {
  expect(caffeineEntry(kind, text).input).toEqual({ label: kind, milligrams });
  expect(caffeineEntry(kind, text).success).toContain(
    `${milligrams} mg caffeine`,
  );
});

test.each(['Coffee', 'Espresso', 'Caffeine'] as const)(
  '%s rejects malformed and unreasonable inputs',
  kind => {
    for (const text of [
      '',
      '0',
      '-1',
      'abc',
      'NaN',
      'Infinity',
      '1e2',
      '12oz',
      '1.2.3',
      '1001',
    ]) {
      expect(() => caffeineEntry(kind, text)).toThrow();
    }
  },
);
test('custom limits reject values outside supported input ranges', () => {
  for (const value of ['0.99', '64.01'])
    expect(() => caffeineEntry('Coffee', value)).toThrow('1 and 64 oz');
  for (const value of ['0.24', '15.01'])
    expect(() => caffeineEntry('Espresso', value)).toThrow('0.25 and 15 shots');
  expect(caffeineEntry('Coffee', '64').input.milligrams).toBe(760);
  expect(caffeineEntry('Espresso', '15').input.milligrams).toBe(945);
});
