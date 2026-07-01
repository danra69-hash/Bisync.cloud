import type { AppUser } from '../../api';
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

const thCls = 'text-left px-4 py-2.5 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal';

const COLUMNS = [
  'Location',
  'Name',
  'Employee ID',
  'Date Joined',
  'Division',
  'Department',
  'Position',
  'Base Salary',
  'Service',
  'Transport Allowances',
  'Accommodation',
  'Mobile Allowances',
  'Other Allowances',
  'Work Permit',
] as const;

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

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {employees.length} employees in directory
        {payStructure ? ` · Pay cycle: ${payStructure.payCycle}` : ' · Pay structure not configured for this company'}
      </p>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs min-w-[1400px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {COLUMNS.map(h => (
                <th
                  key={h}
                  className={thCls}
                  title={h === 'Base Salary' ? 'Payment cycle follows Pay Structure' : undefined}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map(employee => (
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
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-muted-foreground">
                  No employees found for this company.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
