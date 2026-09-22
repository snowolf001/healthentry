import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
export interface Spec extends TurboModule {
  consumeLaunch(sessionId: string): Promise<string | null>;
  beginWrite(sessionId: string): Promise<boolean>;
  endWrite(sessionId: string): Promise<void>;
  finish(sessionId: string, message: string): Promise<void>;
}
export default TurboModuleRegistry.get<Spec>('WidgetActions');
