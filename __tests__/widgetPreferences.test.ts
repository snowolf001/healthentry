import NativeWidget from '../specs/NativeWidgetActions';
import {
  coffeeDefaultLabel,
  parseWidgetPreferences,
  validateMoveMinutes,
  validateWaterWidgetValue,
  widgetPreferences,
} from '../src/preferences/widgetPreferences';

jest.mock('../specs/NativeWidgetActions', () => ({
  __esModule: true,
  default: { loadPreferences: jest.fn(), savePreferences: jest.fn() },
}));

beforeEach(() => jest.resetAllMocks());

test('defaults malformed or missing native values safely', () => {
  expect(parseWidgetPreferences('{}')).toEqual({
    waterOz: 8,
    coffeeDefault: 'ask',
    moveMinutes: 5,
  });
  expect(parseWidgetPreferences('bad')).toEqual({
    waterOz: 8,
    coffeeDefault: 'ask',
  });
  expect(
    parseWidgetPreferences('{"waterOz":100,"coffeeDefault":"bad"}'),
  ).toEqual({ waterOz: 8, coffeeDefault: 'ask', moveMinutes: 5 });
});
test.each(['1', '5', '15', '240'])(
  'accepts move duration %s minutes',
  value => expect(validateMoveMinutes(value)).toBe(Number(value)),
);
test.each(['', '0', '1.5', '241', 'abc'])(
  'rejects invalid move duration %s',
  value => expect(() => validateMoveMinutes(value)).toThrow('1 and 240'),
);
test.each(['1', '8', '12', '16', '20', '24', '32.5', '99'])(
  'accepts reasonable custom water %s oz',
  value => expect(validateWaterWidgetValue(value)).toBe(Number(value)),
);
test.each(['', '0', '-1', 'abc', '1e2', '99.1', 'Infinity'])(
  'rejects invalid custom water %s',
  value =>
    expect(() => validateWaterWidgetValue(value)).toThrow('1 and 99 oz'),
);
test.each([
  ['ask', 'Ask Every Time'],
  ['coffee8', '8 oz Coffee'],
  ['coffee12', '12 oz Coffee'],
  ['coffee16', '16 oz Coffee'],
  ['espresso1', '1 shot Espresso'],
  ['espresso2', '2 shots Espresso'],
  ['espresso3', '3 shots Espresso'],
] as const)('labels %s as %s', (value, label) =>
  expect(coffeeDefaultLabel(value)).toBe(label),
);
test('native store is the single load/save boundary', async () => {
  jest
    .mocked(NativeWidget!.loadPreferences)
    .mockResolvedValue('{"waterOz":20,"coffeeDefault":"espresso2","moveMinutes":10}');
  expect(await widgetPreferences.load()).toEqual({
    waterOz: 20,
    coffeeDefault: 'espresso2',
    moveMinutes: 10,
  });
  jest.mocked(NativeWidget!.savePreferences).mockResolvedValue();
  await widgetPreferences.save({
    waterOz: 24,
    coffeeDefault: 'coffee12',
    moveMinutes: 7,
  });
  expect(NativeWidget!.savePreferences).toHaveBeenCalledWith(24, 'coffee12', 7);
});
