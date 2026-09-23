import nativeHealthPermissions from '../../specs/NativeHealthPermissions';
import {
  BloodPressureBodyPosition,
  BloodPressureMeasurementLocation,
  ExerciseType,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  MealType,
  openHealthConnectSettings,
  RecordingMethod,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type {
  Availability,
  AuthorizationStatus,
  HealthInput,
  SystemHealth,
  WaterInput,
  CaffeineInput,
  WeightInput,
  BloodPressureInput,
  ExerciseInput,
  TrendData,
  TrendRangeDays,
} from './types';
import {
  validateBloodPressure,
  validateCaffeine,
  validateWeight,
  waterToMilliliters,
} from './units';

function log(event: string, detail: unknown) {
  if (__DEV__) {
    console.info(`[HydrationSpike] ${event}`, detail);
  }
}

async function getAvailability(): Promise<Availability> {
  const status = await getSdkStatus();
  log('availability', { status });
  if (
    status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
  ) {
    return {
      status: 'update-required',
      message:
        'Install or update Health Connect in Google Play (Android 9–13), or update your Android system (14+), complete Health Connect setup, then tap again.',
    };
  }
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    return {
      status: 'unavailable',
      message:
        'Health Connect is unavailable on this device/profile. Use a supported Android 9+ phone and personal profile.',
    };
  }
  return { status: 'available' };
}

async function prepare() {
  const availability = await getAvailability();
  if (availability.status !== 'available') {
    throw new Error(availability.message);
  }
  const initialized = await initialize();
  log('initialize', { initialized });
  if (!initialized) {
    throw new Error(
      'Health Connect could not initialize. Reopen the app and try again.',
    );
  }
}

const recordTypes = {
  water: 'Hydration',
  caffeine: 'Nutrition',
  weight: 'Weight',
  bloodPressure: 'BloodPressure',
  exercise: 'ExerciseSession',
} as const;

async function authorize(
  input: HealthInput,
  prompt: boolean,
): Promise<AuthorizationStatus> {
  await prepare();
  const recordType = recordTypes[input];
  const hasWrite = (
    permissions: { accessType: string; recordType: string }[],
  ) =>
    permissions.some(
      p => p.accessType === 'write' && p.recordType === recordType,
    );
  let granted = hasWrite(await getGrantedPermissions());
  log('permission state', { input, recordType, granted });
  if (!granted && prompt) {
    const permission = { accessType: 'write' as const, recordType };
    log('permission request', permission);
    if (!nativeHealthPermissions) {
      throw new Error('Permission request unavailable. Reopen HealthEntry.');
    }
    granted = await nativeHealthPermissions.requestWritePermission(recordType);
    log('permission result', { input, recordType, granted });
  }
  return granted ? 'granted' : 'not-granted';
}

const manualMetadata = () => ({
  recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
});
type WritableRecord = Parameters<typeof insertRecords>[0][number];

// No reads, persistence, or automatic retries. Build timestamps after authorization.
async function writeOne(
  input: HealthInput,
  build: (now: number) => WritableRecord,
) {
  try {
    if ((await authorize(input, true)) !== 'granted') {
      throw new Error(
        `${recordTypes[input]} write permission was not granted. Enable it in Health Connect > App permissions > HealthEntry, then tap again.`,
      );
    }
    const now = Date.now();
    const record = build(now);
    log('write attempt', record);
    const ids = await insertRecords([record]);
    log('write result', { input, ids });
    if (ids.length !== 1 || typeof ids[0] !== 'string' || !ids[0].trim()) {
      throw new Error(
        'Health Connect returned no single record ID. Check Health Connect before retrying to avoid a duplicate.',
      );
    }
    return { id: ids[0], timestamp: new Date(now).toISOString() };
  } catch (error) {
    log('error', error);
    throw error;
  }
}

async function addWater(input: WaterInput) {
  const milliliters = waterToMilliliters(input);
  return writeOne('water', now => ({
    recordType: 'Hydration',
    startTime: new Date(now - 1000).toISOString(),
    endTime: new Date(now).toISOString(),
    volume: { value: milliliters, unit: 'milliliters' },
    metadata: manualMetadata(),
  }));
}
async function addCaffeine(input: CaffeineInput) {
  const milligrams = validateCaffeine(input.milligrams);
  return writeOne('caffeine', now => ({
    recordType: 'Nutrition',
    startTime: new Date(now - 1000).toISOString(),
    endTime: new Date(now).toISOString(),
    caffeine: { value: milligrams, unit: 'milligrams' },
    mealType: MealType.UNKNOWN,
    ...(input.label ? { name: input.label } : {}),
    metadata: manualMetadata(),
  }));
}
async function addWeight(input: WeightInput) {
  const kilograms = validateWeight(input.value, input.unit);
  return writeOne('weight', now => ({
    recordType: 'Weight',
    time: new Date(now).toISOString(),
    weight: { value: kilograms, unit: 'kilograms' },
    metadata: manualMetadata(),
  }));
}
async function addBloodPressure(input: BloodPressureInput) {
  const { systolic, diastolic } = validateBloodPressure(input);
  return writeOne('bloodPressure', now => ({
    recordType: 'BloodPressure',
    time: new Date(now).toISOString(),
    systolic: { value: systolic, unit: 'millimetersOfMercury' },
    diastolic: { value: diastolic, unit: 'millimetersOfMercury' },
    bodyPosition: BloodPressureBodyPosition.UNKNOWN,
    measurementLocation: BloodPressureMeasurementLocation.UNKNOWN,
    metadata: manualMetadata(),
  }));
}

async function addExercise(input: ExerciseInput) {
  const minutes = input.minutes;
  const title = input.title.trim();
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    throw new Error('Enter an exercise duration between 1 and 240 minutes.');
  }
  if (!title || title.length > 60) {
    throw new Error('Enter an exercise name between 1 and 60 characters.');
  }
  return writeOne('exercise', now => ({
    recordType: 'ExerciseSession',
    startTime: new Date(now - minutes * 60_000).toISOString(),
    endTime: new Date(now).toISOString(),
    exerciseType: ExerciseType.OTHER_WORKOUT,
    title,
    metadata: manualMetadata(),
  }));
}

function numericValue(value: unknown): number {
  if (
    value &&
    typeof value === 'object' &&
    'value' in value &&
    typeof (value as { value?: unknown }).value === 'number'
  ) {
    return (value as { value: number }).value;
  }
  return 0;
}

function localDateKey(value: string | number | Date): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readTrends(days: TrendRangeDays): Promise<TrendData> {
  await prepare();
  if (![7, 30, 90].includes(days)) {
    throw new Error('Trend range must be 7, 30, or 90 days.');
  }
  const recordTypeList = [
    'Hydration',
    'Nutrition',
    'Weight',
    'BloodPressure',
    'ExerciseSession',
  ] as const;
  if (days === 90) {
    if (!nativeHealthPermissions) {
      throw new Error('History permission request unavailable. Reopen HealthEntry.');
    }
    const available = await nativeHealthPermissions.isHistoryReadAvailable();
    if (!available) {
      throw new Error(
        '90-day Trends require Health Connect history access, which is unavailable on this device. Update Health Connect or use 30D.',
      );
    }
    const historyGranted =
      await nativeHealthPermissions.requestHistoryReadPermission();
    if (!historyGranted) {
      throw new Error(
        '90-day Trends require history access. Grant HealthEntry permission to read health data older than 30 days, or use 30D.',
      );
    }
  }
  const granted = await getGrantedPermissions();
  const hasRead = (recordType: string) =>
    granted.some(
      permission =>
        permission.accessType === 'read' && permission.recordType === recordType,
    );
  const missing = recordTypeList.filter(recordType => !hasRead(recordType));
  if (missing.length) {
    const result = await requestPermission(
      missing.map(recordType => ({ accessType: 'read' as const, recordType })),
    );
    const allowed = new Set(
      result
        .filter(permission => permission.accessType === 'read')
        .map(permission => permission.recordType),
    );
    if (missing.some(recordType => !allowed.has(recordType))) {
      throw new Error(
        'Health data read access was not granted. Enable HealthEntry read access in Health Connect to view Trends.',
      );
    }
  }

  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
  const read = async (recordType: string) =>
    (await readRecords(recordType as never, { timeRangeFilter } as never))
      .records as unknown as Record<string, unknown>[];

  const [hydration, nutrition, weights, pressures, exercises] =
    await Promise.all([
      read('Hydration'),
      read('Nutrition'),
      read('Weight'),
      read('BloodPressure'),
      read('ExerciseSession'),
    ]);

  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: localDateKey(date),
      waterMl: 0,
      caffeineMg: 0,
      exerciseCount: 0,
      exerciseMinutes: 0,
    };
  });
  const byDate = new Map(daily.map(day => [day.date, day]));

  hydration.forEach(record => {
    const day = byDate.get(localDateKey(String(record.endTime)));
    if (day) day.waterMl += numericValue(record.volume);
  });
  nutrition.forEach(record => {
    const day = byDate.get(localDateKey(String(record.endTime)));
    if (day) day.caffeineMg += numericValue(record.caffeine);
  });
  exercises.forEach(record => {
    const startTime = new Date(String(record.startTime));
    const endTime = new Date(String(record.endTime));
    const day = byDate.get(localDateKey(endTime));
    if (day) {
      day.exerciseCount += 1;
      day.exerciseMinutes += Math.max(
        0,
        Math.round((endTime.getTime() - startTime.getTime()) / 60_000),
      );
    }
  });

  return {
    daily,
    weights: weights
      .map(record => ({
        time: String(record.time),
        kilograms: numericValue(record.weight),
      }))
      .filter(record => record.kilograms > 0)
      .sort((a, b) => a.time.localeCompare(b.time)),
    bloodPressures: pressures
      .map(record => ({
        time: String(record.time),
        systolic: numericValue(record.systolic),
        diastolic: numericValue(record.diastolic),
      }))
      .filter(record => record.systolic > 0 && record.diastolic > 0)
      .sort((a, b) => a.time.localeCompare(b.time)),
  };
}

export const androidSystemHealth: SystemHealth = {
  async openSettings() {
    const availability = await getAvailability();
    if (availability.status !== 'available') {
      throw new Error(availability.message);
    }
    openHealthConnectSettings();
  },
  getAvailability,
  getAuthorizationStatus: input => authorize(input, false),
  requestAuthorization: input => authorize(input, true),
  addWater,
  addCaffeine,
  addWeight,
  addBloodPressure,
  addExercise,
  readTrends,
};
