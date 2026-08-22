import "node:sqlite";
import "./env.js";
import { writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { db, createEmployeeId, initialsFor, refreshSalary, rowToEmployee, uploadsDir } from "./db.js";
import { hashPassword, randomOtp, randomToken, verifyPassword } from "./crypto.js";
import { sendEmployeeInviteEmail, sendOtpEmail } from "./mail.js";

const app = express();
const sessions = new Map();
const pendingLogins = new Map();
const __dirname = dirname(fileURLToPath(import.meta.url));
const documentTypes = new Set(["Profile Photo", "Resume", "ID Proof", "Bank Proof", "Offer Letter", "Education Certificate", "Experience Letter", "Other"]);

app.use(cors({ origin: "http://127.0.0.1:5173" }));
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(join(__dirname, "..", "data", "uploads")));

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

function saveUploadedFile(file) {
  if (!file?.dataUrl || !file?.fileName || !file?.mimeType) throw new Error("Each upload needs a file name, type, and content.");
  const match = /^data:([^;]+);base64,(.+)$/.exec(file.dataUrl);
  if (!match) throw new Error("Upload content is invalid.");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) throw new Error("Each file must be 5 MB or smaller.");
  const safeExt = extname(file.fileName).toLowerCase().replace(/[^.\w]/g, "") || ".bin";
  const storedName = `${randomToken()}${safeExt}`;
  writeFileSync(join(uploadsDir, storedName), buffer);
  return `/uploads/${storedName}`;
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
    const employee = employeeByUser(req.user);
    return res.json(employee ? [employee] : []);
  }
  const rows = db.prepare("SELECT * FROM employees ORDER BY joined DESC").all();
  res.json(rows.map(rowToEmployee));
});

app.get("/api/documents", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.query.employeeId;
  const sql = employeeId
    ? `SELECT employee_documents.*, employees.name FROM employee_documents JOIN employees ON employees.id = employee_documents.employee_id WHERE employee_id = ? ORDER BY uploaded_at DESC`
    : `SELECT employee_documents.*, employees.name FROM employee_documents JOIN employees ON employees.id = employee_documents.employee_id ORDER BY uploaded_at DESC`;
  const rows = employeeId ? db.prepare(sql).all(employeeId) : db.prepare(sql).all();
  res.json(rows);
});

app.post("/api/documents", requireAuth, (req, res) => {
  try {
    const employeeId = req.user.role === "employee" ? req.user.employeeId : req.body.employeeId;
    if (!employeeId) return res.status(400).json({ error: "Employee is required." });
    if (req.user.role === "employee" && employeeId !== req.user.employeeId) return res.status(403).json({ error: "Employees can upload only their own documents." });
    if (!db.prepare("SELECT id FROM employees WHERE id = ?").get(employeeId)) return res.status(404).json({ error: "Employee not found." });
    insertDocument(employeeId, req.body);
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/documents/:id", requireAuth, requireAdmin, (req, res) => {
  const { status, adminComment } = req.body;
  if (!["Approved", "Rejected"].includes(status)) return res.status(400).json({ error: "Invalid document decision." });
  db.prepare("UPDATE employee_documents SET status = ?, admin_comment = ? WHERE id = ?").run(status, adminComment || "", req.params.id);
  res.json({ ok: true });
});

app.post("/api/employees", requireAuth, requireAdmin, async (req, res) => {
  const { name, email, phone, address, jobProfileId, manager, joined, salary, documents = [] } = req.body;
  if (!name || !email || !phone || !address || !jobProfileId || !manager || !joined || !salary) {
    return res.status(400).json({ error: "All employee profile fields are required." });
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
    db.exec("COMMIT");
    res.status(201).json({ employee: rowToEmployee(db.prepare("SELECT * FROM employees WHERE id = ?").get(id)), credentials: { id, emailed: true } });
  } catch (error) {
    db.exec("ROLLBACK");
    res.status(503).json({ error: error.message });
  }
});

app.get("/api/attendance", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.query.employeeId;
  const sql = employeeId
    ? `SELECT attendance.*, employees.name FROM attendance JOIN employees ON employees.id = attendance.employee_id WHERE employee_id = ? ORDER BY work_date DESC`
    : `SELECT attendance.*, employees.name FROM attendance JOIN employees ON employees.id = attendance.employee_id ORDER BY work_date DESC`;
  const rows = employeeId ? db.prepare(sql).all(employeeId) : db.prepare(sql).all();
  res.json(rows);
});

app.post("/api/attendance/check", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.body.employeeId;
  if (!employeeId) return res.status(400).json({ error: "Employee is required." });
  const today = new Date().toISOString().slice(0, 10);
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const existing = db.prepare("SELECT * FROM attendance WHERE employee_id = ? AND work_date = ?").get(employeeId, today);
  if (!existing) {
    db.prepare("INSERT INTO attendance (employee_id, work_date, check_in, status) VALUES (?, ?, ?, ?)").run(employeeId, today, time, "Present");
  } else if (!existing.check_out) {
    db.prepare("UPDATE attendance SET check_out = ? WHERE id = ?").run(time, existing.id);
  }
  res.json({ ok: true });
});

app.get("/api/leaves", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : null;
  const sql = employeeId
    ? `SELECT leave_requests.*, employees.name FROM leave_requests JOIN employees ON employees.id = leave_requests.employee_id WHERE employee_id = ? ORDER BY created_at DESC`
    : `SELECT leave_requests.*, employees.name FROM leave_requests JOIN employees ON employees.id = leave_requests.employee_id ORDER BY created_at DESC`;
  const rows = employeeId ? db.prepare(sql).all(employeeId) : db.prepare(sql).all();
  res.json(rows);
});

app.post("/api/leaves", requireAuth, (req, res) => {
  const { type, startDate, endDate, remarks } = req.body;
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.body.employeeId;
  if (!employeeId || !type || !startDate || !endDate || !remarks) {
    return res.status(400).json({ error: "Employee, leave type, dates, and remarks are required." });
  }
  const days = Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
  if (days < 1) return res.status(400).json({ error: "End date cannot be before start date." });
  db.prepare(`
    INSERT INTO leave_requests (employee_id, type, start_date, end_date, days, remarks)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employeeId, type, startDate, endDate, days, remarks);
  res.status(201).json({ ok: true });
});

app.patch("/api/leaves/:id", requireAuth, requireAdmin, (req, res) => {
  const { status, adminComment } = req.body;
  if (!["Approved", "Rejected"].includes(status)) return res.status(400).json({ error: "Invalid leave decision." });
  db.prepare("UPDATE leave_requests SET status = ?, admin_comment = ? WHERE id = ?").run(status, adminComment || "", req.params.id);
  res.json({ ok: true });
});

app.get("/api/payroll", requireAuth, (req, res) => {
  const employeeId = req.user.role === "employee" ? req.user.employeeId : req.query.employeeId;
  const rows = employeeId
    ? db.prepare("SELECT * FROM salary_components WHERE employee_id = ?").all(employeeId)
    : db.prepare("SELECT salary_components.*, employees.name FROM salary_components JOIN employees ON employees.id = salary_components.employee_id").all();
  res.json(rows);
});

const port = Number(process.env.API_PORT || 4000);
app.listen(port, "127.0.0.1", () => {
  console.log(`Dayflow API running at http://127.0.0.1:${port}`);
});
