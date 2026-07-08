import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, GitMerge, X } from 'lucide-react';
import { api } from '../../api';
import {
  ensureComponentCatalogFromPlan,
  normalizeImportDraft,
  previewCatalogEnsuresFromPlan,
} from '../../data/componentCatalogConfig';
import {
  applyMergeResolutions,
  draftToComponentRow,
  type SmartComponentImportDraft,
  type SmartComponentImportPlan,
  type SmartComponentLocationScope,
} from '../../data/smartComponentCatalog';
import type { ComponentRow } from '../../data/componentForm';
import { rowToIngredient, mergeSavedRow } from './smartIngredientShared';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import {
  SIDE_PANEL_OVERLAY_CLS,
  SIDE_PANEL_SHELL_CREATE_VENDOR_CLS,
} from '../layout/sidePanelShared';
import { SmartComponentImportMergePanel } from './SmartComponentImportMergePanel';
import { SmartComponentImportNewComponentsPanel } from './SmartComponentImportNewComponentsPanel';

type Props = {
  plan: SmartComponentImportPlan;
  existingRows: ComponentRow[];
  locationScope?: SmartComponentLocationScope;
  onClose: () => void;
  onApplied: (rows: ComponentRow[]) => void;
};

function formatAppliedTimestamp(): string {
  return new Date().toLocaleString();
}

export function SmartComponentImportReviewPanel({
  plan,
  existingRows,
  locationScope,
  onClose,
  onApplied,
}: Props) {
  const [workingPlan, setWorkingPlan] = useState(plan);
  const [mergeResolutions, setMergeResolutions] = useState<Record<string, string>>({});
  const [showMergePanel, setShowMergePanel] = useState(plan.conflicts.length > 0);
  const [showNewComponentsPanel, setShowNewComponentsPanel] = useState(false);
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

  const catalogAdds = useMemo(
    () => previewCatalogEnsuresFromPlan(workingPlan, existingRows),
    [workingPlan, existingRows],
  );

  const hasCatalogAdds =
    catalogAdds.groups.length > 0
    || catalogAdds.recipeUoms.length > 0
    || catalogAdds.inventoryUoms.length > 0
    || catalogAdds.storages.length > 0;

  function handleMergeComplete(resolutions: Record<string, string>) {
    const mergedPlan = applyMergeResolutions(workingPlan, resolutions, existingRows, locationScope);
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
      setShowNewComponentsPanel(true);
    }
  }

  function handleContinueAfterReview() {
    if (workingPlan.conflicts.length > 0) {
      setShowMergePanel(true);
      return;
    }
    if (workingPlan.creates.length > 0) {
      setShowNewComponentsPanel(true);
      return;
    }
    if (!canApply) return;
    void applyPlan(workingPlan.creates);
  }

  async function applyPlan(creates: SmartComponentImportDraft[]) {
    if (creates.length === 0 && !confirmed) {
      setError('Please confirm you have reviewed the changes before updating the database.');
      return;
    }

    setSaving(true);
    setError(null);

    const planToApply: SmartComponentImportPlan = { ...workingPlan, creates };

    try {
      ensureComponentCatalogFromPlan(planToApply, existingRows);

      const existingIds = existingRows.map(row => row.componentId).filter(Boolean);
      const nextRows = [...existingRows];
      const appliedAt = formatAppliedTimestamp();

      for (const deactivation of planToApply.deactivations) {
        if (!deactivation.existing.id) continue;
        const inactiveRow = { ...deactivation.existing, active: false };
        const saved = await api.updateIngredient(deactivation.existing.id, rowToIngredient(inactiveRow));
        const merged = mergeSavedRow(saved, inactiveRow);
        const index = nextRows.findIndex(row => row.id === deactivation.existing.id);
        if (index >= 0) {
          nextRows[index] = { ...merged, active: false, updatedAt: saved.updatedAt ?? appliedAt };
        }
      }

      for (const update of planToApply.updates) {
        if (!update.existing.id) continue;
        const draft = normalizeImportDraft(update.draft, existingRows);
        const row = draftToComponentRow(draft, existingIds, update.existing);
        const saved = await api.updateIngredient(update.existing.id, rowToIngredient(row));
        const merged = mergeSavedRow(saved, row);
        const index = nextRows.findIndex(row => row.id === update.existing.id);
        if (index >= 0) {
          nextRows[index] = { ...merged, updatedAt: saved.updatedAt ?? appliedAt };
        }
      }

      for (const create of planToApply.creates) {
        const draft = normalizeImportDraft(create, existingRows);
        const row = draftToComponentRow(draft, existingIds);
        existingIds.push(row.componentId);
        const saved = await api.createIngredient(rowToIngredient(row));
        nextRows.unshift(mergeSavedRow(saved, row));
      }

      onApplied(nextRows);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update smart components.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={() => !saving && onClose()} role="presentation" aria-hidden />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Smart Component Import</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Review Template Changes</h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              Resolve duplicates first, then review new components before writing to the database.
            </p>
          </div>
          <button type="button" onClick={() => !saving && onClose()} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">New</p>
              <p className="text-lg font-semibold text-foreground">{summary.creates}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Updates</p>
              <p className="text-lg font-semibold text-foreground">{summary.updates}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Unchanged</p>
              <p className="text-lg font-semibold text-foreground">{summary.unchanged}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deactivate</p>
              <p className="text-lg font-semibold text-foreground">{summary.deactivations}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Errors</p>
              <p className={`text-lg font-semibold ${summary.errors > 0 ? 'text-red-500' : 'text-foreground'}`}>{summary.errors}</p>
            </div>
          </div>

          {workingPlan.conflicts.length > 0 && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 space-y-2">
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
                  className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 transition-colors"
                >
                  Resolve Duplicates
                </button>
              </div>
              <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1 list-disc pl-4">
                {workingPlan.conflicts.map(conflict => (
                  <li key={conflict.key}>{conflict.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {workingPlan.errors.length > 0 && (
            <div className="rounded-lg border border-red-300/60 bg-red-50/50 dark:bg-red-950/20 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle size={14} />
                <p className="text-xs font-semibold uppercase tracking-wider">Template Errors</p>
              </div>
              <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 list-disc pl-4">
                {workingPlan.errors.map((message, index) => (
                  <li key={`err-${index}`}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {hasCatalogAdds && (
            <section className="space-y-2">
              <h4 className="text-xs font-sans uppercase tracking-wider text-muted-foreground">New Catalog Values</h4>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground space-y-2">
                <p>These values are not in the system yet and will be added when you confirm:</p>
                {catalogAdds.groups.length > 0 && (
                  <p><span className="font-medium text-foreground">Groups:</span> {catalogAdds.groups.join(', ')}</p>
                )}
                {[...new Set([...catalogAdds.recipeUoms, ...catalogAdds.inventoryUoms])].length > 0 && (
                  <p>
                    <span className="font-medium text-foreground">UOMs:</span>{' '}
                    {[...new Set([...catalogAdds.recipeUoms, ...catalogAdds.inventoryUoms])].join(', ')}
                  </p>
                )}
                {catalogAdds.storages.length > 0 && (
                  <p><span className="font-medium text-foreground">Storage:</span> {catalogAdds.storages.join(', ')}</p>
                )}
              </div>
            </section>
          )}

          {workingPlan.updates.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Updated Components</h4>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="border-b border-border">
                        <TableHeaderCell>Component ID</TableHeaderCell>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Changes</TableHeaderCell>
                        <TableHeaderCell>Previous Updated</TableHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {workingPlan.updates.map(update => (
                        <tr key={update.existing.id ?? update.existing.componentId} className="border-b border-border last:border-b-0 align-top">
                          <td className="px-3 py-2 font-sans text-muted-foreground">{update.draft.componentId || update.existing.componentId}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{update.draft.name}</td>
                          <td className="px-3 py-2">
                            <div className="space-y-1">
                              {update.changes.map(change => (
                                <p key={`${update.existing.componentId}-${change.field}`} className="text-[11px] text-muted-foreground">
                                  <span className="font-medium text-foreground">{change.label}:</span>{' '}
                                  <span className="line-through">{change.before || '—'}</span>
                                  {' → '}
                                  <span className="text-foreground">{change.after || '—'}</span>
                                </p>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {update.existing.updatedAt
                              ? new Date(update.existing.updatedAt).toLocaleString()
                              : '—'}
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
                  <p key={item.existing.id ?? item.existing.componentId}>
                    {item.existing.componentId || item.existing.name} · {item.existing.name}
                  </p>
                ))}
              </div>
            </section>
          )}

          {workingPlan.creates.length > 0 && workingPlan.conflicts.length === 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
                New Components ({workingPlan.creates.length})
              </h4>
              <p className="text-xs text-muted-foreground">
                Continue to review and edit all new components in an editable table before import.
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
                ? 'Resolve duplicate components before continuing.'
                : workingPlan.creates.length > 0
                  ? 'Continue to edit new components before import.'
                  : 'Review complete — confirm to apply changes with updated timestamps.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              {workingPlan.conflicts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowMergePanel(true)}
                  className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors"
                >
                  Resolve Duplicates
                </button>
              ) : workingPlan.creates.length > 0 ? (
                <button
                  type="button"
                  onClick={handleContinueAfterReview}
                  className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors"
                >
                  Review New Components
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void applyPlan([])}
                  disabled={saving || !canApply || !confirmed}
                  className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Updating…' : 'Confirm Update DB'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showMergePanel && workingPlan.conflicts.length > 0 && (
        <SmartComponentImportMergePanel
          conflicts={workingPlan.conflicts}
          initialResolutions={mergeResolutions}
          onClose={() => setShowMergePanel(false)}
          onComplete={handleMergeComplete}
        />
      )}

      {showNewComponentsPanel && workingPlan.creates.length > 0 && (
        <SmartComponentImportNewComponentsPanel
          creates={workingPlan.creates}
          updateCount={workingPlan.updates.length}
          deactivationCount={workingPlan.deactivations.length}
          onClose={() => setShowNewComponentsPanel(false)}
          onConfirm={async creates => {
            setWorkingPlan(prev => ({ ...prev, creates }));
            setShowNewComponentsPanel(false);
            await applyPlan(creates);
          }}
        />
      )}
    </>
  );
}
