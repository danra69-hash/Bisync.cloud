import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import { hrApi } from '../../modules/hr/api';
import { PlatformTeamChatPopup } from '../chat/PlatformTeamChatPopup';

/**
 * Header bell opens Team chat in a popup (same chat as Home / RMS left rail).
 * Badge shows unread Team chat count when the user has a linked employee.
 */
export function NotificationBell() {
  const { t } = useAppTranslation();
  const { currentUser, isAuthenticated } = useCurrentUser();
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const employeeId = currentUser?.employeeId ?? null;

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
    const id = window.setInterval(() => void refreshUnread(), 20_000);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  useEffect(() => {
    if (!chatOpen) void refreshUnread();
  }, [chatOpen, refreshUnread]);

  const badgeLabel = useMemo(
    () => (unreadCount > 99 ? '99+' : String(unreadCount)),
    [unreadCount],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="relative p-2 rounded-md hover:bg-white/10"
        title={t('header.notifications')}
        aria-label={t('header.notifications')}
        aria-haspopup="dialog"
        aria-expanded={chatOpen}
      >
        <Bell size={14} className="text-white/70" />
        {unreadCount > 0 ? (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center leading-none">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      <PlatformTeamChatPopup open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
