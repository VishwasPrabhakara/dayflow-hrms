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
};

type SalaryComponent = {
  id: number;
  employee_id: string;
  name?: string;
  label: string;
  percent: number;
  amount: number;
};

type EmployeeCredentials = { id: string; emailed: boolean };

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
  const [payroll, setPayroll] = useState<SalaryComponent[]>([]);
  const [credentials, setCredentials] = useState<EmployeeCredentials | null>(null);
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
    const [employeeRows, attendanceRows, leaveRows, payrollRows] = await Promise.all([
      fetch("/api/employees", { headers }).then((r) => r.json()),
      fetch("/api/attendance", { headers }).then((r) => r.json()),
      fetch("/api/leaves", { headers }).then((r) => r.json()),
      fetch("/api/payroll", { headers }).then((r) => r.json()),
    ]);
    setEmployees(employeeRows);
    setAttendance(attendanceRows);
    setLeaves(leaveRows);
    setPayroll(payrollRows);
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
    setPayroll([]);
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

  async function completePasswordChange(password: string) {
    const result = await api<{ token: string; user: User }>("/api/auth/password/change", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    await startSession(result.token, result.user);
    setNotice("Password updated. Your account is ready.");
  }

  async function markAttendance(employeeId?: string) {
    await api("/api/attendance/check", {
      method: "POST",
      body: JSON.stringify({ employeeId }),
    });
    setNotice("Attendance updated.");
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

  const selectedEmployee = employees[0];
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
          <EmployeesView employees={employees} credentials={credentials} onCreate={createEmployee} />
        )}
        {active === "attendance" && (
          <AttendanceView
            role={user.role}
            employees={employees}
            rows={attendance}
            onCheck={markAttendance}
          />
        )}
        {active === "leaves" && (
          <LeavesView role={user.role} employees={employees} rows={leaves} onCreate={createLeave} onDecision={decideLeave} />
        )}
        {active === "profile" && selectedEmployee && <ProfileView employee={selectedEmployee} role={user.role} />}
        {active === "payroll" && <PayrollView role={user.role} rows={payroll} employee={selectedEmployee} />}
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
  title: string;
  department: string;
  location: string;
  manager: string;
  joined: string;
  wage: number;
  skills: string[];
};

function EmployeesView({
  employees,
  credentials,
  onCreate,
}: {
  employees: Employee[];
  credentials: EmployeeCredentials | null;
  onCreate: (input: EmployeeForm) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    title: "",
    department: "",
    location: "",
    manager: "",
    joined: new Date().toISOString().slice(0, 10),
    wage: "50000",
    skills: "",
  });

  function submit() {
    onCreate({
      ...draft,
      wage: Number(draft.wage),
      skills: draft.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
    });
    setOpen(false);
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
            {Object.keys(draft).map((key) => (
              <label key={key}>
                <span>{key}</span>
                <input value={draft[key as keyof typeof draft]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
              </label>
            ))}
            <button className="primary" onClick={submit}>Create Employee Account</button>
          </div>
        )}
        <div className="cards">
          {employees.map((employee) => (
            <article className="employee-card" key={employee.id}>
              <div className="avatar">{employee.avatar}</div>
              <strong>{employee.name}</strong>
              <span>{employee.id}</span>
              <p>{employee.title} / {employee.department}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AttendanceView({
  role,
  employees,
  rows,
  onCheck,
}: {
  role: Role;
  employees: Employee[];
  rows: Attendance[];
  onCheck: (employeeId?: string) => void;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p>Daily and weekly basis</p>
          <h2>Attendance</h2>
        </div>
        <div className="inline-actions">
          {role === "admin" && (
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              {employees.map((employee) => <option key={employee.id}>{employee.id}</option>)}
            </select>
          )}
          <button className="primary small" onClick={() => onCheck(role === "admin" ? employeeId : undefined)}>Check In / Out</button>
        </div>
      </div>
      <DataTable
        headers={["Employee", "Date", "Check In", "Check Out", "Status"]}
        rows={rows.map((row) => [row.name, row.work_date, row.check_in || "-", row.check_out || "-", row.status])}
      />
    </section>
  );
}

type LeaveForm = { employeeId?: string; type: string; startDate: string; endDate: string; remarks: string };

function LeavesView({
  role,
  employees,
  rows,
  onCreate,
  onDecision,
}: {
  role: Role;
  employees: Employee[];
  rows: LeaveRequest[];
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
  const [comment, setComment] = useState("");
  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p>{role === "admin" ? "Approval workflow" : "Employee request"}</p>
            <h2>Time Off</h2>
          </div>
        </div>
        <div className="form-grid compact">
          {role === "admin" && (
            <label><span>employee</span><select value={draft.employeeId} onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })}>{employees.map((e) => <option key={e.id}>{e.id}</option>)}</select></label>
          )}
          <label><span>type</span><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}><option>Paid</option><option>Sick</option><option>Unpaid</option></select></label>
          <label><span>start</span><input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
          <label><span>end</span><input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></label>
          <label><span>remarks</span><input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} /></label>
          <button className="primary" onClick={() => onCreate(draft)}>Submit Leave Request</button>
        </div>
      </div>
      <div className="panel">
        <h2>Requests</h2>
        <div className="request-list">
          {rows.map((row) => (
            <article className="request" key={row.id}>
              <strong>{row.name} / {row.type}</strong>
              <span>{row.start_date} to {row.end_date} / {row.status}</span>
              <p>{row.remarks}</p>
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

function ProfileView({ employee, role }: { employee: Employee; role: Role }) {
  return (
    <section className="grid-two">
      <div className="panel profile">
        <div className="avatar big">{employee.avatar}</div>
        <h2>{employee.name}</h2>
        <p>{employee.title} / {employee.department}</p>
        <span>{employee.id}</span>
      </div>
      <div className="panel">
        <h2>Private Information</h2>
        <DataTable
          headers={["Field", "Value"]}
          rows={[
            ["Email", employee.email],
            ["Phone", employee.phone],
            ["Address", employee.address],
            ["Manager", employee.manager],
            ["Joined", employee.joined],
            ["Edit Access", role === "admin" ? "All fields" : "Phone, address, profile picture"],
          ]}
        />
      </div>
      <div className="panel">
        <h2>Documents & Skills</h2>
        <p><FileText size={16} /> Resume, bank proof, identity documents</p>
        <div className="tags">{employee.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
      </div>
    </section>
  );
}

function PayrollView({ role, rows, employee }: { role: Role; rows: SalaryComponent[]; employee?: Employee }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p>{role === "admin" ? "Admin can update salary structure" : "Read only employee view"}</p>
          <h2>{employee ? `${employee.name} Salary` : "Payroll"}</h2>
        </div>
      </div>
      <DataTable
        headers={["Employee", "Component", "Percent", "Amount"]}
        rows={rows.map((row) => [row.name || employee?.name || "-", row.label, `${row.percent}%`, currency(row.amount)])}
      />
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
