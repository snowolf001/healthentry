import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  getGrantedPermissions,
  requestPermission,
  insertRecords,
  openHealthConnectSettings,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { androidSystemHealth } from '../src/systemHealth/androidHealthConnect';
const addWater = () =>
  androidSystemHealth.addWater({ value: 8, unit: 'us-fl-oz' });

jest.mock('react-native-health-connect', () => ({
  getSdkStatus: jest.fn(),
  initialize: jest.fn(),
  getGrantedPermissions: jest.fn(),
  requestPermission: jest.fn(),
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
// Adapt the existing native permission transport mock to the Activity-owned bridge.
jest.mock('../specs/NativeHealthPermissions', () => ({
  __esModule: true,
  default: {
    requestWritePermission: async (recordType: string) => {
      const granted = await jest
        .requireMock('react-native-health-connect')
        .requestPermission([{ accessType: 'write', recordType }]);
      return granted.some(
        (p: { accessType: string; recordType: string }) =>
          p.accessType === 'write' && p.recordType === recordType,
      );
    },
  },
}));
const permission = { accessType: 'write', recordType: 'Hydration' } as const;
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  jest
    .mocked(getSdkStatus)
    .mockResolvedValue(SdkAvailabilityStatus.SDK_AVAILABLE);
  jest.mocked(initialize).mockResolvedValue(true);
  jest.mocked(getGrantedPermissions).mockResolvedValue([]);
  jest.mocked(requestPermission).mockResolvedValue([permission]);
  jest.mocked(insertRecords).mockResolvedValue(['record-123']);
});
afterEach(() => jest.restoreAllMocks());

test('requests only hydration write and inserts one 236.6 mL manual record ending now', async () => {
  const now = Date.parse('2026-09-21T12:00:00.000Z');
  jest.spyOn(Date, 'now').mockReturnValue(now);
  await expect(addWater()).resolves.toEqual({
    id: 'record-123',
    timestamp: new Date(now).toISOString(),
  });
  expect(requestPermission).toHaveBeenCalledWith([permission]);
  expect(insertRecords).toHaveBeenCalledTimes(1);
  expect(insertRecords).toHaveBeenCalledWith([
    {
      recordType: 'Hydration',
      volume: { value: 236.6, unit: 'milliliters' },
      startTime: new Date(now - 1000).toISOString(),
      endTime: new Date(now).toISOString(),
      metadata: { recordingMethod: 3 },
    },
  ]);
});
test.each([1, 2])(
  'does not initialize, request, or write when unavailable (%s)',
  async status => {
    jest.mocked(getSdkStatus).mockResolvedValue(status);
    await expect(addWater()).rejects.toThrow(/Health Connect/);
    expect(initialize).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(insertRecords).not.toHaveBeenCalled();
  },
);
test('does not write after denial or cancellation', async () => {
  jest.mocked(requestPermission).mockResolvedValue([]);
  await expect(addWater()).rejects.toThrow(/not granted/);
  expect(insertRecords).not.toHaveBeenCalled();
});
test('checks permission again on every tap, including after revocation', async () => {
  jest.mocked(getGrantedPermissions).mockResolvedValueOnce([permission]);
  await addWater();
  expect(requestPermission).not.toHaveBeenCalled();
  jest.mocked(requestPermission).mockResolvedValue([]);
  await expect(addWater()).rejects.toThrow(/not granted/);
  expect(getGrantedPermissions).toHaveBeenCalledTimes(2);
  expect(insertRecords).toHaveBeenCalledTimes(1);
});
test('propagates write errors without retrying', async () => {
  jest
    .mocked(insertRecords)
    .mockRejectedValue(new Error('Native write failed'));
  await expect(addWater()).rejects.toThrow('Native write failed');
  expect(insertRecords).toHaveBeenCalledTimes(1);
});
test('does not claim success without a record ID', async () => {
  jest.mocked(insertRecords).mockResolvedValue([]);
  await expect(addWater()).rejects.toThrow(/record ID/);
});
test('does not request permission when initialization fails', async () => {
  jest.mocked(initialize).mockResolvedValue(false);
  await expect(addWater()).rejects.toThrow(/initialize/);
  expect(requestPermission).not.toHaveBeenCalled();
});

test('12 oz uses the existing hydration capability only', async () => {
  await androidSystemHealth.addWater({ value: 12, unit: 'us-fl-oz' });
  expect(insertRecords).toHaveBeenCalledWith([
    expect.objectContaining({
      recordType: 'Hydration',
      volume: { value: 354.9, unit: 'milliliters' },
    }),
  ]);
  expect(requestPermission).toHaveBeenCalledWith([permission]);
});
test('authorization status does not prompt, authorization request does', async () => {
  await expect(
    androidSystemHealth.getAuthorizationStatus('water'),
  ).resolves.toBe('not-granted');
  expect(requestPermission).not.toHaveBeenCalled();
  await expect(androidSystemHealth.requestAuthorization('water')).resolves.toBe(
    'granted',
  );
  expect(insertRecords).not.toHaveBeenCalled();
});
test('invalid water is rejected before native access', async () => {
  await expect(
    androidSystemHealth.addWater({ value: -1, unit: 'mL' }),
  ).rejects.toThrow();
  expect(getSdkStatus).not.toHaveBeenCalled();
});

describe('V1 Health Connect writes', () => {
  const actions = [
    [
      'water',
      'Hydration',
      () => androidSystemHealth.addWater({ value: 8, unit: 'us-fl-oz' }),
    ],
    [
      'caffeine',
      'Nutrition',
      () =>
        androidSystemHealth.addCaffeine({ milligrams: 95, label: 'Coffee' }),
    ],
    [
      'weight',
      'Weight',
      () => androidSystemHealth.addWeight({ value: 165.2, unit: 'lb' }),
    ],
    [
      'bloodPressure',
      'BloodPressure',
      () =>
        androidSystemHealth.addBloodPressure({ systolic: 120, diastolic: 80 }),
    ],
  ] as const;

  test.each(actions)(
    '%s requests only its own WRITE permission',
    async (input, recordType, write) => {
      const ownPermission = { accessType: 'write' as const, recordType };
      jest.mocked(requestPermission).mockResolvedValue([ownPermission]);
      // Unrelated write and own read grants must not count as authorization.
      jest.mocked(getGrantedPermissions).mockResolvedValue([
        { accessType: 'read', recordType },
        {
          accessType: 'write',
          recordType: recordType === 'Weight' ? 'Hydration' : 'Weight',
        },
      ]);
      await write();
      expect(requestPermission).toHaveBeenCalledWith([ownPermission]);
      expect(insertRecords).toHaveBeenCalledTimes(1);
      expect(getSdkStatus).toHaveBeenCalledTimes(1);
      expect(await androidSystemHealth.getAuthorizationStatus(input)).toBe(
        'not-granted',
      );
      expect(requestPermission).toHaveBeenCalledTimes(1);
    },
  );
  test.each(actions)(
    '%s granted permission skips the prompt',
    async (_input, recordType, write) => {
      jest
        .mocked(getGrantedPermissions)
        .mockResolvedValue([{ accessType: 'write', recordType }]);
      await write();
      expect(requestPermission).not.toHaveBeenCalled();
      expect(insertRecords).toHaveBeenCalledTimes(1);
    },
  );
  test.each(actions)(
    '%s denial stops insertion',
    async (_input, _recordType, write) => {
      jest.mocked(requestPermission).mockResolvedValue([]);
      await expect(write()).rejects.toThrow('not granted');
      expect(insertRecords).not.toHaveBeenCalled();
    },
  );
  test.each(actions)(
    '%s ambiguous acknowledgment never succeeds or retries',
    async (_input, recordType, write) => {
      jest
        .mocked(getGrantedPermissions)
        .mockResolvedValue([{ accessType: 'write', recordType }]);
      for (const ids of [[], [''], ['  '], ['a', 'b']]) {
        jest.mocked(insertRecords).mockClear().mockResolvedValue(ids);
        await expect(write()).rejects.toThrow('record ID');
        expect(insertRecords).toHaveBeenCalledTimes(1);
      }
      jest
        .mocked(insertRecords)
        .mockClear()
        .mockRejectedValue(new Error('interrupted'));
      await expect(write()).rejects.toThrow('interrupted');
      expect(insertRecords).toHaveBeenCalledTimes(1);
    },
  );
  test.each([
    ['Coffee', 95],
    ['Espresso', 63],
    ['Caffeine', 95],
  ] as const)(
    'partial Nutrition payload for %s contains only caffeine',
    async (label, milligrams) => {
      const now = Date.parse('2026-09-21T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(now);
      jest
        .mocked(requestPermission)
        .mockResolvedValue([{ accessType: 'write', recordType: 'Nutrition' }]);
      await expect(
        androidSystemHealth.addCaffeine({ milligrams, label }),
      ).resolves.toEqual({
        id: 'record-123',
        timestamp: new Date(now).toISOString(),
      });
      // Exact equality proves no fake zeros, calories, hydration, or other nutrients.
      expect(insertRecords).toHaveBeenCalledWith([
        {
          recordType: 'Nutrition',
          startTime: new Date(now - 1000).toISOString(),
          endTime: new Date(now).toISOString(),
          caffeine: { value: milligrams, unit: 'milligrams' },
          mealType: 0,
          name: label,
          metadata: { recordingMethod: 3 },
        },
      ]);
    },
  );
  test('an omitted caffeine label is not inferred from its amount', async () => {
    jest
      .mocked(requestPermission)
      .mockResolvedValue([{ accessType: 'write', recordType: 'Nutrition' }]);
    await androidSystemHealth.addCaffeine({ milligrams: 95 });
    expect(jest.mocked(insertRecords).mock.calls[0][0][0]).not.toHaveProperty(
      'name',
    );
  });
  test('165.2 lb writes instantaneous canonical kilograms with manual metadata', async () => {
    const now = Date.parse('2026-09-21T12:00:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(now);
    jest
      .mocked(requestPermission)
      .mockResolvedValue([{ accessType: 'write', recordType: 'Weight' }]);
    await androidSystemHealth.addWeight({ value: 165.2, unit: 'lb' });
    expect(insertRecords).toHaveBeenCalledWith([
      {
        recordType: 'Weight',
        time: new Date(now).toISOString(),
        weight: { value: 74.933459524, unit: 'kilograms' },
        metadata: { recordingMethod: 3 },
      },
    ]);
  });
  test('120/80 writes an instantaneous manual BloodPressure record in mmHg', async () => {
    const now = Date.parse('2026-09-21T12:00:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(now);
    jest
      .mocked(requestPermission)
      .mockResolvedValue([
        { accessType: 'write', recordType: 'BloodPressure' },
      ]);
    await androidSystemHealth.addBloodPressure({
      systolic: 120,
      diastolic: 80,
    });
    expect(requestPermission).toHaveBeenCalledWith([
      { accessType: 'write', recordType: 'BloodPressure' },
    ]);
    expect(insertRecords).toHaveBeenCalledWith([
      {
        recordType: 'BloodPressure',
        time: new Date(now).toISOString(),
        systolic: { value: 120, unit: 'millimetersOfMercury' },
        diastolic: { value: 80, unit: 'millimetersOfMercury' },
        bodyPosition: 0,
        measurementLocation: 0,
        metadata: { recordingMethod: 3 },
      },
    ]);
  });
  test('timestamps are captured only after permission returns', async () => {
    const date = jest.spyOn(Date, 'now').mockReturnValue(10000);
    jest.mocked(requestPermission).mockImplementation(async () => {
      date.mockReturnValue(90000);
      return [{ accessType: 'write', recordType: 'Nutrition' }];
    });
    await androidSystemHealth.addCaffeine({ milligrams: 95 });
    expect(insertRecords).toHaveBeenCalledWith([
      expect.objectContaining({ endTime: new Date(90000).toISOString() }),
    ]);
  });
  test('invalid caffeine, weight, and blood pressure are rejected before permission access', async () => {
    for (const value of [NaN, Infinity, 0, 0.9, 1000.1]) {
      await expect(
        androidSystemHealth.addCaffeine({ milligrams: value }),
      ).rejects.toThrow('1 and 1000');
    }
    for (const input of [
      { systolic: 19, diastolic: 80 },
      { systolic: 201, diastolic: 80 },
      { systolic: 120, diastolic: 9 },
      { systolic: 120, diastolic: 181 },
      { systolic: 80, diastolic: 80 },
    ]) {
      await expect(
        androidSystemHealth.addBloodPressure(input),
      ).rejects.toThrow();
    }
    for (const input of [
      { value: 19, unit: 'lb' },
      { value: 1001, unit: 'lb' },
      { value: 9, unit: 'kg' },
      { value: 451, unit: 'kg' },
    ] as const) {
      await expect(androidSystemHealth.addWeight(input)).rejects.toThrow(
        'Enter weight',
      );
    }
    expect(getSdkStatus).not.toHaveBeenCalled();
    expect(insertRecords).not.toHaveBeenCalled();
  });
});

test('system settings opens only when available and requests no permissions', async () => {
  await androidSystemHealth.openSettings();
  expect(openHealthConnectSettings).toHaveBeenCalledTimes(1);
  expect(initialize).not.toHaveBeenCalled();
  expect(requestPermission).not.toHaveBeenCalled();
  expect(insertRecords).not.toHaveBeenCalled();
  jest
    .mocked(getSdkStatus)
    .mockResolvedValue(SdkAvailabilityStatus.SDK_UNAVAILABLE);
  await expect(androidSystemHealth.openSettings()).rejects.toThrow(
    'unavailable',
  );
  expect(openHealthConnectSettings).toHaveBeenCalledTimes(1);
});
