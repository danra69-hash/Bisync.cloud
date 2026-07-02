import { Plus } from 'lucide-react';
import type { AppUser } from '../../api';
import { parseUserAccess } from '../../data/userAccess';

function accessBadges(accessJson: string): string[] {
  return parseUserAccess(accessJson).modules;
}

type Props = {
  user: AppUser | null | undefined;
  onManageAccess: () => void;
};

export function PlatformAccessSummary({ user, onManageAccess }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {user
            ? 'Platform access configured · assign company, locations, and modules'
            : 'No platform access granted yet · grant access to assign company, locations, and modules'}
        </p>
        <button
          type="button"
          onClick={onManageAccess}
          className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-md"
        >
          {!user && <Plus size={12} />}
          {user ? 'Edit Access' : 'Grant Access'}
        </button>
      </div>

      {user && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Company', 'Locations', 'Email', 'Role', 'Access', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-muted/20">
                <td className="px-4 py-3 text-muted-foreground">{user.companyName || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.locationNames?.length
                    ? user.locationNames.length <= 2
                      ? user.locationNames.join(', ')
                      : `${user.locationNames.slice(0, 2).join(', ')} +${user.locationNames.length - 2}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3">{user.role || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {accessBadges(user.accessJson).length > 0 ? (
                      accessBadges(user.accessJson).map(m => (
                        <span key={m} className="text-xs font-sans px-1.5 py-0.5 rounded bg-primary/10 text-primary">{m}</span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-sans px-1.5 py-0.5 rounded ${user.active ? 'bg-[#5A7A2A]/15 text-[#5A7A2A]' : 'bg-muted text-muted-foreground'}`}>
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
