import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { inputCls, selectCls } from '../../data/countries';
import { buildBankOptions, isMalaysiaCountry } from './malaysiaBanks';

type Props = {
  value: string | null | undefined;
  companyCountryCode?: string | null;
  payStructureCountryCode?: string | null;
  customBanks: string[];
  onAddCustomBank: (name: string) => void;
  onChange: (bankName: string | null) => void;
};

export function BankNameField({
  value,
  companyCountryCode,
  payStructureCountryCode,
  customBanks,
  onAddCustomBank,
  onChange,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const useDropdown = isMalaysiaCountry(companyCountryCode ?? payStructureCountryCode);
  const options = useMemo(() => buildBankOptions(customBanks, value), [customBanks, value]);

  function confirmAdd() {
    const name = draft.trim();
    if (!name) return;
    onAddCustomBank(name);
    onChange(name);
    setDraft('');
    setAdding(false);
  }

  if (!useDropdown) {
    return (
      <input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className={`${inputCls} mt-1`}
        placeholder="Bank name"
      />
    );
  }

  return (
    <div className="mt-1 space-y-2">
      <div className="flex gap-2">
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className={`${selectCls} flex-1 min-w-0`}
        >
          <option value="">Select bank</option>
          {options.map(bank => (
            <option key={bank} value={bank}>{bank}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAdding(prev => !prev)}
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 border border-border rounded-md hover:bg-muted"
          title="Add bank"
          aria-label="Add bank"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {adding && (
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className={`${inputCls} flex-1 `}
            placeholder="Enter bank name"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmAdd();
              }
            }}
          />
          <button
            type="button"
            onClick={confirmAdd}
            disabled={!draft.trim()}
            className="px-3 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setDraft(''); }}
            className="px-3 py-2 text-xs border border-border rounded-md hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
