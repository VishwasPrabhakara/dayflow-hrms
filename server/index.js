import "node:sqlite";
import cors from "cors";
import express from "express";
import { db, createEmployeeId, initialsFor, refreshSalary, rowToEmployee } from "./db.js";
import { hashPassword, randomOtp, randomToken, verifyPassword } from "./crypto.js";
import { sendOtpEmail } from "./mail.js";

const app = express();
const sessions = new Map();
const pendingLogins = new Map();

app.use(cors({ origin: "http://127.0.0.1:5173" }));
app.use(express.json());

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

function employeeByUser(user) {
  if (!user.employeeId) return null;
  const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(user.employeeId);
  return row ? rowToEmployee(row) : null;
}

async function createOtpChallenge({ email, purpose, payload, name }) {
  const id = randomToken();
  const code = randomOtp();
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
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required." });
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      return res.status(400).json({ error: "Password needs 8 characters, one capital letter, and one number." });
    }
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      return res.status(409).json({ error: "An account already exists for this email." });
    }
    res.json(
      await createOtpChallenge({
        email,
        purpose: "admin-signup",
        payload: { name, email, password },
        name,
      })
    );
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post("/api/auth/signup/verify", (req, res) => {
  try {
    const payload = verifyChallenge(req.body.challengeId, req.body.otp, "admin-signup");
    db.prepare(`
      INSERT INTO users (role, employee_id, email, password_hash, verified, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("admin", null, payload.email, hashPassword(payload.password), 1, 0);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(payload.email);
    res.json(sessionFor(user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user, employee: employeeByUser(req.user) });
});

app.get("/api/employees", requireAuth, (req, res) => {
  if (req.user.role === "employee") {
    const employee = employeeByUser(req.user);
    return res.json(employee ? [employee] : []);
  }
  const rows = db.prepare("SELECT * FROM employees ORDER BY joined DESC").all();
  res.json(rows.map(rowToEmployee));
});

app.post("/api/employees", requireAuth, requireAdmin, (req, res) => {
  const { name, email, phone, address, title, department, location, manager, joined, wage, skills } = req.body;
  if (!name || !email || !phone || !title || !department || !location || !manager || !joined || !wage) {
    return res.status(400).json({ error: "All employee profile fields are required." });
  }

  const id = createEmployeeId(name);
  const temporaryPassword = "Welcome@2026";
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
    title,
    department,
    location,
    manager,
    joined,
    Number(wage),
    JSON.stringify(Array.isArray(skills) ? skills : []),
    initialsFor(name)
  );
  refreshSalary(id, Number(wage));
  db.prepare(`
    INSERT INTO users (role, employee_id, email, password_hash, verified, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("employee", id, email, hashPassword(temporaryPassword), 0, 1);
  res.status(201).json({ employee: rowToEmployee(db.prepare("SELECT * FROM employees WHERE id = ?").get(id)), credentials: { id, temporaryPassword } });
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
