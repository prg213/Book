/**
 * Returns the canonical origin to use when building shareable links.
 * In production (mystorybook.world) we always use the custom domain.
 * In dev / preview environments we fall back to the current origin so
 * local testing still works.
 */
export function shareOrigin(): string {
  if (window.location.hostname === 'mystorybook.world') {
    return 'https://mystorybook.world';
  }
  return window.location.origin;
}
