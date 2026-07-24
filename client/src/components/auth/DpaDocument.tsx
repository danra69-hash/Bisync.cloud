import { LegalDocument } from './LegalDocument';
import { LEGAL_EFFECTIVE_DATE } from '../../data/legalShared';
import {
  CURRENT_DPA_VERSION,
  DPA_INTRO,
  DPA_SECTIONS,
  DPA_TITLE,
} from '../../data/dpa';

export function DpaDocument({ className = '' }: { className?: string }) {
  return (
    <LegalDocument
      title={DPA_TITLE}
      version={CURRENT_DPA_VERSION}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      intro={DPA_INTRO}
      sections={DPA_SECTIONS}
      className={className}
    />
  );
}
