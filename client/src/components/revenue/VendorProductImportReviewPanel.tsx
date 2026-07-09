import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, GitMerge, X } from 'lucide-react';
import type { Vendor } from '../../api';
import type { VendorProductImportDraft } from '../../data/vendorProductCatalog';
import {
  applyMergeResolutions,
  applyVendorProductImportPlan,
  type VendorProductImportPlan,
} from '../../data/vendorProductImportCatalog';
import type { VendorProductCatalogItem } from '../../data/vendorProductCatalog';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import {
  SIDE_PANEL_OVERLAY_CLS,
  SIDE_PANEL_SHELL_CREATE_VENDOR_CLS,
} from '../layout/sidePanelShared';
import { VendorProductImportMergePanel } from './VendorProductImportMergePanel';
import { VendorProductImportNewProductsPanel } from './VendorProductImportNewProductsPanel';

type Props = {
  plan: VendorProductImportPlan;
  vendor: Vendor;
  existingProducts: VendorProductCatalogItem[];
  groupOptions: string[];
  onClose: () => void;
  onApplied: () => void;
};

export function VendorProductImportReviewPanel({
  plan,
  vendor,
  existingProducts,
  groupOptions,
  onClose,
  onApplied,
}: Props) {
  const [workingPlan, setWorkingPlan] = useState(plan);
  const [mergeResolutions, setMergeResolutions] = useState<Record<string, string>>({});
  const [showMergePanel, setShowMergePanel] = useState(plan.conflicts.length > 0);
  const [showNewProductsPanel, setShowNewProductsPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const summary = useMemo(() => ({
    creates: workingPlan.creates.length,
    updates: workingPlan.updates.length,
    unchanged: workingPlan.unchanged.length,
    errors: workingPlan.errors.length,
    conflicts: workingPlan.conflicts.length,
    deactivations: workingPlan.deactivations.length,
  }), [workingPlan]);

  const totalChanges = workingPlan.creates.length + workingPlan.updates.length + workingPlan.deactivations.length;
  const canApply = totalChanges > 0 && workingPlan.errors.length === 0 && workingPlan.conflicts.length === 0;

  function handleMergeComplete(resolutions: Record<string, string>) {
    const mergedPlan = applyMergeResolutions(workingPlan, resolutions, existingProducts);
    setMergeResolutions(resolutions);
    setWorkingPlan(mergedPlan);
    setShowMergePanel(false);
    setError(null);

    if (mergedPlan.conflicts.length > 0) {
      setError('Some duplicate groups still need a merge selection.');
      setShowMergePanel(true);
      return;
    }

    if (mergedPlan.creates.length > 0) {
      setShowNewProductsPanel(true);
    }
  }

  function handleContinueAfterReview() {
    if (workingPlan.conflicts.length > 0) {
      setShowMergePanel(true);
      return;
    }
    if (workingPlan.creates.length > 0) {
      setShowNewProductsPanel(true);
      return;
    }
    if (!canApply) return;
    void applyPlan(workingPlan.creates);
  }

  async function applyPlan(creates: VendorProductImportDraft[]) {
    if (creates.length === 0 && !confirmed) {
      setError('Please confirm you have reviewed the changes before updating the database.');
      return;
    }

    setSaving(true);
    setError(null);

    const planToApply: VendorProductImportPlan = { ...workingPlan, creates };

    try {
      await applyVendorProductImportPlan(planToApply, vendor);
      onApplied();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update vendor products.');
    } finally {
      setSaving(false);
    }
  }

  if (showMergePanel && workingPlan.conflicts.length > 0) {
    return (
      <VendorProductImportMergePanel
        conflicts={workingPlan.conflicts}
        initialResolutions={mergeResolutions}
        onClose={() => setShowMergePanel(false)}
        onComplete={handleMergeComplete}
      />
    );
  }

  if (showNewProductsPanel) {
    return (
      <VendorProductImportNewProductsPanel
        creates={workingPlan.creates}
        updateCount={workingPlan.updates.length}
        deactivationCount={workingPlan.deactivations.length}
        groupOptions={groupOptions}
        onClose={() => setShowNewProductsPanel(false)}
        onConfirm={async creates => {
          await applyPlan(creates);
        }}
      />
    );
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={() => !saving && onClose()} role="presentation" aria-hidden />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Vendor Product Import</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Review Template Changes</h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              {vendor.name} · {vendor.externalId}
            </p>
          </div>
          <button type="button" onClick={() => !saving && onClose()} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">New</p>
              <p className="text-lg font-semibold text-foreground">{summary.creates}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Updates</p>
              <p className="text-lg font-semibold text-foreground">{summary.updates}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Unchanged</p>
              <p className="text-lg font-semibold text-foreground">{summary.unchanged}</p>
            </div>
          </div>

          {workingPlan.errors.length > 0 && (
            <section className="rounded-lg border border-red-300/60 bg-red-50/50 dark:bg-red-950/20 px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle size={14} />
                <p className="text-xs font-semibold uppercase tracking-wider">Import errors</p>
              </div>
              {workingPlan.errors.map(err => (
                <p key={err} className="text-xs text-red-700 dark:text-red-300">{err}</p>
              ))}
            </section>
          )}

          {workingPlan.conflicts.length > 0 && (
            <section className="rounded-lg border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <GitMerge size={14} />
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    {workingPlan.conflicts.length} duplicate group{workingPlan.conflicts.length !== 1 ? 's' : ''} need merge
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMergePanel(true)}
                  className="text-xs font-bold px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700"
                >
                  Resolve Duplicates
                </button>
              </div>
            </section>
          )}

          {workingPlan.updates.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Updated Products</h4>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="border-b border-border">
                        <TableHeaderCell>Vendor Product ID</TableHeaderCell>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Changes</TableHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {workingPlan.updates.map(update => (
                        <tr key={update.existing.id} className="border-b border-border last:border-b-0 align-top">
                          <td className="px-3 py-2 font-sans text-muted-foreground">{update.draft.vendorProductId || update.existing.id}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{update.draft.productName}</td>
                          <td className="px-3 py-2">
                            <div className="space-y-1">
                              {update.changes.map(change => (
                                <p key={`${update.existing.id}-${change.field}`} className="text-[11px] text-muted-foreground">
                                  <span className="font-medium text-foreground">{change.label}:</span>{' '}
                                  <span className="line-through">{change.before || '—'}</span>
                                  {' → '}
                                  <span className="text-foreground">{change.after || '—'}</span>
                                </p>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {workingPlan.deactivations.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Will Be Deactivated</h4>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground space-y-1">
                {workingPlan.deactivations.map(item => (
                  <p key={item.existing.id}>
                    {item.existing.id} · {item.existing.productName}
                  </p>
                ))}
              </div>
            </section>
          )}

          {workingPlan.creates.length > 0 && workingPlan.conflicts.length === 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
                New Products ({workingPlan.creates.length})
              </h4>
              <p className="text-xs text-muted-foreground">
                Continue to review and edit all new products in an editable table before import.
              </p>
            </section>
          )}

          {totalChanges === 0 && workingPlan.errors.length === 0 && workingPlan.conflicts.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center">
              <CheckCircle2 size={20} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-foreground">No changes detected in the uploaded template.</p>
            </div>
          )}

          {canApply && workingPlan.creates.length === 0 && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground border border-border rounded-lg px-3 py-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I have reviewed the template changes and confirm updating the database
                ({summary.updates} update{summary.updates !== 1 ? 's' : ''}
                {summary.deactivations > 0 ? `, ${summary.deactivations} deactivation${summary.deactivations !== 1 ? 's' : ''}` : ''}).
              </span>
            </label>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
          {error && <p className="text-xs text-red-500 text-right">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <FileUp size={12} />
              {workingPlan.conflicts.length > 0
                ? 'Resolve duplicate products before continuing.'
                : workingPlan.creates.length > 0
                  ? 'Continue to edit new products before import.'
                  : 'Review complete — confirm to apply changes.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => !saving && onClose()}
                className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              {canApply && (
                <button
                  type="button"
                  disabled={saving || (workingPlan.creates.length === 0 && !confirmed)}
                  onClick={handleContinueAfterReview}
                  className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {workingPlan.creates.length > 0
                    ? 'Continue'
                    : saving
                      ? 'Saving…'
                      : 'Apply Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
