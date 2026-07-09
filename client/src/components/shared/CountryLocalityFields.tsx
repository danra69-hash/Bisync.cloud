import { useId, useMemo } from 'react';
import { getCountry, inputCls, selectCls } from '../../data/countries';
import type { LocalityParts } from '../../utils/countryFormat';
import {
  autofillLocalityFromPostcode,
  formatPostcodeInput,
  getCitySuggestions,
  validateOptionalPostcode,
} from '../../utils/countryFormat';

type Props = {
  countryCode: string;
  value: LocalityParts;
  onChange: (value: LocalityParts) => void;
  extraCityOptions?: string[];
  extraStateOptions?: string[];
  showErrors?: boolean;
  labelClassName?: string;
  fieldClassName?: string;
};

export function CountryLocalityFields({
  countryCode,
  value,
  onChange,
  extraCityOptions = [],
  extraStateOptions = [],
  showErrors = false,
  labelClassName = 'text-[11px] text-muted-foreground',
  fieldClassName = '',
}: Props) {
  const cityListId = useId();
  const country = getCountry(countryCode);
  const postcodeError = showErrors ? validateOptionalPostcode(countryCode, value.postcode) : null;
  const citySuggestions = useMemo(
    () => getCitySuggestions(countryCode, value.state, extraCityOptions),
    [countryCode, value.state, extraCityOptions],
  );
  const stateOptions = useMemo(
    () => [...new Set([...country.states, ...extraStateOptions.map(v => v.trim()).filter(Boolean)])].sort((a, b) => a.localeCompare(b)),
    [country.states, extraStateOptions],
  );

  function set<K extends keyof LocalityParts>(key: K, next: LocalityParts[K]) {
    onChange({ ...value, [key]: next });
  }

  function handleStateChange(nextState: string) {
    const citiesForState = getCitySuggestions(countryCode, nextState, extraCityOptions);
    const keepCity = value.city.trim() && citiesForState.some(c => c.toLowerCase() === value.city.trim().toLowerCase());
    onChange({
      ...value,
      state: nextState,
      city: keepCity ? value.city : '',
    });
  }

  function handlePostcodeBlur() {
    const formatted = formatPostcodeInput(countryCode, value.postcode);
    const next = autofillLocalityFromPostcode(countryCode, formatted, {
      ...value,
      postcode: formatted,
    });
    onChange(next);
  }

  return (
    <>
      <label className={`block ${fieldClassName}`}>
        <span className={labelClassName}>{country.stateLabel}</span>
        <select
          className={`${selectCls} mt-1 w-full`}
          value={value.state}
          onChange={e => handleStateChange(e.target.value)}
        >
          <option value="">— Select —</option>
          {stateOptions.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </label>

      <label className={`block ${fieldClassName}`}>
        <span className={labelClassName}>{country.cityLabel}</span>
        <input
          className={`${inputCls} mt-1 w-full`}
          list={cityListId}
          value={value.city}
          onChange={e => set('city', e.target.value)}
          placeholder={value.state ? `Select or type ${country.cityLabel.toLowerCase()}` : 'Select state first'}
        />
        <datalist id={cityListId}>
          {citySuggestions.map(city => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </label>

      <label className={`block ${fieldClassName}`}>
        <span className={labelClassName}>{country.postcodeLabel}</span>
        <input
          className={`${inputCls} mt-1 w-full`}
          value={value.postcode}
          onChange={e => set('postcode', formatPostcodeInput(countryCode, e.target.value))}
          onBlur={handlePostcodeBlur}
          placeholder={country.postcodePlaceholder}
        />
        {postcodeError && <p className="text-xs text-destructive mt-1">{postcodeError}</p>}
      </label>
    </>
  );
}
