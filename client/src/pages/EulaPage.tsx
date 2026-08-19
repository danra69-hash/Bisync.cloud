import { LegalPageShell } from '../components/auth/LegalPageShell';
import { EulaDocument } from '../components/auth/EulaDocument';
import { CURRENT_EULA_VERSION, EULA_EFFECTIVE_DATE, EULA_TITLE } from '../data/eula';

/**
 * Public EULA page for registration and footer links.
 * Routed at /eula and /legal/eula without requiring login.
 */
export function EulaPage() {
  return (
    <LegalPageShell
      title={EULA_TITLE}
      version={CURRENT_EULA_VERSION}
      effectiveDate={EULA_EFFECTIVE_DATE}
      doc="eula"
    >
      <EulaDocument hideChrome />
    </LegalPageShell>
  );
}
