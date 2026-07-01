import { useEffect, useState } from 'react';
import { createPurchaseOrderPdfBlob, type PurchaseOrderPdfData } from '../../data/generatePurchaseOrderPdf';

type Props = {
  pdf: PurchaseOrderPdfData;
  className?: string;
};

export function PurchaseOrderPdfPreview({ pdf, className = '' }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setPreviewUrl(null);
    setError(null);

    void createPurchaseOrderPdfBlob(pdf)
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to generate PDF preview.');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdf]);

  if (error) {
    return (
      <div className={`rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-8 text-center text-sm text-red-600 ${className}`}>
        {error}
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className={`rounded-lg border border-border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground ${className}`}>
        Generating PDF preview…
      </div>
    );
  }

  return (
    <iframe
      title={`Purchase order ${pdf.poNumber}`}
      src={previewUrl}
      className={`w-full rounded-lg border border-border bg-white ${className}`}
    />
  );
}
