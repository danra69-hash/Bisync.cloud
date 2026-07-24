import { LegalModal } from './LegalModal';
import { DpaDocument } from './DpaDocument';
import { CURRENT_DPA_VERSION, DPA_TITLE } from '../../data/dpa';

type Props = { onClose: () => void };

export function DpaModal({ onClose }: Props) {
  return (
    <LegalModal title={DPA_TITLE} version={CURRENT_DPA_VERSION} onClose={onClose}>
      <DpaDocument />
    </LegalModal>
  );
}
