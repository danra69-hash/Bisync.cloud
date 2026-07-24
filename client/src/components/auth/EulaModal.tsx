import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { EulaDocument } from './EulaDocument';
import { CURRENT_EULA_VERSION, EULA_TITLE } from '../../data/eula';

type Props = {
  onClose: () => void;
};

export function EulaModal({ onClose }: Props) {
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-herme-ink/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="eula-modal-title"
        className="relative flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-herme-muted/60 bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-herme-muted/50 px-5 py-4 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F37021]">Legal</p>
            <h2 id="eula-modal-title" className="text-base font-bold text-herme-ink truncate">
              {EULA_TITLE}
            </h2>
            <p className="text-xs text-herme-ink/50 mt-0.5">Version {CURRENT_EULA_VERSION}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-herme-ink/40 transition-colors hover:bg-herme-light hover:text-herme-ink shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <EulaDocument />
        </div>

        <div className="border-t border-herme-muted/50 px-5 py-3 flex justify-end shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#F37021] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#D4550A]"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
