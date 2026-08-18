import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, X } from 'lucide-react';
import { devConsoleAuthApi } from '../../data/devConsoleAuthApi';

type Props = {
  open: boolean;
  onClose: () => void;
  /** When true, the dialog cannot be dismissed until the password is changed. */
  required?: boolean;
  onSuccess?: () => void;
};

export function DevConsoleChangePasswordModal({ open, onClose, required = false, onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setOk(null);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword === 'Pass@123') {
      setError('Choose a new password different from the default team password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      const result = await devConsoleAuthApi.changePassword(currentPassword, newPassword);
      setOk(result.message || 'Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.();
      if (!required) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  function tryClose() {
    if (required || saving) return;
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={tryClose}
        aria-hidden
      />
      <form
        onSubmit={e => void handleSubmit(e)}
        className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-3 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {required ? 'Set a new password' : 'Change password'}
          </h2>
          {!required && (
            <button type="button" onClick={tryClose} disabled={saving} aria-label="Close">
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {required && (
          <p className="text-xs text-muted-foreground">
            You are signing in with the default team password. Choose a personal password to continue.
          </p>
        )}

        {error && (
          <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {error}
          </div>
        )}
        {ok && (
          <div className="px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs">
            {ok}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Current password</span>
          <input
            type={show ? 'text' : 'password'}
            required
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder={required ? 'Pass@123' : undefined}
            autoComplete="current-password"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">New password</span>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              required
              minLength={8}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm pr-10"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Confirm new password</span>
          <input
            type={show ? 'text' : 'password'}
            required
            minLength={8}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            autoComplete="new-password"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          {!required && (
            <button type="button" onClick={tryClose} disabled={saving} className="rounded-md border border-border px-3 py-1.5 text-xs">
              Close
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
