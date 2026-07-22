import { useState } from 'react';
import {
  FileText, Check, X, LogOut, ChevronLeft, ChevronRight,
  Lock, Eye, EyeOff, LayoutDashboard, Send,
} from 'lucide-react';
import type { Employee, LeaveBalanceRow, LeaveRequest, PublicHoliday, ShiftSchedule, LeaveType } from './types';

interface EmployeePortalProps {
  employees: Employee[];
  leaveBalances: LeaveBalanceRow[];
  leaveRequests: LeaveRequest[];
  shiftSchedules: ShiftSchedule[];
  publicHolidays: PublicHoliday[];
  onSubmitLeave: (leave: { employeeId: number; type: LeaveType; startDate: string; endDate: string; reason?: string }) => Promise<void>;
}

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const STANDARD_PW = 'Pass@123';

export default function EmployeePortal({
  employees, leaveBalances, leaveRequests, shiftSchedules, publicHolidays, onSubmitLeave,
}: EmployeePortalProps) {
  const [step, setStep] = useState<'select' | 'login' | 'change-password' | 'dashboard'>('select');
  const [portalEmp, setPortalEmp] = useState<Employee | null>(null);
  const [pwChanged, setPwChanged] = useState<Set<number>>(new Set());
  const [loginPw, setLoginPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [authError, setAuthError] = useState('');

  const [calView, setCalView] = useState<'monthly' | 'weekly'>('monthly');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [weekAnchor, setWeekAnchor] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    return d;
  });
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('AL');
  const [leaveReason, setLeaveReason] = useState('');
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const doLogin = () => {
    if (!portalEmp) return;
    const isFirst = !pwChanged.has(portalEmp.id);
    if (isFirst) {
      if (loginPw === STANDARD_PW) { setAuthError(''); setLoginPw(''); setStep('change-password'); }
      else setAuthError('Incorrect password. Hint: standard password is Pass@123');
    } else {
      if (loginPw.length >= 8) { setAuthError(''); setLoginPw(''); setStep('dashboard'); }
      else setAuthError('Invalid password.');
    }
  };

  const doChangePassword = () => {
    if (newPw.length < 8) { setAuthError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setAuthError('Passwords do not match.'); return; }
    if (newPw === STANDARD_PW) { setAuthError('New password cannot match the standard password.'); return; }
    setPwChanged(prev => new Set([...prev, portalEmp!.id]));
    setNewPw(''); setConfirmPw(''); setAuthError('');
    setStep('dashboard');
  };

  const doLogout = () => {
    setStep('select'); setPortalEmp(null);
    setSelStart(null); setSelEnd(null); setShowLeaveModal(false);
  };

  const getDayInfo = (dateStr: string, emp: Employee) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay();
    const ph = publicHolidays.find(h => h.date === dateStr && h.isRecognized);
    if (ph) return { type: 'public-holiday' as const, label: ph.name };
    const approved = leaveRequests.find(lr =>
      lr.employeeId === emp.id && lr.status === 'Approved' && dateStr >= lr.startDate && dateStr <= lr.endDate
    );
    if (approved) return { type: 'leave-approved' as const, label: approved.type };
    const pending = leaveRequests.find(lr =>
      lr.employeeId === emp.id && lr.status === 'Pending' && dateStr >= lr.startDate && dateStr <= lr.endDate
    );
    if (pending) return { type: 'leave-pending' as const, label: pending.type };
    if (emp.isShiftEmployee) {
      const sched = shiftSchedules.find(s => s.employeeId === emp.id && s.date === dateStr);
      if (sched) {
        if (sched.type === 'Work') {
          const start = sched.startTime?.slice(0, 5) ?? '';
          const end = sched.endTime?.slice(0, 5) ?? '';
          return { type: 'work' as const, label: start && end ? `${start}–${end}` : 'Work Day' };
        }
        if (sched.type === 'DO' || sched.type === 'RDO') return { type: 'do' as const, label: 'Day Off' };
        return { type: 'leave-approved' as const, label: sched.type };
      }
      if (dow === 0) return { type: 'do' as const, label: 'Day Off' };
      return { type: 'work' as const, label: emp.shiftType || 'Work Day' };
    }
    if (dow === 0 || dow === 6) return { type: 'weekend' as const, label: 'Weekend' };
    return { type: 'work' as const, label: 'Work Day' };
  };

  const effectiveEnd = selEnd || (selStart ? hoverDate : null);

  const isInRange = (dateStr: string) => {
    if (!selStart || !effectiveEnd) return dateStr === selStart;
    const [lo, hi] = selStart <= effectiveEnd ? [selStart, effectiveEnd] : [effectiveEnd, selStart];
    return dateStr >= lo && dateStr <= hi;
  };

  const isEdge = (dateStr: string) => {
    if (!selStart) return false;
    if (!effectiveEnd) return dateStr === selStart;
    const [lo, hi] = selStart <= effectiveEnd ? [selStart, effectiveEnd] : [effectiveEnd, selStart];
    return dateStr === lo || dateStr === hi;
  };

  const handleDayClick = (dateStr: string) => {
    if (!selStart || selEnd) { setSelStart(dateStr); setSelEnd(null); }
    else { setSelEnd(dateStr); setShowLeaveModal(true); }
  };

  const getMonthCells = () => {
    const first = new Date(calYear, calMonth, 1);
    const last = new Date(calYear, calMonth + 1, 0);
    const cells: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(calYear, calMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const getWeekCells = () => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAnchor);
      d.setDate(weekAnchor.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const prevPeriod = () => {
    if (calView === 'monthly') {
      if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1);
    } else {
      const d = new Date(weekAnchor); d.setDate(d.getDate() - 7); setWeekAnchor(d);
    }
  };

  const nextPeriod = () => {
    if (calView === 'monthly') {
      if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1);
    } else {
      const d = new Date(weekAnchor); d.setDate(d.getDate() + 7); setWeekAnchor(d);
    }
  };

  const periodLabel = () => {
    if (calView === 'monthly') return new Date(calYear, calMonth).toLocaleString('en-MY', { month: 'long', year: 'numeric' });
    const end = new Date(weekAnchor); end.setDate(end.getDate() + 6);
    return `${weekAnchor.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const handleSubmitLeave = async () => {
    if (!portalEmp || !selStart || submitting) return;
    const end = selEnd || selStart;
    const [startDate, endDate] = selStart <= end ? [selStart, end] : [end, selStart];
    setSubmitting(true);
    try {
      await onSubmitLeave({ employeeId: portalEmp.id, type: leaveType, startDate, endDate, reason: leaveReason || undefined });
      setShowLeaveModal(false); setSelStart(null); setSelEnd(null); setLeaveReason(''); setLeaveType('AL');
      setToast('Leave application submitted — pending approval.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const balance = portalEmp ? leaveBalances.find(lb => lb.employeeId === portalEmp.id) : null;

  const dayBg = (type: string, inRange: boolean, edge: boolean, isToday: boolean) => {
    const base = 'relative flex flex-col rounded-xl cursor-pointer transition-all duration-150 select-none ';
    const ring = edge ? 'ring-2 ring-herme ring-offset-1 ' : inRange ? 'ring-1 ring-herme-muted ' : '';
    const today = isToday ? 'after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-herme ' : '';
    switch (type) {
      case 'work': return base + ring + today + (isToday ? 'bg-herme-light hover:bg-herme-soft ' : 'bg-white hover:bg-slate-50 border border-slate-100 ');
      case 'do': return base + ring + today + 'bg-slate-100 text-slate-400 hover:bg-slate-200 ';
      case 'weekend': return base + ring + today + 'bg-slate-50 text-slate-400 hover:bg-slate-100 ';
      case 'public-holiday': return base + ring + today + 'bg-amber-50 hover:bg-amber-100 border border-amber-200 ';
      case 'leave-approved': return base + ring + today + 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 ';
      case 'leave-pending': return base + ring + today + 'bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 ';
      default: return base + ring + today + 'bg-white hover:bg-slate-50 border border-slate-100 ';
    }
  };

  const dayLabel = (type: string) => {
    switch (type) {
      case 'public-holiday': return 'text-amber-700';
      case 'leave-approved': return 'text-emerald-700';
      case 'leave-pending': return 'text-yellow-700';
      case 'do': case 'weekend': return 'text-slate-400';
      default: return 'text-slate-700';
    }
  };

  const formatSelDisplay = () => {
    if (!selStart) return '';
    const end = selEnd || selStart;
    const [lo, hi] = selStart <= end ? [selStart, end] : [end, selStart];
    const fmtD = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
    return lo === hi ? fmtD(lo) : `${fmtD(lo)} → ${fmtD(hi)}`;
  };

  const TODAY = fmt(new Date());
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ── SELECT EMPLOYEE ──
  if (step === 'select') {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-herme-cream flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-none">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-herme-dark rounded-2xl mb-5 shadow-lg">
              <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Employee Self-Service Portal</h2>
            <p className="text-slate-500 mt-2 text-sm">Select your account to sign in</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => { setPortalEmp(emp); setLoginPw(''); setAuthError(''); setStep('login'); }}
                className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-herme hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-herme-soft text-herme-dark rounded-xl flex items-center justify-center font-bold text-sm mb-3 group-hover:bg-herme-dark group-hover:text-white transition-colors">
                  {initials(emp.name)}
                </div>
                <div className="font-semibold text-slate-800 text-sm leading-tight">{emp.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{emp.position}</div>
                <div className="text-xs text-slate-400 mt-0.5">{emp.department}</div>
                {!pwChanged.has(emp.id) && (
                  <span className="inline-block mt-2.5 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">First Login</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── LOGIN ──
  if (step === 'login' && portalEmp) {
    const isFirst = !pwChanged.has(portalEmp.id);
    return (
      <div className="min-h-[calc(100vh-200px)] bg-herme-cream flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm p-8">
          <button onClick={() => setStep('select')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-6 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to accounts
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-herme-dark text-white rounded-xl flex items-center justify-center font-bold text-sm">{initials(portalEmp.name)}</div>
            <div>
              <div className="font-semibold text-slate-800">{portalEmp.name}</div>
              <div className="text-xs text-slate-500">{portalEmp.email}</div>
            </div>
          </div>
          {isFirst && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-start gap-2">
              <span className="text-amber-600 text-lg leading-none mt-0.5">⚠</span>
              <div>
                <div className="text-xs font-semibold text-amber-800">First-time Login</div>
                <div className="text-xs text-amber-700 mt-0.5">Use your standard password. You will be asked to set a new password.</div>
              </div>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={loginPw}
                  onChange={e => setLoginPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                  placeholder={isFirst ? 'Enter standard password' : 'Enter your password'}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme focus:border-transparent placeholder:text-slate-300"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {authError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{authError}</p>}
            <button onClick={doLogin} className="w-full bg-herme-dark hover:bg-herme-darker text-white font-semibold rounded-xl py-3 text-sm transition-colors">
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── CHANGE PASSWORD ──
  if (step === 'change-password' && portalEmp) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-herme-cream flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm p-8">
          <div className="flex items-center justify-center w-12 h-12 bg-herme-soft rounded-xl mb-5 mx-auto">
            <Lock className="w-6 h-6 text-herme-dark" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 text-center mb-1">Set Your Password</h3>
          <p className="text-xs text-slate-500 text-center mb-6">Choose a secure password to protect your account.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme focus:border-transparent placeholder:text-slate-300"
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPw.length > 0 && (
                <div className="mt-1.5 flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${newPw.length >= (i + 1) * 2 ? newPw.length >= 12 ? 'bg-emerald-500' : newPw.length >= 8 ? 'bg-herme' : 'bg-amber-400' : 'bg-slate-200'}`} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Confirm Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doChangePassword()}
                placeholder="Re-enter your password"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme focus:border-transparent placeholder:text-slate-300"
              />
            </div>
            {authError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{authError}</p>}
            <button onClick={doChangePassword} className="w-full bg-herme-dark hover:bg-herme-darker text-white font-semibold rounded-xl py-3 text-sm transition-colors">
              Set Password & Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ──
  if (step === 'dashboard' && portalEmp) {
    const monthCells = getMonthCells();
    const weekCells = getWeekCells();
    const empLeaveRequests = leaveRequests.filter(lr => lr.employeeId === portalEmp.id);

    return (
      <div className="bg-herme-cream min-h-[calc(100vh-200px)]">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-herme-dark text-white rounded-xl flex items-center justify-center font-bold text-sm">{initials(portalEmp.name)}</div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">{portalEmp.name}</div>
              <div className="text-xs text-slate-500">{portalEmp.position} · {portalEmp.department}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${portalEmp.isShiftEmployee ? 'bg-herme-soft text-herme-dark' : 'bg-slate-100 text-slate-600'}`}>
              {portalEmp.isShiftEmployee ? portalEmp.shiftType || 'Shift Employee' : 'Non-Shift Employee'}
            </span>
            <button onClick={doLogout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 lg:p-6 space-y-6 w-full min-w-0 max-w-none">
          {toast && (
            <div className="fixed top-6 right-6 z-50 bg-emerald-700 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
              <Check className="w-4 h-4" /> {toast}
            </div>
          )}

          {/* Leave Balance Cards */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Leave Balances — {new Date().getFullYear()} Operating Year</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {([
                { key: 'AL', label: 'Annual Leave', value: balance?.alBalance ?? 0, total: 20, color: 'herme' },
                { key: 'RDO', label: 'Rest Day Off', value: balance?.rdoBalance ?? 0, total: 5, color: 'violet' },
                { key: 'RPH', label: 'Rest Public Holiday', value: balance?.rphBalance ?? 0, total: 3, color: 'orange' },
                { key: 'UPL', label: 'Unpaid Leave', value: null as number | null, total: null as number | null, color: 'slate' },
              ]).map(({ key, label, value, total, color }) => {
                const pct = value !== null && total ? Math.round((value / total) * 100) : null;
                const colorMap: Record<string, { bg: string; bar: string; num: string; badge: string }> = {
                  herme: { bg: 'bg-herme-light', bar: 'bg-herme', num: 'text-herme-dark', badge: 'bg-herme-soft text-herme-dark' },
                  violet: { bg: 'bg-violet-50', bar: 'bg-violet-500', num: 'text-violet-700', badge: 'bg-violet-100 text-violet-700' },
                  orange: { bg: 'bg-orange-50', bar: 'bg-orange-500', num: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
                  slate: { bg: 'bg-slate-50', bar: 'bg-slate-400', num: 'text-slate-600', badge: 'bg-slate-100 text-slate-600' },
                };
                const c = colorMap[color];
                return (
                  <div key={key} className={`${c.bg} rounded-2xl p-5 border border-white shadow-sm`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{key}</div>
                        <div className="text-sm font-semibold text-slate-700 mt-0.5">{label}</div>
                      </div>
                      {value !== null ? (
                        <div className={`text-2xl font-bold ${c.num}`}>{value}<span className="text-sm font-normal text-slate-400">/{total}</span></div>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${c.badge}`}>Unlimited</span>
                      )}
                    </div>
                    {pct !== null ? (
                      <div className="mt-3">
                        <div className="h-1.5 bg-white rounded-full overflow-hidden">
                          <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-slate-400 mt-1.5">{value} days remaining</div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 mt-3">No deduction from pay</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-800">{periodLabel()}</h3>
                <div className="flex items-center gap-1">
                  <button onClick={prevPeriod} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={nextPeriod} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCalView('monthly')} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${calView === 'monthly' ? 'bg-herme-dark text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Monthly</button>
                <button onClick={() => setCalView('weekly')} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${calView === 'weekly' ? 'bg-herme-dark text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Weekly</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50">
              {[
                { color: 'bg-white border border-slate-200', label: 'Work Day' },
                { color: 'bg-slate-100', label: 'Day Off / Weekend' },
                { color: 'bg-amber-100 border border-amber-200', label: 'Public Holiday' },
                { color: 'bg-emerald-100 border border-emerald-200', label: 'Approved Leave' },
                { color: 'bg-yellow-100 border border-yellow-200', label: 'Pending Leave' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${color}`} />
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded ring-2 ring-herme bg-white" />
                <span className="text-xs text-slate-500">Selected Range</span>
              </div>
            </div>

            {selStart ? (
              <div className="px-6 py-2 bg-herme-light border-b border-herme-muted flex items-center justify-between">
                <div className="text-xs text-herme-dark">
                  <span className="font-semibold">Selected:</span> {formatSelDisplay()}
                  {!selEnd && ' — click another date to complete range'}
                </div>
                <button onClick={() => { setSelStart(null); setSelEnd(null); }} className="text-xs text-herme hover:text-herme-dark">Clear</button>
              </div>
            ) : (
              <div className="px-6 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-xs text-slate-400">Click a date to start selection, click again to set end date and apply for leave.</p>
              </div>
            )}

            <div className="grid grid-cols-7 border-b border-slate-100">
              {DOW_LABELS.map(d => (
                <div key={d} className="py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {calView === 'monthly' && (
              <div className="grid grid-cols-7">
                {monthCells.map((cell, idx) => {
                  if (!cell) return <div key={idx} className="aspect-[1/1.1] p-1 border-r border-b border-slate-100 bg-slate-50/50" />;
                  const dateStr = fmt(cell);
                  const info = getDayInfo(dateStr, portalEmp);
                  const inRange = isInRange(dateStr);
                  const edge = isEdge(dateStr);
                  const isToday = dateStr === TODAY;
                  return (
                    <div key={idx} className="aspect-[1/1.1] p-1 border-r border-b border-slate-100"
                      onMouseEnter={() => selStart && !selEnd && setHoverDate(dateStr)}
                      onMouseLeave={() => setHoverDate(null)}
                    >
                      <div onClick={() => handleDayClick(dateStr)} className={dayBg(info.type, inRange, edge, isToday) + 'h-full p-2'}>
                        <span className={`text-sm font-semibold ${isToday ? 'text-herme-dark' : dayLabel(info.type)}`}>{cell.getDate()}</span>
                        {info.type === 'public-holiday' && <span className="block text-xs leading-tight text-amber-700 mt-0.5 truncate">{info.label}</span>}
                        {(info.type === 'leave-approved' || info.type === 'leave-pending') && (
                          <span className={`inline-block mt-1 text-xs px-1 py-0.5 rounded font-semibold ${info.type === 'leave-approved' ? 'bg-emerald-200 text-emerald-800' : 'bg-yellow-200 text-yellow-800'}`}>{info.label}</span>
                        )}
                        {info.type === 'work' && portalEmp.isShiftEmployee && info.label !== 'Work Day' && (
                          <span className="block text-xs text-slate-400 mt-0.5 truncate">{info.label}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {calView === 'weekly' && (
              <div className="grid grid-cols-7 divide-x divide-slate-100">
                {weekCells.map((cell) => {
                  const dateStr = fmt(cell);
                  const info = getDayInfo(dateStr, portalEmp);
                  const inRange = isInRange(dateStr);
                  const edge = isEdge(dateStr);
                  const isToday = dateStr === TODAY;
                  const isCurrentMonth = cell.getMonth() === calMonth;
                  return (
                    <div key={dateStr} className="min-h-[200px] p-3" style={{ backgroundColor: !isCurrentMonth ? '#f8fafc' : undefined }}
                      onMouseEnter={() => selStart && !selEnd && setHoverDate(dateStr)}
                      onMouseLeave={() => setHoverDate(null)}
                    >
                      <div onClick={() => handleDayClick(dateStr)} className={`${dayBg(info.type, inRange, edge, isToday)} p-3 h-full cursor-pointer`}>
                        <div className="flex flex-col items-center mb-3">
                          <span className="text-xs font-semibold text-slate-400 uppercase">{DOW_LABELS[cell.getDay()]}</span>
                          <span className={`text-2xl font-bold mt-0.5 ${isToday ? 'text-herme-dark' : dayLabel(info.type)}`}>{cell.getDate()}</span>
                        </div>
                        <div className="space-y-1">
                          {info.type === 'public-holiday' && (
                            <div className="bg-amber-100 border border-amber-200 rounded-lg px-2 py-1">
                              <div className="text-xs font-semibold text-amber-800">Public Holiday</div>
                              <div className="text-xs text-amber-700 leading-tight mt-0.5">{info.label}</div>
                            </div>
                          )}
                          {info.type === 'work' && (
                            <div className="bg-herme-light border border-herme-muted rounded-lg px-2 py-1">
                              <div className="text-xs font-semibold text-herme-dark">Work Day</div>
                              {portalEmp.isShiftEmployee && info.label !== 'Work Day' && <div className="text-xs text-herme mt-0.5">{info.label}</div>}
                            </div>
                          )}
                          {info.type === 'do' && <div className="bg-slate-100 rounded-lg px-2 py-1"><div className="text-xs font-semibold text-slate-500">Day Off</div></div>}
                          {info.type === 'weekend' && <div className="bg-slate-50 rounded-lg px-2 py-1"><div className="text-xs font-semibold text-slate-400">Weekend</div></div>}
                          {info.type === 'leave-approved' && (
                            <div className="bg-emerald-100 border border-emerald-200 rounded-lg px-2 py-1">
                              <div className="text-xs font-semibold text-emerald-800">Approved Leave</div>
                              <div className="text-xs text-emerald-700">{info.label}</div>
                            </div>
                          )}
                          {info.type === 'leave-pending' && (
                            <div className="bg-yellow-100 border border-yellow-200 rounded-lg px-2 py-1">
                              <div className="text-xs font-semibold text-yellow-800">Pending Leave</div>
                              <div className="text-xs text-yellow-700">{info.label}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selStart && selEnd && !showLeaveModal && (
              <div className="px-6 py-4 border-t border-slate-100 bg-herme-light flex items-center justify-between">
                <div className="text-sm text-herme-darker"><span className="font-semibold">Leave period:</span> {formatSelDisplay()}</div>
                <button onClick={() => setShowLeaveModal(true)} className="flex items-center gap-2 bg-herme-dark hover:bg-herme-darker text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                  <FileText className="w-4 h-4" /> Apply for Leave
                </button>
              </div>
            )}
          </div>

          {/* My Leave Requests */}
          {empLeaveRequests.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">My Leave Requests</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {empLeaveRequests.slice().reverse().map(lr => (
                  <div key={lr.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        lr.type === 'AL' ? 'bg-herme-soft text-herme-dark' :
                        lr.type === 'RDO' ? 'bg-violet-100 text-violet-700' :
                        lr.type === 'RPH' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{lr.type}</span>
                      <div>
                        <div className="text-sm text-slate-700 font-medium">
                          {lr.startDate === lr.endDate ? lr.startDate : `${lr.startDate} → ${lr.endDate}`}
                        </div>
                        {lr.reason && <div className="text-xs text-slate-400 mt-0.5">{lr.reason}</div>}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      lr.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                      lr.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{lr.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Leave Application Modal */}
        {showLeaveModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-slate-800">Apply for Leave</h3>
                <button onClick={() => setShowLeaveModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 mb-5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Selected Period</div>
                <div className="text-sm font-semibold text-slate-800">{formatSelDisplay()}</div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'AL' as LeaveType, label: 'Annual Leave', avail: balance?.alBalance },
                    { key: 'RDO' as LeaveType, label: 'Rest Day Off', avail: balance?.rdoBalance },
                    { key: 'RPH' as LeaveType, label: 'Rest Public Holiday', avail: balance?.rphBalance },
                    { key: 'UPL' as LeaveType, label: 'Unpaid Leave', avail: null },
                  ]).map(({ key, label, avail }) => (
                    <button
                      key={key}
                      onClick={() => setLeaveType(key)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${leaveType === key ? 'border-herme bg-herme-light text-herme-darker' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}
                    >
                      <div className="font-semibold text-xs">{key}</div>
                      <div className="text-xs text-slate-500 leading-tight mt-0.5">{label}</div>
                      {avail != null && <div className={`text-xs mt-1 font-semibold ${leaveType === key ? 'text-herme' : 'text-slate-400'}`}>{avail} days left</div>}
                      {avail === null && <div className="text-xs mt-1 text-slate-400">Unlimited</div>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Reason <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                <textarea
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="Briefly describe the reason for leave..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme focus:border-transparent placeholder:text-slate-300 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLeaveModal(false)} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-xl py-3 text-sm transition-colors">Cancel</button>
                <button onClick={handleSubmitLeave} disabled={submitting} className="flex-1 bg-herme-dark hover:bg-herme-darker disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> {submitting ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
