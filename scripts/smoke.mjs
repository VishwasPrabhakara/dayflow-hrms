const API_URL = process.env.API_URL || "http://127.0.0.1:4000";
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || "hr@dayflow.local";
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || "Admin@2026";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${body?.error || response.statusText}`);
  }
  return body;
}

function pass(label, detail = "") {
  console.log(`PASS ${label}${detail ? ` - ${detail}` : ""}`);
}

function requireArray(label, value) {
  if (!Array.isArray(value)) throw new Error(`${label} did not return a list.`);
  pass(label, `${value.length} record${value.length === 1 ? "" : "s"}`);
}

try {
  const health = await request("/api/health");
  if (!health.ok || !health.dynamicData) throw new Error("Health endpoint did not confirm dynamic data.");
  pass("health", `${health.database} database`);

  const session = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!session.token || session.user?.role !== "admin") throw new Error("Admin login did not return an admin session.");
  pass("admin login", session.user.email);

  const authHeader = { Authorization: `Bearer ${session.token}` };
  const month = new Date().toISOString().slice(0, 7);

  requireArray("employees", await request("/api/employees", { headers: authHeader }));
  requireArray("job profiles", await request("/api/job-profiles", { headers: authHeader }));
  requireArray("documents", await request("/api/documents", { headers: authHeader }));
  requireArray("attendance", await request(`/api/attendance?month=${month}`, { headers: authHeader }));
  requireArray("leave requests", await request("/api/leaves", { headers: authHeader }));
  requireArray("leave balances", await request("/api/leave-balances", { headers: authHeader }));
  requireArray("payroll", await request(`/api/payroll?month=${month}`, { headers: authHeader }));
  requireArray("activity", await request("/api/activity", { headers: authHeader }));

  pass("Dayflow smoke test", "core API is ready for demo");
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : "Smoke test failed."}`);
  console.error(`Make sure the backend is running at ${API_URL}. Start it with: npm run dev`);
  process.exit(1);
}
