import { OverviewDashboard, type OverviewDashboardProps } from '../overview/OverviewDashboard';
import { PlatformTeamChatPanel } from '../chat/PlatformTeamChatPanel';

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
  return (
    <div className="w-full min-w-0 flex flex-col lg:flex-row gap-3 items-stretch">
      <div className="w-full lg:w-[min(20rem,28%)] shrink-0">
        <PlatformTeamChatPanel />
      </div>
      <div className="flex-1 min-w-0">
        <OverviewDashboard {...dashboardProps} />
      </div>
    </div>
  );
}
