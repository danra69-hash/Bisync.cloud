import { useCallback, useEffect, useMemo, useState } from 'react';
import { EyeOff, MessageSquare } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { hrApi } from '../../modules/hr/api';
import { TeamChatsLanding } from '../../modules/hr/TeamChatsLanding';
import '../../modules/hr/TeamPortal.css';
import { usePlatformTeamChatHidden } from './platformTeamChatVisibility';
import './PlatformTeamChat.css';

type Props = {
  /** Shorter panel for Home module row. */
  compact?: boolean;
  /** Fill parent (popup body). */
  fill?: boolean;
  /** Allow Hide → collapse rail (Home / RMS). Parent must unmount the rail when hidden. */
  collapsible?: boolean;
  className?: string;
};

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
  const { hidden, hide } = usePlatformTeamChatHidden();
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
    if (collapsible && hidden) return;
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), 15_000);
    return () => window.clearInterval(id);
  }, [refreshUnread, collapsible, hidden]);

  const badgeLabel = useMemo(
    () => (unreadCount > 99 ? '99+' : String(unreadCount)),
    [unreadCount],
  );

  /* Parent collapses the rail; render nothing so we never reserve width. */
  if (collapsible && hidden) return null;

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
            onClick={() => hide()}
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
