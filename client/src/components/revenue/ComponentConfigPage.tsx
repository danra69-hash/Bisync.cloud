import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

type GroupRow = { id: number; name: string; category: string; items: number };
type StorageRow = { id: number; name: string; type: string; capacity: string; location: string };

const initialGroups: GroupRow[] = [
  { id: 1, name: 'Proteins', category: 'Food', items: 12 },
  { id: 2, name: 'Dairy', category: 'Food', items: 8 },
  { id: 3, name: 'Produce', category: 'Food', items: 15 },
  { id: 4, name: 'Spirits', category: 'Beverage', items: 24 },
  { id: 5, name: 'Dry Goods', category: 'Food', items: 18 },
];

const initialStorage: StorageRow[] = [
  { id: 1, name: 'Walk-in Freezer', type: 'Freezer', capacity: '120 m³', location: 'Downtown' },
  { id: 2, name: 'Main Chiller', type: 'Chiller', capacity: '80 m³', location: 'Downtown' },
  { id: 3, name: 'Wine Cellar', type: 'Wine Cellar', capacity: '45 m³', location: 'Downtown' },
  { id: 4, name: 'Dry Store', type: 'Dry Store', capacity: '60 m³', location: 'All Locations' },
  { id: 5, name: 'Bar Cooler', type: 'Chiller', capacity: '12 m³', location: 'Midtown' },
];

export function ComponentConfigPage() {
  const [tab, setTab] = useState<'group' | 'storage'>('group');
  const [groups, setGroups] = useState(initialGroups);
  const [storage, setStorage] = useState(initialStorage);

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Component</p>
        <h2 className="text-lg font-semibold">Component Config</h2>
        <p className="text-xs text-muted-foreground mt-1">Configure component groups and storage assignments</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['group', 'storage'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'group' ? 'Group Assignment' : 'Storage Assignment'}
          </button>
        ))}
      </div>

      {tab === 'group' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground">
              <Plus size={11} /> Add Group
            </button>
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Group Name', 'Category', 'Components', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{g.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{g.category}</td>
                    <td className="px-4 py-3 font-mono">{g.items}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setGroups(prev => prev.filter(x => x.id !== g.id))} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground">
              <Plus size={11} /> Add Storage
            </button>
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Storage Name', 'Type', 'Capacity', 'Location', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storage.map(s => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">{s.type}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{s.capacity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.location}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setStorage(prev => prev.filter(x => x.id !== s.id))} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
