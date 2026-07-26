import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { useLocationFilter } from '../../auth/LocationProvider'
import {
  canDeleteTransfer,
  canEditTransfer,
  canViewTransfer,
} from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import {
  cancelTransfer,
  getTransferDetail,
  isTransferActionableStatus,
  receiveTransfer,
  rejectTransfer,
} from '../../api/transfer'

function formatMoney(raw?: string | number | null) {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function normOutletName(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function outletNamesMatch(a?: string | null, b?: string | null) {
  const left = normOutletName(a)
  const right = normOutletName(b)
  return !!left && !!right && left === right
}

export function OperatorTransferDetailPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { token, hasPermission } = useAuth()
  const { selectedLocation } = useLocationFilter()
  const { id } = useParams()
  const transferId = Number(id)
  const [actionError, setActionError] = useState<string | null>(null)

  /** Request / receive / reject — role permission TransferAddEdit. */
  const canView = canViewTransfer(hasPermission)
  const canEditPerm = canEditTransfer(hasPermission)
  /** Cancel — TransferDelete (sender). */
  const canDeletePerm = canDeleteTransfer(hasPermission)

  const detail = useQuery({
    queryKey: ['transfer-detail', token, transferId],
    enabled: !!token && Number.isFinite(transferId) && canView,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => getTransferDetail(token!, transferId),
  })

  const data = detail.data
  const statusOpen = isTransferActionableStatus(data?.status)

  // Match header location to From / To (API often only returns outlet names).
  const isDestination =
    !!selectedLocation &&
    ((data?.toOutletId != null &&
      selectedLocation.outletId === data.toOutletId) ||
      outletNamesMatch(selectedLocation.name, data?.toOutletName))
  const isSource =
    !!selectedLocation &&
    ((data?.fromOutletId != null &&
      selectedLocation.outletId === data.fromOutletId) ||
      outletNamesMatch(selectedLocation.name, data?.fromOutletName))

  // System flags (allowAccept / allowReject) + account permission + outlet role.
  // Status must stay open — UAT keeps allowAccept true after Received.
  const canReceive =
    canEditPerm &&
    statusOpen &&
    isDestination &&
    data?.allowReceive === true
  const canReject =
    canEditPerm &&
    statusOpen &&
    isDestination &&
    data?.allowReject === true
  const canCancel =
    canDeletePerm &&
    statusOpen &&
    isSource &&
    data?.allowCancel !== false

  async function afterAction() {
    setActionError(null)
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['transfer-detail', token, transferId] }),
      qc.invalidateQueries({ queryKey: ['transfer-list'] }),
    ])
    await detail.refetch()
  }

  const receive = useMutation({
    mutationFn: async () => {
      if (!token || !Number.isFinite(transferId)) throw new Error('Missing transfer')
      if (!canEditPerm) {
        throw new Error('Transfer add/edit permission is required to receive')
      }
      if (!isDestination) {
        throw new Error('Select the destination outlet in the top bar to receive')
      }
      await receiveTransfer(token, transferId)
    },
    onSuccess: () => afterAction(),
    onError: (err) => {
      setActionError((err as Error).message || 'Receive failed')
    },
  })

  const reject = useMutation({
    mutationFn: async () => {
      if (!token || !Number.isFinite(transferId)) throw new Error('Missing transfer')
      if (!canEditPerm) {
        throw new Error('Transfer add/edit permission is required to reject')
      }
      if (!isDestination) {
        throw new Error('Select the destination outlet in the top bar to reject')
      }
      await rejectTransfer(token, transferId)
    },
    onSuccess: () => afterAction(),
    onError: (err) => {
      setActionError((err as Error).message || 'Reject failed')
    },
  })

  const cancel = useMutation({
    mutationFn: async () => {
      if (!token || !Number.isFinite(transferId)) throw new Error('Missing transfer')
      if (!canDeletePerm) {
        throw new Error('Transfer delete permission is required to cancel')
      }
      await cancelTransfer(token, transferId)
    },
    onSuccess: () => afterAction(),
    onError: (err) => {
      setActionError((err as Error).message || 'Cancel failed')
    },
  })

  const busy = receive.isPending || reject.isPending || cancel.isPending
  const showActions = canReceive || canReject || canCancel
  const needDestHint =
    statusOpen &&
    canEditPerm &&
    !isDestination &&
    (data?.allowReceive === true || data?.allowReject === true)

  if (!canView) {
    return (
      <div className="stack inventory-page">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate('/operator/stock/transfer')}
        >
          ← Transfer
        </button>
        <PermissionDenied
          title="Transfer unavailable"
          message="Transfer view permission is required."
        />
      </div>
    )
  }

  return (
    <div className="stack inventory-page transfer-detail-page">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => navigate('/operator/stock/transfer')}
      >
        ← Transfer
      </button>

      <div className="inventory-header">
        <div>
          <h2 style={{ margin: 0 }}>
            Transfer #{Number.isFinite(transferId) ? transferId : '—'}
          </h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            View only — line items cannot be edited
            {data?.number ? ` · ${data.number}` : ''}
          </p>
        </div>
        {data?.status ? (
          <span className="wastage-status-pill">{data.status}</span>
        ) : null}
      </div>

      {detail.isLoading ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Loading…
          </p>
        </div>
      ) : detail.isError ? (
        <div className="card">
          <p className="error-text" style={{ margin: 0 }}>
            {(detail.error as Error).message || 'Failed to load transfer'}
          </p>
        </div>
      ) : !data ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Transfer not found
          </p>
        </div>
      ) : (
        <>
          <div className="card stack wastage-detail-meta">
            <div className="wastage-detail-meta-grid">
              <div>
                <span className="muted">Date</span>
                <strong>{data.date || '—'}</strong>
              </div>
              <div>
                <span className="muted">From</span>
                <strong>{data.fromOutletName || '—'}</strong>
              </div>
              <div>
                <span className="muted">To</span>
                <strong>{data.toOutletName || '—'}</strong>
              </div>
              <div>
                <span className="muted">Created by</span>
                <strong>
                  {data.createdBy || '—'}
                  {data.roleCode ? ` (${data.roleCode})` : ''}
                </strong>
              </div>
              <div>
                <span className="muted">Grand total</span>
                <strong>{formatMoney(data.grandTotal)}</strong>
              </div>
              <div>
                <span className="muted">Created</span>
                <strong>{data.createdDate || '—'}</strong>
              </div>
              <div>
                <span className="muted">Last updated</span>
                <strong>{data.lastUpdatedDate || '—'}</strong>
              </div>
            </div>
          </div>

          <div className="card stack">
            <strong>Items</strong>
            {data.transferItems.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No line items
              </p>
            ) : (
              <div className="wastage-detail-items">
                <div className="wastage-detail-items-head" aria-hidden>
                  <span>Name</span>
                  <span>UOM</span>
                  <span>QTY</span>
                  <span>Value</span>
                </div>
                {data.transferItems.map((item, idx) => (
                  <article
                    key={`${item.code || item.name}-${idx}`}
                    className="wastage-list-item wastage-detail-item"
                  >
                    <div className="wastage-row">
                      <div className="wastage-col wastage-col-item">
                        <div className="wastage-name" title={item.name}>
                          {item.name || '—'}
                        </div>
                        <div className="wastage-id">
                          ID {item.code || '—'}
                          {item.type ? ` · ${item.type}` : ''}
                        </div>
                      </div>
                      <div className="wastage-col wastage-col-uom">
                        <div className="wastage-uom">{item.uom || '—'}</div>
                        <div className="wastage-price">
                          @ {formatMoney(item.unitPrice)}
                        </div>
                      </div>
                      <div className="wastage-col wastage-col-qty wastage-detail-qty">
                        {item.qty ?? '—'}
                      </div>
                      <div className="wastage-col wastage-col-total">
                        <div className="wastage-value">
                          {formatMoney(item.total)}
                        </div>
                      </div>
                    </div>
                    {item.remarks ? (
                      <div className="wastage-detail-reason">
                        <span className="muted">Remarks</span> {item.remarks}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>

          {needDestHint && (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                To receive or reject, switch the top-bar location to the
                destination outlet
                {data?.toOutletName ? ` (${data.toOutletName})` : ''}.
              </p>
            </div>
          )}

          {showActions && (
            <div className="card stack wastage-approve-actions">
              <p className="muted" style={{ margin: 0 }}>
                This transfer is awaiting receive at the destination outlet.
              </p>
              {actionError && (
                <p className="error-text" style={{ margin: 0 }}>
                  {actionError}
                </p>
              )}
              <div className="wastage-approve-row">
                {canCancel && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => cancel.mutate()}
                  >
                    {cancel.isPending ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
                {canReject && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => reject.mutate()}
                  >
                    {reject.isPending ? 'Rejecting…' : 'Reject'}
                  </button>
                )}
                {canReceive && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => receive.mutate()}
                  >
                    {receive.isPending ? 'Receiving…' : 'Receive'}
                  </button>
                )}
              </div>
            </div>
          )}

          {!showActions &&
            !needDestHint &&
            statusOpen &&
            !canEditPerm &&
            !canDeletePerm && (
              <div className="card">
                <p className="muted" style={{ margin: 0 }}>
                  Your account does not have permission to receive, reject, or
                  cancel this transfer.
                </p>
              </div>
            )}
        </>
      )}
    </div>
  )
}
