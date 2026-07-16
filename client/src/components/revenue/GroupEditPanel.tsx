import { useState } from 'react';
import { X } from 'lucide-react';
import { getSiCategoryFilterOptions } from '../../data/revenueManagement';
import { inputCls, selectCls } from '../../data/componentForm';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_OVERFLOW_CLS } from '../layout/sidePanelShared';

export type GroupRow = {
  id: number;
  name: string;
  category: string;
  group?: string;
  subGroup?: string;
  items: number;
};

type Props = {
  group: GroupRow;
  isNew?: boolean;
  onClose: () => void;
  onSave: (updated: GroupRow) => void;
};

export function GroupEditPanel({ group, isNew = false, onClose, onSave }: Props) {
  const [name, setName] = useState(group.name);
  const [category, setCategory] = useState(group.category);

  function save() {
    if (!name.trim() || !category) return;
    onSave({ ...group, name: name.trim(), category });
    onClose();
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} />

      <div className={SIDE_PANEL_SHELL_OVERFLOW_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">Component Config</p>
            <h3 className="text-sm font-semibold text-foreground">
              {isNew ? 'New Group' : group.name}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors mt-0.5">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Category</label>
            <select className={selectCls} value={category} onChange={e => setCategory(e.target.value)}>
              {getSiCategoryFilterOptions().filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Group name</label>
            <input
              className={inputCls}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Proteins"
            />
          </div>

          {!isNew && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Components</label>
              <p className="text-sm font-sans text-foreground">{group.items}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!name.trim() || !category}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isNew ? 'Add Group' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
