import { useEffect, useState } from 'react';
import { Building2, Globe, MapPin, Search, UserPlus } from 'lucide-react';
import { api, type Vendor } from '../../api';

export function VendorListPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'engaged' | 'available'>('all');
  const [engaging, setEngaging] = useState<string | null>(null);

  useEffect(() => {
    api.vendors()
      .then(setVendors)
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = vendors.filter(v => {
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.city.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'engaged' ? v.engaged : !v.engaged);
    return matchSearch && matchFilter;
  });

  async function handleEngage(vendor: Vendor) {
    if (vendor.engaged) return;
    setEngaging(vendor.externalId);
    try {
      const updated = await api.engageVendor(vendor.externalId);
      setVendors(prev => prev.map(v => v.externalId === vendor.externalId ? updated : v));
    } catch { /* ignore */ }
    finally { setEngaging(null); }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Vendors</p>
        <h2 className="text-lg font-semibold">Vendor List</h2>
        <p className="text-xs text-muted-foreground mt-1">Browse and engage vendor partners for procurement</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {(['all', 'engaged', 'available'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'engaged' ? 'Engaged' : 'Available'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-8">Loading vendors…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => (
            <div key={v.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    {v.type === 'online' ? <Globe size={16} className="text-primary" /> : <Building2 size={16} className="text-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{v.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{v.externalId}</p>
                  </div>
                </div>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${v.engaged ? 'bg-[#5A7A2A]/15 text-[#5A7A2A]' : 'bg-muted text-muted-foreground'}`}>
                  {v.engaged ? 'Engaged' : 'Available'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin size={11} /> {v.city}
                </div>
                <p>Products: <span className="text-foreground font-medium">{v.products}</span></p>
                <p>Type: <span className="text-foreground capitalize">{v.type}</span></p>
              </div>

              {!v.engaged && (
                <button
                  onClick={() => handleEngage(v)}
                  disabled={engaging === v.externalId}
                  className="mt-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <UserPlus size={12} />
                  {engaging === v.externalId ? 'Engaging…' : 'Engage Vendor'}
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-xs text-muted-foreground py-8">No vendors match your filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
