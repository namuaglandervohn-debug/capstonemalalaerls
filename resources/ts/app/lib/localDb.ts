/**
 * localDb.ts
 * Full localStorage-based backend that mirrors every Supabase edge-function
 * route. Used automatically when the server is unreachable (e.g. 403 deploy
 * error).  Returns proper Response objects so the rest of the app is unaware.
 */

// ── In-memory file store ──────────────────────────────────────────────────────
// Files are kept here as native JS objects — no size limits, no serialisation
// failures, instant access. localStorage is used only as a secondary persistence
// layer (best-effort; silently ignored on QuotaExceededError).
const _fileStore = new Map<string, any>();

// ── Storage keys ─────────────────────────────────────────────────────────────
const K = {
  users:        'hris_users',
  employees:    'hris_employees',
  applications: 'hris_applications',
  attendance:   'hris_attendance',
  payroll:      'hris_payroll',
  evaluations:  'hris_evaluations',
  requests:     'hris_requests',
  schedules:    'hris_schedules',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function load(key: string): any[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}
function save(key: string, data: any[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)); }
  catch { /* QuotaExceededError — metadata is already in memory, silently skip */ }
}

/**
 * saveFile — dual-layer storage:
 *  1. In-memory Map  (always works, survives within the same tab session)
 *  2. localStorage   (best-effort persistence across refreshes)
 */
function saveFile(appId: string, fileData: {
  resumeFileName?: string | null;
  resumeFileData?: string | null;
  supportingDocuments?: string[];
  supportingDocumentFiles?: any[];
}): void {
  // 1. Always store in memory immediately — this is the primary store
  _fileStore.set(appId, fileData);

  // 2. Try localStorage as a persistence backup
  try {
    localStorage.setItem(`hris_file_${appId}`, JSON.stringify(fileData));
  } catch {
    // QuotaExceededError — file will be in memory only this session
  }
}

function loadFile(appId: string): any | null {
  // 1. Check in-memory store first (most reliable, always up-to-date)
  if (_fileStore.has(appId)) {
    return _fileStore.get(appId);
  }
  // 2. Fall back to localStorage (e.g. after a page refresh)
  try {
    const raw = localStorage.getItem(`hris_file_${appId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Repopulate memory cache so future reads are instant
    _fileStore.set(appId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function deleteFile(appId: string): void {
  _fileStore.delete(appId);
  try { localStorage.removeItem(`hris_file_${appId}`); } catch { /* ignore */ }
}

// ── Public helpers (called directly from form/view components) ────────────────
/** Save file attachments straight into the in-memory store.
 *  Called from the application form right after a successful submit so that
 *  files are always available regardless of what the server does with them. */
export function saveApplicationFiles(appId: string, fileData: {
  resumeFileName?: string | null;
  resumeFileData?: string | null;
  supportingDocuments?: string[];
  supportingDocumentFiles?: any[];
}): void {
  saveFile(appId, fileData);
}

/** Load file attachments straight from the in-memory store.
 *  Called from the profile dialog so that files are shown even when the
 *  server's response doesn't include binary data. */
export function loadApplicationFiles(appId: string): {
  resumeFileName?: string | null;
  resumeFileData?: string | null;
  supportingDocuments?: string[];
  supportingDocumentFiles?: any[];
} | null {
  return loadFile(appId);
}

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function padId(prefix: string, n: number, pad = 4): string {
  return `${prefix}${String(n).padStart(pad, '0')}`;
}
function now(): string { return new Date().toISOString(); }
function today(): string { return now().split('T')[0]; }

// ── Route dispatcher ─────────────────────────────────────────────────────────
export async function localDbFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = init?.body ? (() => { try { return JSON.parse(init.body as string); } catch { return {}; } })() : {};

  // Strip the base path so we only match the suffix
  const path = url.replace(/^.*make-server-24f1182d/, '');

  // ── HEALTH ────────────────────────────────────────────────────────────────
  if (path === '/health') return ok({ status: 'ok (local)' });

  // ── USERS ─────────────────────────────────────────────────────────────────
  if (path === '/users') {
    if (method === 'GET') {
      return ok({ users: load(K.users) });
    }
    if (method === 'POST') {
      const items = load(K.users);
      const id = padId('USR-', items.length + 1, 3);
      const user = {
        id, name: body.name, email: body.email,
        role: body.role ?? 'employee',
        employeeId: body.employeeId ?? null,
        outlet: body.outlet ?? null,
        password: body.password ?? 'password',
        active: true,
        createdAt: now(),
      };
      items.push(user); save(K.users, items);
      return ok({ user }, 201);
    }
  }
  const userMatch = path.match(/^\/users\/(.+)$/);
  if (userMatch) {
    const id = userMatch[1];
    const items = load(K.users);
    const idx = items.findIndex((u: any) => u.id === id);
    if (method === 'GET') {
      if (idx === -1) return ok({ error: 'User not found' }, 404);
      return ok({ user: items[idx] });
    }
    if (method === 'PUT') {
      if (idx === -1) return ok({ error: 'User not found' }, 404);
      items[idx] = { ...items[idx], ...body, id, updatedAt: now() };
      save(K.users, items);
      return ok({ user: items[idx] });
    }
    if (method === 'DELETE') {
      if (idx !== -1) { items.splice(idx, 1); save(K.users, items); }
      return ok({ success: true });
    }
  }

  // ── EMPLOYEES ─────────────────────────────────────────────────────────────
  if (path === '/employees') {
    if (method === 'GET') {
      return ok({ employees: load(K.employees) });
    }
    if (method === 'POST') {
      const items = load(K.employees);
      const id = `EMP${String(items.length + 1).padStart(3, '0')}`;
      const employee = {
        id, name: body.name, position: body.position,
        department: body.department ?? '',
        outlet: body.outlet ?? '',
        email: body.email ?? '',
        phone: body.phone ?? '',
        address: body.address ?? '',
        hireDate: body.hireDate ?? today(),
        status: body.status ?? 'Active',
        salary: body.salary ?? '',
        emergencyContact: body.emergencyContact ?? '',
        sss: body.sss ?? '', philhealth: body.philhealth ?? '',
        pagibig: body.pagibig ?? '', tin: body.tin ?? '',
        createdAt: now(),
      };
      items.push(employee); save(K.employees, items);
      return ok({ employee }, 201);
    }
  }
  const empMatch = path.match(/^\/employees\/(.+)$/);
  if (empMatch) {
    const id = empMatch[1];
    const items = load(K.employees);
    const idx = items.findIndex((e: any) => e.id === id);
    if (method === 'GET') {
      if (idx === -1) return ok({ error: 'Employee not found' }, 404);
      return ok({ employee: items[idx] });
    }
    if (method === 'PUT') {
      if (idx === -1) return ok({ error: 'Employee not found' }, 404);
      items[idx] = { ...items[idx], ...body, id, updatedAt: now() };
      save(K.employees, items);
      return ok({ employee: items[idx] });
    }
    if (method === 'DELETE') {
      if (idx !== -1) { items.splice(idx, 1); save(K.employees, items); }
      return ok({ success: true });
    }
  }

  // ── APPLICATIONS ──────────────────────────────────────────────────────────
  if (path === '/applications') {
    if (method === 'GET') {
      // Return metadata only (no binary blobs) to keep list fast & within quota
      return ok({ applications: load(K.applications) });
    }
    if (method === 'POST') {
      const items = load(K.applications);
      const id = `APP-2026-${String(items.length + 1).padStart(4, '0')}`;

      // Separate file binary data from metadata
      const { resumeFileData, supportingDocumentFiles, ...meta } = body;

      const application = {
        id,
        name: meta.name,
        firstName: meta.firstName ?? '', middleName: meta.middleName ?? '',
        lastName: meta.lastName ?? '', suffix: meta.suffix ?? '',
        gender: meta.gender ?? '', civilStatus: meta.civilStatus ?? '',
        birthdate: meta.birthdate ?? '', birthplace: meta.birthplace ?? '',
        height: meta.height ?? '', weight: meta.weight ?? '',
        position: meta.position, email: meta.email, phone: meta.phone,
        address: meta.address ?? '',
        experience: meta.experience ?? '', education: meta.education ?? '',
        coverLetter: meta.coverLetter ?? '',
        tin: meta.tin ?? '', sss: meta.sss ?? '',
        philhealth: meta.philhealth ?? '', pagibig: meta.pagibig ?? '',
        emergencyContact: meta.emergencyContact ?? '',
        // Store filenames in main record for list display
        resumeFileName: meta.resumeFileName ?? null,
        resumeFileData: null,                    // binary kept separate
        supportingDocuments: meta.supportingDocuments ?? [],
        supportingDocumentFiles: [],             // binary kept separate
        dateApplied: today(),
        status: 'Submitted',
        hasResume: meta.hasResume ?? false,
        hasBirthCert: meta.hasBirthCert ?? false,
        hasTOR: meta.hasTOR ?? false,
        hasMedCert: meta.hasMedCert ?? false,
        requirementsNote: meta.requirementsNote ?? '',
        interviewDate: null, interviewTime: null, interviewLocation: null,
        interviewNotes: null, interviewFeedback: null,
        hiringDecision: null, scheduledBy: null,
        createdAt: now(),
      };

      items.push(application);
      save(K.applications, items);

      // Store file binary data in a dedicated per-application key
      saveFile(id, {
        resumeFileName: meta.resumeFileName ?? null,
        resumeFileData: resumeFileData ?? null,
        supportingDocuments: meta.supportingDocuments ?? [],
        supportingDocumentFiles: supportingDocumentFiles ?? [],
      });

      return ok({ application }, 201);
    }
  }
  const appMatch = path.match(/^\/applications\/(.+)$/);
  if (appMatch) {
    const id = appMatch[1];
    const items = load(K.applications);
    const idx = items.findIndex((a: any) => a.id === id);
    if (method === 'GET') {
      if (idx === -1) return ok({ error: 'Application not found' }, 404);
      // Merge file data back in for full profile view
      const fileData = loadFile(id);
      const full = fileData ? { ...items[idx], ...fileData } : items[idx];
      return ok({ application: full });
    }
    if (method === 'PUT') {
      if (idx === -1) return ok({ error: 'Application not found' }, 404);
      const { resumeFileData, supportingDocumentFiles, ...bodyMeta } = body;

      // If update contains new file data, persist it separately
      if (resumeFileData || (supportingDocumentFiles && supportingDocumentFiles.length > 0)) {
        const existing = loadFile(id) ?? {};
        saveFile(id, {
          resumeFileName: bodyMeta.resumeFileName ?? existing.resumeFileName,
          resumeFileData: resumeFileData ?? existing.resumeFileData,
          supportingDocuments: bodyMeta.supportingDocuments ?? existing.supportingDocuments ?? [],
          supportingDocumentFiles: supportingDocumentFiles ?? existing.supportingDocumentFiles ?? [],
        });
      }

      // Save metadata (no binary) to main array
      items[idx] = { ...items[idx], ...bodyMeta, resumeFileData: null, supportingDocumentFiles: [], updatedAt: now() };
      save(K.applications, items);

      // Return full record with files for the UI
      const fileData = loadFile(id);
      const full = fileData ? { ...items[idx], ...fileData } : items[idx];
      return ok({ application: full });
    }
    if (method === 'DELETE') {
      if (idx !== -1) {
        deleteFile(id);           // clean up file data too
        items.splice(idx, 1);
        save(K.applications, items);
      }
      return ok({ success: true });
    }
  }

  // ── ATTENDANCE ────────────────────────────────────────────────────────────
  if (path === '/attendance') {
    if (method === 'GET') {
      return ok({ attendance: load(K.attendance) });
    }
    if (method === 'POST') {
      const items = load(K.attendance);
      const id = `ATT-${String(items.length + 1).padStart(5, '0')}`;
      const record = {
        id, employee: body.employee, date: body.date,
        timeIn: body.timeIn, timeOut: body.timeOut,
        totalHours: body.totalHours,
        late: body.late ?? '0', undertime: body.undertime ?? '0',
        overtime: body.overtime ?? '0',
        status: body.status ?? 'Present',
        corrected: false, createdAt: now(),
      };
      items.push(record); save(K.attendance, items);
      return ok({ record }, 201);
    }
  }
  const attMatch = path.match(/^\/attendance\/(.+)$/);
  if (attMatch) {
    const id = attMatch[1];
    const items = load(K.attendance);
    const idx = items.findIndex((a: any) => a.id === id);
    if (method === 'PUT') {
      if (idx === -1) return ok({ error: 'Record not found' }, 404);
      items[idx] = {
        ...items[idx], ...body, id,
        corrected: true, correctedAt: now(),
        correctedBy: body.correctedBy ?? 'HR Admin',
        updatedAt: now(),
      };
      save(K.attendance, items);
      return ok({ record: items[idx] });
    }
    if (method === 'DELETE') {
      if (idx !== -1) { items.splice(idx, 1); save(K.attendance, items); }
      return ok({ success: true });
    }
  }

  // ── PAYROLL ───────────────────────────────────────────────────────────────
  if (path === '/payroll/generate') {
    const period = body.period ?? now().slice(0, 7);
    const employees = load(K.employees).filter((e: any) => e?.status === 'Active');
    const attendances = load(K.attendance);
    const existing = load(K.payroll);
    let counter = existing.length;
    const created: any[] = [];
    for (const emp of employees) {
      if (existing.some((p: any) => p?.employee === emp.name && p?.period === period)) continue;
      const empAtt = attendances.filter((a: any) => a?.employee === emp.name && a?.date?.startsWith(period));
      const totalHours = empAtt.reduce((s: number, a: any) => s + (parseFloat(a.totalHours) || 0), 0);
      const overtimeHrs = empAtt.reduce((s: number, a: any) => {
        const ot = parseFloat(String(a.overtime).replace(' min', '')) || 0;
        return s + (a.overtime?.includes('min') ? ot / 60 : ot);
      }, 0);
      const base = body.baseSalary ?? 18000;
      const hr = base / 160;
      const gross = base + overtimeHrs * hr * 1.25;
      const sss = Math.round(gross * 0.045);
      const ph = Math.round(gross * 0.02);
      const pi = 100;
      const net = gross - sss - ph - pi;
      counter++;
      const id = padId('PAY-', counter);
      const record = {
        id, employee: emp.name, position: emp.position, period,
        totalHours: totalHours > 0 ? totalHours.toFixed(1) : '160',
        overtime: overtimeHrs.toFixed(1),
        deductions: `\u20b1${(sss + ph + pi).toLocaleString()}`,
        grossPay: `\u20b1${Math.round(gross).toLocaleString()}`,
        netPay: `\u20b1${Math.round(net).toLocaleString()}`,
        sss: `\u20b1${sss.toLocaleString()}`,
        philhealth: `\u20b1${ph.toLocaleString()}`,
        pagibig: `\u20b1${pi.toLocaleString()}`,
        status: 'Draft', releasedAt: null, releasedBy: null,
        createdAt: now(),
      };
      existing.push(record); created.push(record);
    }
    save(K.payroll, existing);
    return ok({ created, count: created.length });
  }
  if (path === '/payroll') {
    if (method === 'GET') return ok({ payrolls: load(K.payroll) });
    if (method === 'POST') {
      const items = load(K.payroll);
      const id = padId('PAY-', items.length + 1);
      const record = {
        id, employee: body.employee, position: body.position,
        period: body.period, totalHours: body.totalHours,
        overtime: body.overtime, deductions: body.deductions,
        grossPay: body.grossPay, netPay: body.netPay,
        status: 'Draft', releasedAt: null, releasedBy: null,
        createdAt: now(),
      };
      items.push(record); save(K.payroll, items);
      return ok({ record }, 201);
    }
  }
  const payMatch = path.match(/^\/payroll\/(.+)$/);
  if (payMatch) {
    const id = payMatch[1];
    const items = load(K.payroll);
    const idx = items.findIndex((p: any) => p.id === id);
    if (method === 'PUT') {
      if (idx === -1) return ok({ error: 'Record not found' }, 404);
      items[idx] = {
        ...items[idx], ...body,
        updatedAt: now(),
        ...(body.status === 'Released' ? { releasedAt: now() } : {}),
      };
      save(K.payroll, items);
      return ok({ record: items[idx] });
    }
    if (method === 'DELETE') {
      if (idx !== -1) { items.splice(idx, 1); save(K.payroll, items); }
      return ok({ success: true });
    }
  }

  // ── EVALUATIONS ───────────────────────────────────────────────────────────
  if (path === '/evaluations') {
    if (method === 'GET') return ok({ evaluations: load(K.evaluations) });
    if (method === 'POST') {
      const items = load(K.evaluations);
      const id = padId('EVAL-', items.length + 1);
      const score =
        (body.workQuality ?? 0) * 0.15 + (body.jobKnowledge ?? 0) * 0.10 +
        (body.teamwork ?? 0) * 0.10 + (body.initiative ?? 0) * 0.10 +
        (body.peerEvaluation ?? 0) * 0.10 + (body.conduct ?? 0) * 0.10 +
        (body.attendance ?? 0) * 0.20 + (body.performanceOutput ?? 0) * 0.25;
      const record = {
        id, employee: body.employee, position: body.position,
        outlet: body.outlet ?? '', period: body.period,
        evaluatedBy: body.evaluatedBy ?? 'Supervisor',
        evaluatorRole: body.evaluatorRole ?? 'supervisor',
        workQuality: body.workQuality, jobKnowledge: body.jobKnowledge,
        teamwork: body.teamwork, initiative: body.initiative,
        peerEvaluation: body.peerEvaluation, conduct: body.conduct,
        attendance: body.attendance, performanceOutput: body.performanceOutput,
        comments: body.comments ?? '',
        finalScore: Math.round(score * 100) / 100,
        status: 'Pending GM Approval', createdAt: now(),
      };
      items.push(record); save(K.evaluations, items);
      return ok({ record }, 201);
    }
  }
  const evalMatch = path.match(/^\/evaluations\/(.+)$/);
  if (evalMatch) {
    const id = evalMatch[1];
    const items = load(K.evaluations);
    const idx = items.findIndex((e: any) => e.id === id);
    if (method === 'PUT') {
      if (idx === -1) return ok({ error: 'Evaluation not found' }, 404);
      items[idx] = { ...items[idx], ...body, updatedAt: now() };
      save(K.evaluations, items);
      return ok({ record: items[idx] });
    }
    if (method === 'DELETE') {
      if (idx !== -1) { items.splice(idx, 1); save(K.evaluations, items); }
      return ok({ success: true });
    }
  }

  // ── REQUESTS ──────────────────────────────────────────────────────────────
  if (path === '/requests') {
    if (method === 'GET') return ok({ requests: load(K.requests) });
    if (method === 'POST') {
      const items = load(K.requests);
      const id = padId('REQ-', items.length + 1);
      const record = {
        id, employee: body.employee, type: body.type,
        date: body.date, startDate: body.startDate ?? body.date,
        endDate: body.endDate ?? body.date, reason: body.reason,
        status: 'Pending',
        supervisorStatus: 'Pending', supervisorNote: '',
        hrStatus: 'Pending', hrNote: '',
        submittedDate: today(), createdAt: now(),
      };
      items.push(record); save(K.requests, items);
      return ok({ record }, 201);
    }
  }
  const reqMatch = path.match(/^\/requests\/(.+)$/);
  if (reqMatch) {
    const id = reqMatch[1];
    const items = load(K.requests);
    const idx = items.findIndex((r: any) => r.id === id);
    if (method === 'PUT') {
      if (idx === -1) return ok({ error: 'Request not found' }, 404);
      items[idx] = { ...items[idx], ...body, updatedAt: now() };
      save(K.requests, items);
      return ok({ record: items[idx] });
    }
    if (method === 'DELETE') {
      if (idx !== -1) { items.splice(idx, 1); save(K.requests, items); }
      return ok({ success: true });
    }
  }

  // ── SCHEDULES ─────────────────────────────────────────────────────────────
  if (path === '/schedules') {
    if (method === 'GET') return ok({ schedules: load(K.schedules) });
    if (method === 'POST') {
      const items = load(K.schedules);
      const id = padId('SCH-', items.length + 1);
      const record = {
        id, employee: body.employee, position: body.position ?? '',
        outlet: body.outlet, week: body.week,
        timeIn: body.timeIn ?? '', timeOut: body.timeOut ?? '',
        breakTime: body.breakTime ?? '1 hour',
        monday: body.monday ?? '', tuesday: body.tuesday ?? '',
        wednesday: body.wednesday ?? '', thursday: body.thursday ?? '',
        friday: body.friday ?? '', saturday: body.saturday ?? '',
        sunday: body.sunday ?? '',
        status: 'Draft', confirmedBy: null, confirmedAt: null,
        createdBy: body.createdBy ?? '', createdAt: now(),
      };
      items.push(record); save(K.schedules, items);
      return ok({ record }, 201);
    }
  }
  const schMatch = path.match(/^\/schedules\/(.+)$/);
  if (schMatch) {
    const id = schMatch[1];
    const items = load(K.schedules);
    const idx = items.findIndex((s: any) => s.id === id);
    if (method === 'PUT') {
      if (idx === -1) return ok({ error: 'Schedule not found' }, 404);
      items[idx] = { ...items[idx], ...body, updatedAt: now() };
      save(K.schedules, items);
      return ok({ record: items[idx] });
    }
    if (method === 'DELETE') {
      if (idx !== -1) { items.splice(idx, 1); save(K.schedules, items); }
      return ok({ success: true });
    }
  }

  // ── DASHBOARD STATS ───────────────────────────────────────────────────────
  if (path === '/dashboard/stats') {
    const employees    = load(K.employees);
    const applications = load(K.applications);
    const requests     = load(K.requests);
    const attendance   = load(K.attendance);
    const evaluations  = load(K.evaluations);
    const payrolls     = load(K.payroll);
    const topEval = [...evaluations]
      .sort((a: any, b: any) => (b.finalScore ?? 0) - (a.finalScore ?? 0))[0];
    const eotm = evaluations.find((e: any) => e?.status === 'Employee of the Month');
    return ok({
      activeEmployees: employees.filter((e: any) => e?.status === 'Active').length,
      pendingApplications: applications.filter((a: any) => ['Submitted', 'Under Review'].includes(a?.status)).length,
      forInterviewCount: applications.filter((a: any) => a?.status === 'For Interview').length,
      pendingRequests: requests.filter((r: any) => r?.status === 'Pending').length,
      supervisorApprovedRequests: requests.filter((r: any) => r?.status === 'Supervisor Approved').length,
      attendanceIssues: attendance.filter((a: any) => ['Late', 'Absent'].includes(a?.status)).length,
      payrollForReview: payrolls.filter((p: any) => p?.status === 'For Review').length,
      payrollReleased: payrolls.filter((p: any) => p?.status === 'Released').length,
      topEvaluee: topEval?.employee ?? null,
      topScore: topEval?.finalScore ?? null,
      eotmEmployee: eotm?.employee ?? null,
    });
  }

  // 404 fallback
  return ok({ error: `Local DB: no handler for ${method} ${path}` }, 404);
}