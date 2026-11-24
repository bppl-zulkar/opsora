import "server-only";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatIST } from "@/lib/format";
// Report rows combine task data with several Supabase relation shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskRow = Record<string, any>;
const safe = (value: unknown) => {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const person = (value: any) => value?.full_name ?? "—";
export async function taskExcel(tasks: TaskRow[], title = "Task report") {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Opsora";
  const summary = wb.addWorksheet("Summary"),
    details = wb.addWorksheet("Task records");
  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = "Opsora";
  summary.getCell("A1").font = {
    bold: true,
    size: 20,
    color: { argb: "FFFF5C73" },
  };
  summary.addRow([title]);
  summary.addRow(["Generated", formatIST(new Date())]);
  summary.addRow(["Total records", tasks.length]);
  const headers = [
    "Reference",
    "Title",
    "Status",
    "Priority",
    "Created by",
    "Assigned to",
    "Department",
    "Created",
    "Deadline",
    "Acknowledged",
    "Started",
    "Submitted",
    "Closed",
    "Progress %",
  ];
  details.addRow(headers);
  details.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  details.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF181A2B" },
  };
  for (const t of tasks)
    details.addRow([
      safe(t.reference),
      safe(t.title),
      t.status,
      t.priority,
      person(t.creator),
      person(t.owner),
      t.department?.name ?? "—",
      t.created_at ? formatIST(t.created_at) : "",
      t.current_deadline ? formatIST(t.current_deadline) : "",
      t.acknowledged_at ? formatIST(t.acknowledged_at) : "",
      t.started_at ? formatIST(t.started_at) : "",
      t.completion_submitted_at ? formatIST(t.completion_submitted_at) : "",
      t.closed_at ? formatIST(t.closed_at) : "",
      t.progress_percentage,
    ]);
  details.views = [{ state: "frozen", ySplit: 1 }];
  details.autoFilter = { from: "A1", to: "N1" };
  details.columns.forEach(
    (c, i) =>
      (c.width = [18, 38, 20, 12, 24, 24, 24, 24, 24, 24, 24, 24, 24, 12][i]),
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function individualTaskExcel(
  task: TaskRow,
  history: TaskRow[],
  attachments: TaskRow[] = [],
  comments: TaskRow[] = [],
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Opsora";
  wb.created = new Date();

  const styleSheet = (sheet: ExcelJS.Worksheet) => {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF181A2B" },
    };
    sheet.getRow(1).height = 24;
  };

  const details = wb.addWorksheet("Task details");
  details.columns = [
    { header: "Field", key: "field", width: 26 },
    { header: "Value", key: "value", width: 90 },
  ];
  styleSheet(details);
  const detailRows: Array<[string, unknown]> = [
    ["Reference", task.reference],
    ["Title", task.title],
    ["Description / instructions", task.description],
    ["Status", String(task.status ?? "").replaceAll("_", " ")],
    ["Priority", task.priority],
    ["Progress", `${task.progress_percentage ?? 0}%`],
    ["Created by", person(task.creator)],
    ["Assigned to", person(task.owner)],
    ["Department", task.department?.name ?? "—"],
    ["Created", task.created_at ? formatIST(task.created_at) : "—"],
    [
      "Original deadline",
      task.original_deadline ? formatIST(task.original_deadline) : "—",
    ],
    [
      "Current deadline",
      task.current_deadline ? formatIST(task.current_deadline) : "—",
    ],
    [
      "Acknowledged",
      task.acknowledged_at ? formatIST(task.acknowledged_at) : "—",
    ],
    ["Accepted", task.accepted_at ? formatIST(task.accepted_at) : "—"],
    ["Started", task.started_at ? formatIST(task.started_at) : "—"],
    [
      "Completion submitted",
      task.completion_submitted_at
        ? formatIST(task.completion_submitted_at)
        : "—",
    ],
    ["Approved", task.approved_at ? formatIST(task.approved_at) : "—"],
    ["Closed", task.closed_at ? formatIST(task.closed_at) : "—"],
    ["Cancelled", task.cancelled_at ? formatIST(task.cancelled_at) : "—"],
    ["Completion remarks", task.completion_remarks ?? "—"],
  ];
  detailRows.forEach(([field, value]) =>
    details.addRow({ field, value: safe(value) }),
  );
  details.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  const lifecycle = wb.addWorksheet("Lifecycle");
  lifecycle.columns = [
    { header: "Timestamp (IST)", key: "timestamp", width: 25 },
    { header: "User", key: "user", width: 30 },
    { header: "Previous status", key: "previous", width: 22 },
    { header: "New status", key: "next", width: 22 },
    { header: "Remarks", key: "remarks", width: 65 },
  ];
  styleSheet(lifecycle);
  history.forEach((event) =>
    lifecycle.addRow({
      timestamp: event.created_at ? formatIST(event.created_at) : "—",
      user: person(event.actor),
      previous: event.previous_status ?? "created",
      next: event.new_status,
      remarks: safe(event.remarks),
    }),
  );

  const evidence = wb.addWorksheet("Evidence");
  evidence.columns = [
    { header: "Timestamp (IST)", key: "timestamp", width: 25 },
    { header: "File", key: "file", width: 42 },
    { header: "Type", key: "type", width: 24 },
    { header: "Evidence type", key: "evidenceType", width: 22 },
    { header: "Size (bytes)", key: "size", width: 16 },
    { header: "Remarks", key: "remarks", width: 55 },
  ];
  styleSheet(evidence);
  attachments.forEach((item) =>
    evidence.addRow({
      timestamp: item.created_at ? formatIST(item.created_at) : "—",
      file: safe(item.file_name),
      type: item.mime_type,
      evidenceType: item.evidence_type,
      size: item.file_size,
      remarks: safe(item.remarks),
    }),
  );

  const notes = wb.addWorksheet("Comments");
  notes.columns = [
    { header: "Timestamp (IST)", key: "timestamp", width: 25 },
    { header: "User", key: "user", width: 30 },
    { header: "Comment", key: "comment", width: 90 },
  ];
  styleSheet(notes);
  comments.forEach((comment) =>
    notes.addRow({
      timestamp: comment.created_at ? formatIST(comment.created_at) : "—",
      user: person(comment.author),
      comment: safe(comment.body),
    }),
  );
  [lifecycle, evidence, notes].forEach((sheet) => {
    sheet.autoFilter = {
      from: "A1",
      to: sheet.getRow(1).getCell(sheet.columnCount).address,
    };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
    });
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function taskCsv(tasks: TaskRow[]) {
  const headers = [
    "Reference",
    "Title",
    "Status",
    "Priority",
    "Created By",
    "Assigned To",
    "Department",
    "Created",
    "Deadline",
    "Acknowledged",
    "Started",
    "Submitted",
    "Closed",
    "Progress %",
  ];
  const quote = (v: unknown) => `"${safe(v).replaceAll('"', '""')}"`;
  const rows = tasks.map((t) =>
    [
      t.reference,
      t.title,
      t.status,
      t.priority,
      person(t.creator),
      person(t.owner),
      t.department?.name ?? "",
      t.created_at ? formatIST(t.created_at) : "",
      t.current_deadline ? formatIST(t.current_deadline) : "",
      t.acknowledged_at ? formatIST(t.acknowledged_at) : "",
      t.started_at ? formatIST(t.started_at) : "",
      t.completion_submitted_at ? formatIST(t.completion_submitted_at) : "",
      t.closed_at ? formatIST(t.closed_at) : "",
      t.progress_percentage,
    ]
      .map(quote)
      .join(","),
  );
  return Buffer.from(
    [headers.map(quote).join(","), ...rows].join("\r\n"),
    "utf8",
  );
}
export async function taskPdf(tasks: TaskRow[], title = "Task report") {
  const pdf = await PDFDocument.create(),
    regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [841.89, 595.28];
  let page = pdf.addPage(pageSize),
    y = 550;
  const header = () => {
    page.drawRectangle({
      x: 0,
      y: 516,
      width: 841.89,
      height: 79.28,
      color: rgb(0.07, 0.1, 0.24),
    });
    page.drawCircle({
      x: 780,
      y: 570,
      size: 66,
      color: rgb(0.22, 0.34, 0.9),
      opacity: 0.22,
    });
    page.drawText("Opsora", {
      x: 34,
      y: 562,
      size: 20,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(title, {
      x: 34,
      y: 535,
      size: 12,
      font: bold,
      color: rgb(0.39, 0.64, 1),
    });
    page.drawText(
      `Generated ${formatIST(new Date())} | ${tasks.length} records`,
      { x: 575, y: 562, size: 7, font: regular, color: rgb(0.82, 0.86, 0.98) },
    );
    page.drawRectangle({
      x: 34,
      y: 514,
      width: 774,
      height: 1,
      color: rgb(0.22, 0.34, 0.9),
    });
    y = 495;
  };
  header();
  const closed = tasks.filter((task) =>
    ["closed", "completed"].includes(task.status),
  ).length;
  const overdue = tasks.filter(
    (task) =>
      task.current_deadline &&
      new Date(task.current_deadline) < new Date() &&
      !["closed", "completed", "cancelled"].includes(task.status),
  ).length;
  [
    ["TOTAL TASKS", tasks.length],
    ["COMPLETED", closed],
    ["OPEN", tasks.length - closed],
    ["OVERDUE", overdue],
  ].forEach(([label, value], index) => {
    const x = 34 + index * 194;
    page.drawRectangle({
      x,
      y: 474,
      width: 180,
      height: 27,
      color:
        index === 3 && overdue ? rgb(1, 0.91, 0.92) : rgb(0.95, 0.96, 0.99),
      borderColor: rgb(0.88, 0.9, 0.95),
      borderWidth: 0.5,
    });
    page.drawText(String(label), {
      x: x + 9,
      y: 485,
      size: 6,
      font: bold,
      color: rgb(0.4, 0.43, 0.55),
    });
    page.drawText(String(value), {
      x: x + 151,
      y: 482,
      size: 11,
      font: bold,
      color:
        index === 3 && overdue ? rgb(0.75, 0.12, 0.2) : rgb(0.1, 0.13, 0.28),
    });
  });
  y = 456;
  const cols = [34, 115, 320, 408, 480, 590, 700],
    heads = [
      "Reference",
      "Task",
      "Status",
      "Priority",
      "Created by",
      "Assigned to",
      "Deadline",
    ];
  page.drawRectangle({
    x: 30,
    y: y - 7,
    width: 778,
    height: 22,
    color: rgb(0.9, 0.93, 1),
  });
  heads.forEach((h, i) =>
    page.drawText(h, {
      x: cols[i],
      y,
      size: 7,
      font: bold,
      color: rgb(0.4, 0.42, 0.5),
    }),
  );
  y -= 16;
  let rowIndex = 0;
  for (const t of tasks) {
    if (y < 42) {
      page = pdf.addPage(pageSize);
      header();
      page.drawRectangle({
        x: 30,
        y: y - 7,
        width: 778,
        height: 22,
        color: rgb(0.9, 0.93, 1),
      });
      heads.forEach((heading, index) =>
        page.drawText(heading, {
          x: cols[index],
          y,
          size: 7,
          font: bold,
          color: rgb(0.4, 0.42, 0.5),
        }),
      );
      y -= 16;
    }
    if (rowIndex % 2 === 1)
      page.drawRectangle({
        x: 30,
        y: y - 7,
        width: 778,
        height: 18,
        color: rgb(0.975, 0.98, 0.995),
      });
    const values = [
      t.reference,
      String(t.title).slice(0, 32),
      String(t.status).replaceAll("_", " "),
      t.priority,
      person(t.creator).slice(0, 17),
      person(t.owner).slice(0, 17),
      t.current_deadline ? formatIST(t.current_deadline).slice(0, 20) : "",
    ];
    values.forEach((v, i) =>
      page.drawText(String(v), {
        x: cols[i],
        y,
        size: 7,
        font: regular,
        color: rgb(0.12, 0.13, 0.2),
      }),
    );
    page.drawLine({
      start: { x: 34, y: y - 5 },
      end: { x: 808, y: y - 5 },
      thickness: 0.5,
      color: rgb(0.92, 0.92, 0.95),
    });
    y -= 19;
    rowIndex += 1;
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: 735,
      y: 18,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.47, 0.55),
    }),
  );
  return Buffer.from(await pdf.save());
}
export async function individualTaskPdf(
  task: TaskRow,
  history: TaskRow[],
  attachments: TaskRow[] = [],
  comments: TaskRow[] = [],
) {
  const pdf = await PDFDocument.create(),
    regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]),
    y = 790,
    rowIndex = 0;
  const line = (label: string, value: unknown) => {
    const text = String(value ?? "—");
    const parts = text.match(/.{1,75}(?:\s|$)/g) ?? [text];
    const rowHeight = Math.max(20, parts.length * 12 + 6);
    if (y - rowHeight < 48) {
      page = pdf.addPage([595.28, 841.89]);
      page.drawRectangle({
        x: 0,
        y: 818,
        width: 595.28,
        height: 23.89,
        color: rgb(0.07, 0.1, 0.24),
      });
      page.drawText("Opsora · Task lifecycle report", {
        x: 38,
        y: 826,
        size: 8,
        font: bold,
        color: rgb(1, 1, 1),
      });
      y = 790;
    }
    page.drawRectangle({
      x: 32,
      y: y - rowHeight + 7,
      width: 531,
      height: rowHeight,
      color: rowIndex % 2 === 0 ? rgb(0.965, 0.972, 0.995) : rgb(0.99, 0.99, 1),
      borderColor: rgb(0.9, 0.91, 0.95),
      borderWidth: 0.35,
    });
    page.drawText(label, {
      x: 40,
      y,
      size: 8,
      font: bold,
      color: rgb(0.34, 0.37, 0.48),
    });
    parts.forEach((part, index) =>
      page.drawText(part.trim(), {
        x: index ? 165 : 165,
        y: y - index * 12,
        size: 8,
        font: regular,
        color: rgb(0.12, 0.13, 0.2),
      }),
    );
    y -= rowHeight;
    rowIndex += 1;
  };
  page.drawRectangle({
    x: 0,
    y: 735,
    width: 595.28,
    height: 106.89,
    color: rgb(0.07, 0.1, 0.24),
  });
  page.drawCircle({
    x: 545,
    y: 812,
    size: 70,
    color: rgb(0.25, 0.35, 0.95),
    opacity: 0.22,
  });
  page.drawText("Opsora", {
    x: 38,
    y,
    size: 22,
    font: bold,
    color: rgb(1, 1, 1),
  });
  y -= 26;
  page.drawText("Individual task lifecycle report", {
    x: 38,
    y,
    size: 13,
    font: bold,
    color: rgb(0.39, 0.64, 1),
  });
  y -= 30;
  line("Task reference", task.reference);
  line("Title", task.title);
  line("Instructions", task.description);
  line("Status", String(task.status).replaceAll("_", " "));
  line("Priority", task.priority);
  line("Created by", person(task.creator));
  line("Assigned to", person(task.owner));
  line("Department", task.department?.name);
  for (const [label, key] of [
    ["Created", "created_at"],
    ["Deadline", "current_deadline"],
    ["Acknowledged", "acknowledged_at"],
    ["Accepted", "accepted_at"],
    ["Started", "started_at"],
    ["Submitted", "completion_submitted_at"],
    ["Approved", "approved_at"],
    ["Closed", "closed_at"],
  ] as const)
    line(label, task[key] ? formatIST(task[key]) : "—");
  y -= 8;
  page.drawText("Lifecycle history", {
    x: 38,
    y,
    size: 12,
    font: bold,
    color: rgb(0.1, 0.1, 0.17),
  });
  y -= 22;
  for (const event of history)
    line(
      formatIST(event.created_at),
      `${event.actor?.full_name ?? "System"}: ${event.previous_status ?? "created"} -> ${event.new_status}${event.remarks ? ` | ${event.remarks}` : ""}`,
    );
  y -= 8;
  page.drawText("Evidence and attachments", {
    x: 38,
    y,
    size: 12,
    font: bold,
    color: rgb(0.1, 0.1, 0.17),
  });
  y -= 22;
  for (const item of attachments)
    line(
      item.evidence_type ?? "Attachment",
      `${item.file_name} | ${item.mime_type} | ${item.file_size} bytes | ${formatIST(item.created_at)}${item.remarks ? ` | ${item.remarks}` : ""}`,
    );
  if (!attachments.length) line("Evidence", "No evidence metadata recorded");
  y -= 8;
  page.drawText("Comments and remarks", {
    x: 38,
    y,
    size: 12,
    font: bold,
    color: rgb(0.1, 0.1, 0.17),
  });
  y -= 22;
  for (const comment of comments)
    line(
      formatIST(comment.created_at),
      `${comment.author?.full_name ?? "System"}: ${comment.body}`,
    );
  if (!comments.length) line("Comments", "No comments recorded");
  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`Opsora | Page ${i + 1} of ${pages.length}`, {
      x: 38,
      y: 22,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.47, 0.55),
    }),
  );
  return Buffer.from(await pdf.save());
}
