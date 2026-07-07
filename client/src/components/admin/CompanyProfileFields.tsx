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

export function BusinessTypeMultiSelect({
  selected,
  onChange,
}: {
  selected: CompanyBusinessType[];
  onChange: (values: CompanyBusinessType[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
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
          {COMPANY_BUSINESS_TYPES.map(type => {
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
}: {
  selected: CompanyVendorPolicyTag[];
  onChange: (values: CompanyVendorPolicyTag[]) => void;
}) {
  function toggle(tagId: CompanyVendorPolicyTag) {
    onChange(toggleVendorPolicyTags(selected, tagId));
  }

  const nonHalalSelected = selected.includes('non-halal');

  return (
    <div className="space-y-2">
      {COMPANY_VENDOR_POLICY_TAGS.map(tag => {
        const checked = selected.includes(tag.id);
        const disabled = isVendorPolicyTagDisabled(selected, tag.id);
        return (
          <label
            key={tag.id}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              checked ? 'border-primary bg-primary/5' : disabled ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:border-primary/40 cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(tag.id)}
              className="mt-0.5 rounded border-border"
            />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{tag.label}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{tag.description}</span>
            </span>
          </label>
        );
      })}
      <p className="text-[11px] text-muted-foreground">
        {nonHalalSelected
          ? 'Non-halal is exclusive — Halal and Muslim Friendly are not available.'
          : 'Select Halal and/or Muslim Friendly together, or choose Non-halal alone.'}
      </p>
    </div>
  );
}

type ProfileFieldsProps = {
  businessTypes: CompanyBusinessType[];
  vendorPolicyTags: CompanyVendorPolicyTag[];
  onBusinessTypesChange: (values: CompanyBusinessType[]) => void;
  onVendorPolicyTagsChange: (values: CompanyVendorPolicyTag[]) => void;
  hint?: string;
  onUseCompanyDefaults?: () => void;
};

export function CompanyProfileFields({
  businessTypes,
  vendorPolicyTags,
  onBusinessTypesChange,
  onVendorPolicyTagsChange,
  hint,
  onUseCompanyDefaults,
}: ProfileFieldsProps) {
  return (
    <>
      {hint && (
        <p className="text-[11px] text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2">
          {hint}
        </p>
      )}
      {onUseCompanyDefaults && (
        <button
          type="button"
          onClick={onUseCompanyDefaults}
          className="text-xs text-primary hover:underline"
        >
          Use company defaults
        </button>
      )}
      <div>
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Type of Business *</label>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Choose one or more business types.</p>
        <BusinessTypeMultiSelect selected={businessTypes} onChange={onBusinessTypesChange} />
      </div>
      <div>
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Vendor Product Policy *</label>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Non-halal cannot be combined with Halal or Muslim Friendly.</p>
        <VendorPolicyCheckboxGroup selected={vendorPolicyTags} onChange={onVendorPolicyTagsChange} />
      </div>
    </>
  );
}
