import {
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  Clock3,
  CreditCard,
  FileText,
  Fingerprint,
  LogOut,
  LucideIcon,
  Mail,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Role = "admin" | "employee";
type View = "employees" | "attendance" | "leaves" | "profile" | "payroll" | "reports";

type User = {
  id: number;
  role: Role;
  employeeId?: string;
  email: string;
  mustChangePassword: boolean;
};

type Employee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  title: string;
  department: string;
  location: string;
  manager: string;
  joined: string;
  wage: number;
  avatar: string;
  profilePhotoUrl: string;
  accountVerified: boolean | null;
  mustChangePassword: boolean | null;
  skills: string[];
};

type Attendance = {
  id: number;
  employee_id: string;
  name: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  status: "Present" | "Absent" | "Half-day" | "Leave";
  work_hours: number;
  extra_hours: number;
  note: string;
};

type LeaveRequest = {
  id: number;
  employee_id: string;
  name: string;
  type: "Paid" | "Sick" | "Unpaid";
  start_date: string;
  end_date: string;
  days: number;
  remarks: string;
  status: "Pending" | "Approved" | "Rejected";
  admin_comment: string;
  attachment_file_name: string;
  attachment_url: string;
};

type LeaveBalance = {
  employeeId: string;
  type: "Paid" | "Sick" | "Unpaid";
  entitlement: number;
  approved: number;
  pending: number;
  remaining: number;
};

type SalaryComponent = {
  label: string;
  percent: number;
  amount: number;
};

type PayrollSlip = {
  employeeId: string;
  name: string;
  month: string;
  salary: number;
  workingDays: number;
  presentDays: number;
  halfDays: number;
  leaveDays: number;
  absentDays: number;
  payableDays: number;
  unpaidDays: number;
  totalHours: number;
  extraHours: number;
  extraPay: number;
  deduction: number;
  grossPay: number;
  netPay: number;
  components: SalaryComponent[];
};

type EmployeeCredentials = { id: string; emailed: boolean };
type UploadFile = { type: string; fileName: string; mimeType: string; dataUrl: string };
type JobProfile = { id: string; title: string; department: string; skills: string[] };
type EmployeeDocument = {
  id: number;
  employee_id: string;
  name: string;
  type: string;
  file_name: string;
  mime_type: string;
  file_url: string;
  status: "Pending" | "Approved" | "Rejected";
  admin_comment: string;
  uploaded_at: string;
};

const navItems = [
  ["employees", "Employees", UsersRound],
  ["attendance", "Attendance", CalendarCheck],
  ["leaves", "Time Off", Clock3],
  ["profile", "Profile", UserRound],
  ["payroll", "Payroll", CreditCard],
  ["reports", "Reports", BarChart3],
] as const;

function currency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function App() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [active, setActive] = useState<View>("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [payroll, setPayroll] = useState<PayrollSlip[]>([]);
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [credentials, setCredentials] = useState<EmployeeCredentials | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [notice, setNotice] = useState("");

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function loadWorkspace(authToken = token) {
    const headers = { Authorization: `Bearer ${authToken}` };
    const [employeeRows, attendanceRows, leaveRows, leaveBalanceRows, payrollRows, jobProfileRows, documentRows] = await Promise.all([
      fetch("/api/employees", { headers }).then((r) => r.json()),
      fetch("/api/attendance", { headers }).then((r) => r.json()),
      fetch("/api/leaves", { headers }).then((r) => r.json()),
      fetch("/api/leave-balances", { headers }).then((r) => r.json()),
      fetch("/api/payroll", { headers }).then((r) => r.json()),
      fetch("/api/job-profiles", { headers }).then((r) => r.json()),
      fetch("/api/documents", { headers }).then((r) => r.json()),
    ]);
    setEmployees(employeeRows);
    setAttendance(attendanceRows);
    setLeaves(leaveRows);
    setLeaveBalances(leaveBalanceRows);
    setPayroll(payrollRows);
    setJobProfiles(jobProfileRows);
    setDocuments(documentRows);
    setSelectedEmployeeId((current) => current || employeeRows[0]?.id || "");
  }

  async function startSession(nextToken: string, nextUser: User) {
    setToken(nextToken);
    setUser(nextUser);
    setActive(nextUser.role === "admin" ? "employees" : "profile");
    await loadWorkspace(nextToken);
  }

  function logout() {
    setToken("");
    setUser(null);
    setEmployees([]);
    setAttendance([]);
    setLeaves([]);
    setLeaveBalances([]);
    setPayroll([]);
    setJobProfiles([]);
    setDocuments([]);
    setSelectedEmployeeId("");
    setNotice("");
  }

  async function createEmployee(input: EmployeeForm) {
    const result = await api<{ employee: Employee; credentials: EmployeeCredentials }>("/api/employees", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setCredentials(result.credentials);
    setNotice("Employee account created and login instructions were emailed.");
    await loadWorkspace();
  }

  async function decideDocument(id: number, status: "Approved" | "Rejected", adminComment: string) {
    await api(`/api/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, adminComment }),
    });
    setNotice(`Document ${status.toLowerCase()}.`);
    await loadWorkspace();
  }

  async function updateEmployee(employeeId: string, input: EmployeeUpdateForm) {
    await api<{ employee: Employee }>(`/api/employees/${employeeId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    setNotice("Employee profile updated.");
    await loadWorkspace();
  }

  async function completePasswordChange(password: string) {
    const result = await api<{ token: string; user: User }>("/api/auth/password/change", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    await startSession(result.token, result.user);
    setNotice("Password updated. Your account is ready.");
  }

  async function markAttendance(employeeId?: string, action: "in" | "out" = "in") {
    await api("/api/attendance/check", {
      method: "POST",
      body: JSON.stringify({ employeeId, action }),
    });
    setNotice("Attendance updated.");
    await loadWorkspace();
  }

  async function markManualAttendance(input: ManualAttendanceForm) {
    await api("/api/attendance/manual", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setNotice("Attendance record saved.");
    await loadWorkspace();
  }

  async function createLeave(input: LeaveForm) {
    await api("/api/leaves", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setNotice("Leave request submitted.");
    await loadWorkspace();
  }

  async function decideLeave(id: number, status: "Approved" | "Rejected", adminComment: string) {
    await api(`/api/leaves/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, adminComment }),
    });
    setNotice(`Leave ${status.toLowerCase()}.`);
    await loadWorkspace();
  }

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || employees[0];
  const summary = useMemo(() => {
    const present = attendance.filter((row) => row.status === "Present").length;
    const pending = leaves.filter((row) => row.status === "Pending").length;
    const totalPayroll = employees.reduce((sum, employee) => sum + employee.wage, 0);
    return { present, pending, totalPayroll };
  }, [attendance, employees, leaves]);

  if (!user) return <AuthScreen onSession={startSession} />;
  if (user.mustChangePassword) return <PasswordChangeScreen email={user.email} onChange={completePasswordChange} onLogout={logout} />;

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">D</div>
          <div>
            <strong>Dayflow</strong>
            <span>Human Resource Management System</span>
          </div>
        </div>
        <div className="session">
          <span>{user.role === "admin" ? "Admin / HR Officer" : "Employee"}</span>
          <strong>{user.email}</strong>
        </div>
        <nav>
          {navItems
            .filter(([id]) => user.role === "admin" || id !== "employees")
            .map(([id, label, Icon]) => (
              <button className={active === id ? "active" : ""} key={id} onClick={() => setActive(id)}>
                <Icon size={18} />
                {label}
              </button>
            ))}
        </nav>
        <button className="logout" onClick={logout}>
          <LogOut size={18} />
          Log out
        </button>
      </aside>

      <section className="workspace">
        <header className="page-head">
          <div>
            <p>{user.role === "admin" ? "Admin workspace" : "Employee self service"}</p>
            <h1>{titleFor(active, user.role)}</h1>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        <section className="metrics">
          <Metric label="Employees" value={String(employees.length)} />
          <Metric label="Present Records" value={String(summary.present)} />
          <Metric label="Pending Leaves" value={String(summary.pending)} />
          <Metric label="Monthly Payroll" value={currency(summary.totalPayroll)} />
        </section>

        {active === "employees" && user.role === "admin" && (
          <EmployeesView
            employees={employees}
            credentials={credentials}
            jobProfiles={jobProfiles}
            documents={documents}
            onCreate={createEmployee}
            onSelect={(employeeId) => {
              setSelectedEmployeeId(employeeId);
              setActive("profile");
            }}
            onDocumentDecision={decideDocument}
          />
        )}
        {active === "attendance" && (
          <AttendanceView
            role={user.role}
            employees={employees}
            rows={attendance}
            onCheck={markAttendance}
            onManual={markManualAttendance}
          />
        )}
        {active === "leaves" && (
          <LeavesView role={user.role} employees={employees} rows={leaves} balances={leaveBalances} onCreate={createLeave} onDecision={decideLeave} />
        )}
        {active === "profile" && selectedEmployee && (
          <ProfileView
            employee={selectedEmployee}
            role={user.role}
            employees={employees}
            jobProfiles={jobProfiles}
            documents={documents}
            onUpdate={updateEmployee}
            onDocumentDecision={decideDocument}
          />
        )}
        {active === "payroll" && <PayrollView role={user.role} rows={payroll} employees={employees} employee={selectedEmployee} token={token} />}
        {active === "reports" && <ReportsView employees={employees} attendance={attendance} leaves={leaves} />}
      </section>
    </main>
  );
}

function titleFor(view: View, role: Role) {
  if (view === "employees") return "Employee management";
  if (view === "attendance") return role === "admin" ? "Attendance records" : "My attendance";
  if (view === "leaves") return role === "admin" ? "Leave approvals" : "My leave requests";
  if (view === "payroll") return role === "admin" ? "Payroll control" : "My salary";
  if (view === "reports") return "Reports dashboard";
  return "My profile";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AuthScreen({ onSession }: { onSession: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<"admin" | "employee" | "signup" | "forgot">("admin");
  const [signupRole, setSignupRole] = useState<Role>("employee");
  const [identifier, setIdentifier] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function resetAuthFlow(nextMode = mode) {
    setMode(nextMode);
    setChallengeId("");
    setOtp("");
    setError("");
    setBusy(false);
  }

  async function login() {
    if (busy || challengeId) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || "Unable to sign in.");
      if (data.requiresOtp) {
        setChallengeId(data.challengeId);
        return;
      }
      onSession(data.token, data.user);
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmployeeOtp() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/verify-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, otp }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || "OTP verification failed.");
      onSession(data.token, data.user);
    } finally {
      setBusy(false);
    }
  }

  async function requestSignupOtp() {
    if (busy || challengeId) return;
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/signup/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: signupRole, employeeId, name, email: identifier, password }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || "Unable to send OTP.");
      setChallengeId(data.challengeId);
    } finally {
      setBusy(false);
    }
  }

  async function verifySignupOtp() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, otp }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || "OTP verification failed.");
      onSession(data.token, data.user);
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordResetOtp() {
    if (busy || challengeId) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || "Unable to send reset OTP.");
      setChallengeId(data.challengeId);
    } finally {
      setBusy(false);
    }
  }

  async function verifyPasswordResetOtp() {
    if (busy) return;
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password/verify-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, otp, password }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || "Password reset failed.");
      onSession(data.token, data.user);
    } finally {
      setBusy(false);
    }
  }

  const needsOtp = Boolean(challengeId);
  return (
    <main className="auth">
      <section className="auth-copy">
        <div className="brand">
          <div className="mark">D</div>
          <div>
            <strong>Dayflow</strong>
            <span>Every workday, perfectly aligned.</span>
          </div>
        </div>
        <h1>Human Resource Management System</h1>
        <p>Secure role-based HRMS for onboarding, profiles, attendance, time off, and payroll.</p>
      </section>
      <section className="auth-panel">
        <div className="tabs">
          <button className={mode === "admin" ? "active" : ""} onClick={() => resetAuthFlow("admin")}>
            Admin Login
          </button>
          <button className={mode === "employee" ? "active" : ""} onClick={() => resetAuthFlow("employee")}>
            Employee Login
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => resetAuthFlow("signup")}>
            Sign Up
          </button>
        </div>

        {mode === "signup" && (
          <div className="role-select">
            <button className={signupRole === "employee" ? "active" : ""} onClick={() => { setSignupRole("employee"); setChallengeId(""); }}>
              <UserRound size={16} /> Employee
            </button>
            <button className={signupRole === "admin" ? "active" : ""} onClick={() => { setSignupRole("admin"); setChallengeId(""); }}>
              <BriefcaseBusiness size={16} /> Admin / HR
            </button>
          </div>
        )}
        {mode === "signup" && signupRole === "admin" && <Field label="Full Name" icon={UserRound} value={name} onChange={setName} />}
        {mode === "signup" && signupRole === "employee" && (
          <Field label="Employee ID" icon={Fingerprint} value={employeeId} onChange={(value) => setEmployeeId(value.toUpperCase())} />
        )}
        <Field label={mode === "employee" || mode === "forgot" ? "Employee ID or Email" : "Email"} icon={Mail} value={identifier} onChange={setIdentifier} />
        {mode !== "forgot" || needsOtp ? <Field label={mode === "forgot" ? "New Password" : "Password"} icon={ShieldCheck} value={password} onChange={setPassword} type="password" /> : null}
        {(mode === "signup" || (mode === "forgot" && needsOtp)) && <Field label="Confirm Password" icon={ShieldCheck} value={confirmPassword} onChange={setConfirmPassword} type="password" />}
        {needsOtp && <Field label="Email OTP" icon={Fingerprint} value={otp} onChange={setOtp} />}

        {error && <div className="error">{error}</div>}

        {mode === "admin" && <button className="primary" disabled={busy} onClick={login}>{busy ? "Signing in..." : "Sign In"}</button>}
        {mode === "employee" && !needsOtp && <button className="primary" disabled={busy || needsOtp} onClick={login}>{busy ? "Sending OTP..." : "Send OTP"}</button>}
        {mode === "employee" && needsOtp && <button className="primary" disabled={busy} onClick={verifyEmployeeOtp}>{busy ? "Verifying..." : "Verify OTP"}</button>}
        {mode === "signup" && !needsOtp && <button className="primary" disabled={busy || needsOtp} onClick={requestSignupOtp}>{busy ? "Sending OTP..." : "Send Email OTP"}</button>}
        {mode === "signup" && needsOtp && <button className="primary" disabled={busy} onClick={verifySignupOtp}>{busy ? "Creating..." : "Verify & Create Account"}</button>}
        {mode === "forgot" && !needsOtp && <button className="primary" disabled={busy || needsOtp} onClick={requestPasswordResetOtp}>{busy ? "Sending OTP..." : "Send Reset OTP"}</button>}
        {mode === "forgot" && needsOtp && <button className="primary" disabled={busy} onClick={verifyPasswordResetOtp}>{busy ? "Updating..." : "Verify & Reset Password"}</button>}

        {mode !== "signup" && mode !== "forgot" && (
          <button className="text-button" onClick={() => resetAuthFlow("forgot")}>
            Forgot password?
          </button>
        )}
      </section>
    </main>
  );
}

function PasswordChangeScreen({
  email,
  onChange,
  onLogout,
}: {
  email: string;
  onChange: (password: string) => void;
  onLogout: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await onChange(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-copy">
        <div className="brand">
          <div className="mark">D</div>
          <div>
            <strong>Dayflow</strong>
            <span>Secure first login</span>
          </div>
        </div>
        <h1>Set your new password</h1>
        <p>Your temporary password worked. Create your own password before entering the HRMS workspace.</p>
      </section>
      <section className="auth-panel">
        <div className="notice">Signed in as {email}</div>
        <Field label="New Password" icon={ShieldCheck} value={password} onChange={setPassword} type="password" />
        <Field label="Confirm Password" icon={ShieldCheck} value={confirmPassword} onChange={setConfirmPassword} type="password" />
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy} onClick={submit}>{busy ? "Saving..." : "Save Password"}</button>
        <button className="text-button" onClick={onLogout}>Log out</button>
      </section>
    </main>
  );
}

function Field({
  label,
  icon: Icon,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span><Icon size={16} /> {label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

type EmployeeForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  jobProfileId: string;
  manager: string;
  joined: string;
  salary: number;
  documents: UploadFile[];
};

type EmployeeUpdateForm = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  jobProfileId?: string;
  manager?: string;
  joined?: string;
  salary?: number;
  profilePhoto?: UploadFile;
};

function EmployeesView({
  employees,
  credentials,
  jobProfiles,
  documents,
  onCreate,
  onSelect,
  onDocumentDecision,
}: {
  employees: Employee[];
  credentials: EmployeeCredentials | null;
  jobProfiles: JobProfile[];
  documents: EmployeeDocument[];
  onCreate: (input: EmployeeForm) => Promise<void>;
  onSelect: (employeeId: string) => void;
  onDocumentDecision: (id: number, status: "Approved" | "Rejected", comment: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    jobProfileId: "",
    manager: "Nikhil Joshi",
    joined: new Date().toISOString().slice(0, 10),
    salary: "50000",
  });
  const [uploads, setUploads] = useState<Record<string, UploadFile | null>>({});
  const [comment, setComment] = useState("");
  const selectedProfile = jobProfiles.find((profile) => profile.id === draft.jobProfileId) || jobProfiles[0];
  const managers = ["Nikhil Joshi", ...employees.map((employee) => employee.name)];

  useEffect(() => {
    if (!draft.jobProfileId && jobProfiles[0]) setDraft((current) => ({ ...current, jobProfileId: jobProfiles[0].id }));
  }, [draft.jobProfileId, jobProfiles]);

  async function submit() {
    await onCreate({
      ...draft,
      salary: Number(draft.salary),
      documents: Object.values(uploads).filter(Boolean) as UploadFile[],
    });
    setOpen(false);
    setUploads({});
  }

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>Admin/HR</p>
            <h2>Employees</h2>
          </div>
          <button className="primary small" onClick={() => setOpen(!open)}><Plus size={16} /> New Employee</button>
        </div>
        {credentials && (
          <div className="credential">
            Employee ID <strong>{credentials.id}</strong> created. Temporary password and login link were sent by email.
          </div>
        )}
        {open && (
          <div className="form-grid">
            <label><span>name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label><span>email</span><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
            <label><span>phone</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
            <label className="wide"><span>address</span><input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
            <label><span>job profile</span><select value={draft.jobProfileId} onChange={(event) => setDraft({ ...draft, jobProfileId: event.target.value })}>{jobProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.title}</option>)}</select></label>
            <label><span>manager</span><select value={draft.manager} onChange={(event) => setDraft({ ...draft, manager: event.target.value })}>{managers.map((manager) => <option key={manager}>{manager}</option>)}</select></label>
            <label><span>joining date</span><input type="date" value={draft.joined} onChange={(event) => setDraft({ ...draft, joined: event.target.value })} /></label>
            <label><span>monthly salary</span><input type="number" min="1" value={draft.salary} onChange={(event) => setDraft({ ...draft, salary: event.target.value })} /></label>
            {selectedProfile && (
              <div className="selection-summary">
                <strong>{selectedProfile.department}</strong>
                <div className="tags">{selectedProfile.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
              </div>
            )}
            <FileInput type="Profile Photo" accept="image/*" onPick={(file) => setUploads({ ...uploads, "Profile Photo": file })} />
            <FileInput type="Resume" accept=".pdf,.doc,.docx" onPick={(file) => setUploads({ ...uploads, Resume: file })} />
            <FileInput type="ID Proof" accept=".pdf,image/*" onPick={(file) => setUploads({ ...uploads, "ID Proof": file })} />
            <FileInput type="Bank Proof" accept=".pdf,image/*" onPick={(file) => setUploads({ ...uploads, "Bank Proof": file })} />
            <FileInput type="Offer Letter" accept=".pdf,.doc,.docx" onPick={(file) => setUploads({ ...uploads, "Offer Letter": file })} />
            <FileInput type="Education Certificate" accept=".pdf,image/*" onPick={(file) => setUploads({ ...uploads, "Education Certificate": file })} />
            <button className="primary" onClick={submit}>Create Employee Account</button>
          </div>
        )}
        <div className="cards">
          {employees.map((employee) => (
            <button className="employee-card" key={employee.id} onClick={() => onSelect(employee.id)}>
              {employee.profilePhotoUrl ? <img className="avatar photo" src={employee.profilePhotoUrl} alt="" /> : <div className="avatar">{employee.avatar}</div>}
              <strong>{employee.name}</strong>
              <span>{employee.id}</span>
              <p>{employee.title} / {employee.department}</p>
            </button>
          ))}
        </div>
      </div>
      <DocumentPanel documents={documents} role="admin" onDecision={onDocumentDecision} comment={comment} onComment={setComment} />
    </section>
  );
}

function fileToUpload(file: File, type: string): Promise<UploadFile> {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Each file must be 5 MB or smaller."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ type, fileName: file.name, mimeType: file.type || "application/octet-stream", dataUrl: String(reader.result) });
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

function FileInput({ type, accept, onPick }: { type: string; accept: string; onPick: (file: UploadFile) => void }) {
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  async function pick(file?: File) {
    setError("");
    if (!file) return;
    try {
      const upload = await fileToUpload(file, type);
      setFileName(file.name);
      onPick(upload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid file.");
    }
  }

  return (
    <label className="file-field">
      <span>{type}</span>
      <input type="file" accept={accept} onChange={(event) => pick(event.target.files?.[0])} />
      <strong>{fileName || "Choose file"}</strong>
      {error && <small>{error}</small>}
    </label>
  );
}

function DocumentPanel({
  documents,
  role,
  onDecision,
  comment,
  onComment,
}: {
  documents: EmployeeDocument[];
  role: Role;
  onDecision?: (id: number, status: "Approved" | "Rejected", comment: string) => void;
  comment?: string;
  onComment?: (comment: string) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p>{role === "admin" ? "Verification queue" : "My uploads"}</p>
          <h2>Documents</h2>
        </div>
      </div>
      <div className="request-list">
        {documents.length === 0 && <div className="empty">No documents uploaded yet.</div>}
        {documents.map((document) => (
          <article className="request document-row" key={document.id}>
            <div>
              <strong>{document.name} / {document.type}</strong>
              <span>{document.file_name} / {document.status}</span>
            </div>
            <a href={document.file_url} target="_blank" rel="noreferrer">Open</a>
            {role === "admin" && document.status === "Pending" && onDecision && (
              <div className="inline-actions full">
                <input placeholder="Approval comment" value={comment || ""} onChange={(event) => onComment?.(event.target.value)} />
                <button onClick={() => onDecision(document.id, "Approved", comment || "")}><Check size={16} /></button>
                <button onClick={() => onDecision(document.id, "Rejected", comment || "")}><X size={16} /></button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

type ManualAttendanceForm = {
  employeeId: string;
  workDate: string;
  checkIn: string;
  checkOut: string;
  status: "Present" | "Absent" | "Half-day" | "Leave";
  note: string;
};

function AttendanceView({
  role,
  employees,
  rows,
  onCheck,
  onManual,
}: {
  role: Role;
  employees: Employee[];
  rows: Attendance[];
  onCheck: (employeeId?: string, action?: "in" | "out") => void;
  onManual: (input: ManualAttendanceForm) => void;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState("All");
  const [draft, setDraft] = useState<ManualAttendanceForm>({
    employeeId: employees[0]?.id || "",
    workDate: new Date().toISOString().slice(0, 10),
    checkIn: "09:00",
    checkOut: "18:00",
    status: "Present",
    note: "",
  });

  useEffect(() => {
    if (!employeeId && employees[0]) setEmployeeId(employees[0].id);
    if (!draft.employeeId && employees[0]) setDraft((current) => ({ ...current, employeeId: employees[0].id }));
  }, [draft.employeeId, employeeId, employees]);

  const filteredRows = rows.filter((row) => {
    const matchesEmployee = role === "employee" || !employeeId || row.employee_id === employeeId;
    const matchesMonth = !month || row.work_date.startsWith(month);
    const matchesStatus = status === "All" || row.status === status;
    return matchesEmployee && matchesMonth && matchesStatus;
  });
  const summary = filteredRows.reduce(
    (acc, row) => {
      acc.totalHours += Number(row.work_hours || 0);
      acc.extraHours += Number(row.extra_hours || 0);
      acc[row.status] += 1;
      return acc;
    },
    { Present: 0, "Half-day": 0, Absent: 0, Leave: 0, totalHours: 0, extraHours: 0 }
  );

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>Daily and monthly basis</p>
            <h2>Attendance</h2>
          </div>
          <div className="inline-actions">
            {role === "admin" && (
              <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            )}
            <button className="primary small" onClick={() => onCheck(role === "admin" ? employeeId : undefined, "in")}>Check In</button>
            <button className="primary small" onClick={() => onCheck(role === "admin" ? employeeId : undefined, "out")}>Check Out</button>
          </div>
        </div>
        <div className="filter-bar">
          {role === "admin" && (
            <label><span>Employee</span><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
          )}
          <label><span>Month</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
          <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Present</option><option>Half-day</option><option>Absent</option><option>Leave</option></select></label>
        </div>
        <section className="metrics mini">
          <Metric label="Present" value={String(summary.Present)} />
          <Metric label="Half Days" value={String(summary["Half-day"])} />
          <Metric label="Leave / Absent" value={String(summary.Leave + summary.Absent)} />
          <Metric label="Hours / Extra" value={`${summary.totalHours.toFixed(1)} / ${summary.extraHours.toFixed(1)}`} />
        </section>
        <DataTable
          headers={["Employee", "Date", "Check In", "Check Out", "Status", "Hours", "Extra"]}
          rows={filteredRows.map((row) => [row.name, row.work_date, row.check_in || "-", row.check_out || "-", row.status, Number(row.work_hours || 0).toFixed(1), Number(row.extra_hours || 0).toFixed(1)])}
        />
      </div>
      {role === "admin" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <p>HR adjustment</p>
              <h2>Manual Marking</h2>
            </div>
          </div>
          <div className="form-grid compact">
            <label><span>employee</span><select value={draft.employeeId} onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
            <label><span>date</span><input type="date" value={draft.workDate} onChange={(event) => setDraft({ ...draft, workDate: event.target.value })} /></label>
            <label><span>check in</span><input type="time" value={draft.checkIn} onChange={(event) => setDraft({ ...draft, checkIn: event.target.value })} /></label>
            <label><span>check out</span><input type="time" value={draft.checkOut} onChange={(event) => setDraft({ ...draft, checkOut: event.target.value })} /></label>
            <label><span>status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ManualAttendanceForm["status"] })}><option>Present</option><option>Half-day</option><option>Absent</option><option>Leave</option></select></label>
            <label><span>note</span><input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
            <button className="primary" onClick={() => onManual(draft)}>Save Attendance</button>
          </div>
        </div>
      )}
    </section>
  );
}

type LeaveForm = { employeeId?: string; type: string; startDate: string; endDate: string; remarks: string; attachment?: UploadFile };

function LeavesView({
  role,
  employees,
  rows,
  balances,
  onCreate,
  onDecision,
}: {
  role: Role;
  employees: Employee[];
  rows: LeaveRequest[];
  balances: LeaveBalance[];
  onCreate: (input: LeaveForm) => void;
  onDecision: (id: number, status: "Approved" | "Rejected", comment: string) => void;
}) {
  const [draft, setDraft] = useState({
    employeeId: employees[0]?.id || "",
    type: "Paid",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    remarks: "",
  });
  const [attachment, setAttachment] = useState<UploadFile | undefined>();
  const [comment, setComment] = useState("");
  const days = Math.max(0, Math.floor((new Date(draft.endDate).getTime() - new Date(draft.startDate).getTime()) / 86400000) + 1);
  const activeEmployeeId = role === "admin" ? draft.employeeId : rows[0]?.employee_id || employees[0]?.id || "";
  const activeBalances = balances.filter((balance) => balance.employeeId === activeEmployeeId);
  const pendingRows = rows.filter((row) => row.status === "Pending");

  useEffect(() => {
    if (!draft.employeeId && employees[0]) setDraft((current) => ({ ...current, employeeId: employees[0].id }));
  }, [draft.employeeId, employees]);

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>{role === "admin" ? "Approval workflow" : "Employee request"}</p>
            <h2>Time Off</h2>
          </div>
        </div>
        <section className="metrics mini">
          {activeBalances.map((balance) => (
            <Metric
              key={balance.type}
              label={`${balance.type} balance`}
              value={balance.type === "Unpaid" ? `${balance.approved} used` : `${balance.remaining}/${balance.entitlement}`}
            />
          ))}
        </section>
        <div className="form-grid compact">
          {role === "admin" && (
            <label><span>employee</span><select value={draft.employeeId} onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })}>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
          )}
          <label><span>type</span><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}><option>Paid</option><option>Sick</option><option>Unpaid</option></select></label>
          <label><span>start</span><input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
          <label><span>end</span><input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></label>
          <div className="selection-summary"><strong>{days} day{days === 1 ? "" : "s"} requested</strong></div>
          <label><span>remarks</span><input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} /></label>
          {draft.type === "Sick" && <FileInput type="Sick Certificate" accept=".pdf,image/*" onPick={(file) => setAttachment({ ...file, type: "Sick Certificate" })} />}
          <button className="primary" onClick={() => onCreate({ ...draft, attachment })}>Submit Leave Request</button>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>{role === "admin" ? `${pendingRows.length} pending approvals` : "My request history"}</p>
            <h2>Requests</h2>
          </div>
        </div>
        <div className="request-list">
          {rows.map((row) => (
            <article className="request" key={row.id}>
              <strong>{row.name} / {row.type}</strong>
              <span>{row.start_date} to {row.end_date} / {row.days} day{row.days === 1 ? "" : "s"} / {row.status}</span>
              <p>{row.remarks}</p>
              {row.attachment_url && <a href={row.attachment_url} target="_blank" rel="noreferrer">Open attachment</a>}
              {row.admin_comment && <p>Admin comment: {row.admin_comment}</p>}
              {role === "admin" && row.status === "Pending" && (
                <div className="inline-actions">
                  <input placeholder="Admin comment" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <button onClick={() => onDecision(row.id, "Approved", comment)}><Check size={16} /></button>
                  <button onClick={() => onDecision(row.id, "Rejected", comment)}><X size={16} /></button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileView({
  employee,
  role,
  employees,
  jobProfiles,
  documents,
  onUpdate,
  onDocumentDecision,
}: {
  employee: Employee;
  role: Role;
  employees: Employee[];
  jobProfiles: JobProfile[];
  documents: EmployeeDocument[];
  onUpdate: (employeeId: string, input: EmployeeUpdateForm) => Promise<void>;
  onDocumentDecision: (id: number, status: "Approved" | "Rejected", comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    address: employee.address,
    jobProfileId: jobProfiles.find((profile) => profile.title === employee.title)?.id || jobProfiles[0]?.id || "",
    manager: employee.manager,
    joined: employee.joined,
    salary: String(employee.wage),
  });
  const [profilePhoto, setProfilePhoto] = useState<UploadFile | undefined>();
  const ownDocuments = documents.filter((document) => document.employee_id === employee.id);
  const managers = ["Nikhil Joshi", ...employees.filter((item) => item.id !== employee.id).map((item) => item.name)];
  const onboarding = [
    ["Profile created", true],
    ["Login email sent", employee.mustChangePassword !== null],
    ["Account activated", Boolean(employee.accountVerified) && !employee.mustChangePassword],
    ["Documents uploaded", ownDocuments.length > 0],
    ["Documents approved", ownDocuments.length > 0 && ownDocuments.every((document) => document.status === "Approved")],
  ] as const;

  useEffect(() => {
    setDraft({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      address: employee.address,
      jobProfileId: jobProfiles.find((profile) => profile.title === employee.title)?.id || jobProfiles[0]?.id || "",
      manager: employee.manager,
      joined: employee.joined,
      salary: String(employee.wage),
    });
    setProfilePhoto(undefined);
    setError("");
  }, [employee, jobProfiles]);

  async function save() {
    setError("");
    setBusy(true);
    try {
      const payload: EmployeeUpdateForm =
        role === "admin"
          ? {
              ...draft,
              salary: Number(draft.salary),
              profilePhoto,
            }
          : {
              phone: draft.phone,
              address: draft.address,
              profilePhoto,
            };
      await onUpdate(employee.id, payload);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid-two">
      <div className="panel profile">
        {employee.profilePhotoUrl ? <img className="avatar big photo" src={employee.profilePhotoUrl} alt="" /> : <div className="avatar big">{employee.avatar}</div>}
        <h2>{employee.name}</h2>
        <p>{employee.title} / {employee.department}</p>
        <span>{employee.id}</span>
        <button className="primary small" onClick={() => setEditing(!editing)}>{editing ? "Close Editor" : "Edit Profile"}</button>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>{role === "admin" ? "Admin editable profile" : "Employee editable profile"}</p>
            <h2>Private Information</h2>
          </div>
        </div>
        {!editing ? (
          <DataTable
            headers={["Field", "Value"]}
            rows={[
              ["Email", employee.email],
              ["Phone", employee.phone],
              ["Address", employee.address],
              ["Manager", employee.manager],
              ["Joined", employee.joined],
              ["Monthly Salary", currency(employee.wage)],
              ["Edit Access", role === "admin" ? "All fields" : "Phone, address, profile picture"],
            ]}
          />
        ) : (
          <div className="form-grid compact">
            {role === "admin" && <label><span>name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>}
            {role === "admin" && <label><span>email</span><input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>}
            <label><span>phone</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
            <label className="wide"><span>address</span><input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
            {role === "admin" && <label><span>job profile</span><select value={draft.jobProfileId} onChange={(event) => setDraft({ ...draft, jobProfileId: event.target.value })}>{jobProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.title}</option>)}</select></label>}
            {role === "admin" && <label><span>manager</span><select value={draft.manager} onChange={(event) => setDraft({ ...draft, manager: event.target.value })}>{managers.map((manager) => <option key={manager}>{manager}</option>)}</select></label>}
            {role === "admin" && <label><span>joining date</span><input type="date" value={draft.joined} onChange={(event) => setDraft({ ...draft, joined: event.target.value })} /></label>}
            {role === "admin" && <label><span>monthly salary</span><input type="number" min="1" value={draft.salary} onChange={(event) => setDraft({ ...draft, salary: event.target.value })} /></label>}
            <FileInput type="Profile Photo" accept="image/*" onPick={setProfilePhoto} />
            {error && <div className="error wide">{error}</div>}
            <button className="primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save Profile"}</button>
          </div>
        )}
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>Completion</p>
            <h2>Onboarding Status</h2>
          </div>
        </div>
        <div className="checklist">
          {onboarding.map(([label, done]) => (
            <div className={done ? "done" : ""} key={label}>
              {done ? <Check size={16} /> : <Clock3 size={16} />}
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2>Documents & Skills</h2>
        <p><FileText size={16} /> Resume, bank proof, identity documents, offer letter, and certificates</p>
        <div className="tags">{employee.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
      </div>
      <DocumentPanel documents={ownDocuments} role={role} onDecision={onDocumentDecision} comment={comment} onComment={setComment} />
    </section>
  );
}

function PayrollView({
  role,
  rows,
  employees,
  employee,
  token,
}: {
  role: Role;
  rows: PayrollSlip[];
  employees: Employee[];
  employee?: Employee;
  token: string;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [employeeId, setEmployeeId] = useState(employee?.id || "");
  const [slips, setSlips] = useState(rows);

  useEffect(() => {
    setSlips(rows);
    if (!employeeId && employee?.id) setEmployeeId(employee.id);
  }, [employee?.id, employeeId, rows]);

  async function recalculate(nextMonth = month, nextEmployeeId = employeeId) {
    const query = new URLSearchParams({ month: nextMonth });
    if (role === "admin" && nextEmployeeId) query.set("employeeId", nextEmployeeId);
    const response = await fetch(`/api/payroll?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    setSlips(await response.json());
  }

  const selectedSlip = role === "admin"
    ? slips.find((slip) => slip.employeeId === employeeId) || slips[0]
    : slips[0];

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>{role === "admin" ? "Attendance-linked payroll" : "Read only employee payslip"}</p>
            <h2>{selectedSlip ? `${selectedSlip.name} Payslip` : "Payroll"}</h2>
          </div>
        </div>
        <div className="filter-bar">
          {role === "admin" && (
            <label><span>Employee</span><select value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); recalculate(month, event.target.value); }}>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          )}
          <label><span>Month</span><input type="month" value={month} onChange={(event) => { setMonth(event.target.value); recalculate(event.target.value, employeeId); }} /></label>
        </div>
        {selectedSlip && (
          <>
            <section className="metrics mini">
              <Metric label="Gross Pay" value={currency(selectedSlip.grossPay)} />
              <Metric label="Deductions" value={currency(selectedSlip.deduction)} />
              <Metric label="Extra Pay" value={currency(selectedSlip.extraPay)} />
              <Metric label="Net Pay" value={currency(selectedSlip.netPay)} />
            </section>
            <DataTable
              headers={["Metric", "Value"]}
              rows={[
                ["Monthly Salary", currency(selectedSlip.salary)],
                ["Working Days", selectedSlip.workingDays],
                ["Present Days", selectedSlip.presentDays],
                ["Leave Days", selectedSlip.leaveDays],
                ["Half Days", selectedSlip.halfDays],
                ["Absent Days", selectedSlip.absentDays],
                ["Payable Days", selectedSlip.payableDays],
                ["Unpaid Days", selectedSlip.unpaidDays],
                ["Total Hours", selectedSlip.totalHours.toFixed(1)],
                ["Extra Hours", selectedSlip.extraHours.toFixed(1)],
              ]}
            />
          </>
        )}
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>Salary structure</p>
            <h2>Components</h2>
          </div>
        </div>
        <DataTable
          headers={["Component", "Percent", "Amount"]}
          rows={(selectedSlip?.components || []).map((row) => [row.label, `${row.percent}%`, currency(row.amount)])}
        />
      </div>
    </section>
  );
}

function ReportsView({ employees, attendance, leaves }: { employees: Employee[]; attendance: Attendance[]; leaves: LeaveRequest[] }) {
  return (
    <section className="grid-two">
      <div className="panel">
        <h2>Attendance Report</h2>
        <p>{attendance.filter((row) => row.status === "Present").length} present records from {attendance.length} attendance rows.</p>
      </div>
      <div className="panel">
        <h2>Leave Report</h2>
        <p>{leaves.filter((row) => row.status === "Pending").length} pending, {leaves.filter((row) => row.status === "Approved").length} approved.</p>
      </div>
      <div className="panel">
        <h2>Payroll Report</h2>
        <p>{currency(employees.reduce((sum, employee) => sum + employee.wage, 0))} monthly wage liability.</p>
      </div>
    </section>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export { App };
