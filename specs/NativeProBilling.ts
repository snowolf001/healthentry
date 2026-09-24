import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getState(): Promise<string>;
  loadProducts(): Promise<string>;
  purchase(productId: string): Promise<string>;
  restore(): Promise<string>;
}

export default TurboModuleRegistry.get<Spec>('ProBilling');
