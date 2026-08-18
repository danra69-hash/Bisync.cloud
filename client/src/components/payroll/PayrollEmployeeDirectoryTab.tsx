import { useEffect, useMemo, useRef } from 'react';
import type { AppUser } from '../../api';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, TableColGroup, tableColWidth, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import type { DivisionTreeNode, Employee, PayStructure } from '../../modules/hr/types';
import {
  employeeDepartmentName,
  employeeDivisionName,
  employeeLocationLabel,
} from './employeeOrgDisplay';
import {
  formatJoinDate,
  formatOtherAllowancesSummary,
  formatPayrollAmount,
  formatWorkPermitLabel,
} from './payrollDisplay';
import { sortTableRows } from '../../utils/tableSort';

type DirectorySortColumn =
  | 'location'
  | 'name'
  | 'employeeId'
  | 'joinDate'
  | 'division'
  | 'department'
  | 'position'
  | 'baseSalary'
  | 'service'
  | 'transport'
  | 'accommodation'
  | 'mobile'
  | 'otherAllowances'
  | 'workPermit';

const DIRECTORY_TABLE_COLUMNS: SortableColumnDef<DirectorySortColumn>[] = [
  { key: 'location', label: 'Location', ...tableColWidth('8%') },
  { key: 'name', label: 'Name', ...tableColWidth('12%') },
  { key: 'employeeId', label: 'Employee ID', ...tableColWidth('8%') },
  { key: 'joinDate', label: 'Date Joined', ...tableColWidth('8%') },
  { key: 'division', label: 'Division', ...tableColWidth('8%') },
  { key: 'department', label: 'Department', ...tableColWidth('8%') },
  { key: 'position', label: 'Position', ...tableColWidth('9%') },
  { key: 'baseSalary', label: 'Base Salary', align: 'right', ...tableColWidth('7%') },
  { key: 'service', label: 'Service', align: 'right', ...tableColWidth('6%') },
  { key: 'transport', label: 'Transport Allowances', align: 'right', ...tableColWidth('7%') },
  { key: 'accommodation', label: 'Accommodation', align: 'right', ...tableColWidth('7%') },
  { key: 'mobile', label: 'Mobile Allowances', align: 'right', ...tableColWidth('7%') },
  { key: 'otherAllowances', label: 'Other Allowances', align: 'right', ...tableColWidth('7%') },
  { key: 'workPermit', label: 'Work Permit', ...tableColWidth('6%') },
];

type Props = {
  employees: Employee[];
  orgTree: DivisionTreeNode[];
  platformUsers: AppUser[];
  payStructure: PayStructure | null;
  onOpenDetail: (id: number) => void;
};

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export function PayrollEmployeeDirectoryTab({
  employees,
  orgTree,
  platformUsers,
  payStructure,
  onOpenDetail,
}: Props) {
  const countryCode = payStructure?.countryCode ?? 'MY';
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<DirectorySortColumn>();

  useEffect(() => {
    resetSort();
  }, [employees, resetSort]);

  const sortedEmployees = useMemo(
    () =>
      sortTableRows(
        employees,
        sortColumn,
        sortDirection,
        {
          location: employee => employeeLocationLabel(employee, platformUsers),
          name: employee => employee.name,
          employeeId: employee => employee.employeeCode,
          joinDate: employee => employee.joinDate ?? '',
          division: employee => employeeDivisionName(employee, orgTree),
          department: employee => employeeDepartmentName(employee, orgTree),
          position: employee => employee.position,
          baseSalary: employee => employee.baseSalary,
          service: employee => employee.serviceAllowance,
          transport: employee => employee.transportAllowance,
          accommodation: employee => employee.accommodationAllowance,
          mobile: employee => employee.mobileAllowance,
          otherAllowances: employee =>
            (employee.otherAllowances ?? []).reduce((sum, item) => sum + item.amount, 0),
          workPermit: employee => formatWorkPermitLabel(employee.workPermitByCompany),
        },
      ),
    [employees, sortColumn, sortDirection, orgTree, platformUsers],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedEmployees,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedEmployees, { scrollRootRef });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {employees.length} employees in directory
        {payStructure ? ` · Pay cycle: ${payStructure.payCycle}` : ' · Pay structure not configured for this company'}
      </p>

      <TableScrollContainer ref={scrollRootRef} className="bg-card border border-border rounded-lg max-h-[calc(100vh-12rem)] overflow-y-auto">
        <table className="w-full text-xs">
          <TableColGroup columns={DIRECTORY_TABLE_COLUMNS} />
          <thead>
            <SortableTableHeaderRow
              columns={DIRECTORY_TABLE_COLUMNS}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
              className="border-b border-border bg-muted/30"
            />
          </thead>
          <tbody>
            {pagedEmployees.map(employee => (
              <tr
                key={employee.id}
                className={`border-b border-border last:border-0 hover:bg-muted/20 ${employee.active === false ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate" title={employeeLocationLabel(employee, platformUsers)}>
                  {employeeLocationLabel(employee, platformUsers)}
                </td>
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
                <td className="px-4 py-3 font-sans text-muted-foreground">{employee.employeeCode}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatJoinDate(employee.joinDate)}</td>
                <td className="px-4 py-3 text-muted-foreground">{employeeDivisionName(employee, orgTree)}</td>
                <td className="px-4 py-3 text-muted-foreground">{employeeDepartmentName(employee, orgTree)}</td>
                <td className="px-4 py-3">{employee.position}</td>
                <td className="px-4 py-3 font-sans whitespace-nowrap">{formatPayrollAmount(employee.baseSalary, countryCode)}</td>
                <td className="px-4 py-3 font-sans whitespace-nowrap">{formatPayrollAmount(employee.serviceAllowance, countryCode)}</td>
                <td className="px-4 py-3 font-sans whitespace-nowrap">{formatPayrollAmount(employee.transportAllowance, countryCode)}</td>
                <td className="px-4 py-3 font-sans whitespace-nowrap">{formatPayrollAmount(employee.accommodationAllowance, countryCode)}</td>
                <td className="px-4 py-3 font-sans whitespace-nowrap">{formatPayrollAmount(employee.mobileAllowance, countryCode)}</td>
                <td className="px-4 py-3 font-sans whitespace-nowrap">{formatOtherAllowancesSummary(employee.otherAllowances, countryCode)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatWorkPermitLabel(employee.workPermitByCompany)}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={DIRECTORY_TABLE_COLUMNS.length} className="px-4 py-8 text-center text-muted-foreground">
                  No employees found for this company.
                </td>
              </tr>
            )}
            <InfiniteScrollTableSentinel colSpan={DIRECTORY_TABLE_COLUMNS.length} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  );
}
