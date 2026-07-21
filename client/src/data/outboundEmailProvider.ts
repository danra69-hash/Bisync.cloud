/** Outbound mail provider helpers (mirrors server CompanyOutboundEmailService rules). */

export type OutboundProviderMode = 'auto' | 'microsoft' | 'google' | 'custom';

export type OutboundProviderInfo = {
  id: string;
  label: string;
  tip: string;
};

export const OUTBOUND_PROVIDER_MODES: {
  id: OutboundProviderMode;
  label: string;
  tip: string;
}[] = [
  {
    id: 'auto',
    label: 'Auto-detect',
    tip: 'Tries Microsoft 365 first for company domains, then Google Workspace and domain SMTP.',
  },
  {
    id: 'microsoft',
    label: 'Microsoft 365',
    tip:
      'Uses smtp.office365.com. Business mailboxes often need Authenticated SMTP enabled in Exchange admin ' +
      '(mailbox → Manage email apps). Security Defaults may block password SMTP — then use an App Password or Custom SMTP.',
  },
  {
    id: 'google',
    label: 'Google Workspace',
    tip: 'Uses smtp.gmail.com. Accounts with 2-Step Verification need a 16-character App Password (not the normal login password).',
  },
  {
    id: 'custom',
    label: 'Custom SMTP',
    tip: 'Use your provider host or a transactional relay (SendGrid, Amazon SES, Mailgun). Enter host and port below.',
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
      + ' If this mailbox is Google Workspace, choose Google above.',
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
  mode: OutboundProviderMode = 'auto',
  customHost = '',
): boolean {
  const address = email.trim();
  const hasPassword = passwordDraft.trim().length > 0 || passwordSet;
  if (!(address.includes('@') && address.includes('.') && hasPassword)) return false;
  if (mode === 'custom' && !customHost.trim()) return false;
  return true;
}
