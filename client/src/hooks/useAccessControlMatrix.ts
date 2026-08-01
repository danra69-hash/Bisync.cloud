import { useEffect, useState } from 'react';
import { api } from '../api';
import {
  parseAccessControlMatrix,
  type AccessControlMatrix,
} from '../data/accessControlCatalog';

/** Loads the platform Access Control matrix once for permission checks. */
export function useAccessControlMatrix(): {
  matrix: AccessControlMatrix | null;
  loading: boolean;
} {
  const [matrix, setMatrix] = useState<AccessControlMatrix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.accessControl()
      .then(data => {
        if (!cancelled) setMatrix(parseAccessControlMatrix(data.matrixJson));
      })
      .catch(() => {
        if (!cancelled) setMatrix({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { matrix, loading };
}
