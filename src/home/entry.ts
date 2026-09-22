// Ref-like synchronous lock: closes the window before React renders disabled UI.
export function createEntryGuard() {
  let busy = false;
  return async (write: () => Promise<void>): Promise<boolean> => {
    if (busy) {
      return false;
    }
    busy = true;
    try {
      await write();
      return true;
    } finally {
      busy = false;
    }
  };
}

export function parsePositiveDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Shared by the Home root and the compact widget Activity root in this JS runtime.
export const runHealthEntry = createEntryGuard();
