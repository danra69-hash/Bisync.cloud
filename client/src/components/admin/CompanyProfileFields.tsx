import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import {
  COMPANY_BUSINESS_TYPES,
  COMPANY_VENDOR_POLICY_TAGS,
  isVendorPolicyTagDisabled,
  toggleVendorPolicyTags,
  type CompanyBusinessType,
  type CompanyVendorPolicyTag,
} from '../../data/companyProfile';
import {
  LOCATION_PLATFORM_MODULES,
  PLATFORM_MODULES,
} from '../../data/companyModules';
import type { AccessModule } from '../../data/userAccess';

export function BusinessTypeMultiSelect({
  selected,
  onChange,
  availableTypes,
}: {
  selected: CompanyBusinessType[];
  onChange: (values: CompanyBusinessType[]) => void;
  availableTypes?: CompanyBusinessType[];
}) {
  const options = availableTypes ?? [...COMPANY_BUSINESS_TYPES];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Use click (not mousedown) so Save / footer buttons still receive their click
    // after the menu closes — mousedown-outside + re-render can swallow the click.
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, []);

  const label = selected.length === 0
    ? 'Select business type(s)'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} types selected`;

  function toggle(type: CompanyBusinessType) {
    if (selected.includes(type)) {
      onChange(selected.filter(value => value !== type));
    } else {
      onChange([...selected, type]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-xs rounded-md px-3 py-2 border border-border bg-card hover:border-primary/40 transition-colors"
      >
        <span className={selected.length === 0 ? 'text-muted-foreground text-left' : 'text-left'}>{label}</span>
        <ChevronDown size={12} className={`text-muted-foreground transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto">
          {options.map(type => {
            const checked = selected.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggle(type)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 text-left border-b border-border last:border-0"
              >
                <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-border'}`}>
                  {checked && <Check size={10} className="text-primary-foreground" />}
                </div>
                <span className="text-xs">{type}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(type => (
            <span key={type} className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {type}
              <button type="button" onClick={() => toggle(type)} aria-label={`Remove ${type}`}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function VendorPolicyCheckboxGroup({
  selected,
  onChange,
  layout = 'stack',
}: {
  selected: CompanyVendorPolicyTag[];
  onChange: (values: CompanyVendorPolicyTag[]) => void;
  layout?: 'stack' | 'compact';
}) {
  function toggle(tagId: CompanyVendorPolicyTag) {
    onChange(toggleVendorPolicyTags(selected, tagId));
  }

  const nonHalalSelected = selected.includes('non-halal');
  const compact = layout === 'compact';

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-2'}>
        {COMPANY_VENDOR_POLICY_TAGS.map(tag => {
          const checked = selected.includes(tag.id);
          const disabled = isVendorPolicyTagDisabled(selected, tag.id);
          return (
            <label
              key={tag.id}
              title={tag.description}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                compact ? 'flex-1 min-w-[8rem]' : 'items-start gap-3 py-2.5'
              } ${
                checked ? 'border-primary bg-primary/5' : disabled ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:border-primary/40 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(tag.id)}
                className={`${compact ? '' : 'mt-0.5'} rounded border-border`}
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-foreground">{tag.label}</span>
                {!compact && (
                  <span className="block text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{tag.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {!compact && (
        <p className="text-[11px] text-muted-foreground">
          {nonHalalSelected
            ? 'Non-halal is exclusive — Halal and Muslim Friendly are not available.'
            : 'Select Halal and/or Muslim Friendly together, or choose Non-halal alone.'}
        </p>
      )}
    </div>
  );
}

export function ModuleCheckboxGroup({
  selected,
  onChange,
  scope,
  availableModules,
  layout = 'stack',
}: {
  selected: AccessModule[];
  onChange: (values: AccessModule[]) => void;
  scope: 'company' | 'location';
  availableModules?: AccessModule[];
  layout?: 'stack' | 'compact';
}) {
  const moduleOptions = scope === 'company'
    ? PLATFORM_MODULES
    : LOCATION_PLATFORM_MODULES.filter(module => !availableModules || availableModules.includes(module.id));
  const compact = layout === 'compact';

  function toggle(moduleId: AccessModule) {
    if (selected.includes(moduleId)) {
      onChange(selected.filter(value => value !== moduleId));
      return;
    }
    onChange([...selected, moduleId]);
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-2'}>
        {moduleOptions.map(module => {
          const checked = selected.includes(module.id);
          const disabled = scope === 'location' && availableModules != null && !availableModules.includes(module.id);
          return (
            <label
              key={module.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                compact ? 'min-w-[7rem]' : 'items-start gap-3 py-2.5'
              } ${
                checked ? 'border-primary bg-primary/5' : disabled ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:border-primary/40 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => !disabled && toggle(module.id)}
                className={`${compact ? '' : 'mt-0.5'} rounded border-border`}
              />
              <span className="text-xs font-medium text-foreground">{module.label}</span>
            </label>
          );
        })}
      </div>
      {!compact && (
        scope === 'location' ? (
          <p className="text-[11px] text-muted-foreground">Accounting is configured at company level only.</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">Tick modules to enable access for this company.</p>
        )
      )}
    </div>
  );
}

type ProfileFieldsProps = {
  businessTypes: CompanyBusinessType[];
  vendorPolicyTags: CompanyVendorPolicyTag[];
  modules: AccessModule[];
  onBusinessTypesChange: (values: CompanyBusinessType[]) => void;
  onVendorPolicyTagsChange: (values: CompanyVendorPolicyTag[]) => void;
  onModulesChange: (values: AccessModule[]) => void;
  availableBusinessTypes?: CompanyBusinessType[];
  availableModules?: AccessModule[];
  moduleScope?: 'company' | 'location';
  hint?: string;
  onUseCompanyDefaults?: () => void;
  layout?: 'stack' | 'compact';
};

export function CompanyProfileFields({
  businessTypes,
  vendorPolicyTags,
  modules,
  onBusinessTypesChange,
  onVendorPolicyTagsChange,
  onModulesChange,
  availableBusinessTypes,
  availableModules,
  moduleScope = 'company',
  hint,
  onUseCompanyDefaults,
  layout = 'stack',
}: ProfileFieldsProps) {
  const compact = layout === 'compact';

  return (
    <>
      {hint && (
        <p className="text-[11px] text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2">
          {hint}
          {onUseCompanyDefaults ? (
            <>
              {' '}
              <button type="button" onClick={onUseCompanyDefaults} className="text-primary hover:underline">
                Use company defaults
              </button>
            </>
          ) : null}
        </p>
      )}
      {!compact && onUseCompanyDefaults && (
        <button
          type="button"
          onClick={onUseCompanyDefaults}
          className="text-xs text-primary hover:underline"
        >
          Use company defaults
        </button>
      )}
      <div className={compact ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : 'contents'}>
        <div>
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Type of Business *</label>
          {!compact && <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Choose one or more business types.</p>}
          <div className={compact ? 'mt-1' : undefined}>
            <BusinessTypeMultiSelect
              selected={businessTypes}
              onChange={onBusinessTypesChange}
              availableTypes={availableBusinessTypes}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Modules *</label>
          {!compact && (
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
              Enable platform modules for this {moduleScope === 'company' ? 'company' : 'location'}.
            </p>
          )}
          <div className={compact ? 'mt-1' : undefined}>
            <ModuleCheckboxGroup
              selected={modules}
              onChange={onModulesChange}
              scope={moduleScope}
              availableModules={availableModules}
              layout={layout}
            />
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Vendor Product Policy *</label>
        {!compact && (
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Non-halal cannot be combined with Halal or Muslim Friendly.</p>
        )}
        <div className={compact ? 'mt-1' : undefined}>
          <VendorPolicyCheckboxGroup
            selected={vendorPolicyTags}
            onChange={onVendorPolicyTagsChange}
            layout={layout}
          />
        </div>
      </div>
    </>
  );
}
