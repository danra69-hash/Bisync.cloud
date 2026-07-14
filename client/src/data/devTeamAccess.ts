import { isSuperAdmin, parseUserAccess, type UserAccess } from './userAccess';
import type { AppUser } from '../api';

/**
 * Legacy client-side helper for Super Admin shortcuts.
 * Authoritative Dev Console access is the server-managed DevTeamUsers list + Dev session.
 */
const DEV_TEAM_EMAILS = new Set([
  'dra@cubevalue.com',
]);

export function isDevTeamUser(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  const access = parseUserAccess(user.accessJson);
  if (isSuperAdmin(access)) return true;
  if (DEV_TEAM_EMAILS.has(user.email.trim().toLowerCase())) return true;
  const role = user.role?.trim().toLowerCase() ?? '';
  return role === 'dev team' || role === 'developer' || role.includes('dev team');
}

export function canAccessDevConsole(user: AppUser | null | undefined, access?: UserAccess): boolean {
  if (!user) return false;
  if (access && isSuperAdmin(access)) return true;
  return isDevTeamUser(user);
}
