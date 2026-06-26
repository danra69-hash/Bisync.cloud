import { getCountry, inputCls, selectCls } from '../../data/countries';
import type { AddressParts } from '../../utils/countryFormat';
import { validateAddress, validateOptionalPostcode } from '../../utils/countryFormat';

type Props = {
  countryCode: string;
  value: AddressParts;
  onChange: (value: AddressParts) => void;
  showErrors?: boolean;
};

export function CountryAddressFields({ countryCode, value, onChange, showErrors = false }: Props) {
  const country = getCountry(countryCode);
  const addressError = showErrors ? validateAddress(countryCode, value) : null;
  const postcodeError = showErrors ? validateOptionalPostcode(countryCode, value.postcode) : null;

  function set<K extends keyof AddressParts>(key: K, next: AddressParts[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Address Line 1</label>
        <input
          className={`${inputCls} mt-1`}
          value={value.addressLine1}
          onChange={e => set('addressLine1', e.target.value)}
          placeholder="Street address"
        />
      </div>

      <div>
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Address Line 2</label>
        <input
          className={`${inputCls} mt-1`}
          value={value.addressLine2}
          onChange={e => set('addressLine2', e.target.value)}
          placeholder="Suite, unit, building (optional)"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{country.cityLabel}</label>
          <input className={`${inputCls} mt-1`} value={value.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{country.stateLabel}</label>
          <select className={`${selectCls} mt-1`} value={value.stateProvince} onChange={e => set('stateProvince', e.target.value)}>
            <option value="">— Select —</option>
            {country.states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{country.postcodeLabel}</label>
        <input
          className={`${inputCls} mt-1`}
          value={value.postcode}
          onChange={e => set('postcode', e.target.value)}
          placeholder={country.postcodePlaceholder}
        />
        {postcodeError && <p className="text-[10px] text-destructive mt-1">{postcodeError}</p>}
      </div>

      <p className="text-[10px] text-muted-foreground">{country.name} address format</p>
      {addressError && <p className="text-[10px] text-destructive">{addressError}</p>}
    </div>
  );
}

export function getAddressValidationError(countryCode: string, value: AddressParts): string | null {
  return validateAddress(countryCode, value);
}
