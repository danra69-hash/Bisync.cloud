import { LegalModal } from './LegalModal';
import { PrivacyPolicyDocument } from './PrivacyPolicyDocument';
import { CURRENT_PRIVACY_POLICY_VERSION, PRIVACY_POLICY_TITLE } from '../../data/privacyPolicy';

type Props = { onClose: () => void };

export function PrivacyPolicyModal({ onClose }: Props) {
  return (
    <LegalModal
      title={PRIVACY_POLICY_TITLE}
      version={CURRENT_PRIVACY_POLICY_VERSION}
      onClose={onClose}
    >
      <PrivacyPolicyDocument />
    </LegalModal>
  );
}
