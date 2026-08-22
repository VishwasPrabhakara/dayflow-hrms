# Dayflow - Human Resource Management System

Dayflow is an 8-hour hackathon HRMS built for the Odoo x NMIT Bangalore Hackathon 2026 virtual round. It focuses on the core HR lifecycle: employee onboarding, secure role-based login, profile/document verification, attendance, time off, and attendance-linked payroll.

## Deployment

GitHub Pages frontend: https://vishwasprabhakara.github.io/dayflow-hrms/

Current live backend tunnel: https://bright-chefs-behave.loca.lt

The app is a real full-stack HRMS. GitHub Pages can host only the React frontend; the Express + SQLite + Gmail OTP backend must be running separately for login, OTP, uploads, approvals, payroll, and reports to work.

Build the Pages frontend against a hosted backend:

```bash
VITE_API_BASE_URL=https://your-backend-host.example.com npm run build:pages
```

For local full-stack evaluation, run:

```bash
npm run dev
```

## Features

- Admin/HR and employee role-based workspace.
- Admin-created employee onboarding with generated employee ID and temporary password.
- Employee invite email with login link, temporary credentials, OTP verification, and forced password change.
- Employee signup flow for activating HR-created accounts.
- Forgot password workflow with OTP verification.
- Employee profile management with profile photo, resume, ID proof, bank proof, offer letter, and education certificates.
- Admin document approval/rejection queue with per-document comments.
- Employee self-service uploads for missing onboarding documents.
- Document dashboard with pending, approved, rejected, and missing-document visibility.
- Attendance check-in/check-out, admin manual attendance correction, monthly filters, and extra-hour calculation.
- Time-off requests for paid, sick, and unpaid leave with balance validation and sick certificate upload.
- Admin approval/rejection workflow for leave requests.
- Payroll calculation from salary, attendance, leave, absences, extra hours, daily rate, and hourly rate.
- Executive reports for attendance, leave, payroll, account activation, and document health.
- HR audit trail for employee, document, attendance, and leave actions.
- Local-first SQLite database and local file storage for uploaded documents.

## Tech Stack

- React 19 + TypeScript + Vite
- Express API
- SQLite through `node:sqlite`
- Nodemailer with Gmail SMTP
- Local upload storage under `data/uploads`

## Run Locally

Install dependencies:

```bash
npm install
```

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Start the frontend and backend together:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The API runs on:

```text
http://127.0.0.1:4000
```

## Environment

For real OTP and invite emails, configure Gmail app-password SMTP:

```env
GMAIL_USER=your-gmail-address@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
GMAIL_FROM=your-gmail-address@gmail.com
API_PORT=4000
CLIENT_URL=http://127.0.0.1:5173
ALLOW_DEV_OTP=false
```

For offline/local evaluation without Gmail, set:

```env
ALLOW_DEV_OTP=true
```

When dev OTP mode is enabled, OTPs and invite credentials are printed in the backend terminal instead of being sent by email.

## Seeded Admin Login

```text
Email: hr@dayflow.local
Password: Admin@2026
```

The database is created automatically on first run. Local data is stored inside `data/`, which is intentionally ignored by Git.

For a richer demo dataset, run:

```bash
npm run seed:demo
```

This adds additional employees, attendance rows, leave requests, document verification states, and an activity log entry. The command is idempotent and can be run more than once.

## Demo Flow

1. Log in as Admin/HR using the seeded admin account.
2. Create an employee from the Employees page by selecting a job profile, manager, salary, and onboarding documents.
3. Confirm that the generated employee ID and temporary password are emailed or printed in dev OTP mode.
4. Log in as the employee with the temporary credentials.
5. Complete employee login OTP verification.
6. Set a new password when prompted.
7. Update employee profile information and profile photo.
8. Submit a time-off request, including a sick certificate when type is Sick.
9. Return as Admin/HR and approve or reject documents and leave requests.
10. Mark attendance or adjust attendance manually.
11. Review Payroll and Reports to see attendance-linked calculations.
12. Use CSV exports, document dashboard, leave calendar, and Recent Activity to show evaluation-ready operational visibility.

## Validation And Reliability

- Required fields are validated on the backend before database writes.
- Email, phone, salary, date, month, and attendance time formats are validated.
- Passwords require at least 8 characters, one uppercase letter, and one number.
- Employee login requires OTP verification.
- Temporary employee passwords force password change after first login.
- Leave requests validate dates, available balance, overlapping leave windows, and sick certificate requirements.
- Attendance prevents invalid check-in/check-out sequences and invalid manual time ranges.
- Payroll is calculated dynamically from attendance and leave records.
- Forms use loading/error states to avoid accidental double submissions.
- Admin decisions and key HR actions are recorded in an audit trail.

## Evaluator

- Nikhil Joshi
- GitHub: `nikj-odoo`, `hackathon-odoo`

## Scripts

```bash
npm run dev        # Run backend and frontend together
npm run server     # Run only the API server
npm run dev:client # Run only the Vite frontend
npm run seed:demo  # Add richer demo data into the local SQLite database
npm run smoke      # Check core API readiness while the backend is running
npm run build      # Type-check and create production build
npm run preview    # Preview production build
```
