import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, CircularProgress,
  Alert, Snackbar, Tooltip, IconButton, MenuItem,
} from '@mui/material';
import { Calculate, Visibility, Send, AddCircleOutline, Sync, Payments, TaskAlt, DeleteOutline } from '@mui/icons-material';
import { API, HEADERS } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface Payroll {
  id: string; employee: string; position: string; period: string;
  totalHours: string; overtime: string; deductions: string;
  grossPay: string; netPay: string; status: 'Draft' | 'For Review' | 'Processed' | 'Released';
}

const EMPTY = { employee: '', position: '', period: new Date().toISOString().slice(0, 7), totalHours: '', overtime: '0', deductions: '', grossPay: '', netPay: '' };

export default function PayrollComputation() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [addDialog, setAddDialog] = useState(false);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [generatePeriod, setGeneratePeriod] = useState(new Date().toISOString().slice(0, 7));
  const [generateBase, setGenerateBase] = useState('18000');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const { user } = useAuth();

  // ── Payslip edit state ───────────────────────────────────────────────
  const [editingPayslip, setEditingPayslip] = useState(false);
  const [payslipEditForm, setPayslipEditForm] = useState({ totalHours: '', overtime: '', grossPay: '', deductions: '', netPay: '' });

  const fetchPayroll = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/payroll`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setPayrolls((data.payrolls ?? []).filter((p: any) => p != null));
    } catch (e: any) { setError(`Could not load payroll: ${e.message}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPayroll(); }, []);

  const handleAdd = async () => {
    if (!form.employee || !form.grossPay) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/payroll`, { method: 'POST', headers: HEADERS, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setPayrolls(prev => [...prev, data.record]);
      setAddDialog(false); setForm(EMPTY);
      setSnackbar({ open: true, message: 'Payroll record saved to Supabase!', severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/payroll/generate`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ period: generatePeriod, baseSalary: parseFloat(generateBase) || 18000 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      if (data.count === 0) {
        setSnackbar({ open: true, message: 'All active employees already have payroll for this period.', severity: 'success' });
      } else {
        setPayrolls(prev => [...prev, ...data.created]);
        setSnackbar({ open: true, message: `✅ Generated ${data.count} payroll record(s) for ${generatePeriod}!`, severity: 'success' });
      }
      setGenerateDialog(false);
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setGenerating(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`${API}/payroll/${id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error('Update failed');
      setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: status as Payroll['status'] } : p));
      if (selectedPayroll?.id === id) setSelectedPayroll(p => p ? { ...p, status: status as Payroll['status'] } : p);
      setSnackbar({ open: true, message: `Status updated to "${status}"!`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
  };

  const handleReleaseSalary = async (ids?: string[]) => {
    const targets = ids ? payrolls.filter(p => ids.includes(p.id)) : filtered.filter(p => p.status === 'For Review');
    if (targets.length === 0) { setSnackbar({ open: true, message: 'No "For Review" payrolls to release.', severity: 'success' }); return; }
    let count = 0;
    for (const p of targets) {
      try {
        await fetch(`${API}/payroll/${p.id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ status: 'Released', releasedBy: user?.name ?? 'Accounting' }) });
        setPayrolls(prev => prev.map(x => x.id === p.id ? { ...x, status: 'Released' as any } : x));
        count++;
      } catch (_) {}
    }
    setSnackbar({ open: true, message: `✅ ${count} salary record(s) marked as Released!`, severity: 'success' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete payroll record ${id}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/payroll/${id}`, { method: 'DELETE', headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setPayrolls(prev => prev.filter(p => p.id !== id));
      setSnackbar({ open: true, message: `🗑️ Payroll record ${id} deleted.`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
  };

  const filtered = payrolls.filter(p => {
    const periodMatch = !filterPeriod || p.period === filterPeriod;
    const statusMatch = filterStatus === 'all' || p.status.toLowerCase().replace(' ', '') === filterStatus.toLowerCase().replace(' ', '');
    return periodMatch && statusMatch;
  });

  const parseAmt = (v: string) => parseFloat((v ?? '').replace(/[₱,]/g, '')) || 0;
  const totals = filtered.reduce((acc, p) => ({
    gross: acc.gross + parseAmt(p.grossPay),
    net: acc.net + parseAmt(p.netPay),
    ded: acc.ded + parseAmt(p.deductions),
  }), { gross: 0, net: 0, ded: 0 });

  const handleForwardToAccounting = async () => {
    const drafts = filtered.filter(p => p.status === 'Draft');
    if (drafts.length === 0) { setSnackbar({ open: true, message: 'No Draft payrolls to forward.', severity: 'success' }); return; }
    let count = 0;
    for (const p of drafts) {
      try {
        await fetch(`${API}/payroll/${p.id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ status: 'For Review' }) });
        setPayrolls(prev => prev.map(x => x.id === p.id ? { ...x, status: 'For Review' } : x));
        count++;
      } catch (_) {}
    }
    setSnackbar({ open: true, message: `${count} payroll record(s) forwarded to Accounting (For Review).`, severity: 'success' });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            Payroll Computation
          </Typography>
          <Typography variant="body2" color="text.secondary">Generate and manage employee payroll — data from Supabase</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Refresh"><span><IconButton onClick={fetchPayroll} disabled={loading}><Sync /></IconButton></span></Tooltip>
          {(user?.role === 'accounting') && (
            <Button variant="contained" color="success" startIcon={<Payments />} onClick={() => handleReleaseSalary()}>
              Release Salary
            </Button>
          )}
          {(user?.role === 'hr') && (
            <>
              <Button variant="outlined" startIcon={<Send />} onClick={handleForwardToAccounting}>Forward to Accounting</Button>
              <Button variant="outlined" startIcon={<AddCircleOutline />} onClick={() => setAddDialog(true)}>Manual Entry</Button>
              <Button variant="contained" startIcon={<Calculate />} onClick={() => setGenerateDialog(true)}>Generate Payroll</Button>
            </>
          )}
        </Box>
      </Box>

      {error &&
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchPayroll}>Retry</Button>}>{error}</Alert>
      }

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth label="Filter by Period" type="month" value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select label="Status" value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)} InputLabelProps={{ shrink: true }}>
              <MenuItem key="all" value="all">All Status</MenuItem>
              <MenuItem key="draft" value="draft">Draft</MenuItem>
              <MenuItem key="forreview" value="forreview">For Review</MenuItem>
              <MenuItem key="processed" value="processed">Processed</MenuItem>
              <MenuItem key="released" value="released">Released</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Button fullWidth variant="outlined" sx={{ height: '56px' }} onClick={() => { setFilterPeriod(''); setFilterStatus('all'); }}>Clear Filters</Button>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}><CircularProgress size={28} /><Typography color="text.secondary">Loading from Supabase…</Typography></Box>
        ) : (
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell><TableCell>Employee</TableCell><TableCell>Position</TableCell>
                <TableCell>Period</TableCell><TableCell>Total Hours</TableCell><TableCell>OT (hrs)</TableCell>
                <TableCell>Deductions</TableCell><TableCell>Gross Pay</TableCell><TableCell>Net Pay</TableCell>
                <TableCell>Status</TableCell><TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {payrolls.length === 0 ? 'No payroll records yet. Click "Generate Payroll" to create records for all active employees.' : 'No results match your filters.'}
                </TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id} hover>
                  <TableCell><Chip label={p.id} size="small" variant="outlined" /></TableCell>
                  <TableCell>{p.employee}</TableCell><TableCell>{p.position}</TableCell>
                  <TableCell>{p.period}</TableCell><TableCell>{p.totalHours} hrs</TableCell>
                  <TableCell>{p.overtime} hrs</TableCell><TableCell sx={{ color: 'error.main' }}>{p.deductions}</TableCell>
                  <TableCell>{p.grossPay}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>{p.netPay}</TableCell>
                  <TableCell>
                    <Chip label={p.status} size="small" color={p.status === 'Processed' ? 'success' : p.status === 'For Review' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Button size="small" startIcon={<Visibility />} onClick={() => { setSelectedPayroll(p); setViewDialog(true); }}>
                        {user?.role === 'employee' ? 'View' : 'Payslip'}
                      </Button>
                      {user?.role === 'accounting' && p.status === 'For Review' && (
                        <Button size="small" variant="contained" color="success" startIcon={<TaskAlt />} onClick={() => handleReleaseSalary([p.id])}>
                          Release
                        </Button>
                      )}
                      {user?.role === 'hr' && (
                        <Tooltip title="Delete Record">
                          <IconButton size="small" color="error" onClick={() => handleDelete(p.id)}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {!loading && filtered.length > 0 && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" gutterBottom>Summary {filterPeriod ? `— ${filterPeriod}` : '(All Periods)'}</Typography>
          <Grid container spacing={2}>
            {[['Employees', filtered.length], ['Total Gross Pay', `₱${Math.round(totals.gross).toLocaleString()}`], ['Total Deductions', `₱${Math.round(totals.ded).toLocaleString()}`], ['Total Net Pay', `₱${Math.round(totals.net).toLocaleString()}`]].map(([l, v]) => (
              <Grid key={String(l)} size={{ xs: 6, md: 3 }}>
                <Typography variant="body2" color="text.secondary">{l}</Typography>
                <Typography variant="h6" color={l === 'Total Net Pay' ? 'primary' : 'inherit'}>{v}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Generate Payroll Dialog */}
      <Dialog open={generateDialog} onClose={() => setGenerateDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Generate Payroll</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary">
            This will auto-generate payroll records for all <strong>Active</strong> employees for the selected period, calculating deductions (SSS 4.5%, PhilHealth 2%, Pag-IBIG ₱100).
          </Typography>
          <TextField label="Payroll Period" type="month" fullWidth value={generatePeriod}
            onChange={e => setGeneratePeriod(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Base Monthly Salary (₱)" type="number" fullWidth value={generateBase}
            onChange={e => setGenerateBase(e.target.value)} helperText="Default base salary per employee" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGenerateDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <Calculate />}
            onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate Now'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Add Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Manual Payroll Entry</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField label="Employee Name" fullWidth required value={form.employee} onChange={e => setForm({ ...form, employee: e.target.value })} />
          <TextField label="Position" fullWidth value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
          <TextField label="Period" type="month" fullWidth value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} InputLabelProps={{ shrink: true }} />
          <Grid container spacing={2}>
            <Grid size={6}><TextField label="Total Hours" fullWidth value={form.totalHours} onChange={e => setForm({ ...form, totalHours: e.target.value })} /></Grid>
            <Grid size={6}><TextField label="Overtime (hrs)" fullWidth value={form.overtime} onChange={e => setForm({ ...form, overtime: e.target.value })} /></Grid>
            <Grid size={4}><TextField label="Gross Pay" fullWidth required value={form.grossPay} onChange={e => setForm({ ...form, grossPay: e.target.value })} placeholder="₱0" /></Grid>
            <Grid size={4}><TextField label="Deductions" fullWidth value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} placeholder="₱0" /></Grid>
            <Grid size={4}><TextField label="Net Pay" fullWidth value={form.netPay} onChange={e => setForm({ ...form, netPay: e.target.value })} placeholder="₱0" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Saving…' : 'Save Payroll'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payslip Dialog */}
      <Dialog open={viewDialog} onClose={() => { setViewDialog(false); setEditingPayslip(false); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Payslip Preview
            {selectedPayroll && <Chip label={selectedPayroll.id} size="small" variant="outlined" />}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPayroll && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="h6" align="center" gutterBottom fontWeight="bold">{selectedPayroll.employee}</Typography>
              <Typography variant="body2" align="center" color="text.secondary">{selectedPayroll.position}</Typography>
              <Typography variant="body2" align="center" sx={{ mb: 3 }}>Payroll Period: {selectedPayroll.period}</Typography>

              {editingPayslip ? (
                /* ── Edit Mode ── */
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mb: 2, letterSpacing: 0.5 }}>
                    EDIT PAYSLIP DETAILS
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <TextField fullWidth size="small" label="Total Hours" value={payslipEditForm.totalHours}
                        onChange={e => setPayslipEditForm(f => ({ ...f, totalHours: e.target.value }))} />
                    </Grid>
                    <Grid size={6}>
                      <TextField fullWidth size="small" label="Overtime (hrs)" value={payslipEditForm.overtime}
                        onChange={e => setPayslipEditForm(f => ({ ...f, overtime: e.target.value }))} />
                    </Grid>
                    <Grid size={12}>
                      <TextField fullWidth size="small" label="Gross Pay" value={payslipEditForm.grossPay}
                        onChange={e => setPayslipEditForm(f => ({ ...f, grossPay: e.target.value }))} placeholder="₱0" />
                    </Grid>
                    <Grid size={12}>
                      <TextField fullWidth size="small" label="Deductions (leave blank or set to ₱0 if none)" value={payslipEditForm.deductions}
                        onChange={e => setPayslipEditForm(f => ({ ...f, deductions: e.target.value }))} placeholder="₱0" />
                    </Grid>
                    <Grid size={12}>
                      <TextField fullWidth size="small" label="Net Pay" value={payslipEditForm.netPay}
                        onChange={e => setPayslipEditForm(f => ({ ...f, netPay: e.target.value }))} placeholder="₱0" />
                    </Grid>
                  </Grid>
                </Paper>
              ) : (
                /* ── View Mode ── */
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  {[
                    ['Total Hours', `${selectedPayroll.totalHours} hrs`],
                    ['Overtime Hours', `${selectedPayroll.overtime} hrs`],
                    ['Gross Pay', selectedPayroll.grossPay],
                    ['Deductions', selectedPayroll.deductions || '₱0.00'],
                  ].map(([k, v]) => (
                    <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="body2">{k}</Typography>
                      <Typography variant="body2" fontWeight={500}>{v}</Typography>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5 }}>
                    <Typography variant="h6" fontWeight="bold">Net Pay</Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">{selectedPayroll.netPay}</Typography>
                  </Box>
                </Paper>
              )}

              <TextField select fullWidth label="Update Status" value={selectedPayroll.status}
                onChange={e => handleStatusChange(selectedPayroll.id, e.target.value)}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="Draft" value="Draft">Draft</MenuItem>
                <MenuItem key="For Review" value="For Review">For Review</MenuItem>
                <MenuItem key="Processed" value="Processed">Processed</MenuItem>
                <MenuItem key="Released" value="Released">Released</MenuItem>
              </TextField>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setViewDialog(false); setEditingPayslip(false); }}>Close</Button>
          {!editingPayslip ? (
            <Button variant="outlined" color="primary"
              onClick={() => {
                if (selectedPayroll) {
                  setPayslipEditForm({
                    totalHours: selectedPayroll.totalHours ?? '',
                    overtime: selectedPayroll.overtime ?? '',
                    grossPay: selectedPayroll.grossPay ?? '',
                    deductions: '',   // start empty so user fills deductions manually
                    netPay: selectedPayroll.netPay ?? '',
                  });
                  setEditingPayslip(true);
                }
              }}>
              Edit Payslip
            </Button>
          ) : (
            <Button variant="contained" color="success" disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              onClick={async () => {
                if (!selectedPayroll) return;
                setSaving(true);
                try {
                  const res = await fetch(`${API}/payroll/${selectedPayroll.id}`, {
                    method: 'PUT', headers: HEADERS, body: JSON.stringify(payslipEditForm),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error ?? 'Server error');
                  const updated = data.record ?? { ...selectedPayroll, ...payslipEditForm };
                  setPayrolls(prev => prev.map(p => p.id === selectedPayroll.id ? updated : p));
                  setSelectedPayroll(updated);
                  setEditingPayslip(false);
                  setSnackbar({ open: true, message: '✅ Payslip updated!', severity: 'success' });
                } catch (e: any) {
                  setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
                } finally { setSaving(false); }
              }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
          <Button variant="contained" onClick={() => window.print()}>Print Payslip</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}