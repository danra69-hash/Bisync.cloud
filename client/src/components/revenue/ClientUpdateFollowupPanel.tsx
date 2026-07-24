import { useMemo, useState } from 'react';
import { CalendarPlus, MessageCircle, X } from 'lucide-react';
import {
  api,
  type SalesModuleClientUpdate,
  type SalesModuleClientUpdateFollowupResult,
} from '../../api';
import {
  SALES_DIARY_STATUSES,
  todayDateInputValue,
  type SalesDiaryStatus,
} from '../../data/salesDiary';
import { buildWhatsAppHref } from '../../data/shareLinks';

type Props = {
  row: SalesModuleClientUpdate;
  createdByEmail?: string;
  onClose: () => void;
  onSaved: (result: SalesModuleClientUpdateFollowupResult) => void;
};

function defaultStartLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}

function defaultEndLocal(startLocal: string): string {
  const d = new Date(startLocal);
  if (Number.isNaN(d.getTime())) return '';
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string {
  const d = new Date(value);
  return d.toISOString();
}

export function ClientUpdateFollowupPanel({
  row,
  createdByEmail = '',
  onClose,
  onSaved,
}: Props) {
  const [sendAppointment, setSendAppointment] = useState(true);
  const [changeStatus, setChangeStatus] = useState(false);
  const [title, setTitle] = useState(`Follow-up · ${row.company || row.brand || 'Client'}`);
  const [startLocal, setStartLocal] = useState(defaultStartLocal);
  const [endLocal, setEndLocal] = useState(() => defaultEndLocal(defaultStartLocal()));
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState(row.note || '');
  const [openWhatsApp, setOpenWhatsApp] = useState(true);
  const [statuses, setStatuses] = useState<SalesDiaryStatus[]>([]);
  const [comment, setComment] = useState('');
  const [contactDate, setContactDate] = useState(todayDateInputValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const companyLabel = useMemo(
    () => row.company || row.brand || '—',
    [row.company, row.brand],
  );

  function toggleStatus(status: SalesDiaryStatus) {
    setStatuses(prev => (prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]));
  }

  async function save() {
    if (!sendAppointment && !changeStatus) {
      setError('Choose Send Appointment and/or Change Status.');
      return;
    }
    if (sendAppointment) {
      if (!title.trim()) {
        setError('Appointment title is required.');
        return;
      }
      if (!startLocal || !endLocal) {
        setError('Appointment start and end are required.');
        return;
      }
      if (new Date(endLocal) <= new Date(startLocal)) {
        setError('End time must be after start time.');
        return;
      }
    }
    if (changeStatus) {
      if (statuses.length === 0) {
        setError('Tick at least one status.');
        return;
      }
      if (!comment.trim()) {
        setError('Comment is required when changing status.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    setResultMessage(null);
    try {
      const result = await api.followupSalesModuleClientUpdate(row.id, {
        sendAppointment,
        appointmentTitle: sendAppointment ? title.trim() : undefined,
        startsAt: sendAppointment ? localInputToIso(startLocal) : undefined,
        endsAt: sendAppointment ? localInputToIso(endLocal) : undefined,
        location: sendAppointment ? location.trim() : undefined,
        appointmentNotes: sendAppointment ? notes.trim() : undefined,
        changeStatus,
        statuses: changeStatus ? statuses : undefined,
        comment: changeStatus ? comment.trim() : undefined,
        contactDate: changeStatus ? `${contactDate}T00:00:00.000Z` : undefined,
        createdByEmail,
      });

      const parts: string[] = [];
      if (result.appointment) {
        parts.push(
          result.outlookSynced
            ? 'Appointment saved and Outlook invite synced.'
            : result.outlookSyncError
              ? `Appointment saved locally. Outlook: ${result.outlookSyncError}`
              : 'Appointment saved (add Microsoft Graph credentials on Sales Team to auto-send Outlook).',
        );
      }
      if (result.diaryEntry) parts.push('Status updated.');
      setResultMessage(parts.join(' '));

      if (openWhatsApp && result.whatsappMessage) {
        window.open(buildWhatsAppHref(result.whatsappMessage, result.whatsappMobile), '_blank', 'noopener,noreferrer');
      }

      onSaved(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Followup failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-4 space-y-3 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Followup · {companyLabel}</h3>
            <p className="text-[11px] text-muted-foreground">
              Hunter {row.hunter || '—'}
              {row.status ? ` · Status ${row.status}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X size={14} />
          </button>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={sendAppointment}
            onChange={e => setSendAppointment(e.target.checked)}
          />
          Send Appointment
        </label>

        {sendAppointment ? (
          <div className="rounded-md border border-border p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Uses Appointment Calendar rules. When Microsoft Graph credentials are set on Sales Team, Outlook receives the appointment automatically.
            </p>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Title</span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide">Starts</span>
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={e => {
                    setStartLocal(e.target.value);
                    setEndLocal(defaultEndLocal(e.target.value));
                  }}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide">Ends</span>
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={e => setEndLocal(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                />
              </label>
            </div>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Location</span>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Appointment note</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={openWhatsApp}
                onChange={e => setOpenWhatsApp(e.target.checked)}
              />
              <MessageCircle size={12} />
              Open WhatsApp with appointment note after save
            </label>
          </div>
        ) : null}

        <label className="inline-flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={changeStatus}
            onChange={e => setChangeStatus(e.target.checked)}
          />
          Change Status
        </label>

        {changeStatus ? (
          <div className="rounded-md border border-border p-3 space-y-2">
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
                  <label
                    key={status}
                    className="inline-flex items-center gap-2 text-xs rounded-md border border-border px-2 py-1.5 hover:bg-muted/40"
                  >
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
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Comment (required)</span>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder="Why is the status changing?"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              />
            </label>
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {resultMessage ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{resultMessage}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">
            Close
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            <CalendarPlus size={12} />
            {saving ? 'Saving…' : 'Save followup'}
          </button>
        </div>
      </div>
    </div>
  );
}
