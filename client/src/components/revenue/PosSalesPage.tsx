import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import {
  api,
  type PosSalesHeaderMap,
  type PosSalesImportResult,
  type PosSalesLine,
  type PosSalesPreview,
  type PosSalesSystemField,
} from '../../api';
import { formatCountryNumber } from '../../utils/numberFormat';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { pageShellClass, TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls, inputCls } from '../layout/formControls';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { tableHeaderCls } from '../shared/tableHeaderStyles';
import { TableLoadingRow } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';
const filterCls = filterSelectCls;

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function PosSalesPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const { countryCode, number, rm } = useCountryFormatters();
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [businessDate, setBusinessDate] = useState(yesterdayIso);
  const [fromDate, setFromDate] = useState(monthStartIso);
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState(selectedLocationIds[0] ?? '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lines, setLines] = useState<PosSalesLine[]>([]);
  const [summary, setSummary] = useState({ lineCount: 0, batchCount: 0, totalQuantity: 0, totalGross: 0 });

  const [preview, setPreview] = useState<PosSalesPreview | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [systemFields, setSystemFields] = useState<PosSalesSystemField[]>([]);
  const [lastImport, setLastImport] = useState<PosSalesImportResult | null>(null);

  useEffect(() => {
    if (!selectedLocationIds.includes(locationId)) {
      setLocationId(selectedLocationIds[0] ?? '');
    }
  }, [selectedLocationIds, locationId]);

  const loadList = useCallback(async () => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) {
      setLines([]);
      setSummary({ lineCount: 0, batchCount: 0, totalQuantity: 0, totalGross: 0 });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.posSalesList({
        companyId: selectedCompanyId,
        locationIds: selectedLocationIds,
        from: fromDate,
        to: toDate,
      });
      setLines(result.lines);
      setSummary(result.summary);
    } catch (e) {
      setLines([]);
      setError(e instanceof Error ? e.message : 'Failed to load POS sales.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds, fromDate, toDate]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const mappedTargets = useMemo(
    () => new Set(Object.values(mapping).filter(Boolean)),
    [mapping],
  );

  const mappingReady =
    (mappedTargets.has('productName') || mappedTargets.has('productCode'))
    && (mappedTargets.has('quantity') || mappedTargets.has('lineTotal'));

  async function handleFileChosen(files: FileList | null) {
    if (!files?.[0] || !selectedCompanyId) return;
    const file = files[0];
    setUploading(true);
    setError(null);
    setNotice(null);
    setLastImport(null);
    try {
      const result = await api.posSalesPreview({ file, companyId: selectedCompanyId });
      setPendingFile(file);
      setPreview(result);
      setSystemFields(result.systemFields);
      setMapping({ ...(result.effectiveMapping ?? result.suggestedMapping) });
      if (!result.requiresMapping) {
        setNotice('Headers match a saved POS mapping. Review sample rows, then import.');
      } else {
        setNotice('First time (or new header layout): map each file column to a POS field, then save & import.');
      }
    } catch (e) {
      setPreview(null);
      setPendingFile(null);
      setError(e instanceof Error ? e.message : 'Failed to read upload.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveMappingOnly() {
    if (!selectedCompanyId || !preview) return;
    setUploading(true);
    setError(null);
    try {
      const saved: PosSalesHeaderMap = await api.posSalesSaveHeaderMap({
        companyId: selectedCompanyId,
        headerFingerprint: preview.headerFingerprint,
        mapping,
      });
      setNotice(`Header mapping saved (${saved.headerFingerprint.slice(0, 8)}…).`);
      setPreview(prev => prev ? { ...prev, requiresMapping: false, savedMapping: mapping, effectiveMapping: mapping } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save header mapping.');
    } finally {
      setUploading(false);
    }
  }

  async function confirmImport() {
    if (!selectedCompanyId || !pendingFile || !locationId) {
      setError('Select a location and upload a file first.');
      return;
    }
    if (!mappingReady) {
      setError('Map product (name or code) and quantity or line total before importing.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await api.posSalesImport({
        file: pendingFile,
        companyId: selectedCompanyId,
        locationExternalId: locationId,
        businessDate,
        mapping,
      });
      setLastImport(result);
      setNotice(result.message);
      setPreview(null);
      setPendingFile(null);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setUploading(false);
    }
  }

  function cancelPreview() {
    setPreview(null);
    setPendingFile(null);
    setMapping({});
  }

  return (
    <div className={pageShellClass()}>
      <PageStickyFilters>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Business date (upload)
            <input
              type="date"
              className={inputCls}
              value={businessDate}
              onChange={e => setBusinessDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Location
            <select
              className={filterCls}
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              disabled={!orgReady}
            >
              {selectedLocationIds.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            From
            <input type="date" className={inputCls} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            To
            <input type="date" className={inputCls} value={toDate} onChange={e => setToDate(e.target.value)} />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
            onClick={() => void loadList()}
            disabled={loading || !orgReady}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#F37021] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !orgReady || !locationId}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload POS sales
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xlsm,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={e => void handleFileChosen(e.target.files)}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground max-w-3xl">
          Upload previous-day (or any chosen day) detailed sales as PDF, CSV, or Excel.
          Headers are checked against the POS field list; the first time a layout appears you must map columns so amounts land in the right database fields.
        </p>
      </PageStickyFilters>

      {!orgReady && (
        <p className="mt-3 text-sm text-muted-foreground">Select a company and location to manage POS sales.</p>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {notice && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</div>
      )}
      {lastImport && (
        <div className="mt-2 text-xs text-muted-foreground">
          Batch #{lastImport.batchId} · {lastImport.importedCount} lines · qty {formatCountryNumber(lastImport.totalQuantity, countryCode)} · {rm(lastImport.totalGross)}
        </div>
      )}

      {preview && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Map headers → POS fields</h3>
              <p className="text-xs text-muted-foreground">
                {preview.fileName} · {preview.totalDataRows} data row(s) · fingerprint {preview.headerFingerprint.slice(0, 10)}…
                {preview.requiresMapping ? ' · mapping required' : ' · saved mapping found'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-xs"
                onClick={cancelPreview}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                onClick={() => void saveMappingOnly()}
                disabled={uploading || !mappingReady}
              >
                Save mapping
              </button>
              <button
                type="button"
                className="rounded-md bg-[#F37021] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                onClick={() => void confirmImport()}
                disabled={uploading || !mappingReady}
              >
                {uploading ? 'Working…' : 'Import into POS DB'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border border-border">
              <thead>
                <tr>
                  <th className={tableHeaderCls('left')}>File header</th>
                  <th className={tableHeaderCls('left')}>Maps to POS field</th>
                  <th className={tableHeaderCls('left')}>Sample values</th>
                </tr>
              </thead>
              <tbody>
                {preview.headers.map((header, hi) => (
                  <tr key={header} className="border-t border-border">
                    <td className="px-2 py-2 font-medium">{header}</td>
                    <td className="px-2 py-2">
                      <select
                        className={filterCls}
                        value={mapping[header] ?? ''}
                        onChange={e => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                      >
                        <option value="">— ignore —</option>
                        {systemFields.map(f => (
                          <option
                            key={f.key}
                            value={f.key}
                            disabled={mappedTargets.has(f.key) && mapping[header] !== f.key}
                          >
                            {f.label}{f.requiredHint ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {preview.sampleRows.slice(0, 3).map(r => r[hi] || '—').join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{summary.batchCount} upload(s)</span>
        <span>{summary.lineCount} line(s)</span>
        <span>Qty {formatCountryNumber(summary.totalQuantity, countryCode)}</span>
        <span>Gross {rm(summary.totalGross)}</span>
      </div>

      <TableScrollContainer className={`${TABLE_SCROLL_CLS} mt-3`}>
        <table className="min-w-full border-collapse text-sm">
          <ColGroup widths={[100, 90, 110, 90, 180, 70, 90, 90, 90]} />
          <thead>
            <tr>
              <th className={tableHeaderCls('left')}>Date</th>
              <th className={tableHeaderCls('left')}>Check</th>
              <th className={tableHeaderCls('left')}>Code</th>
              <th className={tableHeaderCls('left')}>Product</th>
              <th className={tableHeaderCls('right')}>Qty</th>
              <th className={tableHeaderCls('right')}>Unit</th>
              <th className={tableHeaderCls('right')}>Total</th>
              <th className={tableHeaderCls('right')}>Tax</th>
              <th className={tableHeaderCls('left')}>Pay</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={9} />
            ) : lines.length === 0 ? (
              <tr>
                <td colSpan={9} className={`${tdCls} text-muted-foreground`}>
                  No uploaded POS sales in this range yet.
                </td>
              </tr>
            ) : (
              lines.map(line => (
                <tr key={line.id}>
                  <td className={tdCls}>{line.businessDate}</td>
                  <td className={tdCls}>{line.checkNumber || '—'}</td>
                  <td className={tdCls}>{line.productCode || '—'}</td>
                  <td className={tdCls}>
                    {line.productName}
                    {line.resolvedProductId ? (
                      <span className="ml-1 text-[10px] text-emerald-700">linked</span>
                    ) : null}
                  </td>
                  <td className={`${tdCls} text-right`}>{number(line.quantity)}</td>
                  <td className={`${tdCls} text-right`}>{rm(line.unitPrice)}</td>
                  <td className={`${tdCls} text-right`}>{rm(line.lineTotal)}</td>
                  <td className={`${tdCls} text-right`}>{rm(line.tax)}</td>
                  <td className={tdCls}>{line.paymentMethod || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  );
}
