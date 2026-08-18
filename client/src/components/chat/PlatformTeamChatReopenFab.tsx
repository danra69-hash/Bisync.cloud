import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, MessageSquare } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { hrApi } from '../../modules/hr/api';
import { usePlatformTeamChatHidden } from './platformTeamChatVisibility';
import './PlatformTeamChat.css';

/**
 * Fixed reopen control when the chat rail is collapsed (does not reserve layout width).
 * Shows a notification bell when there are unread messages; otherwise a compact Chat chip.
 */
export function PlatformTeamChatReopenFab() {
  const { show } = usePlatformTeamChatHidden();
  const { currentUser, isAuthenticated } = useCurrentUser();
  const employeeId = currentUser?.employeeId ?? null;
  const [unreadCount, setUnreadCount] = useState(0);

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

  const badgeLabel = useMemo(
    () => (unreadCount > 99 ? '99+' : String(unreadCount)),
    [unreadCount],
  );

  if (unreadCount > 0) {
    return (
      <div className="platform-team-chat-float" role="status">
        <button
          type="button"
          className="platform-team-chat-bell"
          onClick={show}
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
    <div className="platform-team-chat-float platform-team-chat-float--quiet">
      <button
        type="button"
        className="platform-team-chat-float-open"
        onClick={show}
        title="Show team chat"
        aria-label="Show team chat"
      >
        <MessageSquare size={14} />
        <span>Chat</span>
      </button>
    </div>
  );
}
