import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// A single small JSON preference value. No health records pass through this module.
export interface Spec extends TurboModule {
  load(): Promise<string>;
  save(value: string): Promise<void>;
}
export default TurboModuleRegistry.get<Spec>('WeightPreferences');
