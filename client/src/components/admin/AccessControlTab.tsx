import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import {
  ACCESS_CONTROL_MODULE_ORDER,
  ACCESS_CONTROL_ROWS,
  defaultAccessControlTypes,
  ensureSuperUserMatrixGrants,
  isAccessControlRestrictionRow,
  isSuperUserAccessType,
  parseAccessControlMatrix,
  parseAccessControlTypes,
  serializeAccessControlMatrix,
  serializeAccessControlTypes,
  setAllTasksForType,
  setTaskAllowedForType,
  type AccessControlMatrix,
  type AccessControlType,
} from '../../data/accessControlCatalog';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { filterSelectCls } from '../layout/formControls';
import { TableLoadingRow } from '../shared/MillstoneLoader';

const ALL_MODULES = '';
/** Wide enough for renamed role labels + the column “tick all” checkbox. */
const acColumnCls =
  'w-[5.75rem] min-w-[5.75rem] px-1 py-1.5 text-center border-l border-border/40 align-middle';
const acHeaderInputCls =
  'bg-card border border-border rounded px-1 py-1 text-[11px] font-medium text-center w-full min-w-0 leading-tight';

export function AccessControlTab() {
  const [types, setTypes] = useState<AccessControlType[]>(() => defaultAccessControlTypes());
  const [matrix, setMatrix] = useState<AccessControlMatrix>({});
  const [moduleFilter, setModuleFilter] = useState(ALL_MODULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const moduleOptions = useMemo(() => {
    const present = new Set(ACCESS_CONTROL_ROWS.map(row => row.module));
    const ordered: string[] = ACCESS_CONTROL_MODULE_ORDER.filter(module => present.has(module));
    for (const module of present) {
      if (!ordered.includes(module)) ordered.push(module);
    }
    return ordered;
  }, []);

  const filteredRows = useMemo(
    () => (moduleFilter
      ? ACCESS_CONTROL_ROWS.filter(row => row.module === moduleFilter)
      : ACCESS_CONTROL_ROWS),
    [moduleFilter],
  );

  const {
    visibleItems: pagedRows,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(filteredRows, { scrollRootRef });

  useEffect(() => {
    setLoading(true);
    api.accessControl()
      .then(async data => {
        const nextTypes = parseAccessControlTypes(data.typesJson);
        const loadedMatrix = parseAccessControlMatrix(data.matrixJson);
        const nextMatrix = ensureSuperUserMatrixGrants(loadedMatrix, nextTypes);
        setTypes(nextTypes);
        setMatrix(nextMatrix);

        // Persist Super User grants when the catalog gains new line items.
        const typesJson = serializeAccessControlTypes(nextTypes);
        const matrixJson = serializeAccessControlMatrix(nextMatrix);
        const typesChanged = typesJson !== (data.typesJson?.trim() || '[]');
        const matrixChanged = matrixJson !== (data.matrixJson?.trim() || '{}');
        if (typesChanged || matrixChanged) {
          try {
            await api.updateAccessControl({ typesJson, matrixJson });
          } catch {
            // Keep UI grants even if background persist fails; Save still works.
          }
        }
      })
      .catch(() => {
        const fallbackTypes = defaultAccessControlTypes();
        setTypes(fallbackTypes);
        setMatrix(ensureSuperUserMatrixGrants({}, fallbackTypes));
        setError('Could not load access control settings.');
      })
      .finally(() => setLoading(false));
  }, []);

  const columnCount = 3 + types.length;

  const grantRows = useMemo(
    () => filteredRows.filter(row => !isAccessControlRestrictionRow(row)),
    [filteredRows],
  );

  const typeColumnStates = useMemo(
    () => types.map(type => {
      const superUser = isSuperUserAccessType(type);
      const allowedCount = grantRows.filter(row =>
        superUser || matrix[row.key]?.[type.id],
      ).length;
      return {
        type,
        superUser,
        allSelected: grantRows.length > 0 && allowedCount === grantRows.length,
        someSelected: !superUser && allowedCount > 0 && allowedCount < grantRows.length,
      };
    }),
    [types, matrix, grantRows],
  );

  function updateTypeLabel(index: number, label: string) {
    setTypes(prev => {
      const next = prev.map((type, i) => (i === index ? { ...type, label } : type));
      setMatrix(current => ensureSuperUserMatrixGrants(current, next));
      return next;
    });
    setMessage(null);
    setError(null);
  }

  function toggleCell(rowKey: string, typeId: string) {
    const type = types.find(t => t.id === typeId);
    const row = ACCESS_CONTROL_ROWS.find(r => r.key === rowKey);
    if (
      type
      && isSuperUserAccessType(type)
      && row
      && !isAccessControlRestrictionRow(row)
    ) {
      return;
    }
    const current = !!matrix[rowKey]?.[typeId];
    setMatrix(prev => setTaskAllowedForType(prev, rowKey, typeId, !current, types));
    setMessage(null);
    setError(null);
  }

  function toggleColumn(typeId: string, allowed: boolean) {
    const type = types.find(t => t.id === typeId);
    if (type && isSuperUserAccessType(type) && !allowed) return;
    setMatrix(prev => setAllTasksForType(prev, typeId, allowed, filteredRows, types));
    setMessage(null);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextMatrix = ensureSuperUserMatrixGrants(matrix, types);
      setMatrix(nextMatrix);
      await api.updateAccessControl({
        typesJson: serializeAccessControlTypes(types),
        matrixJson: serializeAccessControlMatrix(nextMatrix),
      });
      setMessage('Access control settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save access control settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Define eight access control types and tick which module functions and tasks each type may perform —
            covering Home &amp; Reports, Platform Config, Revenue Management, Point of Sales, Human Resource Management,
            Accounting, and <span className="font-medium text-foreground">Web App Access</span> (Bisync RMS Web / mobile).
            The first column defaults to <span className="font-medium text-foreground">Super User</span> and stays
            fully granted for every task (including newly added line items). Other column headers can be renamed to
            match your organisation roles.
            Under Revenue Management → Policies, <span className="font-medium text-foreground">Price Hide Policy</span> means
            users on that level see quantities only (no unit prices or amounts). Column “tick all” does not enable Policies.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading}
          className="text-xs font-bold bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50 shrink-0"
        >
          {saving ? 'Saving…' : 'Save Access Control'}
        </button>
      </div>

      {error ? (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="px-4 py-3 bg-[#5A7A2A]/10 border border-[#5A7A2A]/20 text-[#5A7A2A] rounded-lg text-xs">
          {message}
        </div>
      ) : null}

      <div data-page-filters className="flex flex-wrap items-center gap-3 bg-background/95 backdrop-blur-sm py-2 border-b border-border/60">
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground shrink-0">Module</span>
          <select
            className={`${filterSelectCls} min-w-[220px]`}
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
          >
            <option value={ALL_MODULES}>All modules</option>
            {moduleOptions.map(module => (
              <option key={module} value={module}>{module}</option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          {moduleFilter
            ? `${filteredRows.length} of ${ACCESS_CONTROL_ROWS.length} tasks`
            : `${ACCESS_CONTROL_ROWS.length} tasks`}
        </p>
      </div>

      <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-16rem)] overflow-auto border border-border rounded-lg">
        <table className="w-full text-xs min-w-[1080px]">
          <colgroup>
            <col className="w-[10rem]" />
            <col className="w-[12rem]" />
            <col />
            {types.map(type => (
              <col key={type.id} className="w-[5.75rem]" />
            ))}
          </colgroup>
          <thead className="bg-muted/40 sticky top-0 z-10">
            <tr className="border-b border-border">
              <TableHeaderCell>Module</TableHeaderCell>
              <TableHeaderCell className="min-w-[12rem]">Function</TableHeaderCell>
              <TableHeaderCell>Task</TableHeaderCell>
              {typeColumnStates.map(({ type, allSelected, someSelected, superUser }, index) => (
                <th key={type.id} className={`${acColumnCls} align-top`}>
                  <div className="flex flex-col items-center gap-1.5">
                    <input
                      className={acHeaderInputCls}
                      value={type.label}
                      onChange={e => updateTypeLabel(index, e.target.value)}
                      aria-label={`Access control type ${index + 1} label`}
                      title={type.label}
                    />
                    <label
                      className={`inline-flex flex-col items-center gap-0.5 ${superUser ? 'cursor-default' : 'cursor-pointer'}`}
                      title={superUser ? `${type.label} always has all tasks` : `Select all for ${type.label}`}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={allSelected}
                        disabled={superUser}
                        ref={el => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={e => toggleColumn(type.id, e.target.checked)}
                        aria-label={`Select all tasks for ${type.label}`}
                      />
                      <span className="text-[9px] font-sans uppercase tracking-wide text-muted-foreground leading-none">
                        {superUser ? 'All*' : 'All'}
                      </span>
                    </label>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={columnCount} label="Loading access control matrix…" />
            ) : pagedRows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center text-muted-foreground">
                  {moduleFilter ? 'No tasks match the selected module.' : 'No tasks configured.'}
                </td>
              </tr>
            ) : (
              pagedRows.map(row => {
                const restriction = isAccessControlRestrictionRow(row);
                return (
                <tr
                  key={row.key}
                  className={`border-b border-border/50 hover:bg-muted/20 ${restriction ? 'bg-amber-500/5' : ''}`}
                >
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{row.module}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap min-w-[12rem]">{row.function}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.task}
                    {restriction ? (
                      <span className="block text-[10px] text-amber-800 dark:text-amber-200 font-normal">
                        Restriction — tick to hide prices
                      </span>
                    ) : null}
                  </td>
                  {types.map(type => {
                    const superUserGrant =
                      isSuperUserAccessType(type) && !restriction;
                    return (
                      <td key={`${row.key}-${type.id}`} className={acColumnCls}>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-primary"
                          checked={superUserGrant || !!matrix[row.key]?.[type.id]}
                          disabled={superUserGrant}
                          onChange={() => toggleCell(row.key, type.id)}
                          aria-label={`${type.label} — ${row.task}`}
                          title={superUserGrant ? 'Super User always has this task' : undefined}
                        />
                      </td>
                    );
                  })}
                </tr>
                );
              })
            )}
            <InfiniteScrollTableSentinel
              colSpan={columnCount}
              hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize}
              sentinelRef={sentinelRef}
              visibleCount={visibleCount}
              totalCount={totalCount}
            />
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  );
}
