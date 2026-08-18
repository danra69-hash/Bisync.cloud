import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, EyeOff, MessageSquare } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { hrApi } from '../../modules/hr/api';
import { TeamChatsLanding } from '../../modules/hr/TeamChatsLanding';
import '../../modules/hr/TeamPortal.css';
import './PlatformTeamChat.css';

const HIDDEN_STORAGE_KEY = 'bisync.platformTeamChat.hidden';

type Props = {
  /** Shorter panel for Home module row. */
  compact?: boolean;
  /** Fill parent (popup body). */
  fill?: boolean;
  /** Allow Hide → collapsed bell dock (Home / RMS rails). */
  collapsible?: boolean;
  className?: string;
};

function readHiddenPreference(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Team chat only (list + thread + new message) for platform shells.
 * Requires the signed-in AppUser to be linked to an HR employee.
 */
export function PlatformTeamChatPanel({
  compact = false,
  fill = false,
  collapsible = false,
  className = '',
}: Props) {
  const { currentUser, isAuthenticated } = useCurrentUser();
  const employeeId = currentUser?.employeeId ?? null;
  const employeeName = currentUser?.fullName?.trim() || 'You';
  const [hidden, setHidden] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!collapsible) return;
    setHidden(readHiddenPreference());
  }, [collapsible]);

  const persistHidden = useCallback((next: boolean) => {
    setHidden(next);
    try {
      window.localStorage.setItem(HIDDEN_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated || employeeId == null || employeeId <= 0) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await hrApi.teamChat.conversations(employeeId);
      const total = (data.conversations ?? []).reduce(
        (sum, row) => sum + (row.unreadCount > 0 ? row.unreadCount : 0),
        0,
      );
      setUnreadCount(total);
    } catch {
      setUnreadCount(0);
    }
  }, [employeeId, isAuthenticated]);

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), 15_000);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  useEffect(() => {
    if (hidden) void refreshUnread();
  }, [hidden, refreshUnread]);

  const badgeLabel = useMemo(
    () => (unreadCount > 99 ? '99+' : String(unreadCount)),
    [unreadCount],
  );

  const showBellDock = collapsible && hidden;
  /** Bell on top when there is at least one unread message (and chat is hidden). */
  const showMessageBell = showBellDock && unreadCount > 0;

  if (showBellDock) {
    if (!showMessageBell) {
      return (
        <div className={`platform-team-chat-dock platform-team-chat-dock--quiet ${className}`.trim()}>
          <button
            type="button"
            className="platform-team-chat-dock-open"
            onClick={() => persistHidden(false)}
            title="Show team chat"
            aria-label="Show team chat"
          >
            <MessageSquare size={14} />
            <span>Chat</span>
          </button>
        </div>
      );
    }

    return (
      <div className={`platform-team-chat-dock ${className}`.trim()} role="status">
        <button
          type="button"
          className="platform-team-chat-bell"
          onClick={() => persistHidden(false)}
          title={`${unreadCount} unread — open team chat`}
          aria-label={`Team chat, ${unreadCount} unread`}
        >
          <Bell size={16} />
          <span className="platform-team-chat-bell-badge">{badgeLabel}</span>
        </button>
        <span className="platform-team-chat-dock-hint">New messages</span>
      </div>
    );
  }

  return (
    <aside
      className={[
        'platform-team-chat',
        'platform-team-chat-panel',
        compact ? 'is-compact' : '',
        fill ? 'is-fill' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-label="Team chat"
    >
      {collapsible ? (
        <div className="platform-team-chat-toolbar">
          <div className="platform-team-chat-toolbar-title">
            <MessageSquare size={13} />
            <span>Team chat</span>
            {unreadCount > 0 ? (
              <span className="platform-team-chat-toolbar-unread" aria-label={`${unreadCount} unread`}>
                {badgeLabel}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="platform-team-chat-hide"
            onClick={() => persistHidden(true)}
            title="Hide chat"
            aria-label="Hide chat"
          >
            <EyeOff size={12} />
            Hide
          </button>
        </div>
      ) : null}

      {!isAuthenticated || !currentUser ? (
        <div className="platform-team-chat-empty">
          <MessageSquare size={18} className="mx-auto text-muted-foreground" />
          <strong>Sign in to chat</strong>
          <p>Team chat is available after you sign in.</p>
        </div>
      ) : employeeId == null || employeeId <= 0 ? (
        <div className="platform-team-chat-empty">
          <MessageSquare size={18} className="mx-auto text-muted-foreground" />
          <strong>Link your employee profile</strong>
          <p>Team chat needs an HR employee linked to your user account.</p>
        </div>
      ) : (
        <div className="platform-team-chat flex-1 min-h-0 overflow-hidden">
          <TeamChatsLanding employeeId={employeeId} employeeName={employeeName} />
        </div>
      )}
    </aside>
  );
}
