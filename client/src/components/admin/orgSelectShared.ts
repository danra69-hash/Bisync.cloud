import type { DivisionTreeNode, Employee } from '../../modules/hr/types';

export function resolveEmployeeOrg(employee: Employee, orgTree: DivisionTreeNode[]): Employee {
  if (employee.departmentId && employee.divisionId) return employee;

  if (employee.departmentId) {
    for (const division of orgTree) {
      const department = division.departments.find(d => d.id === employee.departmentId);
      if (department) {
        return { ...employee, divisionId: division.id, department: department.name };
      }
    }
  }

  if (employee.department) {
    const normalized = employee.department.trim().toLowerCase();
    for (const division of orgTree) {
      const department = division.departments.find(d => d.name.trim().toLowerCase() === normalized);
      if (department) {
        return {
          ...employee,
          divisionId: division.id,
          departmentId: department.id,
          department: department.name,
        };
      }
    }
  }

  return employee;
}

export function orgSelectionPatch(
  orgTree: DivisionTreeNode[],
  divisionId: number | null,
  departmentId: number | null,
): Pick<Employee, 'divisionId' | 'departmentId' | 'department'> {
  if (!departmentId) {
    return { divisionId, departmentId: null, department: '' };
  }

  for (const division of orgTree) {
    const department = division.departments.find(d => d.id === departmentId);
    if (department) {
      return {
        divisionId: division.id,
        departmentId: department.id,
        department: department.name,
      };
    }
  }

  return { divisionId, departmentId, department: '' };
}
