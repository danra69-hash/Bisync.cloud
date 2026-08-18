import { useState } from 'react';
import { MalaysiaPackPanel } from '../accounting/AccountingBooksPanels';

type Props = {
  selectedCompanyId: number | null;
};

/** Platform Config → Malaysia: localisation pack / SST status for the header company. */
export function MalaysiaPackConfigTab({ selectedCompanyId }: Props) {
  const [error, setError] = useState<string | null>(null);

  if (!selectedCompanyId) {
    return (
      <p className="text-xs text-muted-foreground">
        Select a company in the header to view the Malaysia localisation pack.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <MalaysiaPackPanel companyId={selectedCompanyId} onError={setError} />
    </div>
  );
}
