import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  api,
  type CreateSalesModuleDiaryEntryPayload,
  type SalesModuleCompany,
  type SalesModuleDiaryEntry,
} from '../../api';
import {
  blankDiaryContact,
  contactTypeSkipsTaggedCompany,
  SALES_DIARY_ACTIVITY_TYPES,
  SALES_DIARY_CONTACT_TYPES,
  SALES_DIARY_STATUSES,
  todayDateInputValue,
  type SalesDiaryActivityType,
  type SalesDiaryContactPerson,
  type SalesDiaryContactType,
  type SalesDiaryStatus,
} from '../../data/salesDiary';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { TableLoadingRow } from '../shared/MillstoneLoader';

type Props = {
  salesTeamMemberId: number;
  hunterName: string;
  companies: SalesModuleCompany[];
  createdByEmail?: string;
};

export function SalesDiaryPanel({
  salesTeamMemberId,
  hunterName,
  companies,
  createdByEmail = '',
}: Props) {
  const [entries, setEntries] = useState<SalesModuleDiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [activity, setActivity] = useState<SalesDiaryActivityType | ''>('');
  const [popup, setPopup] = useState<'status' | 'call' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.salesModuleDiary(salesTeamMemberId)
      .then(rows => {
        if (!cancelled) setEntries(rows);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Sales Diary');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [salesTeamMemberId]);

  useEffect(() => {
    setCompanyId(prev => {
      if (prev && companies.some(c => c.id === prev)) return prev;
      return companies[0]?.id ?? '';
    });
  }, [companies]);

  function openActivityPopup() {
    if (!activity) {
      setError('Select an activity.');
      return;
    }
    setError(null);
    if (activity === 'Status Change') {
      if (!companyId) {
        setError('Select a company tagged to this Hunter.');
        return;
      }
      setPopup('status');
      return;
    }
    setPopup('call');
  }

  async function handleSaved(entry: SalesModuleDiaryEntry) {
    setEntries(prev => [entry, ...prev.filter(e => e.id !== entry.id)]);
    setPopup(null);
    setActivity('');
  }

  async function removeEntry(id: number) {
    try {
      await api.deleteSalesModuleDiaryEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete diary entry');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
        <label className="inline-flex flex-col gap-1 text-xs min-w-[12rem]">
          <span className="text-muted-foreground uppercase tracking-wide">Company</span>
          <select
            value={companyId}
            onChange={e => setCompanyId(e.target.value ? Number(e.target.value) : '')}
            className="rounded-md border border-border bg-background px-2 py-1.5"
          >
            <option value="">Select company…</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex flex-col gap-1 text-xs min-w-[12rem]">
          <span className="text-muted-foreground uppercase tracking-wide">Activity</span>
          <select
            value={activity}
            onChange={e => setActivity((e.target.value || '') as SalesDiaryActivityType | '')}
            className="rounded-md border border-border bg-background px-2 py-1.5"
          >
            <option value="">Select activity…</option>
            {SALES_DIARY_ACTIVITY_TYPES.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={openActivityPopup}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
        >
          <Plus size={12} />
          Log entry
        </button>
        <p className="text-[11px] text-muted-foreground self-center">
          Hunter {hunterName}
          {companies.length === 0 ? ' · no tagged companies yet' : ''}
          {activity === 'Sales Call' ? ' · Cold Call / Email Blast do not require tagged company' : ''}
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <TableScrollContainer>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-1.5 text-left">Date</th>
              <th className="px-2 py-1.5 text-left">Activity</th>
              <th className="px-2 py-1.5 text-left">Company</th>
              <th className="px-2 py-1.5 text-left">Detail</th>
              <th className="px-2 py-1.5 text-left">Contacts</th>
              <th className="px-2 py-1.5 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={6} label="Loading Sales Diary…" />
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No diary entries yet for this Hunter.
                </td>
              </tr>
            ) : (
              entries.map(row => (
                <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {new Date(row.contactDate).toLocaleDateString()}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{row.activityLabel}</td>
                  <td className="px-2 py-1.5">
                    {row.companyName || '—'}
                    {row.brandName ? ` · ${row.brandName}` : ''}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.activityType === 'StatusChange'
                      ? (row.statuses?.length ? row.statuses.join(', ') : '—')
                      : [
                          row.contactType || null,
                          row.locationVisited ? `Visited: ${row.locationVisited}` : null,
                          row.emailsSent != null ? `${row.emailsSent} emails` : null,
                        ].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    {(row.contacts ?? [])
                      .map(c => (c.position ? `${c.name} (${c.position})` : c.name))
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => void removeEntry(row.id)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                      aria-label="Delete diary entry"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScrollContainer>

      {popup === 'status' && typeof companyId === 'number' ? (
        <StatusChangePopup
          salesTeamMemberId={salesTeamMemberId}
          companyId={companyId}
          companyName={companies.find(c => c.id === companyId)?.name ?? ''}
          createdByEmail={createdByEmail}
          onClose={() => setPopup(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {popup === 'call' ? (
        <SalesCallPopup
          salesTeamMemberId={salesTeamMemberId}
          companies={companies}
          initialCompanyId={typeof companyId === 'number' ? companyId : null}
          createdByEmail={createdByEmail}
          onClose={() => setPopup(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}

function StatusChangePopup({
  salesTeamMemberId,
  companyId,
  companyName,
  createdByEmail,
  onClose,
  onSaved,
}: {
  salesTeamMemberId: number;
  companyId: number;
  companyName: string;
  createdByEmail: string;
  onClose: () => void;
  onSaved: (entry: SalesModuleDiaryEntry) => void;
}) {
  const [statuses, setStatuses] = useState<SalesDiaryStatus[]>([]);
  const [contactDate, setContactDate] = useState(todayDateInputValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleStatus(status: SalesDiaryStatus) {
    setStatuses(prev => (prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]));
  }

  async function save() {
    if (statuses.length === 0) {
      setError('Tick at least one status.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateSalesModuleDiaryEntryPayload = {
        salesTeamMemberId,
        activityType: 'Status Change',
        salesModuleCompanyId: companyId,
        contactDate: `${contactDate}T00:00:00.000Z`,
        statuses,
        createdByEmail,
      };
      const saved = await api.createSalesModuleDiaryEntry(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save status change');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Status Change · {companyName}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X size={14} />
          </button>
        </div>
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground uppercase tracking-wide">Date of Contact</span>
          <input
            type="date"
            value={contactDate}
            onChange={e => setContactDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          />
        </label>
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Status</p>
          <div className="grid grid-cols-2 gap-1.5">
            {SALES_DIARY_STATUSES.map(status => (
              <label key={status} className="inline-flex items-center gap-2 text-xs rounded-md border border-border px-2 py-1.5 hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={statuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                {status}
              </label>
            ))}
          </div>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SalesCallPopup({
  salesTeamMemberId,
  companies,
  initialCompanyId,
  createdByEmail,
  onClose,
  onSaved,
}: {
  salesTeamMemberId: number;
  companies: SalesModuleCompany[];
  initialCompanyId: number | null;
  createdByEmail: string;
  onClose: () => void;
  onSaved: (entry: SalesModuleDiaryEntry) => void;
}) {
  const [contactType, setContactType] = useState<SalesDiaryContactType | ''>('');
  const [companyId, setCompanyId] = useState<number | ''>(initialCompanyId ?? '');
  const [companyName, setCompanyName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [locationVisited, setLocationVisited] = useState('');
  const [emailsSent, setEmailsSent] = useState('');
  const [contactDate, setContactDate] = useState(todayDateInputValue);
  const [contacts, setContacts] = useState<SalesDiaryContactPerson[]>([blankDiaryContact()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skipsCompany = contactType ? contactTypeSkipsTaggedCompany(contactType) : false;

  async function save() {
    if (!contactType) {
      setError('Select Type of Contact.');
      return;
    }
    if (!skipsCompany && !companyId) {
      setError('Select a company tagged to this Hunter.');
      return;
    }
    if (contactType === 'Cold Call') {
      if (!companyName.trim() && !brandName.trim()) {
        setError('Cold Call requires company / brand name.');
        return;
      }
      if (!locationVisited.trim()) {
        setError('Cold Call requires location visited.');
        return;
      }
    }
    if (contactType === 'Email Blast') {
      const n = Number.parseInt(emailsSent, 10);
      if (!Number.isFinite(n) || n < 1) {
        setError('Email Blast requires number of emails sent.');
        return;
      }
    }
    const cleanedContacts = contacts
      .map(c => ({ name: c.name.trim(), position: c.position.trim() }))
      .filter(c => c.name);
    if (contactType !== 'Email Blast' && cleanedContacts.length === 0) {
      setError('Add at least one contact person.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: CreateSalesModuleDiaryEntryPayload = {
        salesTeamMemberId,
        activityType: 'Sales Call',
        salesModuleCompanyId: skipsCompany ? null : Number(companyId),
        companyName: skipsCompany ? companyName.trim() : undefined,
        brandName: brandName.trim() || undefined,
        locationVisited: contactType === 'Cold Call' ? locationVisited.trim() : undefined,
        emailsSent: contactType === 'Email Blast' ? Number.parseInt(emailsSent, 10) : null,
        contactType,
        contactDate: `${contactDate}T00:00:00.000Z`,
        contacts: cleanedContacts,
        createdByEmail,
      };
      const saved = await api.createSalesModuleDiaryEntry(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sales call');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Sales Call</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X size={14} />
          </button>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground uppercase tracking-wide">Type of Contact</span>
          <select
            value={contactType}
            onChange={e => setContactType((e.target.value || '') as SalesDiaryContactType | '')}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          >
            <option value="">Select type…</option>
            {SALES_DIARY_CONTACT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        {!skipsCompany ? (
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground uppercase tracking-wide">Company</span>
            <select
              value={companyId}
              onChange={e => setCompanyId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            >
              <option value="">Select company…</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        {contactType === 'Cold Call' ? (
          <>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Company name</span>
              <input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                placeholder="Company name…"
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Brand</span>
              <input
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                placeholder="Brand…"
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Location visited</span>
              <input
                value={locationVisited}
                onChange={e => setLocationVisited(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                placeholder="Location…"
              />
            </label>
          </>
        ) : null}

        {contactType === 'Email Blast' ? (
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground uppercase tracking-wide">No. of email sent</span>
            <input
              type="number"
              min={1}
              value={emailsSent}
              onChange={e => setEmailsSent(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>
        ) : null}

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground uppercase tracking-wide">Date of Contact</span>
          <input
            type="date"
            value={contactDate}
            onChange={e => setContactDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          />
        </label>

        {contactType !== 'Email Blast' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Contact Person / Position</p>
              <button
                type="button"
                onClick={() => setContacts(prev => [...prev, blankDiaryContact()])}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border border-border hover:bg-muted"
              >
                <Plus size={11} />
                Add
              </button>
            </div>
            {contacts.map((c, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  value={c.name}
                  onChange={e => setContacts(prev => prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row)))}
                  placeholder="Name…"
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  value={c.position}
                  onChange={e => setContacts(prev => prev.map((row, i) => (i === idx ? { ...row, position: e.target.value } : row)))}
                  placeholder="Position…"
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={contacts.length <= 1}
                  onClick={() => setContacts(prev => prev.filter((_, i) => i !== idx))}
                  className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40"
                  aria-label="Remove contact"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
