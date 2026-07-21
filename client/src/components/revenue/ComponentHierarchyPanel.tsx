import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inputCls, selectCls } from '../../data/componentForm';
import {
  categoryDeleteBlocked,
  categoryName,
  emptyHierarchyAttachmentCounts,
  groupDeleteBlocked,
  groupLabel,
  subGroupDeleteBlocked,
  type ComponentHierarchyState,
  type HierarchyAttachmentCounts,
} from '../../data/componentHierarchy';

type Props = {
  state: ComponentHierarchyState;
  onChange: (next: ComponentHierarchyState) => void;
  /** Live component attachment counts (from ingredients). */
  attachmentCounts?: HierarchyAttachmentCounts;
};

export function ComponentHierarchyPanel({
  state,
  onChange,
  attachmentCounts = emptyHierarchyAttachmentCounts(),
}: Props) {
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [groupCategoryId, setGroupCategoryId] = useState<number | ''>('');
  const [groupNameInput, setGroupNameInput] = useState('');
  const [subGroupGroupId, setSubGroupGroupId] = useState<number | ''>('');
  const [subGroupNameInput, setSubGroupNameInput] = useState('');

  const hierarchyRows = useMemo(
    () => state.subGroups
      .map(subGroup => {
        const group = state.groups.find(item => item.id === subGroup.groupId);
        const category = group ? state.categories.find(item => item.id === group.categoryId) : undefined;
        if (!group || !category) return null;
        const gate = subGroupDeleteBlocked(state, subGroup.id, attachmentCounts);
        return {
          key: `sub-${subGroup.id}`,
          category: category.name,
          group: group.name,
          subGroup: subGroup.name,
          items: gate.componentCount,
          deleteBlocked: gate.blocked,
          deleteTitle: gate.reason,
          onDelete: () => {
            if (gate.blocked) return;
            onChange({
              ...state,
              subGroups: state.subGroups.filter(item => item.id !== subGroup.id),
            });
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .concat(
        state.groups
          .filter(group => !state.subGroups.some(item => item.groupId === group.id))
          .map(group => {
            const gate = groupDeleteBlocked(state, group.id, attachmentCounts);
            return {
              key: `group-${group.id}`,
              category: categoryName(state, group.categoryId),
              group: group.name,
              subGroup: '—',
              items: gate.componentCount,
              deleteBlocked: gate.blocked,
              deleteTitle: gate.reason,
              onDelete: () => {
                if (gate.blocked) return;
                onChange({
                  ...state,
                  groups: state.groups.filter(item => item.id !== group.id),
                  subGroups: state.subGroups.filter(item => item.groupId !== group.id),
                });
              },
            };
          }),
      )
      .sort((a, b) =>
        a.category.localeCompare(b.category)
        || a.group.localeCompare(b.group)
        || a.subGroup.localeCompare(b.subGroup),
      ),
    [state, onChange, attachmentCounts],
  );

  function addCategory() {
    const name = categoryNameInput.trim();
    if (!name) return;
    if (state.categories.some(item => item.name.toLowerCase() === name.toLowerCase())) return;
    const id = state.nextCategoryId;
    onChange({
      ...state,
      categories: [...state.categories, { id, name }],
      nextCategoryId: id + 1,
    });
    setCategoryNameInput('');
  }

  function addGroup() {
    const name = groupNameInput.trim();
    if (!name || groupCategoryId === '') return;
    if (state.groups.some(item => item.categoryId === groupCategoryId && item.name.toLowerCase() === name.toLowerCase())) {
      return;
    }
    const id = state.nextGroupId;
    onChange({
      ...state,
      groups: [...state.groups, { id, categoryId: groupCategoryId, name, items: 0 }],
      nextGroupId: id + 1,
    });
    setGroupNameInput('');
  }

  function addSubGroup() {
    const name = subGroupNameInput.trim();
    if (!name || subGroupGroupId === '') return;
    if (state.subGroups.some(item => item.groupId === subGroupGroupId && item.name.toLowerCase() === name.toLowerCase())) {
      return;
    }
    const id = state.nextSubGroupId;
    onChange({
      ...state,
      subGroups: [...state.subGroups, { id, groupId: subGroupGroupId, name, items: 0 }],
      nextSubGroupId: id + 1,
    });
    setSubGroupNameInput('');
  }

  function deleteCategory(categoryId: number) {
    const gate = categoryDeleteBlocked(state, categoryId, attachmentCounts);
    if (gate.blocked) return;
    const groupIds = state.groups.filter(item => item.categoryId === categoryId).map(item => item.id);
    onChange({
      ...state,
      categories: state.categories.filter(item => item.id !== categoryId),
      groups: state.groups.filter(item => item.categoryId !== categoryId),
      subGroups: state.subGroups.filter(item => !groupIds.includes(item.groupId)),
    });
    if (groupCategoryId === categoryId) setGroupCategoryId('');
    if (typeof subGroupGroupId === 'number' && groupIds.includes(subGroupGroupId)) setSubGroupGroupId('');
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold">Category</p>
            <p className="text-xs text-muted-foreground mt-0.5">Top level of the component hierarchy</p>
          </div>
          <input
            className={inputCls}
            value={categoryNameInput}
            onChange={e => setCategoryNameInput(e.target.value)}
            placeholder="e.g. Food"
            onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={!categoryNameInput.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Plus size={11} /> Add Category
          </button>
          <div className="space-y-1.5 pt-1">
            {state.categories.map(category => {
              const gate = categoryDeleteBlocked(state, category.id, attachmentCounts);
              return (
                <div key={category.id} className="flex items-center justify-between gap-2 text-xs border border-border rounded-md px-2.5 py-1.5">
                  <span className="font-medium">{category.name}</span>
                  <button
                    type="button"
                    onClick={() => deleteCategory(category.id)}
                    disabled={gate.blocked}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
                    title={gate.reason}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold">Group</p>
            <p className="text-xs text-muted-foreground mt-0.5">Belongs to a category</p>
          </div>
          <select
            className={selectCls}
            value={groupCategoryId}
            onChange={e => setGroupCategoryId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— Select category —</option>
            {state.categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <input
            className={inputCls}
            value={groupNameInput}
            onChange={e => setGroupNameInput(e.target.value)}
            placeholder="e.g. Proteins"
            onKeyDown={e => { if (e.key === 'Enter') addGroup(); }}
          />
          <button
            type="button"
            onClick={addGroup}
            disabled={!groupNameInput.trim() || groupCategoryId === ''}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Plus size={11} /> Add Group
          </button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold">Sub-Group</p>
            <p className="text-xs text-muted-foreground mt-0.5">Belongs to a group</p>
          </div>
          <select
            className={selectCls}
            value={subGroupGroupId}
            onChange={e => setSubGroupGroupId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— Select group —</option>
            {state.groups.map(group => (
              <option key={group.id} value={group.id}>{groupLabel(state, group.id)}</option>
            ))}
          </select>
          <input
            className={inputCls}
            value={subGroupNameInput}
            onChange={e => setSubGroupNameInput(e.target.value)}
            placeholder="e.g. Beef"
            onKeyDown={e => { if (e.key === 'Enter') addSubGroup(); }}
          />
          <button
            type="button"
            onClick={addSubGroup}
            disabled={!subGroupNameInput.trim() || subGroupGroupId === ''}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Plus size={11} /> Add Sub-Group
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <p className="text-xs font-semibold">Hierarchy</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Category → Group → Sub-Group. Delete is available only when nothing is attached.
          </p>
        </div>
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {['Category', 'Group', 'Sub-Group', 'Components', ''].map(label => (
                <th key={label || 'actions'} className="px-3 py-2 text-left text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hierarchyRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No hierarchy rows yet. Create a category, group, and sub-group above.
                </td>
              </tr>
            ) : (
              hierarchyRows.map(row => (
                <tr key={row.key} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2.5 text-muted-foreground">{row.category}</td>
                  <td className="px-3 py-2.5">{row.group}</td>
                  <td className="px-3 py-2.5">{row.subGroup}</td>
                  <td className="px-3 py-2.5 font-sans">{row.items}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={row.onDelete}
                      disabled={row.deleteBlocked}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
                      title={row.deleteTitle}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
