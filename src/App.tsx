import {
  Bell,
  Building2,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Fingerprint,
  LogOut,
  Mail,
  Menu,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

type Role = "admin" | "employee";
type View = "employees" | "attendance" | "timeoff" | "profile" | "salary";
type AttendanceStatus = "present" | "leave" | "absent";
type LeaveStatus = "Pending" | "Approved" | "Rejected";

type Employee = {
  id: string;
  name: string;
  title: string;
  department: string;
  location: string;
  email: string;
  phone: string;
  manager: string;
  joined: string;
  avatar: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  wage: number;
  skills: string[];
};

type LeaveRequest = {
  id: string;
  employeeId: string;
  employee: string;
  type: "Paid Time Off" | "Sick Leave" | "Unpaid Leave";
  start: string;
  end: string;
  allocation: number;
  status: LeaveStatus;
  note: string;
};

const employees: Employee[] = [
  {
    id: "ODOJO23001",
    name: "Vishwas P",
    title: "Frontend Engineer",
    department: "Product",
    location: "Bangalore",
    email: "vishwas@dayflow.test",
    phone: "+91 98765 43210",
    manager: "Nikhil Joshi",
    joined: "2023-07-22",
    avatar: "VP",
    status: "present",
    checkIn: "09:04",
    checkOut: "18:12",
    wage: 75000,
    skills: ["React", "UI Systems", "Payroll"],
  },
  {
    id: "ODOAN24002",
    name: "Anika Rao",
    title: "HR Officer",
    department: "People Ops",
    location: "Bangalore",
    email: "anika@dayflow.test",
    phone: "+91 99887 12345",
    manager: "Nikhil Joshi",
    joined: "2024-01-08",
    avatar: "AR",
    status: "leave",
    checkIn: "--",
    checkOut: "--",
    wage: 68000,
    skills: ["Hiring", "Compliance", "Training"],
  },
  {
    id: "ODORH22003",
    name: "Rohan Mehta",
    title: "Backend Engineer",
    department: "Platform",
    location: "Remote",
    email: "rohan@dayflow.test",
    phone: "+91 90001 11009",
    manager: "Anika Rao",
    joined: "2022-11-14",
    avatar: "RM",
    status: "present",
    checkIn: "09:31",
    checkOut: "18:04",
    wage: 88000,
    skills: ["APIs", "Databases", "Security"],
  },
  {
    id: "ODOMI25004",
    name: "Mira Shah",
    title: "Product Designer",
    department: "Design",
    location: "Mumbai",
    email: "mira@dayflow.test",
    phone: "+91 91234 65432",
    manager: "Vishwas P",
    joined: "2025-02-19",
    avatar: "MS",
    status: "absent",
    checkIn: "--",
    checkOut: "--",
    wage: 72000,
    skills: ["Research", "Wireframes", "Design QA"],
  },
];

const initialRequests: LeaveRequest[] = [
  {
    id: "LV-1042",
    employeeId: "ODOAN24002",
    employee: "Anika Rao",
    type: "Paid Time Off",
    start: "2026-08-26",
    end: "2026-08-28",
    allocation: 3,
    status: "Pending",
    note: "Family function out of station.",
  },
  {
    id: "LV-1041",
    employeeId: "ODOMI25004",
    employee: "Mira Shah",
    type: "Sick Leave",
    start: "2026-08-22",
    end: "2026-08-22",
    allocation: 1,
    status: "Approved",
    note: "Medical appointment.",
  },
  {
    id: "LV-1039",
    employeeId: "ODORH22003",
    employee: "Rohan Mehta",
    type: "Unpaid Leave",
    start: "2026-08-30",
    end: "2026-08-31",
    allocation: 2,
    status: "Rejected",
    note: "Release week overlap.",
  },
];

const navItems = [
  { id: "employees", label: "Employees", icon: UsersRound },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "timeoff", label: "Time Off", icon: Clock3 },
  { id: "profile", label: "My Profile", icon: UserRound },
  { id: "salary", label: "Salary", icon: CreditCard },
] as const;

const statusLabel: Record<AttendanceStatus, string> = {
  present: "Present",
  leave: "On Leave",
  absent: "Absent",
};

const salaryComponents = [
  ["Basic Salary", 50],
  ["House Rent Allowance", 25],
  ["Performance Bonus", 9.33],
  ["Travel Allowance", 8.33],
  ["PF Allowance", 11.67],
] as const;

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<Role>("admin");
  const [activeView, setActiveView] = useState<View>("employees");
  const [selectedId, setSelectedId] = useState(employees[0].id);
  const [query, setQuery] = useState("");
  const [checkedIn, setCheckedIn] = useState(true);
  const [requests, setRequests] = useState(initialRequests);

  const selectedEmployee = employees.find((employee) => employee.id === selectedId) ?? employees[0];
  const visibleEmployees = role === "employee" ? [employees[0]] : employees;
  const filteredEmployees = visibleEmployees.filter((employee) => {
    const haystack = `${employee.name} ${employee.title} ${employee.department} ${employee.id}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const metrics = useMemo(() => {
    const present = employees.filter((employee) => employee.status === "present").length;
    const pending = requests.filter((request) => request.status === "Pending").length;
    const payroll = employees.reduce((sum, employee) => sum + employee.wage, 0);
    return { present, pending, payroll };
  }, [requests]);

  function updateRequest(id: string, status: LeaveStatus) {
    setRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status } : request))
    );
  }

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    setSelectedId(employees[0].id);
    if (nextRole === "employee" && activeView === "employees") {
      setActiveView("profile");
    }
  }

  if (!isAuthenticated) {
    return <AuthScreen onEnter={() => setIsAuthenticated(true)} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={19} />
          </div>
          <div>
            <strong>Dayflow</strong>
            <span>Every workday, aligned</span>
          </div>
        </div>

        <div className="role-toggle" aria-label="Role switch">
          <button className={role === "admin" ? "active" : ""} onClick={() => switchRole("admin")}>
            Admin
          </button>
          <button className={role === "employee" ? "active" : ""} onClick={() => switchRole("employee")}>
            Employee
          </button>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems
            .filter((item) => role === "admin" || item.id !== "employees")
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={activeView === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  title={item.label}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>

        <div className="sidebar-footer">
          <div className="security-chip">
            <ShieldCheck size={17} />
            Role-based access
          </div>
          <button className="ghost-button" onClick={() => setIsAuthenticated(false)}>
            <LogOut size={17} />
            Log out
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" title="Menu">
            <Menu size={20} />
          </button>
          <div>
            <p className="eyebrow">{role === "admin" ? "Admin workspace" : "Employee self service"}</p>
            <h1>{viewTitle(activeView, role)}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" title="Notifications">
              <Bell size={20} />
            </button>
            <button className="profile-button" onClick={() => setActiveView("profile")}>
              <span>{selectedEmployee.avatar}</span>
              <ChevronDown size={16} />
            </button>
          </div>
        </header>

        <section className="metric-grid" aria-label="Summary">
          <Metric title="People" value={String(employees.length)} note="registered employees" />
          <Metric title="Present Today" value={`${metrics.present}/${employees.length}`} note="live attendance" />
          <Metric title="Pending Leaves" value={String(metrics.pending)} note="waiting for approval" />
          <Metric title="Monthly Payroll" value={formatMoney(metrics.payroll)} note="configured wages" />
        </section>

        {activeView === "employees" && role === "admin" && (
          <EmployeesView
            employees={filteredEmployees}
            query={query}
            selectedId={selectedId}
            onQuery={setQuery}
            onSelect={(id) => {
              setSelectedId(id);
              setActiveView("profile");
            }}
          />
        )}

        {activeView === "attendance" && (
          <AttendanceView
            employees={visibleEmployees}
            role={role}
            checkedIn={checkedIn}
            onToggle={() => setCheckedIn((value) => !value)}
          />
        )}

        {activeView === "timeoff" && (
          <TimeOffView requests={requests} role={role} onUpdate={updateRequest} />
        )}

        {activeView === "profile" && <ProfileView employee={selectedEmployee} role={role} />}

        {activeView === "salary" && <SalaryView employee={selectedEmployee} role={role} />}
      </section>
    </main>
  );
}

function AuthScreen({ onEnter }: { onEnter: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    company: "Odoo India",
    name: "Vishwas P",
    email: "vishwas@dayflow.test",
    phone: "9876543210",
    password: "Dayflow@2026",
  });
  const initials = form.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const loginId = `OD${initials || "VP"}260001`;
  const valid = form.email.includes("@") && form.password.length >= 8;

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand large">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <strong>Dayflow</strong>
            <span>Human Resource Management System</span>
          </div>
        </div>
        <h1>Every workday, perfectly aligned.</h1>
        <p>
          A role-aware HR workspace for onboarding, attendance, leave approvals, profiles, and payroll clarity.
        </p>
        <div className="auth-preview">
          <div>
            <span>Generated Login ID</span>
            <strong>{loginId}</strong>
          </div>
          <div>
            <span>Temporary Password</span>
            <strong>System generated</strong>
          </div>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-tabs">
          <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>
            Sign In
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
            Company Setup
          </button>
        </div>

        {mode === "signup" && (
          <>
            <label className="logo-upload">
              <Upload size={18} />
              Upload company logo
            </label>
            <Field icon={Building2} label="Company Name" value={form.company} onChange={(value) => update("company", value)} />
            <Field icon={UserRound} label="Admin Name" value={form.name} onChange={(value) => update("name", value)} />
            <Field icon={Mail} label="Email" value={form.email} onChange={(value) => update("email", value)} />
            <Field icon={BriefcaseBusiness} label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
          </>
        )}

        {mode === "signin" && (
          <>
            <Field icon={Fingerprint} label="Login ID / Email" value={form.email} onChange={(value) => update("email", value)} />
            <div className="auth-hint">
              Demo Login ID: <strong>{loginId}</strong>
            </div>
          </>
        )}

        <label className="field-row">
          <Lock size={17} />
          <span>Password</span>
          <input
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
          />
          <button type="button" title="Show password" onClick={() => setShowPassword((value) => !value)}>
            <Eye size={16} />
          </button>
        </label>

        <button className="primary-button full auth-submit" disabled={!valid} onClick={onEnter}>
          <ShieldCheck size={17} />
          {mode === "signin" ? "Sign In" : "Create HR Workspace"}
        </button>
        <p className="auth-note">
          {mode === "signin"
            ? "Incorrect credentials will be validated before access."
            : "Employees receive generated login credentials after HR approval."}
        </p>
      </section>
    </main>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-row">
      <Icon size={17} />
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function viewTitle(view: View, role: Role) {
  if (view === "employees") return "Employee command center";
  if (view === "attendance") return role === "admin" ? "Attendance control" : "My attendance";
  if (view === "timeoff") return role === "admin" ? "Time-off approvals" : "My time off";
  if (view === "salary") return role === "admin" ? "Salary structure" : "My salary";
  return role === "admin" ? "Employee profile" : "My profile";
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <article className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function EmployeesView({
  employees,
  query,
  selectedId,
  onQuery,
  onSelect,
}: {
  employees: Employee[];
  query: string;
  selectedId: string;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="content-grid employees-layout">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>People overview</h2>
          </div>
          <button className="primary-button">
            <Upload size={16} />
            New
          </button>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search employee, role, department..."
          />
        </label>
        <div className="employee-grid">
          {employees.map((employee) => (
            <button
              className={`employee-card ${employee.id === selectedId ? "selected" : ""}`}
              key={employee.id}
              onClick={() => onSelect(employee.id)}
            >
              <span className={`status-dot ${employee.status}`} />
              <div className="avatar">{employee.avatar}</div>
              <strong>{employee.name}</strong>
              <span>{employee.title}</span>
              <small>{employee.department} / {employee.location}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="panel focus-panel">
        <p className="eyebrow">Today</p>
        <h2>Operational pulse</h2>
        <div className="pulse-list">
          <Pulse label="Attendance locked" value="92%" />
          <Pulse label="Approvals cleared" value="11/14" />
          <Pulse label="Payroll readiness" value="87%" />
        </div>
      </div>
    </section>
  );
}

function Pulse({ label, value }: { label: string; value: string }) {
  return (
    <div className="pulse-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AttendanceView({
  employees,
  role,
  checkedIn,
  onToggle,
}: {
  employees: Employee[];
  role: Role;
  checkedIn: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="content-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{role === "admin" ? "All employees" : "Personal record"}</p>
            <h2>Attendance register</h2>
          </div>
          <div className={`live-pill ${checkedIn ? "green" : "red"}`}>
            <Fingerprint size={16} />
            {checkedIn ? "Checked in" : "Checked out"}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Work Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="person-cell">
                      <span>{employee.avatar}</span>
                      <div>
                        <strong>{employee.name}</strong>
                        <small>{employee.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>22 Aug 2026</td>
                  <td>{employee.checkIn}</td>
                  <td>{employee.checkOut}</td>
                  <td>{employee.status === "present" ? "09:08" : "00:00"}</td>
                  <td>
                    <span className={`status-badge ${employee.status}`}>{statusLabel[employee.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel action-panel">
        <p className="eyebrow">Self service</p>
        <h2>Mark attendance</h2>
        <div className="clock-face">
          <span>09:04</span>
          <small>current session</small>
        </div>
        <button className="primary-button full" onClick={onToggle}>
          <Fingerprint size={17} />
          {checkedIn ? "Check Out" : "Check In"}
        </button>
      </div>
    </section>
  );
}

function TimeOffView({
  requests,
  role,
  onUpdate,
}: {
  requests: LeaveRequest[];
  role: Role;
  onUpdate: (id: string, status: LeaveStatus) => void;
}) {
  const visibleRequests = role === "employee" ? requests.filter((request) => request.employeeId === employees[0].id) : requests;

  return (
    <section className="content-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Requests</p>
            <h2>{role === "admin" ? "Approval queue" : "My leave calendar"}</h2>
          </div>
          <button className="primary-button">
            <CalendarCheck size={16} />
            New
          </button>
        </div>
        <div className="request-list">
          {visibleRequests.map((request) => (
            <article className="request-card" key={request.id}>
              <div>
                <span className={`request-status ${request.status.toLowerCase()}`}>{request.status}</span>
                <h3>{request.employee}</h3>
                <p>{request.type} / {request.start} to {request.end}</p>
                <small>{request.note}</small>
              </div>
              <strong>{request.allocation} day{request.allocation > 1 ? "s" : ""}</strong>
              {role === "admin" && request.status === "Pending" && (
                <div className="approval-actions">
                  <button title="Approve" onClick={() => onUpdate(request.id, "Approved")}>
                    <Check size={16} />
                  </button>
                  <button title="Reject" onClick={() => onUpdate(request.id, "Rejected")}>
                    <X size={16} />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
      <div className="panel balance-panel">
        <p className="eyebrow">Balances</p>
        <h2>Time-off types</h2>
        <Balance label="Paid Time Off" used={6} total={24} />
        <Balance label="Sick Leave" used={2} total={7} />
        <Balance label="Unpaid Leave" used={1} total={12} />
      </div>
    </section>
  );
}

function Balance({ label, used, total }: { label: string; used: number; total: number }) {
  const percent = Math.round((used / total) * 100);
  return (
    <div className="balance-row">
      <div>
        <span>{label}</span>
        <strong>{total - used} left</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ProfileView({ employee, role }: { employee: Employee; role: Role }) {
  return (
    <section className="content-grid profile-layout">
      <div className="panel profile-hero">
        <div className="large-avatar">{employee.avatar}</div>
        <div>
          <p className="eyebrow">{employee.id}</p>
          <h2>{employee.name}</h2>
          <p>{employee.title} in {employee.department}</p>
        </div>
        <button className="secondary-button">
          <Upload size={16} />
          Avatar
        </button>
      </div>
      <div className="panel details-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{role === "admin" ? "Editable by admin" : "Limited edit"}</p>
            <h2>Private information</h2>
          </div>
          <button className="secondary-button">
            <FileText size={16} />
            Resume
          </button>
        </div>
        <div className="detail-grid">
          <Detail label="Email" value={employee.email} />
          <Detail label="Mobile" value={employee.phone} />
          <Detail label="Department" value={employee.department} />
          <Detail label="Manager" value={employee.manager} />
          <Detail label="Work Location" value={employee.location} />
          <Detail label="Date of Joining" value={employee.joined} />
        </div>
      </div>
      <div className="panel skills-panel">
        <p className="eyebrow">Profile depth</p>
        <h2>Skills & certifications</h2>
        <div className="tag-list">
          {employee.skills.map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SalaryView({ employee, role }: { employee: Employee; role: Role }) {
  return (
    <section className="content-grid">
      <div className="panel wide salary-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{role === "admin" ? "Admin only controls" : "Read only view"}</p>
            <h2>Salary information</h2>
          </div>
          <button className="secondary-button">
            <Download size={16} />
            Slip
          </button>
        </div>
        <div className="salary-summary">
          <div>
            <span>Monthly wage</span>
            <strong>{formatMoney(employee.wage)}</strong>
          </div>
          <div>
            <span>Yearly wage</span>
            <strong>{formatMoney(employee.wage * 12)}</strong>
          </div>
          <div>
            <span>Working days</span>
            <strong>22</strong>
          </div>
        </div>
        <div className="component-list">
          {salaryComponents.map(([label, percent]) => {
            const amount = Math.round((employee.wage * percent) / 100);
            return (
              <div className="component-row" key={label}>
                <span>{label}</span>
                <strong>{formatMoney(amount)}</strong>
                <small>{percent}%</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel formula-panel">
        <p className="eyebrow">Automatic calculation</p>
        <h2>Payroll rules</h2>
        <p>
          Components are calculated from the configured monthly wage and stay within the total wage cap.
        </p>
        <div className="rule-box">
          Basic = 50% of wage
          <br />
          HRA = 50% of Basic
          <br />
          PF / Tax use configured rates
        </div>
      </div>
    </section>
  );
}

export { App };
