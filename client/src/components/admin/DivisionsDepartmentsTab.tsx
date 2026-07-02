import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { hrApi } from '../../modules/hr/api';
import type { DivisionTreeNode } from '../../modules/hr/types';
import { inputCls, selectCls } from '../../data/countries';

const emptyDivision = { name: '', code: '' };
const emptyDepartment = { name: '', divisionId: 0 };

type DivisionDeptTableRow =
  | { kind: 'empty'; division: DivisionTreeNode }
  | { kind: 'department'; division: DivisionTreeNode; department: DivisionTreeNode['departments'][number] };

export function DivisionsDepartmentsTab({ onDataChanged }: { onDataChanged?: () => void }) {
  const [tree, setTree] = useState<DivisionTreeNode[]>([]);
  const [showDivisionForm, setShowDivisionForm] = useState(false);
  const [editingDivision, setEditingDivision] = useState<DivisionTreeNode | null>(null);
  const [divisionForm, setDivisionForm] = useState({ ...emptyDivision });
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<{ id: number; name: string; divisionId: number } | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ ...emptyDepartment });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setTree(await hrApi.org.tree());
  }, []);

  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : String(e))); }, [load]);

  async function submitDivision() {
    if (!divisionForm.name.trim()) return;
    const payload = { name: divisionForm.name.trim(), code: divisionForm.code.trim() || null };
    if (editingDivision) await hrApi.org.divisions.update(editingDivision.id, payload);
    else await hrApi.org.divisions.create(payload);
    setShowDivisionForm(false);
    setEditingDivision(null);
    setDivisionForm({ ...emptyDivision });
    await load();
    onDataChanged?.();
  }

  async function submitDepartment() {
    if (!departmentForm.name.trim() || !departmentForm.divisionId) return;
    const payload = { name: departmentForm.name.trim(), divisionId: departmentForm.divisionId };
    if (editingDepartment) await hrApi.org.departments.update(editingDepartment.id, payload);
    else await hrApi.org.departments.create(payload);
    setShowDepartmentForm(false);
    setEditingDepartment(null);
    setDepartmentForm({ ...emptyDepartment });
    await load();
    onDataChanged?.();
  }

  function openAddDivision() {
    setEditingDivision(null);
    setDivisionForm({ ...emptyDivision });
    setShowDivisionForm(true);
  }

  function openEditDivision(division: DivisionTreeNode) {
    setEditingDivision(division);
    setDivisionForm({ name: division.name, code: division.code ?? '' });
    setShowDivisionForm(true);
  }

  function openAddDepartment(divisionId: number) {
    setEditingDepartment(null);
    setDepartmentForm({ name: '', divisionId });
    setShowDepartmentForm(true);
  }

  function openEditDepartment(department: { id: number; name: string; divisionId: number }) {
    setEditingDepartment(department);
    setDepartmentForm({ name: department.name, divisionId: department.divisionId });
    setShowDepartmentForm(true);
  }

  async function removeDivision(id: number) {
    if (!confirm('Delete this division and all its departments?')) return;
    await hrApi.org.divisions.remove(id);
    await load();
    onDataChanged?.();
  }

  async function removeDepartment(id: number) {
    if (!confirm('Delete this department?')) return;
    await hrApi.org.departments.remove(id);
    await load();
    onDataChanged?.();
  }

  const divisionTableRows = useMemo((): DivisionDeptTableRow[] => {
    const rows: DivisionDeptTableRow[] = [];
    for (const division of tree) {
      if (division.departments.length === 0) {
        rows.push({ kind: 'empty', division });
      } else {
        for (const department of division.departments) {
          rows.push({ kind: 'department', division, department });
        }
      }
    }
    return rows;
  }, [tree]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedDivisionRows,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(divisionTableRows, { scrollRootRef });

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">{error}</div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">Organize company structure by division and department</p>
        <button
          type="button"
          onClick={openAddDivision}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-2 rounded-md hover:opacity-90"
        >
          <Plus size={14} /> Add Division
        </button>
      </div>

      {showDivisionForm && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editingDivision ? 'Edit Division' : 'New Division'}</h3>
            <button type="button" onClick={() => { setShowDivisionForm(false); setEditingDivision(null); }} className="p-1 rounded hover:bg-muted">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Division Name *</label>
              <input className={`${inputCls} mt-1`} value={divisionForm.name} onChange={e => setDivisionForm({ ...divisionForm, name: e.target.value })} placeholder="e.g. Operations" />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Code</label>
              <input className={`${inputCls} mt-1`} value={divisionForm.code} onChange={e => setDivisionForm({ ...divisionForm, code: e.target.value })} placeholder="e.g. OPS" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void submitDivision()} className="text-xs font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-md">
              {editingDivision ? 'Save Changes' : 'Add Division'}
            </button>
            <button type="button" onClick={() => { setShowDivisionForm(false); setEditingDivision(null); }} className="text-xs px-4 py-2 rounded-md border border-border hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDepartmentForm && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editingDepartment ? 'Edit Department' : 'New Department'}</h3>
            <button type="button" onClick={() => { setShowDepartmentForm(false); setEditingDepartment(null); }} className="p-1 rounded hover:bg-muted">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Department Name *</label>
              <input className={`${inputCls} mt-1`} value={departmentForm.name} onChange={e => setDepartmentForm({ ...departmentForm, name: e.target.value })} placeholder="e.g. Kitchen" />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Division *</label>
              <select
                className={`${selectCls} mt-1`}
                value={departmentForm.divisionId || ''}
                onChange={e => setDepartmentForm({ ...departmentForm, divisionId: Number(e.target.value) })}
              >
                <option value="">Select division</option>
                {tree.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void submitDepartment()} className="text-xs font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-md">
              {editingDepartment ? 'Save Changes' : 'Add Department'}
            </button>
            <button type="button" onClick={() => { setShowDepartmentForm(false); setEditingDepartment(null); }} className="text-xs px-4 py-2 rounded-md border border-border hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {tree.length === 0 ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {['Division', 'Code', 'Department', 'Actions'].map(h => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 font-sans text-xs uppercase tracking-wider text-muted-foreground ${
                      h === 'Actions' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No divisions yet. Add a division to get started.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <TableScrollContainer ref={scrollRootRef} className="bg-card border border-border rounded-lg overflow-hidden max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {['Division', 'Code', 'Department', 'Actions'].map(h => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 font-sans text-xs uppercase tracking-wider text-muted-foreground ${
                      h === 'Actions' ? 'text-right' : 'text-left'
                    } ${h === 'Code' ? 'w-28' : ''} ${h === 'Actions' ? 'w-44' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedDivisionRows.map(row => {
                if (row.kind === 'empty') {
                  const division = row.division;
                  return (
                    <tr key={`division-${division.id}`} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{division.name}</td>
                      <td className="px-4 py-3 font-sans text-muted-foreground">{division.code || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground italic">No departments</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => openAddDepartment(division.id)} className="flex items-center gap-1 px-2 py-1 text-primary hover:bg-muted rounded-md">
                            <Plus size={12} /> Department
                          </button>
                          <button type="button" onClick={() => openEditDivision(division)} className="p-1.5 rounded hover:bg-muted text-primary" title="Edit division">
                            <Edit2 size={13} />
                          </button>
                          <button type="button" onClick={() => void removeDivision(division.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Delete division">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const { division, department } = row;
                return (
                  <tr key={department.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{division.name}</td>
                    <td className="px-4 py-3 font-sans text-muted-foreground">{division.code || '—'}</td>
                    <td className="px-4 py-3">{department.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openAddDepartment(division.id)} className="flex items-center gap-1 px-2 py-1 text-primary hover:bg-muted rounded-md">
                          <Plus size={12} /> Department
                        </button>
                        <button type="button" onClick={() => openEditDivision(division)} className="p-1.5 rounded hover:bg-muted text-primary" title="Edit division">
                          <Edit2 size={13} />
                        </button>
                        <button type="button" onClick={() => void removeDivision(division.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Delete division">
                          <Trash2 size={13} />
                        </button>
                        <button type="button" onClick={() => openEditDepartment(department)} className="p-1.5 rounded hover:bg-muted text-primary" title="Edit department">
                          <Edit2 size={13} />
                        </button>
                        <button type="button" onClick={() => void removeDepartment(department.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Delete department">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <InfiniteScrollTableSentinel colSpan={4} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
            </tbody>
          </table>
        </TableScrollContainer>
      )}
    </div>
  );
}
