import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, Trash2, X } from 'lucide-react';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { api, type OrderTemplate, type Vendor } from '../../api';
import {
  applyVendorProductOverrides,
  formatDeliveryUnitPath,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import { fromApiUom, resolveDetailConfigForRow } from '../../data/componentForm';
import {
  componentMatchesLocations,
  resolveTaggedProductsForComponent,
  resolveVendorsForSelectedLocations,
  catalogProductAllowedByOrgPolicy,
} from '../../data/createOrder';
import { useOrgVendorPolicy } from '../../hooks/useOrgVendorPolicy';
import type { CompanyVendorPolicyTag } from '../../data/vendorPolicyRules';
import { ingredientToRow } from './smartIngredientShared';
import { OrderTemplateVendorProductPickerModal } from './OrderTemplateVendorProductPickerModal';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

type ComponentRow = ReturnType<typeof ingredientToRow>;

type ComponentOption = {
  key: string;
  componentId: string;
  componentName: string;
  category: string;
  componentUom: string;
  vendorProductId?: string;
  vendorExternalId?: string;
  vendorName?: string;
  productName?: string;
  deliveryUnitLabel?: string;
};

type TemplateLine = {
  key: string;
  componentId: string;
  componentName: string;
  componentUom: string;
  deliveryUnit: string;
  vendorProductId?: string;
  vendorExternalId?: string;
  vendorName?: string;
  productName?: string;
  quantity: string;
};

function resolveDeliveryUnit(
  line: Pick<TemplateLine, 'vendorProductId' | 'deliveryUnit'>,
  catalog: VendorProductCatalogItem[],
): string {
  if (line.deliveryUnit) return line.deliveryUnit;
  if (!line.vendorProductId) return '—';
  const product = catalog.find(item => item.id === line.vendorProductId);
  return product ? formatDeliveryUnitPath(product.delivery) : '—';
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

const fieldCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const labelCls = 'text-xs font-medium text-foreground';
const panelCls = 'rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-[24rem]';

function buildComponentOption(
  component: ComponentRow,
  product?: VendorProductCatalogItem,
): ComponentOption {
  const detail = resolveDetailConfigForRow(component);
  const recipeUnit = fromApiUom(component.recipeUOM);
  const componentUom = product
    ? detail.vendorProductComponentUom[product.id] || recipeUnit
    : component.inventoryUOM || component.recipeUOM;

  return {
    key: product ? `${component.componentId}::${product.id}` : component.componentId,
    componentId: component.componentId,
    componentName: component.name,
    category: component.category,
    componentUom,
    vendorProductId: product?.id,
    vendorExternalId: product?.vendorExternalId,
    vendorName: product?.vendorName,
    productName: product?.productName,
    deliveryUnitLabel: product ? formatDeliveryUnitPath(product.delivery) : undefined,
  };
}

type ComponentListItem = {
  component: ComponentRow;
  taggedProductCount: number;
  addedProductCount: number;
};

function buildComponentListItems(
  components: ComponentRow[],
  locationIds: string[],
  vendorExternalId: string,
  catalog: VendorProductCatalogItem[],
  templateLines: TemplateLine[],
  vendors: Vendor[],
  orgPolicyTags: CompanyVendorPolicyTag[],
): ComponentListItem[] {
  const items: ComponentListItem[] = [];

  for (const component of components) {
    if (!component.active || !componentMatchesLocations(component, locationIds)) continue;

    const tagged = resolveTaggedProductsForComponent(component, catalog, {
      locationIds,
      vendorExternalId: vendorExternalId || undefined,
    }).filter(product => catalogProductAllowedByOrgPolicy(product, vendors, orgPolicyTags));

    if (vendorExternalId && tagged.length === 0) continue;

    const addedProductCount = templateLines.filter(line => line.componentId === component.componentId).length;
    items.push({
      component,
      taggedProductCount: tagged.length,
      addedProductCount,
    });
  }

  return items.sort((a, b) => a.component.name.localeCompare(b.component.name));
}

function buildTemplateLineFromProduct(
  component: ComponentRow,
  product: VendorProductCatalogItem,
): TemplateLine {
  const option = buildComponentOption(component, product);
  return toTemplateLine(option);
}

function toTemplateLine(option: ComponentOption): TemplateLine {
  return {
    key: option.key,
    componentId: option.componentId,
    componentName: option.componentName,
    componentUom: option.componentUom,
    deliveryUnit: option.deliveryUnitLabel ?? '',
    vendorProductId: option.vendorProductId,
    vendorExternalId: option.vendorExternalId,
    vendorName: option.vendorName,
    productName: option.productName,
    quantity: '1',
  };
}

export function OrderTemplatePage({ selectedCompanyId, selectedLocationIds }: Props) {
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;
  const orgPolicyTags = useOrgVendorPolicy(selectedCompanyId, selectedLocationIds);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<OrderTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const [vendorFilter, setVendorFilter] = useState('');
  const [search, setSearch] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateLines, setTemplateLines] = useState<TemplateLine[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'weekday' | 'monthday' | ''>('');
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [monthDays, setMonthDays] = useState<number[]>([]);
  const [repeatEnabled, setRepeatEnabled] = useState(true);
  const [pickerComponent, setPickerComponent] = useState<ComponentRow | null>(null);

  const loadSavedTemplates = useCallback(() => {
    if (!selectedCompanyId) {
      setSavedTemplates([]);
      return;
    }
    api.orderTemplates(selectedCompanyId)
      .then(setSavedTemplates)
      .catch(() => setSavedTemplates([]));
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setVendors([]);
      return;
    }
    api.vendors()
      .then(setVendors)
      .catch(() => setVendors([]));
  }, [selectedCompanyId]);

  useEffect(() => {
    loadSavedTemplates();
  }, [loadSavedTemplates]);

  useEffect(() => {
    if (!orgReady) {
      setComponents([]);
      return;
    }
    setLoading(true);
    api.ingredients()
      .then(data => setComponents(data.map(ingredientToRow)))
      .catch(() => setComponents([]))
      .finally(() => setLoading(false));
  }, [orgReady, selectedCompanyId, selectedLocationIds]);

  const vendorOptions = useMemo(
    () => resolveVendorsForSelectedLocations(components, selectedLocationIds, vendors, orgPolicyTags),
    [components, selectedLocationIds, vendors, orgPolicyTags],
  );

  const vendorProductCatalog = useMemo(
    () => applyVendorProductOverrides(),
    [components, vendorFilter],
  );

  const componentListItems = useMemo(
    () => buildComponentListItems(
      components,
      selectedLocationIds,
      vendorFilter,
      vendorProductCatalog,
      templateLines,
      vendors,
      orgPolicyTags,
    ),
    [components, selectedLocationIds, vendorFilter, vendorProductCatalog, templateLines, vendors, orgPolicyTags],
  );

  const filteredComponentListItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return componentListItems;
    return componentListItems.filter(item => [
      item.component.componentId,
      item.component.name,
      item.component.category,
      item.component.group,
    ].join(' ').toLowerCase().includes(query));
  }, [componentListItems, search]);

  const templateLineKeys = useMemo(
    () => new Set(templateLines.map(line => line.key)),
    [templateLines],
  );

  const selectedVendor = useMemo(
    () => vendorOptions.find(vendor => vendor.externalId === vendorFilter) ?? null,
    [vendorFilter, vendorOptions],
  );

  function resetEditor() {
    setSelectedTemplateId('');
    setTemplateName('');
    setTemplateLines([]);
    setVendorFilter('');
    setSearch('');
    setScheduleMode('');
    setWeekdays([]);
    setMonthDays([]);
    setRepeatEnabled(true);
    setPickerComponent(null);
    setError(null);
    setSuccess(null);
  }

  function loadTemplate(template: OrderTemplate) {
    setSelectedTemplateId(String(template.id));
    setTemplateName(template.name);
    setVendorFilter(template.vendorExternalId || '');
    setScheduleMode(template.scheduleMode || '');
    setWeekdays(template.weekdays ?? []);
    setMonthDays(template.monthDays ?? []);
    setRepeatEnabled(template.repeatEnabled);
    setTemplateLines((template.items ?? []).map(item => ({
      key: item.vendorProductId
        ? `${item.componentId}::${item.vendorProductId}`
        : item.componentId,
      componentId: item.componentId,
      componentName: item.componentName,
      componentUom: item.componentUom,
      deliveryUnit: item.deliveryUnit
        || (item.vendorProductId
          ? resolveDeliveryUnit({ vendorProductId: item.vendorProductId, deliveryUnit: '' }, applyVendorProductOverrides())
          : ''),
      vendorProductId: item.vendorProductId || undefined,
      vendorExternalId: item.vendorExternalId || undefined,
      vendorName: item.vendorName || undefined,
      productName: item.productName || undefined,
      quantity: String(item.quantity),
    })));
    setError(null);
    setSuccess(null);
  }

  function openComponentPicker(component: ComponentRow) {
    setPickerComponent(component);
    setError(null);
  }

  function addVendorProductToTemplate(component: ComponentRow, product: VendorProductCatalogItem) {
    const line = buildTemplateLineFromProduct(component, product);
    if (templateLineKeys.has(line.key)) return;
    setTemplateLines(prev => [...prev, line]);
    setPickerComponent(null);
    setError(null);
  }

  function removeTemplateLine(key: string) {
    setTemplateLines(prev => prev.filter(line => line.key !== key));
  }

  function updateTemplateLineQty(key: string, quantity: string) {
    setTemplateLines(prev => prev.map(line => (
      line.key === key ? { ...line, quantity } : line
    )));
  }

  function toggleWeekday(day: string) {
    setMonthDays([]);
    setWeekdays(prev => {
      const next = prev.includes(day) ? prev.filter(value => value !== day) : [...prev, day];
      setScheduleMode(next.length > 0 ? 'weekday' : '');
      return next;
    });
  }

  function toggleMonthDay(day: number) {
    setWeekdays([]);
    setMonthDays(prev => {
      const next = prev.includes(day) ? prev.filter(value => value !== day) : [...prev, day];
      setScheduleMode(next.length > 0 ? 'monthday' : '');
      return next;
    });
  }

  async function handleSave() {
    if (!orgReady || !selectedCompanyId) {
      setError('Select a company and at least one location in the header.');
      return;
    }
    if (!templateName.trim()) {
      setError('Template name is required.');
      return;
    }
    if (templateLines.length === 0) {
      setError('Add at least one component to the template.');
      return;
    }
    if (scheduleMode === 'weekday' && weekdays.length === 0) {
      setError('Select at least one day of the week.');
      return;
    }
    if (scheduleMode === 'monthday' && monthDays.length === 0) {
      setError('Select at least one day of the month.');
      return;
    }
    if (!scheduleMode) {
      setError('Choose either days of the week or days of the month.');
      return;
    }

    const items = [];
    for (const line of templateLines) {
      const qty = parseFloat(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Quantity must be greater than zero for ${line.componentName}.`);
        return;
      }
      if (!line.vendorProductId) {
        setError(`Select a vendor product for ${line.componentName}.`);
        return;
      }
      items.push({
        componentId: line.componentId,
        componentName: line.componentName,
        vendorProductId: line.vendorProductId,
        vendorExternalId: line.vendorExternalId,
        vendorName: line.vendorName,
        productName: line.productName,
        quantity: qty,
        componentUom: line.componentUom,
        deliveryUnit: line.deliveryUnit,
      });
    }

    const payload = {
      name: templateName.trim(),
      vendorExternalId: vendorFilter || undefined,
      vendorName: selectedVendor?.name,
      scheduleMode,
      weekdays: scheduleMode === 'weekday' ? weekdays : [],
      monthDays: scheduleMode === 'monthday' ? monthDays : [],
      repeatEnabled,
      companyId: selectedCompanyId,
      locationExternalIds: selectedLocationIds,
      items,
    };

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const saved = selectedTemplateId
        ? await api.updateOrderTemplate(Number(selectedTemplateId), payload)
        : await api.createOrderTemplate(payload);
      setSelectedTemplateId(String(saved.id));
      loadSavedTemplates();
      setSuccess(selectedTemplateId ? 'Template updated.' : 'Template saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  }

  const weekdayDisabled = scheduleMode === 'monthday' && monthDays.length > 0;
  const monthDayDisabled = scheduleMode === 'weekday' && weekdays.length > 0;

  return (
    <div className={pageShellClass()}>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <select
            value={selectedTemplateId}
            onChange={e => {
              const id = e.target.value;
              if (!id) {
                resetEditor();
                return;
              }
              const template = savedTemplates.find(row => String(row.id) === id);
              if (template) loadTemplate(template);
            }}
            className={`${filterSelectCls} min-w-[220px]`}
          >
            <option value="">New template</option>
            {savedTemplates.map(template => (
              <option key={template.id} value={String(template.id)}>{template.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetEditor}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-xs font-semibold hover:bg-muted"
          >
            <Plus size={14} />
            New
          </button>
      </div>

      {!orgReady ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-10 text-center">
          Select a company and at least one location in the header to create an order template.
        </p>
      ) : loading ? (
        <MillstoneLoader size="sm" layout="block" label="Loading components…" />
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Template conditions</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Use either day of the week or day of the month, not both.
              </p>
            </div>

            <div className="space-y-1.5 max-w-xl">
              <label className={labelCls} htmlFor="template-name">Template name</label>
              <input
                id="template-name"
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g. Weekly dry store order"
                className={fieldCls}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem] gap-4 items-start">
              <div className={`rounded-lg border border-border p-3 space-y-3 ${weekdayDisabled ? 'opacity-50' : ''}`}>
                <p className={labelCls}>Day of the week</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(day => (
                    <label
                      key={day}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] ${
                        weekdays.includes(day)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background'
                      } ${weekdayDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-border text-primary"
                        checked={weekdays.includes(day)}
                        disabled={weekdayDisabled}
                        onChange={() => toggleWeekday(day)}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>

              <div className={`rounded-lg border border-border p-3 space-y-3 ${monthDayDisabled ? 'opacity-50' : ''}`}>
                <p className={labelCls}>Day of the month</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {MONTH_DAYS.map(day => (
                    <label
                      key={day}
                      className={`inline-flex items-center justify-center gap-1 px-1 py-1 rounded-md border text-[11px] ${
                        monthDays.includes(day)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background'
                      } ${monthDayDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={monthDays.includes(day)}
                        disabled={monthDayDisabled}
                        onChange={() => toggleMonthDay(day)}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className={labelCls}>Repeat</p>
                <label className="inline-flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={repeatEnabled}
                    onClick={() => setRepeatEnabled(prev => !prev)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      repeatEnabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        repeatEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-muted-foreground">{repeatEnabled ? 'On' : 'Off'}</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
              {selectedTemplateId ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedTemplateId) return;
                    if (!window.confirm('Delete this template?')) return;
                    void api.deleteOrderTemplate(Number(selectedTemplateId))
                      .then(() => {
                        resetEditor();
                        loadSavedTemplates();
                      })
                      .catch(err => setError(err instanceof Error ? err.message : 'Failed to delete template.'));
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
                {saving ? 'Saving…' : selectedTemplateId ? 'Update template' : 'Save template'}
              </button>
            </div>

            {success && (
              <div className="rounded-lg border border-[#5A7A2A]/30 bg-[#5A7A2A]/10 px-3 py-2 text-xs text-[#5A7A2A]">
                {success}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className={`${filterSelectCls} min-w-[220px]`}
            >
              <option value="">All vendors</option>
              {vendorOptions.map(vendor => (
                <option key={vendor.externalId} value={vendor.externalId}>{vendor.name}</option>
              ))}
            </select>

            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search component…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {vendorFilter
                ? `Showing components tagged to ${selectedVendor?.name ?? 'vendor'}`
                : 'Showing all components for selected location(s)'}
            </p>
          </div>

          {pickerComponent && (
            <OrderTemplateVendorProductPickerModal
              component={pickerComponent}
              locationIds={selectedLocationIds}
              vendorExternalId={vendorFilter}
              addedLineKeys={templateLineKeys}
              onClose={() => setPickerComponent(null)}
              onSelect={product => addVendorProductToTemplate(pickerComponent, product)}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <section className={panelCls}>
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <h3 className="text-sm font-semibold">Components</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Select a component, then choose a tagged vendor product
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
                {filteredComponentListItems.length === 0 ? (
                  <p className="px-4 py-8 text-xs text-muted-foreground text-center">
                    {vendorFilter
                      ? 'No tagged components for this vendor at the selected locations.'
                      : 'No active components for the selected locations.'}
                  </p>
                ) : (
                  filteredComponentListItems.map(item => {
                    const allAdded = item.taggedProductCount > 0
                      && item.addedProductCount >= item.taggedProductCount;
                    const noTaggedProducts = item.taggedProductCount === 0;
                    return (
                      <button
                        key={item.component.componentId}
                        type="button"
                        disabled={allAdded || noTaggedProducts}
                        onClick={() => openComponentPicker(item.component)}
                        className={`w-full text-left px-4 py-3 text-xs transition-colors ${
                          allAdded || noTaggedProducts
                            ? 'bg-muted/30 text-muted-foreground cursor-default'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{item.component.name}</p>
                            <p className="text-muted-foreground truncate">{item.component.componentId}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {item.taggedProductCount} tagged vendor product{item.taggedProductCount === 1 ? '' : 's'}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {noTaggedProducts
                              ? 'No tags'
                              : allAdded
                                ? 'Added'
                                : 'Choose'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className={panelCls}>
              <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Template</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Set quantity for each selected component</p>
                </div>
                <span className="text-[10px] font-sans text-muted-foreground">
                  {templateLines.length} item{templateLines.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
                {templateLines.length === 0 ? (
                  <p className="px-4 py-8 text-xs text-muted-foreground text-center">
                    Select components from the list to build this template.
                  </p>
                ) : (
                  templateLines.map(line => (
                    <div key={line.key} className="px-4 py-3 text-xs space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{line.componentName}</p>
                          {line.productName ? (
                            <p className="text-muted-foreground truncate">
                              {line.vendorName} · {line.productName}
                            </p>
                          ) : (
                            <p className="text-muted-foreground truncate">{line.componentId}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTemplateLine(line.key)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          aria-label={`Remove ${line.componentName}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2 items-end">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Delivery unit</label>
                          <p className="mt-1 rounded-md border border-border bg-muted/20 px-2.5 py-2">
                            {resolveDeliveryUnit(line, vendorProductCatalog)}
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground" htmlFor={`qty-${line.key}`}>Qty</label>
                          <input
                            id={`qty-${line.key}`}
                            type="number"
                            min="0"
                            step="any"
                            value={line.quantity}
                            onChange={e => updateTemplateLineQty(line.key, e.target.value)}
                            className={fieldCls}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
