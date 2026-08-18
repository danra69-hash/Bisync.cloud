import { useEffect } from 'react';
import { X } from 'lucide-react';
import { PlatformTeamChatPanel } from './PlatformTeamChatPanel';
import './PlatformTeamChat.css';

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Modal host for Team chat — opened from the header notification bell. */
export function PlatformTeamChatPopup({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="platform-team-chat-popup-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="platform-team-chat-popup"
        role="dialog"
        aria-modal="true"
        aria-label="Team chat"
        onClick={event => event.stopPropagation()}
      >
        <div className="platform-team-chat-popup-head">
          <h2>Team chat</h2>
          <button type="button" onClick={onClose} aria-label="Close chat">
            <X size={14} />
          </button>
        </div>
        <div className="platform-team-chat-popup-body">
          <PlatformTeamChatPanel fill />
        </div>
      </div>
    </div>
  );
}
