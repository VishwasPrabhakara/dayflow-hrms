function escapePdfText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildContent(lines) {
  const textLines = lines.map((line, index) => {
    const leading = index === 0 ? "0 0 Td" : "0 -18 Td";
    return `${leading} (${escapePdfText(line)}) Tj`;
  });
  return `BT /F1 11 Tf 54 742 Td ${textLines.join(" ")} ET`;
}

function createPdfBuffer(lines) {
  const content = buildContent(lines);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

export function createDemoPdfBuffer({ title, employeeId, employeeName, type, status }) {
  const issued = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return createPdfBuffer([
    "Dayflow HRMS",
    title,
    "",
    `Employee: ${employeeName}`,
    `Employee ID: ${employeeId}`,
    `Document Type: ${type}`,
    `Verification Status: ${status}`,
    `Issued For Demo: ${issued}`,
    "",
    "This generated PDF represents an onboarding document in the HRMS demo workspace.",
    "It is used so evaluators can open a realistic PDF from the document verification flow.",
    "",
    "HR Review",
    "Reviewer: Admin / HR Officer",
    "Decision: Pending or approved inside Dayflow",
  ]);
}

export function createPayslipPdfBuffer({ slip, currency }) {
  return createPdfBuffer([
    "Dayflow HRMS",
    "Monthly Payslip",
    "",
    `Employee: ${slip.name}`,
    `Employee ID: ${slip.employeeId}`,
    `Month: ${slip.month}`,
    `Monthly Salary: ${currency(slip.salary)}`,
    "",
    "Attendance Summary",
    `Working Days: ${slip.workingDays}`,
    `Present Days: ${slip.presentDays}`,
    `Half Days: ${slip.halfDays}`,
    `Leave Days: ${slip.leaveDays}`,
    `Absent Days: ${slip.absentDays}`,
    `Payable Days: ${slip.payableDays}`,
    `Total Hours: ${slip.totalHours.toFixed(1)}`,
    `Extra Hours: ${slip.extraHours.toFixed(1)}`,
    "",
    "Salary Summary",
    `Gross Pay: ${currency(slip.grossPay)}`,
    `Extra Pay: ${currency(slip.extraPay)}`,
    `Deductions: ${currency(slip.deduction)}`,
    `Net Pay: ${currency(slip.netPay)}`,
    "",
    "Salary Components",
    ...slip.components.map((component) => `${component.label}: ${component.percent}% / ${currency(component.amount)}`),
  ]);
}
