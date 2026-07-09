import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HR_CONFIG_TAB_I18N,
  MODULE_I18N,
  NAV_ITEM_I18N,
  POS_ITEM_I18N,
  REV_MGMT_ITEM_I18N,
  REV_MGMT_SECTION_I18N,
  REV_MGMT_SUBTITLE_I18N,
} from './navKeys';
import type { NavItem } from '../data/revenueManagement';

export function useAppTranslation() {
  const { t, i18n } = useTranslation();

  const navLabel = useCallback((item: NavItem) => t(NAV_ITEM_I18N[item]), [t]);
  const revMgmtSection = useCallback((title: string) => t(REV_MGMT_SECTION_I18N[title] ?? title), [t]);
  const revMgmtSubtitle = useCallback((subtitle: string) => t(REV_MGMT_SUBTITLE_I18N[subtitle] ?? subtitle), [t]);
  const revMgmtItem = useCallback((label: string) => t(REV_MGMT_ITEM_I18N[label] ?? label), [t]);
  const posItem = useCallback((label: string) => t(POS_ITEM_I18N[label] ?? label), [t]);
  const hrConfigTab = useCallback((label: string) => t(HR_CONFIG_TAB_I18N[label] ?? label), [t]);
  const moduleLabel = useCallback((moduleId: string) => t(MODULE_I18N[moduleId] ?? moduleId), [t]);

  /** Translate known UI labels; pass through unknown dynamic text (names, IDs). */
  const ui = useCallback((label: string) => {
    const key = REV_MGMT_ITEM_I18N[label]
      ?? POS_ITEM_I18N[label]
      ?? HR_CONFIG_TAB_I18N[label]
      ?? MODULE_I18N[label];
    return key ? t(key) : label;
  }, [t]);

  return {
    t,
    i18n,
    navLabel,
    revMgmtSection,
    revMgmtSubtitle,
    revMgmtItem,
    posItem,
    hrConfigTab,
    moduleLabel,
    ui,
  };
}
