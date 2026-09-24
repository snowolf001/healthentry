import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getState(): Promise<string>;
  isDebugBuild(): Promise<boolean>;
  loadProducts(): Promise<string>;
  purchase(productId: string): Promise<string>;
  restore(): Promise<string>;
  setDebugProOverride(active: boolean): Promise<string>;
}

export default TurboModuleRegistry.get<Spec>('ProBilling');
