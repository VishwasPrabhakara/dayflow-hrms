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

export function createDemoPdfBuffer({ title, employeeId, employeeName, type, status }) {
  const issued = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const content = buildContent([
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
