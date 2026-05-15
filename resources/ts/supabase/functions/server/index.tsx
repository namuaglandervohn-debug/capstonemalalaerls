import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const app = new Hono();
app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// ── HEALTH ───────────────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/health", (c) => c.json({ status: "ok" }));

// ── USER ACCOUNTS ────────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/users", async (c) => {
  try {
    const records = await kv.getByPrefix("user:");
    const users = records.filter((u: any) => u != null);
    return c.json({ users });
  } catch (error) {
    console.log("Error fetching users:", error);
    return c.json({ error: `Failed to fetch users: ${error}` }, 500);
  }
});

app.post("/make-server-24f1182d/users", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.getByPrefix("user:");
    const nextNum = String(existing.length + 1).padStart(3, "0");
    const id = `USR-${nextNum}`;
    const user = {
      id,
      name: body.name,
      email: body.email,
      role: body.role ?? "employee",
      employeeId: body.employeeId ?? null,
      outlet: body.outlet ?? null,
      password: body.password ?? "password",
      active: true,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`user:${id}`, user);
    return c.json({ user }, 201);
  } catch (error) {
    console.log("Error creating user:", error);
    return c.json({ error: `Failed to create user: ${error}` }, 500);
  }
});

app.put("/make-server-24f1182d/users/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await kv.get(`user:${id}`);
    if (!existing) return c.json({ error: "User not found" }, 404);
    const updated = { ...existing, ...body, id, updatedAt: new Date().toISOString() };
    await kv.set(`user:${id}`, updated);
    return c.json({ user: updated });
  } catch (error) {
    console.log("Error updating user:", error);
    return c.json({ error: `Failed to update user: ${error}` }, 500);
  }
});

app.delete("/make-server-24f1182d/users/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`user:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting user:", error);
    return c.json({ error: `Failed to delete user: ${error}` }, 500);
  }
});

// ── EMPLOYEES ────────────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/employees", async (c) => {
  try {
    const records = await kv.getByPrefix("employee:");
    const employees = records.filter((e: any) => e != null && typeof e.name === "string");
    return c.json({ employees });
  } catch (error) {
    console.log("Error fetching employees:", error);
    return c.json({ error: `Failed to fetch employees: ${error}` }, 500);
  }
});

app.post("/make-server-24f1182d/employees", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.getByPrefix("employee:");
    const nextNum = existing.length + 1;
    const id = `EMP${String(nextNum).padStart(3, "0")}`;
    const employee = {
      id,
      name: body.name,
      position: body.position,
      department: body.department ?? "",
      outlet: body.outlet ?? "",
      email: body.email ?? "",
      contact: body.contact ?? "",
      phone: body.phone ?? body.contact ?? "",
      address: body.address ?? "",
      hireDate: body.hireDate ?? new Date().toISOString().split("T")[0],
      status: body.status ?? "Active",
      salary: body.salary ?? "",
      emergencyContact: body.emergencyContact ?? "",
      sss: body.sss ?? "",
      philhealth: body.philhealth ?? "",
      pagibig: body.pagibig ?? "",
      tin: body.tin ?? "",
      createdAt: new Date().toISOString(),
    };
    await kv.set(`employee:${id}`, employee);
    return c.json({ employee }, 201);
  } catch (error) {
    console.log("Error creating employee:", error);
    return c.json({ error: `Failed to create employee: ${error}` }, 500);
  }
});

app.put("/make-server-24f1182d/employees/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await kv.get(`employee:${id}`);
    if (!existing) return c.json({ error: "Employee not found" }, 404);
    const updated = { ...existing, ...body, id, updatedAt: new Date().toISOString() };
    await kv.set(`employee:${id}`, updated);
    return c.json({ employee: updated });
  } catch (error) {
    console.log("Error updating employee:", error);
    return c.json({ error: `Failed to update employee: ${error}` }, 500);
  }
});

app.get("/make-server-24f1182d/employees/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const employee = await kv.get(`employee:${id}`);
    if (!employee) return c.json({ error: "Employee not found" }, 404);
    return c.json({ employee });
  } catch (error) {
    console.log("Error fetching employee:", error);
    return c.json({ error: `Failed to fetch employee: ${error}` }, 500);
  }
});

app.delete("/make-server-24f1182d/employees/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`employee:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting employee:", error);
    return c.json({ error: `Failed to delete employee: ${error}` }, 500);
  }
});

// ── APPLICATIONS (RECRUITMENT) ───────────────────────────────────────────────
app.get("/make-server-24f1182d/applications", async (c) => {
  try {
    const records = await kv.getByPrefix("application:");
    const applications = records.filter((a: any) => a != null && typeof a.name === "string");
    return c.json({ applications });
  } catch (error) {
    console.log("Error fetching applications:", error);
    return c.json({ error: `Failed to fetch applications: ${error}` }, 500);
  }
});

app.post("/make-server-24f1182d/applications", async (c) => {
  try {
    const body = await c.req.json();

    const applicantId = `APP-2026-${Date.now()}`;

    const applicant = {
      applicant_id: applicantId,

      name: body.name ?? "",
      first_name: body.firstName ?? "",
      middle_name: body.middleName ?? "",
      last_name: body.lastName ?? "",
      suffix: body.suffix ?? "",
      gender: body.gender ?? "",
      civil_status: body.civilStatus ?? "",
      birthdate: body.birthdate || null,
      birthplace: body.birthplace ?? "",
      height: body.height ?? "",
      weight: body.weight ?? "",

      position_applied: body.position ?? "",
      email: body.email ?? "",
      phone_number: body.phone ?? "",
      address: body.address ?? "",
      experience: body.experience ?? "",
      education: body.education ?? "",
      cover_letter: body.coverLetter ?? "",

      tin: body.tin ?? "",
      sss: body.sss ?? "",
      philhealth: body.philhealth ?? "",
      pagibig: body.pagibig ?? "",
      emergency_contact: body.emergencyContact ?? "",

      resume_file_name: body.resumeFileName ?? null,
      resume_file_data: body.resumeFileData ?? null,
      supporting_documents: body.supportingDocuments ?? [],
      supporting_document_files: body.supportingDocumentFiles ?? [],

      status: "Submitted",
    };

    const { data, error } = await supabase
      .from("applicants")
      .insert(applicant)
      .select()
      .single();

    if (error) {
      console.log("Supabase insert error:", error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ application: data }, 201);
  } catch (error) {
    console.log("Error creating application:", error);
    return c.json({ error: `Failed to create application: ${error}` }, 500);
  }
});

app.put("/make-server-24f1182d/applications/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await kv.get(`application:${id}`);
    if (!existing) return c.json({ error: "Application not found" }, 404);
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await kv.set(`application:${id}`, updated);
    return c.json({ application: updated });
  } catch (error) {
    console.log("Error updating application:", error);
    return c.json({ error: `Failed to update application: ${error}` }, 500);
  }
});

app.get("/make-server-24f1182d/applications/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const application = await kv.get(`application:${id}`);
    if (!application) return c.json({ error: "Application not found" }, 404);
    return c.json({ application });
  } catch (error) {
    console.log("Error fetching application:", error);
    return c.json({ error: `Failed to fetch application: ${error}` }, 500);
  }
});

app.delete("/make-server-24f1182d/applications/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await kv.get(`application:${id}`);
    if (!existing) return c.json({ error: "Application not found" }, 404);
    await kv.del(`application:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting application:", error);
    return c.json({ error: `Failed to delete application: ${error}` }, 500);
  }
});

// ── ATTENDANCE ───────────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/attendance", async (c) => {
  try {
    const records = await kv.getByPrefix("attendance:");
    const attendance = records.filter((a: any) => a != null);
    return c.json({ attendance });
  } catch (error) {
    console.log("Error fetching attendance:", error);
    return c.json({ error: `Failed to fetch attendance: ${error}` }, 500);
  }
});

app.post("/make-server-24f1182d/attendance", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.getByPrefix("attendance:");
    const nextNum = String(existing.length + 1).padStart(5, "0");
    const id = `ATT-${nextNum}`;
    const record = {
      id,
      employee: body.employee,
      date: body.date,
      timeIn: body.timeIn,
      timeOut: body.timeOut,
      totalHours: body.totalHours,
      late: body.late ?? "0",
      undertime: body.undertime ?? "0",
      overtime: body.overtime ?? "0",
      status: body.status ?? "Present",
      corrected: false,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`attendance:${id}`, record);
    return c.json({ record }, 201);
  } catch (error) {
    console.log("Error creating attendance:", error);
    return c.json({ error: `Failed to create attendance: ${error}` }, 500);
  }
});

app.put("/make-server-24f1182d/attendance/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await kv.get(`attendance:${id}`);
    if (!existing) return c.json({ error: "Attendance record not found" }, 404);
    const updated = {
      ...existing,
      ...body,
      id,
      corrected: true,
      correctedAt: new Date().toISOString(),
      correctedBy: body.correctedBy ?? "HR Admin",
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`attendance:${id}`, updated);
    return c.json({ record: updated });
  } catch (error) {
    console.log("Error updating attendance:", error);
    return c.json({ error: `Failed to update attendance: ${error}` }, 500);
  }
});

app.delete("/make-server-24f1182d/attendance/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await kv.get(`attendance:${id}`);
    if (!existing) return c.json({ error: "Attendance record not found" }, 404);
    await kv.del(`attendance:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting attendance:", error);
    return c.json({ error: `Failed to delete attendance: ${error}` }, 500);
  }
});

// ── PAYROLL ──────────────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/payroll", async (c) => {
  try {
    const records = await kv.getByPrefix("payroll:");
    const payrolls = records.filter((p: any) => p != null);
    return c.json({ payrolls });
  } catch (error) {
    console.log("Error fetching payroll:", error);
    return c.json({ error: `Failed to fetch payroll: ${error}` }, 500);
  }
});

app.post("/make-server-24f1182d/payroll", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.getByPrefix("payroll:");
    const nextNum = String(existing.length + 1).padStart(4, "0");
    const id = `PAY-${nextNum}`;
    const record = {
      id,
      employee: body.employee,
      position: body.position,
      period: body.period,
      totalHours: body.totalHours,
      overtime: body.overtime,
      deductions: body.deductions,
      grossPay: body.grossPay,
      netPay: body.netPay,
      status: "Draft",
      releasedAt: null,
      releasedBy: null,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`payroll:${id}`, record);
    return c.json({ record }, 201);
  } catch (error) {
    console.log("Error creating payroll:", error);
    return c.json({ error: `Failed to create payroll: ${error}` }, 500);
  }
});

app.put("/make-server-24f1182d/payroll/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await kv.get(`payroll:${id}`);
    if (!existing) return c.json({ error: "Payroll record not found" }, 404);
    const updated = {
      ...existing,
      ...body,
      updatedAt: new Date().toISOString(),
      ...(body.status === "Released" ? { releasedAt: new Date().toISOString() } : {}),
    };
    await kv.set(`payroll:${id}`, updated);
    return c.json({ record: updated });
  } catch (error) {
    console.log("Error updating payroll:", error);
    return c.json({ error: `Failed to update payroll: ${error}` }, 500);
  }
});

app.delete("/make-server-24f1182d/payroll/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await kv.get(`payroll:${id}`);
    if (!existing) return c.json({ error: "Payroll record not found" }, 404);
    await kv.del(`payroll:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting payroll:", error);
    return c.json({ error: `Failed to delete payroll: ${error}` }, 500);
  }
});

// ── PAYROLL BULK GENERATE ────────────────────────────────────────────────────
app.post("/make-server-24f1182d/payroll/generate", async (c) => {
  try {
    const body = await c.req.json();
    const period = body.period ?? new Date().toISOString().slice(0, 7);
    const [employees, attendances] = await Promise.all([
      kv.getByPrefix("employee:"),
      kv.getByPrefix("attendance:"),
    ]);
    const activeEmployees = employees.filter(
      (e: any) => e?.status === "Active" && (!body.position || e.position === body.position)
    );
    const existing = await kv.getByPrefix("payroll:");
    let counter = existing.length;
    const created: any[] = [];
    for (const emp of activeEmployees) {
      const alreadyExists = existing.some((p: any) => p?.employee === emp.name && p?.period === period);
      if (alreadyExists) continue;
      const empAtt = attendances.filter((a: any) => a?.employee === emp.name && a?.date?.startsWith(period));
      const attendanceHrs = empAtt.reduce((sum: number, a: any) => sum + (parseFloat(a.totalHours) || 0), 0);
      const overtimeHrs = empAtt.reduce((sum: number, a: any) => {
        const ot = parseFloat(String(a.overtime).replace(" min", "")) || 0;
        return sum + (a.overtime?.includes("min") ? ot / 60 : ot);
      }, 0);
      const baseSalary = body.baseSalary ?? 18000;
      const fmt = (n: number) => `\u20b1${Math.round(n).toLocaleString()}`;
      const hourlyRate = baseSalary / 160;
      // Compute actual basic pay from attendance hours; fallback to full base salary if no records
      const actualHrs = attendanceHrs > 0 ? attendanceHrs : 160;
      const basicPay = Math.round(actualHrs * hourlyRate);
      const otPay = Math.round(overtimeHrs * hourlyRate * 1.25);
      const grossPay = basicPay + otPay;
      counter++;
      const id = `PAY-${String(counter).padStart(4, "0")}`;
      const record = {
        id,
        employee: emp.name,
        position: emp.position,
        period,
        // totalHours stores the Base Monthly Salary — shown in Days/Hours/Mins. column for Basic Pay row
        totalHours: baseSalary.toFixed(2),
        overtime: overtimeHrs.toFixed(1),
        basicPayAmt: fmt(basicPay),   // auto-calculated: actual hours × hourly rate
        deductions: "\u20b10",        // default 0; HR fills deductions manually in payslip edit
        grossPay: fmt(grossPay),
        netPay: fmt(grossPay),        // net = gross until manual deductions are entered
        status: "Draft",
        releasedAt: null,
        releasedBy: null,
        createdAt: new Date().toISOString(),
      };
      await kv.set(`payroll:${id}`, record);
      created.push(record);
    }
    return c.json({ created, count: created.length });
  } catch (error) {
    console.log("Error generating payroll:", error);
    return c.json({ error: `Failed to generate payroll: ${error}` }, 500);
  }
});

// ── EVALUATIONS ──────────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/evaluations", async (c) => {
  try {
    const records = await kv.getByPrefix("evaluation:");
    const evaluations = records.filter((e: any) => e != null);
    return c.json({ evaluations });
  } catch (error) {
    console.log("Error fetching evaluations:", error);
    return c.json({ error: `Failed to fetch evaluations: ${error}` }, 500);
  }
});

app.post("/make-server-24f1182d/evaluations", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.getByPrefix("evaluation:");
    const nextNum = String(existing.length + 1).padStart(4, "0");
    const id = `EVAL-${nextNum}`;
    const finalScore =
      body.finalScore !== undefined
        ? body.finalScore
        : (body.workQuality ?? 0) * 0.15 +
          (body.jobKnowledge ?? 0) * 0.10 +
          (body.teamwork ?? 0) * 0.10 +
          (body.initiative ?? 0) * 0.10 +
          (body.peerEvaluation ?? 0) * 0.10 +
          (body.conduct ?? 0) * 0.10 +
          (body.attendance ?? 0) * 0.20 +
          (body.performanceOutput ?? 0) * 0.25;
    const record = {
      id,
      employee: body.employee,
      position: body.position,
      outlet: body.outlet ?? "",
      period: body.period,
      evaluatedBy: body.evaluatedBy ?? "Supervisor",
      evaluatorRole: body.evaluatorRole ?? "supervisor",
      workQuality: body.workQuality,
      jobKnowledge: body.jobKnowledge,
      teamwork: body.teamwork,
      initiative: body.initiative,
      peerEvaluation: body.peerEvaluation,
      conduct: body.conduct,
      attendance: body.attendance,
      performanceOutput: body.performanceOutput,
      comments: body.comments ?? "",
      finalScore: Math.round(finalScore * 100) / 100,
      status: "Pending GM Approval",
      createdAt: new Date().toISOString(),
    };
    await kv.set(`evaluation:${id}`, record);
    return c.json({ record }, 201);
  } catch (error) {
    console.log("Error creating evaluation:", error);
    return c.json({ error: `Failed to create evaluation: ${error}` }, 500);
  }
});

app.put("/make-server-24f1182d/evaluations/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await kv.get(`evaluation:${id}`);
    if (!existing) return c.json({ error: "Evaluation not found" }, 404);
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await kv.set(`evaluation:${id}`, updated);
    return c.json({ record: updated });
  } catch (error) {
    console.log("Error updating evaluation:", error);
    return c.json({ error: `Failed to update evaluation: ${error}` }, 500);
  }
});

app.delete("/make-server-24f1182d/evaluations/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await kv.get(`evaluation:${id}`);
    if (!existing) return c.json({ error: "Evaluation not found" }, 404);
    await kv.del(`evaluation:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting evaluation:", error);
    return c.json({ error: `Failed to delete evaluation: ${error}` }, 500);
  }
});

// ── REQUESTS ─────────────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/requests", async (c) => {
  try {
    const records = await kv.getByPrefix("request:");
    const requests = records.filter((r: any) => r != null);
    return c.json({ requests });
  } catch (error) {
    console.log("Error fetching requests:", error);
    return c.json({ error: `Failed to fetch requests: ${error}` }, 500);
  }
});

app.post("/make-server-24f1182d/requests", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.getByPrefix("request:");
    const nextNum = String(existing.length + 1).padStart(4, "0");
    const id = `REQ-${nextNum}`;
    const record = {
      id,
      employee: body.employee,
      type: body.type,
      date: body.date,
      startDate: body.startDate ?? body.date,
      endDate: body.endDate ?? body.date,
      reason: body.reason,
      status: "Pending",
      supervisorStatus: "Pending",
      supervisorNote: "",
      hrStatus: "Pending",
      hrNote: "",
      submittedDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };
    await kv.set(`request:${id}`, record);
    return c.json({ record }, 201);
  } catch (error) {
    console.log("Error creating request:", error);
    return c.json({ error: `Failed to create request: ${error}` }, 500);
  }
});

app.put("/make-server-24f1182d/requests/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await kv.get(`request:${id}`);
    if (!existing) return c.json({ error: "Request not found" }, 404);
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await kv.set(`request:${id}`, updated);
    return c.json({ record: updated });
  } catch (error) {
    console.log("Error updating request:", error);
    return c.json({ error: `Failed to update request: ${error}` }, 500);
  }
});

app.delete("/make-server-24f1182d/requests/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await kv.get(`request:${id}`);
    if (!existing) return c.json({ error: "Request not found" }, 404);
    await kv.del(`request:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting request:", error);
    return c.json({ error: `Failed to delete request: ${error}` }, 500);
  }
});

// ── SCHEDULES ────────────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/schedules", async (c) => {
  try {
    const records = await kv.getByPrefix("schedule:");
    const schedules = records.filter((s: any) => s != null);
    return c.json({ schedules });
  } catch (error) {
    console.log("Error fetching schedules:", error);
    return c.json({ error: `Failed to fetch schedules: ${error}` }, 500);
  }
});

app.post("/make-server-24f1182d/schedules", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.getByPrefix("schedule:");
    const nextNum = String(existing.length + 1).padStart(4, "0");
    const id = `SCH-${nextNum}`;
    const record = {
      id,
      employee: body.employee,
      position: body.position ?? "",
      outlet: body.outlet,
      week: body.week,
      timeIn: body.timeIn ?? "",
      timeOut: body.timeOut ?? "",
      breakTime: body.breakTime ?? "1 hour",
      monday: body.monday ?? "",
      tuesday: body.tuesday ?? "",
      wednesday: body.wednesday ?? "",
      thursday: body.thursday ?? "",
      friday: body.friday ?? "",
      saturday: body.saturday ?? "",
      sunday: body.sunday ?? "",
      status: "Draft",
      confirmedBy: null,
      confirmedAt: null,
      createdBy: body.createdBy ?? "",
      createdAt: new Date().toISOString(),
    };
    await kv.set(`schedule:${id}`, record);
    return c.json({ record }, 201);
  } catch (error) {
    console.log("Error creating schedule:", error);
    return c.json({ error: `Failed to create schedule: ${error}` }, 500);
  }
});

app.put("/make-server-24f1182d/schedules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await kv.get(`schedule:${id}`);
    if (!existing) return c.json({ error: "Schedule not found" }, 404);
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await kv.set(`schedule:${id}`, updated);
    return c.json({ record: updated });
  } catch (error) {
    console.log("Error updating schedule:", error);
    return c.json({ error: `Failed to update schedule: ${error}` }, 500);
  }
});

app.delete("/make-server-24f1182d/schedules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const existing = await kv.get(`schedule:${id}`);
    if (!existing) return c.json({ error: "Schedule not found" }, 404);
    await kv.del(`schedule:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting schedule:", error);
    return c.json({ error: `Failed to delete schedule: ${error}` }, 500);
  }
});

// ── DASHBOARD STATS ──────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/dashboard/stats", async (c) => {
  try {
    const [employees, applications, requests, attendance, evaluations, payrolls] = await Promise.all([
      kv.getByPrefix("employee:"),
      kv.getByPrefix("application:"),
      kv.getByPrefix("request:"),
      kv.getByPrefix("attendance:"),
      kv.getByPrefix("evaluation:"),
      kv.getByPrefix("payroll:"),
    ]);
    const activeEmployees = employees.filter((e: any) => e?.status === "Active").length;
    const pendingApplications = applications.filter((a: any) => a?.status === "Submitted" || a?.status === "Under Review").length;
    const forInterviewCount = applications.filter((a: any) => a?.status === "For Interview").length;
    const pendingRequests = requests.filter((r: any) => r?.status === "Pending").length;
    const supervisorApprovedRequests = requests.filter((r: any) => r?.status === "Supervisor Approved").length;
    const attendanceIssues = attendance.filter((a: any) => a?.status === "Late" || a?.status === "Absent").length;
    const payrollForReview = payrolls.filter((p: any) => p?.status === "For Review").length;
    const payrollReleased = payrolls.filter((p: any) => p?.status === "Released").length;
    const topEval = evaluations.filter((e: any) => e != null).sort((a: any, b: any) => (b.finalScore ?? 0) - (a.finalScore ?? 0))[0];
    const eotm = evaluations.find((e: any) => e?.status === "Employee of the Month");
    return c.json({
      activeEmployees,
      pendingApplications,
      forInterviewCount,
      pendingRequests,
      supervisorApprovedRequests,
      attendanceIssues,
      payrollForReview,
      payrollReleased,
      topEvaluee: topEval?.employee ?? null,
      topScore: topEval?.finalScore ?? null,
      eotmEmployee: eotm?.employee ?? null,
    });
  } catch (error) {
    console.log("Error fetching dashboard stats:", error);
    return c.json({ error: `Failed to fetch stats: ${error}` }, 500);
  }
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
app.get("/make-server-24f1182d/notifications", async (c) => {
  try {
    const recipient = c.req.query("recipient");
    const records = await kv.getByPrefix("notification:");
    const notifications = records.filter(
      (n: any) => n != null && (!recipient || n.recipientEmployee === recipient)
    );
    // sort newest first
    notifications.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json({ notifications });
  } catch (error) {
    console.log("Error fetching notifications:", error);
    return c.json({ error: `Failed to fetch notifications: ${error}` }, 500);
  }
});

app.post("/make-server-24f1182d/notifications", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.getByPrefix("notification:");
    const nextNum = String(existing.length + 1).padStart(5, "0");
    const id = `NOTIF-${nextNum}`;
    const record = {
      id,
      recipientEmployee: body.recipientEmployee,
      type: body.type, // 'schedule_published' | 'schedule_edited'
      message: body.message,
      scheduleId: body.scheduleId ?? "",
      week: body.week ?? "",
      createdBy: body.createdBy ?? "",
      createdAt: new Date().toISOString(),
      read: false,
    };
    await kv.set(`notification:${id}`, record);
    return c.json({ record }, 201);
  } catch (error) {
    console.log("Error creating notification:", error);
    return c.json({ error: `Failed to create notification: ${error}` }, 500);
  }
});

app.put("/make-server-24f1182d/notifications/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await kv.get(`notification:${id}`);
    if (!existing) return c.json({ error: "Notification not found" }, 404);
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await kv.set(`notification:${id}`, updated);
    return c.json({ record: updated });
  } catch (error) {
    console.log("Error updating notification:", error);
    return c.json({ error: `Failed to update notification: ${error}` }, 500);
  }
});

app.delete("/make-server-24f1182d/notifications/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`notification:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting notification:", error);
    return c.json({ error: `Failed to delete notification: ${error}` }, 500);
  }
});

Deno.serve(app.fetch);