import nativeHealthPermissions from '../../specs/NativeHealthPermissions';
import {
  BloodPressureBodyPosition,
  BloodPressureMeasurementLocation,
  ExerciseType,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
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
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    throw new Error('Enter an exercise duration between 1 and 240 minutes.');
  }
  return writeOne('exercise', now => ({
    recordType: 'ExerciseSession',
    startTime: new Date(now - minutes * 60_000).toISOString(),
    endTime: new Date(now).toISOString(),
    exerciseType: ExerciseType.OTHER_WORKOUT,
    title: 'Fitness room',
    metadata: manualMetadata(),
  }));
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
};
