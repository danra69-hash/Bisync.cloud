import { MessageSquare } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { TeamChatsLanding } from '../../modules/hr/TeamChatsLanding';
import '../../modules/hr/TeamPortal.css';
import './PlatformTeamChat.css';

type Props = {
  /** Shorter panel for Home module row. */
  compact?: boolean;
  /** Fill parent (popup body). */
  fill?: boolean;
  className?: string;
};

/**
 * Team chat only (list + thread + new message) for platform shells.
 * Requires the signed-in AppUser to be linked to an HR employee.
 */
export function PlatformTeamChatPanel({ compact = false, fill = false, className = '' }: Props) {
  const { currentUser, isAuthenticated } = useCurrentUser();
  const employeeId = currentUser?.employeeId ?? null;
  const employeeName = currentUser?.fullName?.trim() || 'You';

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
