/** Minor units (cents) — ports cleanly to Flutter `int`. */
export type MoneyCents = number

export function formatMoney(cents: MoneyCents, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}
