// Safe default for platforms without an implementation. No HealthKit yet.
export { unsupportedSystemHealth as systemHealth } from './unsupported';
export type { SystemHealth } from './types';
