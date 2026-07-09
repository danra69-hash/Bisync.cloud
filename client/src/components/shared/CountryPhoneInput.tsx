import { useId } from 'react';
import { getCountry, inputCls } from '../../data/countries';
import { formatPhoneInput, validateOptionalPhone, validatePhone } from '../../utils/countryFormat';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  countryCode: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  showError?: boolean;
  className?: string;
  variant?: 'fax' | 'phone' | 'mobile';
  readOnly?: boolean;
};

export function CountryPhoneInput({
  countryCode,
  value,
  onChange,
  label = 'Phone',
  required = false,
  showError = true,
  className,
  variant = 'phone',
  readOnly = false,
}: Props) {
  const { t } = useAppTranslation();
  const inputId = useId();
  const country = getCountry(countryCode);
  const placeholder = variant === 'fax' ? country.faxPlaceholder : country.phonePlaceholder;
  const error = required
    ? validatePhone(countryCode, value, label)
    : validateOptionalPhone(countryCode, value, label);
  const visibleError = showError && value.trim() ? error : showError && required && !value.trim() ? `${label} is required.` : null;

  function handleFocus() {
    if (!value.trim()) {
      onChange(`${country.dialCode} `);
    }
  }

  function handleChange(next: string) {
    onChange(next);
  }

  function handleBlur() {
    if (value.trim()) {
      onChange(formatPhoneInput(countryCode, value));
    }
  }

  return (
    <div className={className}>
      <label htmlFor={inputId} className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
        {label}{required ? ' *' : ''}
      </label>
      <input
        id={inputId}
        type="tel"
        required={required}
        readOnly={readOnly}
        value={value}
        onFocus={handleFocus}
        onChange={e => handleChange(e.target.value)}
        onBlur={handleBlur}
        className={`${inputCls} mt-1`}
        placeholder={placeholder}
      />
      <p className="text-xs text-muted-foreground mt-1">{t('forms.startsWithDialCode', { country: country.name, dialCode: country.dialCode })}</p>
      {visibleError && <p className="text-xs text-destructive mt-1">{visibleError}</p>}
    </div>
  );
}

export function getPhoneValidationError(
  countryCode: string,
  value: string,
  label = 'Phone number',
  required = false,
): string | null {
  if (required) return validatePhone(countryCode, value, label);
  return validateOptionalPhone(countryCode, value, label);
}
