import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  MessageSquare,
  Package,
  Send,
  ShoppingCart,
  Square,
  Umbrella,
  X,
} from 'lucide-react';
import { hrApi } from './api';
import type {
  AttendanceRecord, Employee, LeaveBalanceRow, LeaveRequest, LeaveType, PublicHoliday, ShiftSchedule,
} from './types';
import {
  assertPlatformCredential,
  canShowBiometricLogin,
  clearBiometricEnrollment,
  createPlatformCredential,
  isWebAuthnPlatformAvailable,
  loadBiometricEnrollment,
  saveBiometricEnrollment,
} from './teamBiometric';
import {
  clearPinEnrollment,
  isValidPin,
  loadPinEnrollment,
  savePinEnrollment,
  unlockPinPayload,
} from './teamPin';
import { punchHrAttendance } from './attendancePunch';
import { resolveOfficeHoursForDate } from '../../data/companyBusinessHours';
import { TeamHomeLanding, type TeamAppMode, type HrTab, type RmsTab } from './TeamHomeLanding';
import './TeamPortal.css';

interface TeamPortalProps {
  employees: Employee[];
  leaveBalances: LeaveBalanceRow[];
  leaveRequests: LeaveRequest[];
  shiftSchedules: ShiftSchedule[];
  publicHolidays: PublicHoliday[];
  /** Company office hours for admin / non-shift attendance. */
  businessHoursJson?: string | null;
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

type LoginMode = 'password' | 'pin';
type PortalStep = 'login' | 'change-password' | 'app' | 'settings';

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const STANDARD_PW = 'Pass@123';
const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const QR_RE = /^([^/]+)\/(\d{4}-\d{2}-\d{2})\/(\d{2}:\d{2})$/;

function employeeLoginUsername(emp: Employee) {
  return (emp.email || emp.mobile || emp.employeeCode || emp.name).trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase();
}

function findEmployee(employees: Employee[], identity: string): Employee | null {
  const key = normalizeIdentity(identity);
  if (!key) return null;
  const byEmail = employees.find(e => normalizeIdentity(e.email) === key);
  if (byEmail) return byEmail;
  const digits = digitsOnly(identity);
  if (digits.length >= 7) {
    const byMobile = employees.find(e => digitsOnly(e.mobile).endsWith(digits) || digits.endsWith(digitsOnly(e.mobile)));
    if (byMobile) return byMobile;
  }
  return employees.find(e => normalizeIdentity(e.employeeCode) === key) ?? null;
}

function todosKey(employeeId: number) {
  return `bisync-team-todos-${employeeId}`;
}
function messagesKey(employeeId: number) {
  return `bisync-team-messages-${employeeId}`;
}
function pwChangedKey(employeeId: number) {
  return `bisync-team-pw-changed-${employeeId}`;
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
    /* seed */
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

function clockNowLabel(d = new Date()) {
  return d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function TeamPortal({
  employees, leaveBalances, leaveRequests, shiftSchedules, publicHolidays, businessHoursJson = null, onSubmitLeave,
}: TeamPortalProps) {
  const enrolledPin = loadPinEnrollment();
  const [step, setStep] = useState<PortalStep>('login');
  const [teamEmp, setTeamEmp] = useState<Employee | null>(null);
  const [loginMode, setLoginMode] = useState<LoginMode>(() => (enrolledPin ? 'pin' : 'password'));
  const [identity, setIdentity] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [biometricReady, setBiometricReady] = useState(() => canShowBiometricLogin());

  const [settingsPin, setSettingsPin] = useState('');
  const [settingsPinConfirm, setSettingsPinConfirm] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);

  const [appMode, setAppMode] = useState<TeamAppMode>('landing');
  const [hrTab, setHrTab] = useState<HrTab>('home');
  const [rmsTab, setRmsTab] = useState<RmsTab>('home');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nowLabel, setNowLabel] = useState(() => clockNowLabel());

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

  useEffect(() => {
    const id = window.setInterval(() => setNowLabel(clockNowLabel()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setBiometricReady(canShowBiometricLogin());
  }, [step]);

  const hasChangedPw = (empId: number) => localStorage.getItem(pwChangedKey(empId)) === '1';

  const enterApp = (emp: Employee) => {
    setTeamEmp(emp);
    setLoginPw('');
    setLoginPin('');
    setAuthError('');
    setStep('app');
    setAppMode('landing');
    setHrTab('home');
    setRmsTab('home');
  };

  const doLogin = async (e?: FormEvent) => {
    e?.preventDefault();
    setAuthError('');
    if (loginMode === 'pin') {
      await doPinLogin();
      return;
    }
    const emp = findEmployee(employees, identity);
    if (!emp) {
      setAuthError('No employee found for that email or mobile.');
      return;
    }
    if (!loginPw) {
      setAuthError('Password is required.');
      return;
    }
    setSubmittingAuth(true);
    try {
      setTeamEmp(emp);
      if (!hasChangedPw(emp.id)) {
        if (loginPw === STANDARD_PW) {
          setLoginPw('');
          setStep('change-password');
        } else {
          setAuthError('Incorrect password. First login uses Pass@123');
          setTeamEmp(null);
        }
      } else if (loginPw.length >= 8) {
        enterApp(emp);
      } else {
        setAuthError('Invalid password.');
        setTeamEmp(null);
      }
    } finally {
      setSubmittingAuth(false);
    }
  };

  const doPinLogin = async () => {
    setAuthError('');
    if (!loadPinEnrollment()) {
      setAuthError('No PIN on this device yet. Sign in with password, then set a PIN from your name on the top bar.');
      return;
    }
    if (!isValidPin(loginPin)) {
      setAuthError('Enter your 4-digit PIN');
      return;
    }
    setSubmittingAuth(true);
    try {
      const payload = await unlockPinPayload(loginPin);
      const emp = employees.find(e => e.id === payload.employeeId) ?? findEmployee(employees, payload.username);
      if (!emp) {
        setAuthError('Employee linked to this PIN is no longer available.');
        return;
      }
      // Keep server POS PIN in sync with Team mobile PIN (for POS unlock on other devices).
      void hrApi.employees.setPosPin(emp.id, loginPin).catch(() => { /* best-effort */ });
      enterApp(emp);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'PIN login failed');
      setLoginPin('');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const doBiometricLogin = async () => {
    setAuthError('');
    const enrollment = loadBiometricEnrollment();
    if (!enrollment) {
      setAuthError('Biometric login is not set up on this device.');
      return;
    }
    setSubmittingAuth(true);
    try {
      await assertPlatformCredential(enrollment.credentialId);
      const emp = employees.find(e => e.id === enrollment.employeeId)
        ?? findEmployee(employees, enrollment.username);
      if (!emp) {
        setAuthError('Employee linked to biometrics is no longer available.');
        return;
      }
      enterApp(emp);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Biometric login failed');
      setBiometricReady(canShowBiometricLogin());
    } finally {
      setSubmittingAuth(false);
    }
  };

  const doChangePassword = (e?: FormEvent) => {
    e?.preventDefault();
    if (!teamEmp) return;
    if (newPw.length < 8) { setAuthError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setAuthError('Passwords do not match.'); return; }
    if (newPw === STANDARD_PW) { setAuthError('New password cannot match the standard password.'); return; }
    localStorage.setItem(pwChangedKey(teamEmp.id), '1');
    setNewPw(''); setConfirmPw(''); setAuthError('');
    enterApp(teamEmp);
  };

  const openSettings = () => {
    setSettingsPin('');
    setSettingsPinConfirm('');
    setSettingsError('');
    setStep('settings');
  };

  const saveTeamPin = async () => {
    if (!teamEmp) return;
    setSettingsError('');
    if (!isValidPin(settingsPin)) {
      setSettingsError('PIN must be exactly 4 digits.');
      return;
    }
    if (settingsPin !== settingsPinConfirm) {
      setSettingsError('PIN confirmation does not match.');
      return;
    }
    setSettingsBusy(true);
    try {
      await savePinEnrollment(settingsPin, {
        kind: 'team-session',
        username: employeeLoginUsername(teamEmp),
        employeeId: teamEmp.id,
        name: teamEmp.name,
      });
      try {
        await hrApi.employees.setPosPin(teamEmp.id, settingsPin);
      } catch {
        /* local PIN still works for Team; POS API sync is best-effort */
      }
      setSettingsPin('');
      setSettingsPinConfirm('');
      showToast('PIN saved. On POS, enter this PIN under Staff PIN after QR check-in to unlock the floor.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not save PIN');
    } finally {
      setSettingsBusy(false);
    }
  };

  const removeTeamPin = () => {
    clearPinEnrollment();
    setSettingsPin('');
    setSettingsPinConfirm('');
    setSettingsError('');
    showToast('PIN login turned off on this device.');
  };

  const enableTeamBiometric = async () => {
    if (!teamEmp) return;
    setSettingsError('');
    if (!isWebAuthnPlatformAvailable()) {
      setSettingsError('Biometrics are not supported in this browser (needs HTTPS + platform authenticator).');
      return;
    }
    setSettingsBusy(true);
    try {
      const username = employeeLoginUsername(teamEmp);
      const credentialId = await createPlatformCredential(username);
      saveBiometricEnrollment({
        username,
        employeeId: teamEmp.id,
        credentialId,
      });
      setBiometricReady(true);
      showToast('Biometric login enabled on this device.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Biometric enrollment failed');
    } finally {
      setSettingsBusy(false);
    }
  };

  const disableTeamBiometric = () => {
    clearBiometricEnrollment();
    setBiometricReady(false);
    setSettingsError('');
    showToast('Biometric login turned off on this device.');
  };

  const doLogout = () => {
    stopScanner();
    setStep('login');
    setTeamEmp(null);
    setShowLeaveModal(false);
    setShowScanner(false);
    setLoginPw('');
    setLoginPin('');
    setAuthError('');
    setLoginMode(loadPinEnrollment() ? 'pin' : 'password');
    setBiometricReady(canShowBiometricLogin());
    setAppMode('landing');
    setHrTab('home');
    setRmsTab('home');
  };

  useEffect(() => {
    if (step !== 'app' || !teamEmp) return;
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
          return { type: 'work', label: start && end ? `${start}–${end}` : 'Work' };
        }
        if (sched.type === 'DO' || sched.type === 'RDO') return { type: 'do', label: sched.type };
        return { type: 'leave-approved', label: sched.type };
      }
      return { type: 'unscheduled', label: '—' };
    }
    const office = resolveOfficeHoursForDate(businessHoursJson, dateStr);
    if (office) {
      if (office.closed) return { type: 'weekend', label: 'Off' };
      if (office.openFrom && office.openTo) {
        return { type: 'work', label: `${office.openFrom}–${office.openTo}` };
      }
      return { type: 'work', label: 'Work' };
    }
    if (dow === 0 || dow === 6) return { type: 'weekend', label: 'Off' };
    return { type: 'work', label: 'Work' };
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
  // Multiple in/out cycles allowed (lunch / meetings / coffee): after an out, next action is check-in again.
  const checkLabel = !checkedIn || checkedOut ? 'Check In' : 'Check Out';

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
      const { record, action } = await punchHrAttendance({
        employeeId: teamEmp.id,
        date: TODAY,
        timeHhMm: parsed.time,
        shiftSchedules,
        isShiftEmployee: teamEmp.isShiftEmployee,
        businessHoursJson,
      });
      setTodayAttendance(record);
      showToast(
        action === 'check-in'
          ? `Checked in at ${parsed.time} · HR attendance recorded`
          : `Checked out at ${parsed.time} · HR attendance recorded`,
      );

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
        setScanError('Camera ready. Paste the POS QR text below if this browser cannot scan QR.');
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
      setScanError('Camera permission denied. Paste the POS QR text below.');
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

  // ── LOGIN LANDING ──
  if (step === 'login') {
    const pinAvailable = Boolean(loadPinEnrollment());
    return (
      <div className="team-app">
        <div className="team-login">
          <div className="team-login-ambient" aria-hidden>
            <span className="team-login-orb team-login-orb-a" />
            <span className="team-login-orb team-login-orb-b" />
            <span className="team-login-orb team-login-orb-c" />
            <span className="team-login-grain" />
          </div>
          <div className="team-login-inner">
            <header className="team-login-brand">
              <img src="/bisync-logo.png" alt="Bisync" />
              <p>Time clock & attendance</p>
            </header>
            <form className="team-login-panel" onSubmit={e => void doLogin(e)} noValidate>
              <div className="team-login-panel-head">
                <h1>Sign in</h1>
                <p className="team-muted">
                  {loginMode === 'pin'
                    ? 'Enter the 4-digit PIN set up under your name in Team'
                    : 'Sign in with your work email or mobile number from HR'}
                </p>
              </div>

              <div className="team-login-mode-tabs" role="tablist" aria-label="Sign-in method">
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'password'}
                  className={loginMode === 'password' ? 'team-login-mode-tab is-active' : 'team-login-mode-tab'}
                  disabled={submittingAuth}
                  onClick={() => {
                    setLoginMode('password');
                    setAuthError('');
                    setLoginPin('');
                  }}
                >
                  Password
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginMode === 'pin'}
                  className={loginMode === 'pin' ? 'team-login-mode-tab is-active' : 'team-login-mode-tab'}
                  disabled={submittingAuth}
                  onClick={() => {
                    setLoginMode('pin');
                    setAuthError('');
                    setLoginPw('');
                  }}
                >
                  PIN number
                </button>
              </div>

              {loginMode === 'password' ? (
                <>
                  <label className="team-field">
                    <span>Email or mobile</span>
                    <input
                      type="text"
                      inputMode="email"
                      autoComplete="username"
                      placeholder="email or 0123456789"
                      value={identity}
                      onChange={e => setIdentity(e.target.value)}
                      required
                    />
                  </label>
                  <label className="team-field">
                    <span>Password</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={loginPw}
                      onChange={e => setLoginPw(e.target.value)}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  {pinAvailable ? (
                    <label className="team-field">
                      <span>Account</span>
                      <input type="text" value={loadPinEnrollment()?.username || ''} readOnly autoComplete="username" />
                    </label>
                  ) : null}
                  <label className="team-field">
                    <span>PIN number (4 digits)</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      autoComplete="one-time-code"
                      placeholder="••••"
                      className="team-login-pin-input"
                      value={loginPin}
                      onChange={e => setLoginPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      disabled={!pinAvailable}
                      required={pinAvailable}
                    />
                  </label>
                  <p className="team-muted team-login-pin-hint">
                    {pinAvailable
                      ? 'Change your PIN anytime by tapping your name on the title bar.'
                      : 'No PIN on this device yet. Sign in with password, then tap your name on the title bar to set a PIN.'}
                  </p>
                </>
              )}

              {authError ? <p className="team-error">{authError}</p> : null}

              <button
                className="team-btn team-btn-primary"
                type="submit"
                disabled={submittingAuth || (loginMode === 'pin' && !pinAvailable)}
              >
                {submittingAuth
                  ? 'Signing in…'
                  : loginMode === 'pin'
                    ? 'Sign in with PIN'
                    : 'Sign in'}
              </button>

              {loginMode === 'password' ? (
                <button
                  type="button"
                  className="team-btn team-btn-secondary"
                  disabled={submittingAuth}
                  onClick={() => {
                    setLoginMode('pin');
                    setAuthError('');
                    setLoginPw('');
                  }}
                >
                  Login with PIN number
                </button>
              ) : (
                <button
                  type="button"
                  className="team-btn team-btn-secondary"
                  disabled={submittingAuth}
                  onClick={() => {
                    setLoginMode('password');
                    setAuthError('');
                    setLoginPin('');
                  }}
                >
                  Use password instead
                </button>
              )}

              {biometricReady && loginMode === 'password' ? (
                <button
                  type="button"
                  className="team-btn team-btn-secondary team-login-biometric-btn"
                  disabled={submittingAuth}
                  onClick={() => void doBiometricLogin()}
                >
                  <span className="team-login-biometric-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3Z" />
                      <path d="M7 20v-1a5 5 0 0 1 10 0v1" />
                      <path d="M5.5 9.5a7.5 7.5 0 0 1 13 0" />
                      <path d="M3.5 8a10 10 0 0 1 17 0" />
                    </svg>
                  </span>
                  Biometric login
                </button>
              ) : null}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── CHANGE PASSWORD ──
  if (step === 'change-password' && teamEmp) {
    return (
      <div className="team-app">
        <div className="team-login">
          <div className="team-login-ambient" aria-hidden>
            <span className="team-login-orb team-login-orb-a" />
            <span className="team-login-orb team-login-orb-b" />
            <span className="team-login-grain" />
          </div>
          <div className="team-login-inner">
            <header className="team-login-brand">
              <img src="/bisync-logo.png" alt="Bisync" />
              <p>Set a secure password for {teamEmp.name.split(' ')[0]}</p>
            </header>
            <form className="team-login-panel" onSubmit={doChangePassword} noValidate>
              <h1>Set password</h1>
              <p className="team-muted">First-time login — choose a new password (min. 8 characters).</p>
              <label className="team-field">
                <span>New password</span>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required />
              </label>
              <label className="team-field">
                <span>Confirm password</span>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
              </label>
              {authError ? <p className="team-error">{authError}</p> : null}
              <button className="team-btn team-btn-primary" type="submit">Set password & continue</button>
              <button type="button" className="team-btn team-btn-secondary" onClick={doLogout}>Back to sign in</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── SETTINGS (via topbar name) ──
  if (step === 'settings' && teamEmp) {
    const pinOn = Boolean(loadPinEnrollment());
    const bioEnrollment = loadBiometricEnrollment();
    const bioOn = Boolean(bioEnrollment && bioEnrollment.employeeId === teamEmp.id);
    return (
      <div className="team-app">
        {toast ? <div className="team-toast">{toast}</div> : null}
        <div className="team-shell">
          <header className="team-topbar">
            <img className="team-brand" src="/bisync-logo-white.png" alt="Bisync" />
            <div className="team-topbar-meta">
              <strong>{teamEmp.name}</strong>
              <span>Account settings</span>
            </div>
            <button type="button" className="team-topbar-logout" onClick={() => setStep('app')}>
              Back
            </button>
          </header>
          <main className="team-main">
            <section className="team-card">
              <h3>PIN number</h3>
              <p className="team-muted" style={{ margin: '0 0 10px' }}>
                {pinOn
                  ? `PIN is set for ${loadPinEnrollment()?.username}. Enter a new 4-digit PIN to change it.`
                  : 'Set a 4-digit PIN to unlock Team and the POS register when it locks.'}
              </p>
              <label className="team-field">
                <span>{pinOn ? 'New PIN' : 'PIN (4 digits)'}</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className="team-login-pin-input"
                  value={settingsPin}
                  onChange={e => setSettingsPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                />
              </label>
              <label className="team-field" style={{ marginTop: 8 }}>
                <span>Confirm PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className="team-login-pin-input"
                  value={settingsPinConfirm}
                  onChange={e => setSettingsPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                />
              </label>
              {settingsError ? <p className="team-error" style={{ marginTop: 8 }}>{settingsError}</p> : null}
              <button
                type="button"
                className="team-btn team-btn-primary"
                style={{ marginTop: 10 }}
                disabled={settingsBusy}
                onClick={() => void saveTeamPin()}
              >
                {settingsBusy ? 'Saving…' : pinOn ? 'Update PIN' : 'Set PIN number'}
              </button>
              {pinOn ? (
                <button
                  type="button"
                  className="team-btn team-btn-secondary"
                  style={{ marginTop: 8 }}
                  disabled={settingsBusy}
                  onClick={removeTeamPin}
                >
                  Turn off PIN login
                </button>
              ) : null}
            </section>

            <section className="team-card">
              <h3>Biometric login</h3>
              <p className="team-muted" style={{ margin: '0 0 10px' }}>
                Use Face ID, fingerprint, or Windows Hello to open Team on this device.
              </p>
              {bioOn ? (
                <button
                  type="button"
                  className="team-btn team-btn-secondary"
                  disabled={settingsBusy}
                  onClick={disableTeamBiometric}
                >
                  Turn off biometric login
                </button>
              ) : (
                <button
                  type="button"
                  className="team-btn team-btn-primary"
                  disabled={settingsBusy || !isWebAuthnPlatformAvailable()}
                  onClick={() => void enableTeamBiometric()}
                >
                  {settingsBusy ? 'Waiting…' : 'Enable biometric login'}
                </button>
              )}
              {!isWebAuthnPlatformAvailable() ? (
                <p className="team-muted" style={{ margin: '8px 0 0', fontSize: 10 }}>
                  Biometrics need HTTPS and a platform authenticator.
                </p>
              ) : null}
            </section>
          </main>
        </div>
      </div>
    );
  }

  // ── MOBILE APP SHELL ──
  if (step === 'app' && teamEmp && todayInfo) {
    const monthCells = getMonthCells();
    const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
    const unread = messages.filter(m => !m.read).length;
    const openTodos = todos.filter(t => !t.done).length;

    return (
      <div className="team-app">
        {toast ? <div className="team-toast">{toast}</div> : null}

        <div className="team-shell">
          <header className="team-topbar">
            <img className="team-brand" src="/bisync-logo-white.png" alt="Bisync" />
            <button type="button" className="team-topbar-meta team-topbar-meta-btn" onClick={openSettings}>
              <strong>{teamEmp.name}</strong>
              <span>{teamEmp.position} · {teamEmp.department}</span>
            </button>
            <button type="button" className="team-topbar-logout" onClick={doLogout}>
              <LogOut size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
              Out
            </button>
          </header>

          <main className="team-main">
            {todayInfo ? (
              <TeamHomeLanding
                mode={appMode}
                onModeChange={(mode) => {
                  setAppMode(mode);
                  if (mode === 'hr') setHrTab('home');
                  if (mode === 'rms') setRmsTab('home');
                }}
                hrTab={hrTab}
                onHrTabChange={setHrTab}
                rmsTab={rmsTab}
                onRmsTabChange={setRmsTab}
                employee={teamEmp}
                todayLabel={new Date(`${TODAY}T00:00:00`).toLocaleDateString('en-MY', {
                  weekday: 'long', day: 'numeric', month: 'short',
                })}
                todayInfo={todayInfo}
                todayAttendance={todayAttendance}
                nowLabel={nowLabel}
                checkLabel={checkLabel}
                checkBusy={checkBusy}
                onStartScanner={() => void startScanner()}
                leaveBalance={balance}
                carryForward={carryForward}
                leaveRequests={leaveRequests}
                announcements={messages}
                onOpenSchedule={() => {
                  setAppMode('hr');
                  setHrTab('schedule');
                }}
                onOpenMessages={() => {
                  setAppMode('hr');
                  setMessageTab('inbox');
                  setHrTab('messages');
                }}
                onOpenLeave={() => {
                  setAppMode('hr');
                  setHrTab('leave');
                }}
                onMarkAnnouncementRead={markMessageRead}
                scheduleSlot={(
                  <section className="team-card">
                    <div className="team-panel-head">
                      <button
                        type="button"
                        className="team-back-btn"
                        onClick={() => setAppMode('landing')}
                      >
                        <ChevronLeft size={16} />
                        Team home
                      </button>
                    </div>
                    <div className="team-month-head">
                      <h3>Month schedule</h3>
                      <div className="team-month-nav">
                        <button
                          type="button"
                          aria-label="Previous month"
                          onClick={() => {
                            if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
                            else setCalMonth(m => m - 1);
                          }}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Next month"
                          onClick={() => {
                            if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
                            else setCalMonth(m => m + 1);
                          }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="team-muted" style={{ margin: '0 0 8px', fontWeight: 700 }}>{monthLabel}</p>
                    <div className="team-month-dows">
                      {DOW_LABELS.map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
                    </div>
                    <div className="team-month-grid">
                      {monthCells.map((cell, idx) => {
                        if (!cell) return <div key={idx} className="team-month-cell is-empty" />;
                        const dateStr = fmt(cell);
                        const info = getDayInfo(dateStr, teamEmp);
                        const isToday = dateStr === TODAY;
                        return (
                          <div key={idx} className={`team-month-cell${isToday ? ' is-today' : ''}`}>
                            <span className="day">{cell.getDate()}</span>
                            <span className="shift">{info.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
                leaveSlot={(
                  <section className="team-card">
                    <div className="team-panel-head">
                      <button
                        type="button"
                        className="team-back-btn"
                        onClick={() => setAppMode('landing')}
                      >
                        <ChevronLeft size={16} />
                        Team home
                      </button>
                    </div>
                    <h3>Outstanding leave — {new Date().getFullYear()}</h3>
                    <div className="team-leave-row">
                      <span>Annual leave</span>
                      <strong>
                        {balance?.alBalance ?? 0}
                        {carryForward > 0 ? <em> ({carryForward})</em> : null}
                      </strong>
                    </div>
                    {carryForward > 0 ? (
                      <p className="team-muted" style={{ margin: '0 0 6px', fontSize: 10 }}>Bracket = carry-forward from previous year</p>
                    ) : null}
                    <div className="team-leave-row">
                      <span>RDO</span>
                      <strong style={{ fontSize: 15 }}>{balance?.rdoBalance ?? 0}</strong>
                    </div>
                    <div className="team-leave-row">
                      <span>RPH</span>
                      <strong style={{ fontSize: 15 }}>{balance?.rphBalance ?? 0}</strong>
                    </div>
                    <button
                      type="button"
                      className="team-btn team-btn-primary"
                      style={{ marginTop: 12 }}
                      onClick={() => setShowLeaveModal(true)}
                    >
                      Leave request
                    </button>
                  </section>
                )}
                messagesSlot={(
                  <section className="team-card">
                    <div className="team-panel-head">
                      <button
                        type="button"
                        className="team-back-btn"
                        onClick={() => {
                          setHrTab('home');
                        }}
                      >
                        <ChevronLeft size={16} />
                        HR home
                      </button>
                    </div>
                    <h3>Message box</h3>
                    <div className="team-msg-tabs">
                      <button type="button" className={messageTab === 'todo' ? 'is-active' : ''} onClick={() => setMessageTab('todo')}>
                        To Do{openTodos > 0 ? ` (${openTodos})` : ''}
                      </button>
                      <button type="button" className={messageTab === 'inbox' ? 'is-active' : ''} onClick={() => setMessageTab('inbox')}>
                        Messages{unread > 0 ? ` (${unread})` : ''}
                      </button>
                    </div>
                    {messageTab === 'todo' ? (
                      <>
                        <div className="team-add-row">
                          <input
                            value={newTodo}
                            onChange={e => setNewTodo(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTodo()}
                            placeholder="Add a to-do for today…"
                          />
                          <button type="button" className="team-btn team-btn-primary" style={{ width: 'auto' }} onClick={addTodo}>Add</button>
                        </div>
                        {todos.length === 0 ? (
                          <p className="team-muted" style={{ margin: '12px 0 0', textAlign: 'center' }}>No to-dos yet.</p>
                        ) : todos.map(t => (
                          <div key={t.id} className={`team-todo-row${t.done ? ' is-done' : ''}`}>
                            <button type="button" className="team-btn-ghost" onClick={() => toggleTodo(t.id)} aria-label="Toggle">
                              {t.done ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                            <span style={{ flex: 1 }}>{t.text}</span>
                            <button type="button" className="team-btn-ghost" onClick={() => removeTodo(t.id)} aria-label="Remove">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </>
                    ) : (
                      messages.length === 0 ? (
                        <p className="team-muted" style={{ margin: '12px 0 0', textAlign: 'center' }}>No messages.</p>
                      ) : messages.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          className="team-inbox-row"
                          style={{ width: '100%', background: m.read ? 'transparent' : 'color-mix(in srgb, var(--team-primary-soft) 55%, transparent)', border: 0, textAlign: 'left', cursor: 'pointer' }}
                          onClick={() => markMessageRead(m.id)}
                        >
                          <MessageSquare size={14} style={{ marginTop: 2, color: 'var(--team-primary)' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <strong style={{ fontSize: 12 }}>{m.from}</strong>
                              <span className="team-muted" style={{ fontSize: 10 }}>
                                {new Date(m.at).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--team-muted-fg)' }}>{m.body}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </section>
                )}
              />
            ) : null}
          </main>

          {appMode === 'hr' ? (
            <nav className="team-bottom-nav" aria-label="HR">
              <button
                type="button"
                className={hrTab === 'home' ? 'is-active' : ''}
                onClick={() => setHrTab('home')}
              >
                <Home />
                <span>Home</span>
              </button>
              <button
                type="button"
                className={hrTab === 'schedule' ? 'is-active' : ''}
                onClick={() => setHrTab('schedule')}
              >
                <CalendarDays />
                <span>Schedule</span>
              </button>
              <button
                type="button"
                className={hrTab === 'leave' ? 'is-active' : ''}
                onClick={() => setHrTab('leave')}
              >
                <Umbrella />
                <span>Leave Request</span>
              </button>
            </nav>
          ) : null}

          {appMode === 'rms' ? (
            <nav className="team-bottom-nav" aria-label="Revenue Management">
              <button
                type="button"
                className={rmsTab === 'home' ? 'is-active' : ''}
                onClick={() => setRmsTab('home')}
              >
                <Home />
                <span>New Home</span>
              </button>
              <button
                type="button"
                className={rmsTab === 'order' ? 'is-active' : ''}
                onClick={() => setRmsTab('order')}
              >
                <ShoppingCart />
                <span>Order</span>
              </button>
              <button
                type="button"
                className={rmsTab === 'stock' ? 'is-active' : ''}
                onClick={() => setRmsTab('stock')}
              >
                <Package />
                <span>STOCK</span>
              </button>
            </nav>
          ) : null}
        </div>

        {showLeaveModal ? (
          <div className="team-modal-backdrop" role="presentation" onClick={() => setShowLeaveModal(false)}>
            <div className="team-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
              <h3>Leave request</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <label className="team-field">
                  <span>Start</span>
                  <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                </label>
                <label className="team-field">
                  <span>End</span>
                  <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                </label>
              </div>
              <p className="team-muted" style={{ margin: '0 0 6px', fontWeight: 700 }}>Leave type</p>
              <div className="team-type-grid">
                {([
                  { key: 'AL' as LeaveType, label: 'Annual', avail: balance?.alBalance },
                  { key: 'RDO' as LeaveType, label: 'RDO', avail: balance?.rdoBalance },
                  { key: 'RPH' as LeaveType, label: 'RPH', avail: balance?.rphBalance },
                  { key: 'UPL' as LeaveType, label: 'Unpaid', avail: null },
                ]).map(({ key, label, avail }) => (
                  <button
                    key={key}
                    type="button"
                    className={leaveType === key ? 'is-active' : ''}
                    onClick={() => setLeaveType(key)}
                  >
                    <div style={{ fontWeight: 800, fontSize: 11 }}>{key}</div>
                    <div className="team-muted" style={{ fontSize: 10 }}>{label}</div>
                    {avail != null ? (
                      <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>
                        {avail}{key === 'AL' && carryForward > 0 ? ` (${carryForward})` : ''}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
              <label className="team-field" style={{ marginTop: 10 }}>
                <span>Reason (optional)</span>
                <textarea
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  rows={3}
                  style={{ width: '100%', border: '1px solid var(--team-border)', borderRadius: 8, padding: 8, resize: 'none' }}
                />
              </label>
              <div className="team-modal-actions">
                <button type="button" className="team-btn team-btn-secondary" onClick={() => setShowLeaveModal(false)}>Cancel</button>
                <button type="button" className="team-btn team-btn-primary" disabled={submitting} onClick={() => void handleSubmitLeave()}>
                  <Send size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                  {submitting ? '…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showScanner ? (
          <div className="team-modal-backdrop" role="presentation">
            <div className="team-modal" role="dialog" aria-modal="true">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Scan POS QR — {checkLabel}</h3>
                <button
                  type="button"
                  className="team-btn-ghost"
                  onClick={() => { stopScanner(); setShowScanner(false); setScanError(''); }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <video ref={videoRef} playsInline muted className="team-scanner-video" />
              {scanError ? <p className="team-error" style={{ marginTop: 8 }}>{scanError}</p> : null}
              <div className="team-add-row" style={{ marginTop: 10 }}>
                <input
                  value={manualQr}
                  onChange={e => setManualQr(e.target.value)}
                  placeholder="Or paste: OUTLET/yyyy-mm-dd/HH:mm"
                />
                <button
                  type="button"
                  className="team-btn team-btn-primary"
                  style={{ width: 'auto' }}
                  disabled={checkBusy || !manualQr.trim()}
                  onClick={() => void applyQrCheck(manualQr)}
                >
                  Use
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
