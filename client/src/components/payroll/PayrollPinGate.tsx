import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, LogOut, ShieldOff } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useAccessControlMatrix } from '../../hooks/useAccessControlMatrix';
import {
  canAccessHrAdminPage,
  PAYROLL_ACCESS_ROW_KEYS,
} from '../../data/hrAdminAccess';
import { verifyPayrollAccessPin } from './payrollPin';

type GateProps = {
  embedded?: boolean;
  children: React.ReactNode;
  /** Heading shown on the PIN prompt and lock control. */
  title?: string;
  /** Access Control matrix row keys required to open this page. */
  requiredRowKeys?: readonly string[];
};

function InaccessibleMessage({
  embedded,
  title,
}: {
  embedded?: boolean;
  title: string;
}) {
  return (
    <div
      className={`flex items-center justify-center ${
        embedded ? 'min-h-[420px] py-8' : 'min-h-[calc(100vh-220px)] py-12'
      }`}
    >
      <div className="bg-card border border-border rounded-2xl shadow-sm w-full max-w-sm p-8 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-muted rounded-xl">
          <ShieldOff className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">This page is not accessible</p>
        <p className="text-xs text-muted-foreground">
          Your account does not have access and permission for this page. Contact a System Admin if you need access.
        </p>
      </div>
    </div>
  );
}

function PayrollPinPrompt({
  embedded,
  title,
  onUnlock,
}: {
  embedded?: boolean;
  title: string;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  async function submit() {
    if (!/^\d{6}$/.test(pin)) {
      setError('Enter a 6-digit PIN.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const valid = await verifyPayrollAccessPin(pin);
      if (!valid) {
        setError('Incorrect PIN. Please try again.');
        return;
      }
      setPin('');
      onUnlock();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to verify PIN. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className={`flex items-center justify-center ${embedded ? 'min-h-[420px] py-8' : 'min-h-[calc(100vh-220px)] py-12'}`}>
      <div className="bg-card border border-border rounded-2xl shadow-sm w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-xl mb-4">
            <Lock className="w-6 h-6 text-primary-foreground" />
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">Enter your 6-digit admin PIN to continue</p>
        </div>
        <div className="relative mb-4">
          <input
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && void submit()}
            placeholder="••••••"
            className="w-full border border-border rounded-xl px-4 py-3 pr-10 text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground/50 font-sans tracking-[0.35em] text-center text-lg"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPin(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={pin.length !== 6 || verifying}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          {verifying ? 'Verifying…' : `Unlock ${title}`}
        </button>
      </div>
    </div>
  );
}

export function PayrollPinGate({
  embedded = false,
  children,
  title = 'Payroll',
  requiredRowKeys = PAYROLL_ACCESS_ROW_KEYS,
}: GateProps) {
  const { currentUser } = useCurrentUser();
  const { matrix, loading } = useAccessControlMatrix();
  const [unlocked, setUnlocked] = useState(false);

  const allowed = useMemo(
    () => canAccessHrAdminPage(currentUser, matrix, requiredRowKeys),
    [currentUser, matrix, requiredRowKeys],
  );

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-muted-foreground ${
          embedded ? 'min-h-[240px]' : 'min-h-[calc(100vh-220px)]'
        }`}
      >
        Checking access…
      </div>
    );
  }

  if (!allowed) {
    return <InaccessibleMessage embedded={embedded} title={title} />;
  }

  if (!unlocked) {
    return (
      <PayrollPinPrompt
        embedded={embedded}
        title={title}
        onUnlock={() => setUnlocked(true)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex justify-end ${embedded ? '' : 'px-6 pt-6'}`}>
        <button
          type="button"
          onClick={() => setUnlocked(false)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Lock {title}
        </button>
      </div>
      {children}
    </div>
  );
}
