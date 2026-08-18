/** POS check numbers are always 6 digits (100000–999999). */
export function nextPosCheckNumber(): number {
  return Math.floor(100000 + Math.random() * 900000)
}

/** Display helper — pads legacy shorter numbers to 6 digits. */
export function formatPosCheckNumber(checkNumber: number): string {
  const n = Math.trunc(Math.abs(Number(checkNumber)))
  if (!Number.isFinite(n)) return '000000'
  return String(n).padStart(6, '0').slice(-6)
}
