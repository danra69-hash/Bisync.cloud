import { useCallback, useEffect, useMemo, useState } from 'react';
import { api as bisyncApi, type AppUser } from '../../api';
import { hrApi, toEmployeeRequest } from '../../modules/hr/api';
import type { DivisionTreeNode, Employee, PayStructure } from '../../modules/hr/types';
import { employeeCompanyId } from './employeeOrgDisplay';
import { PayrollEmployeeDetailPanel } from './PayrollEmployeeDetailPanel';
import { PayrollEmployeeDirectoryTab } from './PayrollEmployeeDirectoryTab';
import { MALAYSIA_BANKS, type MalaysiaBank } from './malaysiaBanks';
import { validatePayrollAllowanceDetails } from './payrollAllowanceShared';

type Props = {
  selectedCompanyId: number | null;
  companyCountryCode?: string | null;
};

export function PayrollEmployeeDirectoryPanel({
  selectedCompanyId,
  companyCountryCode,
}: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [platformUsers, setPlatformUsers] = useState<AppUser[]>([]);
  const [orgTree, setOrgTree] = useState<DivisionTreeNode[]>([]);
  const [payStructure, setPayStructure] = useState<PayStructure | null>(null);
  const [customBanks, setCustomBanks] = useState<string[]>([]);
  const [detailDraft, setDetailDraft] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [emps, users, tree, structures] = await Promise.all([
      hrApi.employees.list(),
      bisyncApi.users().catch(() => [] as AppUser[]),
      hrApi.org.tree(),
      hrApi.payStructures.list().catch(() => []),
    ]);
    setEmployees(emps);
    setPlatformUsers(users);
    setOrgTree(tree);
    setPayStructure(
      selectedCompanyId
        ? structures.find(s => s.companyId === selectedCompanyId) ?? null
        : null,
    );
  }, [selectedCompanyId]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [load]);

  const filteredEmployees = useMemo(
    () => (selectedCompanyId
      ? employees.filter(employee => employeeCompanyId(employee, platformUsers) === selectedCompanyId)
      : []),
    [employees, platformUsers, selectedCompanyId],
  );

  const addCustomBank = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomBanks(prev => (
      prev.some(bank => bank.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
    ));
  }, []);

  const openDetail = async (id: number) => {
    try {
      setError(null);
      const employee = await hrApi.employees.get(id);
      const bankName = employee.bankName?.trim();
      if (bankName && !MALAYSIA_BANKS.includes(bankName as MalaysiaBank)) {
        addCustomBank(bankName);
      }
      setDetailDraft({
        ...employee,
        otherAllowances: employee.otherAllowances ?? [],
        bankAccountHolderName: employee.bankAccountHolderName?.trim() || employee.name,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveDetail = async () => {
    if (!detailDraft) return;
    const validationError = validatePayrollAllowanceDetails(detailDraft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const cleanedOther = (detailDraft.otherAllowances ?? [])
        .map(item => ({ name: item.name.trim(), amount: item.amount }))
        .filter(item => item.name.length > 0);
      const payload = {
        ...detailDraft,
        otherAllowances: cleanedOther,
        bankAccountHolderName: detailDraft.bankAccountHolderName?.trim() || detailDraft.name,
      };
      const saved = await hrApi.employees.update(detailDraft.id, toEmployeeRequest(payload));
      setEmployees(prev => prev.map(e => (e.id === saved.id ? saved : e)));
      setDetailDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-8 text-center text-xs text-muted-foreground">Loading employee directory…</p>;
  }

  if (error && !detailDraft) {
    return (
      <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">
        {error}
      </div>
    );
  }

  if (!selectedCompanyId) {
    return (
      <p className="text-xs text-muted-foreground py-4">Select a company from the menu bar above to view employees.</p>
    );
  }

  return (
    <>
      <PayrollEmployeeDirectoryTab
        employees={filteredEmployees}
        orgTree={orgTree}
        platformUsers={platformUsers}
        payStructure={payStructure}
        onOpenDetail={id => void openDetail(id)}
      />

      {detailDraft && (
        <PayrollEmployeeDetailPanel
          employee={detailDraft}
          orgTree={orgTree}
          platformUsers={platformUsers}
          payStructure={payStructure}
          companyCountryCode={companyCountryCode}
          customBanks={customBanks}
          onAddCustomBank={addCustomBank}
          saving={saving}
          error={error}
          onClose={() => { setDetailDraft(null); setError(null); }}
          onSave={() => void saveDetail()}
          onUpdate={patch => setDetailDraft(prev => (prev ? { ...prev, ...patch } : prev))}
          onClearError={() => setError(null)}
        />
      )}
    </>
  );
}
