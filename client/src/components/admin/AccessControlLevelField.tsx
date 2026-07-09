import { useEffect, useState } from 'react';
import { api } from '../../api';
import {
  defaultAccessControlTypes,
  parseAccessControlTypes,
  type AccessControlType,
} from '../../data/accessControlCatalog';
import { selectCls } from '../../data/countries';

type Props = {
  value: string | null | undefined;
  disabled?: boolean;
  onChange: (typeId: string | null) => void;
};

export function AccessControlLevelField({ value, disabled, onChange }: Props) {
  const [types, setTypes] = useState<AccessControlType[]>(() => defaultAccessControlTypes());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.accessControl()
      .then(data => setTypes(parseAccessControlTypes(data.typesJson)))
      .catch(() => setTypes(defaultAccessControlTypes()))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Access Control Level</label>
      <p className="text-xs text-muted-foreground mt-0.5 mb-1">
        Assign one of the platform access control types configured under Platform Config.
      </p>
      <select
        className={`${selectCls} mt-1`}
        value={value ?? ''}
        disabled={disabled || loading}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">{loading ? 'Loading…' : '— Not assigned —'}</option>
        {types.map(type => (
          <option key={type.id} value={type.id}>{type.label}</option>
        ))}
      </select>
    </div>
  );
}
