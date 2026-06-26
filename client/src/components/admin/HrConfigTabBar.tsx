type Tab = { id: string; label: string };

type Props<T extends string> = {
  tabs: readonly Tab[];
  active: T;
  onChange: (id: T) => void;
};

export function HrConfigTabBar<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div className="flex gap-0 border-b border-border overflow-x-auto">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id as T)}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
            active === t.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
