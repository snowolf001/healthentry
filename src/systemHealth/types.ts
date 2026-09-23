export type HealthInput =
  | 'water'
  | 'caffeine'
  | 'weight'
  | 'bloodPressure'
  | 'exercise';
export type Availability =
  | { status: 'available' }
  | { status: 'unavailable' | 'update-required'; message: string };
export type AuthorizationStatus = 'granted' | 'not-granted' | 'unsupported';
export type WaterInput = { value: number; unit: 'us-fl-oz' | 'mL' };
export type CaffeineInput = { milligrams: number; label?: string };
export type WeightUnit = 'kg' | 'lb';
export type WeightInput = { value: number; unit: WeightUnit };
export type BloodPressureInput = { systolic: number; diastolic: number };
export type ExerciseInput = { minutes: number };
export type WriteReceipt = { id: string; timestamp: string };

// Authorization queries never prompt. Writes may request foreground authorization.
// Errors reject; success means the provider acknowledged exactly one record.
export interface SystemHealth {
  getAvailability(): Promise<Availability>;
  openSettings(): Promise<void>;
  getAuthorizationStatus(input: HealthInput): Promise<AuthorizationStatus>;
  requestAuthorization(input: HealthInput): Promise<AuthorizationStatus>;
  addWater(input: WaterInput): Promise<WriteReceipt>;
  addCaffeine(input: CaffeineInput): Promise<WriteReceipt>;
  addWeight(input: WeightInput): Promise<WriteReceipt>;
  addBloodPressure(input: BloodPressureInput): Promise<WriteReceipt>;
  addExercise(input: ExerciseInput): Promise<WriteReceipt>;
}
