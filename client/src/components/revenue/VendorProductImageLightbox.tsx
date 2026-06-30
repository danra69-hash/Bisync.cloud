import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { LIGHTBOX_OVERLAY_CLS, LIGHTBOX_SHELL_CLS } from '../layout/sidePanelShared';

type Props = {
  productName: string;
  imageUrl: string;
  onClose: () => void;
};

/** Request a higher-resolution image for the lightbox (thumbnail catalog uses 80×80). */
function enlargedImageUrl(imageUrl: string, scale = 5): string {
  return imageUrl.replace(/\/(\d+)\/(\d+)(\?.*)?$/, (_, w, h, query = '') => {
    const width = Math.max(Number(w) * scale, 400);
    const height = Math.max(Number(h) * scale, 400);
    return `/${width}/${height}${query}`;
  });
}

export function VendorProductImageLightbox({ productName, imageUrl, onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const modalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!modalRoot) return null;

  return createPortal(
    <>
      <div className={LIGHTBOX_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div
        className={`${LIGHTBOX_SHELL_CLS} w-[min(96vw,960px)] max-h-[96vh] bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${productName} photo`}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <p className="text-sm font-semibold text-foreground truncate">{productName}</p>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 flex items-center justify-center bg-muted/20 min-h-[min(85vh,640px)] overflow-auto">
          <img
            src={enlargedImageUrl(imageUrl)}
            alt={productName}
            className="min-w-[min(400px,85vw)] min-h-[min(400px,70vh)] max-w-[min(900px,92vw)] max-h-[min(900px,85vh)] w-auto h-auto object-contain rounded-md"
          />
        </div>
      </div>
    </>,
    modalRoot,
  );
}
