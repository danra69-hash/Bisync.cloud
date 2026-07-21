/** Outbound mail provider helpers (mirrors server CompanyOutboundEmailService rules). */

export type OutboundProviderMode = 'auto' | 'microsoft' | 'google' | 'custom';

export type OutboundProviderInfo = {
  id: string;
  label: string;
  tip: string;
};

export type SmtpServerDefaults = {
  host: string;
  port: number;
  useSsl: boolean;
};

export const OUTBOUND_PROVIDER_MODES: {
  id: OutboundProviderMode;
  label: string;
  tip: string;
}[] = [
  {
    id: 'auto',
    label: 'Auto-detect',
    tip: 'Prefills a likely SMTP host from the email domain. You can still edit host/port manually before testing.',
  },
  {
    id: 'microsoft',
    label: 'Microsoft 365',
    tip:
      'Prefills smtp.office365.com:587. Business mailboxes often need Authenticated SMTP enabled in Exchange admin ' +
      '(mailbox → Manage email apps). Security Defaults may block password SMTP — then use an App Password or a relay host.',
  },
  {
    id: 'google',
    label: 'Google Workspace',
    tip:
      'Prefills smtp.gmail.com:587. Google error 5.7.8 / BadCredentials means the normal password was rejected — ' +
      'create a 16-character App Password (Google Account → Security → 2-Step Verification → App passwords).',
  },
  {
    id: 'custom',
    label: 'Custom SMTP',
    tip: 'Enter host/port from your provider or transactional relay (SendGrid, Amazon SES, Mailgun).',
  },
];

const GOOGLE = new Set(['gmail.com', 'googlemail.com']);
const MICROSOFT = new Set([
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'office365.com',
]);
const YAHOO = new Set([
  'yahoo.com', 'yahoo.co.uk', 'yahoo.com.sg', 'yahoo.com.my', 'ymail.com', 'rocketmail.com',
]);
const ICLOUD = new Set(['icloud.com', 'me.com', 'mac.com']);
const ZOHO = new Set(['zoho.com', 'zohomail.com']);

function domainOf(email: string): string | null {
  const v = email.trim().toLowerCase();
  const at = v.lastIndexOf('@');
  if (at <= 0 || at >= v.length - 1) return null;
  return v.slice(at + 1);
}

export function normalizeOutboundProviderMode(mode: string | null | undefined): OutboundProviderMode {
  const m = (mode ?? 'auto').trim().toLowerCase();
  if (m === 'microsoft' || m === 'ms' || m === 'm365' || m === 'office365') return 'microsoft';
  if (m === 'google' || m === 'gmail' || m === 'workspace') return 'google';
  if (m === 'custom') return 'custom';
  return 'auto';
}

/** Recommended SMTP host/port for a provider selection (user can override). */
export function defaultsForOutboundProvider(
  mode: OutboundProviderMode,
  email = '',
): SmtpServerDefaults {
  switch (mode) {
    case 'microsoft':
      return { host: 'smtp.office365.com', port: 587, useSsl: true };
    case 'google':
      return { host: 'smtp.gmail.com', port: 587, useSsl: true };
    case 'custom':
      return { host: '', port: 587, useSsl: true };
    case 'auto':
    default: {
      const domain = domainOf(email);
      if (domain && (GOOGLE.has(domain) || domain.endsWith('.google.com'))) {
        return { host: 'smtp.gmail.com', port: 587, useSsl: true };
      }
      if (domain && MICROSOFT.has(domain)) {
        return { host: 'smtp.office365.com', port: 587, useSsl: true };
      }
      if (domain && (YAHOO.has(domain) || domain.startsWith('yahoo.'))) {
        return { host: 'smtp.mail.yahoo.com', port: 587, useSsl: true };
      }
      if (domain && ICLOUD.has(domain)) {
        return { host: 'smtp.mail.me.com', port: 587, useSsl: true };
      }
      if (domain && (ZOHO.has(domain) || domain.endsWith('.zoho.com'))) {
        return { host: 'smtp.zoho.com', port: 587, useSsl: true };
      }
      // Company domains default to Microsoft 365 host — editable if wrong.
      return { host: 'smtp.office365.com', port: 587, useSsl: true };
    }
  }
}

export function detectOutboundProvider(email: string): OutboundProviderInfo | null {
  const domain = domainOf(email);
  if (!domain) return null;

  if (GOOGLE.has(domain) || domain.endsWith('.google.com')) {
    return {
      id: 'google',
      label: 'Google / Gmail',
      tip: OUTBOUND_PROVIDER_MODES.find(m => m.id === 'google')!.tip,
    };
  }
  if (MICROSOFT.has(domain)) {
    return {
      id: 'microsoft',
      label: 'Microsoft 365 / Outlook',
      tip: OUTBOUND_PROVIDER_MODES.find(m => m.id === 'microsoft')!.tip,
    };
  }
  if (YAHOO.has(domain) || domain.startsWith('yahoo.')) {
    return {
      id: 'yahoo',
      label: 'Yahoo Mail',
      tip: 'Yahoo usually requires an app password from account security settings.',
    };
  }
  if (ICLOUD.has(domain)) {
    return {
      id: 'icloud',
      label: 'iCloud Mail',
      tip: 'iCloud requires an app-specific password from appleid.apple.com.',
    };
  }
  if (ZOHO.has(domain) || domain.endsWith('.zoho.com')) {
    return {
      id: 'zoho',
      label: 'Zoho Mail',
      tip: 'Use your Zoho email and password (or app password if MFA is enabled).',
    };
  }

  return {
    id: 'microsoft-business',
    label: 'Microsoft Exchange / Microsoft 365',
    tip: OUTBOUND_PROVIDER_MODES.find(m => m.id === 'microsoft')!.tip
      + ' If this mailbox is Google Workspace, choose Google and use smtp.gmail.com.',
  };
}

export function tipForOutboundMode(
  mode: OutboundProviderMode,
  email: string,
): OutboundProviderInfo {
  if (mode !== 'auto') {
    const preset = OUTBOUND_PROVIDER_MODES.find(m => m.id === mode)!;
    return { id: mode, label: preset.label, tip: preset.tip };
  }
  return detectOutboundProvider(email) ?? {
    id: 'auto',
    label: 'Auto-detect',
    tip: OUTBOUND_PROVIDER_MODES[0].tip,
  };
}

export function outboundEmailReady(
  email: string,
  passwordDraft: string,
  passwordSet: boolean,
  _mode: OutboundProviderMode = 'auto',
  smtpHost = '',
): boolean {
  const address = email.trim();
  const hasPassword = passwordDraft.trim().length > 0 || passwordSet;
  if (!(address.includes('@') && address.includes('.') && hasPassword)) return false;
  if (!smtpHost.trim()) return false;
  return true;
}
