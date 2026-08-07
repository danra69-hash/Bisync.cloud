import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  X,
  ChevronLeft,
  Megaphone,
} from 'lucide-react';
import { hrApi } from './api';
import type {
  TeamChatConversationSummary,
  TeamChatDirectoryPerson,
  TeamChatMessage,
} from './teamChatTypes';

type Props = {
  employeeId: number;
  employeeName: string;
  /** When set, open this conversation after load (e.g. screenshot share). */
  initialConversationId?: number | null;
  onConversationOpened?: (id: number) => void;
};

function formatMsgTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() == now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function previewText(c: TeamChatConversationSummary) {
  const last = c.lastMessage;
  if (!last) return 'No messages yet';
  if (last.hasAttachment && !last.body?.trim()) return '📷 Screenshot';
  if (last.hasAttachment) return `📷 ${last.body}`;
  return last.body || '—';
}

export function TeamChatsLanding({
  employeeId,
  employeeName,
  initialConversationId = null,
  onConversationOpened,
}: Props) {
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<TeamChatConversationSummary[]>([]);
  const [canSendAnnouncement, setCanSendAnnouncement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<number | null>(initialConversationId);
  const [threadTitle, setThreadTitle] = useState('');
  const [threadType, setThreadType] = useState<string>('direct');
  const [canSend, setCanSend] = useState(true);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [directory, setDirectory] = useState<TeamChatDirectoryPerson[]>([]);
  const [dirSearch, setDirSearch] = useState('');
  const [dirLoading, setDirLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<number | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const data = await hrApi.teamChat.conversations(employeeId);
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setCanSendAnnouncement(Boolean(data.canSendAnnouncement));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const openConversation = useCallback(async (id: number, titleHint?: string) => {
    setActiveId(id);
    setThreadError(null);
    onConversationOpened?.(id);
    try {
      const data = await hrApi.teamChat.messages(id, employeeId);
      setMessages(data.messages ?? []);
      setThreadTitle(data.conversation?.title || titleHint || 'Chat');
      setThreadType(data.conversation?.type || 'direct');
      setCanSend(data.conversation?.canSend !== false);
      void refreshList();
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Unable to open conversation.');
      setMessages([]);
    }
  }, [employeeId, onConversationOpened, refreshList]);

  useEffect(() => {
    void refreshList();
    const id = window.setInterval(() => void refreshList(), 12_000);
    return () => window.clearInterval(id);
  }, [refreshList]);

  useEffect(() => {
    if (initialConversationId != null && initialConversationId > 0) {
      void openConversation(initialConversationId);
    }
  }, [initialConversationId, openConversation]);

  useEffect(() => {
    if (activeId == null) {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const lastId = messages.length > 0 ? messages[messages.length - 1]!.id : undefined;
          const data = await hrApi.teamChat.messages(activeId, employeeId, lastId);
          if (lastId && data.messages?.length) {
            setMessages(prev => {
              const known = new Set(prev.map(m => m.id));
              const next = data.messages.filter(m => !known.has(m.id));
              return next.length ? [...prev, ...next] : prev;
            });
          } else if (!lastId) {
            setMessages(data.messages ?? []);
          }
          if (data.conversation) {
            setCanSend(data.conversation.canSend !== false);
            setThreadTitle(data.conversation.title || threadTitle);
          }
        } catch {
          /* keep UI stable while polling */
        }
      })();
    }, 5_000);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [activeId, employeeId, messages, threadTitle]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c =>
      c.title.toLowerCase().includes(q)
      || previewText(c).toLowerCase().includes(q),
    );
  }, [conversations, search]);

  const filteredDirectory = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    const others = directory.filter(p => p.id !== employeeId);
    if (!q) return others;
    return others.filter(p =>
      p.name.toLowerCase().includes(q)
      || p.department?.toLowerCase().includes(q)
      || p.position?.toLowerCase().includes(q)
      || p.email?.toLowerCase().includes(q),
    );
  }, [directory, dirSearch, employeeId]);

  const openNewChat = async () => {
    setShowNew(true);
    setDirSearch('');
    setDirLoading(true);
    try {
      const rows = await hrApi.teamChat.directory(employeeId);
      setDirectory(Array.isArray(rows) ? rows : []);
    } catch {
      setDirectory([]);
    } finally {
      setDirLoading(false);
    }
  };

  const startWith = async (peer: TeamChatDirectoryPerson) => {
    try {
      const created = await hrApi.teamChat.startDirect(employeeId, peer.id);
      setShowNew(false);
      await refreshList();
      await openConversation(created.id, created.title || peer.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start chat.');
    }
  };

  const send = async () => {
    if (activeId == null || !canSend || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setThreadError(null);
    try {
      const posted = await hrApi.teamChat.postMessage(activeId, {
        employeeId,
        body: text,
      });
      setDraft('');
      setMessages(prev => [
        ...prev,
        {
          id: posted.id,
          senderEmployeeId: posted.senderEmployeeId,
          senderName: employeeName,
          body: posted.body,
          hasAttachment: posted.hasAttachment,
          createdAt: posted.createdAt,
          mine: true,
        },
      ]);
      void refreshList();
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  if (activeId != null) {
    return (
      <section className="team-card team-chat-thread">
        <div className="team-panel-head team-chat-thread-head">
          <button
            type="button"
            className="team-back-btn"
            onClick={() => {
              setActiveId(null);
              void refreshList();
            }}
          >
            <ChevronLeft size={16} />
            Chats
          </button>
          <div className="team-chat-thread-title">
            {threadType === 'announcement' ? <Megaphone size={14} /> : <MessageSquare size={14} />}
            <strong>{threadTitle}</strong>
          </div>
        </div>

        <div className="team-chat-messages">
          {messages.length === 0 ? (
            <p className="team-muted" style={{ textAlign: 'center', margin: '24px 0' }}>
              {threadType === 'announcement'
                ? 'Company announcements will appear here.'
                : 'Say hello — start the conversation.'}
            </p>
          ) : null}
          {messages.map(m => (
            <div
              key={m.id}
              className={`team-chat-bubble${m.mine || m.senderEmployeeId === employeeId ? ' is-mine' : ''}${threadType === 'announcement' ? ' is-announce' : ''}`}
            >
              {threadType === 'announcement' || !(m.mine || m.senderEmployeeId === employeeId) ? (
                <span className="team-chat-bubble-from">{m.senderName || 'Colleague'}</span>
              ) : null}
              {m.attachmentDataUrl || m.hasAttachment ? (
                <img
                  className="team-chat-attachment"
                  src={m.attachmentDataUrl || undefined}
                  alt="Attachment"
                />
              ) : null}
              {m.body ? <p>{m.body}</p> : null}
              <time>{formatMsgTime(m.createdAt)}</time>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {threadError ? <p className="team-inline-error">{threadError}</p> : null}

        {canSend ? (
          <div className="team-chat-composer">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={threadType === 'announcement' ? 'Write an announcement…' : 'Type a message…'}
            />
            <button
              type="button"
              className="team-btn team-btn-primary"
              style={{ width: 'auto' }}
              disabled={sending || !draft.trim()}
              onClick={() => void send()}
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        ) : (
          <p className="team-muted team-chat-readonly">
            Everyone can read company announcements. Sending requires access permission.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="team-card team-chats-landing">
      <header className="team-landing-box-head team-chats-head">
        <h3>Chats</h3>
        <button type="button" className="team-chat-fab-plus" onClick={() => void openNewChat()} aria-label="New chat">
          <Plus size={18} />
        </button>
      </header>

      <div className="team-chat-search">
        <Search size={14} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
        />
      </div>

      {loading ? <p className="team-muted">Loading…</p> : null}
      {error ? <p className="team-inline-error">{error}</p> : null}

      {!loading && filtered.length === 0 ? (
        <p className="team-muted" style={{ textAlign: 'center', margin: '20px 0' }}>
          No conversations yet. Tap + to message a teammate.
        </p>
      ) : null}

      <ul className="team-chat-list">
        {filtered.map(c => (
          <li key={c.id}>
            <button
              type="button"
              className="team-chat-row"
              onClick={() => void openConversation(c.id, c.title)}
            >
              <span className={`team-chat-avatar${c.type === 'announcement' ? ' is-announce' : ''}`}>
                {c.type === 'announcement' ? <Bell size={16} /> : <Users size={16} />}
              </span>
              <span className="team-chat-row-copy">
                <strong>
                  {c.title}
                  {c.type === 'announcement' && canSendAnnouncement ? (
                    <em className="team-chat-badge">Can post</em>
                  ) : null}
                </strong>
                <em>{previewText(c)}</em>
              </span>
              <span className="team-chat-row-meta">
                <time>{c.lastMessage ? formatMsgTime(c.lastMessage.createdAt) : formatMsgTime(c.updatedAt)}</time>
                {c.unreadCount > 0 ? <span className="team-chat-unread">{c.unreadCount}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {showNew ? (
        <div className="team-modal-backdrop" role="presentation" onClick={() => setShowNew(false)}>
          <div className="team-modal team-chat-directory" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>New message</h3>
              <button type="button" className="team-btn-ghost" onClick={() => setShowNew(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p className="team-muted" style={{ margin: '0 0 8px' }}>Company address book</p>
            <div className="team-chat-search">
              <Search size={14} />
              <input
                value={dirSearch}
                onChange={e => setDirSearch(e.target.value)}
                placeholder="Search people"
                autoFocus
              />
            </div>
            {dirLoading ? <p className="team-muted">Loading…</p> : null}
            <ul className="team-chat-directory-list">
              {filteredDirectory.map(person => (
                <li key={person.id}>
                  <button type="button" className="team-chat-row" onClick={() => void startWith(person)}>
                    <span className="team-chat-avatar">{person.name.slice(0, 1).toUpperCase()}</span>
                    <span className="team-chat-row-copy">
                      <strong>{person.name}</strong>
                      <em>{[person.position, person.department].filter(Boolean).join(' · ') || person.email}</em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!dirLoading && filteredDirectory.length === 0 ? (
              <p className="team-muted" style={{ textAlign: 'center' }}>No colleagues found.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
