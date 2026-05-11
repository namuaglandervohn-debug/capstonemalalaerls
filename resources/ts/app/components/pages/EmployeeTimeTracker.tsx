import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Grid, Chip, CircularProgress,
  Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider,
} from '@mui/material';
import { Schedule, Login, Logout as LogoutIcon } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

interface AttRecord {
  id: string; employee: string; date: string;
  // AM/PM time fields
  amTimeIn: string; amTimeOut: string;
  pmTimeIn: string; pmTimeOut: string;
  // Backward-compat fields (timeIn = amTimeIn, timeOut = pmTimeOut)
  timeIn: string; timeOut: string;
  totalHours: string; late: string; undertime: string; overtime: string;
  status: string;
}

function now12h() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function computeHours(tin: string, tout: string): string {
  try {
    const a = new Date(`01/01/2000 ${tin}`);
    const b = new Date(`01/01/2000 ${tout}`);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return '';
    const h = (b.getTime() - a.getTime()) / 3600000;
    return h > 0 ? h.toFixed(1) : '';
  } catch { return ''; }
}

function computeTotalHours(amIn: string, amOut: string, pmIn: string, pmOut: string): string {
  let total = 0;
  if (amIn && amOut) total += parseFloat(computeHours(amIn, amOut)) || 0;
  if (pmIn && pmOut) total += parseFloat(computeHours(pmIn, pmOut)) || 0;
  return total > 0 ? total.toFixed(1) : '';
}

function computeLate(tin: string, expected = '8:00 AM'): string {
  try {
    const actual = new Date(`01/01/2000 ${tin}`);
    const exp = new Date(`01/01/2000 ${expected}`);
    const mins = Math.max(0, (actual.getTime() - exp.getTime()) / 60000);
    return String(Math.round(mins));
  } catch { return '0'; }
}

export default function EmployeeTimeTracker() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualDialog, setManualDialog] = useState(false);
  const [manualForm, setManualForm] = useState({ date: todayStr(), amTimeIn: '', amTimeOut: '', pmTimeIn: '', pmTimeOut: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/attendance`, { headers: HEADERS });
      const data = await res.json();
      const all: AttRecord[] = (data.attendance ?? []).filter((a: any) => a?.employee === user?.name);
      setRecords(all.sort((a, b) => b.date.localeCompare(a.date)));
      setTodayRecord(all.find(a => a.date === todayStr()) ?? null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, [user]);

  const postAttendance = async (payload: object) => {
    const res = await fetch(`${API}/attendance`, { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Server error');
    return data.record;
  };

  const putAttendance = async (id: string, payload: object) => {
    const res = await fetch(`${API}/attendance/${id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Server error');
    return data.record;
  };

  // ── AM Time-In ──────────────────────────────────────────────────────────
  const handleAmTimeIn = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const time = now12h();
      const record = await postAttendance({
        employee: user.name, date: todayStr(),
        amTimeIn: time, amTimeOut: '', pmTimeIn: '', pmTimeOut: '',
        timeIn: time, timeOut: '',
        totalHours: '', late: computeLate(time), undertime: '0', overtime: '0',
        status: 'Present',
      });
      setTodayRecord(record);
      setRecords(prev => [record, ...prev.filter(r => r.date !== todayStr())]);
      setSnackbar({ open: true, message: `✅ AM Time-In recorded: ${time}`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  // ── AM Time-Out ─────────────────────────────────────────────────────────
  const handleAmTimeOut = async () => {
    if (!user || !todayRecord) return;
    setSaving(true);
    try {
      const time = now12h();
      const updated = await putAttendance(todayRecord.id, { amTimeOut: time });
      setTodayRecord(updated);
      setRecords(prev => prev.map(r => r.id === todayRecord.id ? updated : r));
      setSnackbar({ open: true, message: `✅ AM Time-Out recorded: ${time}`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  // ── PM Time-In ──────────────────────────────────────────────────────────
  const handlePmTimeIn = async () => {
    if (!user || !todayRecord) return;
    setSaving(true);
    try {
      const time = now12h();
      const updated = await putAttendance(todayRecord.id, { pmTimeIn: time });
      setTodayRecord(updated);
      setRecords(prev => prev.map(r => r.id === todayRecord.id ? updated : r));
      setSnackbar({ open: true, message: `✅ PM Time-In recorded: ${time}`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  // ── PM Time-Out ─────────────────────────────────────────────────────────
  const handlePmTimeOut = async () => {
    if (!user || !todayRecord) return;
    setSaving(true);
    try {
      const time = now12h();
      const totalHours = computeTotalHours(
        todayRecord.amTimeIn ?? '', todayRecord.amTimeOut ?? '',
        todayRecord.pmTimeIn ?? '', time
      );
      const updated = await putAttendance(todayRecord.id, { pmTimeOut: time, timeOut: time, totalHours });
      setTodayRecord(updated);
      setRecords(prev => prev.map(r => r.id === todayRecord.id ? updated : r));
      setSnackbar({ open: true, message: `✅ PM Time-Out recorded: ${time} · Total: ${totalHours} hrs`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  const handleManualSave = async () => {
    if (!user || !manualForm.amTimeIn) return;
    setSaving(true);
    try {
      const totalHours = computeTotalHours(manualForm.amTimeIn, manualForm.amTimeOut, manualForm.pmTimeIn, manualForm.pmTimeOut);
      const record = await postAttendance({
        employee: user.name, date: manualForm.date,
        amTimeIn: manualForm.amTimeIn, amTimeOut: manualForm.amTimeOut,
        pmTimeIn: manualForm.pmTimeIn, pmTimeOut: manualForm.pmTimeOut,
        timeIn: manualForm.amTimeIn,
        timeOut: manualForm.pmTimeOut || manualForm.amTimeOut,
        totalHours,
        late: computeLate(manualForm.amTimeIn), undertime: '0', overtime: '0',
        status: Number(computeLate(manualForm.amTimeIn)) > 0 ? 'Late' : 'Present',
      });
      setRecords(prev => [record, ...prev.filter(r => r.date !== manualForm.date)]);
      if (manualForm.date === todayStr()) setTodayRecord(record);
      setManualDialog(false);
      setManualForm({ date: todayStr(), amTimeIn: '', amTimeOut: '', pmTimeIn: '', pmTimeOut: '' });
      setSnackbar({ open: true, message: '✅ Manual attendance saved!', severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  const r = todayRecord;
  const amIn = r?.amTimeIn || r?.timeIn || '';
  const amOut = r?.amTimeOut || '';
  const pmIn = r?.pmTimeIn || '';
  const pmOut = r?.pmTimeOut || r?.timeOut || '';

  // Button enable logic
  const canAmIn  = !amIn;
  const canAmOut = !!amIn && !amOut;
  const canPmIn  = !!amOut && !pmIn;
  const canPmOut = !!pmIn && !pmOut;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          Daily Time Tracker
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Record your daily AM and PM time-in/out — {user?.name}
        </Typography>
      </Box>

      {/* Today's Clock Panel */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>Today — {todayStr()}</Typography>

        {/* AM Row */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ opacity: 0.75, fontWeight: 600, letterSpacing: 1 }}>AM SHIFT</Typography>
          <Grid container spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>AM Time-In</Typography>
              <Typography variant="h5" fontWeight="bold">{amIn || '—'}</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>AM Time-Out</Typography>
              <Typography variant="h5" fontWeight="bold">{amOut || '—'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button variant="contained" size="large" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Login />}
                  onClick={handleAmTimeIn} disabled={saving || !canAmIn}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }, '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }, boxShadow: 'none' }}>
                  {amIn ? '✓ AM In' : 'AM Time In'}
                </Button>
                <Button variant="contained" size="large" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <LogoutIcon />}
                  onClick={handleAmTimeOut} disabled={saving || !canAmOut}
                  sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }, '&:disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }, boxShadow: 'none' }}>
                  {amOut ? '✓ AM Out' : 'AM Time Out'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ bgcolor: 'rgba(255,255,255,0.2)', my: 2 }} />

        {/* PM Row */}
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.75, fontWeight: 600, letterSpacing: 1 }}>PM SHIFT</Typography>
          <Grid container spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>PM Time-In</Typography>
              <Typography variant="h5" fontWeight="bold">{pmIn || '—'}</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>PM Time-Out</Typography>
              <Typography variant="h5" fontWeight="bold">{pmOut || '—'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button variant="contained" size="large" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Login />}
                  onClick={handlePmTimeIn} disabled={saving || !canPmIn}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }, '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }, boxShadow: 'none' }}>
                  {pmIn ? '✓ PM In' : 'PM Time In'}
                </Button>
                <Button variant="contained" size="large" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <LogoutIcon />}
                  onClick={handlePmTimeOut} disabled={saving || !canPmOut}
                  sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }, '&:disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }, boxShadow: 'none' }}>
                  {pmOut ? '✓ PM Out' : 'PM Time Out'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Total Hours + Status */}
        {r && (
          <Box sx={{ mt: 2.5 }}>
            <Divider sx={{ bgcolor: 'rgba(255,255,255,0.2)', mb: 1.5 }} />
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>Total Hours Today</Typography>
                <Typography variant="h5" fontWeight="bold">{r.totalHours ? `${r.totalHours} hrs` : '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 8 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip label={r.status} color={r.status === 'Present' ? 'success' : r.status === 'Late' ? 'warning' : 'default'} />
                  {Number(r.late) > 0 && <Chip label={`Late: ${r.late} min`} color="warning" size="small" />}
                  {Number(r.overtime) > 0 && <Chip label={`OT: ${r.overtime} min`} color="success" size="small" />}
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" size="large" onClick={() => setManualDialog(true)}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}>
            Manual Entry
          </Button>
        </Box>
      </Paper>

      {/* Attendance History */}
      <Typography variant="h6" fontWeight="bold" gutterBottom>My Attendance History</Typography>
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}><CircularProgress size={28} /><Typography color="text.secondary">Loading…</Typography></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>AM Time-In</TableCell>
                <TableCell>AM Time-Out</TableCell>
                <TableCell>PM Time-In</TableCell>
                <TableCell>PM Time-Out</TableCell>
                <TableCell>Total Hours</TableCell>
                <TableCell>Late (min)</TableCell>
                <TableCell>OT (min)</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5, color: 'text.secondary' }}>No attendance records yet.</TableCell></TableRow>
              ) : records.map(rec => (
                <TableRow key={rec.id} hover sx={{ bgcolor: rec.date === todayStr() ? 'rgba(31,122,71,0.05)' : 'inherit' }}>
                  <TableCell sx={{ fontWeight: rec.date === todayStr() ? 'bold' : 'normal' }}>
                    {rec.date} {rec.date === todayStr() && <Chip label="Today" size="small" color="primary" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{rec.amTimeIn || rec.timeIn || '—'}</TableCell>
                  <TableCell>{rec.amTimeOut || '—'}</TableCell>
                  <TableCell>{rec.pmTimeIn || '—'}</TableCell>
                  <TableCell>{rec.pmTimeOut || rec.timeOut || '—'}</TableCell>
                  <TableCell>{rec.totalHours ? `${rec.totalHours} hrs` : '—'}</TableCell>
                  <TableCell sx={{ color: Number(rec.late) > 0 ? 'warning.main' : 'inherit' }}>{rec.late || '0'}</TableCell>
                  <TableCell sx={{ color: Number(rec.overtime) > 0 ? 'success.main' : 'inherit' }}>{rec.overtime || '0'}</TableCell>
                  <TableCell><Chip label={rec.status} size="small" color={rec.status === 'Present' ? 'success' : rec.status === 'Late' ? 'warning' : rec.status === 'On Leave' ? 'info' : 'error'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Manual Entry Dialog */}
      <Dialog open={manualDialog} onClose={() => setManualDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Manual Time Entry</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField label="Date" type="date" fullWidth value={manualForm.date}
                onChange={e => setManualForm({ ...manualForm, date: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={6}>
              <TextField label="AM Time-In" fullWidth value={manualForm.amTimeIn}
                onChange={e => setManualForm({ ...manualForm, amTimeIn: e.target.value })} placeholder="e.g. 8:00 AM" />
            </Grid>
            <Grid size={6}>
              <TextField label="AM Time-Out" fullWidth value={manualForm.amTimeOut}
                onChange={e => setManualForm({ ...manualForm, amTimeOut: e.target.value })} placeholder="e.g. 12:00 PM" />
            </Grid>
            <Grid size={6}>
              <TextField label="PM Time-In" fullWidth value={manualForm.pmTimeIn}
                onChange={e => setManualForm({ ...manualForm, pmTimeIn: e.target.value })} placeholder="e.g. 1:00 PM" />
            </Grid>
            <Grid size={6}>
              <TextField label="PM Time-Out" fullWidth value={manualForm.pmTimeOut}
                onChange={e => setManualForm({ ...manualForm, pmTimeOut: e.target.value })} placeholder="e.g. 5:00 PM" />
            </Grid>
            {(manualForm.amTimeIn || manualForm.pmTimeIn) && (
              <Grid size={12}>
                <Alert severity="info">
                  Computed total: {computeTotalHours(manualForm.amTimeIn, manualForm.amTimeOut, manualForm.pmTimeIn, manualForm.pmTimeOut)} hrs
                  {manualForm.amTimeIn && ` · Late: ${computeLate(manualForm.amTimeIn)} min`}
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setManualDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleManualSave} disabled={saving || !manualForm.amTimeIn}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Schedule />}>
            {saving ? 'Saving…' : 'Save Entry'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
