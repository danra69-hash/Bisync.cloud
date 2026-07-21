import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  parseAccessControlMatrix,
  type AccessControlMatrix,
} from '../data/accessControlCatalog';
import { shouldHideUnitPrices } from '../data/priceVisibility';
import { parseUserAccess } from '../data/userAccess';
import { useCurrentUser } from './useCurrentUser';

/**
 * Loads the Access Control matrix once and resolves whether the current user
 * must see quantities only (no unit prices / amounts).
 */
export function useShouldHidePrices(): boolean {
  const { currentUser } = useCurrentUser();
  const [matrix, setMatrix] = useState<AccessControlMatrix | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.accessControl()
      .then(data => {
        if (!cancelled) setMatrix(parseAccessControlMatrix(data.matrixJson));
      })
      .catch(() => {
        if (!cancelled) setMatrix({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => shouldHideUnitPrices(parseUserAccess(currentUser?.accessJson), matrix),
    [currentUser?.accessJson, matrix],
  );
}
