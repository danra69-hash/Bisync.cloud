import { useEffect, useState } from 'react';
import type { AppUser } from '../../api';
import { inputCls, selectCls } from '../../data/countries';
import type { CheckinMethod, DivisionTreeNode, Employee, EmployeeLevel } from '../../modules/hr/types';
import { CountryAddressFields } from '../shared/CountryAddressFields';
import { CountryPhoneInput } from '../shared/CountryPhoneInput';
import { formatAddress, parseAddress } from '../../utils/countryFormat';
import type { AddressParts } from '../../utils/countryFormat';
import { OrgSelectFields } from './OrgSelectFields';
import { PlatformAccessSummary } from './PlatformAccessSummary';
import { CHECKIN_METHODS, DEFAULT_PAYROLL_PIN, DEFAULT_POS_PIN, checkinMethodLabel, initials, selectableEmployeeLevels } from './employeeTabShared';
import { SIDE_PANEL_DETAIL_SHELL_CLS, SIDE_PANEL_ROOT_CLS } from '../layout/sidePanelShared';

type Props = {
  employee: Employee;
  employees: Employee[];
  employeeLevels: EmployeeLevel[];
  orgTree: DivisionTreeNode[];
  platformUser: AppUser | undefined;
  departmentName: (employee: Employee) => string;
  countryCode: string;
  employeeIsShift: (employee: Employee) => boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Employee>) => void;
  onGrantAccess: () => void;
  onResetPosPin: () => void;
  onResetPayrollPin: () => void;
};

export function EmployeeDetailPanel({
  employee,
  employees,
  employeeLevels,
  orgTree,
  platformUser,
  departmentName,
  countryCode,
  employeeIsShift,
  onClose,
  onSave,
  onDelete,
  onUpdate,
  onGrantAccess,
  onResetPosPin,
  onResetPayrollPin,
}: Props) {
  const [addressParts, setAddressParts] = useState<AddressParts>(() => parseAddress(employee.permanentAddress));

  useEffect(() => {
    setAddressParts(parseAddress(employee.permanentAddress));
  }, [employee.id, employee.permanentAddress]);

  function updateAddress(parts: AddressParts) {
    setAddressParts(parts);
    onUpdate({ permanentAddress: formatAddress(parts) || null });
  }

  return (
    <div className={SIDE_PANEL_ROOT_CLS}>
      <div className="absolute inset-0 bg-foreground/10" onClick={onClose} />
      <div className={SIDE_PANEL_DETAIL_SHELL_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">
              {initials(employee.name)}
            </div>
            <div>
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">Employee</p>
              <h3 className="text-sm font-semibold">{employee.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {employee.employeeCode} · {employee.position} · {departmentName(employee)}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <div>
            <h4 className="text-sm font-semibold mb-3 pb-2 border-b border-border">Personal & Employment Details</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  value={employee.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Work Email</label>
                <input
                  type="email"
                  value={employee.email}
                  onChange={(e) => onUpdate({ email: e.target.value })}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Position</label>
                <input
                  type="text"
                  value={employee.position}
                  onChange={(e) => onUpdate({ position: e.target.value })}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Join Date</label>
                <input
                  type="date"
                  value={employee.joinDate}
                  onChange={(e) => onUpdate({ joinDate: e.target.value })}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <OrgSelectFields
                orgTree={orgTree}
                divisionId={employee.divisionId ?? null}
                departmentId={employee.departmentId ?? null}
                required
                onChange={patch => onUpdate(patch)}
              />
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Employee Level</label>
                <select
                  value={employee.employeeLevelId ?? ''}
                  onChange={(e) => onUpdate({
                    employeeLevelId: e.target.value ? Number(e.target.value) : null,
                  })}
                  className={`${selectCls} mt-1`}
                >
                  <option value="">— Select level —</option>
                  {selectableEmployeeLevels(employeeLevels, employee.employeeLevelId).map((level) => (
                    <option key={level.id} value={level.id}>{level.levelName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Reports To</label>
                <select
                  value={employee.reportsToId ?? ''}
                  onChange={(e) => onUpdate({
                    reportsToId: e.target.value ? Number(e.target.value) : null,
                  })}
                  className={`${selectCls} mt-1`}
                >
                  <option value="">— Select manager —</option>
                  {employees.filter((e) => e.id !== employee.id).map((e) => (
                    <option key={e.id} value={e.id}>{e.name} — {e.position}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Nationality</label>
                <input
                  type="text"
                  value={employee.nationality ?? ''}
                  onChange={(e) => onUpdate({ nationality: e.target.value || null })}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">ID / Passport Number</label>
                <input
                  type="text"
                  value={employee.idPassportNumber ?? ''}
                  onChange={(e) => onUpdate({ idPassportNumber: e.target.value || null })}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Date of Birth</label>
                <input
                  type="date"
                  value={employee.dateOfBirth ?? ''}
                  onChange={(e) => onUpdate({ dateOfBirth: e.target.value || null })}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <CountryPhoneInput
                countryCode={countryCode}
                value={employee.mobile}
                onChange={value => onUpdate({ mobile: value })}
                label="Contact Number"
                required
              />
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Personal Email</label>
                <input
                  type="email"
                  value={employee.personalEmail ?? ''}
                  onChange={(e) => onUpdate({ personalEmail: e.target.value || null })}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Permanent Address</label>
                <CountryAddressFields
                  countryCode={countryCode}
                  value={addressParts}
                  onChange={updateAddress}
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 pb-2 border-b border-border">Platform Access</h4>
            <PlatformAccessSummary
              user={platformUser}
              onManageAccess={onGrantAccess}
            />
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 pb-2 border-b border-border">Check-in Method</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Method</label>
                <select
                  value={employee.checkinMethod ?? 'Biometrics'}
                  onChange={(e) => onUpdate({ checkinMethod: e.target.value as CheckinMethod })}
                  className={`${selectCls} mt-1`}
                >
                  {CHECKIN_METHODS.map((method) => (
                    <option key={method} value={method}>{checkinMethodLabel(method)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <p className="text-xs text-muted-foreground">
                  Shift status: {employeeIsShift(employee) ? 'Shift employee' : 'Non-shift'} (via Employee Level)
                </p>
              </div>
            </div>

            {employee.checkinMethod === 'Biometrics' && (
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={employee.fingerprintEnrolled}
                    onChange={(e) => onUpdate({ fingerprintEnrolled: e.target.checked })}
                    className="rounded border-border text-primary"
                  />
                  Fingerprint enrolled
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={employee.faceRecognitionEnrolled}
                    onChange={(e) => onUpdate({ faceRecognitionEnrolled: e.target.checked })}
                    className="rounded border-border text-primary"
                  />
                  Face recognition enrolled
                </label>
              </div>
            )}

            {employee.checkinMethod === 'POS' && (
              <div className="mt-3 flex flex-wrap items-end gap-3 p-4 bg-muted/30 border border-border rounded-lg">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">POS PIN</label>
                  <input
                    type="text"
                    readOnly
                    value={employee.posPin ?? DEFAULT_POS_PIN}
                    className={`${inputCls} mt-1 font-mono tracking-widest`}
                  />
                  {employee.posPinMustChange && (
                    <p className="text-[10px] text-muted-foreground mt-1">PIN change required on next login</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onResetPosPin}
                  className="text-xs font-mono border border-border rounded-md px-4 py-2 hover:bg-muted"
                >
                  Reset PIN to {DEFAULT_POS_PIN}
                </button>
              </div>
            )}

            {employee.checkinMethod === 'AccessTag' && (
              <p className="mt-3 text-xs text-muted-foreground">Employee will check in using an assigned access tag.</p>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-3 p-4 bg-muted/30 border border-border rounded-lg">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Payroll PIN (6 digits)</label>
                <input
                  type="password"
                  readOnly
                  value="••••••"
                  className={`${inputCls} mt-1 font-mono tracking-widest`}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {employee.payrollPinMustChange !== false
                    ? 'Default PIN active — employee should change after first payroll unlock.'
                    : 'Employee has set a custom payroll PIN.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onResetPayrollPin}
                className="text-xs font-mono border border-border rounded-md px-4 py-2 hover:bg-muted"
              >
                Reset PIN to {DEFAULT_PAYROLL_PIN}
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 pb-2 border-b border-border">Educational Details & Certificates</h4>
            {employee.education?.length ? (
              <div className="space-y-4">
                {employee.education.map((edu) => (
                  <div key={edu.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Degree</label>
                        <p className="text-gray-900">{edu.degree}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Institution</label>
                        <p className="text-gray-900">{edu.institution}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Year</label>
                        <p className="text-gray-900">{edu.year}</p>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-sm text-gray-600 mb-1">Certificate</label>
                        <p className="text-gray-900">{edu.certificate}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground italic">No education records available</p>}
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 pb-2 border-b border-border">Previous Employment History</h4>
            {employee.previousEmployments?.length ? (
              <div className="space-y-4">
                {employee.previousEmployments.map((emp) => (
                  <div key={emp.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Company Name</label>
                        <p className="text-gray-900">{emp.companyName}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Position</label>
                        <p className="text-gray-900">{emp.position}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Years of Service</label>
                        <p className="text-gray-900">{emp.yearsOfService} years ({emp.startYear} - {emp.endYear})</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground italic">No previous employment records</p>}
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 pb-2 border-b border-border">Movement & Promotions Within Company</h4>
            {employee.movements?.length ? (
              <div className="space-y-4">
                {employee.movements.map((movement) => (
                  <div key={movement.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Date</label>
                        <p className="text-gray-900">{movement.date}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">From Position</label>
                        <p className="text-gray-900">{movement.fromPosition}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">To Position</label>
                        <p className="text-gray-900">{movement.toPosition}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Type</label>
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs ${
                          movement.type === 'Promotion' ? 'bg-green-100 text-green-800' :
                          movement.type === 'Transfer' ? 'bg-herme-soft text-herme-darker' :
                          'bg-gray-100 text-gray-800'
                        }`}>{movement.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground italic">No movement records</p>}
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 pb-2 border-b border-border">Annual Performance Appraisal</h4>
            {employee.performanceAppraisals?.length ? (
              <div className="space-y-4">
                {employee.performanceAppraisals.map((appraisal) => (
                  <div key={appraisal.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Year</label>
                        <p className="text-gray-900">{appraisal.year}</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Rating</label>
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs ${
                          appraisal.rating === 'Exceptional' ? 'bg-purple-100 text-purple-800' :
                          appraisal.rating === 'Excellent' ? 'bg-green-100 text-green-800' :
                          appraisal.rating === 'Very Good' ? 'bg-herme-soft text-herme-darker' :
                          'bg-gray-100 text-gray-800'
                        }`}>{appraisal.rating}</span>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Score</label>
                        <p className="text-gray-900">{appraisal.score} / 5.0</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Reviewer</label>
                        <p className="text-gray-900">{appraisal.reviewer}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Comments</label>
                      <p className="text-gray-900">{appraisal.comments}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground italic">No performance appraisal records</p>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={() => { if (confirm('Delete this employee permanently?')) onDelete(); }}
            className="text-xs font-mono border border-destructive/30 text-destructive rounded-md px-4 py-2 hover:bg-destructive/10"
          >
            Delete Employee
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="text-xs font-mono border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="button" onClick={onSave} className="text-xs font-mono bg-primary text-primary-foreground rounded-md px-4 py-2">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
