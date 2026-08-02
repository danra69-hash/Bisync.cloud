/**
 * Platform accounts that may use POS Home / ordering without Team QR check-in.
 * Match is case-insensitive on the signed-in platform email.
 */
const POS_DUTY_CHECKIN_EXEMPT_EMAILS = new Set([
  'dra@cubevalue.com',
])

export function isPosDutyCheckInExempt(email: string | null | undefined): boolean {
  if (!email) return false
  return POS_DUTY_CHECKIN_EXEMPT_EMAILS.has(email.trim().toLowerCase())
}
