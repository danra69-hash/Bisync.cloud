import { LegalPageShell } from '../components/auth/LegalPageShell';
import { DpaDocument } from '../components/auth/DpaDocument';
import { LEGAL_EFFECTIVE_DATE } from '../data/legalShared';
import { CURRENT_DPA_VERSION, DPA_TITLE } from '../data/dpa';

export function DpaPage() {
  return (
    <LegalPageShell
      title={DPA_TITLE}
      version={CURRENT_DPA_VERSION}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <DpaDocument />
    </LegalPageShell>
  );
}
