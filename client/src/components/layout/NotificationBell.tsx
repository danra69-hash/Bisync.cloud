import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api, type UserNotification } from '../../api';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import { MillstoneLoader } from '../shared/MillstoneLoader';

function formatNotificationWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationBell() {
  const { t } = useAppTranslation();
  const { currentUser, isAuthenticated } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingIds, setMarkingIds] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await api.userNotifications(currentUser.id, currentUser.fullName);
      setNotifications(rows);
    } catch (err) {
      setNotifications([]);
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
  }, [open, loadNotifications]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.isRead).length,
    [notifications],
  );

  async function handleToggleRead(notification: UserNotification, checked: boolean) {
    if (!checked || notification.isRead || markingIds[notification.id]) return;
    setMarkingIds(prev => ({ ...prev, [notification.id]: true }));
    try {
      const updated = await api.markNotificationRead(notification.id);
      setNotifications(prev => prev.map(n => (n.id === updated.id ? updated : n)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read.');
    } finally {
      setMarkingIds(prev => {
        const next = { ...prev };
        delete next[notification.id];
        return next;
      });
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="relative p-2 rounded-md hover:bg-white/10"
        title={t('header.notifications')}
        aria-label={t('header.notifications')}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={14} className="text-white/70" />
        {unreadCount > 0 ? (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t('header.notifications')}
          className="absolute right-0 top-full mt-2 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-card shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">{t('header.notifications')}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {unreadCount > 0
                  ? t('header.unreadCount', { count: unreadCount })
                  : t('header.allCaughtUp')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadNotifications()}
              disabled={loading}
              className="text-[10px] font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {t('common.refresh')}
            </button>
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {!isAuthenticated || !currentUser ? (
              <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                {t('header.signInForNotifications')}
              </p>
            ) : error ? (
              <p className="px-3 py-4 text-xs text-red-600">{error}</p>
            ) : loading && notifications.length === 0 ? (
              <MillstoneLoader size="sm" layout="block" label={t('common.loading')} />
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                {t('revMgmt.noNotifications')}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map(notification => {
                  const busy = Boolean(markingIds[notification.id]);
                  return (
                    <li
                      key={notification.id}
                      className={`px-3 py-2.5 ${notification.isRead ? 'bg-card' : 'bg-primary/5'}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <label
                          className="mt-0.5 shrink-0 flex items-center gap-1.5 cursor-pointer"
                          title={t('revMgmt.markRead')}
                        >
                          <input
                            type="checkbox"
                            checked={notification.isRead}
                            disabled={notification.isRead || busy}
                            onChange={e => void handleToggleRead(notification, e.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary"
                            aria-label={t('revMgmt.markRead')}
                          />
                        </label>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs ${notification.isRead ? 'font-medium text-foreground' : 'font-semibold text-foreground'}`}>
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatNotificationWhen(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            {notification.body}
                          </p>
                          {!notification.isRead ? (
                            <span className="inline-flex mt-1.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                              {t('header.new')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
