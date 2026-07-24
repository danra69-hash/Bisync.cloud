import { LegalModal } from './LegalModal';
import { EulaDocument } from './EulaDocument';
import { CURRENT_EULA_VERSION, EULA_TITLE } from '../../data/eula';

type Props = {
  onClose: () => void;
};

export function EulaModal({ onClose }: Props) {
  return (
    <LegalModal title={EULA_TITLE} version={CURRENT_EULA_VERSION} onClose={onClose}>
      <EulaDocument />
    </LegalModal>
  );
}
