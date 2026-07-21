import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  filterRevMgmtNavForSupplyCapability,
  revMgmtNav,
  COMING_SOON_REV_MGMT_LABELS,
} from '../../data/revenueManagement';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  selectedItem: string | null;
  onSelectItem: (id: string | null) => void;
  hasSupplyCapability?: boolean;
  hasB2bProductCapability?: boolean;
};

export function RevMgmtBar({
  selectedItem,
  onSelectItem,
  hasSupplyCapability = true,
  hasB2bProductCapability = true,
}: Props) {
  const { revMgmtSection, revMgmtSubtitle, revMgmtItem, t } = useAppTranslation();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const activeSection = selectedItem ? selectedItem.split('||')[0] : null;

  const nav = useMemo(
    () => filterRevMgmtNavForSupplyCapability(
      revMgmtNav,
      hasSupplyCapability,
      hasB2bProductCapability,
    ),
    [hasSupplyCapability, hasB2bProductCapability],
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenSection(null);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div ref={barRef} className="bg-card px-2 sm:px-3 py-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {nav.map(section => {
          const isOpen = openSection === section.title;
          const isActive = activeSection === section.title;
          return (
            <div key={section.title} className="relative">
              <button
                onClick={() => setOpenSection(isOpen ? null : section.title)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isOpen
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-foreground hover:border-primary/50 hover:text-primary'
                }`}
              >
                {revMgmtSection(section.title)}
                <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-lg shadow-xl min-w-[180px] py-2">
                  {section.subs.map((sub, si) => (
                    <div key={si}>
                      {sub.subtitle && (
                        <p className="px-3 pt-2 pb-1 text-[11px] font-sans font-bold tracking-widest text-muted-foreground uppercase">
                          {revMgmtSubtitle(sub.subtitle)}
                        </p>
                      )}
                      {sub.items.map(item => {
                        const id = `${section.title}||${sub.subtitle ?? ''}||${item.label}`;
                        const isSelected = selectedItem === id;
                        const comingSoon = COMING_SOON_REV_MGMT_LABELS.has(item.label);
                        return (
                          <button
                            key={item.label}
                            type="button"
                            disabled={comingSoon}
                            title={comingSoon ? t('common.comingSoon') : undefined}
                            onClick={() => {
                              if (comingSoon) return;
                              onSelectItem(isSelected ? null : id);
                              setOpenSection(null);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                              isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {revMgmtItem(item.label)}
                              {comingSoon ? (
                                <span className="text-[10px] text-muted-foreground capitalize">{t('common.comingSoon')}</span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
