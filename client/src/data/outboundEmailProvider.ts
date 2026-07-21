/** Outbound mail provider helpers (mirrors server CompanyOutboundEmailService rules). */

export type OutboundProviderMode = 'auto' | 'microsoft' | 'microsoft-graph' | 'google' | 'custom';

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
    id: 'microsoft-graph',
    label: 'Microsoft Graph (recommended for Exchange)',
    tip:
      'Sends via Microsoft Graph API — no SMTP AUTH / App Password. In Azure: App registration → ' +
      'Application permission Mail.Send → Grant admin consent. Enter Tenant ID, Client ID, and Client secret below.',
  },
  {
    id: 'auto',
    label: 'Auto-detect (SMTP)',
    tip: 'Prefills a likely SMTP host from the email domain. Prefer Microsoft Graph for Exchange Online when SMTP AUTH is blocked.',
  },
  {
    id: 'microsoft',
    label: 'Microsoft 365 (SMTP)',
    tip:
      'Uses smtp.office365.com on port 587 only (never 995/993 — those are POP/IMAP). ' +
      'Often blocked unless Authenticated SMTP is enabled. Prefer Microsoft Graph instead.',
  },
  {
    id: 'google',
    label: 'Google Workspace (SMTP)',
    tip:
      'Prefills smtp.gmail.com:587. Accounts with 2-Step Verification need a 16-character App Password.',
  },
  {
    id: 'custom',
    label: 'Custom SMTP / relay',
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
  if (m === 'microsoft-graph' || m === 'graph' || m === 'ms-graph' || m === 'm365-graph') return 'microsoft-graph';
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
    case 'microsoft-graph':
      return { host: 'graph.microsoft.com', port: 443, useSsl: true };
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
      return { host: 'smtp.office365.com', port: 587, useSsl: true };
    }
  }
}

/** POP/IMAP ports are a common SMTP misconfiguration — map them to submission 587. */
export function isMailRetrievalPort(port: number): boolean {
  return port === 995 || port === 993 || port === 110 || port === 143;
}

export function normalizeSmtpPort(port: number | null | undefined, host = ''): number {
  const p = port && port > 0 && port <= 65535 ? port : 587;
  if (isMailRetrievalPort(p)) return 587;
  const h = host.trim().toLowerCase();
  if (
    (h.includes('office365') || h.includes('outlook') || h.includes('gmail'))
    && p !== 587
    && p !== 465
  ) {
    return 587;
  }
  return p;
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
      id: 'microsoft-graph',
      label: 'Microsoft 365 / Outlook',
      tip: OUTBOUND_PROVIDER_MODES.find(m => m.id === 'microsoft-graph')!.tip,
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
    id: 'microsoft-graph',
    label: 'Microsoft Exchange / Microsoft 365',
    tip: OUTBOUND_PROVIDER_MODES.find(m => m.id === 'microsoft-graph')!.tip,
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
    tip: OUTBOUND_PROVIDER_MODES.find(m => m.id === 'auto')!.tip,
  };
}

export function outboundEmailReady(
  email: string,
  passwordDraft: string,
  passwordSet: boolean,
  mode: OutboundProviderMode = 'auto',
  smtpHost = '',
  graph?: {
    tenantId?: string;
    clientId?: string;
    clientSecretDraft?: string;
    clientSecretSet?: boolean;
  },
): boolean {
  const address = email.trim();
  if (!(address.includes('@') && address.includes('.'))) return false;

  if (mode === 'microsoft-graph') {
    const tenant = (graph?.tenantId ?? '').trim();
    const clientId = (graph?.clientId ?? '').trim();
    const hasSecret = Boolean((graph?.clientSecretDraft ?? '').trim() || graph?.clientSecretSet);
    return Boolean(tenant && clientId && hasSecret);
  }

  const hasPassword = passwordDraft.trim().length > 0 || passwordSet;
  if (!hasPassword) return false;
  if (!smtpHost.trim()) return false;
  return true;
}
