import { OverviewDashboard, type OverviewDashboardProps } from '../overview/OverviewDashboard';
import { PlatformTeamChatPanel } from '../chat/PlatformTeamChatPanel';
import { PlatformTeamChatReopenFab } from '../chat/PlatformTeamChatReopenFab';
import { usePlatformTeamChatHidden } from '../chat/platformTeamChatVisibility';

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
  const { hidden: chatHidden } = usePlatformTeamChatHidden();

  return (
    <div
      className={`w-full min-w-0 flex flex-col gap-3 items-stretch ${
        chatHidden ? '' : 'lg:flex-row'
      }`}
    >
      {!chatHidden ? (
        <div className="w-full lg:w-[min(20rem,28%)] shrink-0">
          <PlatformTeamChatPanel collapsible />
        </div>
      ) : null}
      <div className="flex-1 min-w-0 space-y-3">
        {chatHidden ? <PlatformTeamChatReopenFab /> : null}
        <OverviewDashboard {...dashboardProps} />
      </div>
    </div>
  );
}
