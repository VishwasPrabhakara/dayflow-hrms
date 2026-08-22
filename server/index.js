import "node:sqlite";
import "./env.js";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { db, createEmployeeId, initialsFor, refreshSalary, rowToEmployee, uploadsDir } from "./db.js";
import { hashPassword, randomOtp, randomToken, verifyPassword } from "./crypto.js";
import { sendEmployeeInviteEmail, sendOtpEmail } from "./mail.js";
import { createPayslipPdfBuffer } from "./pdf.js";

const app = express();
const sessions = new Map();
const pendingLogins = new Map();
const __dirname = dirname(fileURLToPath(import.meta.url));
const documentTypes = new Set(["Profile Photo", "Resume", "ID Proof", "Bank Proof", "Offer Letter", "Education Certificate", "Experience Letter", "Other"]);
const leaveEntitlements = { Paid: 24, Sick: 7, Unpaid: 0 };
const attendanceStatuses = new Set(["Present", "Absent", "Half-day", "Leave"]);

app.use(cors({ origin: "http://127.0.0.1:5173" }));
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(join(__dirname, "..", "data", "uploads")));

function publicUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  const port = Number(process.env.API_PORT || 4000);
  return `http://127.0.0.1:${port}${path.startsWith("/") ? path : `/${path}`}`;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = token ? sessions.get(token) : null;
  if (!session) return res.status(401).json({ error: "Authentication required." });
  req.user = session;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin/HR access required." });
  next();
}

function sessionFor(user) {
  const token = randomToken();
  const session = {
    id: user.id,
    role: user.role,
    employeeId: user.employee_id,
    email: user.email,
    mustChangePassword: Boolean(user.must_change_password),
  };
  sessions.set(token, session);
  return { token, user: session };
}

function temporaryPassword() {
  return `${randomToken().slice(0, 5)}${randomOtp()}A`;
}

function validatePassword(password) {
  return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isPhone(value) {
  return /^[+()\-\s\d]{8,18}$/.test(String(value || "").trim());
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTime(value) {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
}

function assertEmployeeInput({ name, email, phone, address, joined, salary }) {
  if (!String(name || "").trim()) throw new Error("Employee name is required.");
  if (!isEmail(email)) throw new Error("Enter a valid employee email address.");
  if (!isPhone(phone)) throw new Error("Enter a valid phone number.");
  if (!String(address || "").trim()) throw new Error("Address is required.");
  if (!isDate(joined)) throw new Error("Choose a valid joining date.");
  if (!Number.isFinite(Number(salary)) || Number(salary) <= 0) throw new Error("Monthly salary must be greater than zero.");
}

function logActivity(user, action, entityType, entityId, detail = "") {
  const actorRole = user?.role || "system";
  const actorEmail = user?.email || "system";
  db.prepare(`
    INSERT INTO activity_logs (actor_role, actor_email, action, entity_type, entity_id, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorRole, actorEmail, action, entityType, String(entityId), detail);
}

function minutesFor(time) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function attendanceTotals(checkIn, checkOut, preferredStatus = "Present") {
  const start = minutesFor(checkIn);
  const end = minutesFor(checkOut);
  if (checkIn && start === null) throw new Error("Check-in time is invalid.");
  if (checkOut && end === null) throw new Error("Check-out time is invalid.");
  if (start !== null && end !== null && end <= start) throw new Error("Check-out must be after check-in.");
  let workHours = 0;
  if (start !== null && end !== null && end > start) {
    workHours = Math.round(((end - start) / 60) * 100) / 100;
  }
  const status = ["Absent", "Leave"].includes(preferredStatus)
    ? preferredStatus
    : workHours > 0 && workHours < 6
      ? "Half-day"
      : preferredStatus;
  return {
    status,
    workHours: ["Absent", "Leave"].includes(status) ? 0 : workHours,
    extraHours: ["Absent", "Leave"].includes(status) ? 0 : Math.max(0, Math.round((workHours - 8) * 100) / 100),
  };
}

function datesBetween(startDate, endDate) {
  const dates = [];
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function leaveBalanceFor(employeeId) {
  const approved = db
    .prepare("SELECT type, SUM(days) AS days FROM leave_requests WHERE employee_id = ? AND status = 'Approved' GROUP BY type")
    .all(employeeId)
    .reduce((acc, row) => ({ ...acc, [row.type]: Number(row.days || 0) }), {});
  const pending = db
    .prepare("SELECT type, SUM(days) AS days FROM leave_requests WHERE employee_id = ? AND status = 'Pending' GROUP BY type")
    .all(employeeId)
    .reduce((acc, row) => ({ ...acc, [row.type]: Number(row.days || 0) }), {});
  return Object.keys(leaveEntitlements).map((type) => ({
    employeeId,
    type,
    entitlement: leaveEntitlements[type],
    approved: approved[type] || 0,
    pending: pending[type] || 0,
    remaining: Math.max(0, leaveEntitlements[type] - (approved[type] || 0)),
  }));
}

function writeLeaveAttendance(leave) {
  for (const workDate of datesBetween(leave.start_date, leave.end_date)) {
    db.prepare(`
      INSERT INTO attendance (employee_id, work_date, check_in, check_out, status, work_hours, extra_hours, note)
      VALUES (?, ?, NULL, NULL, 'Leave', 0, 0, ?)
      ON CONFLICT(employee_id, work_date) DO UPDATE SET
        check_in = NULL,
        check_out = NULL,
        status = 'Leave',
        work_hours = 0,
        extra_hours = 0,
        note = excluded.note
    `).run(leave.employee_id, workDate, `${leave.type} leave approved`);
  }
}

function workingDaysInMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, monthNumber - 1, 1));
  let days = 0;
  while (cursor.getUTCMonth() === monthNumber - 1) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function payrollFor(employee, month) {
  const attendance = db.prepare("SELECT * FROM attendance WHERE employee_id = ? AND work_date LIKE ?").all(employee.id, `${month}%`);
  const components = db.prepare("SELECT label, percent, amount FROM salary_components WHERE employee_id = ?").all(employee.id);
  const presentDays = attendance.filter((row) => row.status === "Present").length;
  const halfDays = attendance.filter((row) => row.status === "Half-day").length;
  const leaveDays = attendance.filter((row) => row.status === "Leave").length;
  const absentDays = attendance.filter((row) => row.status === "Absent").length;
  const totalHours = attendance.reduce((sum, row) => sum + Number(row.work_hours || 0), 0);
  const extraHours = attendance.reduce((sum, row) => sum + Number(row.extra_hours || 0), 0);
  const workingDays = workingDaysInMonth(month);
  const payableDays = Math.max(0, presentDays + leaveDays + halfDays * 0.5);
  const unpaidDays = Math.max(0, absentDays + halfDays * 0.5);
  const dailyRate = workingDays ? employee.wage / workingDays : 0;
  const hourlyRate = employee.wage / Math.max(1, workingDays * 8);
  const deduction = Math.round(dailyRate * unpaidDays);
  const extraPay = Math.round(hourlyRate * extraHours);
  const grossPay = Math.round(employee.wage + extraPay);
  const netPay = Math.max(0, grossPay - deduction);
  return {
    employeeId: employee.id,
    name: employee.name,
    month,
    salary: employee.wage,
    workingDays,
    presentDays,
    halfDays,
    leaveDays,
    absentDays,
    payableDays,
    unpaidDays,
    totalHours: Math.round(totalHours * 100) / 100,
    extraHours: Math.round(extraHours * 100) / 100,
    dailyRate: Math.round(dailyRate),
    hourlyRate: Math.round(hourlyRate),
    extraPay,
    deduction,
    grossPay,
    netPay,
    components,
  };
}

function inr(value) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

function saveUploadedFile(file) {
  if (!file?.dataUrl || !file?.fileName || !file?.mimeType) throw new Error("Each upload needs a file name, type, and content.");
  const match = /^data:([^;]+);base64,(.+)$/.exec(file.dataUrl);
  if (!match) throw new Error("Upload content is invalid.");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) throw new Error("Each file must be 5 MB or smaller.");
  const safeExt = extname(file.fileName).toLowerCase().replace(/[^.\w]/g, "") || ".bin";
  const storedName = `${randomToken()}${safeExt}`;
  writeFileSync(join(uploadsDir, storedName), buffer);
  return publicUrl(`/uploads/${storedName}`);
}

function removeStoredFile(fileUrl) {
  if (!fileUrl) return;
  try {
    const url = new URL(fileUrl, "http://127.0.0.1");
    if (!url.pathname.startsWith("/uploads/")) return;
    const filePath = join(uploadsDir, url.pathname.replace("/uploads/", ""));
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    return;
  }
}

function insertDocument(employeeId, doc) {
  if (!documentTypes.has(doc.type)) throw new Error(`Unsupported document type: ${doc.type}`);
  const fileUrl = saveUploadedFile(doc);
  db.prepare(`
    INSERT INTO employee_documents (employee_id, type, file_name, mime_type, file_url, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employeeId, doc.type, doc.fileName, doc.mimeType, fileUrl, "Pending");
  if (doc.type === "Profile Photo") {
    db.prepare("UPDATE employees SET profile_photo_url = ? WHERE id = ?").run(fileUrl, employeeId);
  }
}

function rowToDocument(row) {
  return {
    ...row,
    file_url: publicUrl(row.file_url),
  };
}

function employeeByUser(user) {
  if (!user.employeeId) return null;
  const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(user.employeeId);
  return row ? rowToEmployee(row) : null;
}

async function createOtpChallenge({ email, purpose, payload, name }) {
  const id = randomToken();
  const code = randomOtp();
  db.prepare("UPDATE otp_challenges SET used = 1 WHERE email = ? AND purpose = ? AND used = 0").run(email, purpose);
  db.prepare(`
    INSERT INTO otp_challenges (id, email, code, purpose, payload_json, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, email, code, purpose, JSON.stringify(payload), Date.now() + 10 * 60 * 1000);
  await sendOtpEmail({ to: email, name, otp: code, purpose });
  return { challengeId: id };
}

function verifyChallenge(challengeId, otp, purpose) {
  const challenge = db.prepare("SELECT * FROM otp_challenges WHERE id = ?").get(challengeId);
  if (!challenge || challenge.used) throw new Error("Invalid or expired OTP challenge.");
  if (challenge.purpose !== purpose) throw new Error("Invalid OTP purpose.");
  if (challenge.expires_at < Date.now()) throw new Error("OTP has expired.");
  if (challenge.code !== otp) throw new Error("Invalid OTP.");
  db.prepare("UPDATE otp_challenges SET used = 1 WHERE id = ?").run(challengeId);
  return JSON.parse(challenge.payload_json);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, database: "sqlite", dynamicData: true });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: "Email/Employee ID and password are required." });

    const user = db
      .prepare(
        `SELECT users.* FROM users
         LEFT JOIN employees ON employees.id = users.employee_id
         WHERE users.email = ? OR employees.id = ?`
      )
      .get(identifier, identifier);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Incorrect credentials." });
    }

    if (user.role === "admin") return res.json(sessionFor(user));

    const challenge = await createOtpChallenge({
      email: user.email,
      purpose: "employee-login",
      payload: { userId: user.id },
      name: employeeByUser({ employeeId: user.employee_id })?.name,
    });
    pendingLogins.set(challenge.challengeId, user.id);
    res.json({ requiresOtp: true, ...challenge });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post("/api/auth/verify-login-otp", (req, res) => {
  try {
    const { challengeId, otp } = req.body;
    const payload = verifyChallenge(challengeId, otp, "employee-login");
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    pendingLogins.delete(challengeId);
    res.json(sessionFor(user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/signup/request-otp", async (req, res) => {
  try {
    const { role = "admin", employeeId, name, email, password } = req.body;
    if (!["admin", "employee"].includes(role)) return res.status(400).json({ error: "Choose a valid role." });
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password needs 8 characters, one capital letter, and one number." });
    }

    if (role === "admin") {
      if (!name) return res.status(400).json({ error: "Name is required for Admin/HR signup." });
      if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
        return res.status(409).json({ error: "An account already exists for this email." });
      }
      return res.json(
        await createOtpChallenge({
          email,
          purpose: "signup",
          payload: { role, name, email, password },
          name,
        })
      );
    }

    if (!employeeId) return res.status(400).json({ error: "Employee ID is required for employee signup." });
    const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(employeeId.trim().toUpperCase());
    if (!employee) return res.status(404).json({ error: "Employee record not found. Ask HR to create your profile first." });
    if (employee.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ error: "Email must match the employee profile created by HR." });
    }
    const existingUser = db.prepare("SELECT id, verified FROM users WHERE employee_id = ? OR email = ?").get(employee.id, email);
    if (existingUser?.verified) return res.status(409).json({ error: "This employee account is already active." });

    res.json(
      await createOtpChallenge({
        email,
        purpose: "signup",
        payload: { role, employeeId: employee.id, email, password },
        name: employee.name,
      })
    );
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post("/api/auth/signup/verify", (req, res) => {
  try {
    const payload = verifyChallenge(req.body.challengeId, req.body.otp, "signup");
    if (payload.role === "employee") {
      const existingUser = db.prepare("SELECT id FROM users WHERE employee_id = ? OR email = ?").get(payload.employeeId, payload.email);
      if (existingUser) {
        db.prepare("UPDATE users SET email = ?, password_hash = ?, verified = 1, must_change_password = 0 WHERE id = ?").run(
          payload.email,
          hashPassword(payload.password),
          existingUser.id
        );
      } else {
        db.prepare(`
          INSERT INTO users (role, employee_id, email, password_hash, verified, must_change_password)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run("employee", payload.employeeId, payload.email, hashPassword(payload.password), 1, 0);
      }
    } else {
      db.prepare(`
        INSERT INTO users (role, employee_id, email, password_hash, verified, must_change_password)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("admin", null, payload.email, hashPassword(payload.password), 1, 0);
    }
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(payload.email);
    res.json(sessionFor(user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/password/request-reset", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: "Email or Employee ID is required." });
    const user = db
      .prepare(
        `SELECT users.*, employees.name FROM users
         LEFT JOIN employees ON employees.id = users.employee_id
         WHERE users.email = ? OR employees.id = ?`
      )
      .get(identifier, identifier.trim().toUpperCase());
    if (!user) return res.status(404).json({ error: "No account found for these details." });
    res.json(
      await createOtpChallenge({
        email: user.email,
        purpose: "password-reset",
        payload: { userId: user.id },
        name: user.name,
      })
    );
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post("/api/auth/password/verify-reset", (req, res) => {
  try {
    const { challengeId, otp, password } = req.body;
    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password needs 8 characters, one capital letter, and one number." });
    }
    const payload = verifyChallenge(challengeId, otp, "password-reset");
    db.prepare("UPDATE users SET password_hash = ?, verified = 1, must_change_password = 0 WHERE id = ?").run(
      hashPassword(password),
      payload.userId
    );
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId);
    res.json(sessionFor(user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/password/change", requireAuth, (req, res) => {
  try {
    const { password } = req.body;
    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password needs 8 characters, one capital letter, and one number." });
    }
    db.prepare("UPDATE users SET password_hash = ?, verified = 1, must_change_password = 0 WHERE id = ?").run(
      hashPassword(password),
      req.user.id
    );
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    res.json(sessionFor(user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user, employee: employeeByUser(req.user) });
});

app.get("/api/job-profiles", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM job_profiles ORDER BY title").all();
  res.json(rows.map((row) => ({ ...row, skills: JSON.parse(row.skills_json || "[]") })));
});

app.get("/api/employees", requireAuth, (req, res) => {
  if (req.user.role === "employee") {
    const row = db.prepare(`
      SELECT employees.*, users.verified AS account_verified, users.must_change_password
      FROM employees LEFT JOIN users ON users.employee_id = employees.id
      WHERE employees.id = ?
    `).get(req.user.employeeId);
    return res.json(row ? [rowToEmployee(row)] : []);
  }
  const rows = db.prepare(`
    SELECT employees.*, users.verified AS account_verified, users.must_change_password
    FROM employees LEFT JOIN users ON users.employee_id = employees.id
    ORDER BY joined DESC
  `).all();
  res.json(rows.map(rowToEmployee));
});

app.get("/api/documents", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.query.employeeId;
  const sql = employeeId
    ? `SELECT employee_documents.*, employees.name FROM employee_documents JOIN employees ON employees.id = employee_documents.employee_id WHERE employee_id = ? ORDER BY uploaded_at DESC`
    : `SELECT employee_documents.*, employees.name FROM employee_documents JOIN employees ON employees.id = employee_documents.employee_id ORDER BY uploaded_at DESC`;
  const rows = employeeId ? db.prepare(sql).all(employeeId) : db.prepare(sql).all();
  res.json(rows.map(rowToDocument));
});

app.get("/api/activity", requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT 50").all();
  res.json(rows);
});

app.post("/api/documents", requireAuth, (req, res) => {
  try {
    const employeeId = req.user.role === "employee" ? req.user.employeeId : req.body.employeeId;
    if (!employeeId) return res.status(400).json({ error: "Employee is required." });
    if (req.user.role === "employee" && employeeId !== req.user.employeeId) return res.status(403).json({ error: "Employees can upload only their own documents." });
    if (!db.prepare("SELECT id FROM employees WHERE id = ?").get(employeeId)) return res.status(404).json({ error: "Employee not found." });
    insertDocument(employeeId, req.body);
    logActivity(req.user, "uploaded document", "employee", employeeId, req.body.type || "Document");
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/documents/:id", requireAuth, requireAdmin, (req, res) => {
  const { status, adminComment } = req.body;
  if (!["Approved", "Rejected"].includes(status)) return res.status(400).json({ error: "Invalid document decision." });
  const document = db.prepare("SELECT * FROM employee_documents WHERE id = ?").get(req.params.id);
  if (!document) return res.status(404).json({ error: "Document not found." });
  db.prepare("UPDATE employee_documents SET status = ?, admin_comment = ? WHERE id = ?").run(status, adminComment || "", req.params.id);
  logActivity(req.user, `${status.toLowerCase()} document`, "document", req.params.id, `${document.type} for ${document.employee_id}`);
  res.json({ ok: true });
});

app.post("/api/employees", requireAuth, requireAdmin, async (req, res) => {
  const { name, email, phone, address, jobProfileId, manager, joined, salary, documents = [] } = req.body;
  if (!name || !email || !phone || !address || !jobProfileId || !manager || !joined || !salary) {
    return res.status(400).json({ error: "All employee profile fields are required." });
  }
  try {
    assertEmployeeInput({ name, email, phone, address, joined, salary });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (db.prepare("SELECT id FROM employees WHERE email = ?").get(email) || db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return res.status(409).json({ error: "An employee or user already exists with this email." });
  }

  const id = createEmployeeId(name);
  const tempPassword = temporaryPassword();
  const profile = db.prepare("SELECT * FROM job_profiles WHERE id = ?").get(jobProfileId);
  if (!profile) return res.status(400).json({ error: "Select a valid job profile." });
  const skills = JSON.parse(profile.skills_json || "[]");
  try {
    db.exec("BEGIN");
    db.prepare(`
      INSERT INTO employees
      (id, name, email, phone, address, title, department, location, manager, joined, wage, skills_json, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      email,
      phone,
      address || "",
      profile.title,
      profile.department,
      address,
      manager,
      joined,
      Number(salary),
      JSON.stringify(skills),
      initialsFor(name)
    );
    refreshSalary(id, Number(salary));
    db.prepare(`
      INSERT INTO users (role, employee_id, email, password_hash, verified, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("employee", id, email, hashPassword(tempPassword), 0, 1);
    for (const doc of documents) insertDocument(id, doc);
    await sendEmployeeInviteEmail({
      to: email,
      name,
      employeeId: id,
      temporaryPassword: tempPassword,
      loginUrl: process.env.CLIENT_URL || "http://127.0.0.1:5173",
    });
    logActivity(req.user, "created employee", "employee", id, `${name} / ${profile.title}`);
    db.exec("COMMIT");
    res.status(201).json({ employee: rowToEmployee(db.prepare("SELECT * FROM employees WHERE id = ?").get(id)), credentials: { id, emailed: true } });
  } catch (error) {
    db.exec("ROLLBACK");
    res.status(503).json({ error: error.message });
  }
});

app.patch("/api/employees/:id", requireAuth, (req, res) => {
  try {
    const employeeId = req.params.id;
    const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(employeeId);
    if (!employee) return res.status(404).json({ error: "Employee not found." });
    if (req.user.role === "employee" && req.user.employeeId !== employeeId) {
      return res.status(403).json({ error: "Employees can update only their own profile." });
    }

    const { name, email, phone, address, jobProfileId, manager, joined, salary, profilePhoto } = req.body;
    let next = { ...employee };
    if (req.user.role === "admin") {
      assertEmployeeInput({
        name: name || next.name,
        email: email || next.email,
        phone: phone || next.phone,
        address: address || next.address,
        joined: joined || next.joined,
        salary: salary || next.wage,
      });
      if (name) next.name = name;
      if (email) {
        const duplicate = db.prepare("SELECT id FROM employees WHERE email = ? AND id <> ?").get(email, employeeId);
        const duplicateUser = db.prepare("SELECT employee_id FROM users WHERE email = ? AND employee_id <> ?").get(email, employeeId);
        if (duplicate || duplicateUser) return res.status(409).json({ error: "Another employee already uses this email." });
        next.email = email;
      }
      if (jobProfileId) {
        const profile = db.prepare("SELECT * FROM job_profiles WHERE id = ?").get(jobProfileId);
        if (!profile) return res.status(400).json({ error: "Select a valid job profile." });
        next.title = profile.title;
        next.department = profile.department;
        next.skills_json = profile.skills_json;
      }
      if (manager) next.manager = manager;
      if (joined) next.joined = joined;
      if (salary) next.wage = Number(salary);
    }

    if (phone) {
      if (!isPhone(phone)) return res.status(400).json({ error: "Enter a valid phone number." });
      next.phone = phone;
    }
    if (address) {
      next.address = address;
      next.location = address;
    }
    if (profilePhoto) {
      next.profile_photo_url = saveUploadedFile(profilePhoto);
    }

    db.prepare(`
      UPDATE employees
      SET name = ?, email = ?, phone = ?, address = ?, title = ?, department = ?, location = ?, manager = ?, joined = ?, wage = ?, skills_json = ?, avatar = ?, profile_photo_url = ?
      WHERE id = ?
    `).run(
      next.name,
      next.email,
      next.phone,
      next.address,
      next.title,
      next.department,
      next.location,
      next.manager,
      next.joined,
      next.wage,
      next.skills_json,
      initialsFor(next.name),
      next.profile_photo_url || "",
      employeeId
    );
    if (req.user.role === "admin") {
      db.prepare("UPDATE users SET email = ? WHERE employee_id = ?").run(next.email, employeeId);
      refreshSalary(employeeId, Number(next.wage));
    }
    logActivity(req.user, "updated profile", "employee", employeeId, req.user.role === "admin" ? "Admin profile update" : "Employee self-service update");
    res.json({ employee: rowToEmployee(db.prepare("SELECT * FROM employees WHERE id = ?").get(employeeId)) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/employees/:id", requireAuth, requireAdmin, (req, res) => {
  try {
    const employeeId = req.params.id;
    const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(employeeId);
    if (!employee) return res.status(404).json({ error: "Employee not found." });
    const documents = db.prepare("SELECT file_url FROM employee_documents WHERE employee_id = ?").all(employeeId);
    db.exec("BEGIN");
    db.prepare("DELETE FROM otp_challenges WHERE email IN (SELECT email FROM users WHERE employee_id = ?)").run(employeeId);
    db.prepare("DELETE FROM salary_components WHERE employee_id = ?").run(employeeId);
    db.prepare("DELETE FROM attendance WHERE employee_id = ?").run(employeeId);
    db.prepare("DELETE FROM leave_requests WHERE employee_id = ?").run(employeeId);
    db.prepare("DELETE FROM employee_documents WHERE employee_id = ?").run(employeeId);
    db.prepare("DELETE FROM users WHERE employee_id = ?").run(employeeId);
    db.prepare("DELETE FROM employees WHERE id = ?").run(employeeId);
    logActivity(req.user, "deleted employee", "employee", employeeId, employee.name);
    db.exec("COMMIT");
    for (const document of documents) removeStoredFile(document.file_url);
    removeStoredFile(employee.profile_photo_url);
    res.json({ ok: true });
  } catch (error) {
    db.exec("ROLLBACK");
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/attendance", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.query.employeeId;
  const filters = [];
  const values = [];
  if (employeeId) {
    filters.push("attendance.employee_id = ?");
    values.push(employeeId);
  }
  if (req.query.month) {
    filters.push("attendance.work_date LIKE ?");
    values.push(`${req.query.month}%`);
  }
  if (req.query.status && req.query.status !== "All") {
    filters.push("attendance.status = ?");
    values.push(req.query.status);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT attendance.*, employees.name
    FROM attendance JOIN employees ON employees.id = attendance.employee_id
    ${where}
    ORDER BY work_date DESC, employees.name ASC
  `).all(...values);
  res.json(rows);
});

app.post("/api/attendance/check", requireAuth, (req, res) => {
  try {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.body.employeeId;
  if (!employeeId) return res.status(400).json({ error: "Employee is required." });
  if (!db.prepare("SELECT id FROM employees WHERE id = ?").get(employeeId)) return res.status(404).json({ error: "Employee not found." });
  const today = new Date().toISOString().slice(0, 10);
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const action = req.body.action === "out" ? "out" : "in";
  const existing = db.prepare("SELECT * FROM attendance WHERE employee_id = ? AND work_date = ?").get(employeeId, today);
  if (action === "in") {
    if (existing?.check_in) return res.status(409).json({ error: "Already checked in for today." });
    db.prepare("INSERT INTO attendance (employee_id, work_date, check_in, status, note) VALUES (?, ?, ?, ?, ?)").run(employeeId, today, time, "Present", "Self check-in");
    logActivity(req.user, "checked in", "attendance", employeeId, today);
    return res.json({ ok: true });
  }
  if (!existing?.check_in) return res.status(400).json({ error: "Check in before checking out." });
  if (existing.check_out) return res.status(409).json({ error: "Already checked out for today." });
  const totals = attendanceTotals(existing.check_in, time, "Present");
  db.prepare("UPDATE attendance SET check_out = ?, status = ?, work_hours = ?, extra_hours = ?, note = ? WHERE id = ?").run(
    time,
    totals.status,
    totals.workHours,
    totals.extraHours,
    "Self check-out",
    existing.id
  );
  logActivity(req.user, "checked out", "attendance", employeeId, today);
  res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/attendance/manual", requireAuth, requireAdmin, (req, res) => {
  try {
    const { employeeId, workDate, checkIn, checkOut, status, note } = req.body;
    if (!employeeId || !workDate || !status) return res.status(400).json({ error: "Employee, date, and status are required." });
    if (!isDate(workDate)) return res.status(400).json({ error: "Choose a valid attendance date." });
    if (!attendanceStatuses.has(status)) return res.status(400).json({ error: "Invalid attendance status." });
    if (!isTime(checkIn) || !isTime(checkOut)) return res.status(400).json({ error: "Use valid HH:MM attendance times." });
    if (!["Absent", "Leave"].includes(status) && (!checkIn || !checkOut)) return res.status(400).json({ error: "Present and half-day records need check-in and check-out times." });
    if (!db.prepare("SELECT id FROM employees WHERE id = ?").get(employeeId)) return res.status(404).json({ error: "Employee not found." });
    const totals = attendanceTotals(checkIn, checkOut, status);
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
    `).run(employeeId, workDate, checkIn || null, checkOut || null, totals.status, totals.workHours, totals.extraHours, note || "Marked by HR");
    logActivity(req.user, "marked attendance", "attendance", employeeId, `${workDate} / ${totals.status}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/leaves", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : null;
  const sql = employeeId
    ? `SELECT leave_requests.*, employees.name FROM leave_requests JOIN employees ON employees.id = leave_requests.employee_id WHERE employee_id = ? ORDER BY created_at DESC`
    : `SELECT leave_requests.*, employees.name FROM leave_requests JOIN employees ON employees.id = leave_requests.employee_id ORDER BY created_at DESC`;
  const rows = employeeId ? db.prepare(sql).all(employeeId) : db.prepare(sql).all();
  res.json(rows);
});

app.get("/api/leave-balances", requireAuth, (req, res) => {
  const employeeIds = req.user.role === "employee"
    ? [req.user.employeeId]
    : db.prepare("SELECT id FROM employees ORDER BY name").all().map((row) => row.id);
  res.json(employeeIds.flatMap(leaveBalanceFor));
});

app.post("/api/leaves", requireAuth, (req, res) => {
  const { type, startDate, endDate, remarks, attachment } = req.body;
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.body.employeeId;
  if (!employeeId || !type || !startDate || !endDate || !remarks) {
    return res.status(400).json({ error: "Employee, leave type, dates, and remarks are required." });
  }
  if (!["Paid", "Sick", "Unpaid"].includes(type)) return res.status(400).json({ error: "Invalid leave type." });
  if (!isDate(startDate) || !isDate(endDate)) return res.status(400).json({ error: "Choose valid leave dates." });
  if (!db.prepare("SELECT id FROM employees WHERE id = ?").get(employeeId)) return res.status(404).json({ error: "Employee not found." });
  const days = Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
  if (days < 1) return res.status(400).json({ error: "End date cannot be before start date." });
  const overlap = db.prepare(`
    SELECT id FROM leave_requests
    WHERE employee_id = ?
      AND status IN ('Pending','Approved')
      AND start_date <= ?
      AND end_date >= ?
    LIMIT 1
  `).get(employeeId, endDate, startDate);
  if (overlap) return res.status(409).json({ error: "A pending or approved leave request already overlaps these dates." });
  if (type === "Sick" && !attachment) return res.status(400).json({ error: "Sick leave requires a certificate attachment." });
  const balance = leaveBalanceFor(employeeId).find((row) => row.type === type);
  if (type !== "Unpaid" && balance && days > balance.remaining) {
    return res.status(400).json({ error: `Only ${balance.remaining} ${type.toLowerCase()} leave days are available.` });
  }
  const savedAttachment = attachment ? {
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    fileUrl: saveUploadedFile(attachment),
  } : { fileName: "", mimeType: "", fileUrl: "" };
  db.prepare(`
    INSERT INTO leave_requests (employee_id, type, start_date, end_date, days, remarks, attachment_file_name, attachment_mime_type, attachment_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(employeeId, type, startDate, endDate, days, remarks, savedAttachment.fileName, savedAttachment.mimeType, savedAttachment.fileUrl);
  logActivity(req.user, "submitted leave", "leave", employeeId, `${type} / ${startDate} to ${endDate}`);
  res.status(201).json({ ok: true });
});

app.patch("/api/leaves/:id", requireAuth, requireAdmin, (req, res) => {
  const { status, adminComment } = req.body;
  if (!["Approved", "Rejected"].includes(status)) return res.status(400).json({ error: "Invalid leave decision." });
  const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(req.params.id);
  if (!leave) return res.status(404).json({ error: "Leave request not found." });
  if (status === "Approved" && leave.type !== "Unpaid") {
    const balance = leaveBalanceFor(leave.employee_id).find((row) => row.type === leave.type);
    const available = (balance?.remaining || 0) + (leave.status === "Approved" ? leave.days : 0);
    if (leave.days > available) return res.status(400).json({ error: `Insufficient ${leave.type.toLowerCase()} leave balance.` });
  }
  db.prepare("UPDATE leave_requests SET status = ?, admin_comment = ? WHERE id = ?").run(status, adminComment || "", req.params.id);
  if (status === "Approved") writeLeaveAttendance(leave);
  logActivity(req.user, `${status.toLowerCase()} leave`, "leave", req.params.id, `${leave.employee_id} / ${leave.type}`);
  res.json({ ok: true });
});

app.get("/api/payroll", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.query.employeeId;
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Month must use YYYY-MM format." });
  const employees = employeeId
    ? db.prepare("SELECT * FROM employees WHERE id = ?").all(employeeId)
    : db.prepare("SELECT * FROM employees ORDER BY name").all();
  res.json(employees.map((employee) => payrollFor(employee, month)));
});

app.get("/api/payroll/:employeeId/pdf", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.params.employeeId;
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Month must use YYYY-MM format." });
  if (req.user.role === "employee" && req.params.employeeId !== req.user.employeeId) return res.status(403).json({ error: "Employees can export only their own payslip." });
  const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(employeeId);
  if (!employee) return res.status(404).json({ error: "Employee not found." });
  const slip = payrollFor(employee, month);
  const pdf = createPayslipPdfBuffer({ slip, currency: inr });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"dayflow-payslip-${employeeId}-${month}.pdf\"`);
  res.send(pdf);
});

const port = Number(process.env.API_PORT || 4000);
app.listen(port, "127.0.0.1", () => {
  console.log(`Dayflow API running at http://127.0.0.1:${port}`);
});
