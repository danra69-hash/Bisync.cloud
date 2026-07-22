import { useState } from 'react';
import { Eye, EyeOff, Lock, LogOut, Wallet } from 'lucide-react';
import type { Employee } from './types';

type Props = {
  employees: Employee[];
  onVerifyPayrollPin: (pin: string) => Promise<Employee | null>;
};

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

export default function EmployeePayrollPortal({ employees, onVerifyPayrollPin }: Props) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payrollPin, setPayrollPin] = useState('');
  const [showPayrollPin, setShowPayrollPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);

  function lock() {
    setEmployee(null);
    setPayrollPin('');
    setPinError('');
    setShowPayrollPin(false);
  }

  async function submitPin() {
    if (!/^\d{6}$/.test(payrollPin)) {
      setPinError('Enter a 6-digit PIN.');
      return;
    }
    if (employees.length === 0) {
      setPinError('No employees available.');
      return;
    }
    setVerifying(true);
    setPinError('');
    try {
      const matched = await onVerifyPayrollPin(payrollPin);
      if (!matched) {
        setPinError('Incorrect PIN. Please try again.');
        return;
      }
      setPayrollPin('');
      setEmployee(matched);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('404')) {
        setPinError('Payroll PIN service unavailable. Restart the API: dotnet run --project src/Bisync.Api');
      } else {
        setPinError('Unable to verify PIN. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  }

  if (!employee) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-herme-cream flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-herme-dark rounded-xl mb-4">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Payroll</h2>
            <p className="text-xs text-slate-500 mt-1">Enter your 6-digit PIN</p>
          </div>
          <div className="relative mb-4">
            <input
              type={showPayrollPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={payrollPin}
              onChange={e => setPayrollPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && void submitPin()}
              placeholder="••••••"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme focus:border-transparent placeholder:text-slate-300 font-sans tracking-[0.35em] text-center text-lg"
              autoFocus
            />
            <button type="button" onClick={() => setShowPayrollPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPayrollPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {pinError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{pinError}</p>}
          <button
            type="button"
            onClick={() => void submitPin()}
            disabled={payrollPin.length !== 6 || verifying}
            className="w-full bg-herme-dark hover:bg-herme-darker disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            {verifying ? 'Verifying…' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-herme-cream min-h-[calc(100vh-200px)]">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-herme-dark text-white rounded-xl flex items-center justify-center font-bold text-sm">{initials(employee.name)}</div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Payroll</div>
            <div className="font-semibold text-slate-800 text-sm">{employee.name}</div>
            <div className="text-xs text-slate-500">{employee.position} · {employee.department}</div>
          </div>
        </div>
        <button type="button" onClick={lock} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
          <LogOut className="w-3.5 h-3.5" /> Lock
        </button>
      </div>

      <div className="p-6 w-full max-w-none mx-auto space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Latest Payslip', value: '—', hint: 'No payslip issued yet' },
            { label: 'YTD Gross', value: '—', hint: 'Year to date' },
            { label: 'Last Payment', value: '—', hint: 'Most recent cycle' },
          ].map(item => (
            <div key={item.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{item.label}</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{item.value}</div>
              <div className="text-xs text-slate-400 mt-1">{item.hint}</div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl px-5 py-10 text-center shadow-sm">
          <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">Payslip history will appear here</p>
        </div>
      </div>
    </div>
  );
}
