/** Canonical platform owner email — only this identity may change platform-wide defaults. */
export const PLATFORM_OWNER_EMAIL = 'dra@cubevalue.com';

const PLATFORM_OWNER_ALIASES = new Set([
  PLATFORM_OWNER_EMAIL,
  'dra@test.com',
]);

export function isPlatformOwnerEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return PLATFORM_OWNER_ALIASES.has(normalized);
}
