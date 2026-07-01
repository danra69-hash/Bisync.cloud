import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { revMgmtNav } from '../../data/revenueManagement';

type Props = {
  selectedItem: string | null;
  onSelectItem: (id: string | null) => void;
};

export function RevMgmtBar({ selectedItem, onSelectItem }: Props) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const activeSection = selectedItem ? selectedItem.split('||')[0] : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenSection(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={barRef} className="bg-card border-b border-border px-4 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        {revMgmtNav.map(section => {
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
                {section.title}
                <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-lg shadow-xl min-w-[180px] py-2">
                  {section.subs.map((sub, si) => (
                    <div key={si}>
                      {sub.subtitle && (
                        <p className="px-3 pt-2 pb-1 text-[11px] font-sans font-bold tracking-widest text-muted-foreground uppercase">
                          {sub.subtitle}
                        </p>
                      )}
                      {sub.items.map(item => {
                        const id = `${section.title}||${sub.subtitle ?? ''}||${item.label}`;
                        const isSelected = selectedItem === id;
                        return (
                          <button
                            key={item.label}
                            onClick={() => { onSelectItem(isSelected ? null : id); setOpenSection(null); }}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                              isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
                            }`}
                          >
                            {item.label}
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
