import type { CheckinMethod } from '../../modules/hr/types';

export const DEFAULT_POS_PIN = '1234';
export const DEFAULT_PAYROLL_PIN = '000000';

export const CHECKIN_METHODS: CheckinMethod[] = ['POS', 'Biometrics', 'AccessTag'];

export const checkinMethodLabel = (method: CheckinMethod) => {
  switch (method) {
    case 'POS': return 'POS';
    case 'Biometrics': return 'Biometrics';
    case 'AccessTag': return 'Access Tag';
  }
};

export const emptyEmployeeForm = {
  name: '', email: '', mobile: '', position: '', joinDate: '',
  divisionId: null as number | null,
  departmentId: null as number | null,
  fingerprintEnrolled: false, faceRecognitionEnrolled: false,
  posEnabled: false, bisyncEnabled: false,
  active: true,
  checkinMethod: 'Biometrics' as CheckinMethod,
  employeeLevelId: null as number | null,
  reportsToId: null as number | null,
};

export const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

import type { EmployeeLevel } from '../../modules/hr/types';

export function selectableEmployeeLevels(levels: EmployeeLevel[], selectedId?: number | null) {
  return levels.filter(level => level.active !== false || level.id === selectedId);
}
