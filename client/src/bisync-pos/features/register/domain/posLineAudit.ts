/** Local audit log for canceled / voided POS lines (reference + offline durability). */

export type PosLineAuditKind = 'canceled' | 'voided'

export type PosLineAuditEntry = {
  id: string
  kind: PosLineAuditKind
  checkNumber: number
  tableLabel: string
  productId: string
  productName: string
  quantity: number
  amountCents: number
  reason: string
  authorizedBy: string
  createdAt: string
  station?: 'Bar' | 'Kitchen'
}

const KEY = 'bisync-pos-line-audit-v1'

export function loadPosLineAudit(): PosLineAuditEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PosLineAuditEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendPosLineAudit(entry: Omit<PosLineAuditEntry, 'id' | 'createdAt'>): PosLineAuditEntry {
  const full: PosLineAuditEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  const next = [full, ...loadPosLineAudit()].slice(0, 200)
  localStorage.setItem(KEY, JSON.stringify(next))
  return full
}
