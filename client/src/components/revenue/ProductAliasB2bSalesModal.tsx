import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Product } from '../../api';
import {
  buildB2bConfigForSave,
  resolvePrincipalB2bRrp,
  seedAliasB2bSalesConfig,
  type B2bSalesConfig,
} from '../../data/productB2bSales';
import { MODAL_OVERLAY_CLS, MODAL_SHELL_CLS } from '../layout/sidePanelShared';
import { B2bSalesBox } from './B2bSalesBox';

type Props = {
  aliasName: string;
  config: B2bSalesConfig;
  principalConfig: B2bSalesConfig;
  fallbackRrp: number;
  linkedSubProduct: Product | null;
  linkedSubProductBatchCogs?: number | null;
  onSave: (config: B2bSalesConfig, rrp: number) => void;
  onClose: () => void;
};

export function ProductAliasB2bSalesModal({
  aliasName,
  config,
  principalConfig,
  fallbackRrp,
  linkedSubProduct,
  linkedSubProductBatchCogs,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<B2bSalesConfig>(() =>
    seedAliasB2bSalesConfig(config, principalConfig, fallbackRrp),
  );

  useEffect(() => {
    setDraft(seedAliasB2bSalesConfig(config, principalConfig, fallbackRrp));
  }, [config, principalConfig, fallbackRrp]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleSave() {
    const saved = buildB2bConfigForSave(draft, fallbackRrp);
    const rrp = resolvePrincipalB2bRrp(saved, fallbackRrp);
    onSave(saved, rrp);
    onClose();
  }

  const previewRrp = resolvePrincipalB2bRrp(draft, fallbackRrp);

  return createPortal(
    <>
      <div className={MODAL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div
        className={`${MODAL_SHELL_CLS} w-[min(96vw,920px)] max-h-[92vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Product Alias RRP</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">{aliasName || 'Unnamed alias'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Delivery units and RRP for customers tagged with this alias only.
              {previewRrp > 0 ? ` Principal RRP: ${previewRrp.toFixed(2)}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
          <B2bSalesBox
            config={draft}
            linkedSubProduct={linkedSubProduct}
            linkedSubProductBatchCogs={linkedSubProductBatchCogs}
            showUnitDisableSwitch
            onChange={setDraft}
          />
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            Alias-specific packaging applies only to customers tagged with this alias on sales orders and invoices.
          </p>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
