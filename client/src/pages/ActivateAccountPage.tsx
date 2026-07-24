import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAppTranslation } from '../i18n/useAppTranslation';
import { LoginModal } from '../components/auth/LoginModal';

type Props = {
  token: string;
};

export function ActivateAccountPage({ token }: Props) {
  const { t } = useAppTranslation();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.confirmActivation(token)
      .then(result => {
        if (cancelled) return;
        setStatus('ok');
        setMessage(result.message);
      })
      .catch(err => {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : t('auth.activationFailed'));
      });
    return () => { cancelled = true; };
  }, [token, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-herme-cream px-4">
      <div className="w-full max-w-md rounded-2xl border border-herme-muted/60 bg-white p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#F37021]">
          {t('auth.confirmActivation')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-herme-ink">
          {status === 'loading'
            ? t('auth.activatingAccount')
            : status === 'ok'
              ? t('auth.activationSuccessTitle')
              : t('auth.activationFailedTitle')}
        </h1>
        <p className="mt-3 text-sm text-herme-ink/65">
          {status === 'loading' ? t('auth.activatingAccountHint') : message}
        </p>
        {status === 'ok' && (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="mt-6 w-full rounded-xl bg-herme px-4 py-3 text-sm font-semibold text-white hover:bg-herme-dark"
          >
            {t('auth.loginButton')}
          </button>
        )}
        {status === 'error' && (
          <a
            href="/"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-herme-muted/70 px-4 py-3 text-sm font-semibold text-herme-ink hover:bg-herme-cream"
          >
            {t('auth.backToLanding')}
          </a>
        )}
      </div>
      {loginOpen && (
        <LoginModal
          onClose={() => {
            setLoginOpen(false);
            window.history.replaceState({}, '', '/');
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

export function parseActivationToken(pathname: string): string | null {
  const match = pathname.match(/^\/activate\/([a-f0-9]{32,})$/i);
  return match?.[1] ?? null;
}
