import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./crypto.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, "..", "data"), { recursive: true });
mkdirSync(join(__dirname, "..", "data", "uploads"), { recursive: true });

export const db = new DatabaseSync(join(__dirname, "..", "data", "dayflow.sqlite"));
export const uploadsDir = join(__dirname, "..", "data", "uploads");

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    address TEXT DEFAULT '',
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    manager TEXT NOT NULL,
    joined TEXT NOT NULL,
    wage INTEGER NOT NULL,
    skills_json TEXT NOT NULL,
    avatar TEXT NOT NULL,
    profile_photo_url TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS job_profiles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    skills_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(role IN ('admin','employee')),
    employee_id TEXT REFERENCES employees(id),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    work_date TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    status TEXT NOT NULL CHECK(status IN ('Present','Absent','Half-day','Leave')),
    work_hours REAL NOT NULL DEFAULT 0,
    extra_hours REAL NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    UNIQUE(employee_id, work_date)
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    type TEXT NOT NULL CHECK(type IN ('Paid','Sick','Unpaid')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days INTEGER NOT NULL,
    remarks TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending','Approved','Rejected')) DEFAULT 'Pending',
    admin_comment TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS salary_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    label TEXT NOT NULL,
    percent REAL NOT NULL,
    amount INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS otp_challenges (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS employee_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending','Approved','Rejected')) DEFAULT 'Pending',
    admin_comment TEXT DEFAULT '',
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

if (!hasColumn("employees", "profile_photo_url")) {
  db.prepare("ALTER TABLE employees ADD COLUMN profile_photo_url TEXT DEFAULT ''").run();
}

if (!hasColumn("attendance", "work_hours")) {
  db.prepare("ALTER TABLE attendance ADD COLUMN work_hours REAL NOT NULL DEFAULT 0").run();
}

if (!hasColumn("attendance", "extra_hours")) {
  db.prepare("ALTER TABLE attendance ADD COLUMN extra_hours REAL NOT NULL DEFAULT 0").run();
}

if (!hasColumn("attendance", "note")) {
  db.prepare("ALTER TABLE attendance ADD COLUMN note TEXT DEFAULT ''").run();
}

export function initialsFor(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "DF";
}

function insertSalary(employeeId, wage) {
  const components = [
    ["Basic Salary", 50],
    ["House Rent Allowance", 25],
    ["Performance Bonus", 9.33],
    ["Travel Allowance", 8.33],
    ["PF Allowance", 11.67],
  ];
  const stmt = db.prepare("INSERT INTO salary_components (employee_id, label, percent, amount) VALUES (?, ?, ?, ?)");
  for (const [label, percent] of components) {
    stmt.run(employeeId, label, percent, Math.round((wage * percent) / 100));
  }
}

export function refreshSalary(employeeId, wage) {
  db.prepare("DELETE FROM salary_components WHERE employee_id = ?").run(employeeId);
  insertSalary(employeeId, wage);
}

export function createEmployeeId(name) {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = db.prepare("SELECT COUNT(*) AS count FROM employees").get().count + 1;
  return `OD${initialsFor(name)}${year}${String(count).padStart(3, "0")}`;
}

export function rowToEmployee(row) {
  return {
    ...row,
    profilePhotoUrl: row.profile_photo_url || "",
    accountVerified: row.account_verified === undefined ? null : Boolean(row.account_verified),
    mustChangePassword: row.must_change_password === undefined ? null : Boolean(row.must_change_password),
    skills: JSON.parse(row.skills_json || "[]"),
  };
}

const jobProfiles = [
  { id: "frontend-engineer", title: "Frontend Engineer", department: "Product", skills: ["React", "TypeScript", "UI Systems", "API Integration"] },
  { id: "backend-engineer", title: "Backend Engineer", department: "Engineering", skills: ["Node.js", "SQLite", "REST APIs", "Security"] },
  { id: "hr-officer", title: "HR Officer", department: "People Ops", skills: ["Hiring", "Onboarding", "Compliance", "Payroll"] },
  { id: "payroll-specialist", title: "Payroll Specialist", department: "Finance", skills: ["Salary Structuring", "Tax", "PF/ESI", "Reporting"] },
  { id: "qa-engineer", title: "QA Engineer", department: "Quality", skills: ["Test Cases", "Automation", "Bug Reports", "Regression"] },
];

if (db.prepare("SELECT COUNT(*) AS count FROM job_profiles").get().count === 0) {
  const insertProfile = db.prepare("INSERT INTO job_profiles (id, title, department, skills_json) VALUES (?, ?, ?, ?)");
  for (const profile of jobProfiles) {
    insertProfile.run(profile.id, profile.title, profile.department, JSON.stringify(profile.skills));
  }
}

if (db.prepare("SELECT COUNT(*) AS count FROM employees").get().count === 0) {
  const employees = [
    {
      id: "ODOJO23001",
      name: "Vishwas P",
      email: "vishwas@dayflow.local",
      phone: "+91 98765 43210",
      address: "Yelahanka, Bangalore",
      title: "Frontend Engineer",
      department: "Product",
      location: "Bangalore",
      manager: "Nikhil Joshi",
      joined: "2023-07-22",
      wage: 75000,
      skills: ["React", "UI Systems", "Payroll"],
    },
    {
      id: "ODOAN24002",
      name: "Anika Rao",
      email: "anika@dayflow.local",
      phone: "+91 99887 12345",
      address: "Indiranagar, Bangalore",
      title: "HR Officer",
      department: "People Ops",
      location: "Bangalore",
      manager: "Nikhil Joshi",
      joined: "2024-01-08",
      wage: 68000,
      skills: ["Hiring", "Compliance", "Training"],
    },
  ];

  const insertEmployee = db.prepare(`
    INSERT INTO employees
    (id, name, email, phone, address, title, department, location, manager, joined, wage, skills_json, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const employee of employees) {
    insertEmployee.run(
      employee.id,
      employee.name,
      employee.email,
      employee.phone,
      employee.address,
      employee.title,
      employee.department,
      employee.location,
      employee.manager,
      employee.joined,
      employee.wage,
      JSON.stringify(employee.skills),
      initialsFor(employee.name)
    );
    insertSalary(employee.id, employee.wage);
  }

  db.prepare(`
    INSERT INTO users (role, employee_id, email, password_hash, verified, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("admin", null, "hr@dayflow.local", hashPassword("Admin@2026"), 1, 0);

  db.prepare(`
    INSERT INTO users (role, employee_id, email, password_hash, verified, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("employee", "ODOJO23001", "vishwas@dayflow.local", hashPassword("Welcome@2026"), 1, 1);

  const today = new Date().toISOString().slice(0, 10);
  db.prepare("INSERT INTO attendance (employee_id, work_date, check_in, check_out, status) VALUES (?, ?, ?, ?, ?)").run(
    "ODOJO23001",
    today,
    "09:04",
    null,
    "Present"
  );
  db.prepare("INSERT INTO attendance (employee_id, work_date, check_in, check_out, status) VALUES (?, ?, ?, ?, ?)").run(
    "ODOAN24002",
    today,
    null,
    null,
    "Leave"
  );
}
