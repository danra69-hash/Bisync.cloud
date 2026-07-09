import { posItems } from '../../data/revenueManagement';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  selectedItem: string | null;
  onSelectItem: (item: string | null) => void;
};

export function POSBar({ selectedItem, onSelectItem }: Props) {
  const { posItem } = useAppTranslation();

  return (
    <div className="bg-card border-b border-border px-4 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        {posItems.map(item => {
          const isActive = selectedItem === item;
          return (
            <button
              key={item}
              onClick={() => onSelectItem(isActive ? null : item)}
              className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-foreground hover:border-primary/50 hover:text-primary'
              }`}
            >
              {posItem(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
