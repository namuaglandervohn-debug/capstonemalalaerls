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
import { API, HEADERS } from '../../lib/api';
import { OUTLETS } from '../../lib/constants';

type UserRole = 'hr' | 'employee' | 'supervisor' | 'gm' | 'accounting';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
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

  /* ── Data fetching ──────────────────────────────────────────────────── */
  const fetchUsers = async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/users`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setUsers((data.users ?? []).filter((u: any) => u != null));
    } catch (e: any) {
      setError(`Could not load accounts: ${e.message}`);
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
      // Collect every known employeeId from the users list already in state
      const fromUsers = users.map(u => u.employeeId ?? '').filter(Boolean);

      // Also fetch the employee records table for IDs that may not yet have accounts
      let fromEmployees: string[] = [];
      try {
        const res  = await fetch(`${API}/employees`, { headers: HEADERS });
        const data = await res.json();
        if (res.ok) {
          fromEmployees = (data.employees ?? [])
            .filter((e: any) => e?.id)
            .map((e: any) => e.id as string);
        }
      } catch (_) { /* non-critical */ }

      const allIds  = [...new Set([...fromUsers, ...fromEmployees])];
      const nextId  = computeNextEmpId(allIds);
      setForm({ ...EMPTY_FORM, employeeId: nextId });
      setOpenAdd(true);
    } finally {
      setEmpIdLoading(false);
    }
  };

  /* ── Handlers ───────────────────────────────────────────────────────── */
  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      setSnackbar({ open: true, message: 'Name, email/username, and password are required.', severity: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res  = await fetch(`${API}/users`, { method: 'POST', headers: HEADERS, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setUsers(prev => [...prev, data.user]);

      // ── Auto-create Employee Record when role is 'employee' ──────────────
      if (form.role === 'employee') {
        try {
          const empRes = await fetch(`${API}/employees`, {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify({
              name: form.name,
              email: form.email,
              outlet: form.outlet ?? '',
              position: '',
              department: '',
              status: 'Active',
              contact: '',
              dateHired: new Date().toISOString().split('T')[0],
            }),
          });
          if (!empRes.ok) console.warn('Auto employee record creation failed (non-blocking)');
        } catch (_) { console.warn('Auto employee record creation skipped'); }
      }
      // ────────────────────────────────────────────────────────────────────

      setOpenAdd(false);
      setForm(EMPTY_FORM);
      setSnackbar({ open: true, message: `✅ Account created for ${data.user.name}!${form.role === 'employee' ? ' Employee record also created.' : ''}`, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Edit — also handles optional password reset in one call
  const handleEdit = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const payload: any = { ...editForm };
      if (newPwd.trim()) payload.password = newPwd.trim();
      const res  = await fetch(`${API}/users/${selectedUser.id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? data.user : u));
      setOpenEdit(false);
      setNewPwd('');
      setShowEditPwd(false);
      setSnackbar({ open: true, message: newPwd.trim() ? '✅ Account updated & password reset!' : '✅ Account updated!', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  /** Toggle active/inactive — works from both the table and the Edit dialog */
  const handleToggleActive = async (user: UserAccount) => {
    const newActive = user.active === false; // false → true, true/undefined → false
    try {
      const res = await fetch(`${API}/users/${user.id}`, {
        method: 'PUT', headers: HEADERS, body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) throw new Error('Update failed');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: newActive } : u));
      // Keep the dialog in sync if this user is currently open
      setSelectedUser(prev => prev?.id === user.id ? { ...prev, active: newActive } : prev);
      setSnackbar({
        open: true,
        message: `Account ${newActive ? 'activated' : 'deactivated'} successfully!`,
        severity: 'success',
      });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    }
  };

  const handleDelete = async (u: UserAccount) => {
    if (!window.confirm(`Permanently delete account for ${u.name} (${u.id})? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/users/${u.id}`, { method: 'DELETE', headers: HEADERS });
      if (!res.ok) throw new Error('Delete failed');
      setUsers(prev => prev.filter(x => x.id !== u.id));
      setSnackbar({ open: true, message: `🗑️ Account for ${u.name} deleted.`, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
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
                <TableCell>ID</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Email / Username</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Outlet</TableCell>
                <TableCell>Employee ID</TableCell>
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
                <TableRow key={u.id} hover sx={{ opacity: u.active === false ? 0.5 : 1 }}>
                  <TableCell><Chip label={u.id} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={ROLES.find(r => r.value === u.role)?.label ?? u.role}
                      size="small"
                      color={ROLE_COLORS[u.role] ?? 'default'}
                    />
                  </TableCell>
                  <TableCell>{u.outlet || '—'}</TableCell>
                  <TableCell>{u.employeeId || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={u.active === false ? 'Inactive' : 'Active'}
                      size="small"
                      color={u.active === false ? 'default' : 'success'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>

                      {/* Edit Account — same height as the Active/Inactive chip (size="small") */}
                      <Chip
                        label="Edit Account"
                        size="small"
                        clickable
                        variant="outlined"
                        color="primary"
                        icon={<EditNote style={{ fontSize: '0.9rem' }} />}
                        onClick={() => {
                          setSelectedUser(u);
                          setEditForm({ name: u.name, email: u.email, role: u.role, outlet: u.outlet, employeeId: u.employeeId });
                          setNewPwd('');
                          setShowEditPwd(false);
                          setOpenEdit(true);
                        }}
                      />

                      {/* Delete Account — same chip size as Edit Account and Active/Inactive */}
                      <Chip
                        label="Delete Account"
                        size="small"
                        clickable
                        variant="outlined"
                        color="error"
                        onClick={() => handleDelete(u)}
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
              <TextField fullWidth select label="Outlet / Branch" value={editForm.outlet ?? ''} onChange={e => setEditForm({ ...editForm, outlet: e.target.value })} InputLabelProps={{ shrink: true }}>
                <MenuItem key="edit-outlet-empty" value="">Select Outlet…</MenuItem>
                {OUTLETS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={12}>
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