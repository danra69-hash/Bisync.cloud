import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { api, type Product } from '../../api';
import { blankComponentRow } from '../../data/componentForm';
import { componentMatchesLocations, formatRm } from '../../data/createOrder';
import {
  blankProductLine,
  calcLineSubtotal,
  calcTotalCost,
  generateProductId,
  isProductLineFilled,
  productLineFromComponent,
  type ProductLine,
} from '../../data/productForm';
import { siCategories, siGroups } from '../../data/revenueManagement';
import { ComponentEditPanel } from './ComponentEditPanel';
import { GroupEditPanel, type GroupRow } from './GroupEditPanel';
import { ingredientToRow, mergeSavedRow, rowToIngredient } from './smartIngredientShared';
import { SmartComponentPicker } from './SmartComponentPicker';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const fieldCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const labelCls = 'text-xs font-medium text-foreground';
const thCls = 'px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/20';
const tdCls = 'px-3 py-2 text-xs border-b border-border align-middle';
const addBtnCls =
  'shrink-0 inline-flex items-center justify-center h-[34px] w-[34px] rounded-md border border-border bg-background hover:bg-muted/40 text-muted-foreground';

const EXTRA_GROUPS_KEY = 'bisync.productExtraGroups';
const categoryOptions = siCategories.filter(c => c !== 'All');

function loadExtraGroups(): string[] {
  try {
    const raw = localStorage.getItem(EXTRA_GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveExtraGroups(groups: string[]) {
  localStorage.setItem(EXTRA_GROUPS_KEY, JSON.stringify(groups));
}

export function ProductsPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const [name, setName] = useState('');
  const [isSubProduct, setIsSubProduct] = useState(false);
  const [productId, setProductId] = useState('');
  const [category, setCategory] = useState('');
  const [group, setGroup] = useState('');
  const [b2cEnabled, setB2cEnabled] = useState(true);
  const [b2bEnabled, setB2bEnabled] = useState(false);
  const [lines, setLines] = useState<ProductLine[]>([blankProductLine()]);

  const [components, setComponents] = useState<ReturnType<typeof ingredientToRow>[]>([]);
  const [extraGroups, setExtraGroups] = useState<string[]>(() => loadExtraGroups());
  const [editingGroup, setEditingGroup] = useState<GroupRow | null>(null);
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [componentEditorLineKey, setComponentEditorLineKey] = useState<string | null>(null);
  const [editComponentRow, setEditComponentRow] = useState<ReturnType<typeof ingredientToRow> | null>(null);
  const [isNewComponent, setIsNewComponent] = useState(false);
  const [componentSaveError, setComponentSaveError] = useState<string | null>(null);

  const groupOptions = useMemo(() => {
    const fromComponents = components.map(c => c.group).filter(Boolean);
    const merged = new Set([
      ...siGroups.filter(g => g !== 'All'),
      ...extraGroups,
      ...fromComponents,
      ...(group ? [group] : []),
    ]);
    return [...merged].sort((a, b) => a.localeCompare(b));
  }, [components, extraGroups, group]);

  const loadComponents = useCallback(() => {
    if (!orgReady) {
      setComponents([]);
      return Promise.resolve();
    }
    setLoading(true);
    return api.ingredients()
      .then(rows => setComponents(rows.map(ingredientToRow)))
      .catch(() => setComponents([]))
      .finally(() => setLoading(false));
  }, [orgReady]);

  const loadSavedProducts = useCallback(() => {
    if (!selectedCompanyId) {
      setSavedProducts([]);
      return;
    }
    api.products(selectedCompanyId)
      .then(setSavedProducts)
      .catch(() => setSavedProducts([]));
  }, [selectedCompanyId]);

  useEffect(() => {
    loadSavedProducts();
  }, [loadSavedProducts]);

  useEffect(() => {
    void loadComponents();
  }, [loadComponents]);

  const availableComponents = useMemo(
    () => components.filter(c => c.active && componentMatchesLocations(c, selectedLocationIds)),
    [components, selectedLocationIds],
  );

  const existingProductIds = useMemo(
    () => savedProducts.map(p => p.productId),
    [savedProducts],
  );

  useEffect(() => {
    if (selectedProductId) return;
    if (!name.trim()) {
      setProductId('');
      return;
    }
    const kind = isSubProduct ? 'subproduct' : 'product';
    setProductId(generateProductId(name, kind, existingProductIds.filter(id => id !== productId)));
  }, [name, isSubProduct, existingProductIds, selectedProductId, productId]);

  const totalCost = useMemo(() => calcTotalCost(lines), [lines]);
  const showAddComponentRow = lines.length > 0 && isProductLineFilled(lines[lines.length - 1]);

  function resetEditor() {
    setSelectedProductId('');
    setName('');
    setIsSubProduct(false);
    setProductId('');
    setCategory('');
    setGroup('');
    setB2cEnabled(true);
    setB2bEnabled(false);
    setLines([blankProductLine()]);
    setError(null);
    setSuccess(null);
  }

  function loadProduct(product: Product) {
    setSelectedProductId(String(product.id));
    setName(product.name);
    setIsSubProduct(product.isSubProduct);
    setProductId(product.productId);
    setCategory(product.category);
    setGroup(product.group);
    setB2cEnabled(product.b2cEnabled);
    setB2bEnabled(product.b2bEnabled);
    setLines((product.items ?? []).map(item => ({
      key: item.id ? `saved-${item.id}` : `line-${item.componentId}`,
      componentId: item.componentId,
      componentName: item.componentName,
      componentUom: item.componentUom,
      componentUomPrice: String(item.componentUomPrice),
      quantity: String(item.quantity),
    })));
    if ((product.items ?? []).length === 0) setLines([blankProductLine()]);
    setError(null);
    setSuccess(null);
  }

  function updateLine(key: string, patch: Partial<ProductLine>) {
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handleComponentSelect(key: string, component: ReturnType<typeof ingredientToRow> | null) {
    if (!component) {
      updateLine(key, {
        componentId: '',
        componentName: '',
        componentUom: '',
        componentUomPrice: '',
      });
      return;
    }
    const next = productLineFromComponent(component);
    updateLine(key, {
      componentId: next.componentId,
      componentName: next.componentName,
      componentUom: next.componentUom,
      componentUomPrice: next.componentUomPrice,
    });
  }

  function openAddGroup() {
    const nextId = Date.now();
    setEditingGroup({
      id: nextId,
      name: '',
      category: category || 'Food',
      items: 0,
    });
    setIsNewGroup(true);
  }

  function saveGroup(updated: GroupRow) {
    const name = updated.name.trim();
    if (!name) return;

    setExtraGroups(prev => {
      const next = prev.includes(name) ? prev : [...prev, name];
      saveExtraGroups(next);
      return next;
    });
    setGroup(name);
    if (category !== updated.category) setCategory(updated.category);
    setEditingGroup(null);
    setIsNewGroup(false);
  }

  function openAddComponent(lineKey: string) {
    setComponentSaveError(null);
    setComponentEditorLineKey(lineKey);
    setIsNewComponent(true);
    setEditComponentRow({
      ...blankComponentRow,
      category: category || blankComponentRow.category,
      group: group || blankComponentRow.group,
      locations: selectedLocationIds.length > 0 ? [...selectedLocationIds] : blankComponentRow.locations,
    });
  }

  async function handleSaveComponent(updated: Partial<ReturnType<typeof ingredientToRow>>) {
    if (!editComponentRow || !componentEditorLineKey) return;
    setComponentSaveError(null);

    const newRow = { ...blankComponentRow, ...editComponentRow, ...updated };
    try {
      const created = await api.createIngredient(rowToIngredient(newRow, {}));
      const savedRow = mergeSavedRow(created, newRow);
      setComponents(prev => [savedRow, ...prev.filter(r => r.id !== savedRow.id)]);
      handleComponentSelect(componentEditorLineKey, savedRow);
      setEditComponentRow(null);
      setComponentEditorLineKey(null);
      setIsNewComponent(false);
    } catch (err) {
      setComponentSaveError(err instanceof Error ? err.message : 'Failed to save component.');
    }
  }

  function addLine() {
    setLines(prev => [...prev, blankProductLine()]);
  }

  function removeLine(key: string) {
    setLines(prev => {
      const next = prev.filter(line => line.key !== key);
      return next.length > 0 ? next : [blankProductLine()];
    });
  }

  async function handleSave() {
    if (!orgReady || !selectedCompanyId) {
      setError('Select a company and at least one location in the header.');
      return;
    }
    if (!name.trim()) {
      setError('Enter a product name to generate the product ID.');
      return;
    }
    if (!category) {
      setError('Category is required.');
      return;
    }
    if (!group) {
      setError('Group is required.');
      return;
    }
    if (!b2cEnabled && !b2bEnabled) {
      setError('Select at least one channel: B2C or B2B.');
      return;
    }

    const payloadItems = lines
      .filter(line => line.componentId)
      .map(line => ({
        componentId: line.componentId,
        componentName: line.componentName,
        componentUom: line.componentUom,
        componentUomPrice: parseFloat(line.componentUomPrice) || 0,
        quantity: parseFloat(line.quantity) || 0,
      }));

    if (payloadItems.length === 0) {
      setError('Add at least one smart component line.');
      return;
    }
    if (payloadItems.some(item => item.quantity <= 0)) {
      setError('Each line requires a quantity greater than zero.');
      return;
    }

    const payload = {
      productId: productId || undefined,
      name: name.trim(),
      category,
      group,
      isSubProduct,
      b2cEnabled,
      b2bEnabled,
      companyId: selectedCompanyId,
      locationExternalIds: selectedLocationIds,
      items: payloadItems,
    };

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const saved = selectedProductId
        ? await api.updateProduct(Number(selectedProductId), payload)
        : await api.createProduct(payload);
      setSelectedProductId(String(saved.id));
      setProductId(saved.productId);
      loadSavedProducts();
      setSuccess(selectedProductId ? 'Product updated.' : 'Product saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Products</p>
          <h2 className="text-lg font-semibold mt-0.5">Product</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Build a product or sub-product recipe from smart components and track total cost.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetEditor}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs font-semibold hover:bg-muted/40"
          >
            <Plus size={14} />
            New
          </button>
          {savedProducts.length > 0 ? (
            <select
              value={selectedProductId}
              onChange={e => {
                const id = e.target.value;
                if (!id) {
                  resetEditor();
                  return;
                }
                const product = savedProducts.find(p => String(p.id) === id);
                if (product) loadProduct(product);
              }}
              className="px-3 py-2 text-xs rounded-md border border-border bg-card min-w-[220px]"
            >
              <option value="">Load saved product…</option>
              {savedProducts.map(product => (
                <option key={product.id} value={String(product.id)}>
                  {product.productId} · {product.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {!orgReady ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-10 text-center">
          Select a company and at least one location in the header to build products.
        </p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Loading components…</p>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className={labelCls}>Type</p>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!isSubProduct}
                      onChange={() => setIsSubProduct(false)}
                      className="rounded border-border"
                    />
                    Product
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSubProduct}
                      onChange={() => setIsSubProduct(true)}
                      className="rounded border-border"
                    />
                    Sub-Product
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <p className={labelCls}>Channel</p>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={b2cEnabled}
                      onChange={e => setB2cEnabled(e.target.checked)}
                      className="rounded border-border"
                    />
                    B2C
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={b2bEnabled}
                      onChange={e => setB2bEnabled(e.target.checked)}
                      className="rounded border-border"
                    />
                    B2B
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="product-name">Product name</label>
                <input
                  id="product-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Wagyu Burger, Espresso Latte"
                  className={fieldCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="product-id">Product ID</label>
                <input
                  id="product-id"
                  type="text"
                  value={productId}
                  readOnly
                  placeholder="Auto-generated"
                  className={`${fieldCls} bg-muted/30`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="product-category">Category</label>
                <select
                  id="product-category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={fieldCls}
                >
                  <option value="">Select category…</option>
                  {categoryOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="product-group">Group</label>
                <div className="flex gap-1.5 items-center">
                  <select
                    id="product-group"
                    value={group}
                    onChange={e => setGroup(e.target.value)}
                    className={`${fieldCls} flex-1 min-w-0`}
                  >
                    <option value="">Select group…</option>
                    {groupOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={openAddGroup}
                    className={addBtnCls}
                    title="Add new group"
                    aria-label="Add new group"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h3 className="text-sm font-semibold">Product Component</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Add smart components and quantities to calculate product cost
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Smart component</th>
                    <th className={thCls}>Smart component UOM</th>
                    <th className={thCls}>Smart component UOM price</th>
                    <th className={thCls}>Qty</th>
                    <th className={thCls}>Subtotal</th>
                    <th className={`${thCls} w-10`} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map(line => {
                    const subtotal = calcLineSubtotal(line.quantity, line.componentUomPrice);
                    return (
                      <tr key={line.key}>
                        <td className={tdCls}>
                          <div className="flex gap-1.5 items-center">
                            <div className="flex-1 min-w-0">
                              <SmartComponentPicker
                                components={availableComponents}
                                value={line.componentId}
                                onChange={component => handleComponentSelect(line.key, component)}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => openAddComponent(line.key)}
                              className={addBtnCls}
                              title="Create new smart component"
                              aria-label="Create new smart component"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className={tdCls}>
                          <span className="inline-block min-w-[4rem]">{line.componentUom || '—'}</span>
                        </td>
                        <td className={tdCls}>
                          <div className="flex items-center gap-1 min-w-[8rem]">
                            <span className="text-muted-foreground">RM</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.componentUomPrice}
                              onChange={e => updateLine(line.key, { componentUomPrice: e.target.value })}
                              className={`${fieldCls} max-w-[8rem]`}
                            />
                          </div>
                        </td>
                        <td className={tdCls}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={line.quantity}
                            onChange={e => updateLine(line.key, { quantity: e.target.value })}
                            className={`${fieldCls} max-w-[6rem]`}
                          />
                        </td>
                        <td className={`${tdCls} font-medium`}>{formatRm(subtotal)}</td>
                        <td className={tdCls}>
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                            aria-label="Remove row"
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {showAddComponentRow ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 border-b border-border">
                        <button
                          type="button"
                          onClick={addLine}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dashed border-border text-xs font-medium text-primary hover:bg-primary/5"
                        >
                          <Plus size={14} />
                          Add smart component
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-border bg-muted/10 flex items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">Total cost</span>
              <span className="text-sm font-semibold">{formatRm(totalCost)}</span>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {selectedProductId ? (
              <button
                type="button"
                onClick={() => {
                  if (!selectedProductId) return;
                  if (!window.confirm('Delete this product?')) return;
                  void api.deleteProduct(Number(selectedProductId))
                    .then(() => {
                      resetEditor();
                      loadSavedProducts();
                    })
                    .catch(err => setError(err instanceof Error ? err.message : 'Failed to delete product.'));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-red-500/30 text-xs font-semibold text-red-600 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                Delete
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              <Check size={14} />
              {saving ? 'Saving…' : selectedProductId ? 'Update product' : 'Save product'}
            </button>
          </div>

          {success ? (
            <div className="rounded-lg border border-[#5A7A2A]/30 bg-[#5A7A2A]/10 px-3 py-2 text-xs text-[#5A7A2A]">
              {success}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              {error}
            </div>
          ) : null}

          {editingGroup ? (
            <GroupEditPanel
              group={editingGroup}
              isNew={isNewGroup}
              onClose={() => {
                setEditingGroup(null);
                setIsNewGroup(false);
              }}
              onSave={saveGroup}
            />
          ) : null}

          {editComponentRow && selectedCompanyId ? createPortal(
            <ComponentEditPanel
              row={editComponentRow}
              isNew={isNewComponent}
              existingComponents={components}
              selectedCompanyId={selectedCompanyId}
              saveError={componentSaveError}
              elevated
              onClose={() => {
                setEditComponentRow(null);
                setComponentEditorLineKey(null);
                setIsNewComponent(false);
                setComponentSaveError(null);
              }}
              onSave={updated => void handleSaveComponent(updated)}
            />,
            document.body,
          ) : null}
        </>
      )}
    </div>
  );
}
