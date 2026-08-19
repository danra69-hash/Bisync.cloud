import { LegalDocument } from './LegalDocument';
import { LEGAL_EFFECTIVE_DATE } from '../../data/legalShared';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
} from '../../data/privacyPolicy';

export function PrivacyPolicyDocument({
  className = '',
  hideChrome = false,
}: {
  className?: string;
  hideChrome?: boolean;
}) {
  return (
    <LegalDocument
      title={PRIVACY_POLICY_TITLE}
      version={CURRENT_PRIVACY_POLICY_VERSION}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      intro={PRIVACY_POLICY_INTRO}
      sections={PRIVACY_POLICY_SECTIONS}
      className={className}
      hideChrome={hideChrome}
    />
  );
}
