import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  FolderKanban,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  ChevronLeft,
  Megaphone,
} from 'lucide-react';
import { hrApi } from './api';
import type {
  TeamChatConversationSummary,
  TeamChatDirectoryPerson,
  TeamChatMessage,
  TeamChatProjectDetails,
} from './teamChatTypes';
import { TeamChatComposeModals, type ChatComposeMode } from './TeamChatComposeModals';

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
  if (c.type === 'project' && c.projectProgress) {
    return `Project · ${c.projectProgress.completed}/${c.projectProgress.total} tasks (${c.projectProgress.percent}%)`;
  }
  const last = c.lastMessage;
  if (!last) return 'No messages yet';
  if (last.hasAttachment && !last.body?.trim()) return '📷 Screenshot';
  if (last.hasAttachment) return `📷 ${last.body}`;
  return last.body || '—';
}

function conversationIcon(type: string) {
  if (type === 'announcement') return <Bell size={16} />;
  if (type === 'project') return <FolderKanban size={16} />;
  if (type === 'group') return <Users size={16} />;
  return <MessageSquare size={16} />;
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
  const [project, setProject] = useState<TeamChatProjectDetails | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<number | null>(null);

  const [composeMode, setComposeMode] = useState<ChatComposeMode | null>(null);
  const [directory, setDirectory] = useState<TeamChatDirectoryPerson[]>([]);
  const [dirLoading, setDirLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<number | null>(null);
  const messagesRef = useRef<TeamChatMessage[]>([]);
  messagesRef.current = messages;

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
      setProject(data.project ?? null);
      void refreshList();
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Unable to open conversation.');
      setMessages([]);
      setProject(null);
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
          const current = messagesRef.current;
          const lastId = current.length > 0 ? current[current.length - 1]!.id : undefined;
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
            setThreadTitle(prev => data.conversation.title || prev);
            setThreadType(data.conversation.type || 'direct');
          }
          if (data.project) setProject(data.project);
        } catch {
          /* keep UI stable while polling */
        }
      })();
    }, 5_000);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [activeId, employeeId]);

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

  const openCompose = async (mode: ChatComposeMode = 'menu') => {
    setComposeMode(mode);
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
      setComposeMode(null);
      await refreshList();
      await openConversation(created.id, created.title || peer.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start chat.');
    }
  };

  const startGroup = async (title: string, memberIds: number[]) => {
    const created = await hrApi.teamChat.startGroup(employeeId, title, memberIds);
    setComposeMode(null);
    await refreshList();
    await openConversation(created.id, created.title || title);
  };

  const startProject = async (input: {
    name: string;
    startDate: string;
    targetCompletionDate: string;
    memberEmployeeIds: number[];
    tasks: { title: string; assigneeEmployeeIds: number[] }[];
  }) => {
    const created = await hrApi.teamChat.startProject(employeeId, input);
    setComposeMode(null);
    await refreshList();
    await openConversation(created.id, created.title || input.name);
  };

  const toggleTask = async (taskId: number, completed: boolean) => {
    if (activeId == null || togglingTaskId != null) return;
    setTogglingTaskId(taskId);
    setThreadError(null);
    try {
      const updated = await hrApi.teamChat.setProjectTaskCompleted(activeId, taskId, employeeId, completed);
      setProject(updated);
      void refreshList();
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Unable to update task.');
    } finally {
      setTogglingTaskId(null);
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
              setProject(null);
              void refreshList();
            }}
          >
            <ChevronLeft size={16} />
            Chats
          </button>
          <div className="team-chat-thread-title">
            {threadType === 'announcement' ? <Megaphone size={14} /> : null}
            {threadType === 'project' ? <FolderKanban size={14} /> : null}
            {threadType === 'group' ? <Users size={14} /> : null}
            {threadType === 'direct' ? <MessageSquare size={14} /> : null}
            <strong>{threadTitle}</strong>
          </div>
        </div>

        {project ? (
          <div className="team-chat-project-panel">
            <div className="team-chat-project-meta">
              <span>Start {project.startDate || '—'}</span>
              <span>Target {project.targetCompletionDate || '—'}</span>
            </div>
            <div className="team-chat-progress-block">
              <div className="team-chat-progress-label">
                <span>Progress Task Bar</span>
                <strong>
                  {project.progress.completed} / {project.progress.total} ({project.progress.percent}%)
                </strong>
              </div>
              <div className="team-chat-progress-track" role="progressbar" aria-valuenow={project.progress.percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="team-chat-progress-fill" style={{ width: `${project.progress.percent}%` }} />
              </div>
            </div>
            <ul className="team-chat-project-task-list">
              {project.tasks.map(task => (
                <li key={task.id}>
                  <label className={`team-chat-project-task-row${task.completed ? ' is-done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      disabled={togglingTaskId === task.id}
                      onChange={e => void toggleTask(task.id, e.target.checked)}
                    />
                    <span>
                      <strong>{task.title}</strong>
                      {task.assigneeNames.length > 0 ? (
                        <em>{task.assigneeNames.map(n => `@${n}`).join(' ')}</em>
                      ) : (
                        <em>No users tagged</em>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="team-chat-messages">
          {messages.length === 0 ? (
            <p className="team-muted" style={{ textAlign: 'center', margin: '24px 0' }}>
              {threadType === 'announcement'
                ? 'Company announcements will appear here.'
                : threadType === 'project'
                  ? 'Project chat — discuss tasks below.'
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
              placeholder={
                threadType === 'announcement'
                  ? 'Write an announcement…'
                  : threadType === 'project'
                    ? 'Message the project team…'
                    : 'Type a message…'
              }
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
        <button type="button" className="team-chat-fab-plus" onClick={() => void openCompose('menu')} aria-label="New chat">
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
          No conversations yet. Tap + for Direct, Group chat, or Project.
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
              <span className={`team-chat-avatar${c.type === 'announcement' ? ' is-announce' : ''}${c.type === 'project' ? ' is-project' : ''}${c.type === 'group' ? ' is-group' : ''}`}>
                {conversationIcon(c.type)}
              </span>
              <span className="team-chat-row-copy">
                <strong>
                  {c.title}
                  {c.type === 'announcement' && canSendAnnouncement ? (
                    <em className="team-chat-badge">Can post</em>
                  ) : null}
                  {c.type === 'group' ? <em className="team-chat-badge">Group</em> : null}
                  {c.type === 'project' ? <em className="team-chat-badge is-project">Project</em> : null}
                </strong>
                <em>{previewText(c)}</em>
                {c.type === 'project' && c.projectProgress ? (
                  <span className="team-chat-progress-track is-inline" aria-hidden>
                    <span className="team-chat-progress-fill" style={{ width: `${c.projectProgress.percent}%` }} />
                  </span>
                ) : null}
              </span>
              <span className="team-chat-row-meta">
                <time>{c.lastMessage ? formatMsgTime(c.lastMessage.createdAt) : formatMsgTime(c.updatedAt)}</time>
                {c.unreadCount > 0 ? <span className="team-chat-unread">{c.unreadCount}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {composeMode ? (
        <TeamChatComposeModals
          mode={composeMode}
          employeeId={employeeId}
          directory={directory}
          dirLoading={dirLoading}
          onClose={() => setComposeMode(null)}
          onModeChange={setComposeMode}
          onStartDirect={person => void startWith(person)}
          onStartGroup={startGroup}
          onStartProject={startProject}
        />
      ) : null}
    </section>
  );
}
