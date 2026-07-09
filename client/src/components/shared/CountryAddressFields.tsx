import { useId, useMemo } from 'react';
import { getCountry, inputCls, selectCls } from '../../data/countries';
import type { AddressParts } from '../../utils/countryFormat';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import {
  autofillLocalityFromPostcode,
  formatPostcodeInput,
  getCitySuggestions,
  validateAddress,
  validateOptionalPostcode,
} from '../../utils/countryFormat';

type Props = {
  countryCode: string;
  value: AddressParts;
  onChange: (value: AddressParts) => void;
  showErrors?: boolean;
};

export function CountryAddressFields({ countryCode, value, onChange, showErrors = false }: Props) {
  const { t } = useAppTranslation();
  const cityListId = useId();
  const country = getCountry(countryCode);
  const addressError = showErrors ? validateAddress(countryCode, value) : null;
  const postcodeError = showErrors ? validateOptionalPostcode(countryCode, value.postcode) : null;
  const citySuggestions = useMemo(
    () => getCitySuggestions(countryCode, value.stateProvince),
    [countryCode, value.stateProvince],
  );

  function set<K extends keyof AddressParts>(key: K, next: AddressParts[K]) {
    onChange({ ...value, [key]: next });
  }

  function handleStateChange(nextState: string) {
    const citiesForState = getCitySuggestions(countryCode, nextState);
    const keepCity = value.city.trim() && citiesForState.some(c => c.toLowerCase() === value.city.trim().toLowerCase());
    onChange({
      ...value,
      stateProvince: nextState,
      city: keepCity ? value.city : '',
    });
  }

  function handlePostcodeBlur() {
    const formatted = formatPostcodeInput(countryCode, value.postcode);
    const next = autofillLocalityFromPostcode(countryCode, formatted, {
      city: value.city,
      state: value.stateProvince,
      postcode: formatted,
    });
    onChange({
      ...value,
      postcode: formatted,
      city: next.city,
      stateProvince: next.state,
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{t('forms.addressLine1')}</label>
        <input
          className={`${inputCls} mt-1`}
          value={value.addressLine1}
          onChange={e => set('addressLine1', e.target.value)}
          placeholder={t('forms.streetAddress')}
        />
      </div>

      <div>
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{t('forms.addressLine2')}</label>
        <input
          className={`${inputCls} mt-1`}
          value={value.addressLine2}
          onChange={e => set('addressLine2', e.target.value)}
          placeholder={t('forms.suiteOptional')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{country.stateLabel}</label>
          <select
            className={`${selectCls} mt-1`}
            value={value.stateProvince}
            onChange={e => handleStateChange(e.target.value)}
          >
            <option value="">{t('forms.selectState')}</option>
            {country.states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{country.cityLabel}</label>
          <input
            className={`${inputCls} mt-1`}
            list={cityListId}
            value={value.city}
            onChange={e => set('city', e.target.value)}
            placeholder={value.stateProvince ? t('forms.selectOrTypeCity', { cityLabel: country.cityLabel.toLowerCase() }) : t('forms.selectStateFirst')}
          />
          <datalist id={cityListId}>
            {citySuggestions.map(city => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{country.postcodeLabel}</label>
        <input
          className={`${inputCls} mt-1`}
          value={value.postcode}
          onChange={e => set('postcode', formatPostcodeInput(countryCode, e.target.value))}
          onBlur={handlePostcodeBlur}
          placeholder={country.postcodePlaceholder}
        />
        {postcodeError && <p className="text-xs text-destructive mt-1">{postcodeError}</p>}
        <p className="text-xs text-muted-foreground mt-1">{t('forms.enterPostcodeAutofill', { postcodeLabel: country.postcodeLabel.toLowerCase(), cityLabel: country.cityLabel.toLowerCase(), stateLabel: country.stateLabel.toLowerCase() })}</p>
      </div>

      <p className="text-xs text-muted-foreground">{t('forms.countryFormat', { country: country.name })}</p>
      {addressError && <p className="text-xs text-destructive">{addressError}</p>}
    </div>
  );
}

export function getAddressValidationError(countryCode: string, value: AddressParts): string | null {
  return validateAddress(countryCode, value);
}
