import { useCallback, useEffect, useMemo, useState } from 'react';
import { api as bisyncApi, type AppUser, type Company, type UserUpsert } from '../../api';
import { hrApi as api, toEmployeeRequest } from '../../modules/hr/api';
import type { DivisionTreeNode, Employee, EmployeeLevel } from '../../modules/hr/types';
import { EmployeeDetailPanel } from './EmployeeDetailPanel';
import { EmployeeDirectoryTab } from './EmployeeDirectoryTab';
import { emptyEmployeeForm, iso } from './employeeTabShared';
import { orgSelectionPatch, resolveEmployeeOrg } from './orgSelectShared';
import { PlatformAccessPanel, userUpsertForEmployee } from './UsersTab';
import { checkinMethodLabel } from './employeeTabShared';
import { getPhoneValidationError } from '../shared/CountryPhoneInput';
import { getAddressValidationError } from '../shared/CountryAddressFields';
import { parseUserAccess, setAccessControlType } from '../../data/userAccess';
import { parseAddress } from '../../utils/countryFormat';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  onDataChanged?: () => void;
  selectedCompanyId?: number | null;
};

export function EmployeeTab({ onDataChanged, selectedCompanyId = null }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [platformUsers, setPlatformUsers] = useState<AppUser[]>([]);
  const [employeeLevels, setEmployeeLevels] = useState<EmployeeLevel[]>([]);
  const [orgTree, setOrgTree] = useState<DivisionTreeNode[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [operatingCountryCode, setOperatingCountryCode] = useState('MY');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [detailDraft, setDetailDraft] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({ ...emptyEmployeeForm });
  const [accessPanel, setAccessPanel] = useState<{ user: AppUser | UserUpsert; isNew: boolean } | null>(null);
  const [accessControlSaving, setAccessControlSaving] = useState(false);

  const today = new Date();

  const load = useCallback(async () => {
    const [emps, users, levels, tree, settings, comps] = await Promise.all([
      api.employees.list(),
      bisyncApi.users().catch(() => [] as AppUser[]),
      api.levels.list(),
      api.org.tree(),
      api.settings.get().catch(() => ({ operatingCountryCode: 'MY' } as const)),
      bisyncApi.companies().catch(() => [] as Company[]),
    ]);
    setEmployees(emps);
    setPlatformUsers(users);
    setEmployeeLevels(levels);
    setOrgTree(tree);
    setOperatingCountryCode(settings.operatingCountryCode || 'MY');
    setCompanies(comps);
  }, []);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [load]);

  const notifyChanged = useCallback(async () => {
    await load();
    onDataChanged?.();
  }, [load, onDataChanged]);

  const run = useCallback(async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const levelName = (id?: number | null) => employeeLevels.find(l => l.id === id)?.levelName;
  const divisionName = (id?: number | null) => orgTree.find(d => d.id === id)?.name ?? '—';

  const employeeDivisionName = (employee: Employee) => {
    if (employee.divisionId) return divisionName(employee.divisionId);
    for (const division of orgTree) {
      if (division.departments.some(d => d.id === employee.departmentId || d.name === employee.department)) {
        return division.name;
      }
    }
    return '—';
  };

  const departmentName = (employee: Employee) => {
    if (employee.departmentId) {
      for (const division of orgTree) {
        const department = division.departments.find(d => d.id === employee.departmentId);
        if (department) return department.name;
      }
    }
    return employee.department || '—';
  };

  const employeeIsShift = (employee: Employee) => {
    const level = employee.employeeLevel ?? employeeLevels.find(l => l.id === employee.employeeLevelId);
    if (level) return level.isShift;
    return employee.isShiftEmployee;
  };

  const platformUserFor = (employee: Employee) =>
    platformUsers.find(u => u.employeeId === employee.id)
    ?? platformUsers.find(u => u.email.toLowerCase() === employee.email.toLowerCase());

  const filteredEmployees = useMemo(() => {
    if (!selectedCompanyId) return [];
    return employees.filter(employee => platformUserFor(employee)?.companyId === selectedCompanyId);
  }, [employees, platformUsers, selectedCompanyId]);

  const employeeCompanyName = (employee: Employee) => platformUserFor(employee)?.companyName ?? '—';
  const employeeLocationLabel = (employee: Employee) => {
    const names = platformUserFor(employee)?.locationNames;
    if (!names?.length) return '—';
    return names.join(', ');
  };

  const openAddEmployeeForm = () => {
    setShowEmployeeForm(true);
    setFormData({ ...emptyEmployeeForm, joinDate: iso(today) });
  };

  const countryCodeForEmployee = (employee?: Employee | null) => {
    if (employee) {
      const companyId = platformUserFor(employee)?.companyId;
      const company = companies.find(c => c.id === companyId);
      if (company?.countryCode) return company.countryCode;
    }
    return operatingCountryCode;
  };

  const validateEmployeeForm = () => {
    const { name, email, mobile, position, joinDate, divisionId, departmentId } = formData;
    const countryCode = operatingCountryCode;
    const missing: string[] = [];
    if (!name.trim()) missing.push('Full Name');
    if (!email.trim()) missing.push('Email');
    if (!mobile.trim()) missing.push('Mobile Number');
    if (!divisionId) missing.push('Division');
    if (!departmentId) missing.push('Department');
    if (!position.trim()) missing.push('Position');
    if (!joinDate) missing.push('Join Date');
    if (missing.length > 0) {
      setError(`Please fill in required fields: ${missing.join(', ')}.`);
      return false;
    }
    const phoneError = getPhoneValidationError(countryCode, mobile, 'Mobile number', true);
    if (phoneError) {
      setError(phoneError);
      return false;
    }
    return true;
  };

  const createEmployeeFromForm = async () => {
    const { name, email, mobile, position, joinDate, divisionId, departmentId } = formData;
    return api.employees.create({
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      divisionId,
      departmentId,
      position: position.trim(),
      joinDate,
      companyId: selectedCompanyId ?? undefined,
      fingerprintEnrolled: false,
      faceRecognitionEnrolled: false,
      isShiftEmployee: false,
      shiftType: null,
      posEnabled: false,
      bisyncEnabled: false,
      active: true,
      checkinMethod: 'Biometrics',
      workingHoursPerDay: 8,
      employeeLevelId: formData.employeeLevelId,
      reportsToId: formData.reportsToId,
      nationality: null,
      idPassportNumber: null,
      dateOfBirth: null,
      personalEmail: null,
      permanentAddress: null,
    });
  };

  const openGrantAccessForEmployee = (employee: Employee) => {
    const existing = platformUserFor(employee);
    setAccessPanel({
      user: userUpsertForEmployee(employee, existing),
      isNew: !existing,
    });
  };

  const submitEmployeeForm = () => run(async () => {
    if (!validateEmployeeForm()) return;
    await createEmployeeFromForm();
    setShowEmployeeForm(false);
    setFormData({ ...emptyEmployeeForm });
    await notifyChanged();
  });

  const submitEmployeeFormWithGrantAccess = () => run(async () => {
    if (!validateEmployeeForm()) return;
    const created = await createEmployeeFromForm();
    setShowEmployeeForm(false);
    setFormData({ ...emptyEmployeeForm });
    await notifyChanged();
    openGrantAccessForEmployee(created);
  });

  const openEmployeeDetail = (id: number) => run(async () => {
    const emp = await api.employees.get(id);
    setDetailDraft(resolveEmployeeOrg(emp, orgTree));
  });

  const closeEmployeeDetail = () => setDetailDraft(null);

  const saveEmployeeDetail = () => run(async () => {
    if (!detailDraft) return;
    if (!detailDraft.divisionId || !detailDraft.departmentId) {
      setError('Please select Division and Department.');
      return;
    }
    const countryCode = countryCodeForEmployee(detailDraft);
    const phoneError = getPhoneValidationError(countryCode, detailDraft.mobile, 'Mobile number', true);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    const addressError = getAddressValidationError(countryCode, parseAddress(detailDraft.permanentAddress));
    if (addressError) {
      setError(addressError);
      return;
    }
    const saved = await api.employees.update(detailDraft.id, {
      ...toEmployeeRequest(detailDraft),
      companyId: platformUserFor(detailDraft)?.companyId ?? selectedCompanyId ?? undefined,
    });
    setDetailDraft(resolveEmployeeOrg(saved, orgTree));
    await notifyChanged();
  });

  const handleDeleteEmployee = () => run(async () => {
    if (!detailDraft) return;
    await api.employees.remove(detailDraft.id);
    closeEmployeeDetail();
    await notifyChanged();
  });

  const toggleEmployeeActive = (employee: Employee, active: boolean) => run(async () => {
    const saved = await api.employees.update(employee.id, toEmployeeRequest({ ...employee, active }));
    if (detailDraft?.id === employee.id) setDetailDraft(saved);
    await notifyChanged();
  });

  const resetPosPin = () => run(async () => {
    if (!detailDraft) return;
    const updated = await api.employees.resetPosPin(detailDraft.id);
    setDetailDraft(updated);
    await notifyChanged();
  });

  const resetPayrollPin = () => run(async () => {
    if (!detailDraft) return;
    const updated = await api.employees.resetPayrollPin(detailDraft.id);
    setDetailDraft(updated);
    await notifyChanged();
  });

  const updateAccessControlType = (typeId: string | null) => run(async () => {
    if (!detailDraft) return;
    const user = platformUserFor(detailDraft);
    if (!user) {
      setError('Grant platform access before assigning an access control level.');
      return;
    }
    setAccessControlSaving(true);
    try {
      const access = setAccessControlType(parseUserAccess(user.accessJson), typeId);
      await bisyncApi.updateUser(user.id, {
        employeeId: user.employeeId ?? null,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        active: user.active,
        accessJson: JSON.stringify(access),
        companyId: user.companyId,
        locationIdsJson: user.locationIdsJson,
      });
      await notifyChanged();
    } finally {
      setAccessControlSaving(false);
    }
  });

  const updateDetailDraft = (patch: Partial<Employee>) => {
    if (!detailDraft) return;
    let next = { ...detailDraft, ...patch };
    if ('divisionId' in patch || 'departmentId' in patch) {
      next = {
        ...next,
        ...orgSelectionPatch(orgTree, next.divisionId ?? null, next.departmentId ?? null),
      };
    }
    if ('permanentAddress' in patch && typeof patch.permanentAddress === 'string') {
      next.permanentAddress = patch.permanentAddress || null;
    }
    if (patch.checkinMethod === 'POS') next.posEnabled = true;
    if (patch.checkinMethod && patch.checkinMethod !== 'POS') next.posEnabled = false;
    setDetailDraft(next);
  };

  const handleAccessPanelSaved = async () => {
    setAccessPanel(null);
    await notifyChanged();
    if (detailDraft) {
      const emp = await api.employees.get(detailDraft.id).catch(() => null);
      if (emp) setDetailDraft(emp);
    }
  };

  if (loading) {
    return <MillstoneLoader size="sm" layout="block" label="Loading employees…" />;
  }

  return (
    <>
      <EmployeeDirectoryTab
        employees={filteredEmployees}
        employeeLevels={employeeLevels}
        orgTree={orgTree}
        formData={formData}
        showEmployeeForm={showEmployeeForm}
        error={error}
        noCompanySelected={!selectedCompanyId}
        platformUserFor={platformUserFor}
        employeeCompanyName={employeeCompanyName}
        employeeLocationLabel={employeeLocationLabel}
        employeeDivisionName={employeeDivisionName}
        departmentName={departmentName}
        countryCode={operatingCountryCode}
        levelName={levelName}
        employeeIsShift={employeeIsShift}
        checkinMethodLabel={checkinMethodLabel}
        onOpenAdd={openAddEmployeeForm}
        onCloseForm={() => { setShowEmployeeForm(false); setFormData({ ...emptyEmployeeForm }); }}
        onFormChange={data => setFormData(prev => ({ ...prev, ...data }))}
        onSubmit={submitEmployeeForm}
        onSubmitWithGrantAccess={submitEmployeeFormWithGrantAccess}
        onOpenDetail={id => void openEmployeeDetail(id)}
        onToggleActive={toggleEmployeeActive}
        onClearError={() => setError(null)}
      />

      {detailDraft && (
        <EmployeeDetailPanel
          employee={detailDraft}
          employees={employees}
          employeeLevels={employeeLevels}
          orgTree={orgTree}
          platformUser={platformUserFor(detailDraft)}
          departmentName={departmentName}
          countryCode={countryCodeForEmployee(detailDraft)}
          employeeIsShift={employeeIsShift}
          onClose={closeEmployeeDetail}
          onSave={saveEmployeeDetail}
          onDelete={() => {
            if (confirm('Delete this employee permanently?')) handleDeleteEmployee();
          }}
          onUpdate={updateDetailDraft}
          onGrantAccess={() => openGrantAccessForEmployee(detailDraft)}
          onAccessControlTypeChange={updateAccessControlType}
          accessControlSaving={accessControlSaving}
          onResetPosPin={resetPosPin}
          onResetPayrollPin={resetPayrollPin}
        />
      )}

      {accessPanel && (
        <PlatformAccessPanel
          user={accessPanel.user}
          isNew={accessPanel.isNew}
          availableEmployees={[]}
          lockEmployee
          elevated
          onClose={() => setAccessPanel(null)}
          onSave={() => void handleAccessPanelSaved()}
        />
      )}
    </>
  );
}
