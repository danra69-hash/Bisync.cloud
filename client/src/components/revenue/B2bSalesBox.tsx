import { useMemo } from 'react';
import { ToggleSwitch } from '../admin/ToggleSwitch';
import type { Product } from '../../api';
import { inputCls, selectCls } from '../../data/componentForm';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import {
  b2bSalesUnitTitle,
  describeB2bDeliveryYieldResolution,
  getB2bDeliveryUnitChoices,
  summarizeB2bSalesUnit,
  type B2bSalesConfig,
  type B2bSalesUnitLine,
} from '../../data/productB2bSales';
import { formatSubProductBatchPackageUnit } from '../../data/productForm';
import {
  DELIVERY_UNIT_LEVEL_LABELS,
  formatDeliveryUnitPath,
  type DeliveryUnitBreakdown,
} from '../../data/vendorProductCatalog';

type Props = {
  config: B2bSalesConfig;
  linkedSubProduct: Product | null;
  linkedSubProductBatchCogs?: number | null;
  disabled?: boolean;
  showUnitDisableSwitch?: boolean;
  onChange: (config: B2bSalesConfig) => void;
};

function qtyInput(value: number, onChange: (value: number) => void, disabled?: boolean) {
  return (
    <input
      type="number"
      min={0}
      step={1}
      disabled={disabled}
      value={value > 0 ? value : ''}
      onChange={e => {
        const raw = e.target.value;
        if (!raw.trim()) {
          onChange(0);
          return;
        }
        const parsed = parseInt(raw, 10);
        onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
      }}
      className={`${inputCls} w-20 font-sans text-xs`}
    />
  );
}

function UnitSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (unit: string) => void;
  disabled?: boolean;
}) {
  const unitOptions = useMemo(() => {
    const choices = new Set(options);
    if (value.trim()) choices.add(value.trim());
    return [...choices].sort((a, b) => a.localeCompare(b));
  }, [options, value]);

  return (
    <select
      disabled={disabled}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${selectCls} w-28 font-sans text-xs`}
    >
      <option value="">— Select —</option>
      {unitOptions.map(unit => (
        <option key={unit} value={unit}>{unit}</option>
      ))}
    </select>
  );
}

function DeliveryUnitEditor({
  delivery,
  linkedSubProduct,
  disabled,
  onChange,
}: {
  delivery: DeliveryUnitBreakdown;
  linkedSubProduct: Product | null;
  disabled?: boolean;
  onChange: (delivery: DeliveryUnitBreakdown) => void;
}) {
  const unitChoices = getB2bDeliveryUnitChoices(linkedSubProduct);
  const batchLabel = linkedSubProduct ? formatSubProductBatchPackageUnit(linkedSubProduct) : null;
  const yieldResolution = describeB2bDeliveryYieldResolution(delivery, linkedSubProduct);

  function patch(patch: Partial<DeliveryUnitBreakdown>) {
    onChange({ ...delivery, ...patch });
  }

  return (
    <div className="space-y-2 min-w-0">
      {batchLabel && batchLabel !== '—' ? (
        <p className="text-[11px] text-muted-foreground">
          Sub-product batch: <span className="font-medium text-foreground">{batchLabel}</span>
          {' '}· break down via Primary / Secondary Packaging into smaller sellable units.
        </p>
      ) : null}

      <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Delivery Unit</p>
        <p className="text-xs font-medium text-foreground mt-0.5">{formatDeliveryUnitPath(delivery)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground w-36 shrink-0">{DELIVERY_UNIT_LEVEL_LABELS.order}</span>
        {qtyInput(delivery.orderQty, orderQty => patch({ orderQty }), disabled)}
        <UnitSelect
          value={delivery.orderUnit}
          options={unitChoices}
          onChange={orderUnit => patch({ orderUnit })}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground w-36 shrink-0">{DELIVERY_UNIT_LEVEL_LABELS.primary}</span>
        {qtyInput(delivery.packQty, packQty => patch({ packQty }), disabled)}
        <UnitSelect
          value={delivery.packUnit}
          options={unitChoices}
          onChange={packUnit => patch({ packUnit })}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground w-36 shrink-0">{DELIVERY_UNIT_LEVEL_LABELS.secondary}</span>
        {qtyInput(delivery.unitQty, unitQty => patch({ unitQty }), disabled)}
        <UnitSelect
          value={delivery.unitUnit}
          options={unitChoices}
          onChange={unitUnit => patch({ unitUnit })}
          disabled={disabled}
        />
      </div>

      {linkedSubProduct ? (
        <p className={`text-[11px] ${yieldResolution.ok ? 'text-muted-foreground' : 'text-amber-600'}`}>
          {yieldResolution.message}
        </p>
      ) : null}
    </div>
  );
}

function SalesUnitCard({
  title,
  line,
  linkedSubProduct,
  linkedSubProductBatchCogs,
  alternateIndex,
  disabled,
  showDisableSwitch,
  onChange,
}: {
  title: string;
  line: B2bSalesUnitLine;
  linkedSubProduct: Product | null;
  linkedSubProductBatchCogs?: number | null;
  alternateIndex?: number;
  disabled?: boolean;
  showDisableSwitch?: boolean;
  onChange: (line: B2bSalesUnitLine) => void;
}) {
  const { currency, symbol } = useCountryFormatters();
  const unitDisabled = Boolean(line.disabled);
  const fieldsDisabled = Boolean(disabled || unitDisabled);
  const summary = summarizeB2bSalesUnit(line, linkedSubProduct, alternateIndex, linkedSubProductBatchCogs);
  const cogsDisplay = linkedSubProduct && !summary.yieldResolution.ok
    ? '—'
    : currency(summary.cogs);
  const cogsPercentDisplay = linkedSubProduct && !summary.yieldResolution.ok
    ? '—'
    : summary.cogsPercent;

  return (
    <div className={`rounded-lg border border-border p-4 space-y-3 min-w-0 ${unitDisabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        {showDisableSwitch ? (
          <label className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Disable
            <ToggleSwitch
              checked={unitDisabled}
              onChange={next => onChange({ ...line, disabled: next })}
              disabled={disabled}
              label={`Disable ${title}`}
            />
          </label>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Breakdown</p>
        <DeliveryUnitEditor
          delivery={line.delivery}
          linkedSubProduct={linkedSubProduct}
          disabled={fieldsDisabled}
          onChange={delivery => onChange({ ...line, delivery })}
        />

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS</p>
            <p className="text-sm font-semibold text-foreground mt-1">{cogsDisplay}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS %</p>
            <p className="text-sm font-semibold text-foreground mt-1">{cogsPercentDisplay}</p>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">RRP</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground">{symbol}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={fieldsDisabled}
              value={line.rrp}
              onChange={e => onChange({ ...line, rrp: e.target.value })}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function B2bSalesBox({
  config,
  linkedSubProduct,
  linkedSubProductBatchCogs = null,
  disabled = false,
  showUnitDisableSwitch = false,
  onChange,
}: Props) {
  function updatePrincipal(next: B2bSalesUnitLine) {
    onChange({ ...config, principal: { ...next, isPrincipal: true } });
  }

  function updateAlternate(index: number, next: B2bSalesUnitLine) {
    onChange({
      ...config,
      alternates: config.alternates.map((line, i) => (i === index ? { ...next, isPrincipal: false } : line)),
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">B2B Sales</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Define principal and alternate Delivery Units for wholesale sales. Each Delivery Unit uses Order UOM,
          Primary Packaging, and Secondary Packaging — same meaning as Vendor Product Delivery Units.
        </p>
        {linkedSubProduct ? (
          <p className="text-[11px] text-muted-foreground mt-1">
            Linked sub-product: <span className="font-medium text-foreground">{linkedSubProduct.name}</span>
            {' '}({linkedSubProduct.productId}) · Delivery Unit {formatSubProductBatchPackageUnit(linkedSubProduct)}
          </p>
        ) : (
          <p className="text-[11px] text-amber-600 mt-1">
            Select a sub-product in Product Component below to calculate delivery-unit COGS.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SalesUnitCard
          title={b2bSalesUnitTitle(config.principal)}
          line={config.principal}
          linkedSubProduct={linkedSubProduct}
          linkedSubProductBatchCogs={linkedSubProductBatchCogs}
          disabled={disabled}
          showDisableSwitch={showUnitDisableSwitch}
          onChange={updatePrincipal}
        />

        {config.alternates.map((line, index) => (
          <SalesUnitCard
            key={line.key}
            title={b2bSalesUnitTitle(line, index)}
            line={line}
            linkedSubProduct={linkedSubProduct}
            linkedSubProductBatchCogs={linkedSubProductBatchCogs}
            alternateIndex={index}
            disabled={disabled}
            showDisableSwitch={showUnitDisableSwitch}
            onChange={next => updateAlternate(index, next)}
          />
        ))}
      </div>
    </section>
  );
}
