import { useEffect, useState } from 'react';
import { Camera, Search, Send, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { hrApi } from './api';
import type { TeamChatConversationSummary, TeamChatDirectoryPerson } from './teamChatTypes';

type Props = {
  employeeId: number;
  /** CSS selector / element to capture. Defaults to .team-shell or document.body */
  captureRoot?: HTMLElement | null;
  onShared?: (conversationId: number) => void;
  onToast?: (message: string) => void;
};

export function TeamScreenshotShare({ employeeId, captureRoot, onShared, onToast }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [conversations, setConversations] = useState<TeamChatConversationSummary[]>([]);
  const [directory, setDirectory] = useState<TeamChatDirectoryPerson[]>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'pick' | 'people'>('pick');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [conv, dir] = await Promise.all([
          hrApi.teamChat.conversations(employeeId),
          hrApi.teamChat.directory(employeeId),
        ]);
        if (cancelled) return;
        setConversations(Array.isArray(conv.conversations) ? conv.conversations : []);
        setDirectory(Array.isArray(dir) ? dir.filter(p => p.id !== employeeId) : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load chats.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, employeeId]);

  const capture = async () => {
    setBusy(true);
    setError(null);
    try {
      const root = captureRoot
        ?? (document.querySelector('.team-shell') as HTMLElement | null)
        ?? document.body;
      const canvas = await html2canvas(root, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        ignoreElements: (el) => el.classList?.contains('team-screenshot-fab')
          || el.classList?.contains('team-modal-backdrop'),
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setPreview(dataUrl);
      setOpen(true);
      setMode('pick');
      setNote('');
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Screenshot failed.');
    } finally {
      setBusy(false);
    }
  };

  const dataUrlToPayload = (dataUrl: string) => {
    const comma = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, Math.max(0, comma));
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const contentType = meta.includes('image/jpeg') ? 'image/jpeg' : 'image/png';
    return { base64, contentType };
  };

  const shareToConversation = async (conversationId: number) => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const { base64, contentType } = dataUrlToPayload(preview);
      await hrApi.teamChat.postMessage(conversationId, {
        employeeId,
        body: note.trim() || 'Screenshot shared from Team',
        attachmentBase64: base64,
        attachmentContentType: contentType,
      });
      setOpen(false);
      setPreview(null);
      onToast?.('Screenshot shared.');
      onShared?.(conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share screenshot.');
    } finally {
      setBusy(false);
    }
  };

  const shareToPerson = async (peerId: number) => {
    setBusy(true);
    setError(null);
    try {
      const started = await hrApi.teamChat.startDirect(employeeId, peerId);
      await shareToConversation(started.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start chat.');
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredConv = conversations.filter(c => !q || c.title.toLowerCase().includes(q));
  const filteredPeople = directory.filter(p =>
    !q
    || p.name.toLowerCase().includes(q)
    || p.department?.toLowerCase().includes(q),
  );

  return (
    <>
      <button
        type="button"
        className="team-screenshot-fab"
        onClick={() => void capture()}
        disabled={busy}
        aria-label="Screenshot to chat"
        title="Screenshot to chat"
      >
        <Camera size={18} />
      </button>

      {open && preview ? (
        <div className="team-modal-backdrop" role="presentation" onClick={() => !busy && setOpen(false)}>
          <div className="team-modal team-screenshot-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Share screenshot</h3>
              <button type="button" className="team-btn-ghost" disabled={busy} onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <img src={preview} alt="Screenshot preview" className="team-screenshot-preview" />
            <label className="team-field" style={{ marginTop: 8 }}>
              <span>Note (optional)</span>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a short note…" />
            </label>
            <div className="team-msg-tabs" style={{ marginTop: 8 }}>
              <button type="button" className={mode === 'pick' ? 'is-active' : ''} onClick={() => setMode('pick')}>
                Conversations
              </button>
              <button type="button" className={mode === 'people' ? 'is-active' : ''} onClick={() => setMode('people')}>
                People
              </button>
            </div>
            <div className="team-chat-search" style={{ marginTop: 8 }}>
              <Search size={14} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" />
            </div>
            {error ? <p className="team-inline-error">{error}</p> : null}
            <ul className="team-chat-directory-list">
              {mode === 'pick'
                ? filteredConv.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="team-chat-row"
                      disabled={busy || (c.type === 'announcement')}
                      onClick={() => void shareToConversation(c.id)}
                      title={c.type === 'announcement' ? 'Use a direct chat to share screenshots' : undefined}
                    >
                      <span className="team-chat-row-copy">
                        <strong>{c.title}</strong>
                        <em>{c.type === 'announcement' ? 'Announcements are text-only for posters' : 'Tap to send'}</em>
                      </span>
                      <Send size={14} />
                    </button>
                  </li>
                ))
                : filteredPeople.map(p => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="team-chat-row"
                      disabled={busy}
                      onClick={() => void shareToPerson(p.id)}
                    >
                      <span className="team-chat-avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                      <span className="team-chat-row-copy">
                        <strong>{p.name}</strong>
                        <em>{p.position || p.department || p.email}</em>
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
