import React from 'react';
import { TextInput, BackHandler, AppState } from 'react-native';
import { ActionButton } from '../src/ui/ActionButton';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { systemHealth } from '../src/systemHealth';
import { weightPreferences } from '../src/preferences/weightPreferences';
import NativeWidget from '../specs/NativeWidgetActions';
jest.mock('../specs/NativeWidgetActions', () => ({
  __esModule: true,
  default: { loadPreferences: jest.fn(), savePreferences: jest.fn() },
}));
jest.mock('../src/preferences/weightPreferences', () => ({
  weightPreferences: { load: jest.fn(), save: jest.fn() },
  defaultWeightPreferences: { unit: 'lb', lastEnteredWeightKg: null },
  logPreferenceFailure: jest.fn(),
}));

jest.mock('../src/systemHealth', () => ({
  systemHealth: {
    getAvailability: jest.fn(),
    openSettings: jest.fn(),
    addWater: jest.fn(),
    addWeight: jest.fn(),
    addCaffeine: jest.fn(),
    addBloodPressure: jest.fn(),
    addExercise: jest.fn(),
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
let app: ReactTestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.resetAllMocks();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  jest
    .mocked(systemHealth.getAvailability)
    .mockResolvedValue({ status: 'available' });
  jest.mocked(systemHealth.openSettings).mockResolvedValue(undefined);
  jest
    .mocked(weightPreferences.load)
    .mockResolvedValue({ unit: 'lb', lastEnteredWeightKg: null });
  jest.mocked(weightPreferences.save).mockResolvedValue(undefined);
  jest
    .mocked(NativeWidget!.loadPreferences)
    .mockResolvedValue(JSON.stringify({ waterOz: 8, coffeeDefault: 'ask', moveMinutes: 5 }));
  jest.mocked(NativeWidget!.savePreferences).mockResolvedValue(undefined);
});
afterEach(async () => {
  if (app) {
    await act(async () => app.unmount());
  }
  jest.restoreAllMocks();
});
async function render() {
  await act(async () => {
    app = ReactTestRenderer.create(<App />);
  });
}
const button = (title: string) =>
  app.root
    .findAllByType(ActionButton)
    .find(
      node =>
        (node.props.detail
          ? node.props.title + ' · ' + node.props.detail
          : node.props.title) === title,
    )!;
const content = () => JSON.stringify(app.toJSON());
const accessibleButton = (label: string) =>
  app.root.findAll(
    node =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === label,
  )[0];

test('8 oz writes once during rapid taps, including a different water preset', async () => {
  let resolveWrite!: (value: { id: string; timestamp: string }) => void;
  jest.mocked(systemHealth.addWater).mockReturnValue(
    new Promise(resolve => {
      resolveWrite = resolve;
    }),
  );
  await render();
  const press8 = button('+8 oz').props.onPress;
  const press12 = button('+12 oz').props.onPress;
  let pending!: Promise<void>;
  await act(async () => {
    pending = press8();
    await press8();
    await press12();
  });
  expect(systemHealth.addWater).toHaveBeenCalledTimes(1);
  expect(systemHealth.addWater).toHaveBeenCalledWith({
    value: 8,
    unit: 'us-fl-oz',
  });
  expect(button('+8 oz').props.disabled).toBe(true);
  await act(async () => {
    resolveWrite({ id: 'native-id', timestamp: 'now' });
    await pending;
  });
  expect(content()).toContain('✓ Added 8 oz');
  expect(content()).not.toContain('native-id');
  expect(button('+8 oz').props.disabled).toBe(false);
});

test('12 oz uses the same boundary; errors release the guard for an explicit retry', async () => {
  jest
    .mocked(systemHealth.addWater)
    .mockRejectedValueOnce(new Error('Permission denied'))
    .mockResolvedValue({ id: 'id', timestamp: 'now' });
  await render();
  await act(async () => button('+12 oz').props.onPress());
  expect(content()).toContain('Error: Permission denied');
  expect(button('+12 oz').props.disabled).toBe(false);
  await act(async () => button('+12 oz').props.onPress());
  expect(content()).toContain('✓ Added 12 oz');
  expect(systemHealth.addWater).toHaveBeenLastCalledWith({
    value: 12,
    unit: 'us-fl-oz',
  });
});

test('Other water validates and writes an explicit custom amount', async () => {
  jest
    .mocked(systemHealth.addWater)
    .mockResolvedValue({ id: 'id', timestamp: 'now' });
  await render();
  await act(async () => button('Other').props.onPress());
  await act(async () => button('Add').props.onPress());
  expect(systemHealth.addWater).not.toHaveBeenCalled();
  const input = app.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel.startsWith('Water'))!;
  await act(async () => input.props.onChangeText('10'));
  await act(async () => button('Add').props.onPress());
  expect(systemHealth.addWater).toHaveBeenCalledWith({
    value: 10,
    unit: 'us-fl-oz',
  });
  expect(
    app.root.findAllByProps({
      accessibilityLabel: 'Water amount in US fluid ounces',
    }),
  ).toHaveLength(0);
});

test.each([
  ['Coffee', 95],
  ['Espresso', 63],
] as const)(
  'writes %s with an explicit amount and label',
  async (label, milligrams) => {
    jest
      .mocked(systemHealth.addCaffeine)
      .mockResolvedValue({ id: 'id', timestamp: 'now' });
    await render();
    await act(async () => button(label).props.onPress());
    expect(systemHealth.addCaffeine).not.toHaveBeenCalled();
    await act(async () =>
      button(
        label === 'Coffee' ? '8 oz · 95 mg' : '1 shot · 63 mg',
      ).props.onPress(),
    );
    expect(systemHealth.addCaffeine).toHaveBeenCalledWith({
      label,
      milligrams,
    });
    expect(content()).toContain(`(~${milligrams} mg caffeine)`);
  },
);

test('custom caffeine rejects invalid values and labels 95 mg as Caffeine, not Coffee', async () => {
  jest
    .mocked(systemHealth.addCaffeine)
    .mockResolvedValue({ id: 'id', timestamp: 'now' });
  await render();
  await act(async () =>
    app.root
      .findAllByType(ActionButton)
      .find(node => node.props.testID === 'other-caffeine')!
      .props.onPress(),
  );
  const input = app.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === 'Caffeine in milligrams')!;
  for (const text of ['', '0', '1001', 'abc']) {
    await act(async () => input.props.onChangeText(text));
    await act(async () => button('Add').props.onPress());
    expect(content()).toContain('between 1 and 1000 mg');
  }
  expect(systemHealth.addCaffeine).not.toHaveBeenCalled();
  await act(async () => input.props.onChangeText('95'));
  await act(async () => button('Add').props.onPress());
  expect(systemHealth.addCaffeine).toHaveBeenCalledWith({
    label: 'Caffeine',
    milligrams: 95,
  });
  expect(
    app.root.findAllByProps({ accessibilityLabel: 'Caffeine in milligrams' }),
  ).toHaveLength(0);
});

const weightField = () =>
  app.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel.startsWith('Weight in'))!;
const pressureField = (label: 'Systolic pressure' | 'Diastolic pressure') =>
  app.root.findAllByProps({ accessibilityLabel: label })[0];

test('Move writes the configured short exercise duration', async () => {
  jest
    .mocked(systemHealth.addExercise)
    .mockResolvedValue({ id: 'exercise-id', timestamp: 'now' });
  jest
    .mocked(NativeWidget!.loadPreferences)
    .mockResolvedValue(
      JSON.stringify({ waterOz: 8, coffeeDefault: 'ask', moveMinutes: 7 }),
    );
  await render();
  await act(async () => accessibleButton('Add exercise').props.onPress());
  expect(systemHealth.addExercise).toHaveBeenCalledWith({ minutes: 7 });
  expect(content()).toContain('✓ Added 7 min exercise');
});

test('valid blood pressure writes once and clears both fields after success', async () => {
  jest
    .mocked(systemHealth.addBloodPressure)
    .mockResolvedValue({ id: 'bp-id', timestamp: 'now' });
  await render();
  await act(async () =>
    pressureField('Systolic pressure').props.onChangeText('120'),
  );
  await act(async () =>
    pressureField('Diastolic pressure').props.onChangeText('80'),
  );
  await act(async () => accessibleButton('Add blood pressure').props.onPress());
  expect(systemHealth.addBloodPressure).toHaveBeenCalledWith({
    systolic: 120,
    diastolic: 80,
  });
  expect(content()).toContain('✓ Added 120/80 mmHg');
  expect(pressureField('Systolic pressure').props.value).toBe('');
  expect(pressureField('Diastolic pressure').props.value).toBe('');
});

test('blood pressure requires both values and validates ranges before writing', async () => {
  await render();
  await act(async () => accessibleButton('Add blood pressure').props.onPress());
  expect(content()).toContain('Enter systolic pressure.');
  await act(async () =>
    pressureField('Systolic pressure').props.onChangeText('120'),
  );
  await act(async () => accessibleButton('Add blood pressure').props.onPress());
  expect(content()).toContain('Enter diastolic pressure.');
  for (const [systolic, diastolic, message] of [
    ['19', '10', 'systolic pressure between 20 and 200'],
    ['201', '80', 'systolic pressure between 20 and 200'],
    ['120', '9', 'diastolic pressure between 10 and 180'],
    ['120', '181', 'diastolic pressure between 10 and 180'],
    ['80', '80', 'Systolic pressure must be higher'],
  ]) {
    await act(async () =>
      pressureField('Systolic pressure').props.onChangeText(systolic),
    );
    await act(async () =>
      pressureField('Diastolic pressure').props.onChangeText(diastolic),
    );
    await act(async () =>
      accessibleButton('Add blood pressure').props.onPress(),
    );
    expect(content()).toContain(message);
  }
  expect(systemHealth.addBloodPressure).not.toHaveBeenCalled();
});

test('failed blood pressure write retains values for retry', async () => {
  jest
    .mocked(systemHealth.addBloodPressure)
    .mockRejectedValue(new Error('Permission denied'));
  await render();
  await act(async () =>
    pressureField('Systolic pressure').props.onChangeText('130'),
  );
  await act(async () =>
    pressureField('Diastolic pressure').props.onChangeText('85'),
  );
  await act(async () => accessibleButton('Add blood pressure').props.onPress());
  expect(content()).toContain('Error: Permission denied');
  expect(pressureField('Systolic pressure').props.value).toBe('130');
  expect(pressureField('Diastolic pressure').props.value).toBe('85');
});

test('pending blood pressure suppresses rapid and cross-type writes', async () => {
  let resolve!: (value: { id: string; timestamp: string }) => void;
  jest.mocked(systemHealth.addBloodPressure).mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  await render();
  await act(async () =>
    pressureField('Systolic pressure').props.onChangeText('120'),
  );
  await act(async () =>
    pressureField('Diastolic pressure').props.onChangeText('80'),
  );
  const press = accessibleButton('Add blood pressure').props.onPress;
  let pending!: Promise<void>;
  await act(async () => {
    pending = press();
    await press();
    await button('+8 oz').props.onPress();
  });
  expect(systemHealth.addBloodPressure).toHaveBeenCalledTimes(1);
  expect(systemHealth.addWater).not.toHaveBeenCalled();
  await act(async () => {
    resolve({ id: 'bp-id', timestamp: 'now' });
    await pending;
  });
});

test('defaults to lb, converts units without rounding canonical kg, and remembers success', async () => {
  jest
    .mocked(systemHealth.addWeight)
    .mockResolvedValue({ id: 'id', timestamp: 'now' });
  await render();
  expect(weightField().props.accessibilityLabel).toBe('Weight in pounds');
  await act(async () => weightField().props.onChangeText('165.2'));
  await act(async () => button('lb').props.onPress());
  expect(weightField().props.value).toBe('74.9');
  await act(async () => button('Add').props.onPress());
  expect(systemHealth.addWeight).toHaveBeenCalledWith({
    value: 74.933459524,
    unit: 'kg',
  });
  expect(weightPreferences.save).toHaveBeenLastCalledWith({
    unit: 'kg',
    lastEnteredWeightKg: 74.933459524,
  });
  expect(content()).toContain('✓ Added 74.9 kg');
  await act(async () => button('kg').props.onPress());
  expect(weightField().props.value).toBe('165.2');
  expect(content()).toContain('✓ Added 74.9 kg');
});

test('loads preferred kg and prefills the last successful canonical weight', async () => {
  jest
    .mocked(weightPreferences.load)
    .mockResolvedValue({ unit: 'kg', lastEnteredWeightKg: 74.933459524 });
  await render();
  expect(weightField().props.accessibilityLabel).toBe('Weight in kilograms');
  expect(weightField().props.value).toBe('74.9');
  expect(systemHealth.addWeight).not.toHaveBeenCalled();
  expect(weightPreferences.save).not.toHaveBeenCalled();
});

test('a denied health write does not update the last successful preference', async () => {
  jest
    .mocked(systemHealth.addWeight)
    .mockRejectedValue(new Error('Permission denied'));
  await render();
  await act(async () => weightField().props.onChangeText('165.2'));
  await act(async () => button('Add').props.onPress());
  expect(content()).toContain('Error: Permission denied');
  expect(weightPreferences.save).not.toHaveBeenCalled();
  expect(weightField().props.value).toBe('165.2');
});

test('preference failure preserves health success and never retries the write', async () => {
  jest
    .mocked(systemHealth.addWeight)
    .mockResolvedValue({ id: 'id', timestamp: 'now' });
  jest.mocked(weightPreferences.save).mockRejectedValue(new Error('disk full'));
  await render();
  await act(async () => weightField().props.onChangeText('165.2'));
  await act(async () => button('Add').props.onPress());
  expect(content()).toContain('✓ Added 165.2 lb');
  expect(content()).not.toContain('Error:');
  expect(systemHealth.addWeight).toHaveBeenCalledTimes(1);
  expect(weightPreferences.save).toHaveBeenCalledTimes(1);
});

test('invalid weight never writes or changes last weight', async () => {
  await render();
  for (const text of ['', '19.9', '1000.1', 'abc']) {
    await act(async () => weightField().props.onChangeText(text));
    await act(async () => button('Add').props.onPress());
    expect(content()).toContain('Enter weight within 22.0–992.1 lb');
  }
  expect(systemHealth.addWeight).not.toHaveBeenCalled();
  expect(weightPreferences.save).not.toHaveBeenCalled();
});

test.each(['caffeine', 'weight'] as const)(
  'pending %s suppresses repeated and cross-type taps',
  async kind => {
    let resolve!: (value: { id: string; timestamp: string }) => void;
    const pending = new Promise<{ id: string; timestamp: string }>(done => {
      resolve = done;
    });
    jest.mocked(systemHealth.addCaffeine).mockReturnValue(pending);
    jest.mocked(systemHealth.addWeight).mockReturnValue(pending);
    await render();
    await act(async () => weightField().props.onChangeText('165.2'));
    if (kind === 'caffeine')
      await act(async () => button('Coffee').props.onPress());
    const press = button(kind === 'caffeine' ? '8 oz · 95 mg' : 'Add').props
      .onPress;
    const water = button('+8 oz').props.onPress;
    let task!: Promise<void>;
    await act(async () => {
      task = press();
      await press();
      await water();
    });
    expect(systemHealth.addWater).not.toHaveBeenCalled();
    expect(
      kind === 'caffeine' ? systemHealth.addCaffeine : systemHealth.addWeight,
    ).toHaveBeenCalledTimes(1);
    expect(button('Add').props.disabled).toBe(true);
    await act(async () => {
      resolve({ id: 'id', timestamp: 'now' });
      await task;
    });
    expect(content()).toContain('✓ Added');
  },
);

test('load failure falls back to lb and does not block health entry', async () => {
  jest
    .mocked(weightPreferences.load)
    .mockRejectedValue(new Error('broken storage'));
  await render();
  expect(weightField().props.accessibilityLabel).toBe('Weight in pounds');
  expect(button('Add').props.disabled).toBe(false);
});

test('Settings changes the persisted weight unit while retaining canonical draft and success', async () => {
  jest
    .mocked(systemHealth.addWeight)
    .mockResolvedValue({ id: 'id', timestamp: 'now' });
  await render();
  expect(systemHealth.getAvailability).not.toHaveBeenCalled();
  await act(async () => weightField().props.onChangeText('165.2'));
  await act(async () => button('Add').props.onPress());
  await act(async () => accessibleButton('Open Settings').props.onPress());
  expect(content()).toContain('Available');
  await act(async () => button('kg').props.onPress());
  expect(weightPreferences.save).toHaveBeenLastCalledWith({
    unit: 'kg',
    lastEnteredWeightKg: 74.933459524,
  });
  expect(button('kg').props.selected).toBe(true);
  await act(async () => accessibleButton('Back to Home').props.onPress());
  expect(weightField().props.value).toBe('74.9');
  expect(content()).toContain('✓ Added 165.2 lb');
  await act(async () => button('Add').props.onPress());
  expect(systemHealth.addWeight).toHaveBeenLastCalledWith({
    value: 74.933459524,
    unit: 'kg',
  });
});
test('Settings provider action and Privacy never write health data', async () => {
  await render();
  await act(async () => accessibleButton('Open Settings').props.onPress());
  await act(async () =>
    accessibleButton('Manage Health Connect access').props.onPress(),
  );
  expect(systemHealth.openSettings).toHaveBeenCalledTimes(1);
  await act(async () => accessibleButton('Privacy Policy').props.onPress());
  expect(content()).toContain('production privacy policy URL');
  await act(async () => accessibleButton('Back to Settings').props.onPress());
  expect(content()).toContain('UNITS');
  expect(systemHealth.addWater).not.toHaveBeenCalled();
  expect(systemHealth.addCaffeine).not.toHaveBeenCalled();
  expect(systemHealth.addWeight).not.toHaveBeenCalled();
});
test('Settings reports unavailable provider and opening errors inline', async () => {
  jest.mocked(systemHealth.getAvailability).mockResolvedValue({
    status: 'unavailable',
    message: 'Provider unavailable',
  });
  await render();
  await act(async () => accessibleButton('Open Settings').props.onPress());
  expect(content()).toContain('Provider unavailable');
  expect(accessibleButton('Manage Health Connect access').props.disabled).toBe(
    true,
  );
  await act(async () => accessibleButton('Back to Home').props.onPress());
  jest
    .mocked(systemHealth.getAvailability)
    .mockResolvedValue({ status: 'available' });
  jest
    .mocked(systemHealth.openSettings)
    .mockRejectedValue(new Error('Could not open settings'));
  await act(async () => accessibleButton('Open Settings').props.onPress());
  await act(async () =>
    accessibleButton('Manage Health Connect access').props.onPress(),
  );
  expect(content()).toContain('Could not open settings');
});

test('Android back returns through Privacy, Settings, and Home', async () => {
  let back!: () => boolean;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, listener) => {
      back = listener as () => boolean;
      return { remove: jest.fn() };
    });
  await render();
  await act(async () => accessibleButton('Open Settings').props.onPress());
  await act(async () => accessibleButton('Privacy Policy').props.onPress());
  await act(async () => {
    expect(back()).toBe(true);
  });
  expect(content()).toContain('UNITS');
  await act(async () => {
    expect(back()).toBe(true);
  });
  expect(accessibleButton('Open Settings')).toBeDefined();
  expect(back()).toBe(false);
});
test('quick actions have accessible labels and pressed/disabled styles', async () => {
  await render();
  const coffee = button('Coffee').findAll(
    node =>
      node.props.accessibilityRole === 'button' &&
      typeof node.props.style === 'function',
  )[0];
  expect(coffee.props.accessibilityLabel).toBe('Coffee');
  expect(coffee.props.accessibilityState.disabled).toBe(false);
  expect(coffee.props.style({ pressed: true })).not.toEqual(
    coffee.props.style({ pressed: false }),
  );
});

test('Settings saves every Water widget preset and a valid custom amount', async () => {
  await render();
  await act(async () => accessibleButton('Open Settings').props.onPress());
  let current = 8;
  for (const value of [12, 16, 20, 24] as const) {
    await act(async () =>
      accessibleButton(`Water Widget Default, ${current} oz`).props.onPress(),
    );
    await act(async () => button(`${value} oz`).props.onPress());
    expect(NativeWidget!.savePreferences).toHaveBeenLastCalledWith(value, 'ask', 5);
    current = value;
  }
  await act(async () =>
    accessibleButton('Water Widget Default, 24 oz').props.onPress(),
  );
  await act(async () => button('Custom').props.onPress());
  const custom = app.root.findByProps({
    accessibilityLabel: 'Custom water widget amount in ounces',
  });
  await act(async () => custom.props.onChangeText('32'));
  await act(async () => button('Save').props.onPress());
  expect(NativeWidget!.savePreferences).toHaveBeenLastCalledWith(32, 'ask', 5);
  expect(accessibleButton('Water Widget Default, 32 oz')).toBeDefined();
});

test('Settings rejects invalid custom Water widget values', async () => {
  await render();
  await act(async () => accessibleButton('Open Settings').props.onPress());
  await act(async () =>
    accessibleButton('Water Widget Default, 8 oz').props.onPress(),
  );
  await act(async () => button('Custom').props.onPress());
  const custom = app.root.findByProps({
    accessibilityLabel: 'Custom water widget amount in ounces',
  });
  for (const value of ['0', '-1', 'abc', '100']) {
    await act(async () => custom.props.onChangeText(value));
    await act(async () => button('Save').props.onPress());
    expect(content()).toContain('between 1 and 99 oz');
  }
  expect(NativeWidget!.savePreferences).not.toHaveBeenCalled();
});

test.each([
  ['Ask Every Time', 'ask'],
  ['8 oz Coffee', 'coffee8'],
  ['12 oz Coffee', 'coffee12'],
  ['16 oz Coffee', 'coffee16'],
  ['1 shot Espresso', 'espresso1'],
  ['2 shots Espresso', 'espresso2'],
  ['3 shots Espresso', 'espresso3'],
] as const)(
  'Settings persists Coffee widget default %s',
  async (label, value) => {
    await render();
    await act(async () => accessibleButton('Open Settings').props.onPress());
    await act(async () =>
      accessibleButton('Coffee Widget Default, Ask Every Time').props.onPress(),
    );
    await act(async () => button(label).props.onPress());
    expect(NativeWidget!.savePreferences).toHaveBeenCalledWith(8, value, 5);
    expect(accessibleButton(`Coffee Widget Default, ${label}`)).toBeDefined();
  },
);

test.each([
  ['Coffee', '12 oz · ~140 mg', 140],
  ['Coffee', '16 oz · ~190 mg', 190],
  ['Espresso', '2 shots · 126 mg', 126],
  ['Espresso', '3 shots · 189 mg', 189],
] as const)(
  'Home %s %s saves immediately and collapses the picker',
  async (label, preset, milligrams) => {
    await render();
    await act(async () => button(label).props.onPress());
    expect(systemHealth.addCaffeine).not.toHaveBeenCalled();
    await act(async () => button(preset).props.onPress());
    expect(systemHealth.addCaffeine).toHaveBeenCalledTimes(1);
    expect(systemHealth.addCaffeine).toHaveBeenCalledWith({
      label,
      milligrams,
    });
    expect(button(preset)).toBeUndefined();
  },
);

test.each([
  ['Coffee', '10', 120],
  ['Espresso', '1.5', 94.5],
] as const)(
  'Home custom %s shows estimate and requires Add',
  async (label, value, milligrams) => {
    await render();
    await act(async () => button(label).props.onPress());
    await act(async () =>
      accessibleButton(`Other ${label.toLowerCase()}`).props.onPress(),
    );
    const input = app.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel.startsWith(`${label} in`))!;
    await act(async () => input.props.onChangeText(value));
    expect(content()).toContain(`~${milligrams} mg caffeine`);
    expect(systemHealth.addCaffeine).not.toHaveBeenCalled();
    await act(async () => button('Add').props.onPress());
    expect(systemHealth.addCaffeine).toHaveBeenCalledWith({
      label,
      milligrams,
    });
  },
);
