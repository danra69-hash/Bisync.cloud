import { useState } from 'react';
import { Camera, Search, Send, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { hrApi } from '../../modules/hr/api';
import type { TeamChatConversationSummary, TeamChatDirectoryPerson } from '../../modules/hr/teamChatTypes';
import { useCurrentUser } from '../../hooks/useCurrentUser';

/** Platform-wide screenshot → Team chat share (requires linked EmployeeId). */
export function PlatformScreenshotShare() {
  const { currentUser } = useCurrentUser();
  const employeeId = currentUser?.employeeId ?? null;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [conversations, setConversations] = useState<TeamChatConversationSummary[]>([]);
  const [directory, setDirectory] = useState<TeamChatDirectoryPerson[]>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'pick' | 'people'>('pick');
  const [toast, setToast] = useState('');

  if (!employeeId) return null;

  const capture = async () => {
    setBusy(true);
    setError(null);
    try {
      const root = (document.querySelector('.app-shell') as HTMLElement | null)
        ?? (document.getElementById('root') as HTMLElement | null)
        ?? document.body;
      const canvas = await html2canvas(root, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        ignoreElements: (el) =>
          el.classList?.contains('platform-screenshot-fab')
          || el.classList?.contains('platform-screenshot-backdrop'),
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPreview(dataUrl);
      setNote('');
      setSearch('');
      setMode('pick');
      setOpen(true);
      const [conv, dir] = await Promise.all([
        hrApi.teamChat.conversations(employeeId),
        hrApi.teamChat.directory(employeeId),
      ]);
      setConversations(Array.isArray(conv.conversations) ? conv.conversations : []);
      setDirectory(Array.isArray(dir) ? dir.filter(p => p.id !== employeeId) : []);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Screenshot failed.');
      window.setTimeout(() => setToast(''), 2500);
    } finally {
      setBusy(false);
    }
  };

  const payloadFrom = (dataUrl: string) => {
    const comma = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, Math.max(0, comma));
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return {
      base64,
      contentType: meta.includes('image/jpeg') ? 'image/jpeg' : 'image/png',
    };
  };

  const shareToConversation = async (conversationId: number) => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const { base64, contentType } = payloadFrom(preview);
      await hrApi.teamChat.postMessage(conversationId, {
        employeeId,
        body: note.trim() || 'Screenshot shared from Bisync',
        attachmentBase64: base64,
        attachmentContentType: contentType,
      });
      setOpen(false);
      setPreview(null);
      setToast('Screenshot shared to Team chat.');
      window.setTimeout(() => setToast(''), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share.');
    } finally {
      setBusy(false);
    }
  };

  const shareToPerson = async (peerId: number) => {
    setBusy(true);
    try {
      const started = await hrApi.teamChat.startDirect(employeeId, peerId);
      await shareToConversation(started.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start chat.');
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredConv = conversations.filter(c => c.type !== 'announcement' && (!q || c.title.toLowerCase().includes(q)));
  const filteredPeople = directory.filter(p => !q || p.name.toLowerCase().includes(q) || p.department?.toLowerCase().includes(q));

  return (
    <>
      <button
        type="button"
        className="platform-screenshot-fab"
        onClick={() => void capture()}
        disabled={busy}
        title="Screenshot to Team chat"
        aria-label="Screenshot to Team chat"
      >
        <Camera size={15} />
      </button>
      {toast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 90,
            background: '#2A2118',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 650,
          }}
        >
          {toast}
        </div>
      ) : null}
      {open && preview ? (
        <div className="platform-screenshot-backdrop" role="presentation" onClick={() => !busy && setOpen(false)}>
          <div className="platform-screenshot-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>Share screenshot</strong>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <img src={preview} alt="Screenshot preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8, background: '#111' }} />
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional note…"
              style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" onClick={() => setMode('pick')} style={{ flex: 1, padding: 6, fontSize: 12, fontWeight: 700, border: mode === 'pick' ? '2px solid #2A2118' : '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                Conversations
              </button>
              <button type="button" onClick={() => setMode('people')} style={{ flex: 1, padding: 6, fontSize: 12, fontWeight: 700, border: mode === 'people' ? '2px solid #2A2118' : '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                People
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, border: '1px solid #ddd', borderRadius: 8, padding: '6px 8px' }}>
              <Search size={14} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ flex: 1, border: 0, outline: 'none', fontSize: 13 }} />
            </div>
            {error ? <p style={{ color: '#b42318', fontSize: 12 }}>{error}</p> : null}
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, maxHeight: 220, overflow: 'auto' }}>
              {mode === 'pick'
                ? filteredConv.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void shareToConversation(c.id)}
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 4px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span>
                        <strong style={{ display: 'block', fontSize: 13 }}>{c.title}</strong>
                        <em style={{ fontStyle: 'normal', fontSize: 11, color: '#666' }}>Tap to send</em>
                      </span>
                      <Send size={14} />
                    </button>
                  </li>
                ))
                : filteredPeople.map(p => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void shareToPerson(p.id)}
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 4px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span>
                        <strong style={{ display: 'block', fontSize: 13 }}>{p.name}</strong>
                        <em style={{ fontStyle: 'normal', fontSize: 11, color: '#666' }}>{p.position || p.department || p.email}</em>
                      </span>
                      <Send size={14} />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
