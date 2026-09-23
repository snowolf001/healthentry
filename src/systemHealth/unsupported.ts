import type { HealthInput, SystemHealth } from './types';

export class UnsupportedHealthInputError extends Error {
  readonly code = 'unsupported';
  constructor(readonly input: HealthInput) {
    super(
      `${input[0].toUpperCase()}${input.slice(
        1,
      )} is not connected to system health yet. Nothing was saved.`,
    );
    this.name = 'UnsupportedHealthInputError';
  }
}

export async function unsupportedWrite(input: HealthInput): Promise<never> {
  throw new UnsupportedHealthInputError(input);
}

export const unsupportedSystemHealth: SystemHealth = {
  openSettings: async () => {
    throw new Error('System health settings are unavailable on this platform.');
  },
  getAvailability: async () => ({
    status: 'unavailable',
    message: 'System health is not connected on this platform yet.',
  }),
  getAuthorizationStatus: async () => 'unsupported',
  requestAuthorization: async () => 'unsupported',
  addWater: async () => unsupportedWrite('water'),
  addCaffeine: async () => unsupportedWrite('caffeine'),
  addWeight: async () => unsupportedWrite('weight'),
  addBloodPressure: async () => unsupportedWrite('bloodPressure'),
  addExercise: async () => unsupportedWrite('exercise'),
};
