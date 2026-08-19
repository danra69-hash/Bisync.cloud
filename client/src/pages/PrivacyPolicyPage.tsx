import { LegalPageShell } from '../components/auth/LegalPageShell';
import { PrivacyPolicyDocument } from '../components/auth/PrivacyPolicyDocument';
import { LEGAL_EFFECTIVE_DATE } from '../data/legalShared';
import { CURRENT_PRIVACY_POLICY_VERSION, PRIVACY_POLICY_TITLE } from '../data/privacyPolicy';

export function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title={PRIVACY_POLICY_TITLE}
      version={CURRENT_PRIVACY_POLICY_VERSION}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      doc="privacy"
    >
      <PrivacyPolicyDocument hideChrome />
    </LegalPageShell>
  );
}
