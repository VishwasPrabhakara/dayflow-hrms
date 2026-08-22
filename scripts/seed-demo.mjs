import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db, initialsFor, refreshSalary, uploadsDir } from "../server/db.js";
import { hashPassword } from "../server/crypto.js";

const apiPort = Number(process.env.API_PORT || 4000);

const employees = [
  ["ODOME24004", "Meera Iyer", "meera@dayflow.local", "+91 90000 11122", "Whitefield, Bangalore", "QA Engineer", "Quality", "Bangalore", "Anika Rao", "2024-03-11", 62000, ["Test Cases", "Automation", "Bug Reports"]],
  ["ODORA25005", "Rohan Achar", "rohan@dayflow.local", "+91 90000 22233", "Hebbal, Bangalore", "Backend Engineer", "Engineering", "Bangalore", "Vishwas P", "2025-02-03", 82000, ["Node.js", "SQLite", "REST APIs"]],
  ["ODOPR25006", "Priya Menon", "priya@dayflow.local", "+91 90000 33344", "Jayanagar, Bangalore", "Payroll Specialist", "Finance", "Bangalore", "Anika Rao", "2025-05-19", 72000, ["Salary Structuring", "Tax", "Reporting"]],
];

function insertEmployee(row) {
  const [id, name, email, phone, address, title, department, location, manager, joined, wage, skills] = row;
  if (!db.prepare("SELECT id FROM employees WHERE id = ?").get(id)) {
    db.prepare(`
      INSERT INTO employees
      (id, name, email, phone, address, title, department, location, manager, joined, wage, skills_json, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email, phone, address, title, department, location, manager, joined, wage, JSON.stringify(skills), initialsFor(name));
    refreshSalary(id, wage);
  }
  if (!db.prepare("SELECT id FROM users WHERE employee_id = ?").get(id)) {
    db.prepare(`
      INSERT INTO users (role, employee_id, email, password_hash, verified, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("employee", id, email, hashPassword("Welcome@2026"), 1, 0);
  }
}

function upsertAttendance(employeeId, workDate, checkIn, checkOut, status, hours, extra, note) {
  db.prepare(`
    INSERT INTO attendance (employee_id, work_date, check_in, check_out, status, work_hours, extra_hours, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id, work_date) DO UPDATE SET
      check_in = excluded.check_in,
      check_out = excluded.check_out,
      status = excluded.status,
      work_hours = excluded.work_hours,
      extra_hours = excluded.extra_hours,
      note = excluded.note
  `).run(employeeId, workDate, checkIn, checkOut, status, hours, extra, note);
}

function insertLeave(employeeId, type, startDate, endDate, days, remarks, status, comment = "") {
  const existing = db.prepare(`
    SELECT id FROM leave_requests
    WHERE employee_id = ? AND type = ? AND start_date = ? AND end_date = ?
  `).get(employeeId, type, startDate, endDate);
  if (existing) return;
  db.prepare(`
    INSERT INTO leave_requests (employee_id, type, start_date, end_date, days, remarks, status, admin_comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(employeeId, type, startDate, endDate, days, remarks, status, comment);
}

function insertDocument(employeeId, type, status) {
  const existing = db.prepare("SELECT id FROM employee_documents WHERE employee_id = ? AND type = ?").get(employeeId, type);
  if (existing) return;
  mkdirSync(uploadsDir, { recursive: true });
  const fileName = `${employeeId}-${type.toLowerCase().replace(/\s+/g, "-")}.txt`;
  writeFileSync(join(uploadsDir, fileName), `${type} placeholder for ${employeeId}\n`);
  db.prepare(`
    INSERT INTO employee_documents (employee_id, type, file_name, mime_type, file_url, status, admin_comment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(employeeId, type, fileName, "text/plain", `http://127.0.0.1:${apiPort}/uploads/${fileName}`, status, status === "Approved" ? "Verified for demo" : "");
}

for (const employee of employees) insertEmployee(employee);

const attendancePlan = [
  ["ODOJO23001", "2026-08-19", "09:00", "18:10", "Present", 9.17, 1.17, "Demo attendance"],
  ["ODOJO23001", "2026-08-20", "09:20", "15:00", "Half-day", 5.67, 0, "Short day"],
  ["ODOAN24002", "2026-08-19", "09:10", "18:00", "Present", 8.83, 0.83, "Demo attendance"],
  ["ODOME24004", "2026-08-19", "09:02", "18:20", "Present", 9.3, 1.3, "Demo attendance"],
  ["ODOME24004", "2026-08-20", null, null, "Absent", 0, 0, "Uninformed absence"],
  ["ODORA25005", "2026-08-19", "08:55", "18:30", "Present", 9.58, 1.58, "Release support"],
  ["ODOPR25006", "2026-08-19", "09:30", "18:00", "Present", 8.5, 0.5, "Payroll close"],
];
for (const row of attendancePlan) upsertAttendance(...row);

insertLeave("ODOJO23001", "Paid", "2026-08-25", "2026-08-26", 2, "Family function", "Approved", "Approved");
insertLeave("ODOME24004", "Sick", "2026-08-27", "2026-08-27", 1, "Medical appointment", "Pending");
insertLeave("ODORA25005", "Unpaid", "2026-09-03", "2026-09-04", 2, "Personal travel", "Rejected", "Project handover pending");

for (const employeeId of ["ODOJO23001", "ODOAN24002", "ODOME24004", "ODORA25005", "ODOPR25006"]) {
  insertDocument(employeeId, "Resume", "Approved");
  insertDocument(employeeId, "ID Proof", employeeId === "ODOME24004" ? "Pending" : "Approved");
  insertDocument(employeeId, "Bank Proof", employeeId === "ODORA25005" ? "Rejected" : "Approved");
}

db.prepare(`
  INSERT INTO activity_logs (actor_role, actor_email, action, entity_type, entity_id, detail)
  VALUES (?, ?, ?, ?, ?, ?)
`).run("system", "seed-demo", "seeded demo data", "system", "demo", "Employees, attendance, leaves, documents");

console.log("Demo data is ready.");
