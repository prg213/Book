const CANONICAL = 'https://mystorybook.world';

/**
 * Returns the canonical origin to use when building shareable links.
 * - On the live site (mystorybook.world) → canonical domain
 * - Inside the Android/iOS Capacitor app (hostname is 'localhost') → canonical domain
 * - In dev / Replit preview → current origin so local testing still works
 */
export function shareOrigin(): string {
  const { hostname } = window.location;
  // Capacitor apps run at capacitor://localhost or http://localhost
  const isCapacitor = typeof (window as any).Capacitor !== 'undefined';
  if (hostname === 'mystorybook.world' || isCapacitor) {
    return CANONICAL;
  }
  return window.location.origin;
}
