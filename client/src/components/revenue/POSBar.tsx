import { COMING_SOON_POS_ITEMS, posItems } from '../../data/revenueManagement';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  selectedItem: string | null;
  onSelectItem: (item: string | null) => void;
};

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
              className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-foreground hover:border-primary/50 hover:text-primary'
              }`}
            >
              {posItem(item)}
              {comingSoon ? (
                <span className="ml-1.5 text-[10px] font-normal opacity-80 capitalize">{t('common.comingSoon')}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
