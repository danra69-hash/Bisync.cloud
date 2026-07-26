import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import {
  canApproveWastage,
  canViewWastage,
} from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import {
  approveWastage,
  getWastageDetail,
  rejectWastage,
} from '../../api/wastage'

function formatMoney(raw?: string | number | null) {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

export function OperatorWastageDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const { token, hasPermission } = useAuth()
  const { id } = useParams()
  const wastageId = Number(id)
  const fromToApprove = Boolean(
    (location.state as { fromToApprove?: boolean } | null)?.fromToApprove,
  )
  const [actionError, setActionError] = useState<string | null>(null)
  const canView = canViewWastage(hasPermission)
  const canApprovePerm = canApproveWastage(hasPermission)

  const detail = useQuery({
    queryKey: ['wastage-detail', token, wastageId],
    enabled: !!token && Number.isFinite(wastageId) && canView,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => getWastageDetail(token!, wastageId),
  })

  const data = detail.data
  const isPending =
    String(data?.status || '').toLowerCase() === 'pending'
  const canApprove =
    canApprovePerm && isPending && data?.allowApprove === true
  const canReject =
    canApprovePerm && isPending && data?.allowReject === true

  const approve = useMutation({
    mutationFn: async () => {
      if (!token || !Number.isFinite(wastageId)) {
        throw new Error('Missing wastage')
      }
      if (!canApprovePerm) {
        throw new Error('Permission required to approve wastage')
      }
      await approveWastage(token, wastageId)
    },
    onSuccess: async () => {
      setActionError(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['wastage-detail', token, wastageId] }),
        qc.invalidateQueries({ queryKey: ['wastage-pending-approvals'] }),
        qc.invalidateQueries({ queryKey: ['wastage-list'] }),
      ])
      navigate(
        fromToApprove
          ? `/operator?tab=toApprove&changed=${encodeURIComponent('Approved')}&id=${encodeURIComponent(`Wastage #${wastageId}`)}`
          : '/operator/stock/wastage',
        { replace: true },
      )
    },
    onError: (err) => {
      setActionError((err as Error).message || 'Approve failed')
    },
  })

  const reject = useMutation({
    mutationFn: async () => {
      if (!token || !Number.isFinite(wastageId)) {
        throw new Error('Missing wastage')
      }
      if (!canApprovePerm) {
        throw new Error('Permission required to reject wastage')
      }
      await rejectWastage(token, wastageId)
    },
    onSuccess: async () => {
      setActionError(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['wastage-detail', token, wastageId] }),
        qc.invalidateQueries({ queryKey: ['wastage-pending-approvals'] }),
        qc.invalidateQueries({ queryKey: ['wastage-list'] }),
      ])
      navigate(
        fromToApprove
          ? `/operator?tab=toApprove&changed=${encodeURIComponent('Rejected')}&id=${encodeURIComponent(`Wastage #${wastageId}`)}`
          : '/operator/stock/wastage',
        { replace: true },
      )
    },
    onError: (err) => {
      setActionError((err as Error).message || 'Reject failed')
    },
  })

  const busy = approve.isPending || reject.isPending

  if (!canView) {
    return (
      <div className="stack inventory-page">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate('/operator/stock/wastage')}
        >
          ← Wastage
        </button>
        <PermissionDenied
          title="Wastage unavailable"
          message="Wastage view permission is required."
        />
      </div>
    )
  }

  return (
    <div className="stack inventory-page wastage-detail-page">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() =>
          navigate(fromToApprove ? '/operator?tab=toApprove' : '/operator/stock/wastage')
        }
      >
        {fromToApprove ? '← To Approve' : '← Wastage'}
      </button>

      <div className="inventory-header">
        <div>
          <h2 style={{ margin: 0 }}>
            Wastage #{Number.isFinite(wastageId) ? wastageId : '—'}
          </h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            View only — line items cannot be edited
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
            {(detail.error as Error).message || 'Failed to load wastage'}
          </p>
        </div>
      ) : !data ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Wastage not found
          </p>
        </div>
      ) : (
        <>
          <div className="card stack wastage-detail-meta">
            <div className="wastage-detail-meta-grid">
              <div>
                <span className="muted">Date happened</span>
                <strong>{data.date || '—'}</strong>
              </div>
              <div>
                <span className="muted">Outlet</span>
                <strong>{data.outletName || '—'}</strong>
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
            {data.wastageItems.length === 0 ? (
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
                {data.wastageItems.map((item, idx) => (
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
                    <div className="wastage-detail-reason">
                      <span className="muted">Reason</span> {item.reason || '—'}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {(canApprove || canReject) && (
            <div className="card stack wastage-approve-actions">
              <p className="muted" style={{ margin: 0 }}>
                This wastage is pending approval.
              </p>
              {actionError && (
                <p className="error-text" style={{ margin: 0 }}>
                  {actionError}
                </p>
              )}
              <div className="wastage-approve-row">
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
                {canApprove && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => approve.mutate()}
                  >
                    {approve.isPending ? 'Approving…' : 'Approve'}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
