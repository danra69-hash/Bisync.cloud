import { useMemo, useState } from 'react';
import { AlertTriangle, GitMerge, X } from 'lucide-react';
import {
  MERGE_COMPARE_FIELDS,
  buildMergeDisplayFromDraft,
  type SmartComponentImportConflict,
} from '../../data/smartComponentCatalog';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import {
  SIDE_PANEL_OVERLAY_CLS,
  SIDE_PANEL_SHELL_CREATE_VENDOR_CLS,
} from '../layout/sidePanelShared';

type Props = {
  conflicts: SmartComponentImportConflict[];
  initialResolutions?: Record<string, string>;
  onClose: () => void;
  onComplete: (resolutions: Record<string, string>) => void;
};

export function SmartComponentImportMergePanel({
  conflicts,
  initialResolutions = {},
  onClose,
  onComplete,
}: Props) {
  const [resolutions, setResolutions] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = { ...initialResolutions };
    for (const conflict of conflicts) {
      if (!next[conflict.key]) {
        next[conflict.key] = conflict.candidates[0]?.key ?? '';
      }
    }
    return next;
  });
  const [activeConflictKey, setActiveConflictKey] = useState(conflicts[0]?.key ?? '');

  const activeConflict = useMemo(
    () => conflicts.find(conflict => conflict.key === activeConflictKey) ?? conflicts[0],
    [activeConflictKey, conflicts],
  );

  const resolvedCount = conflicts.filter(conflict => Boolean(resolutions[conflict.key])).length;
  const allResolved = resolvedCount === conflicts.length;

  function selectWinner(conflictKey: string, winnerKey: string) {
    setResolutions(prev => ({ ...prev, [conflictKey]: winnerKey }));
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Smart Component Import</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5 inline-flex items-center gap-2">
              <GitMerge size={14} className="text-primary" />
              Merge Duplicate Components
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              Compare duplicate records and choose which one to keep active. Records not selected will be deactivated.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4 space-y-4">
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle size={14} />
              <p className="text-xs font-semibold uppercase tracking-wider">
                {conflicts.length} duplicate group{conflicts.length !== 1 ? 's' : ''} · {resolvedCount} resolved
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {conflicts.map((conflict, index) => {
              const selected = resolutions[conflict.key];
              return (
                <button
                  key={conflict.key}
                  type="button"
                  onClick={() => setActiveConflictKey(conflict.key)}
                  className={`text-xs font-sans rounded-md border px-3 py-1.5 transition-colors ${
                    activeConflict?.key === conflict.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {index + 1}. {conflict.candidates[0]?.draft.name || 'Duplicate'}
                  {selected ? ' ✓' : ''}
                </button>
              );
            })}
          </div>

          {activeConflict && (
            <section className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">{activeConflict.reason}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the record to keep. All other database records in this group will be deactivated.
                </p>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-[50vh]">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="border-b border-border">
                        <TableHeaderCell className="w-28">Keep</TableHeaderCell>
                        <TableHeaderCell>Source</TableHeaderCell>
                        {MERGE_COMPARE_FIELDS.map(field => (
                          <TableHeaderCell key={field.key}>{field.label}</TableHeaderCell>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeConflict.candidates.map(candidate => {
                        const display = buildMergeDisplayFromDraft(candidate.draft, candidate.label);
                        const selected = resolutions[activeConflict.key] === candidate.key;
                        return (
                          <tr
                            key={candidate.key}
                            className={`border-b border-border last:border-b-0 align-top ${
                              selected ? 'bg-primary/5' : ''
                            }`}
                          >
                            <td className="px-3 py-2">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`merge-${activeConflict.key}`}
                                  checked={selected}
                                  onChange={() => selectWinner(activeConflict.key, candidate.key)}
                                />
                                <span className="text-[11px] text-muted-foreground">
                                  {selected ? 'Selected' : 'Select'}
                                </span>
                              </label>
                            </td>
                            <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                              {display.sourceLabel}
                            </td>
                            {MERGE_COMPARE_FIELDS.map(field => (
                              <td key={field.key} className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                {field.key === 'active'
                                  ? (display.active ? 'Yes' : 'No')
                                  : (display[field.key] || '—')}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!allResolved}
              onClick={() => onComplete(resolutions)}
              className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Save Merge Choices
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
