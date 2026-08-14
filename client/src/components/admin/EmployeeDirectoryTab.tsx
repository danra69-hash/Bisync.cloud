import { useEffect, useMemo, useRef } from 'react';
import { Plus, Search } from 'lucide-react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, TableColGroup, tableColWidth, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { compareSortValues, sortTableRows } from '../../utils/tableSort';
import type { AppUser, Company, LocationConfig } from '../../api';
import { inputCls, selectCls } from '../../data/countries';
import { parseUserAccess } from '../../data/userAccess';
import type { CheckinMethod, DivisionTreeNode, Employee, EmployeeLevel } from '../../modules/hr/types';
import { CountryPhoneInput } from '../shared/CountryPhoneInput';
import { OrgSelectFields } from './OrgSelectFields';
import { selectableEmployeeLevels } from './employeeTabShared';
import { ToggleSwitch } from './ToggleSwitch';

export type EmployeeLeaveStats = {
  outstandingRdo: number;
  outstandingRph: number;
  outstandingAl: number;
  unpaidLeaveTaken: number;
  medicalLeaveTaken: number;
};

type EmployeeSortColumn =
  | 'employeeId'
  | 'employee'
  | 'division'
  | 'department'
  | 'position'
  | 'level'
  | 'shift'
  | 'platformAccess'
  | 'checkinMethod'
  | 'outstandingRdo'
  | 'outstandingRph'
  | 'outstandingAl'
  | 'unpaidLeaveTaken'
  | 'medicalLeaveTaken'
  | 'active';

const EMPLOYEE_TABLE_COLUMNS: SortableColumnDef<EmployeeSortColumn>[] = [
  { key: 'employeeId', label: 'Employee ID', ...tableColWidth('7%') },
  { key: 'employee', label: 'Employee', ...tableColWidth('12%') },
  { key: 'division', label: 'Division', ...tableColWidth('7%') },
  { key: 'department', label: 'Department', ...tableColWidth('7%') },
  { key: 'position', label: 'Position', ...tableColWidth('8%') },
  { key: 'level', label: 'Employee Level', ...tableColWidth('8%') },
  { key: 'shift', label: 'Shift', align: 'center', ...tableColWidth(56) },
  { key: 'platformAccess', label: 'Platform Access', ...tableColWidth('9%') },
  { key: 'checkinMethod', label: 'Check-in Method', ...tableColWidth('7%') },
  { key: 'outstandingRdo', label: 'Outstanding RDO', align: 'center', ...tableColWidth(72) },
  { key: 'outstandingRph', label: 'Outstanding RPH', align: 'center', ...tableColWidth(72) },
  { key: 'outstandingAl', label: 'Outstanding AL', align: 'center', ...tableColWidth(72) },
  { key: 'unpaidLeaveTaken', label: 'Unpaid Leave taken', align: 'center', ...tableColWidth(80) },
  { key: 'medicalLeaveTaken', label: 'Medical Leave taken', align: 'center', ...tableColWidth(80) },
  { key: 'active', label: 'Active', align: 'center', ...tableColWidth(64) },
];

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
  companies: Company[];
  locations: LocationConfig[];
  companyFilter: number | '';
  locationFilter: number | '';
  searchQuery: string;
  onCompanyFilterChange: (value: number | '') => void;
  onLocationFilterChange: (value: number | '') => void;
  onSearchQueryChange: (value: string) => void;
  employeeLevels: EmployeeLevel[];
  orgTree: DivisionTreeNode[];
  formData: EmployeeFormData;
  showEmployeeForm: boolean;
  error: string | null;
  successMessage?: string | null;
  leaveStatsFor: (employeeId: number) => EmployeeLeaveStats;
  platformUserFor: (employee: Employee) => AppUser | undefined;
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
  onClearSuccess?: () => void;
};

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function accessBadges(accessJson: string): string[] {
  return parseUserAccess(accessJson).modules;
}

function formatLeaveDays(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function EmployeeDirectoryTab({
  employees,
  companies,
  locations,
  companyFilter,
  locationFilter,
  searchQuery,
  onCompanyFilterChange,
  onLocationFilterChange,
  onSearchQueryChange,
  employeeLevels,
  orgTree,
  formData,
  showEmployeeForm,
  error,
  successMessage = null,
  leaveStatsFor,
  platformUserFor,
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
  onClearSuccess,
}: Props) {
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<EmployeeSortColumn>();

  useEffect(() => { resetSort(); }, [employees, companyFilter, locationFilter, searchQuery, resetSort]);

  const locationOptions = useMemo(() => {
    const active = locations.filter(l => l.active !== false && l.companyActive !== false);
    if (companyFilter === '') return active.sort((a, b) => a.name.localeCompare(b.name));
    return active
      .filter(l => l.companyId === companyFilter)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, companyFilter]);

  useEffect(() => {
    if (locationFilter === '') return;
    if (!locationOptions.some(l => l.id === locationFilter)) {
      onLocationFilterChange('');
    }
  }, [locationOptions, locationFilter, onLocationFilterChange]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter(employee => {
      const user = platformUserFor(employee);
      if (companyFilter !== '') {
        if (user?.companyId !== companyFilter) return false;
      }
      if (locationFilter !== '') {
        const ids = user?.locationIds ?? [];
        if (!ids.includes(locationFilter)) return false;
      }
      if (!q) return true;
      const haystack = [
        employee.employeeCode,
        employee.name,
        employee.email,
        employee.position,
        employee.mobile,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [employees, companyFilter, locationFilter, searchQuery, platformUserFor]);

  const noCompanySelected = companyFilter === '';

  const sortedEmployees = useMemo(
    () =>
      sortTableRows(
        filteredEmployees,
        sortColumn,
        sortDirection,
        {
          employeeId: e => e.employeeCode,
          employee: e => e.name,
          division: e => employeeDivisionName(e),
          department: e => departmentName(e),
          position: e => e.position,
          level: e => levelName(e.employeeLevelId) || '',
          shift: e => employeeIsShift(e),
          platformAccess: e => {
            const user = platformUserFor(e);
            if (!user) return '';
            return accessBadges(user.accessJson).join(', ');
          },
          checkinMethod: e => checkinMethodLabel(e.checkinMethod ?? 'Biometrics'),
          outstandingRdo: e => leaveStatsFor(e.id).outstandingRdo,
          outstandingRph: e => leaveStatsFor(e.id).outstandingRph,
          outstandingAl: e => leaveStatsFor(e.id).outstandingAl,
          unpaidLeaveTaken: e => leaveStatsFor(e.id).unpaidLeaveTaken,
          medicalLeaveTaken: e => leaveStatsFor(e.id).medicalLeaveTaken,
          active: e => e.active !== false,
        },
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [
      filteredEmployees,
      sortColumn,
      sortDirection,
      employeeDivisionName,
      departmentName,
      levelName,
      employeeIsShift,
      platformUserFor,
      checkinMethodLabel,
      leaveStatsFor,
    ],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedEmployees,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedEmployees, { scrollRootRef });

  const setField = <K extends keyof EmployeeFormData>(key: K, value: EmployeeFormData[K]) => {
    onFormChange({ ...formData, [key]: value });
  };

  const colSpan = EMPLOYEE_TABLE_COLUMNS.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Company</label>
          <select
            value={companyFilter === '' ? '' : String(companyFilter)}
            onChange={e => {
              const v = e.target.value;
              onCompanyFilterChange(v ? Number(v) : '');
              onLocationFilterChange('');
            }}
            className={`${selectCls} mt-1`}
          >
            <option value="">All companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px]">
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Location</label>
          <select
            value={locationFilter === '' ? '' : String(locationFilter)}
            onChange={e => {
              const v = e.target.value;
              onLocationFilterChange(v ? Number(v) : '');
            }}
            className={`${selectCls} mt-1`}
          >
            <option value="">All locations</option>
            {locationOptions.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Search employee</label>
          <div className="relative mt-1">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => onSearchQueryChange(e.target.value)}
              placeholder="Name, ID, email…"
              className={`${inputCls} pl-8`}
              aria-label="Search employee"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAdd}
          disabled={noCompanySelected}
          className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
          title={noCompanySelected ? 'Select a company to add an employee' : undefined}
        >
          <Plus size={12} /> Add Employee
        </button>
      </div>

      {successMessage ? (
        <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded-lg text-xs flex justify-between items-center">
          <span>{successMessage}</span>
          <button type="button" onClick={() => onClearSuccess?.()} className="hover:opacity-70">×</button>
        </div>
      ) : null}

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

      <TableScrollContainer
        ref={scrollRootRef}
        className="bg-card border border-border rounded-lg max-h-[calc(100vh-12rem)] overflow-y-auto"
        tableId="admin.employee-directory"
      >
        <table className="w-full text-xs">
          <TableColGroup columns={EMPLOYEE_TABLE_COLUMNS} />
          <thead>
            <SortableTableHeaderRow
              columns={EMPLOYEE_TABLE_COLUMNS}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
              className="border-b border-border bg-muted/30"
            />
          </thead>
          <tbody>
            {pagedEmployees.map(employee => {
              const user = platformUserFor(employee);
              const modules = user ? accessBadges(user.accessJson) : [];
              const leave = leaveStatsFor(employee.id);
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
                  <td className="px-4 py-3 text-center tabular-nums">{formatLeaveDays(leave.outstandingRdo)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{formatLeaveDays(leave.outstandingRph)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{formatLeaveDays(leave.outstandingAl)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{formatLeaveDays(leave.unpaidLeaveTaken)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{formatLeaveDays(leave.medicalLeaveTaken)}</td>
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
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">
                  {employees.length === 0
                    ? 'No employees yet. Add an employee to get started.'
                    : 'No employees match the current filters.'}
                </td>
              </tr>
            )}
            <InfiniteScrollTableSentinel colSpan={colSpan} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  );
}
