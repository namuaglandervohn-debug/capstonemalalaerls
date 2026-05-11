import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  CircularProgress,
  Alert,
  Snackbar,
  Tooltip,
  Grid,
  Autocomplete,
  Divider,
} from "@mui/material";
import {
  AddCircleOutline,
  Visibility,
  ManageSearch,
  DeleteOutline,
  Sync,
} from "@mui/icons-material";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import {
  OUTLETS,
  POSITIONS,
  DEPARTMENTS,
} from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

const API = `https://${projectId}.supabase.co/functions/v1/make-server-24f1182d`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  outlet: string;
  status: "Active" | "On Leave" | "Resigned";
  contact: string;
  email?: string;
  dateHired?: string;
  createdAt?: string;
  dailySchedule?: string;
  breakTime?: string;
  timeIn?: string;
  timeOut?: string;
}

const EMPTY_FORM = {
  name: "",
  position: "",
  department: "",
  outlet: "",
  status: "Active" as const,
  contact: "",
  email: "",
  dateHired: "",
  dailySchedule: "",
  breakTime: "",
  timeIn: "",
  timeOut: "",
};

// Preset schedule options
const SCHEDULE_PRESETS = [
  { label: "6:00 AM – 3:00 PM",  timeIn: "6:00 AM",  timeOut: "3:00 PM"  },
  { label: "7:00 AM – 4:00 PM",  timeIn: "7:00 AM",  timeOut: "4:00 PM"  },
  { label: "8:00 AM – 5:00 PM",  timeIn: "8:00 AM",  timeOut: "5:00 PM"  },
  { label: "9:00 AM – 6:00 PM",  timeIn: "9:00 AM",  timeOut: "6:00 PM"  },
  { label: "10:00 AM – 7:00 PM", timeIn: "10:00 AM", timeOut: "7:00 PM"  },
  { label: "3:00 PM – 11:00 PM", timeIn: "3:00 PM",  timeOut: "11:00 PM" },
  { label: "11:00 PM – 7:00 AM", timeIn: "11:00 PM", timeOut: "7:00 AM"  },
  { label: "Off",                 timeIn: "",          timeOut: ""          },
];

const BREAK_TIME_OPTIONS = ["30 minutes", "1 hour", "1 hour 30 minutes", "2 hours"];

const TIME_OPTIONS = [
  "5:00 AM","6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM",
  "12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM",
  "7:00 PM","8:00 PM","9:00 PM","10:00 PM","11:00 PM",
];

export default function EmployeeRecords() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<typeof EMPTY_FORM>
  >({});

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/employees`, {
        headers: HEADERS,
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Unknown server error");
      // Strip out any null/invalid entries (e.g. ghost keys left after deletes)
      const safe = (data.employees ?? []).filter(
        (e: any) => e != null && typeof e.name === "string",
      );
      setEmployees(safe);
    } catch (err: any) {
      console.error("Fetch employees error:", err);
      setError(`Could not load employees: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const validate = () => {
    const errs: Partial<typeof EMPTY_FORM> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.position.trim())
      errs.position = "Position is required";
    if (!form.outlet.trim())
      errs.outlet = "Outlet / Branch is required";
    if (!form.contact.trim())
      errs.contact = "Contact number is required";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddEmployee = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/employees`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Unknown server error");
      setEmployees((prev) => [...prev, data.employee]);

      // ── Auto-create user account ──────────────────────────────────────────
      // Generate email/username from name (lowercase, no spaces)
      const autoEmail =
        form.email?.trim() ||
        `${form.name.toLowerCase().replace(/\s+/g, ".")}@buenaventura.com`;
      const autoPassword = "password";
      try {
        await fetch(`${API}/users`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify({
            name: form.name,
            email: autoEmail,
            role: "employee",
            employeeId: data.employee.id,
            outlet: form.outlet,
            password: autoPassword,
          }),
        });
      } catch (_) {
        // Non-blocking: log but don't fail the employee creation
        console.warn(
          "Auto account creation skipped (may already exist)",
        );
      }
      // ─────────────────────────────────────────────────────────────────────

      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setFormErrors({});
      setSnackbar({
        open: true,
        message: `✅ Employee ${data.employee.id} added & user account auto-created (login: ${autoEmail} / password: ${autoPassword})`,
        severity: "success",
      });
    } catch (err: any) {
      console.error("Add employee error:", err);
      setSnackbar({
        open: true,
        message: `Failed to add employee: ${err.message}`,
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (!window.confirm(`Remove ${emp.name} (${emp.id})?`))
      return;
    try {
      const res = await fetch(`${API}/employees/${emp.id}`, {
        method: "DELETE",
        headers: HEADERS,
      });
      if (!res.ok) throw new Error("Delete failed");
      setEmployees((prev) =>
        prev.filter((e) => e.id !== emp.id),
      );
      setSnackbar({
        open: true,
        message: `${emp.name} removed.`,
        severity: "success",
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: `Failed to delete: ${err.message}`,
        severity: "error",
      });
    }
  };

  const filtered = employees.filter(
    (emp) =>
      (emp.name ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (emp.id ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (emp.position ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  // Only HR can add employees; HR, Supervisor, and GM can delete
  const canModify = user?.role === "hr";
  const canDelete = user?.role === "hr" || user?.role === "supervisor" || user?.role === "gm";

  return (
    <Box>
      {/* Header */}
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
            Employee Records
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {canModify
              ? "Manage employee information"
              : "View employee directory (read-only access)"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={fetchEmployees}
                disabled={loading}
              >
                <Sync />
              </IconButton>
            </span>
          </Tooltip>
          {canModify && (
            <Button
              variant="contained"
              startIcon={<AddCircleOutline />}
              onClick={() => setDialogOpen(true)}
              sx={{ flexShrink: 0 }}
            >
              Add Employee
            </Button>
          )}
        </Box>
      </Box>

      {/* Error banner */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button size="small" onClick={fetchEmployees}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Search */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by name, ID, or position..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <ManageSearch />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Table */}
      <TableContainer
        component={Paper}
        sx={{ overflowX: "auto" }}
      >
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 6,
              gap: 2,
            }}
          >
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading…</Typography>
          </Box>
        ) : (
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Employee ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Outlet / Branch</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 5, color: "text.secondary" }}
                  >
                    {employees.length === 0
                      ? "No employees yet."
                      : "No results match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow key={emp.id} hover>
                    <TableCell>
                      <Chip
                        label={emp.id}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell>{emp.outlet}</TableCell>
                    <TableCell>
                      <Chip
                        label={emp.status}
                        color={
                          emp.status === "Active"
                            ? "success"
                            : emp.status === "On Leave"
                              ? "warning"
                              : "default"
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{emp.contact}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Chip
                          label="Edit Profile"
                          size="small"
                          clickable
                          variant="outlined"
                          color="primary"
                          onClick={() => navigate(`/dashboard/employees/${emp.id}`)}
                        />
                        {canDelete && (
                          <Chip
                            label="Delete"
                            size="small"
                            clickable
                            variant="outlined"
                            color="error"
                            onClick={() => handleDelete(emp)}
                          />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Add Employee Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setForm(EMPTY_FORM);
          setFormErrors({});
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle fontWeight={700}>Add New Employee</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "12px !important",
          }}
        >
          {/* ── Basic Information ───────────────────────────── */}
          <TextField
            label="Full Name"
            fullWidth
            required
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            error={!!formErrors.name}
            helperText={formErrors.name}
          />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                required
                label="Position / Job Title"
                value={form.position}
                onChange={(e) =>
                  setForm({ ...form, position: e.target.value })
                }
                error={!!formErrors.position}
                helperText={formErrors.position}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem key="pos-empty" value="">
                  Select Position…
                </MenuItem>
                {POSITIONS.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Department"
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem key="dept-empty" value="">
                  Select Department…
                </MenuItem>
                {DEPARTMENTS.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                required
                label="Outlet / Branch"
                value={form.outlet}
                onChange={(e) =>
                  setForm({ ...form, outlet: e.target.value })
                }
                error={!!formErrors.outlet}
                helperText={formErrors.outlet}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem key="outlet-empty" value="">
                  Select Outlet / Branch…
                </MenuItem>
                {OUTLETS.map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Employment Status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as any })
                }
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem key="Active" value="Active">Active</MenuItem>
                <MenuItem key="On Leave" value="On Leave">On Leave</MenuItem>
                <MenuItem key="Resigned" value="Resigned">Resigned</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Contact Number"
                fullWidth
                required
                value={form.contact}
                onChange={(e) =>
                  setForm({ ...form, contact: e.target.value })
                }
                error={!!formErrors.contact}
                helperText={formErrors.contact}
                placeholder="09XXXXXXXXX"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Email Address"
                fullWidth
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
              />
            </Grid>
          </Grid>
          <TextField
            label="Date Hired"
            fullWidth
            type="date"
            value={form.dateHired}
            onChange={(e) =>
              setForm({ ...form, dateHired: e.target.value })
            }
            InputLabelProps={{ shrink: true }}
          />

          {/* ── Schedule Assignment ─────────────────────────── */}
          <Divider sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Schedule Assignment (Optional)
            </Typography>
          </Divider>

          {/* Daily Schedule — auto-fills Time-in / Time-out on preset select */}
          <Autocomplete
            freeSolo
            options={SCHEDULE_PRESETS.map((s) => s.label)}
            value={form.dailySchedule}
            onChange={(_, newVal) => {
              const preset = SCHEDULE_PRESETS.find((s) => s.label === newVal);
              setForm({
                ...form,
                dailySchedule: newVal ?? "",
                timeIn:  preset ? preset.timeIn  : form.timeIn,
                timeOut: preset ? preset.timeOut : form.timeOut,
              });
            }}
            onInputChange={(_, newVal) =>
              setForm({ ...form, dailySchedule: newVal })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Daily Schedule Assignment"
                placeholder='e.g. 8:00 AM – 5:00 PM or type "Off"'
                InputLabelProps={{ shrink: true }}
              />
            )}
          />

          <Grid container spacing={2}>
            {/* Break Time */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                freeSolo
                options={BREAK_TIME_OPTIONS}
                value={form.breakTime}
                onChange={(_, newVal) =>
                  setForm({ ...form, breakTime: newVal ?? "" })
                }
                onInputChange={(_, newVal) =>
                  setForm({ ...form, breakTime: newVal })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Break Time"
                    placeholder="e.g. 1 hour"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>
            {/* Scheduled Time-In */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                freeSolo
                options={TIME_OPTIONS}
                value={form.timeIn}
                onChange={(_, newVal) =>
                  setForm({ ...form, timeIn: newVal ?? "" })
                }
                onInputChange={(_, newVal) =>
                  setForm({ ...form, timeIn: newVal })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Scheduled Time-In"
                    placeholder="e.g. 8:00 AM"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>
            {/* Scheduled Time-Out */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                freeSolo
                options={TIME_OPTIONS}
                value={form.timeOut}
                onChange={(_, newVal) =>
                  setForm({ ...form, timeOut: newVal ?? "" })
                }
                onInputChange={(_, newVal) =>
                  setForm({ ...form, timeOut: newVal })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Scheduled Time-Out"
                    placeholder="e.g. 5:00 PM"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDialogOpen(false);
              setForm(EMPTY_FORM);
              setFormErrors({});
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddEmployee}
            disabled={saving}
            startIcon={
              saving ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {saving ? "Saving…" : "Add Employee"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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