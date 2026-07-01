import { selectCls } from '../../data/countries';
import type { DivisionTreeNode } from '../../modules/hr/types';

type Props = {
  orgTree: DivisionTreeNode[];
  divisionId: number | null;
  departmentId: number | null;
  onChange: (patch: { divisionId: number | null; departmentId: number | null }) => void;
  required?: boolean;
};

export function OrgSelectFields({
  orgTree,
  divisionId,
  departmentId,
  onChange,
  required = false,
}: Props) {
  const departments = orgTree.find(d => d.id === divisionId)?.departments ?? [];

  return (
    <>
      <div>
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Division</label>
        <select
          required={required}
          value={divisionId ?? ''}
          onChange={e => onChange({
            divisionId: e.target.value ? Number(e.target.value) : null,
            departmentId: null,
          })}
          className={`${selectCls} mt-1`}
        >
          <option value="">— Select division —</option>
          {orgTree.map(division => (
            <option key={division.id} value={division.id}>{division.name}</option>
          ))}
        </select>
        {orgTree.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            No divisions yet. Add them under Divisions &amp; Department.
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Department</label>
        <select
          required={required}
          value={departmentId ?? ''}
          disabled={!divisionId}
          onChange={e => onChange({
            divisionId,
            departmentId: e.target.value ? Number(e.target.value) : null,
          })}
          className={`${selectCls} mt-1 disabled:opacity-50`}
        >
          <option value="">— Select department —</option>
          {departments.map(department => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>
      </div>
    </>
  );
}
