/** Auto-detect outbound mail provider from an email address (mirrors server rules). */

export type OutboundProviderInfo = {
  id: string;
  label: string;
  tip: string;
};

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

export function detectOutboundProvider(email: string): OutboundProviderInfo | null {
  const domain = domainOf(email);
  if (!domain) return null;

  if (GOOGLE.has(domain) || domain.endsWith('.google.com')) {
    return {
      id: 'google',
      label: 'Google / Gmail',
      tip: 'Google accounts with 2-Step Verification need an App Password (not your normal login password).',
    };
  }
  if (MICROSOFT.has(domain)) {
    return {
      id: 'microsoft',
      label: 'Microsoft 365 / Outlook',
      tip: 'Use your Microsoft 365 or Outlook email and password. If MFA is on, use an app password.',
    };
  }
  if (YAHOO.has(domain) || domain.startsWith('yahoo.')) {
    return {
      id: 'yahoo',
      label: 'Yahoo Mail',
      tip: 'Yahoo usually requires an app password generated in account security settings.',
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
    tip: 'Company domains usually send through Microsoft 365. Google Workspace mailboxes are tried automatically if needed.',
  };
}

export function outboundEmailReady(email: string, passwordDraft: string, passwordSet: boolean): boolean {
  const address = email.trim();
  const hasPassword = passwordDraft.trim().length > 0 || passwordSet;
  return address.includes('@') && address.includes('.') && hasPassword;
}
