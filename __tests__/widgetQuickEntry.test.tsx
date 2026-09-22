import React from 'react';
import { AppState, Linking, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  getSdkStatus,
  initialize,
  getGrantedPermissions,
  insertRecords,
} from 'react-native-health-connect';
import WidgetEntry from '../src/widget/WidgetEntry';
import NativeWidget from '../specs/NativeWidgetActions';
import NativePermissions from '../specs/NativeHealthPermissions';
import { weightPreferences } from '../src/preferences/weightPreferences';
import { runHealthEntry } from '../src/home/entry';
import { submitWidgetEntry } from '../src/widget/widgetSubmission';

jest.mock('../src/systemHealth', () => ({
  systemHealth: jest.requireActual('../src/systemHealth/androidHealthConnect')
    .androidSystemHealth,
}));
jest.mock('react-native-health-connect', () => ({
  getSdkStatus: jest.fn(),
  initialize: jest.fn(),
  getGrantedPermissions: jest.fn(),
  insertRecords: jest.fn(),
  openHealthConnectSettings: jest.fn(),
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
    SDK_AVAILABLE: 3,
  },
  MealType: { UNKNOWN: 0 },
  RecordingMethod: { RECORDING_METHOD_MANUAL_ENTRY: 3 },
  BloodPressureBodyPosition: { UNKNOWN: 0 },
  BloodPressureMeasurementLocation: { UNKNOWN: 0 },
}));
jest.mock('../specs/NativeHealthPermissions', () => ({
  __esModule: true,
  default: { requestWritePermission: jest.fn() },
}));
jest.mock('../specs/NativeWidgetActions', () => ({
  __esModule: true,
  default: {
    consumeLaunch: jest.fn(),
    beginWrite: jest.fn(),
    endWrite: jest.fn(),
    finish: jest.fn(),
  },
}));
jest.mock('../src/preferences/weightPreferences', () => ({
  weightPreferences: { load: jest.fn(), save: jest.fn() },
  defaultWeightPreferences: { unit: 'lb', lastEnteredWeightKg: null },
  logPreferenceFailure: jest.fn(),
}));
let app: ReactTestRenderer.ReactTestRenderer;
let action: string | null;
const id = 'session';
let consumed: Set<string>;
const content = () => JSON.stringify(app.toJSON());
const field = () => app.root.findByType(TextInput);
const button = (label: string) =>
  app.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest
    .spyOn(Linking, 'getInitialURL')
    .mockResolvedValue('healthentry-widget://water');
  jest.spyOn(Linking, 'addEventListener');
  jest.spyOn(AppState, 'addEventListener');
  consumed = new Set();
  action = 'water';
  jest.mocked(NativeWidget!.consumeLaunch).mockImplementation(async session => {
    if (consumed.has(session)) {
      return null;
    }
    consumed.add(session);
    return action;
  });
  jest.mocked(NativeWidget!.beginWrite).mockResolvedValue(true);
  jest.mocked(NativeWidget!.endWrite).mockResolvedValue(undefined);
  jest.mocked(NativeWidget!.finish).mockResolvedValue(undefined);
  jest
    .mocked(NativePermissions!.requestWritePermission)
    .mockResolvedValue(true);
  jest.mocked(getSdkStatus).mockResolvedValue(3);
  jest.mocked(initialize).mockResolvedValue(true);
  jest.mocked(getGrantedPermissions).mockResolvedValue([]);
  jest.mocked(insertRecords).mockResolvedValue(['record']);
  jest
    .mocked(weightPreferences.load)
    .mockResolvedValue({ unit: 'lb', lastEnteredWeightKg: null });
  jest.mocked(weightPreferences.save).mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => app?.unmount());
  jest.restoreAllMocks();
});
async function render(sessionId = id) {
  await act(async () => {
    app = ReactTestRenderer.create(<WidgetEntry sessionId={sessionId} />);
  });
}
const cases = [
  ['water', 'Hydration', 'Added 8 oz water'],
  ['coffee', 'Nutrition', 'Added 95 mg caffeine'],
] as const;
function expectRecord(type: string) {
  expect(insertRecords).toHaveBeenCalledTimes(1);
  expect(insertRecords).toHaveBeenCalledWith([
    expect.objectContaining(
      type === 'Hydration'
        ? {
            recordType: 'Hydration',
            volume: { value: 236.6, unit: 'milliliters' },
          }
        : {
            recordType: 'Nutrition',
            name: 'Coffee',
            caffeine: { value: 95, unit: 'milligrams' },
          },
    ),
  ]);
}
describe.each(cases)('%s quick widget', (preset, type, success) => {
  test('already granted writes once, Toasts, and closes without mounting Home', async () => {
    action = preset;
    jest
      .mocked(getGrantedPermissions)
      .mockResolvedValue([{ accessType: 'write', recordType: type }]);
    await render();
    expectRecord(type);
    expect(NativePermissions!.requestWritePermission).not.toHaveBeenCalled();
    expect(NativeWidget!.finish).toHaveBeenCalledWith(id, success);
    expect(content()).not.toMatch(/BLOOD PRESSURE|Settings|CAFFEINE/);
    expect(Linking.getInitialURL).not.toHaveBeenCalled();
    await act(async () => app.unmount());
    await render(); // Replay/JS remount must not resubmit.
    expectRecord(type);
  });
  test('permission grant continues the original request exactly once', async () => {
    action = preset;
    let grant!: (allowed: boolean) => void;
    jest
      .mocked(NativePermissions!.requestWritePermission)
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            grant = resolve;
          }),
      );
    await render();
    expect(NativePermissions!.requestWritePermission).toHaveBeenCalledWith(
      type,
    );
    expect(insertRecords).not.toHaveBeenCalled();
    await act(async () => app.update(<WidgetEntry sessionId={id} />));
    expect(NativePermissions!.requestWritePermission).toHaveBeenCalledTimes(1);
    await act(async () => grant(true));
    expectRecord(type);
    expect(NativeWidget!.finish).toHaveBeenCalledWith(id, success);
  });
  test.each(['denied', 'cancelled'] as const)(
    '%s permission produces no record and closes with failure Toast',
    async outcome => {
      action = preset;
      if (outcome === 'denied') {
        jest
          .mocked(NativePermissions!.requestWritePermission)
          .mockResolvedValue(false);
      } else {
        jest
          .mocked(NativePermissions!.requestWritePermission)
          .mockRejectedValue(new Error('Permission request cancelled'));
      }
      await render();
      expect(insertRecords).not.toHaveBeenCalled();
      expect(NativeWidget!.finish).toHaveBeenCalledWith(
        id,
        'Permission not granted. Nothing added.',
      );
      await act(async () => app.unmount());
      await render();
      expect(NativePermissions!.requestWritePermission).toHaveBeenCalledTimes(
        1,
      );
      expect(insertRecords).not.toHaveBeenCalled();
    },
  );
  test.each(['rejected', 'missing receipt'] as const)(
    'ambiguous %s never retries',
    async failure => {
      action = preset;
      if (failure === 'rejected') {
        jest
          .mocked(insertRecords)
          .mockRejectedValueOnce(new Error('interrupted'));
      } else {
        jest.mocked(insertRecords).mockResolvedValueOnce([]);
      }
      await render();
      expect(insertRecords).toHaveBeenCalledTimes(1);
      expect(NativeWidget!.finish).toHaveBeenCalledWith(
        id,
        'Save not confirmed. Check Health Connect before retrying.',
      );
      await act(async () => app.unmount());
      await render();
      expect(insertRecords).toHaveBeenCalledTimes(1);
    },
  );
});

test.each(['lb', 'kg'] as const)(
  'Weight uses saved %s preference, canonical value, and explicit Add only',
  async unit => {
    action = 'weight';
    jest
      .mocked(weightPreferences.load)
      .mockResolvedValue({ unit, lastEnteredWeightKg: 75 });
    await render();
    expect(field().props.value).toBe(unit === 'lb' ? '165.3' : '75');
    expect(field().props.keyboardType).toBe('decimal-pad');
    expect(field().instance.focus).toHaveBeenCalled();
    expect(getSdkStatus).not.toHaveBeenCalled();
    expect(insertRecords).not.toHaveBeenCalled();
    await act(async () => button('Add weight').props.onPress());
    expect(NativePermissions!.requestWritePermission).toHaveBeenCalledWith(
      'Weight',
    );
    expect(insertRecords).toHaveBeenCalledWith([
      expect.objectContaining({
        recordType: 'Weight',
        weight: { value: 75, unit: 'kilograms' },
      }),
    ]);
    expect(NativeWidget!.finish).toHaveBeenCalledWith(
      id,
      unit === 'lb' ? 'Added 165.3 lb' : 'Added 75 kg',
    );
    expect(weightPreferences.save).toHaveBeenCalledWith({
      unit,
      lastEnteredWeightKg: 75,
    });
  },
);

test('Weight Cancel creates no record and does not save the draft', async () => {
  action = 'weight';
  await render();
  await act(async () => field().props.onChangeText('171.3'));
  await act(async () => button('Cancel weight entry').props.onPress());
  expect(NativeWidget!.finish).toHaveBeenCalledWith(id, '');
  expect(insertRecords).not.toHaveBeenCalled();
  expect(NativePermissions!.requestWritePermission).not.toHaveBeenCalled();
  expect(weightPreferences.save).not.toHaveBeenCalled();
});

test('Weight validates, preserves failed input, and only retries on an explicit Add', async () => {
  action = 'weight';
  await render();
  await act(async () => field().props.onChangeText('0'));
  await act(async () => button('Add weight').props.onPress());
  expect(NativeWidget!.beginWrite).not.toHaveBeenCalled();
  expect(content()).toContain('Enter weight within');
  await act(async () => field().props.onChangeText('171.3'));
  jest
    .mocked(NativePermissions!.requestWritePermission)
    .mockResolvedValueOnce(false);
  await act(async () => button('Add weight').props.onPress());
  expect(field().props.value).toBe('171.3');
  expect(content()).toContain('Permission not granted');
  expect(insertRecords).not.toHaveBeenCalled();
  expect(NativeWidget!.finish).not.toHaveBeenCalled();
  await act(async () => button('Add weight').props.onPress());
  expect(insertRecords).toHaveBeenCalledWith([
    expect.objectContaining({
      weight: { value: 171.3 * 0.45359237, unit: 'kilograms' },
    }),
  ]);
  expect(NativeWidget!.finish).toHaveBeenCalledWith(id, 'Added 171.3 lb');
});

test('rapid Weight Add presses and a concurrent widget operation share one pending guard', async () => {
  action = 'weight';
  let grant!: (allowed: boolean) => void;
  jest.mocked(NativePermissions!.requestWritePermission).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        grant = resolve;
      }),
  );
  await render();
  await act(async () => field().props.onChangeText('171.3'));
  const add = button('Add weight').props.onPress;
  let submission!: Promise<void>;
  const other = jest.fn();
  await act(async () => {
    submission = add();
    add();
  });
  expect(NativePermissions!.requestWritePermission).toHaveBeenCalledTimes(1);
  expect(await runHealthEntry(other)).toBe(false);
  expect(await submitWidgetEntry('other', other, 'Added')).toContain(
    'Another entry',
  );
  expect(other).not.toHaveBeenCalled();
  await act(async () => {
    grant(true);
    await submission;
  });
  expect(insertRecords).toHaveBeenCalledTimes(1);
});

test('failed native session admission never accesses health', async () => {
  jest.mocked(NativeWidget!.beginWrite).mockResolvedValue(false);
  await render();
  expect(getSdkStatus).not.toHaveBeenCalled();
  expect(insertRecords).not.toHaveBeenCalled();
});

test('a restored/consumed launch and ordinary resume notifications never submit', async () => {
  action = null;
  await render();
  expect(getSdkStatus).not.toHaveBeenCalled();
  expect(insertRecords).not.toHaveBeenCalled();
  expect(Linking.addEventListener).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
});

test('StrictMode effect replay consumes one native launch and inserts once', async () => {
  await act(async () => {
    app = ReactTestRenderer.create(
      <React.StrictMode>
        <WidgetEntry sessionId={id} />
      </React.StrictMode>,
    );
  });
  expect(NativeWidget!.consumeLaunch).toHaveBeenCalledTimes(1);
  expect(insertRecords).toHaveBeenCalledTimes(1);
});

test('Weight insertion failure preserves the edited value and requires an explicit retry', async () => {
  action = 'weight';
  await render();
  await act(async () => field().props.onChangeText('171.3'));
  jest.mocked(insertRecords).mockRejectedValueOnce(new Error('interrupted'));
  await act(async () => button('Add weight').props.onPress());
  expect(field().props.value).toBe('171.3');
  expect(content()).toContain('Check Health Connect before retrying');
  expect(NativeWidget!.finish).not.toHaveBeenCalled();
  expect(weightPreferences.save).not.toHaveBeenCalled();
  await act(async () => app.update(<WidgetEntry sessionId={id} />));
  expect(insertRecords).toHaveBeenCalledTimes(1);
});
