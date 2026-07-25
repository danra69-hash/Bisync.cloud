import { OverviewDashboard, type OverviewDashboardProps } from '../overview/OverviewDashboard';

type Props = OverviewDashboardProps & {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  onOpenTransfer?: () => void;
};

/** Revenue Management dashboard — hosts the former Overview operations widgets. */
export function RevMgmtLandingPage({
  selectedCompanyId: _selectedCompanyId,
  selectedLocationIds: _selectedLocationIds,
  onOpenTransfer: _onOpenTransfer,
  ...dashboardProps
}: Props) {
  return <OverviewDashboard {...dashboardProps} />;
}
