import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
export interface Spec extends TurboModule {
  requestWritePermission(recordType: string): Promise<boolean>;
  isHistoryReadAvailable(): Promise<boolean>;
  requestHistoryReadPermission(): Promise<boolean>;
}
export default TurboModuleRegistry.get<Spec>('HealthPermissions');
