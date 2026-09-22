// Compatibility entry for the original spike. UI imports src/systemHealth instead.
import { systemHealth } from './src/systemHealth';
export const addWater = () =>
  systemHealth.addWater({ value: 8, unit: 'us-fl-oz' });
