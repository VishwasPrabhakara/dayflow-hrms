import {
  Bell,
  BarChart3,
  Building2,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
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
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Role = "admin" | "employee";
type View = "employees" | "attendance" | "timeoff" | "profile" | "salary" | "reports";
type AttendanceStatus = "present" | "leave" | "absent";
type LeaveStatus = "Pending" | "Approved" | "Rejected";
type AttendanceFilter = "all" | AttendanceStatus;

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

const seedEmployees: Employee[] = [
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
  { id: "reports", label: "Reports", icon: BarChart3 },
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

function useStoredState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function initialsFor(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "DF";
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 1;
  const diff = Math.max(0, endDate.getTime() - startDate.getTime());
  return Math.floor(diff / 86400000) + 1;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [employeesData, setEmployeesData] = useStoredState<Employee[]>("dayflow-employees", seedEmployees);
  const [requests, setRequests] = useStoredState<LeaveRequest[]>("dayflow-leave-requests", initialRequests);
  const [role, setRole] = useState<Role>("admin");
  const [activeView, setActiveView] = useState<View>("employees");
  const [selectedId, setSelectedId] = useState(seedEmployees[0].id);
  const [query, setQuery] = useState("");

  const selectedEmployee =
    employeesData.find((employee) => employee.id === selectedId) ?? employeesData[0] ?? seedEmployees[0];
  const selfEmployee = employeesData[0] ?? seedEmployees[0];
  const visibleEmployees = role === "employee" ? [selfEmployee] : employeesData;
  const filteredEmployees = visibleEmployees.filter((employee) => {
    const haystack = `${employee.name} ${employee.title} ${employee.department} ${employee.id}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const metrics = useMemo(() => {
    const present = employeesData.filter((employee) => employee.status === "present").length;
    const pending = requests.filter((request) => request.status === "Pending").length;
    const payroll = employeesData.reduce((sum, employee) => sum + employee.wage, 0);
    return { present, pending, payroll };
  }, [employeesData, requests]);

  function updateRequest(id: string, status: LeaveStatus) {
    setRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status } : request))
    );
  }

  function createRequest(input: Pick<LeaveRequest, "type" | "start" | "end" | "note">) {
    const employee = role === "employee" ? selfEmployee : selectedEmployee;
    const nextRequest: LeaveRequest = {
      id: `LV-${1043 + requests.length}`,
      employeeId: employee.id,
      employee: employee.name,
      type: input.type,
      start: input.start,
      end: input.end,
      allocation: daysBetween(input.start, input.end),
      status: "Pending",
      note: input.note.trim() || "No remarks added.",
    };
    setRequests((current) => [nextRequest, ...current]);
  }

  function createEmployee(input: Omit<Employee, "id" | "avatar" | "status" | "checkIn" | "checkOut">) {
    const serial = String(employeesData.length + 1).padStart(3, "0");
    const nextEmployee: Employee = {
      ...input,
      id: `OD${initialsFor(input.name)}260${serial}`,
      avatar: initialsFor(input.name),
      status: "absent",
      checkIn: "--",
      checkOut: "--",
      wage: Number(input.wage) || 50000,
      skills: input.skills.length ? input.skills : ["Onboarding"],
    };
    setEmployeesData((current) => [nextEmployee, ...current]);
    setSelectedId(nextEmployee.id);
    setActiveView("profile");
  }

  function saveEmployee(id: string, input: Partial<Employee>) {
    setEmployeesData((current) =>
      current.map((employee) =>
        employee.id === id
          ? {
              ...employee,
              ...input,
              avatar: input.name ? initialsFor(input.name) : employee.avatar,
              wage: Number(input.wage ?? employee.wage),
            }
          : employee
      )
    );
  }

  function toggleAttendance() {
    const targetId = role === "employee" ? selfEmployee.id : selectedEmployee.id;
    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    setEmployeesData((current) =>
      current.map((employee) => {
        if (employee.id !== targetId) return employee;
        if (employee.status !== "present") {
          return { ...employee, status: "present", checkIn: time, checkOut: "--" };
        }
        return { ...employee, checkOut: time };
      })
    );
  }

  function resetDemoData() {
    setEmployeesData(seedEmployees);
    setRequests(initialRequests);
    setSelectedId(seedEmployees[0].id);
    setActiveView("employees");
  }

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    setSelectedId(selfEmployee.id);
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
          <button className="ghost-button" onClick={resetDemoData}>
            <RotateCcw size={17} />
            Reset demo
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
          <Metric title="People" value={String(employeesData.length)} note="registered employees" />
          <Metric title="Present Today" value={`${metrics.present}/${employeesData.length}`} note="live attendance" />
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
            onCreate={createEmployee}
          />
        )}

        {activeView === "attendance" && (
          <AttendanceView
            employees={visibleEmployees}
            role={role}
            selectedEmployee={role === "employee" ? selfEmployee : selectedEmployee}
            onToggle={toggleAttendance}
          />
        )}

        {activeView === "timeoff" && (
          <TimeOffView
            requests={requests}
            role={role}
            selfEmployee={selfEmployee}
            onUpdate={updateRequest}
            onCreate={createRequest}
          />
        )}

        {activeView === "profile" && <ProfileView employee={selectedEmployee} role={role} onSave={saveEmployee} />}

        {activeView === "salary" && <SalaryView employee={selectedEmployee} role={role} />}

        {activeView === "reports" && (
          <ReportsView employees={visibleEmployees} allEmployees={employeesData} requests={requests} role={role} />
        )}
      </section>
    </main>
  );
}

function AuthScreen({ onEnter }: { onEnter: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
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
  const emailValid = form.email.includes("@") && form.email.includes(".");
  const passwordValid = /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(form.password);
  const phoneValid = /^\+?\d[\d\s-]{7,}$/.test(form.phone);
  const valid = emailValid && passwordValid && (mode === "signin" || (form.company.trim().length > 2 && phoneValid));

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

        <button
          className="primary-button full auth-submit"
          disabled={!valid}
          onClick={() => {
            setTouched(true);
            if (valid) onEnter();
          }}
        >
          <ShieldCheck size={17} />
          {mode === "signin" ? "Sign In" : "Create HR Workspace"}
        </button>
        {touched && !valid && (
          <div className="validation-box">
            <strong>Validation required</strong>
            <span>{emailValid ? "Email ok" : "Use a valid email address."}</span>
            <span>{passwordValid ? "Password ok" : "Password needs 8 chars, 1 capital, and 1 number."}</span>
            {mode === "signup" && <span>{phoneValid ? "Phone ok" : "Enter a valid phone number."}</span>}
          </div>
        )}
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
  if (view === "reports") return role === "admin" ? "Reports dashboard" : "My reports";
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
  onCreate,
}: {
  employees: Employee[];
  query: string;
  selectedId: string;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate: (input: Omit<Employee, "id" | "avatar" | "status" | "checkIn" | "checkOut">) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    name: "New Employee",
    title: "Operations Associate",
    department: "Operations",
    location: "Bangalore",
    email: "new.employee@dayflow.test",
    phone: "+91 90000 00000",
    manager: "Vishwas P",
    joined: "2026-08-22",
    wage: "54000",
    skills: "Documentation, Attendance, Support",
  });
  const valid = draft.name.trim().length > 2 && draft.email.includes("@") && Number(draft.wage) > 0;

  function submitEmployee() {
    if (!valid) return;
    onCreate({
      ...draft,
      wage: Number(draft.wage),
      skills: draft.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
    });
    setShowForm(false);
  }

  return (
    <section className="content-grid employees-layout">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>People overview</h2>
          </div>
          <button className="primary-button" onClick={() => setShowForm((value) => !value)}>
            <Plus size={16} />
            New
          </button>
        </div>
        {showForm && (
          <div className="inline-form employee-form">
            <TextInput label="Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
            <TextInput label="Job Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
            <TextInput label="Department" value={draft.department} onChange={(value) => setDraft({ ...draft, department: value })} />
            <TextInput label="Location" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value })} />
            <TextInput label="Email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
            <TextInput label="Phone" value={draft.phone} onChange={(value) => setDraft({ ...draft, phone: value })} />
            <TextInput label="Manager" value={draft.manager} onChange={(value) => setDraft({ ...draft, manager: value })} />
            <TextInput label="Monthly Wage" value={draft.wage} onChange={(value) => setDraft({ ...draft, wage: value })} />
            <label className="compact-field span-two">
              <span>Skills</span>
              <input value={draft.skills} onChange={(event) => setDraft({ ...draft, skills: event.target.value })} />
            </label>
            <button className="primary-button span-two" disabled={!valid} onClick={submitEmployee}>
              <Save size={16} />
              Save employee
            </button>
          </div>
        )}
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
  selectedEmployee,
  onToggle,
}: {
  employees: Employee[];
  role: Role;
  selectedEmployee: Employee;
  onToggle: () => void;
}) {
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const isCheckedIn = selectedEmployee.status === "present" && selectedEmployee.checkOut === "--";
  const filteredEmployees = filter === "all" ? employees : employees.filter((employee) => employee.status === filter);

  return (
    <section className="content-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{role === "admin" ? "All employees" : "Personal record"}</p>
            <h2>Attendance register</h2>
          </div>
          <div className={`live-pill ${isCheckedIn ? "green" : "red"}`}>
            <Fingerprint size={16} />
            {isCheckedIn ? "Checked in" : "Ready"}
          </div>
        </div>
        <div className="segmented-row">
          {(["all", "present", "leave", "absent"] as AttendanceFilter[]).map((item) => (
            <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>
              {item === "all" ? "All" : statusLabel[item]}
            </button>
          ))}
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
              {filteredEmployees.map((employee) => (
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
        <div className="mini-stack">
          <div><span>Assigned source</span><strong>Self check-in</strong></div>
          <div><span>Grace window</span><strong>15 min</strong></div>
        </div>
        <div className="clock-face">
          <span>{selectedEmployee.checkIn === "--" ? "00:00" : selectedEmployee.checkIn}</span>
          <small>{selectedEmployee.name}</small>
        </div>
        <button className="primary-button full" onClick={onToggle}>
          <Fingerprint size={17} />
          {isCheckedIn ? "Check Out" : "Check In"}
        </button>
      </div>
    </section>
  );
}

function TimeOffView({
  requests,
  role,
  selfEmployee,
  onUpdate,
  onCreate,
}: {
  requests: LeaveRequest[];
  role: Role;
  selfEmployee: Employee;
  onUpdate: (id: string, status: LeaveStatus) => void;
  onCreate: (input: Pick<LeaveRequest, "type" | "start" | "end" | "note">) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    type: "Paid Time Off" as LeaveRequest["type"],
    start: "2026-08-23",
    end: "2026-08-23",
    note: "Need personal time off.",
  });
  const visibleRequests = role === "employee" ? requests.filter((request) => request.employeeId === selfEmployee.id) : requests;
  const valid = draft.start <= draft.end && draft.note.trim().length > 3;
  const approvedDays = visibleRequests
    .filter((request) => request.status === "Approved")
    .reduce((sum, request) => sum + request.allocation, 0);

  function submitRequest() {
    if (!valid) return;
    onCreate(draft);
    setShowForm(false);
  }

  return (
    <section className="content-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Requests</p>
            <h2>{role === "admin" ? "Approval queue" : "My leave calendar"}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowForm((value) => !value)}>
            <Plus size={16} />
            New
          </button>
        </div>
        {showForm && (
          <div className="inline-form leave-form">
            <label className="compact-field">
              <span>Leave Type</span>
              <select
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value as LeaveRequest["type"] })}
              >
                <option>Paid Time Off</option>
                <option>Sick Leave</option>
                <option>Unpaid Leave</option>
              </select>
            </label>
            <TextInput label="Start Date" type="date" value={draft.start} onChange={(value) => setDraft({ ...draft, start: value })} />
            <TextInput label="End Date" type="date" value={draft.end} onChange={(value) => setDraft({ ...draft, end: value })} />
            <label className="compact-field span-two">
              <span>Remarks</span>
              <input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
            </label>
            <button className="primary-button" disabled={!valid} onClick={submitRequest}>
              <CalendarCheck size={16} />
              Submit request
            </button>
          </div>
        )}
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
        <div className="calendar-strip">
          <CalendarDays size={18} />
          <div>
            <strong>{approvedDays} approved days</strong>
            <span>reflected in payroll basis</span>
          </div>
        </div>
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

function ProfileView({
  employee,
  role,
  onSave,
}: {
  employee: Employee;
  role: Role;
  onSave: (id: string, input: Partial<Employee>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [profileTab, setProfileTab] = useState<"private" | "documents" | "security">("private");
  const [draft, setDraft] = useState({
    name: employee.name,
    title: employee.title,
    department: employee.department,
    location: employee.location,
    email: employee.email,
    phone: employee.phone,
    manager: employee.manager,
    wage: String(employee.wage),
    skills: employee.skills.join(", "),
  });

  useEffect(() => {
    setDraft({
      name: employee.name,
      title: employee.title,
      department: employee.department,
      location: employee.location,
      email: employee.email,
      phone: employee.phone,
      manager: employee.manager,
      wage: String(employee.wage),
      skills: employee.skills.join(", "),
    });
  }, [employee]);

  function saveProfile() {
    const adminFields =
      role === "admin"
        ? {
            name: draft.name,
            title: draft.title,
            department: draft.department,
            location: draft.location,
            manager: draft.manager,
            wage: Number(draft.wage),
            skills: draft.skills
              .split(",")
              .map((skill) => skill.trim())
              .filter(Boolean),
          }
        : {};
    onSave(employee.id, {
      ...adminFields,
      email: draft.email,
      phone: draft.phone,
    });
    setEditing(false);
  }

  return (
    <section className="content-grid profile-layout">
      <div className="panel profile-hero">
        <div className="large-avatar">{employee.avatar}</div>
        <div>
          <p className="eyebrow">{employee.id}</p>
          <h2>{employee.name}</h2>
          <p>{employee.title} in {employee.department}</p>
        </div>
        <button className="secondary-button" onClick={() => setEditing((value) => !value)}>
          <Save size={16} />
          {editing ? "Close" : "Edit"}
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
        <div className="profile-tabs">
          <button className={profileTab === "private" ? "active" : ""} onClick={() => setProfileTab("private")}>Private Info</button>
          <button className={profileTab === "documents" ? "active" : ""} onClick={() => setProfileTab("documents")}>Documents</button>
          <button className={profileTab === "security" ? "active" : ""} onClick={() => setProfileTab("security")}>Security</button>
        </div>
        {profileTab === "private" && (
          <div className="detail-grid">
            {editing ? (
              <>
                {role === "admin" && (
                  <>
                    <TextInput label="Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
                    <TextInput label="Job Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
                    <TextInput label="Department" value={draft.department} onChange={(value) => setDraft({ ...draft, department: value })} />
                    <TextInput label="Location" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value })} />
                    <TextInput label="Manager" value={draft.manager} onChange={(value) => setDraft({ ...draft, manager: value })} />
                    <TextInput label="Monthly Wage" value={draft.wage} onChange={(value) => setDraft({ ...draft, wage: value })} />
                  </>
                )}
                <TextInput label="Email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
                <TextInput label="Mobile" value={draft.phone} onChange={(value) => setDraft({ ...draft, phone: value })} />
                <button className="primary-button span-two" onClick={saveProfile}>
                  <Save size={16} />
                  Save profile
                </button>
              </>
            ) : (
              <>
                <Detail label="Email" value={employee.email} />
                <Detail label="Mobile" value={employee.phone} />
                <Detail label="Department" value={employee.department} />
                <Detail label="Manager" value={employee.manager} />
                <Detail label="Work Location" value={employee.location} />
                <Detail label="Date of Joining" value={employee.joined} />
              </>
            )}
          </div>
        )}
        {profileTab === "documents" && (
          <div className="document-list">
            <DocRow title="Resume" detail="Uploaded / visible to HR" />
            <DocRow title="Bank Proof" detail="Verified for payroll" />
            <DocRow title="Identity Document" detail={role === "admin" ? "Admin can verify" : "Read only"} />
          </div>
        )}
        {profileTab === "security" && (
          <div className="security-grid">
            <Detail label="Login ID" value={employee.id} />
            <Detail label="Role Access" value={role === "admin" ? "Admin / HR Officer" : "Employee"} />
            <Detail label="Password Policy" value="Strong password enforced" />
            <Detail label="Last Login" value="22 Aug 2026, 09:04" />
          </div>
        )}
      </div>
      <div className="panel skills-panel">
        <p className="eyebrow">Profile depth</p>
        <h2>Skills & certifications</h2>
        {editing && role === "admin" ? (
          <div className="inline-form">
            <label className="compact-field span-two">
              <span>Skills</span>
              <input value={draft.skills} onChange={(event) => setDraft({ ...draft, skills: event.target.value })} />
            </label>
          </div>
        ) : (
          <div className="tag-list">
            {employee.skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DocRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="doc-row">
      <FileText size={18} />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <button className="secondary-button">
        <Upload size={15} />
        Upload
      </button>
    </div>
  );
}

function TextInput({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="compact-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
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
        {role === "employee" && (
          <div className="access-note">
            <WalletCards size={18} />
            Employees can view salary information in read-only mode. Admin controls salary structure.
          </div>
        )}
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

function ReportsView({
  employees,
  allEmployees,
  requests,
  role,
}: {
  employees: Employee[];
  allEmployees: Employee[];
  requests: LeaveRequest[];
  role: Role;
}) {
  const scopeRequests =
    role === "employee" ? requests.filter((request) => request.employeeId === employees[0]?.id) : requests;
  const present = employees.filter((employee) => employee.status === "present").length;
  const onLeave = employees.filter((employee) => employee.status === "leave").length;
  const absent = employees.filter((employee) => employee.status === "absent").length;
  const approved = scopeRequests.filter((request) => request.status === "Approved").length;
  const pending = scopeRequests.filter((request) => request.status === "Pending").length;
  const rejected = scopeRequests.filter((request) => request.status === "Rejected").length;
  const payroll = employees.reduce((sum, employee) => sum + employee.wage, 0);

  function exportAttendance() {
    const header = "Employee ID,Name,Department,Status,Check In,Check Out,Monthly Wage";
    const rows = employees.map((employee) =>
      [employee.id, employee.name, employee.department, statusLabel[employee.status], employee.checkIn, employee.checkOut, employee.wage].join(",")
    );
    downloadTextFile("dayflow-attendance-report.csv", [header, ...rows].join("\n"));
  }

  function exportLeave() {
    const header = "Request ID,Employee,Type,Start,End,Days,Status,Note";
    const rows = scopeRequests.map((request) =>
      [
        request.id,
        request.employee,
        request.type,
        request.start,
        request.end,
        request.allocation,
        request.status,
        `"${request.note.replaceAll('"', '""')}"`,
      ].join(",")
    );
    downloadTextFile("dayflow-leave-report.csv", [header, ...rows].join("\n"));
  }

  return (
    <section className="content-grid">
      <div className="panel wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Analytics</p>
            <h2>{role === "admin" ? "Company reports" : "Personal reports"}</h2>
          </div>
          <div className="report-actions">
            <button className="secondary-button" onClick={exportAttendance}>
              <Download size={16} />
              Attendance CSV
            </button>
            <button className="secondary-button" onClick={exportLeave}>
              <Download size={16} />
              Leave CSV
            </button>
          </div>
        </div>

        <div className="report-grid">
          <ReportCard title="Attendance Health" value={`${present}/${employees.length}`} note="employees marked present">
            <StackedBar
              items={[
                { label: "Present", value: present, className: "present" },
                { label: "Leave", value: onLeave, className: "leave" },
                { label: "Absent", value: absent, className: "absent" },
              ]}
              total={Math.max(1, employees.length)}
            />
          </ReportCard>
          <ReportCard title="Leave Decisions" value={`${approved} approved`} note={`${pending} pending / ${rejected} rejected`}>
            <StackedBar
              items={[
                { label: "Approved", value: approved, className: "present" },
                { label: "Pending", value: pending, className: "leave" },
                { label: "Rejected", value: rejected, className: "absent" },
              ]}
              total={Math.max(1, scopeRequests.length)}
            />
          </ReportCard>
          <ReportCard title="Payroll Run" value={formatMoney(payroll)} note="current monthly liability">
            <div className="payroll-meter">
              <span style={{ width: `${Math.min(100, Math.round((payroll / Math.max(1, allEmployees.length * 90000)) * 100))}%` }} />
            </div>
          </ReportCard>
        </div>

        <div className="insight-list">
          <Insight title="Attendance basis" detail="Attendance records feed payroll working-day calculations." />
          <Insight title="Leave basis" detail="Approved leaves are counted separately from absences for salary accuracy." />
          <Insight title="Offline ready" detail="Reports are generated locally from the current browser data set." />
        </div>
      </div>

      <div className="panel formula-panel">
        <p className="eyebrow">Demo script</p>
        <h2>Best flow to show</h2>
        <ol className="demo-steps">
          <li>Sign in and show role switch.</li>
          <li>Create or edit an employee.</li>
          <li>Check attendance and filter status.</li>
          <li>Submit a leave request, then approve it as admin.</li>
          <li>Open salary and reports, export CSV.</li>
        </ol>
      </div>
    </section>
  );
}

function ReportCard({
  title,
  value,
  note,
  children,
}: {
  title: string;
  value: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <article className="report-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{note}</p>
      {children}
    </article>
  );
}

function StackedBar({
  items,
  total,
}: {
  items: { label: string; value: number; className: string }[];
  total: number;
}) {
  return (
    <div className="stacked-wrap">
      <div className="stacked-bar">
        {items.map((item) => (
          <span
            className={item.className}
            key={item.label}
            title={`${item.label}: ${item.value}`}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="stacked-legend">
        {items.map((item) => (
          <span key={item.label}>{item.label}: {item.value}</span>
        ))}
      </div>
    </div>
  );
}

function Insight({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="insight-row">
      <Check size={17} />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

export { App };
