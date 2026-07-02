import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import type { AppUser } from '../../api';
import { inputCls, selectCls } from '../../data/countries';
import { parseUserAccess } from '../../data/userAccess';
import type { CheckinMethod, DivisionTreeNode, Employee, EmployeeLevel } from '../../modules/hr/types';
import { CountryPhoneInput } from '../shared/CountryPhoneInput';
import { OrgSelectFields } from './OrgSelectFields';
import { selectableEmployeeLevels } from './employeeTabShared';
import { ToggleSwitch } from './ToggleSwitch';

const thCls = 'text-left px-4 py-2.5 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal';

type EmployeeFormData = {
  name: string;
  email: string;
  mobile: string;
  position: string;
  joinDate: string;
  divisionId: number | null;
  departmentId: number | null;
  employeeLevelId: number | null;
  reportsToId: number | null;
};

type Props = {
  employees: Employee[];
  employeeLevels: EmployeeLevel[];
  orgTree: DivisionTreeNode[];
  formData: EmployeeFormData;
  showEmployeeForm: boolean;
  error: string | null;
  noCompanySelected?: boolean;
  platformUserFor: (employee: Employee) => AppUser | undefined;
  employeeCompanyName: (employee: Employee) => string;
  employeeLocationLabel: (employee: Employee) => string;
  employeeDivisionName: (employee: Employee) => string;
  departmentName: (employee: Employee) => string;
  countryCode: string;
  levelName: (id?: number | null) => string | undefined;
  employeeIsShift: (employee: Employee) => boolean;
  checkinMethodLabel: (method: CheckinMethod) => string;
  onOpenAdd: () => void;
  onCloseForm: () => void;
  onFormChange: (data: EmployeeFormData) => void;
  onSubmit: () => void;
  onSubmitWithGrantAccess: () => void;
  onOpenDetail: (id: number) => void;
  onToggleActive: (employee: Employee, active: boolean) => void;
  onClearError: () => void;
};

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function accessBadges(accessJson: string): string[] {
  return parseUserAccess(accessJson).modules;
}

export function EmployeeDirectoryTab({
  employees,
  employeeLevels,
  orgTree,
  formData,
  showEmployeeForm,
  error,
  noCompanySelected = false,
  platformUserFor,
  employeeCompanyName,
  employeeLocationLabel,
  employeeDivisionName,
  departmentName,
  countryCode,
  levelName,
  employeeIsShift,
  checkinMethodLabel,
  onOpenAdd,
  onCloseForm,
  onFormChange,
  onSubmit,
  onSubmitWithGrantAccess,
  onOpenDetail,
  onToggleActive,
  onClearError,
}: Props) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedEmployees,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(employees, { scrollRootRef });

  const setField = <K extends keyof EmployeeFormData>(key: K, value: EmployeeFormData[K]) => {
    onFormChange({ ...formData, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onOpenAdd}
          disabled={noCompanySelected}
          className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={12} /> Add Employee
        </button>
      </div>

      {!noCompanySelected && showEmployeeForm && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">New Employee</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Employee ID is assigned automatically. Configure check-in method and other details after creation.
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex justify-between">
              <span>{error}</span>
              <button type="button" onClick={onClearError} className="hover:opacity-70">×</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {([
              ['Full Name', 'name', 'text', 'John Doe'],
              ['Email', 'email', 'email', 'john.doe@company.com'],
              ['Position', 'position', 'text', 'Software Engineer'],
              ['Join Date', 'joinDate', 'date', ''],
            ] as const).map(([label, key, type, placeholder]) => (
              <div key={key}>
                <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{label}</label>
                <input
                  type={type}
                  required
                  value={formData[key]}
                  onChange={e => setField(key, e.target.value)}
                  className={`${inputCls} mt-1`}
                  placeholder={placeholder}
                />
              </div>
            ))}

            <CountryPhoneInput
              countryCode={countryCode}
              value={formData.mobile}
              onChange={value => setField('mobile', value)}
              label="Mobile Number"
              required
            />

            <OrgSelectFields
              orgTree={orgTree}
              divisionId={formData.divisionId}
              departmentId={formData.departmentId}
              required
              onChange={patch => onFormChange({ ...formData, ...patch })}
            />

            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Employee Level</label>
              <select
                value={formData.employeeLevelId ?? ''}
                onChange={e => setField('employeeLevelId', e.target.value ? Number(e.target.value) : null)}
                className={`${selectCls} mt-1`}
              >
                <option value="">— Select level —</option>
                {selectableEmployeeLevels(employeeLevels, formData.employeeLevelId).map(level => (
                  <option key={level.id} value={level.id}>{level.levelName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Reports To</label>
              <select
                value={formData.reportsToId ?? ''}
                onChange={e => setField('reportsToId', e.target.value ? Number(e.target.value) : null)}
                className={`${selectCls} mt-1`}
              >
                <option value="">— Select manager —</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} — {e.position}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onCloseForm}
              className="text-xs font-sans border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmitWithGrantAccess}
              className="flex items-center gap-1.5 text-xs font-sans border border-border rounded-md px-4 py-2 hover:bg-muted"
            >
              <Plus size={12} /> Grant Access
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2"
            >
              Add Employee
            </button>
          </div>
        </div>
      )}

      {!noCompanySelected && (
      <TableScrollContainer ref={scrollRootRef} className="bg-card border border-border rounded-lg max-h-[calc(100vh-12rem)] overflow-y-auto">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Employee ID', 'Employee', 'Company', 'Location', 'Division', 'Department', 'Position', 'Employee Level', 'Shift', 'Platform Access', 'Check-in Method', 'Active'].map(h => (
                <th key={h} className={`${thCls} ${h === 'Shift' || h === 'Active' ? 'text-center' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedEmployees.map(employee => {
              const user = platformUserFor(employee);
              const modules = user ? accessBadges(user.accessJson) : [];
              return (
                <tr
                  key={employee.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/20 ${employee.active === false ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3 font-sans text-muted-foreground">{employee.employeeCode}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(employee.name)}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(employee.id)}
                          className="font-medium text-primary hover:underline text-left"
                        >
                          {employee.name}
                        </button>
                        <div className="text-muted-foreground truncate">{employee.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{employeeCompanyName(employee)}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={employeeLocationLabel(employee)}>
                    {employeeLocationLabel(employee)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{employeeDivisionName(employee)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{departmentName(employee)}</td>
                  <td className="px-4 py-3">{employee.position}</td>
                  <td className="px-4 py-3">
                    {levelName(employee.employeeLevelId) ? (
                      <span className="text-xs font-sans px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {levelName(employee.employeeLevelId)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={employeeIsShift(employee)}
                      disabled
                      className="rounded border-border opacity-70"
                      title="Set via HR Config → Level & Entitlement"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {!user ? (
                      <span className="text-muted-foreground">Not granted</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {modules.length > 0 ? modules.map(m => (
                          <span key={m} className="text-xs font-sans px-1.5 py-0.5 rounded bg-primary/10 text-primary">{m}</span>
                        )) : (
                          <span className="text-muted-foreground">No modules</span>
                        )}
                        {!user.active && (
                          <span className="text-xs font-sans px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-sans px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {checkinMethodLabel(employee.checkinMethod ?? 'Biometrics')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ToggleSwitch
                      checked={employee.active !== false}
                      onChange={v => onToggleActive(employee, v)}
                      label={employee.active === false ? 'Activate employee' : 'Deactivate employee'}
                    />
                  </td>
                </tr>
              );
            })}
            {employees.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                  No employees yet. Add an employee to get started.
                </td>
              </tr>
            )}
            <InfiniteScrollTableSentinel colSpan={12} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
          </tbody>
        </table>
      </TableScrollContainer>
      )}
    </div>
  );
}
