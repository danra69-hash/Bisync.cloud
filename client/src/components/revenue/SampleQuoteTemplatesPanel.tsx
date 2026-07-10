import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, FileText, X } from 'lucide-react';
import {
  SAMPLE_QUOTE_TEMPLATES,
  type SampleQuoteTemplateId,
} from '../../data/requestForSample';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CREATE_VENDOR_CLS } from '../layout/sidePanelShared';

type Props = {
  onClose: () => void;
  onSelectTemplate: (templateId: SampleQuoteTemplateId) => void;
};

export function SampleQuoteTemplatesPanel({ onClose, onSelectTemplate }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground">Sample & Quote</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Choose a template</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Select a request template to continue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {SAMPLE_QUOTE_TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onSelectTemplate(template.id);
              }}
              className="w-full text-left rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/50 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-md bg-primary/10 text-primary shrink-0">
                  <FileText size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{template.name}</p>
                    <ChevronRight
                      size={14}
                      className="text-muted-foreground group-hover:text-primary shrink-0"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {template.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
