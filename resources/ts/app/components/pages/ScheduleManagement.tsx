import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Grid,
  CircularProgress, Alert, Snackbar, Tooltip, IconButton,
  Autocomplete, Divider,
} from '@mui/material';
import {
  AddCircleOutline, Sync, TaskAlt, DoneAll, CloudUpload,
  CancelOutlined, EditOutlined as EditIcon, CheckCircleOutline,
} from '@mui/icons-material';
import { CalendarMonth } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { supabase } from "../../lib/supabaseClient";
import { OUTLETS, POSITIONS } from '../../lib/constants';

const AVAILABLE_POSITIONS = POSITIONS.filter(position => position !== 'Payroll Staff');
import { useAuth } from '../../context/AuthContext';

interface Schedule {
  id: string; employeeId: string; employee: string; position: string; outlet: string; week: string;
  timeIn: string; timeOut: string; breakTime: string;
  monday: string; tuesday: string; wednesday: string; thursday: string;
  friday: string; saturday: string; sunday: string;
  status: 'Draft' | 'Published' | 'Confirmed' | 'Declined';
  confirmedBy?: string; confirmedAt?: string;
  declinedBy?: string; declinedAt?: string;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY = {
  employeeId: '',
  employee: '',
  position: '',
  outlet: '',
  week: '',
  timeIn: '',
  timeOut: '',
  breakTime: '1 hour',
  monday: '',
  tuesday: '',
  wednesday: '',
  thursday: '',
  friday: '',
  saturday: '',
  sunday: '',
};

const SHIFT_PRESETS = [
  'Off',
  '6:00 AM – 3:00 PM',
  '7:00 AM – 4:00 PM',
  '8:00 AM – 5:00 PM',
  '9:00 AM – 6:00 PM',
  '10:00 AM – 7:00 PM',
  'AM (6:00 AM – 2:00 PM)',
  'MID (2:00 PM – 10:00 PM)',
  'PM (10:00 PM – 6:00 AM)',
  'Full (8:00 AM – 5:00 PM)',
];

const BREAK_TIME_OPTIONS = ['30 minutes', '1 hour', '1 hour 30 minutes', '2 hours'];

const getWeekRange = (offsetWeeks: number = 0): string => {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mDay = monday.getDate(), sDay = sunday.getDate();
  const mMonth = monday.getMonth(), sMonth = sunday.getMonth();
  const year = sunday.getFullYear();
  if (mMonth === sMonth) return `${MONTHS[mMonth]} ${mDay}–${sDay}, ${year}`;
  return `${MONTHS[mMonth]} ${mDay} – ${MONTHS[sMonth]} ${sDay}, ${year}`;
};

export default function ScheduleManagement() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [filterOutlet, setFilterOutlet] = useState('all');
  const [editDialog, setEditDialog] = useState(false);
  const [editRecord, setEditRecord] = useState<Schedule | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);

  // Employee list with position + outlet for auto-fill
  const [employeeList, setEmployeeList] = useState<{
  employeeId: string;
  name: string;
  position: string;
  outlet: string;
}[]>([]);
  const excelRef = useRef<HTMLInputElement>(null);
  const [importingExcel, setImportingExcel] = useState(false);

  const currentRole = String((user as any)?.role ?? '').toLowerCase();
  const currentEmployeeId = String((user as any)?.employee_id ?? (user as any)?.employeeId ?? '');
  const currentUserName = String((user as any)?.name ?? (user as any)?.full_name ?? (user as any)?.email ?? 'User');
  const canPublish = currentRole === 'hr_admin' || currentRole.includes('hr') || currentRole.includes('admin') || currentRole.includes('supervisor') || currentRole === 'general_manager';
  const canConfirm = currentRole === 'employee' || currentRole.includes('employee');

  // ── Push a schedule notification to an employee (fire-and-forget) ──────
  const pushNotification = async (
  recipientEmployeeId: string,
  title: string,
  message: string,
  type: string,
) => {
  try {
    await supabase
      .from("notifications")
      .insert({
        recipient_employee_id: recipientEmployeeId,
        title,
        message,
        type,
      });
  } catch (error) {
    console.error("Notification error:", error);
  }
};

  // ── Data fetchers ────────────────────────────────────────────────────────
  const fetchSchedules = async () => {
  setLoading(true);
  setError(null);

  try {
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("schedule")
      .select("*");

    if (scheduleError) throw scheduleError;

    const { data: employeeData, error: employeeError } = await supabase
      .from("employees")
      .select("employee_id, first_name, middle_name, last_name, suffix");

    if (employeeError) throw employeeError;

    const employeeMap = new Map(
      (employeeData ?? []).map((e: any) => [
        e.employee_id,
        `${e.first_name ?? ""} ${e.middle_name ?? ""} ${e.last_name ?? ""} ${e.suffix ?? ""}`
          .replace(/\s+/g, " ")
          .trim(),
      ])
    );

    const visibleSchedules =
    canConfirm
    ? (scheduleData ?? []).filter((s: any) => s.employee_id === currentEmployeeId)
    : (scheduleData ?? []);

    const mappedSchedules: Schedule[] = visibleSchedules.map((s: any) => ({
      id: s.schedule_id ?? "—",
      employeeId: s.employee_id ?? "",
      employee: employeeMap.get(s.employee_id) ?? "—",
      position: s.position ?? "",
      outlet: s.outlet ?? "",
      week: s.week ?? "",
      timeIn: s.time_in ?? "",
      timeOut: s.time_out ?? "",
      breakTime: s.break_time ?? "",
      monday: s.monday ?? "",
      tuesday: s.tuesday ?? "",
      wednesday: s.wednesday ?? "",
      thursday: s.thursday ?? "",
      friday: s.friday ?? "",
      saturday: s.saturday ?? "",
      sunday: s.sunday ?? "",
      status: s.status ?? "Draft",
      confirmedBy: s.confirmed_by ?? "",
      confirmedAt: s.confirmed_at ?? "",
      declinedBy: s.declined_by ?? "",
      declinedAt: s.declined_at ?? "",
    }));

    setSchedules(mappedSchedules);
  } catch (e: any) {
    setError(`Could not load schedules: ${e.message}`);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => { fetchSchedules(); }, []);

   // Fetch employee list — includes position AND outlet for auto-fill
  useEffect(() => {
  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("employee_id, first_name, middle_name, last_name, position, outlet, status")
      .neq("status", "Resigned")
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Failed to fetch employees:", error);
      return;
    }

    const list = (data ?? []).map((e: any) => ({
      employeeId: e.employee_id,
      name: `${e.first_name ?? ""} ${e.middle_name ?? ""} ${e.last_name ?? ""}`
        .replace(/\s+/g, " ")
        .trim(),
      position: e.position ?? "",
      outlet: e.outlet ?? "",
    }));

    setEmployeeList(list);
  };

  fetchEmployees();
}, []);

  const handleSaveDraft = async () => {
  try {
    setSaving(true);

    const year = new Date().getFullYear();

const { data: existingSchedules, error: scheduleIdError } = await supabase
  .from("schedule")
  .select("schedule_id")
  .like("schedule_id", `SCH-${year}-%`);

if (scheduleIdError) throw scheduleIdError;

const numbers = (existingSchedules ?? [])
  .map((s: any) => {
    const match = String(s.schedule_id).match(/SCH-\d{4}-(\d+)$/);
    return match ? Number(match[1]) : 0;
  })
  .filter((n) => n > 0);

const nextNumber =
  numbers.length > 0
    ? Math.max(...numbers) + 1
    : 1;

const scheduleId =
  `SCH-${year}-${String(nextNumber).padStart(4, "0")}`;

    const payload = {
  schedule_id: scheduleId,

  employee_id: form.employeeId ?? "",
  position: form.position ?? "",
  outlet: form.outlet ?? "",
  week: form.week ?? "",

  time_in: form.timeIn || null,
  time_out: form.timeOut || null,
  break_time: form.breakTime ?? "",

  monday: form.monday ?? "",
  tuesday: form.tuesday ?? "",
  wednesday: form.wednesday ?? "",
  thursday: form.thursday ?? "",
  friday: form.friday ?? "",
  saturday: form.saturday ?? "",
  sunday: form.sunday ?? "",

  status: "Draft",
};

    const { error } = await supabase
      .from("schedule")
      .insert(payload);

    if (error) throw error;

    setSnackbar({
      open: true,
      message: "✅ Schedule saved as draft!",
      severity: "success",
    });

    setOpenDialog(false);

    fetchSchedules();
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed: ${e.message}`,
      severity: "error",
    });
  } finally {
    setSaving(false);
  }
};

  // Publish: only callable when status === 'Draft'; after success button hides until next edit
  const handlePublish = async (s: Schedule) => {
  try {
    const { error } = await supabase
      .from("schedule")
      .update({ status: "Published" })
      .eq("schedule_id", s.id);

    if (error) throw error;

    await pushNotification(
      s.employeeId,
      "New Schedule Published",
      `Your schedule for ${s.week} has been published.`,
      "schedule"
    );

    setSchedules(prev =>
      prev.map(x =>
        x.id === s.id ? { ...x, status: "Published" } : x
      )
    );

    setSnackbar({
      open: true,
      message: "✅ Schedule published — employee can now view and confirm.",
      severity: "success",
    });
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed: ${e.message}`,
      severity: "error",
    });
  }
};

  const handleConfirm = async (id: string) => {
  try {
    const confirmedAt = new Date().toISOString();

    const { error } = await supabase
      .from("schedule")
      .update({
        status: "Confirmed",
        confirmed_by: currentUserName,
        confirmed_at: confirmedAt,
      })
      .eq("schedule_id", id);

    if (error) throw error;

    setSchedules(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, status: "Confirmed", confirmedBy: currentUserName, confirmedAt }
          : s
      )
    );

    setSnackbar({
      open: true,
      message: "✅ Schedule confirmed! Your schedule has been acknowledged.",
      severity: "success",
    });
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed: ${e.message}`,
      severity: "error",
    });
  }
};

  const handleDecline = async (id: string) => {
  try {
    const declinedAt = new Date().toISOString();

    const { error } = await supabase
      .from("schedule")
      .update({
        status: "Declined",
        declined_by: currentUserName,
        declined_at: declinedAt,
      })
      .eq("schedule_id", id);

    if (error) throw error;

    setSchedules(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, status: "Declined", declinedBy: currentUserName, declinedAt }
          : s
      )
    );

    setSnackbar({
      open: true,
      message: "❌ Schedule declined.",
      severity: "success",
    });
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed: ${e.message}`,
      severity: "error",
    });
  }
};

  const handleDelete = async (id: string) => {
  if (!window.confirm(`Delete schedule ${id}? This cannot be undone.`)) return;

  try {
    const { error } = await supabase
      .from("schedule")
      .delete()
      .eq("schedule_id", id);

    if (error) throw error;

    setSchedules(prev => prev.filter(s => s.id !== id));

    setSnackbar({
      open: true,
      message: `🗑️ Schedule ${id} deleted.`,
      severity: "success",
    });
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed: ${e.message}`,
      severity: "error",
    });
  }
};

  const openEditDialog = (s: Schedule) => {
    setEditRecord(s);
    setEditForm({
      employee: s.employee, position: s.position, outlet: s.outlet, week: s.week,
      timeIn: s.timeIn, timeOut: s.timeOut, breakTime: s.breakTime,
      monday: s.monday, tuesday: s.tuesday, wednesday: s.wednesday,
      thursday: s.thursday, friday: s.friday, saturday: s.saturday, sunday: s.sunday,
    });
    setEditDialog(true);
  };

  // Edit: resets status to 'Draft' → Publish button reappears; notifies employee
  const handleEditSave = async () => {
  if (!editRecord) return;

  setSaving(true);

  try {
    const { error } = await supabase
      .from("schedule")
      .update({
        position: editForm.position ?? "",
        outlet: editForm.outlet ?? "",
        week: editForm.week ?? "",
        time_in: editForm.timeIn || null,
        time_out: editForm.timeOut || null,
        break_time: editForm.breakTime ?? "",
        monday: editForm.monday ?? "",
        tuesday: editForm.tuesday ?? "",
        wednesday: editForm.wednesday ?? "",
        thursday: editForm.thursday ?? "",
        friday: editForm.friday ?? "",
        saturday: editForm.saturday ?? "",
        sunday: editForm.sunday ?? "",
        status: "Draft",
      })
      .eq("schedule_id", editRecord.id);

    if (error) throw error;

    await pushNotification(
    editRecord.employeeId,
    "Schedule Updated",
    `Your schedule for ${editForm.week} has been updated.`,
    "schedule"
  );

    setEditDialog(false);
    await fetchSchedules();

    setSnackbar({
      open: true,
      message: `Schedule ${editRecord.id} updated`,
      severity: "success",
    });
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed: ${e.message}`,
      severity: "error",
    });
  } finally {
    setSaving(false);
  }
};

  const filtered = schedules.filter(s => {
  if (canConfirm) {
    if (s.employeeId !== currentEmployeeId) return false;

    if (!["Published", "Confirmed", "Declined"].includes(s.status)) {
      return false;
    }
  }

  return filterOutlet === "all" || s.outlet === filterOutlet;
});

  const nextScheduleIds = async (count: number) => {
    const year = new Date().getFullYear();
    const { data, error } = await supabase
      .from("schedule")
      .select("schedule_id")
      .like("schedule_id", `SCH-${year}-%`);

    if (error) throw error;

    const numbers = (data ?? [])
      .map((row: any) => String(row.schedule_id ?? "").match(/SCH-\d{4}-(\d+)$/)?.[1])
      .map((value: string | undefined) => Number(value || 0))
      .filter((value: number) => value > 0);

    const startNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return Array.from({ length: count }, (_, index) => `SCH-${year}-${String(startNumber + index).padStart(4, "0")}`);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportingExcel(true);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const getCell = (row: any, ...keys: string[]) => {
        for (const key of keys) {
          const exact = row[key];
          const lower = row[key.toLowerCase()];
          const upper = row[key.toUpperCase()];
          const value = exact ?? lower ?? upper;
          if (value !== undefined && String(value).trim() !== '') return String(value).trim();
        }
        return '';
      };

      const validRows = rows.filter(row => getCell(row, 'Employee ID', 'employee_id', 'EmployeeId', 'Employee', 'Name'));
      if (validRows.length === 0) {
        throw new Error('No valid rows found. Include an Employee ID or Employee/Name column.');
      }

      const ids = await nextScheduleIds(validRows.length);
      const payloads = validRows.map((row, index) => {
        const employeeKey = getCell(row, 'Employee ID', 'employee_id', 'EmployeeId', 'ID');
        const employeeName = getCell(row, 'Employee', 'Name', 'Employee Name');
        const matchedEmployee = employeeList.find(emp =>
          emp.employeeId === employeeKey ||
          emp.name.toLowerCase() === employeeName.toLowerCase()
        );

        const employeeId = matchedEmployee?.employeeId || employeeKey;

        return {
          schedule_id: ids[index],
          employee_id: employeeId,
          position: getCell(row, 'Position', 'position') || matchedEmployee?.position || '',
          outlet: getCell(row, 'Outlet', 'outlet', 'Branch', 'branch') || matchedEmployee?.outlet || '',
          week: getCell(row, 'Week', 'week', 'Week Period', 'WeekPeriod') || getWeekRange(0),
          time_in: getCell(row, 'Time In', 'time_in', 'TimeIn') || null,
          time_out: getCell(row, 'Time Out', 'time_out', 'TimeOut') || null,
          break_time: getCell(row, 'Break Time', 'break_time', 'BreakTime', 'Break') || '1 hour',
          monday: getCell(row, 'Monday', 'Mon'),
          tuesday: getCell(row, 'Tuesday', 'Tue'),
          wednesday: getCell(row, 'Wednesday', 'Wed'),
          thursday: getCell(row, 'Thursday', 'Thu'),
          friday: getCell(row, 'Friday', 'Fri'),
          saturday: getCell(row, 'Saturday', 'Sat'),
          sunday: getCell(row, 'Sunday', 'Sun'),
          status: 'Draft',
          is_finalized: false,
        };
      });

      const missingEmployees = payloads.filter(row => !row.employee_id).length;
      if (missingEmployees > 0) {
        throw new Error(`${missingEmployees} row(s) have no employee_id. Please use Employee ID or exact employee name.`);
      }

      const { error: insertError } = await supabase.from('schedule').insert(payloads);
      if (insertError) throw insertError;

      await fetchSchedules();
      setSnackbar({
        open: true,
        message: `✅ Excel import complete — ${payloads.length} schedule(s) saved as Draft.`,
        severity: 'success',
      });
    } catch (err: any) {
      setSnackbar({ open: true, message: `Excel import failed: ${err.message}`, severity: 'error' });
    } finally {
      setImportingExcel(false);
    }
  };

  return (
    <Box>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            Employee Schedule Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Refresh"><span><IconButton onClick={fetchSchedules} disabled={loading}><Sync /></IconButton></span></Tooltip>
          {canPublish && (
            <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => { setForm(EMPTY); setOpenDialog(true);}} sx={{ flexShrink: 0 }}>
              Create Schedule
            </Button>
          )}
          {canPublish && (
            <Button variant="contained" startIcon={<CloudUpload />} onClick={() => excelRef.current?.click()} sx={{ flexShrink: 0 }}>
              Import Excel
            </Button>
          )}
          <input ref={excelRef} type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleExcelImport} />
        </Box>
      </Box>

      {error &&
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchSchedules}>Retry</Button>}>{error}</Alert>
      }

      {/* ── Outlet Filter ─────────────────────────────────────────────────── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select label="Filter by Outlet" value={filterOutlet}
              onChange={e => setFilterOutlet(e.target.value)}
              InputLabelProps={{ shrink: true }}>
              <MenuItem key="all" value="all">All Outlets</MenuItem>
              {OUTLETS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Button fullWidth variant="outlined" sx={{ height: '56px' }} onClick={() => setFilterOutlet('all')}>
              Clear Filter
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Schedule Table ─────────────────────────────────────────────────── */}
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={28} /><Typography color="text.secondary">Loading…</Typography>
          </Box>
        ) : (
          <Table sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Outlet</TableCell>
                <TableCell>Week</TableCell>
                <TableCell>Break Time</TableCell>
                {DAY_LABELS.map(d => <TableCell key={d}>{d}</TableCell>)}
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    {schedules.length === 0 ? 'No schedules yet. Click "Create Schedule" to add one.' : 'No schedules match your filter.'}
                  </TableCell>
                </TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell><Chip label={s.id} size="small" variant="outlined" /></TableCell>
                  <TableCell>{s.employee}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{s.position}</TableCell>
                  <TableCell>
                    <Chip label={s.outlet || '—'} size="small" color={
                      s.outlet === 'Maria Clara Restaurant' ? 'success' :
                      s.outlet === 'Maria Clara Resort' ? 'primary' : 'warning'
                    } variant="outlined" sx={{ fontSize: '0.72rem' }} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.week}</TableCell>
                  <TableCell>{s.breakTime || "—"}</TableCell>
                  {DAYS.map(d => (
                    <TableCell key={d} sx={{ fontSize: '0.78rem', color: s[d as keyof Schedule] === 'Off' ? 'text.disabled' : 'inherit' }}>
                      {(s[d as keyof Schedule] as string) || '—'}
                    </TableCell>
                  ))}

                  {/* Status chip */}
                  <TableCell>
                    <Chip label={s.status} size="small"
                      color={
                        s.status === 'Confirmed' ? 'success' :
                        s.status === 'Published' ? 'primary' :
                        s.status === 'Declined'  ? 'error'   : 'default'
                      }
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>

                    {/* HR / Supervisor: Publish (Draft only), Edit, Delete */}
                    {canPublish && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                        {s.status === 'Draft' && (
                          <Chip
                            label="Publish"
                            size="small"
                            clickable
                            variant="outlined"
                            color="success"
                            onClick={() => handlePublish(s)}
                            sx={{ minWidth: 110 }}
                          />
                        )}
                        <Chip
                          label="Edit Schedule"
                          size="small"
                          clickable
                          variant="outlined"
                          color="primary"
                          onClick={() => openEditDialog(s)}
                          sx={{ minWidth: 110 }}
                        />
                        <Chip
                          label="Delete"
                          size="small"
                          clickable
                          variant="outlined"
                          color="error"
                          onClick={() => handleDelete(s.id)}
                          sx={{ minWidth: 110 }}
                        />
                      </Box>
                    )}

                    {/* Employee: Confirm + Decline (only on Published) */}
                    {canConfirm && s.status === 'Published' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                        <Chip
                          label="Confirm"
                          size="small"
                          clickable
                          variant="filled"
                          color="success"
                          onClick={() => handleConfirm(s.id)}
                          sx={{ minWidth: 110 }}
                        />
                        <Chip
                          label="Decline"
                          size="small"
                          clickable
                          variant="outlined"
                          color="error"
                          onClick={() => handleDecline(s.id)}
                          sx={{ minWidth: 110 }}
                        />
                      </Box>
                    )}

                    {/* Employee: already actioned */}
                    {canConfirm && s.status !== 'Published' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {s.status === 'Confirmed' && <CheckCircleOutline fontSize="small" color="success" />}
                        {s.status === 'Declined'  && <CancelOutlined fontSize="small" color="error" />}
                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                          {s.status === 'Confirmed' ? 'Confirmed' : s.status === 'Declined' ? 'Declined' : '—'}
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* ── Create Schedule Dialog ─────────────────────────────────────────── */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>Create Weekly Schedule</DialogTitle>
        <DialogContent>
          {importingExcel && <Alert severity="info" sx={{ mb: 2 }}>⏳ Importing from Excel…</Alert>}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Employee — position AND outlet auto-fill on select */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Select Employee" value={form.employeeId || ""} required onChange={(e) => {
              const selected = employeeList.find(emp => emp.employeeId === e.target.value);

              setForm(prev => ({
                ...prev,
                employeeId: selected?.employeeId ?? "",
                employee: selected?.name ?? "",
                position: selected?.position ?? "",
                outlet: selected?.outlet ?? "",
              }));
                }}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem key="emp-empty" value="">
                  Select employee…
                </MenuItem>

                {employeeList.map(emp => (
                  <MenuItem key={emp.employeeId} value={emp.employeeId}>
                    {emp.name}
                  </MenuItem>
                ))}
</TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Position" value={form.position}
                onChange={e => setForm({ ...form, position: e.target.value })}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="pos-empty" value="">Select position…</MenuItem>
                {AVAILABLE_POSITIONS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Outlet / Branch" value={form.outlet}
                onChange={e => setForm(prev => ({ ...prev, outlet: e.target.value }))}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="outlet-empty" value="">Select outlet</MenuItem>
                {OUTLETS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Week Period" required value={form.week}
                onChange={e => setForm({ ...form, week: e.target.value })}
                placeholder="e.g. May 12–18, 2026" />
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                <Chip icon={<CalendarMonth sx={{ fontSize: '0.85rem !important' }} />}
                  label="This Week" size="small" variant="outlined" color="primary" clickable
                  onClick={() => setForm({ ...form, week: getWeekRange(0) })} />
                <Chip icon={<CalendarMonth sx={{ fontSize: '0.85rem !important' }} />}
                  label="Next Week" size="small" variant="outlined" clickable
                  onClick={() => setForm({ ...form, week: getWeekRange(1) })} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete freeSolo options={BREAK_TIME_OPTIONS} value={form.breakTime}
                onChange={(_, v) => setForm({ ...form, breakTime: v ?? '' })}
                onInputChange={(_, v) => setForm({ ...form, breakTime: v })}
                renderInput={(params) => (
                  <TextField {...params} fullWidth label="Break Time" placeholder="e.g. 1 hour" InputLabelProps={{ shrink: true }} />
                )} />
            </Grid>
          </Grid>

          <Divider sx={{ mt: 3, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Daily Schedule Assignment</Typography>
          </Divider>
          <Grid container spacing={1.5}>
            {DAYS.map(day => (
              <Grid key={day} size={{ xs: 12, sm: 6, md: 3 }}>
                <Autocomplete freeSolo options={SHIFT_PRESETS}
                  value={form[day as keyof typeof form] || ''}
                  onChange={(_, v) => setForm({ ...form, [day]: v ?? '' })}
                  onInputChange={(_, v) => setForm({ ...form, [day]: v })}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth
                      label={day.charAt(0).toUpperCase() + day.slice(1)}
                      placeholder="e.g. 8:00 AM – 5:00 PM"
                      InputLabelProps={{ shrink: true }} />
                  )} />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveDraft} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Saving…' : 'Save as Draft'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Schedule Dialog ───────────────────────────────────────────── */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>Edit Schedule — {editRecord?.id}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" icon={<EditIcon fontSize="inherit" />} sx={{ mb: 2 }}>
            Saving will reset this schedule's status to <strong>Draft</strong> and notify the employee to re-confirm.
          </Alert>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Employee Name" required value={editForm.employee}
                onChange={e => setEditForm({ ...editForm, employee: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Position" value={editForm.position}
                onChange={e => setEditForm({ ...editForm, position: e.target.value })}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="edit-pos-empty" value="">Select position…</MenuItem>
                {AVAILABLE_POSITIONS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Outlet / Branch" value={editForm.outlet}
                onChange={e => setEditForm(prev => ({ ...prev, outlet: e.target.value }))}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="edit-outlet-empty" value="">Select outlet…</MenuItem>
                {OUTLETS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Week Period" required value={editForm.week}
                onChange={e => setEditForm({ ...editForm, week: e.target.value })}
                placeholder="e.g. May 12–18, 2026" />
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                <Chip icon={<CalendarMonth sx={{ fontSize: '0.85rem !important' }} />}
                  label="This Week" size="small" variant="outlined" color="primary" clickable
                  onClick={() => setEditForm({ ...editForm, week: getWeekRange(0) })} />
                <Chip icon={<CalendarMonth sx={{ fontSize: '0.85rem !important' }} />}
                  label="Next Week" size="small" variant="outlined" clickable
                  onClick={() => setEditForm({ ...editForm, week: getWeekRange(1) })} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete freeSolo options={BREAK_TIME_OPTIONS} value={editForm.breakTime}
                onChange={(_, v) => setEditForm({ ...editForm, breakTime: v ?? '' })}
                onInputChange={(_, v) => setEditForm({ ...editForm, breakTime: v })}
                renderInput={(params) => (
                  <TextField {...params} fullWidth label="Break Time" placeholder="e.g. 1 hour" InputLabelProps={{ shrink: true }} />
                )} />
            </Grid>
          </Grid>

          <Divider sx={{ mt: 3, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Daily Schedule Assignment</Typography>
          </Divider>
          <Grid container spacing={1.5}>
            {DAYS.map(day => (
              <Grid key={day} size={{ xs: 12, sm: 6, md: 3 }}>
                <Autocomplete freeSolo options={SHIFT_PRESETS}
                  value={editForm[day as keyof typeof editForm] || ''}
                  onChange={(_, v) => setEditForm({ ...editForm, [day]: v ?? '' })}
                  onInputChange={(_, v) => setEditForm({ ...editForm, [day]: v })}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth
                      label={day.charAt(0).toUpperCase() + day.slice(1)}
                      placeholder="e.g. 8:00 AM – 5:00 PM"
                      InputLabelProps={{ shrink: true }} />
                  )} />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open} autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}