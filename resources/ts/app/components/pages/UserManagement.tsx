import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Grid,
  CircularProgress, Alert, Snackbar, Tooltip, IconButton, InputAdornment,
  Divider,
} from '@mui/material';
import {
  AddCircleOutline, Sync, EditNote, Visibility, VisibilityOff, Password, DeleteOutline,
  AdminPanelSettings, Badge,
} from '@mui/icons-material';
import { supabase } from "../../lib/supabaseClient";
import { OUTLETS } from '../../lib/constants';

type UserRole = 'hr' | 'employee' | 'supervisor' | 'gm' | 'accounting';

interface UserAccount {
  id: string; // this will be USR-2026-0001
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string; // EMP-2026-0001
  applicantId?: string; // APP-2026-0001
  outlet?: string;
  password?: string;
  active?: boolean;
  createdAt?: string;
}

const EMPTY_FORM = {
  name: '',
  email: '',
  role: 'employee' as UserRole,
  employeeId: '',
  outlet: '',
  password: '',
};

/** Role dropdown options — values must match UserRole */
const ROLES: { value: UserRole; label: string }[] = [
  { value: 'hr',         label: 'HR Personnel / Admin' },
  { value: 'employee',   label: 'Employee' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'gm',         label: 'General Manager' },
  { value: 'accounting', label: 'Accounting & Finance' },
];

const ROLE_COLORS: Record<string, any> = {
  hr: 'error', employee: 'default', supervisor: 'primary',
  gm: 'warning', accounting: 'success',
};

const makeLoginText = (firstName?: string, lastName?: string) => {
  return `${firstName ?? ""}${lastName ?? ""}`
    .replace(/\s+/g, "")
    .toLowerCase();
};

const getNextEmployeeId = (ids: string[]) => {
  const numbers = ids
    .map((id) => {
      const match = id.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));

  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

  return `EMP${String(next).padStart(3, "0")}`;
};

export default function UserManagement() {
  const [users, setUsers]           = useState<UserAccount[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [openAdd, setOpenAdd]       = useState(false);
  const [openEdit, setOpenEdit]     = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [editForm, setEditForm]     = useState<Partial<UserAccount>>({});
  const [newPwd, setNewPwd]         = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [snackbar, setSnackbar]     = useState({
    open: false, message: '', severity: 'success' as 'success' | 'error',
  });
  // Tracks whether we're computing the next EMP ID before opening the dialog
  const [empIdLoading, setEmpIdLoading] = useState(false);

  /* ── Data fetching ───────────────────────────────────────────────────��� */
  const fetchUsers = async () => {
  setLoading(true);
  setError(null);

  try {
    const { data, error } = await supabase
      .from("user_accounts")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const mappedUsers: UserAccount[] = (data ?? []).map((u: any) => ({
  id: u.user_id ?? "",
  name: u.full_name ?? "",
  email: u.email ?? "",
  password: u.password ?? "",
  role: u.role ?? "employee",
  employeeId: u.employee_id ?? "",
  applicantId: u.applicant_id ?? "",
  outlet: u.outlet ?? "",
  active: u.is_active ?? true,
  createdAt: u.created_at ?? "",
}));

    setUsers(mappedUsers);
  } catch (e: any) {
    setError(`Could not load user accounts: ${e.message}`);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => { fetchUsers(); }, []);

  /** Fetch all existing employee IDs (from /employees + already-loaded users),
   *  compute the next sequential EMP ID, then open the Create dialog. */
  const openCreateDialog = async () => {
  setEmpIdLoading(true);

  try {
    const { data: employeesData, error: employeesError } = await supabase
      .from("employees")
      .select("employee_id");

    if (employeesError) throw employeesError;

    const existingEmployeeIds = (employeesData ?? [])
      .map((e: any) => e.employee_id)
      .filter(Boolean);

    const nextEmployeeId = getNextEmployeeId(existingEmployeeIds);

    setForm({
      ...EMPTY_FORM,
      employeeId: nextEmployeeId,
    });

    setOpenAdd(true);
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed to generate employee ID: ${e.message}`,
      severity: "error",
    });
  } finally {
    setEmpIdLoading(false);
  }
};

  /* ── Handlers ───────────────────────────────────────────────────────── */
  const handleCreate = async () => {
  if (!form.name || !form.email || !form.password) {
    setSnackbar({
      open: true,
      message: "Name, email/username, and password are required.",
      severity: "error",
    });
    return;
  }

  setSaving(true);

  try {
    const { count: userCount } = await supabase
      .from("user_accounts")
      .select("*", { count: "exact", head: true });

    const userId = `USR-2026-${String((userCount ?? 0) + 1).padStart(4, "0")}`;

    const { data: userData, error: userError } = await supabase
      .from("user_accounts")
      .insert({
        user_id: userId,
        employee_id: form.employeeId,
        full_name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        outlet: form.outlet,
        is_active: true,
      })
      .select()
      .single();

    if (userError) throw userError;

    if (form.role === "employee") {
      const nameParts = form.name.trim().split(" ");
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ") || firstName;

      const { error: employeeError } = await supabase
        .from("employees")
        .insert({
          employee_id: form.employeeId,
          first_name: firstName,
          last_name: lastName,
          email: form.email,
          outlet: form.outlet,
          status: "Active",
          hire_date: new Date().toISOString().split("T")[0],
        });

      if (employeeError) throw employeeError;
    }

    const newUser: UserAccount = {
      id: userData.user_id,
      name: userData.full_name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
      employeeId: userData.employee_id,
      applicantId: userData.applicant_id,
      outlet: userData.outlet,
      active: userData.is_active,
      createdAt: userData.created_at,
    };

    setUsers((prev) => [...prev, newUser]);

    setOpenAdd(false);
    setForm(EMPTY_FORM);

    setSnackbar({
      open: true,
      message: `✅ Account created with Employee ID ${form.employeeId}`,
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

  // Edit — also handles optional password reset in one call
  const handleEdit = async () => {
  if (!selectedUser) return;

  setSaving(true);

  try {
    const updateData: any = {
      full_name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      outlet: editForm.outlet,
      employee_id: editForm.employeeId,
      is_active: editForm.active ?? true,
    };

    if (newPwd.trim()) {
      updateData.password = newPwd.trim();
    }

    let result = await supabase
      .from("user_accounts")
      .update(updateData)
      .eq("user_id", selectedUser.id)
      .select()
      .maybeSingle();

    if (!result.data) {
      result = await supabase
        .from("user_accounts")
        .update(updateData)
        .eq("email", selectedUser.email)
        .select()
        .maybeSingle();
    }

    if (result.error) throw result.error;
    if (!result.data) throw new Error("No matching user account found.");

    const data = result.data;

    const updatedUser: UserAccount = {
      id: data.user_id ?? "",
      name: data.full_name ?? "",
      email: data.email ?? "",
      password: data.password ?? "",
      role: data.role ?? "employee",
      employeeId: data.employee_id ?? "",
      applicantId: data.applicant_id ?? "",
      outlet: data.outlet ?? "",
      active: data.is_active ?? true,
      createdAt: data.created_at ?? "",
    };

    setUsers(prev =>
      prev.map(u => u.id === selectedUser.id ? updatedUser : u)
    );

    setOpenEdit(false);
    setNewPwd("");
    setShowEditPwd(false);

    setSnackbar({
      open: true,
      message: newPwd.trim()
        ? "✅ Account updated & password reset!"
        : "✅ Account updated!",
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

  /** Toggle active/inactive — works from both the table and the Edit dialog */
  const handleToggleActive = async (user: UserAccount) => {
  const newActive = user.active === false;

  try {
    const { error } = await supabase
      .from("user_accounts")
      .update({
          is_active: newActive,
        })
      .eq("user_id", user.id);

    if (error) throw error;

    setUsers(prev =>
      prev.map(u =>
        u.id === user.id
          ? {
              ...u,
              active: newActive,
              status: newActive ? "Active" : "Inactive",
            }
          : u
      )
    );

    setSelectedUser(prev =>
      prev?.id === user.id
        ? {
            ...prev,
            active: newActive,
            status: newActive ? "Active" : "Inactive",
          }
        : prev
    );

    setSnackbar({
      open: true,
      message: `Account ${newActive ? "activated" : "deactivated"} successfully!`,
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

  const handleDelete = async (u: UserAccount) => {
  if (!window.confirm(`Permanently delete account for ${u.name} (${u.id})? This cannot be undone.`)) return;

  try {
    const { error } = await supabase
      .from("user_accounts")
      .delete()
      .eq("user_id", u.id);

    if (error) throw error;

    setUsers(prev => prev.filter(x => x.id !== u.id));

    setSnackbar({
      open: true,
      message: `🗑️ Account for ${u.name} deleted.`,
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

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            User Account Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create and manage employee login accounts
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={fetchUsers} disabled={loading}><Sync /></IconButton>
            </span>
          </Tooltip>
          <Button variant="contained" startIcon={empIdLoading ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutline />}
            onClick={openCreateDialog} disabled={empIdLoading}>
            {empIdLoading ? 'Preparing…' : 'Create Account'}
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>System Accounts</strong> (always active, not listed here): <code>admin</code> / admin123 (HR),
        and demo accounts (hr / employee / supervisor / gm / accounting @company.com).
        Additional accounts created here are stored in Supabase.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchUsers}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {/* Users Table */}
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading…</Typography>
          </Box>
        ) : (
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>USER ID</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Email / Username</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No user accounts yet. Click "Create Account" to add one.
                  </TableCell>
                </TableRow>
              ) : users.map(u => (
                <TableRow key={u.id} hover>

  {/* USER ID */}
  <TableCell sx={{ opacity: u.active === false ? 0.45 : 1, fontWeight: 500 }}>
    <Chip
      label={u.id || '—'}
      size="small"
      variant="outlined"
    />
  </TableCell>

 {/* FULL NAME */}
  <TableCell sx={{ opacity: u.active === false ? 0.45 : 1}}>
    {u.name}
  </TableCell>

  {/* EMAIL */}
  <TableCell sx={{ opacity: u.active === false ? 0.45 : 1 }}>
    {u.email}
  </TableCell>

  {/* ROLE */}
  <TableCell sx={{ opacity: u.active === false ? 0.45 : 1 }}>
    <Chip
      label={ROLES.find(r => r.value === u.role)?.label ?? u.role}
      size="small"
      color={ROLE_COLORS[u.role] ?? 'default'}
    />
  </TableCell>

  {/* STATUS */}
  <TableCell sx={{ opacity: u.active === false ? 0.45 : 1 }}>
    <Chip
      label={u.active === false ? 'Inactive' : 'Active'}
      size="small"
      color={u.active === false ? 'default' : 'success'}
    />
  </TableCell>

  {/* ACTIONS */}
  <TableCell>
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        alignItems: 'flex-start'
      }}
    >
      <Chip
        label="Edit Account"
        size="small"
        clickable
        variant="outlined"
        color="primary"
        onClick={() => {
          setSelectedUser(u);

          setEditForm({
            name: u.name,
            email: u.email,
            role: u.role,
            outlet: u.outlet,
            employeeId: u.employeeId,
            applicantId: u.applicantId,
          });

          setNewPwd('');
          setShowEditPwd(false);
          setOpenEdit(true);
        }}
        sx={{ minWidth: 110 }}
      />

      <Chip
        label="Delete Account"
        size="small"
        clickable
        variant="outlined"
        color="error"
        onClick={() => handleDelete(u)}
        sx={{ minWidth: 110 }}
      />
    </Box>
  </TableCell>
</TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* ── Create Account Dialog ─────────────────────────────────────── */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Create New User Account</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={12}>
              <TextField fullWidth required label="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth required label="Email / Username" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} helperText="Used to log in to the system" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth select label="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })} InputLabelProps={{ shrink: true }}>
                {ROLES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth select label="Outlet / Branch" value={form.outlet} onChange={e => setForm({ ...form, outlet: e.target.value })} InputLabelProps={{ shrink: true }}>
                <MenuItem key="outlet-empty" value="">Select Outlet…</MenuItem>
                {OUTLETS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            {/* ── Linked Employee ID — auto-generated, read-only ── */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Linked Employee ID"
                value={form.employeeId}
                disabled
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <Badge fontSize="small" color="primary" />
                    </InputAdornment>
                  ),
                }}
                helperText="Auto-generated — assigned sequentially"
                sx={{
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: 'inherit',
                    color: 'text.primary',
                    fontWeight: 700,
                    fontSize: '1rem',
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth required label="Initial Password"
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPwd(s => !s)}>
                        {showPwd ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Creating…' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Account Dialog (includes Reset Password) ─────────────── */}
      <Dialog open={openEdit} onClose={() => { setOpenEdit(false); setNewPwd(''); setShowEditPwd(false); }} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Edit Account — {selectedUser?.name}</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={12}>
              <TextField fullWidth label="Full Name" value={editForm.name ?? ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Email / Username" value={editForm.email ?? ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth select label="Role" value={editForm.role ?? 'employee'} onChange={e => setEditForm({ ...editForm, role: e.target.value as UserRole })} InputLabelProps={{ shrink: true }}>
                {ROLES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Linked Employee ID" value={editForm.employeeId ?? ''} onChange={e => setEditForm({ ...editForm, employeeId: e.target.value })} />
            </Grid>

            {/* ── Reset Password (optional) ─────────────────────────── */}
            <Grid size={12}>
              <Divider sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Reset Password (Optional)</Typography>
              </Divider>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="New Password"
                placeholder="Leave blank to keep current password"
                type={showEditPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowEditPwd(s => !s)}>
                        {showEditPwd ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* ── Account Status ────────────────────────────────────── */}
            <Grid size={12}>
              <Divider sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Account Status</Typography>
              </Divider>
            </Grid>
            <Grid size={12}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.25,
                borderRadius: 2,
                bgcolor: selectedUser?.active === false
                  ? 'rgba(183,62,45,0.06)'
                  : 'rgba(46,139,87,0.06)',
                border: '1px solid',
                borderColor: selectedUser?.active === false ? 'error.light' : 'success.light',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={selectedUser?.active === false ? 'Inactive' : 'Active'}
                    size="small"
                    color={selectedUser?.active === false ? 'default' : 'success'}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {selectedUser?.active === false
                      ? 'This account is currently disabled.'
                      : 'This account is currently enabled.'}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  color={selectedUser?.active === false ? 'success' : 'warning'}
                  onClick={() => selectedUser && handleToggleActive(selectedUser)}
                  disabled={saving}
                >
                  {selectedUser?.active === false ? 'Activate Account' : 'Deactivate Account'}
                </Button>
              </Box>
            </Grid>

          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setOpenEdit(false); setNewPwd(''); setShowEditPwd(false); }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEdit}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Password />}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
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

/** Derive the next sequential EMP ID from a list of existing IDs.
 *  Scans for any string matching /^EMP(\d+)$/i, finds the max number,
 *  and returns the next one zero-padded to 3 digits (e.g. EMP001 → EMP002).
 *  Falls back to EMP001 when no existing IDs are found. */
function computeNextEmpId(existingIds: string[]): string {
  const nums = existingIds
    .map(id => { const m = (id ?? '').match(/^EMP(\d+)$/i); return m ? parseInt(m[1], 10) : 0; })
    .filter(n => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `EMP${String(next).padStart(3, '0')}`;
}