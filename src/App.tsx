import {
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  Clock3,
  CreditCard,
  Download,
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

function exportCsv(fileName: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
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

  async function uploadEmployeeDocument(document: UploadFile) {
    await api("/api/documents", {
      method: "POST",
      body: JSON.stringify(document),
    });
    setNotice("Document uploaded for HR verification.");
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
            onDocumentUpload={uploadEmployeeDocument}
          />
        )}
        {active === "payroll" && <PayrollView role={user.role} rows={payroll} employees={employees} employee={selectedEmployee} token={token} />}
        {active === "reports" && <ReportsView employees={employees} attendance={attendance} leaves={leaves} payroll={payroll} documents={documents} />}
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
  onDocumentDecision: (id: number, status: "Approved" | "Rejected", comment: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [accountStatus, setAccountStatus] = useState("All");
  const [documentStatus, setDocumentStatus] = useState("All");
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
  const selectedProfile = jobProfiles.find((profile) => profile.id === draft.jobProfileId) || jobProfiles[0];
  const managers = ["Nikhil Joshi", ...employees.map((employee) => employee.name)];
  const departments = ["All", ...Array.from(new Set(employees.map((employee) => employee.department)))];
  const filteredEmployees = employees.filter((employee) => {
    const ownDocuments = documents.filter((document) => document.employee_id === employee.id);
    const approvedDocuments = ownDocuments.filter((document) => document.status === "Approved").length;
    const pendingDocuments = ownDocuments.some((document) => document.status === "Pending");
    const rejectedDocuments = ownDocuments.some((document) => document.status === "Rejected");
    const accountReady = Boolean(employee.accountVerified) && !employee.mustChangePassword;
    const matchesSearch = [employee.name, employee.id, employee.email, employee.title, employee.department]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesDepartment = department === "All" || employee.department === department;
    const matchesAccount =
      accountStatus === "All" ||
      (accountStatus === "Activated" && accountReady) ||
      (accountStatus === "Pending" && !accountReady);
    const matchesDocuments =
      documentStatus === "All" ||
      (documentStatus === "Approved" && ownDocuments.length > 0 && approvedDocuments === ownDocuments.length) ||
      (documentStatus === "Pending" && pendingDocuments) ||
      (documentStatus === "Rejected" && rejectedDocuments) ||
      (documentStatus === "Missing" && ownDocuments.length === 0);
    return matchesSearch && matchesDepartment && matchesAccount && matchesDocuments;
  });

  useEffect(() => {
    if (!draft.jobProfileId && jobProfiles[0]) setDraft((current) => ({ ...current, jobProfileId: jobProfiles[0].id }));
  }, [draft.jobProfileId, jobProfiles]);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      await onCreate({
        ...draft,
        salary: Number(draft.salary),
        documents: Object.values(uploads).filter(Boolean) as UploadFile[],
      });
      setOpen(false);
      setUploads({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create employee account.");
    } finally {
      setBusy(false);
    }
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
            {error && <div className="error wide">{error}</div>}
            <button className="primary" disabled={busy} onClick={submit}>{busy ? "Creating..." : "Create Employee Account"}</button>
          </div>
        )}
        <div className="filter-bar employee-filters">
          <label><span>Search</span><input placeholder="Name, email, ID, role" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label><span>Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Account</span><select value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)}><option>All</option><option>Activated</option><option>Pending</option></select></label>
          <label><span>Documents</span><select value={documentStatus} onChange={(event) => setDocumentStatus(event.target.value)}><option>All</option><option>Approved</option><option>Pending</option><option>Rejected</option><option>Missing</option></select></label>
        </div>
        <div className="cards">
          {employees.length === 0 && <div className="empty">No employees added yet. Create the first employee account to start onboarding.</div>}
          {employees.length > 0 && filteredEmployees.length === 0 && <div className="empty">No employees match the selected filters.</div>}
          {filteredEmployees.map((employee) => {
            const ownDocuments = documents.filter((document) => document.employee_id === employee.id);
            const approvedDocuments = ownDocuments.filter((document) => document.status === "Approved").length;
            const accountReady = Boolean(employee.accountVerified) && !employee.mustChangePassword;
            return (
              <button className="employee-card" key={employee.id} onClick={() => onSelect(employee.id)}>
                <div className="card-topline">
                  {employee.profilePhotoUrl ? <img className="avatar photo" src={employee.profilePhotoUrl} alt="" /> : <div className="avatar">{employee.avatar}</div>}
                  <span className={accountReady ? "status-dot ready" : "status-dot pending"} />
                </div>
                <strong>{employee.name}</strong>
                <span>{employee.id}</span>
                <p>{employee.title} / {employee.department}</p>
                <div className="card-meta">
                  <span>{accountReady ? "Activated" : "Pending login"}</span>
                  <span>{ownDocuments.length ? `${approvedDocuments}/${ownDocuments.length} docs` : "No docs"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <DocumentPanel documents={documents} role="admin" onDecision={onDocumentDecision} />
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
  onUpload,
}: {
  documents: EmployeeDocument[];
  role: Role;
  onDecision?: (id: number, status: "Approved" | "Rejected", comment: string) => Promise<void>;
  onUpload?: (document: UploadFile) => Promise<void>;
}) {
  const [comments, setComments] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [uploadType, setUploadType] = useState("Resume");
  const [uploadFile, setUploadFile] = useState<UploadFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const documentTypes = ["Resume", "ID Proof", "Bank Proof", "Offer Letter", "Education Certificate", "Experience Letter", "Other"];

  async function decide(id: number, status: "Approved" | "Rejected") {
    if (!onDecision) return;
    setError("");
    setBusyId(id);
    try {
      await onDecision(id, status, comments[id] || "");
      setComments((current) => ({ ...current, [id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update document status.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitUpload() {
    if (!onUpload || !uploadFile) {
      setError("Choose a document before uploading.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      await onUpload({ ...uploadFile, type: uploadType });
      setUploadFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p>{role === "admin" ? "Verification queue" : "My uploads"}</p>
          <h2>Documents</h2>
        </div>
      </div>
      {role === "employee" && onUpload && (
        <div className="form-grid compact document-upload">
          <label>
            <span>document type</span>
            <select value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
              {documentTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <FileInput type={uploadType} accept=".pdf,.doc,.docx,image/*" onPick={setUploadFile} />
          <button className="primary" disabled={uploading || !uploadFile} onClick={submitUpload}>{uploading ? "Uploading..." : "Upload For Verification"}</button>
        </div>
      )}
      <div className="request-list">
        {error && <div className="error">{error}</div>}
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
                <input placeholder="Approval comment" value={comments[document.id] || ""} onChange={(event) => setComments({ ...comments, [document.id]: event.target.value })} />
                <button disabled={busyId === document.id} onClick={() => decide(document.id, "Approved")}><Check size={16} /></button>
                <button disabled={busyId === document.id} onClick={() => decide(document.id, "Rejected")}><X size={16} /></button>
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
  onCheck: (employeeId?: string, action?: "in" | "out") => Promise<void>;
  onManual: (input: ManualAttendanceForm) => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState("All");
  const [busyAction, setBusyAction] = useState<"in" | "out" | "manual" | "">("");
  const [error, setError] = useState("");
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
  const attendanceHeaders = ["Employee", "Date", "Check In", "Check Out", "Status", "Hours", "Extra", "Note"];
  const attendanceRows = filteredRows.map((row) => [
    row.name,
    row.work_date,
    row.check_in || "-",
    row.check_out || "-",
    row.status,
    Number(row.work_hours || 0).toFixed(1),
    Number(row.extra_hours || 0).toFixed(1),
    row.note || "-",
  ]);

  async function runCheck(action: "in" | "out") {
    setError("");
    setBusyAction(action);
    try {
      await onCheck(role === "admin" ? employeeId : undefined, action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update attendance.");
    } finally {
      setBusyAction("");
    }
  }

  async function saveManual() {
    setError("");
    setBusyAction("manual");
    try {
      await onManual(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save attendance.");
    } finally {
      setBusyAction("");
    }
  }

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
            <button className="primary small" disabled={Boolean(busyAction)} onClick={() => runCheck("in")}>{busyAction === "in" ? "Checking..." : "Check In"}</button>
            <button className="primary small" disabled={Boolean(busyAction)} onClick={() => runCheck("out")}>{busyAction === "out" ? "Checking..." : "Check Out"}</button>
            <button className="ghost small" disabled={filteredRows.length === 0} onClick={() => exportCsv(`dayflow-attendance-${month || "all"}.csv`, attendanceHeaders, attendanceRows)}><Download size={16} /> Export</button>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
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
          headers={attendanceHeaders.slice(0, 7)}
          empty="No attendance records match the selected filters."
          rows={attendanceRows.map((row) => row.slice(0, 7))}
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
            <button className="primary" disabled={Boolean(busyAction)} onClick={saveManual}>{busyAction === "manual" ? "Saving..." : "Save Attendance"}</button>
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
  onCreate: (input: LeaveForm) => Promise<void>;
  onDecision: (id: number, status: "Approved" | "Rejected", comment: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    employeeId: employees[0]?.id || "",
    type: "Paid",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    remarks: "",
  });
  const [attachment, setAttachment] = useState<UploadFile | undefined>();
  const [comments, setComments] = useState<Record<number, string>>({});
  const [busySubmit, setBusySubmit] = useState(false);
  const [busyDecisionId, setBusyDecisionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const days = Math.max(0, Math.floor((new Date(draft.endDate).getTime() - new Date(draft.startDate).getTime()) / 86400000) + 1);
  const activeEmployeeId = role === "admin" ? draft.employeeId : rows[0]?.employee_id || employees[0]?.id || "";
  const activeBalances = balances.filter((balance) => balance.employeeId === activeEmployeeId);
  const pendingRows = rows.filter((row) => row.status === "Pending");

  useEffect(() => {
    if (!draft.employeeId && employees[0]) setDraft((current) => ({ ...current, employeeId: employees[0].id }));
  }, [draft.employeeId, employees]);

  async function submitLeave() {
    setError("");
    setBusySubmit(true);
    try {
      await onCreate({ ...draft, attachment });
      setDraft((current) => ({ ...current, remarks: "" }));
      setAttachment(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit leave request.");
    } finally {
      setBusySubmit(false);
    }
  }

  async function decide(id: number, status: "Approved" | "Rejected") {
    setError("");
    setBusyDecisionId(id);
    try {
      await onDecision(id, status, comments[id] || "");
      setComments((current) => ({ ...current, [id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update leave request.");
    } finally {
      setBusyDecisionId(null);
    }
  }

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
          {activeBalances.length === 0 && <div className="empty">Leave balances will appear after an employee is selected.</div>}
        </section>
        {error && <div className="error">{error}</div>}
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
          <button className="primary" disabled={busySubmit} onClick={submitLeave}>{busySubmit ? "Submitting..." : "Submit Leave Request"}</button>
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
          {rows.length === 0 && <div className="empty">No leave requests yet.</div>}
          {rows.map((row) => (
            <article className="request" key={row.id}>
              <strong>{row.name} / {row.type}</strong>
              <span>{row.start_date} to {row.end_date} / {row.days} day{row.days === 1 ? "" : "s"} / {row.status}</span>
              <p>{row.remarks}</p>
              {row.attachment_url && <a href={row.attachment_url} target="_blank" rel="noreferrer">Open attachment</a>}
              {row.admin_comment && <p>Admin comment: {row.admin_comment}</p>}
              {role === "admin" && row.status === "Pending" && (
                <div className="inline-actions">
                  <input placeholder="Admin comment" value={comments[row.id] || ""} onChange={(e) => setComments({ ...comments, [row.id]: e.target.value })} />
                  <button disabled={busyDecisionId === row.id} onClick={() => decide(row.id, "Approved")}><Check size={16} /></button>
                  <button disabled={busyDecisionId === row.id} onClick={() => decide(row.id, "Rejected")}><X size={16} /></button>
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
  onDocumentUpload,
}: {
  employee: Employee;
  role: Role;
  employees: Employee[];
  jobProfiles: JobProfile[];
  documents: EmployeeDocument[];
  onUpdate: (employeeId: string, input: EmployeeUpdateForm) => Promise<void>;
  onDocumentDecision: (id: number, status: "Approved" | "Rejected", comment: string) => Promise<void>;
  onDocumentUpload: (document: UploadFile) => Promise<void>;
}) {
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
      <DocumentPanel documents={ownDocuments} role={role} onDecision={onDocumentDecision} onUpload={role === "employee" ? onDocumentUpload : undefined} />
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSlips(rows);
    if (!employeeId && employee?.id) setEmployeeId(employee.id);
  }, [employee?.id, employeeId, rows]);

  async function recalculate(nextMonth = month, nextEmployeeId = employeeId) {
    const query = new URLSearchParams({ month: nextMonth });
    if (role === "admin" && nextEmployeeId) query.set("employeeId", nextEmployeeId);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payroll?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to calculate payroll.");
      setSlips(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to calculate payroll.");
    } finally {
      setLoading(false);
    }
  }

  const selectedSlip = role === "admin"
    ? slips.find((slip) => slip.employeeId === employeeId) || slips[0]
    : slips[0];
  const payrollHeaders = ["Metric", "Value"];
  const payrollRows = selectedSlip
    ? [
        ["Employee", selectedSlip.name],
        ["Month", selectedSlip.month],
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
        ["Extra Pay", currency(selectedSlip.extraPay)],
        ["Deductions", currency(selectedSlip.deduction)],
        ["Net Pay", currency(selectedSlip.netPay)],
      ]
    : [];

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>{role === "admin" ? "Attendance-linked payroll" : "Read only employee payslip"}</p>
            <h2>{selectedSlip ? `${selectedSlip.name} Payslip` : "Payroll"}</h2>
          </div>
          <div className="inline-actions">
            {loading && <span className="status-pill">Calculating</span>}
            <button className="ghost small" disabled={!selectedSlip} onClick={() => selectedSlip && exportCsv(`dayflow-payroll-${selectedSlip.employeeId}-${selectedSlip.month}.csv`, payrollHeaders, payrollRows)}>
              <Download size={16} /> Export
            </button>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
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
              headers={payrollHeaders}
              rows={payrollRows.slice(2, 12)}
            />
          </>
        )}
        {!selectedSlip && <div className="empty">No payroll data is available for this selection.</div>}
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
          empty="No salary components found for this payslip."
          rows={(selectedSlip?.components || []).map((row) => [row.label, `${row.percent}%`, currency(row.amount)])}
        />
      </div>
    </section>
  );
}

function ReportsView({
  employees,
  attendance,
  leaves,
  payroll,
  documents,
}: {
  employees: Employee[];
  attendance: Attendance[];
  leaves: LeaveRequest[];
  payroll: PayrollSlip[];
  documents: EmployeeDocument[];
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const monthAttendance = attendance.filter((row) => row.work_date.startsWith(month));
  const attendanceCounts = {
    Present: monthAttendance.filter((row) => row.status === "Present").length,
    "Half-day": monthAttendance.filter((row) => row.status === "Half-day").length,
    Leave: monthAttendance.filter((row) => row.status === "Leave").length,
    Absent: monthAttendance.filter((row) => row.status === "Absent").length,
  };
  const leaveCounts = {
    Pending: leaves.filter((row) => row.status === "Pending").length,
    Approved: leaves.filter((row) => row.status === "Approved").length,
    Rejected: leaves.filter((row) => row.status === "Rejected").length,
    Paid: leaves.filter((row) => row.type === "Paid").reduce((sum, row) => sum + row.days, 0),
    Sick: leaves.filter((row) => row.type === "Sick").reduce((sum, row) => sum + row.days, 0),
    Unpaid: leaves.filter((row) => row.type === "Unpaid").reduce((sum, row) => sum + row.days, 0),
  };
  const payrollSummary = payroll.reduce(
    (acc, slip) => ({
      gross: acc.gross + slip.grossPay,
      deductions: acc.deductions + slip.deduction,
      net: acc.net + slip.netPay,
    }),
    { gross: 0, deductions: 0, net: 0 }
  );
  const topPayroll = payroll.reduce<PayrollSlip | null>((top, slip) => (!top || slip.netPay > top.netPay ? slip : top), null);
  const lowestPayroll = payroll.reduce<PayrollSlip | null>((low, slip) => (!low || slip.netPay < low.netPay ? slip : low), null);
  const documentCounts = {
    Approved: documents.filter((document) => document.status === "Approved").length,
    Pending: documents.filter((document) => document.status === "Pending").length,
    Rejected: documents.filter((document) => document.status === "Rejected").length,
  };
  const activated = employees.filter((employee) => employee.accountVerified && !employee.mustChangePassword).length;
  const maxAttendance = Math.max(1, ...Object.values(attendanceCounts));
  const maxLeave = Math.max(1, leaveCounts.Paid, leaveCounts.Sick, leaveCounts.Unpaid);
  const reportRows = [
    ["Month", month],
    ["Employees", employees.length],
    ["Activated Accounts", activated],
    ["Pending Accounts", employees.length - activated],
    ["Present Attendance Rows", attendanceCounts.Present],
    ["Half-day Attendance Rows", attendanceCounts["Half-day"]],
    ["Leave Attendance Rows", attendanceCounts.Leave],
    ["Absent Attendance Rows", attendanceCounts.Absent],
    ["Pending Leave Requests", leaveCounts.Pending],
    ["Approved Leave Requests", leaveCounts.Approved],
    ["Rejected Leave Requests", leaveCounts.Rejected],
    ["Paid Leave Days", leaveCounts.Paid],
    ["Sick Leave Days", leaveCounts.Sick],
    ["Unpaid Leave Days", leaveCounts.Unpaid],
    ["Gross Payroll", currency(payrollSummary.gross)],
    ["Payroll Deductions", currency(payrollSummary.deductions)],
    ["Net Payroll", currency(payrollSummary.net)],
    ["Pending Documents", documentCounts.Pending],
    ["Approved Documents", documentCounts.Approved],
    ["Rejected Documents", documentCounts.Rejected],
  ];

  return (
    <section className="reports">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>Monthly overview</p>
            <h2>Executive Report</h2>
          </div>
          <div className="report-tools">
            <button className="ghost small" disabled={employees.length === 0} onClick={() => exportCsv(`dayflow-executive-report-${month}.csv`, ["Metric", "Value"], reportRows)}>
              <Download size={16} /> Export
            </button>
            <div className="filter-bar compact-filter">
            <label><span>Month</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
            </div>
          </div>
        </div>
        <section className="metrics mini">
          <Metric label="Employees" value={String(employees.length)} />
          <Metric label="Activated" value={`${activated}/${employees.length}`} />
          <Metric label="Net Payroll" value={currency(payrollSummary.net)} />
          <Metric label="Open Items" value={String(leaveCounts.Pending + documentCounts.Pending)} />
        </section>
        {employees.length === 0 && <div className="empty">Reports will populate after employee accounts, attendance, leave, and payroll records are created.</div>}
      </div>
      <section className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <div>
              <p>Attendance distribution</p>
              <h2>Attendance</h2>
            </div>
          </div>
          <BarList rows={Object.entries(attendanceCounts).map(([label, value]) => ({ label, value, max: maxAttendance }))} />
          <DataTable
            headers={["Metric", "Value"]}
            rows={[
              ["Total Hours", monthAttendance.reduce((sum, row) => sum + Number(row.work_hours || 0), 0).toFixed(1)],
              ["Extra Hours", monthAttendance.reduce((sum, row) => sum + Number(row.extra_hours || 0), 0).toFixed(1)],
              ["Attendance Rows", monthAttendance.length],
            ]}
          />
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <p>Leave workflow</p>
              <h2>Time Off</h2>
            </div>
          </div>
          <section className="metrics mini">
            <Metric label="Pending" value={String(leaveCounts.Pending)} />
            <Metric label="Approved" value={String(leaveCounts.Approved)} />
            <Metric label="Rejected" value={String(leaveCounts.Rejected)} />
            <Metric label="Total Days" value={String(leaveCounts.Paid + leaveCounts.Sick + leaveCounts.Unpaid)} />
          </section>
          <BarList rows={[
            { label: "Paid", value: leaveCounts.Paid, max: maxLeave },
            { label: "Sick", value: leaveCounts.Sick, max: maxLeave },
            { label: "Unpaid", value: leaveCounts.Unpaid, max: maxLeave },
          ]} />
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <p>Payroll liability</p>
              <h2>Payroll</h2>
            </div>
          </div>
          <DataTable
            headers={["Metric", "Value"]}
            rows={[
              ["Gross Payroll", currency(payrollSummary.gross)],
              ["Deductions", currency(payrollSummary.deductions)],
              ["Net Payout", currency(payrollSummary.net)],
              ["Highest Net Pay", topPayroll ? `${topPayroll.name} / ${currency(topPayroll.netPay)}` : "-"],
              ["Lowest Net Pay", lowestPayroll ? `${lowestPayroll.name} / ${currency(lowestPayroll.netPay)}` : "-"],
            ]}
          />
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <p>Onboarding health</p>
              <h2>Documents & Accounts</h2>
            </div>
          </div>
          <section className="metrics mini">
            <Metric label="Approved Docs" value={String(documentCounts.Approved)} />
            <Metric label="Pending Docs" value={String(documentCounts.Pending)} />
            <Metric label="Rejected Docs" value={String(documentCounts.Rejected)} />
            <Metric label="Pending Accounts" value={String(employees.length - activated)} />
          </section>
          <DataTable
            headers={["Employee", "Account", "Documents"]}
            empty="No employee onboarding records yet."
            rows={employees.map((employee) => {
              const ownDocs = documents.filter((document) => document.employee_id === employee.id);
              const approvedDocs = ownDocs.filter((document) => document.status === "Approved").length;
              return [
                employee.name,
                employee.accountVerified && !employee.mustChangePassword ? "Activated" : "Pending",
                `${approvedDocs}/${ownDocs.length} approved`,
              ];
            })}
          />
        </div>
      </section>
    </section>
  );
}

function BarList({ rows }: { rows: { label: string; value: number; max: number }[] }) {
  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{row.label}</span>
          <div><i style={{ width: `${Math.max(4, (row.value / row.max) * 100)}%` }} /></div>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DataTable({ headers, rows, empty = "No records to show." }: { headers: string[]; rows: (string | number)[][]; empty?: string }) {
  if (rows.length === 0) return <div className="empty">{empty}</div>;

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
