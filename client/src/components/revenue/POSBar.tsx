import { COMING_SOON_POS_ITEMS, posItems } from '../../data/revenueManagement';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  selectedItem: string | null;
  onSelectItem: (item: string | null) => void;
};

/** Fixed footprint so every POS module chip is the same size. */
const POS_CHIP_CLASS =
  'inline-flex h-9 w-[10.75rem] shrink-0 items-center justify-center px-2 rounded-full border text-xs font-semibold text-center leading-tight transition-colors disabled:opacity-45 disabled:cursor-not-allowed';

export function POSBar({ selectedItem, onSelectItem }: Props) {
  const { posItem, t } = useAppTranslation();

  return (
    <div data-module-bar className="bg-card border-b border-border px-4 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        {posItems.map(item => {
          const isActive = selectedItem === item;
          const comingSoon = COMING_SOON_POS_ITEMS.has(item);
          return (
            <button
              key={item}
              type="button"
              disabled={comingSoon}
              title={comingSoon ? t('common.comingSoon') : undefined}
              onClick={() => {
                if (comingSoon) return;
                onSelectItem(isActive ? null : item);
              }}
              className={`${POS_CHIP_CLASS} ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-foreground hover:border-primary/50 hover:text-primary'
              }`}
            >
              <span className="truncate">
                {posItem(item)}
                {comingSoon ? (
                  <span className="ml-1 text-[10px] font-normal opacity-80 capitalize">
                    {t('common.comingSoon')}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
