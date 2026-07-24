/**
 * Returns true when the app is running inside a Capacitor native shell
 * (i.e. as an installed Android/iOS app, not a browser).
 */
export function isCapacitor(): boolean {
  return (
    typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor.isNativePlatform?.() === true
  );
}
