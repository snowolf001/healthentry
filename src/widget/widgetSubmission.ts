import nativeWidget from '../../specs/NativeWidgetActions';
import { runHealthEntry } from '../home/entry';
import { logPreferenceFailure } from '../preferences/weightPreferences';

export function widgetBridge() {
  if (!nativeWidget) {
    throw new Error('Widget entry unavailable. Reopen HealthEntry.');
  }
  return nativeWidget;
}
export function widgetFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/permission|cancelled/i.test(message)) {
    return 'Permission not granted. Nothing added.';
  }
  if (/unavailable|initialize|update/i.test(message)) {
    return 'Health Connect unavailable. Open HealthEntry settings.';
  }
  return 'Save not confirmed. Check Health Connect before retrying.';
}

// The same global pending guard protects both React roots. No retry loop or queue.
export async function submitWidgetEntry(
  sessionId: string,
  write: () => Promise<unknown>,
  success: string,
  afterSuccess?: () => void,
): Promise<string | null> {
  try {
    const entered = await runHealthEntry(async () => {
      const bridge = widgetBridge();
      if (!(await bridge.beginWrite(sessionId))) {
        throw new Error('Entry unavailable.');
      }
      try {
        await write();
        try {
          afterSuccess?.();
        } catch {
          logPreferenceFailure();
        }
      } finally {
        await bridge.endWrite(sessionId);
      }
      // A UI/bridge failure after insertion is ambiguous; never resubmit it.
      await bridge.finish(sessionId, success);
    });
    return entered
      ? null
      : 'Another entry is in progress. Try again when finished.';
  } catch (error) {
    return widgetFailure(error);
  }
}
