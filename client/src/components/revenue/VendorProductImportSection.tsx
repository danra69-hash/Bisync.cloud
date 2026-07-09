import { useMemo, useRef, useState } from 'react';
import { FilePlus2, Upload } from 'lucide-react';
import type { Vendor } from '../../api';
import {
  applyVendorProductOverrides,
  downloadVendorProductTemplateCsv,
  parseVendorProductsFromOcrText,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import {
  buildVendorProductImportPlan,
  parseVendorProductImportCsv,
  type VendorProductImportPlan,
} from '../../data/vendorProductImportCatalog';
import { VendorProductImportReviewPanel } from './VendorProductImportReviewPanel';

type Props = {
  vendor: Vendor;
  existingProducts: VendorProductCatalogItem[];
  onApplied: () => void;
};

export function VendorProductImportSection({ vendor, existingProducts, onApplied }: Props) {
  const [importError, setImportError] = useState<string | null>(null);
  const [importPlan, setImportPlan] = useState<VendorProductImportPlan | null>(null);
  const [scannedDocs, setScannedDocs] = useState<File[]>([]);
  const [ocrRunning, setOcrRunning] = useState(false);
  const scannedRef = useRef<HTMLInputElement | null>(null);
  const templateRef = useRef<HTMLInputElement | null>(null);

  const groupOptions = useMemo(
    () => [...new Set([
      ...applyVendorProductOverrides().map(product => product.group),
      ...existingProducts.map(product => product.group),
    ])].sort((a, b) => a.localeCompare(b)),
    [existingProducts],
  );

  function handleDownloadTemplate() {
    setImportError(null);
    downloadVendorProductTemplateCsv(
      existingProducts,
      `${vendor.externalId.toLowerCase()}-vendor-product-template.csv`,
    );
  }

  async function handleTemplateUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImportError(null);
    try {
      const text = await files[0].text();
      const drafts = parseVendorProductImportCsv(text);
      if (drafts.length === 0) {
        setImportError('Template file parsed no valid rows. Use the downloaded vendor product template format.');
        return;
      }
      const plan = buildVendorProductImportPlan(drafts, existingProducts);
      setImportPlan(plan);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to read vendor product template.');
    }
  }

  async function appendScannedFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setScannedDocs(prev => [...prev, ...Array.from(files)]);
    setImportError(null);
  }

  async function runOcrOnFirstScanned() {
    if (scannedDocs.length === 0) {
      setImportError('Upload at least one scanned vendor product document first.');
      return;
    }
    setOcrRunning(true);
    setImportError(null);
    try {
      const [{ createWorker }, file] = await Promise.all([
        import('tesseract.js'),
        Promise.resolve(scannedDocs[0]),
      ]);
      const worker = await createWorker('eng');
      const result = await worker.recognize(file);
      await worker.terminate();
      const drafts = parseVendorProductsFromOcrText(result.data.text ?? '');
      if (drafts.length === 0) {
        setImportError('OCR did not extract any valid vendor product rows.');
        return;
      }
      const plan = buildVendorProductImportPlan(drafts, existingProducts);
      setImportPlan(plan);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'OCR failed.');
    } finally {
      setOcrRunning(false);
    }
  }

  return (
    <>
      <div className="border border-border rounded-lg p-3 space-y-2 mb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Vendor Products</p>
          <span className="text-xs text-muted-foreground">Import from document or template</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-[#2563eb]/40 bg-[#2563eb]/10 text-[#1d4ed8] hover:bg-[#2563eb]/15"
          >
            <FilePlus2 size={11} />
            Download Vendor Product Template CSV
          </button>
          <button
            type="button"
            onClick={() => scannedRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-[#16a34a]/40 bg-[#16a34a]/10 text-[#15803d] hover:bg-[#16a34a]/15"
          >
            <Upload size={11} />
            Upload Scanned Vendor Product Document
          </button>
          <button
            type="button"
            onClick={() => templateRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#6d28d9] hover:bg-[#7c3aed]/15"
          >
            <FilePlus2 size={11} />
            Upload Vendor Product Template
          </button>
        </div>
        <input
          ref={scannedRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            void appendScannedFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={templateRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => {
            void handleTemplateUpload(e.target.files);
            e.target.value = '';
          }}
        />
        {(scannedDocs.length > 0) && (
          <div className="text-xs text-muted-foreground space-y-1">
            {scannedDocs.map((file, index) => (
              <p key={`${file.name}-${index}`}>Scanned: {file.name}</p>
            ))}
          </div>
        )}
        <div className="pt-2 border-t border-border/70 space-y-2">
          <button
            type="button"
            onClick={() => void runOcrOnFirstScanned()}
            disabled={ocrRunning || scannedDocs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#f59e0b] text-white hover:bg-[#d97706] disabled:opacity-50"
          >
            {ocrRunning ? 'Running OCR…' : 'Run OCR on Scanned Document'}
          </button>
          <p className="text-xs text-muted-foreground">
            Expected format: Vendor Product ID | Product Name | Group | Specification | Delivery Unit | Price
          </p>
          {importError && <p className="text-xs text-red-500">{importError}</p>}
        </div>
      </div>

      {importPlan && (
        <VendorProductImportReviewPanel
          plan={importPlan}
          vendor={vendor}
          existingProducts={existingProducts}
          groupOptions={groupOptions}
          onClose={() => setImportPlan(null)}
          onApplied={() => {
            setImportPlan(null);
            setScannedDocs([]);
            onApplied();
          }}
        />
      )}
    </>
  );
}
