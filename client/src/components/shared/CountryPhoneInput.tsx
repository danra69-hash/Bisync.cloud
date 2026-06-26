import { getCountry, inputCls } from '../../data/countries';
import { validateOptionalPhone, validatePhone } from '../../utils/countryFormat';

type Props = {
  countryCode: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  showError?: boolean;
};

export function CountryPhoneInput({
  countryCode,
  value,
  onChange,
  label = 'Phone',
  required = false,
  showError = true,
}: Props) {
  const country = getCountry(countryCode);
  const error = required
    ? validatePhone(countryCode, value, label)
    : validateOptionalPhone(countryCode, value, label);
  const visibleError = showError && value.trim() ? error : showError && required && !value.trim() ? `${label} is required.` : null;

  return (
    <div>
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}{required ? ' *' : ''}</label>
      <input
        type="tel"
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${inputCls} mt-1`}
        placeholder={country.phonePlaceholder}
      />
      <p className="text-[10px] text-muted-foreground mt-1">{country.name} format · starts with {country.dialCode}</p>
      {visibleError && <p className="text-[10px] text-destructive mt-1">{visibleError}</p>}
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
