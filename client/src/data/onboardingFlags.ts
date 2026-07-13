/** Local onboarding gates after self-serve registration. */

const LOCATION_FLAG = 'bisync.awaitingLocation';
const PAYMENT_FLAG = 'bisync.awaitingPayment';
/** Legacy flag from earlier subscription placeholder. */
const LEGACY_SUBSCRIPTION_FLAG = 'bisync.awaitingSubscription';

export function isAwaitingLocation(): boolean {
  return localStorage.getItem(LOCATION_FLAG) === 'true';
}

export function setAwaitingLocation(): void {
  localStorage.setItem(LOCATION_FLAG, 'true');
  localStorage.removeItem(PAYMENT_FLAG);
  localStorage.removeItem(LEGACY_SUBSCRIPTION_FLAG);
}

export function clearAwaitingLocation(): void {
  localStorage.removeItem(LOCATION_FLAG);
}

export function isAwaitingPayment(): boolean {
  return localStorage.getItem(PAYMENT_FLAG) === 'true'
    || localStorage.getItem(LEGACY_SUBSCRIPTION_FLAG) === 'true';
}

export function setAwaitingPayment(): void {
  localStorage.setItem(PAYMENT_FLAG, 'true');
  localStorage.removeItem(LOCATION_FLAG);
  localStorage.removeItem(LEGACY_SUBSCRIPTION_FLAG);
}

export function clearAwaitingPayment(): void {
  localStorage.removeItem(PAYMENT_FLAG);
  localStorage.removeItem(LEGACY_SUBSCRIPTION_FLAG);
}

export function clearAllOnboardingFlags(): void {
  clearAwaitingLocation();
  clearAwaitingPayment();
}
