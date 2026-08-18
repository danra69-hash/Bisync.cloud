import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  api,
  type PosProductMapping,
  type Product,
} from '../../api';
import { inputCls } from '../../data/countries';
import { pageShellClass } from '../layout/pageLayout';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { ToggleSwitch } from '../admin/ToggleSwitch';

type Props = {
  selectedCompanyId: number | null;
  embedded?: boolean;
  /** Page heading — Products nav uses External POS Mapping; Sales tab uses POS Mapping. */
  title?: string;
};

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';

export function PosMappingSchedulerPage({
  selectedCompanyId,
  embedded = false,
  title = 'External POS Mapping',
}: Props) {
  const [rows, setRows] = useState<PosProductMapping[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productId, setProductId] = useState('');
  const [pluNumber, setPluNumber] = useState('');
  const [active, setActive] = useState(true);

  async function load(companyId: number) {
    setLoading(true);
    setError(null);
    try {
      const [mappingRows, productRows] = await Promise.all([
        api.posProductMappings(companyId),
        api.products(companyId),
      ]);
      setRows(mappingRows);
      setProducts(productRows.filter(p => p.active && !p.isSubProduct));
    } catch (err) {
      setRows([]);
      setProducts([]);
      setError(err instanceof Error ? err.message : 'Failed to load POS mappings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedCompanyId) {
      setRows([]);
      setProducts([]);
      return;
    }
    void load(selectedCompanyId);
  }, [selectedCompanyId]);

  const mappedProductIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of rows) {
      if (editingId != null && row.id === editingId) continue;
      ids.add(row.productId);
    }
    return ids;
  }, [rows, editingId]);

  const productOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter(p => !mappedProductIds.has(p.id) || (editingId != null && Number(productId) === p.id))
      .filter(p => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q)
          || p.productId.toLowerCase().includes(q)
          || p.group.toLowerCase().includes(q)
          || p.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.productId.localeCompare(b.productId));
  }, [products, mappedProductIds, editingId, productId, search]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row =>
      row.productName.toLowerCase().includes(q)
      || row.productCode.toLowerCase().includes(q)
      || row.pluNumber.toLowerCase().includes(q),
    );
  }, [rows, search]);

  function resetForm() {
    setEditingId(null);
    setProductId('');
    setPluNumber('');
    setActive(true);
    setShowForm(false);
    setError(null);
  }

  function startCreate() {
    setEditingId(null);
    setProductId('');
    setPluNumber('');
    setActive(true);
    setShowForm(true);
    setError(null);
  }

  function startEdit(row: PosProductMapping) {
    setEditingId(row.id);
    setProductId(String(row.productId));
    setPluNumber(row.pluNumber);
    setActive(row.active);
    setShowForm(true);
    setError(null);
  }

  async function handleSave() {
    if (!selectedCompanyId) return;
    const pid = Number(productId);
    if (!Number.isFinite(pid) || pid <= 0) {
      setError('Select a product.');
      return;
    }
    const plu = pluNumber.trim();
    if (!plu) {
      setError('Enter the PLU / POS product number.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        companyId: selectedCompanyId,
        productId: pid,
        pluNumber: plu,
        active,
      };
      if (editingId != null) {
        await api.updatePosProductMapping(editingId, payload);
      } else {
        await api.createPosProductMapping(payload);
      }
      resetForm();
      await load(selectedCompanyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save POS mapping.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(row: PosProductMapping) {
    if (!selectedCompanyId) return;
    setError(null);
    try {
      const updated = await api.setPosProductMappingActive(row.id, !row.active);
      setRows(prev => prev.map(r => (r.id === row.id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update mapping status.');
    }
  }

  async function handleDelete(row: PosProductMapping) {
    if (!selectedCompanyId) return;
    if (!window.confirm(`Remove POS mapping for "${row.productName}" (PLU ${row.pluNumber})?`)) return;
    setError(null);
    try {
      await api.deletePosProductMapping(row.id);
      if (editingId === row.id) resetForm();
      await load(selectedCompanyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete POS mapping.');
    }
  }

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass({ embedded })}>
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-10 text-center">
          Select a company in the header to manage POS product mappings.
        </p>
      </div>
    );
  }

  return (
    <div className={pageShellClass({ embedded })}>
      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Map each catalog product to its external POS PLU number (POS product number).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search product or PLU…"
              className={`${inputCls} w-48 sm:w-56`}
            />
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              <Plus size={12} />
              Add mapping
            </button>
          </div>
        </div>

        {error ? (
          <div className="mx-4 mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {showForm ? (
          <div className="mx-4 mt-3 rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">
                {editingId != null ? 'Edit mapping' : 'New mapping'}
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="pos-map-product">
                  Product
                </label>
                <select
                  id="pos-map-product"
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select product…</option>
                  {productOptions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.productId}
                      {p.posEnabled ? ' · POS' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="pos-map-plu">
                  PLU / POS product number
                </label>
                <input
                  id="pos-map-plu"
                  value={pluNumber}
                  onChange={e => setPluNumber(e.target.value)}
                  placeholder="e.g. 1001"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</p>
                <div className="pt-1.5">
                  <ToggleSwitch checked={active} onChange={setActive} label={active ? 'Active' : 'Inactive'} />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId != null ? 'Save changes' : 'Save mapping'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="p-4 pt-3">
          <TableScrollContainer className="max-h-[min(60vh,32rem)] overflow-y-auto rounded-lg border border-border">
            <table className="w-full">
              <ColGroup widths={['34%', '16%', '16%', '12%', 140]} />
              <thead className="bg-muted/30">
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-left font-semibold">Product ID</th>
                  <th className="px-3 py-2 text-left font-semibold">PLU / POS #</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10">
                      <MillstoneLoader size="sm" layout="block" label="Loading POS mappings…" />
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-xs text-muted-foreground">
                      {rows.length === 0
                        ? 'No POS product mappings yet. Add a product and its PLU number.'
                        : 'No mappings match this search.'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(row => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className={tdCls}>
                        <p className="font-medium">{row.productName}</p>
                      </td>
                      <td className={`${tdCls} font-sans text-muted-foreground`}>{row.productCode || '—'}</td>
                      <td className={`${tdCls} font-sans font-medium tabular-nums`}>{row.pluNumber}</td>
                      <td className={tdCls}>
                        <ToggleSwitch
                          checked={row.active}
                          onChange={() => void handleToggleActive(row)}
                          label={row.active ? 'Active' : 'Inactive'}
                        />
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[11px] hover:bg-muted"
                          >
                            <Pencil size={11} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[11px] text-muted-foreground hover:text-destructive hover:border-destructive/40"
                          >
                            <Trash2 size={11} />
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      </section>
    </div>
  );
}
