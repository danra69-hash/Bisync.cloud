/** Hard allowlist for Dev Console Team (control panel) create/edit. */
export const DEV_CONSOLE_CONTROL_PANEL_EMAILS = [
  'dra@cubevalue.com',
  'james@cubevalue.com',
  'james@pasar.ai',
] as const;

export function canManageDevConsoleTeam(email: string | null | undefined): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return (DEV_CONSOLE_CONTROL_PANEL_EMAILS as readonly string[]).includes(normalized);
}
