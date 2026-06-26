import type { AppUser } from '../../api';
import type { DivisionTreeNode, Employee } from '../../modules/hr/types';

export function platformUserFor(employee: Employee, platformUsers: AppUser[]) {
  return platformUsers.find(u => u.employeeId === employee.id)
    ?? platformUsers.find(u => u.email.toLowerCase() === employee.email.toLowerCase());
}

export function employeeCompanyName(employee: Employee, platformUsers: AppUser[]) {
  return platformUserFor(employee, platformUsers)?.companyName ?? '—';
}

export function employeeCompanyId(employee: Employee, platformUsers: AppUser[]) {
  return platformUserFor(employee, platformUsers)?.companyId ?? null;
}

export function employeeLocationLabel(employee: Employee, platformUsers: AppUser[]) {
  const names = platformUserFor(employee, platformUsers)?.locationNames;
  if (!names?.length) return '—';
  return names.join(', ');
}

export function divisionName(orgTree: DivisionTreeNode[], id?: number | null) {
  return orgTree.find(d => d.id === id)?.name ?? '—';
}

export function employeeDivisionName(employee: Employee, orgTree: DivisionTreeNode[]) {
  if (employee.divisionId) return divisionName(orgTree, employee.divisionId);
  for (const division of orgTree) {
    if (division.departments.some(d => d.id === employee.departmentId || d.name === employee.department)) {
      return division.name;
    }
  }
  return '—';
}

export function employeeDepartmentName(employee: Employee, orgTree: DivisionTreeNode[]) {
  if (employee.departmentId) {
    for (const division of orgTree) {
      const department = division.departments.find(d => d.id === employee.departmentId);
      if (department) return department.name;
    }
  }
  return employee.department || '—';
}
