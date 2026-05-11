import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Slider, Card, CardContent,
  Grid, CircularProgress, Alert, Snackbar, Tooltip, IconButton, Divider, MenuItem,
} from '@mui/material';
import { AddCircleOutline, Insights, Grade, TaskAlt, Sync, EmojiEvents, DeleteOutline, Groups } from '@mui/icons-material';
import { API, HEADERS } from '../../lib/api';
import { DSS_CRITERIA, POSITIONS, OUTLETS } from '../../lib/constants';
import { useAuth } from '../../context/AuthContext';

interface EvaluationResult {
  id: string; employee: string; position: string; period: string;
  workQuality: number; jobKnowledge: number; teamwork: number;
  initiative: number; peerEvaluation: number; conduct: number;
  attendance: number; performanceOutput: number;
  finalScore: number; status: 'Pending GM Approval' | 'Approved' | 'Employee of the Month';
}

const EMPTY_FORM = {
  employee: '', position: '', outlet: '', period: 'Q2 2026',
  workQuality: 50, jobKnowledge: 50, teamwork: 50, initiative: 50,
  peerEvaluation: 50, conduct: 50, attendance: 50, performanceOutput: 50,
};

// DSS Final Score Formula per Chapter II pp.55–56
function computeScore(form: typeof EMPTY_FORM): number {
  return (
    form.workQuality       * 0.15 +
    form.jobKnowledge      * 0.10 +
    form.teamwork          * 0.10 +
    form.initiative        * 0.10 +
    form.peerEvaluation    * 0.10 +
    form.conduct           * 0.10 +
    form.attendance        * 0.20 +
    form.performanceOutput * 0.25
  );
}

export default function PerformanceEvaluation() {
  const { user } = useAuth();
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openEvalForm, setOpenEvalForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const fetchEvaluations = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/evaluations`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      const evals = (data.evaluations ?? []).filter((e: any) => e != null);
      evals.sort((a: EvaluationResult, b: EvaluationResult) => b.finalScore - a.finalScore);
      setResults(evals);
    } catch (e: any) { setError(`Could not load evaluations: ${e.message}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEvaluations(); }, []);

  const handleSubmit = async () => {
    if (!form.employee) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/evaluations`, { method: 'POST', headers: HEADERS, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      const updated = [...results, data.record].sort((a, b) => b.finalScore - a.finalScore);
      setResults(updated);
      setOpenEvalForm(false); setForm(EMPTY_FORM);
      setSnackbar({ open: true, message: `✅ Evaluation saved! Final Score: ${data.record.finalScore.toFixed(2)}%`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${API}/evaluations/${id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify({ status: 'Approved' }) });
      if (!res.ok) throw new Error('Update failed');
      setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
      setSnackbar({ open: true, message: '✅ Evaluation approved by GM!', severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
  };

  const handleEOTM = (id: string) => updateResult(id, { status: 'Employee of the Month' }, '🏆 Employee of the Month designation saved!');

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete evaluation ${id}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/evaluations/${id}`, { method: 'DELETE', headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setResults(prev => prev.filter(r => r.id !== id));
      setSnackbar({ open: true, message: `🗑️ Evaluation ${id} deleted.`, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    }
  };

  const updateResult = async (id: string, data: Partial<EvaluationResult>, message: string) => {
    try {
      const res = await fetch(`${API}/evaluations/${id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(data) });
      if (!res.ok) throw new Error('Update failed');
      setResults(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
      setSnackbar({ open: true, message, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
  };

  const top = results[0];
  const eotm = results.find(r => r.status === 'Employee of the Month') ?? top;
  const previewScore = computeScore(form);

  // Peer evaluation state (for employees)
  const [openPeerForm, setOpenPeerForm] = useState(false);
  const [peerForm, setPeerForm] = useState({ targetEmployee: '', peerScore: 50, comment: '' });
  const [peerSaving, setPeerSaving] = useState(false);
  const [employees, setEmployees] = useState<string[]>([]);

  // Fetch employee names for peer eval dropdown
  useEffect(() => {
    if (user?.role !== 'employee') return;
    fetch(`${API}/employees`, { headers: HEADERS })
      .then(r => r.json())
      .then(d => {
        const names = (d.employees ?? [])
          .filter((e: any) => e?.name && e.name !== user.name)
          .map((e: any) => e.name);
        setEmployees(names);
      })
      .catch(() => {});
  }, [user]);

  const handlePeerSubmit = async () => {
    if (!peerForm.targetEmployee) return;
    setPeerSaving(true);
    try {
      // Find the existing evaluation for the target employee in the current period or create a peer note
      const existing = results.find(r => r.employee === peerForm.targetEmployee && r.status === 'Pending GM Approval');
      if (existing) {
        // Update peerEvaluation score on the existing record
        const updated = { peerEvaluation: peerForm.peerScore };
        const res = await fetch(`${API}/evaluations/${existing.id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(updated) });
        if (!res.ok) throw new Error('Update failed');
        setResults(prev => prev.map(r => r.id === existing.id ? { ...r, peerEvaluation: peerForm.peerScore } : r));
        setSnackbar({ open: true, message: `✅ Peer evaluation score submitted for ${peerForm.targetEmployee}!`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: `ℹ️ No active evaluation found for ${peerForm.targetEmployee}. HR must first create the evaluation record.`, severity: 'error' });
      }
      setOpenPeerForm(false);
      setPeerForm({ targetEmployee: '', peerScore: 50, comment: '' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' });
    } finally { setPeerSaving(false); }
  };

  // Employee only sees their own evaluations
  const displayResults = user?.role === 'employee'
    ? results.filter(r => r.employee === user.name)
    : results;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            Performance Evaluation with DSS
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.role === 'supervisor' ? 'Evaluate your team members using the DSS scoring system' :
             user?.role === 'gm' ? 'Review DSS results and approve / designate Employee of the Month' :
             user?.role === 'employee' ? 'View your evaluation results & submit peer evaluations' :
             'Decision Support System — Weighted scoring per HRIS Capstone documentation'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Refresh"><span><IconButton onClick={fetchEvaluations} disabled={loading}><Sync /></IconButton></span></Tooltip>
          {/* Employees can submit peer evaluations */}
          {user?.role === 'employee' && (
            <Button variant="outlined" startIcon={<Groups />} onClick={() => setOpenPeerForm(true)}>
              Peer Evaluation
            </Button>
          )}
          {(user?.role === 'supervisor' || user?.role === 'hr') && (
            <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setOpenEvalForm(true)}>New Evaluation</Button>
          )}
        </Box>
      </Box>

      {error &&
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchEvaluations}>Retry</Button>}>{error}</Alert>}

      {/* DSS Formula Banner */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f0f7f0' }}>
        <Typography variant="subtitle2" fontWeight={700} color="primary.dark" gutterBottom>
          DSS Weighted Scoring Formula (Capstone Chapter II):
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Final Score = (Work Quality × 15%) + (Job Knowledge × 10%) + (Teamwork × 10%) + (Initiative × 10%) + (Peer Evaluation × 10%) + (Conduct × 10%) + (Attendance & Schedule × 20%) + (Performance Output × 25%)
        </Typography>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card elevation={2}><CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Total Evaluated</Typography>
                <Typography variant="h5" fontWeight="bold">{results.length}</Typography>
              </Box>
              <TaskAlt color="success" sx={{ fontSize: 36 }} />
            </Box>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card elevation={2}><CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Pending GM Approval</Typography>
                <Typography variant="h5" fontWeight="bold">{results.filter(r => r.status === 'Pending GM Approval').length}</Typography>
              </Box>
              <Insights color="warning" sx={{ fontSize: 36 }} />
            </Box>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ bgcolor: 'warning.main', color: 'white' }}><CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>🏆 Employee of the Month</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {eotm ? `${eotm.employee} — ${eotm.finalScore.toFixed(2)}%` : 'Not yet designated'}
                </Typography>
                {eotm && <Typography variant="caption" sx={{ opacity: 0.85 }}>{eotm.position} • {eotm.period}</Typography>}
              </Box>
              <Grade sx={{ fontSize: 44 }} />
            </Box>
          </CardContent></Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}><CircularProgress size={28} /><Typography color="text.secondary">Loading from Supabase…</Typography></Box>
        ) : (
          <Table sx={{ minWidth: 1400 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                {['Rank', 'Employee', 'Position', 'Period',
                  'Work Quality (15%)', 'Job Knowledge (10%)', 'Teamwork (10%)',
                  'Initiative (10%)', 'Peer Eval (10%)', 'Conduct (10%)',
                  'Attendance (20%)', 'Performance (25%)', 'Final Score', 'Status',
                  ...(user?.role === 'gm' || user?.role === 'hr' ? ['Actions'] : [])
                ].map(h => (
                  <TableCell key={h} sx={{ color: 'white', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {displayResults.length === 0 ? (
                <TableRow><TableCell colSpan={15} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {user?.role === 'employee' ? 'No evaluations found for your account.' : 'No evaluations yet. Click "New Evaluation" to add one.'}
                </TableCell></TableRow>
              ) : displayResults.map((r, i) => (
                <TableRow key={r.id} hover sx={{ bgcolor: r.status === 'Employee of the Month' ? '#fff8e1' : i === 0 ? '#f0f7f0' : 'inherit' }}>
                  <TableCell>
                    <Chip label={r.status === 'Employee of the Month' ? '🏆 #1' : `#${i + 1}`}
                      color={r.status === 'Employee of the Month' ? 'warning' : i === 0 ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell sx={{ fontWeight: i === 0 ? 'bold' : 'normal' }}>{r.employee}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{r.position}</TableCell>
                  <TableCell>{r.period}</TableCell>
                  <TableCell align="center">{r.workQuality}%</TableCell>
                  <TableCell align="center">{r.jobKnowledge}%</TableCell>
                  <TableCell align="center">{r.teamwork}%</TableCell>
                  <TableCell align="center">{r.initiative}%</TableCell>
                  <TableCell align="center">{r.peerEvaluation}%</TableCell>
                  <TableCell align="center">{r.conduct}%</TableCell>
                  <TableCell align="center">{r.attendance}%</TableCell>
                  <TableCell align="center">{r.performanceOutput}%</TableCell>
                  <TableCell>
                    <Typography fontWeight="bold" color="primary.main" sx={{ whiteSpace: 'nowrap' }}>{r.finalScore.toFixed(2)}%</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={r.status} size="small"
                      color={r.status === 'Employee of the Month' ? 'warning' : r.status === 'Approved' ? 'success' : 'default'}
                      sx={{ fontSize: '0.72rem' }} />
                  </TableCell>
                  {(user?.role === 'gm' || user?.role === 'hr') && (
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {r.status === 'Pending GM Approval' && (user?.role === 'gm' || user?.role === 'hr') && (
                          <Button size="small" variant="outlined" color="success" onClick={() => handleApprove(r.id)}>Approve</Button>
                        )}
                        {r.status === 'Approved' && (user?.role === 'gm') && (
                          <Tooltip title="Designate as Employee of the Month">
                            <Button size="small" variant="outlined" color="warning" startIcon={<EmojiEvents />} onClick={() => handleEOTM(r.id)}>EOTM</Button>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete Evaluation">
                          <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* New Evaluation Dialog (HR/Supervisor) */}
      <Dialog open={openEvalForm} onClose={() => setOpenEvalForm(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>Performance Evaluation Form — DSS</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Employee Name" required value={form.employee} onChange={e => setForm({ ...form, employee: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth select label="Position" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                InputLabelProps={{ shrink: true }}>
                <MenuItem key="pos-empty" value="">Select position…</MenuItem>
                {POSITIONS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Evaluation Period" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} placeholder="e.g. Q2 2026" />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>EVALUATION CRITERIA (Drag sliders to score 0–100)</Typography>
          </Divider>

          <Grid container spacing={1.5}>
            {DSS_CRITERIA.map(c => (
              <Grid key={c.key} size={{ xs: 12, md: 6 }}>
                <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{c.label}</Typography>
                      <Typography variant="caption" color="text.secondary">Weight: {(c.weight * 100).toFixed(0)}%</Typography>
                    </Box>
                    <Typography variant="h6" fontWeight="bold" color="primary">{form[c.key as keyof typeof form]}%</Typography>
                  </Box>
                  <Slider
                    value={form[c.key as keyof typeof form] as number}
                    onChange={(_, v) => setForm({ ...form, [c.key]: v as number })}
                    valueLabelDisplay="auto" min={0} max={100} size="small"
                    sx={{ color: form[c.key as keyof typeof form] as number >= 75 ? 'success.main' : 'primary.main' }}
                  />
                  <Typography variant="caption" color="text.secondary">{c.description}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2.5, mt: 3, bgcolor: previewScore >= 90 ? 'warning.light' : previewScore >= 75 ? 'success.light' : 'primary.light', borderRadius: 2 }}>
            <Typography variant="h5" color="white" fontWeight="bold">
              Projected Final Score: {previewScore.toFixed(2)}%
              {previewScore >= 90 && ' 🏆 Eligible for EOTM'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 0.5 }}>
              {previewScore >= 90 ? 'Excellent — Recommended for Employee of the Month' :
               previewScore >= 75 ? 'Good performance' :
               previewScore >= 60 ? 'Satisfactory' : 'Needs improvement'}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenEvalForm(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving || !form.employee}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Submitting…' : 'Submit Evaluation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Peer Evaluation Dialog (Employee) */}
      <Dialog open={openPeerForm} onClose={() => setOpenPeerForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Groups color="primary" />
            Submit Peer Evaluation
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2.5 }}>
            As a peer, you rate the <strong>Peer Evaluation (10%)</strong> criterion for a fellow employee. This score will be merged into their overall DSS evaluation.
          </Alert>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={12}>
              <TextField fullWidth select label="Select Employee to Evaluate" value={peerForm.targetEmployee}
                onChange={e => setPeerForm({ ...peerForm, targetEmployee: e.target.value })}
                InputLabelProps={{ shrink: true }}
                helperText="Only employees with active evaluations can be peer-reviewed">
                <MenuItem key="peer-empty" value="">Select a colleague…</MenuItem>
                {employees.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={12}>
              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Peer Evaluation Score</Typography>
                    <Typography variant="caption" color="text.secondary">Weight: 10% of final DSS score</Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold" color="primary">{peerForm.peerScore}%</Typography>
                </Box>
                <Slider
                  value={peerForm.peerScore}
                  onChange={(_, v) => setPeerForm({ ...peerForm, peerScore: v as number })}
                  valueLabelDisplay="auto" min={0} max={100}
                  marks={[{ value: 0, label: '0' }, { value: 50, label: '50' }, { value: 100, label: '100' }]}
                  sx={{ color: peerForm.peerScore >= 75 ? 'success.main' : 'primary.main' }}
                />
                <Typography variant="caption" color="text.secondary">
                  {peerForm.peerScore >= 90 ? 'Excellent colleague' :
                   peerForm.peerScore >= 75 ? 'Good team player' :
                   peerForm.peerScore >= 60 ? 'Satisfactory' : 'Needs improvement in teamwork'}
                </Typography>
              </Box>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline rows={2} label="Optional Comment" value={peerForm.comment}
                onChange={e => setPeerForm({ ...peerForm, comment: e.target.value })}
                placeholder="Brief comment about your colleague's performance…" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenPeerForm(false)}>Cancel</Button>
          <Button variant="contained" startIcon={peerSaving ? <CircularProgress size={16} color="inherit" /> : <Groups />}
            onClick={handlePeerSubmit} disabled={peerSaving || !peerForm.targetEmployee}>
            {peerSaving ? 'Submitting…' : 'Submit Peer Score'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}