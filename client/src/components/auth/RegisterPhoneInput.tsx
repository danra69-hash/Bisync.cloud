import { useEffect, useId, useMemo, useState } from 'react';
import {
  composeMobile,
  getPhoneCountry,
  PHONE_COUNTRIES,
  type PhoneCountryOption,
} from '../../data/phoneCountries';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  /** Full mobile including dial code (E.164-ish). */
  value: string;
  onChange: (fullMobile: string) => void;
  inputClassName?: string;
  selectClassName?: string;
  required?: boolean;
  id?: string;
  disabled?: boolean;
};

function nationalFromFull(full: string, dialCode: string): string {
  const trimmed = full.trim();
  if (!trimmed) return '';
  const digitsDial = dialCode.replace(/\D/g, '');
  const digitsAll = trimmed.replace(/\D/g, '');
  if (digitsAll.startsWith(digitsDial)) {
    return digitsAll.slice(digitsDial.length);
  }
  if (!trimmed.startsWith('+')) return trimmed.replace(/[^\d\s-]/g, '').trim();
  return digitsAll;
}

export function RegisterPhoneInput({
  countryCode,
  onCountryCodeChange,
  value,
  onChange,
  inputClassName,
  selectClassName,
  required,
  id,
  disabled,
}: Props) {
  const { t } = useAppTranslation();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const country = useMemo(() => getPhoneCountry(countryCode), [countryCode]);
  const [national, setNational] = useState(() => nationalFromFull(value, country.dialCode));
  const [countryTouched, setCountryTouched] = useState(false);

  useEffect(() => {
    setNational(prev => {
      const next = nationalFromFull(value, country.dialCode);
      return next || prev;
    });
  }, [country.dialCode]); // eslint-disable-line react-hooks/exhaustive-deps

  function emit(nextCountry: PhoneCountryOption, nextNational: string) {
    onChange(composeMobile(nextCountry.dialCode, nextNational));
  }

  function handleCountryChange(code: string) {
    setCountryTouched(true);
    onCountryCodeChange(code);
    const next = getPhoneCountry(code);
    emit(next, national);
  }

  function handleNationalChange(raw: string) {
    const cleaned = raw.replace(/[^\d\s-]/g, '');
    setNational(cleaned);
    emit(country, cleaned);
  }

  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={`${inputId}-country`}>
        {t('auth.mobileCountryCode')}
      </label>
      <select
        id={`${inputId}-country`}
        value={country.code}
        disabled={disabled}
        onChange={e => handleCountryChange(e.target.value)}
        className={selectClassName}
        aria-label={t('auth.mobileCountryCode')}
        data-country-touched={countryTouched ? '1' : '0'}
      >
        {PHONE_COUNTRIES.map(c => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dialCode} · {c.name}
          </option>
        ))}
      </select>
      <input
        id={inputId}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required={required}
        disabled={disabled}
        value={national}
        onChange={e => handleNationalChange(e.target.value)}
        className={inputClassName}
        placeholder={t('auth.mobileNumber')}
        aria-label={t('auth.mobileNumber')}
      />
    </div>
  );
}
