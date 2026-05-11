import { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  CircularProgress,
  Alert,
  Snackbar,
  Tooltip,
  IconButton,
} from "@mui/material";
import {
  UploadFile,
  AddCircleOutline,
  Sync,
  TaskAlt,
  EditNote,
  DeleteOutline,
} from "@mui/icons-material";
import { API, HEADERS } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

interface Attendance {
  id: string;
  employee: string;
  date: string;
  timeIn: string;
  timeOut: string;
  totalHours: string;
  late: string;
  undertime: string;
  overtime: string;
  status: "Present" | "Late" | "Absent" | "On Leave";
}

const EMPTY = {
  employee: "",
  date: "",
  timeIn: "",
  timeOut: "",
  totalHours: "",
  late: "0",
  undertime: "0",
  overtime: "0",
  status: "Present" as const,
};

// Auto-compute attendance metrics based on time-in and time-out vs expected schedule
function computeAttendance(
  timeIn: string,
  timeOut: string,
  expectedIn = "8:00 AM",
  expectedOut = "5:00 PM",
): Partial<typeof EMPTY> {
  try {
    const parseTime = (t: string) => {
      const d = new Date(`01/01/2000 ${t}`);
      return isNaN(d.getTime()) ? null : d;
    };
    const tin = parseTime(timeIn);
    const tout = parseTime(timeOut);
    const ein = parseTime(expectedIn);
    const eout = parseTime(expectedOut);
    if (!tin || !tout || !ein || !eout) return {};

    const totalMs = tout.getTime() - tin.getTime();
    if (totalMs <= 0) return {}; // invalid clock data

    const totalHours = (totalMs / 3600000).toFixed(2);

    // Late = minutes arrived after expected start (0 if on time or early)
    const lateMs = Math.max(0, tin.getTime() - ein.getTime());
    const lateMin = Math.round(lateMs / 60000);

    // Undertime = minutes left before expected end (0 if stayed till end or later)
    // Uses actual time-out vs scheduled end — independent of late arrival
    const undertimeMs = Math.max(
      0,
      eout.getTime() - tout.getTime(),
    );
    const undertimeMin = Math.round(undertimeMs / 60000);

    // Overtime = time worked beyond the full scheduled duration
    const scheduledMs = eout.getTime() - ein.getTime();
    const overtimeMs = Math.max(0, totalMs - scheduledMs);
    const overtimeMin = Math.round(overtimeMs / 60000);

    // Status: if arrived after expected start → Late; otherwise Present
    const status = lateMin > 0 ? "Late" : "Present";

    return {
      totalHours,
      late: String(lateMin),
      undertime: String(undertimeMin),
      overtime: String(overtimeMin),
      status,
    };
  } catch {
    return {};
  }
}

// Parse biometric CSV row: employee_name, date, time_in, time_out
function parseCSV(text: string): Partial<Attendance>[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: Partial<Attendance>[] = [];
  for (const line of lines) {
    if (
      line.toLowerCase().startsWith("employee") ||
      line.toLowerCase().startsWith("#")
    )
      continue; // skip header
    const parts = line
      .split(",")
      .map((p) => p.trim().replace(/"/g, ""));
    if (parts.length < 4) continue;
    const [employee, date, timeIn, timeOut] = parts;
    const computed = computeAttendance(timeIn, timeOut);
    rows.push({ employee, date, timeIn, timeOut, ...computed });
  }
  return rows;
}

export default function AttendanceMonitoring() {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState<Attendance[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<
    Partial<Attendance>[]
  >([]);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/attendance`, {
        headers: HEADERS,
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Server error");
      setAttendances(
        (data.attendance ?? []).filter((a: any) => a != null),
      );
    } catch (e: any) {
      setError(`Could not load attendance: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  // Auto-compute when time changes
  const handleTimeChange = (
    field: "timeIn" | "timeOut",
    val: string,
  ) => {
    const updated = { ...form, [field]: val };
    const computed = computeAttendance(
      field === "timeIn" ? val : form.timeIn,
      field === "timeOut" ? val : form.timeOut,
    );
    setForm({ ...updated, ...computed });
  };

  const handleSave = async () => {
    if (!form.employee || !form.date) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/attendance`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Server error");
      setAttendances((prev) => [...prev, data.record]);
      setDialogOpen(false);
      setForm(EMPTY);
      setSnackbar({
        open: true,
        message: "Attendance record saved to Supabase!",
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

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
      setImportPreview(parseCSV(text));
    };
    reader.readAsText(file);
  };

  const handleParseTextInput = () => {
    setImportPreview(parseCSV(importText));
  };

  const handleImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    let successCount = 0;
    for (const row of importPreview) {
      try {
        const res = await fetch(`${API}/attendance`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify(row),
        });
        if (res.ok) {
          const data = await res.json();
          setAttendances((prev) => [...prev, data.record]);
          successCount++;
        }
      } catch (_) {}
    }
    setImporting(false);
    setImportDialog(false);
    setImportPreview([]);
    setImportText("");
    setSnackbar({
      open: true,
      message: `✅ Imported ${successCount} attendance record(s) from biometric data!`,
      severity: "success",
    });
  };

  const filtered = attendances.filter((a) => {
    const dateMatch = !filterDate || a.date === filterDate;
    const statusMatch =
      filterStatus === "all" ||
      a.status.toLowerCase().replace(" ", "") === filterStatus;
    return dateMatch && statusMatch;
  });

  const summary = {
    present: filtered.filter(
      (a) => a.status === "Present" || a.status === "Late",
    ).length,
    late: filtered.filter((a) => a.status === "Late").length,
    absent: filtered.filter((a) => a.status === "Absent")
      .length,
    onLeave: filtered.filter((a) => a.status === "On Leave")
      .length,
  };

  const [editDialog, setEditDialog] = useState(false);
  const [editRecord, setEditRecord] =
    useState<Attendance | null>(null);
  const [editForm, setEditForm] = useState({
    timeIn: "",
    timeOut: "",
    totalHours: "",
    late: "0",
    undertime: "0",
    overtime: "0",
    status: "Present" as const,
  });

  const handleEditSave = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API}/attendance/${editRecord.id}`,
        {
          method: "PUT",
          headers: HEADERS,
          body: JSON.stringify({
            ...editForm,
            correctedBy: user?.name ?? "HR Admin",
          }),
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Server error");
      setAttendances((prev) =>
        prev.map((a) =>
          a.id === editRecord.id ? data.record : a,
        ),
      );
      setEditDialog(false);
      setSnackbar({
        open: true,
        message:
          "✅ Attendance record corrected and reprocessed!",
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

  const openEdit = (att: Attendance) => {
    setEditRecord(att);
    setEditForm({
      timeIn: att.timeIn,
      timeOut: att.timeOut,
      totalHours: att.totalHours,
      late: att.late,
      undertime: att.undertime,
      overtime: att.overtime,
      status: att.status,
    });
    setEditDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        `Delete attendance record ${id}? This cannot be undone.`,
      )
    )
      return;
    try {
      const res = await fetch(`${API}/attendance/${id}`, {
        method: "DELETE",
        headers: HEADERS,
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Server error");
      setAttendances((prev) => prev.filter((a) => a.id !== id));
      setSnackbar({
        open: true,
        message: `🗑️ Record ${id} deleted.`,
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

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            gutterBottom
            fontWeight="bold"
            sx={{
              fontSize: {
                xs: "1.35rem",
                sm: "1.75rem",
                md: "2.125rem",
              },
            }}
          >
            Attendance Monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track biometric and manual attendance — validated
            against finalized schedules
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={fetchAttendance}
                disabled={loading}
              >
                <Sync />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<AddCircleOutline />}
            onClick={() => setDialogOpen(true)}
          >
            Manual Entry
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadFile />}
            onClick={() => setImportDialog(true)}
          >
            Import Biometric Data
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error"
        sx={{ mb: 2 }}
        action={
          <Button size="small" onClick={fetchAttendance}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Filter by Date"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              select
              label="Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem key="all" value="all">
                All Status
              </MenuItem>
              <MenuItem key="present" value="present">
                Present
              </MenuItem>
              <MenuItem key="late" value="late">
                Late
              </MenuItem>
              <MenuItem key="absent" value="absent">
                Absent
              </MenuItem>
              <MenuItem key="onleave" value="onleave">
                On Leave
              </MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              sx={{ height: "56px" }}
              onClick={() => {
                setFilterDate("");
                setFilterStatus("all");
              }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer
        component={Paper}
        sx={{ overflowX: "auto" }}
      >
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              py: 6,
              gap: 2,
            }}
          >
            <CircularProgress size={28} />
            <Typography color="text.secondary">
              Loading from Supabase…
            </Typography>
          </Box>
        ) : (
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Time In</TableCell>
                <TableCell>Time Out</TableCell>
                <TableCell>Total Hours</TableCell>
                <TableCell>Late (min)</TableCell>
                <TableCell>Undertime (min)</TableCell>
                <TableCell>Overtime (min)</TableCell>
                <TableCell>Status</TableCell>
                {user?.role === "hr" && (
                  <TableCell>Actions</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    align="center"
                    sx={{ py: 5, color: "text.secondary" }}
                  >
                    {attendances.length === 0
                      ? "No attendance records yet. Use Manual Entry or Import Biometric Data."
                      : "No results match your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((att) => (
                  <TableRow key={att.id} hover>
                    <TableCell>
                      <Chip
                        label={att.id}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{att.employee}</TableCell>
                    <TableCell>{att.date}</TableCell>
                    <TableCell>{att.timeIn}</TableCell>
                    <TableCell>{att.timeOut}</TableCell>
                    <TableCell>{att.totalHours}</TableCell>
                    <TableCell
                      sx={{
                        color:
                          Number(att.late) > 0
                            ? "warning.main"
                            : "inherit",
                      }}
                    >
                      {att.late}
                    </TableCell>
                    <TableCell
                      sx={{
                        color:
                          Number(att.undertime) > 0
                            ? "warning.main"
                            : "inherit",
                      }}
                    >
                      {att.undertime}
                    </TableCell>
                    <TableCell
                      sx={{
                        color:
                          Number(att.overtime) > 0
                            ? "success.main"
                            : "inherit",
                      }}
                    >
                      {att.overtime}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={att.status}
                        size="small"
                        color={
                          att.status === "Present"
                            ? "success"
                            : att.status === "Late"
                              ? "warning"
                              : att.status === "On Leave"
                                ? "info"
                                : "error"
                        }
                      />
                    </TableCell>
                    {user?.role === "hr" && (
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          <Tooltip title="Correct / Reprocess Record">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => openEdit(att)}
                            >
                              <EditNote fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Record">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                handleDelete(att.id)
                              }
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {!loading && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Summary{" "}
            {filterDate ? `for ${filterDate}` : "(All Records)"}
          </Typography>
          <Grid container spacing={2}>
            {[
              [
                "Present (incl. Late)",
                summary.present,
                "success",
              ],
              ["Late", summary.late, "warning"],
              ["Absent", summary.absent, "error"],
              ["On Leave", summary.onLeave, "info"],
            ].map(([label, val]) => (
              <Grid key={String(label)} size={{ xs: 6, md: 3 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  {label}
                </Typography>
                <Typography variant="h6">{val}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Manual Entry Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle fontWeight={700}>
          Manual Attendance Entry
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "12px !important",
          }}
        >
          <TextField
            label="Employee Name"
            fullWidth
            required
            value={form.employee}
            onChange={(e) =>
              setForm({ ...form, employee: e.target.value })
            }
          />
          <TextField
            label="Date"
            type="date"
            fullWidth
            required
            value={form.date}
            onChange={(e) =>
              setForm({ ...form, date: e.target.value })
            }
            InputLabelProps={{ shrink: true }}
          />
          <Grid container spacing={2}>
            <Grid size={6}>
              <TextField
                label="Time In"
                fullWidth
                value={form.timeIn}
                onChange={(e) =>
                  handleTimeChange("timeIn", e.target.value)
                }
                placeholder="e.g. 8:00 AM"
                helperText="Auto-computes metrics"
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Time Out"
                fullWidth
                value={form.timeOut}
                onChange={(e) =>
                  handleTimeChange("timeOut", e.target.value)
                }
                placeholder="e.g. 5:00 PM"
              />
            </Grid>
          </Grid>
          <TextField
            label="Total Hours"
            fullWidth
            value={form.totalHours}
            onChange={(e) =>
              setForm({ ...form, totalHours: e.target.value })
            }
            placeholder="Auto-computed"
          />
          <Grid container spacing={2}>
            <Grid size={4}>
              <TextField
                label="Late (min)"
                fullWidth
                value={form.late}
                onChange={(e) =>
                  setForm({ ...form, late: e.target.value })
                }
              />
            </Grid>
            <Grid size={4}>
              <TextField
                label="Undertime (min)"
                fullWidth
                value={form.undertime}
                onChange={(e) =>
                  setForm({
                    ...form,
                    undertime: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid size={4}>
              <TextField
                label="Overtime (min)"
                fullWidth
                value={form.overtime}
                onChange={(e) =>
                  setForm({ ...form, overtime: e.target.value })
                }
              />
            </Grid>
          </Grid>
          <TextField
            label="Status"
            select
            fullWidth
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as any,
              })
            }
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem key="status-empty" value="">
              Select Status…
            </MenuItem>
            {["Present", "Late", "Absent", "On Leave"].map(
              (s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ),
            )}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={
              saving ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Biometric Import Dialog */}
      <Dialog
        open={importDialog}
        onClose={() => {
          setImportDialog(false);
          setImportPreview([]);
          setImportText("");
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle fontWeight={700}>
          Import Biometric Data
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>CSV Format:</strong> Each row should be:{" "}
            <code>
              Employee Name, Date (YYYY-MM-DD), Time In (e.g.
              8:00 AM), Time Out (e.g. 5:00 PM)
            </code>
            <br />
            Example:{" "}
            <code>
              Maria Santos, 2026-05-09, 8:05 AM, 5:00 PM
            </code>
          </Alert>
          <Box
            sx={{
              mb: 2,
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="outlined"
              startIcon={<UploadFile />}
              component="label"
            >
              Upload CSV File
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".csv,.txt"
                onChange={handleFileUpload}
              />
            </Button>
            <Button
              variant="outlined"
              onClick={handleParseTextInput}
              disabled={!importText.trim()}
            >
              Parse Pasted Data
            </Button>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Paste biometric data here (CSV format)"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Maria Santos, 2026-05-09, 8:05 AM, 5:00 PM&#10;Juan Dela Cruz, 2026-05-09, 7:58 AM, 5:30 PM"
          />

          {importPreview.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography
                variant="subtitle2"
                gutterBottom
                fontWeight={700}
              >
                Preview — {importPreview.length} record(s) to
                import:
              </Typography>
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ maxHeight: 220, overflow: "auto" }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>In</TableCell>
                      <TableCell>Out</TableCell>
                      <TableCell>Hours</TableCell>
                      <TableCell>Late</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.employee}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.timeIn}</TableCell>
                        <TableCell>{row.timeOut}</TableCell>
                        <TableCell>{row.totalHours}</TableCell>
                        <TableCell
                          sx={{
                            color:
                              Number(row.late) > 0
                                ? "warning.main"
                                : "inherit",
                          }}
                        >
                          {row.late} min
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.status}
                            size="small"
                            color={
                              row.status === "Present"
                                ? "success"
                                : "warning"
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setImportDialog(false);
              setImportPreview([]);
              setImportText("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={
              importing ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <TaskAlt />
              )
            }
            onClick={handleImport}
            disabled={importing || importPreview.length === 0}
          >
            {importing
              ? `Importing ${importPreview.length} records…`
              : `Import ${importPreview.length} Record(s)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Attendance Correction Dialog */}
      <Dialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle fontWeight={700}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <EditNote color="warning" /> Correct & Reprocess
            Attendance — {editRecord?.employee} (
            {editRecord?.date})
          </Box>
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "12px !important",
          }}
        >
          <Alert severity="warning">
            Editing this record will mark it as corrected by HR.
            The original data will be overwritten.
          </Alert>
          <Grid container spacing={2}>
            <Grid size={6}>
              <TextField
                label="Time In"
                fullWidth
                value={editForm.timeIn}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    timeIn: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Time Out"
                fullWidth
                value={editForm.timeOut}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    timeOut: e.target.value,
                  })
                }
              />
            </Grid>
          </Grid>
          <TextField
            label="Total Hours"
            fullWidth
            value={editForm.totalHours}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                totalHours: e.target.value,
              })
            }
          />
          <Grid container spacing={2}>
            <Grid size={4}>
              <TextField
                label="Late (min)"
                fullWidth
                value={editForm.late}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    late: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid size={4}>
              <TextField
                label="Undertime (min)"
                fullWidth
                value={editForm.undertime}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    undertime: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid size={4}>
              <TextField
                label="Overtime (min)"
                fullWidth
                value={editForm.overtime}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    overtime: e.target.value,
                  })
                }
              />
            </Grid>
          </Grid>
          <TextField
            select
            fullWidth
            label="Status"
            value={editForm.status}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                status: e.target.value as any,
              })
            }
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem key="edit-status-empty" value="">
              Select Status…
            </MenuItem>
            {["Present", "Late", "Absent", "On Leave"].map(
              (s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ),
            )}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleEditSave}
            disabled={saving}
            startIcon={
              saving ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <TaskAlt />
              )
            }
          >
            {saving ? "Saving…" : "Save Correction"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() =>
          setSnackbar((s) => ({ ...s, open: false }))
        }
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() =>
            setSnackbar((s) => ({ ...s, open: false }))
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}