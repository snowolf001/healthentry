import NativeProBilling from '../../specs/NativeProBilling';

export type ProState = {
  isPro: boolean;
  widgetTrialStarted: boolean;
  widgetTrialDaysRemaining: number;
  debugProOverride?: boolean;
};
export type ProProduct = { productId: string; title: string; price: string; offerToken: string };

const fallback: ProState = { isPro: false, widgetTrialStarted: false, widgetTrialDaysRemaining: 14 };

export async function isDebugBuild(): Promise<boolean> {
  if (!NativeProBilling) return false;
  try { return await NativeProBilling.isDebugBuild(); } catch { return false; }
}

export async function getProState(): Promise<ProState> {
  if (!NativeProBilling) return fallback;
  try { return JSON.parse(await NativeProBilling.getState()) as ProState; } catch { return fallback; }
}
export async function setDebugProOverride(active: boolean): Promise<ProState> {
  if (!NativeProBilling || !(await isDebugBuild())) return getProState();
  return JSON.parse(await NativeProBilling.setDebugProOverride(active)) as ProState;
}
export async function loadProProducts(): Promise<ProProduct[]> {
  if (!NativeProBilling) return [];
  return JSON.parse(await NativeProBilling.loadProducts()) as ProProduct[];
}
export async function purchasePro(productId: string): Promise<ProState> {
  if (!NativeProBilling) throw new Error('Google Play Billing is unavailable.');
  return JSON.parse(await NativeProBilling.purchase(productId)) as ProState;
}
export async function restorePro(): Promise<ProState> {
  if (!NativeProBilling) return fallback;
  return JSON.parse(await NativeProBilling.restore()) as ProState;
}
