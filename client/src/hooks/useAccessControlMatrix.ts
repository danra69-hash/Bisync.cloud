import { useEffect, useState } from 'react';
import { api } from '../api';
import {
  ensureSuperUserMatrixGrants,
  parseAccessControlMatrix,
  parseAccessControlTypes,
  type AccessControlMatrix,
  type AccessControlType,
} from '../data/accessControlCatalog';

/** Loads the platform Access Control matrix once for permission checks. */
export function useAccessControlMatrix(): {
  matrix: AccessControlMatrix | null;
  types: AccessControlType[];
  loading: boolean;
} {
  const [matrix, setMatrix] = useState<AccessControlMatrix | null>(null);
  const [types, setTypes] = useState<AccessControlType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.accessControl()
      .then(data => {
        if (cancelled) return;
        const nextTypes = parseAccessControlTypes(data.typesJson);
        const nextMatrix = ensureSuperUserMatrixGrants(
          parseAccessControlMatrix(data.matrixJson),
          nextTypes,
        );
        setTypes(nextTypes);
        setMatrix(nextMatrix);
      })
      .catch(() => {
        if (cancelled) return;
        setTypes([]);
        setMatrix({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { matrix, types, loading };
}
