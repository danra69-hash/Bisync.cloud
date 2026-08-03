import { api } from '../../../api'
import { idbGet, idbSet } from './idbStore'
import { isOnline } from './posCatalogStore'

const OUTBOX_KEY = 'pos-outbox-v1'

export type PosOutboxOpType =
  | 'recordProductSale'
  | 'posRecordClosedCheck'
  | 'createPosPrepaidPurchase'
  | 'depletePosPrepaid'
  | 'createPosWastage'
  | 'posRecordVoid'
  | 'posRecordCancel'

export type PosOutboxOp = {
  id: string
  type: PosOutboxOpType
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
  lastError?: string | null
}

function newOpId() {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export async function loadOutbox(): Promise<PosOutboxOp[]> {
  return (await idbGet<PosOutboxOp[]>(OUTBOX_KEY)) ?? []
}

async function saveOutbox(ops: PosOutboxOp[]): Promise<void> {
  await idbSet(OUTBOX_KEY, ops)
}

export async function enqueueOutbox(
  type: PosOutboxOpType,
  payload: Record<string, unknown>,
): Promise<PosOutboxOp> {
  const op: PosOutboxOp = {
    id: newOpId(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  }
  const ops = await loadOutbox()
  ops.push(op)
  await saveOutbox(ops)
  return op
}

async function dispatchOp(op: PosOutboxOp): Promise<void> {
  const p = op.payload
  switch (op.type) {
    case 'recordProductSale':
      await api.recordProductSale(Number(p.productId), p.body as Parameters<typeof api.recordProductSale>[1])
      return
    case 'posRecordClosedCheck':
      await api.posRecordClosedCheck(p as Parameters<typeof api.posRecordClosedCheck>[0])
      return
    case 'createPosPrepaidPurchase':
      await api.createPosPrepaidPurchase(p as Parameters<typeof api.createPosPrepaidPurchase>[0])
      return
    case 'depletePosPrepaid':
      await api.depletePosPrepaid(p as Parameters<typeof api.depletePosPrepaid>[0])
      return
    case 'createPosWastage':
      await api.createPosWastage(p as unknown as Parameters<typeof api.createPosWastage>[0])
      return
    case 'posRecordVoid':
      await api.posRecordVoid(p as unknown as Parameters<typeof api.posRecordVoid>[0])
      return
    case 'posRecordCancel':
      await api.posRecordCancel(p as unknown as Parameters<typeof api.posRecordCancel>[0])
      return
    default:
      throw new Error(`Unknown outbox op: ${op.type}`)
  }
}

/** Lift pending device transactions to the server. Returns remaining queue length. */
export async function flushPosOutbox(): Promise<{ flushed: number; remaining: number; errors: string[] }> {
  if (!isOnline()) {
    const ops = await loadOutbox()
    return { flushed: 0, remaining: ops.length, errors: ['Offline — will retry when connected'] }
  }
  const ops = await loadOutbox()
  if (ops.length === 0) return { flushed: 0, remaining: 0, errors: [] }

  const remaining: PosOutboxOp[] = []
  const errors: string[] = []
  let flushed = 0

  for (const op of ops) {
    try {
      await dispatchOp(op)
      flushed += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      remaining.push({
        ...op,
        attempts: op.attempts + 1,
        lastError: message,
      })
      errors.push(`${op.type}: ${message}`)
    }
  }

  await saveOutbox(remaining)
  return { flushed, remaining: remaining.length, errors }
}

export async function outboxPendingCount(): Promise<number> {
  return (await loadOutbox()).length
}
