import { useEffect, useRef, useState } from 'react';
import {
  Camera, Check, CheckSquare, ChevronLeft, ChevronRight, Eye, EyeOff, FileText,
  Lock, LogOut, MessageSquare, ScanLine, Send, Square, UserCheck, X,
} from 'lucide-react';
import { hrApi } from './api';
import type {
  AttendanceRecord, Employee, LeaveBalanceRow, LeaveRequest, LeaveType, PublicHoliday, ShiftSchedule,
} from './types';

interface TeamPortalProps {
  employees: Employee[];
  leaveBalances: LeaveBalanceRow[];
  leaveRequests: LeaveRequest[];
  shiftSchedules: ShiftSchedule[];
  publicHolidays: PublicHoliday[];
  onSubmitLeave: (leave: {
    employeeId: number;
    type: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string;
  }) => Promise<void>;
}

type DayInfo = { type: string; label: string };

type TeamTodo = { id: string; text: string; done: boolean };
type TeamMessage = { id: string; from: string; body: string; at: string; read: boolean };

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const STANDARD_PW = 'Pass@123';
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const QR_RE = /^([^/]+)\/(\d{4}-\d{2}-\d{2})\/(\d{2}:\d{2})$/;

function todosKey(employeeId: number) {
  return `bisync-team-todos-${employeeId}`;
}
function messagesKey(employeeId: number) {
  return `bisync-team-messages-${employeeId}`;
}

function loadTodos(employeeId: number): TeamTodo[] {
  try {
    const raw = localStorage.getItem(todosKey(employeeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TeamTodo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodos(employeeId: number, todos: TeamTodo[]) {
  localStorage.setItem(todosKey(employeeId), JSON.stringify(todos));
}

function loadMessages(employeeId: number, employeeName: string): TeamMessage[] {
  try {
    const raw = localStorage.getItem(messagesKey(employeeId));
    if (raw) {
      const parsed = JSON.parse(raw) as TeamMessage[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* seed below */
  }
  const seeded: TeamMessage[] = [
    {
      id: 'seed-1',
      from: 'HR Desk',
      body: `Welcome to Team, ${employeeName.split(' ')[0]}. Check in by scanning the POS QR when you start your shift.`,
      at: new Date().toISOString(),
      read: false,
    },
    {
      id: 'seed-2',
      from: 'Operations',
      body: 'Please confirm your leave balance before submitting any new leave request this month.',
      at: new Date(Date.now() - 86_400_000).toISOString(),
      read: false,
    },
  ];
  localStorage.setItem(messagesKey(employeeId), JSON.stringify(seeded));
  return seeded;
}

function saveMessages(employeeId: number, messages: TeamMessage[]) {
  localStorage.setItem(messagesKey(employeeId), JSON.stringify(messages));
}

function parsePosQr(payload: string): { outletInitial: string; date: string; time: string } | null {
  const m = QR_RE.exec(payload.trim());
  if (!m) return null;
  return { outletInitial: m[1], date: m[2], time: m[3] };
}

function timeOnly(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm;
}

export default function TeamPortal({
  employees, leaveBalances, leaveRequests, shiftSchedules, publicHolidays, onSubmitLeave,
}: TeamPortalProps) {
  const [step, setStep] = useState<'select' | 'login' | 'change-password' | 'dashboard'>('select');
  const [teamEmp, setTeamEmp] = useState<Employee | null>(null);
  const [pwChanged, setPwChanged] = useState<Set<number>>(new Set());
  const [loginPw, setLoginPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [authError, setAuthError] = useState('');

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('AL');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveStart, setLeaveStart] = useState(fmt(new Date()));
  const [leaveEnd, setLeaveEnd] = useState(fmt(new Date()));

  const [todos, setTodos] = useState<TeamTodo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [messageTab, setMessageTab] = useState<'todo' | 'inbox'>('todo');

  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState('');
  const [manualQr, setManualQr] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const TODAY = fmt(new Date());
  const balance = teamEmp ? leaveBalances.find(b => b.employeeId === teamEmp.id) : undefined;
  const carryForward = balance?.alCarryForward ?? 0;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2800);
  };

  const doLogin = () => {
    if (!teamEmp) return;
    const isFirst = !pwChanged.has(teamEmp.id);
    if (isFirst) {
      if (loginPw === STANDARD_PW) { setAuthError(''); setLoginPw(''); setStep('change-password'); }
      else setAuthError('Incorrect password. Hint: standard password is Pass@123');
    } else if (loginPw.length >= 8) {
      setAuthError(''); setLoginPw(''); setStep('dashboard');
    } else {
      setAuthError('Invalid password.');
    }
  };

  const doChangePassword = () => {
    if (newPw.length < 8) { setAuthError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setAuthError('Passwords do not match.'); return; }
    if (newPw === STANDARD_PW) { setAuthError('New password cannot match the standard password.'); return; }
    setPwChanged(prev => new Set([...prev, teamEmp!.id]));
    setNewPw(''); setConfirmPw(''); setAuthError('');
    setStep('dashboard');
  };

  const doLogout = () => {
    stopScanner();
    setStep('select');
    setTeamEmp(null);
    setShowLeaveModal(false);
    setShowScanner(false);
  };

  useEffect(() => {
    if (step !== 'dashboard' || !teamEmp) return;
    setTodos(loadTodos(teamEmp.id));
    setMessages(loadMessages(teamEmp.id, teamEmp.name));
    void hrApi.attendance.list(TODAY, TODAY, teamEmp.id)
      .then(rows => setTodayAttendance(rows[0] ?? null))
      .catch(() => setTodayAttendance(null));
  }, [step, teamEmp, TODAY]);

  const getDayInfo = (dateStr: string, emp: Employee): DayInfo => {
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay();
    const ph = publicHolidays.find(h => h.date === dateStr && h.isRecognized);
    if (ph) return { type: 'public-holiday', label: ph.name };
    const approved = leaveRequests.find(lr =>
      lr.employeeId === emp.id && lr.status === 'Approved' && dateStr >= lr.startDate && dateStr <= lr.endDate,
    );
    if (approved) return { type: 'leave-approved', label: approved.type };
    const pending = leaveRequests.find(lr =>
      lr.employeeId === emp.id && lr.status === 'Pending' && dateStr >= lr.startDate && dateStr <= lr.endDate,
    );
    if (pending) return { type: 'leave-pending', label: pending.type };
    if (emp.isShiftEmployee) {
      const sched = shiftSchedules.find(s => s.employeeId === emp.id && s.date === dateStr);
      if (sched) {
        if (sched.type === 'Work') {
          const start = sched.startTime?.slice(0, 5) ?? '';
          const end = sched.endTime?.slice(0, 5) ?? '';
          return { type: 'work', label: start && end ? `${start}–${end}` : 'Work Day' };
        }
        if (sched.type === 'DO' || sched.type === 'RDO') return { type: 'do', label: sched.type };
        return { type: 'leave-approved', label: sched.type };
      }
      return { type: 'unscheduled', label: 'No schedule' };
    }
    if (dow === 0 || dow === 6) return { type: 'weekend', label: 'Weekend' };
    return { type: 'work', label: 'Work Day' };
  };

  const getMonthCells = () => {
    const first = new Date(calYear, calMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const todayInfo = teamEmp ? getDayInfo(TODAY, teamEmp) : null;
  const checkedIn = Boolean(todayAttendance?.actualIn);
  const checkedOut = Boolean(todayAttendance?.actualOut);
  const checkLabel = !checkedIn ? 'Check In' : checkedOut ? 'Checked Out' : 'Check Out';

  const stopScanner = () => {
    if (scanTimerRef.current != null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const applyQrCheck = async (payload: string) => {
    if (!teamEmp || checkBusy) return;
    const parsed = parsePosQr(payload);
    if (!parsed) {
      setScanError('Invalid POS QR. Expected outlet/yyyy-mm-dd/HH:mm');
      return;
    }
    if (parsed.date !== TODAY) {
      setScanError(`QR date ${parsed.date} does not match today (${TODAY}).`);
      return;
    }

    setCheckBusy(true);
    setScanError('');
    try {
      const sched = shiftSchedules.find(s => s.employeeId === teamEmp.id && s.date === TODAY && s.type === 'Work');
      const scheduledIn = sched?.startTime ? timeOnly(sched.startTime.slice(0, 5)) : null;
      const scheduledOut = sched?.endTime ? timeOnly(sched.endTime.slice(0, 5)) : null;
      const stamp = timeOnly(parsed.time);
      let rows = await hrApi.attendance.list(TODAY, TODAY, teamEmp.id);
      let record = rows[0] ?? null;

      if (!record || !record.actualIn) {
        if (record) {
          record = await hrApi.attendance.update(record.id, {
            employeeId: teamEmp.id,
            date: TODAY,
            status: 'Present',
            scheduledIn: record.scheduledIn ?? scheduledIn,
            scheduledOut: record.scheduledOut ?? scheduledOut,
            actualIn: stamp,
            actualOut: record.actualOut ?? null,
          });
        } else {
          record = await hrApi.attendance.create({
            employeeId: teamEmp.id,
            date: TODAY,
            status: 'Present',
            scheduledIn,
            scheduledOut,
            actualIn: stamp,
            actualOut: null,
          });
        }
        setTodayAttendance(record);
        showToast(`Checked in at ${parsed.time} · ${parsed.outletInitial}`);
      } else if (!record.actualOut) {
        record = await hrApi.attendance.update(record.id, {
          employeeId: teamEmp.id,
          date: TODAY,
          status: 'Present',
          scheduledIn: record.scheduledIn ?? scheduledIn,
          scheduledOut: record.scheduledOut ?? scheduledOut,
          actualIn: record.actualIn,
          actualOut: stamp,
        });
        setTodayAttendance(record);
        showToast(`Checked out at ${parsed.time} · ${parsed.outletInitial}`);
      } else {
        setScanError('Already checked in and out for today.');
        setCheckBusy(false);
        return;
      }

      stopScanner();
      setShowScanner(false);
      setManualQr('');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not record attendance');
    } finally {
      setCheckBusy(false);
    }
  };

  const startScanner = async () => {
    setScanError('');
    setShowScanner(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      const Detector = (window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
        };
      }).BarcodeDetector;

      if (!Detector) {
        setScanError('Camera ready. This browser has no QR detector — paste the POS QR text below.');
        return;
      }

      const detector = new Detector({ formats: ['qr_code'] });
      scanTimerRef.current = window.setInterval(async () => {
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;
        try {
          const codes = await detector.detect(v);
          const value = codes.find(c => c.rawValue)?.rawValue;
          if (value) await applyQrCheck(value);
        } catch {
          /* keep scanning */
        }
      }, 500);
    } catch {
      setScanError('Camera permission denied. Paste the POS QR text below to check in/out.');
    }
  };

  useEffect(() => () => stopScanner(), []);

  const addTodo = () => {
    if (!teamEmp) return;
    const text = newTodo.trim();
    if (!text) return;
    const next = [...todos, { id: `${Date.now()}`, text, done: false }];
    setTodos(next);
    saveTodos(teamEmp.id, next);
    setNewTodo('');
  };

  const toggleTodo = (id: string) => {
    if (!teamEmp) return;
    const next = todos.map(t => (t.id === id ? { ...t, done: !t.done } : t));
    setTodos(next);
    saveTodos(teamEmp.id, next);
  };

  const removeTodo = (id: string) => {
    if (!teamEmp) return;
    const next = todos.filter(t => t.id !== id);
    setTodos(next);
    saveTodos(teamEmp.id, next);
  };

  const markMessageRead = (id: string) => {
    if (!teamEmp) return;
    const next = messages.map(m => (m.id === id ? { ...m, read: true } : m));
    setMessages(next);
    saveMessages(teamEmp.id, next);
  };

  const handleSubmitLeave = async () => {
    if (!teamEmp || submitting) return;
    if (leaveEnd < leaveStart) {
      showToast('End date must be on or after start date.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitLeave({
        employeeId: teamEmp.id,
        type: leaveType,
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: leaveReason.trim() || undefined,
      });
      setShowLeaveModal(false);
      setLeaveReason('');
      showToast('Leave request submitted.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit leave');
    } finally {
      setSubmitting(false);
    }
  };

  const dayBg = (type: string, isToday: boolean) => {
    const ring = isToday ? 'ring-2 ring-herme ' : '';
    switch (type) {
      case 'public-holiday': return `${ring}bg-amber-50 border border-amber-200 `;
      case 'leave-approved': return `${ring}bg-emerald-50 border border-emerald-200 `;
      case 'leave-pending': return `${ring}bg-yellow-50 border border-yellow-200 `;
      case 'do':
      case 'weekend': return `${ring}bg-slate-100 border border-slate-200 `;
      case 'unscheduled': return `${ring}bg-slate-50 border border-dashed border-slate-200 `;
      default: return `${ring}bg-white border border-slate-100 `;
    }
  };

  // ── SELECT ──
  if (step === 'select') {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-herme-cream flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-none">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-herme-dark rounded-2xl mb-5 shadow-lg">
              <UserCheck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Team</h2>
            <p className="text-slate-500 mt-2 text-sm">Schedule, messages, check-in, and leave — select your account</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => { setTeamEmp(emp); setLoginPw(''); setAuthError(''); setStep('login'); }}
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
  if (step === 'login' && teamEmp) {
    const isFirst = !pwChanged.has(teamEmp.id);
    return (
      <div className="min-h-[calc(100vh-200px)] bg-herme-cream flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm p-8">
          <button onClick={() => setStep('select')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-6 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to accounts
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-herme-dark text-white rounded-xl flex items-center justify-center font-bold text-sm">{initials(teamEmp.name)}</div>
            <div>
              <div className="font-semibold text-slate-800">{teamEmp.name}</div>
              <div className="text-xs text-slate-500">{teamEmp.email}</div>
            </div>
          </div>
          {isFirst && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <div className="text-xs font-semibold text-amber-800">First-time Login</div>
              <div className="text-xs text-amber-700 mt-0.5">Use your standard password. You will be asked to set a new password.</div>
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
  if (step === 'change-password' && teamEmp) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-herme-cream flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-sm p-8">
          <div className="flex items-center justify-center w-12 h-12 bg-herme-soft rounded-xl mb-5 mx-auto">
            <Lock className="w-6 h-6 text-herme-dark" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 text-center mb-1">Set Your Password</h3>
          <p className="text-xs text-slate-500 text-center mb-6">Choose a secure password to protect your Team account.</p>
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
  if (step === 'dashboard' && teamEmp && todayInfo) {
    const monthCells = getMonthCells();
    const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
    const unread = messages.filter(m => !m.read).length;
    const openTodos = todos.filter(t => !t.done).length;

    return (
      <div className="bg-herme-cream min-h-[calc(100vh-200px)]">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-herme-dark text-white rounded-xl flex items-center justify-center font-bold text-sm">{initials(teamEmp.name)}</div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">{teamEmp.name}</div>
              <div className="text-xs text-slate-500">{teamEmp.position} · {teamEmp.department}</div>
            </div>
          </div>
          <button onClick={doLogout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>

        <div className="p-4 sm:p-5 lg:p-6 space-y-6 w-full min-w-0 max-w-none">
          {toast && (
            <div className="fixed top-6 right-6 z-50 bg-emerald-700 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
              <Check className="w-4 h-4" /> {toast}
            </div>
          )}

          {/* Actions + leave */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Outstanding Leave — {new Date().getFullYear()}</div>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">Annual Leave</span>
                  <span className="text-2xl font-bold text-herme-dark">
                    {balance?.alBalance ?? 0}
                    {carryForward > 0 && (
                      <span className="text-base font-semibold text-slate-400"> ({carryForward})</span>
                    )}
                  </span>
                </div>
                {carryForward > 0 && (
                  <p className="text-xs text-slate-400">Bracket = carry-forward from previous year</p>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">RDO</span>
                  <span className="font-semibold text-slate-700">{balance?.rdoBalance ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">RPH</span>
                  <span className="font-semibold text-slate-700">{balance?.rphBalance ?? 0}</span>
                </div>
              </div>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-herme-dark hover:bg-herme-darker text-white text-sm font-semibold px-4 py-3 rounded-xl transition-colors"
              >
                <FileText className="w-4 h-4" /> Leave Request
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Check In / Out</div>
                  <p className="text-sm text-slate-600">Scan the QR code shown on the POS Check In/Out screen.</p>
                </div>
                <button
                  onClick={() => { void startScanner(); }}
                  disabled={checkedIn && checkedOut}
                  className="flex items-center gap-2 bg-herme-dark hover:bg-herme-darker disabled:opacity-50 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors"
                >
                  <Camera className="w-4 h-4" /> {checkLabel}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Status</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">
                    {!checkedIn ? 'Not checked in' : checkedOut ? 'Shift complete' : 'On duty'}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Actual In</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">{todayAttendance?.actualIn?.slice(0, 5) || '—'}</div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Actual Out</div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">{todayAttendance?.actualOut?.slice(0, 5) || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Today's schedule */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Today&apos;s Schedule</div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-lg font-semibold text-slate-800">
                {new Date(TODAY + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl ${
                todayInfo.type === 'work' ? 'bg-herme-soft text-herme-dark' :
                todayInfo.type === 'public-holiday' ? 'bg-amber-100 text-amber-800' :
                todayInfo.type.startsWith('leave') ? 'bg-emerald-100 text-emerald-800' :
                'bg-slate-100 text-slate-600'
              }`}>
                {todayInfo.label}
              </span>
            </div>
          </div>

          {/* Month schedule + message box */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Current Month Schedule</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 font-medium">{monthLabel}</span>
                  <button
                    onClick={() => {
                      if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
                      else setCalMonth(m => m - 1);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
                      else setCalMonth(m => m + 1);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 border-b border-slate-100">
                {DOW_LABELS.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((cell, idx) => {
                  if (!cell) return <div key={idx} className="min-h-[72px] p-1 border-r border-b border-slate-100 bg-slate-50/50" />;
                  const dateStr = fmt(cell);
                  const info = getDayInfo(dateStr, teamEmp);
                  const isToday = dateStr === TODAY;
                  return (
                    <div key={idx} className="min-h-[72px] p-1 border-r border-b border-slate-100">
                      <div className={`${dayBg(info.type, isToday)} h-full rounded-lg p-1.5`}>
                        <span className={`text-xs font-semibold ${isToday ? 'text-herme-dark' : 'text-slate-700'}`}>{cell.getDate()}</span>
                        <span className="block text-[10px] leading-tight text-slate-500 mt-0.5 truncate">{info.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-herme" /> Message Box
                </h3>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                  <button
                    onClick={() => setMessageTab('todo')}
                    className={`px-3 py-1.5 font-medium ${messageTab === 'todo' ? 'bg-herme-dark text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    To Do {openTodos > 0 ? `(${openTodos})` : ''}
                  </button>
                  <button
                    onClick={() => setMessageTab('inbox')}
                    className={`px-3 py-1.5 font-medium ${messageTab === 'inbox' ? 'bg-herme-dark text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Messages {unread > 0 ? `(${unread})` : ''}
                  </button>
                </div>
              </div>

              {messageTab === 'todo' ? (
                <div className="flex flex-col flex-1 p-4 gap-3">
                  <div className="flex gap-2">
                    <input
                      value={newTodo}
                      onChange={e => setNewTodo(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTodo()}
                      placeholder="Add a to-do for today…"
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme"
                    />
                    <button onClick={addTodo} className="px-3 py-2 rounded-xl bg-herme-dark text-white text-sm font-semibold hover:bg-herme-darker">
                      Add
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto space-y-2">
                    {todos.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-8">No to-dos yet for today.</p>
                    )}
                    {todos.map(t => (
                      <div key={t.id} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                        <button onClick={() => toggleTodo(t.id)} className="mt-0.5 text-herme-dark">
                          {t.done ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                        <span className={`flex-1 text-sm ${t.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{t.text}</span>
                        <button onClick={() => removeTodo(t.id)} className="text-slate-300 hover:text-slate-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-auto divide-y divide-slate-100">
                  {messages.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-8">No messages from others.</p>
                  )}
                  {messages.map(m => (
                    <button
                      key={m.id}
                      onClick={() => markMessageRead(m.id)}
                      className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors ${m.read ? '' : 'bg-herme-light/40'}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-800">{m.from}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(m.at).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{m.body}</p>
                      {!m.read && <span className="inline-block mt-2 text-[10px] font-semibold text-herme">Unread</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leave modal */}
        {showLeaveModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-slate-800">Leave Request</h3>
                <button onClick={() => setShowLeaveModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Start</label>
                  <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">End</label>
                  <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme" />
                </div>
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
                      {avail != null && (
                        <div className={`text-xs mt-1 font-semibold ${leaveType === key ? 'text-herme' : 'text-slate-400'}`}>
                          {avail} days
                          {key === 'AL' && carryForward > 0 ? ` (${carryForward})` : ''}
                        </div>
                      )}
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
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLeaveModal(false)} className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium rounded-xl py-3 text-sm">Cancel</button>
                <button onClick={() => void handleSubmitLeave()} disabled={submitting} className="flex-1 bg-herme-dark hover:bg-herme-darker disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QR scanner modal */}
        {showScanner && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-herme" /> Scan POS QR — {checkLabel}
                </h3>
                <button
                  onClick={() => { stopScanner(); setShowScanner(false); setScanError(''); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3] mb-4">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-xl" />
              </div>
              {scanError && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{scanError}</p>
              )}
              <div className="flex gap-2">
                <input
                  value={manualQr}
                  onChange={e => setManualQr(e.target.value)}
                  placeholder="Or paste QR text: OUTLET/yyyy-mm-dd/HH:mm"
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-herme"
                />
                <button
                  disabled={checkBusy || !manualQr.trim()}
                  onClick={() => void applyQrCheck(manualQr)}
                  className="px-4 py-2.5 rounded-xl bg-herme-dark text-white text-sm font-semibold disabled:opacity-50 hover:bg-herme-darker"
                >
                  {checkBusy ? '…' : 'Use'}
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
