import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Grid,
  CircularProgress, Alert, Snackbar, Tooltip, IconButton, Tabs, Tab,
} from '@mui/material';
import { AddCircleOutline, TaskAlt, CancelOutlined, Sync, Visibility, Security, DeleteOutline } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

interface Request {
  id: string; employee: string; type: 'Leave' | 'Overtime' | 'Undertime';
  date: string; startDate?: string; endDate?: string; reason: string;
  status: 'Pending' | 'Supervisor Approved' | 'Approved' | 'Disapproved';
  supervisorStatus?: string; supervisorNote?: string;
  hrStatus?: string; hrNote?: string;
  submittedDate: string;
}

const EMPTY = { type: 'Leave', date: '', startDate: '', endDate: '', reason: '' };

const STATUS_CHIP: Record<string, any> = {
  'Pending': { color: 'warning', label: 'Pending' },
  'Supervisor Approved': { color: 'info', label: 'Supervisor Approved' },
  'Approved': { color: 'success', label: 'HR Approved' },
  'Disapproved': { color: 'error', label: 'Disapproved' },
};

export default function RequestManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedReq, setSelectedReq] = useState<Request | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [newRequest, setNewRequest] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const fetchRequests = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/requests`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setRequests((data.requests ?? []).filter((r: any) => r != null));
    } catch (e: any) {
      setError(`Could not load requests: ${e.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleSubmit = async () => {
    if (!newRequest.date || !newRequest.reason) return;
    setSaving(true);
    try {
      const body = { ...newRequest, employee: user?.name || 'Employee', startDate: newRequest.startDate || newRequest.date, endDate: newRequest.endDate || newRequest.date };
      const res = await fetch(`${API}/requests`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setRequests(prev => [data.record, ...prev]);
      setOpenDialog(false); setNewRequest(EMPTY);
      setSnackbar({ open: true, message: '✅ Request submitted!', severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  const updateRequest = async (id: string, update: object, successMsg: string) => {
    try {
      const res = await fetch(`${API}/requests/${id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(update) });
      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      setRequests(prev => prev.map(r => r.id === id ? data.record : r));
      if (selectedReq?.id === id) setSelectedReq(data.record);
      setSnackbar({ open: true, message: successMsg, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
  };

  // ── Supervisor Actions ──────────────────────────────────────────────────────
  const supervisorApprove = (id: string) => updateRequest(id, { status: 'Supervisor Approved', supervisorStatus: 'Approved', supervisorNote: noteInput, supervisorName: user?.name }, '✅ Request approved — forwarded to HR for final validation.');
  const supervisorDisapprove = (id: string) => updateRequest(id, { status: 'Disapproved', supervisorStatus: 'Disapproved', supervisorNote: noteInput }, '❌ Request disapproved.');

  // ── HR Actions ───────────────────────────────────────────────────────────────
  const hrApprove = (id: string) => updateRequest(id, { status: 'Approved', hrStatus: 'Approved', hrNote: noteInput, hrName: user?.name }, '✅ Request validated and fully approved by HR.');
  const hrReject = (id: string) => updateRequest(id, { status: 'Disapproved', hrStatus: 'Disapproved', hrNote: noteInput }, '❌ Request rejected by HR.');

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete request ${id}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/requests/${id}`, { method: 'DELETE', headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setRequests(prev => prev.filter(r => r.id !== id));
      setSnackbar({ open: true, message: `🗑️ Request ${id} deleted.`, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
  };

  const isSupervisor = user?.role === 'supervisor';
  const isHR = user?.role === 'hr';
  const isEmployee = user?.role === 'employee';

  // Filter tabs
  const myRequests = isEmployee ? requests.filter(r => r.employee === user?.name) : requests;
  const tabData = [
    { label: 'All', data: myRequests },
    { label: 'Pending', data: myRequests.filter(r => r.status === 'Pending') },
    { label: 'Supervisor Approved', data: myRequests.filter(r => r.status === 'Supervisor Approved') },
    { label: 'Approved', data: myRequests.filter(r => r.status === 'Approved') },
    { label: 'Disapproved', data: myRequests.filter(r => r.status === 'Disapproved') },
  ];
  const displayData = tabData[tab]?.data ?? myRequests;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            Leave, Overtime & Undertime Requests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isSupervisor ? 'Inbox: Review and approve/disapprove employee requests' :
             isHR ? 'HR Validation: Confirm supervisor-approved requests for final approval' :
             'Submit and track your requests'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh"><span><IconButton onClick={fetchRequests} disabled={loading}><Sync /></IconButton></span></Tooltip>
          <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setOpenDialog(true)}>New Request</Button>
        </Box>
      </Box>

      {error &&
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchRequests}>Retry</Button>}>{error}</Alert>
      }

      {/* Approval Flow Info */}
      {(isSupervisor || isHR) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>Two-Step Approval Flow:</strong> Employee submits → <strong>Supervisor</strong> reviews & approves → <strong>HR</strong> validates for final approval.
          {isSupervisor && ' You can approve or disapprove "Pending" requests.'}
          {isHR && ' You validate "Supervisor Approved" requests for final HR approval.'}
        </Alert>
      )}

      {/* Status Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {tabData.map((t, i) => (
            <Tab key={i} label={`${t.label} (${t.data.length})`} />
          ))}
        </Tabs>
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}><CircularProgress size={28} /><Typography color="text.secondary">Loading…</Typography></Box>
        ) : (
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell><TableCell>Employee</TableCell><TableCell>Type</TableCell>
                <TableCell>Date</TableCell><TableCell>Reason</TableCell><TableCell>Submitted</TableCell>
                <TableCell>Status</TableCell><TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayData.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>No requests in this category.</TableCell></TableRow>
              ) : displayData.map(req => {
                const s = STATUS_CHIP[req.status] ?? { color: 'default', label: req.status };
                return (
                  <TableRow key={req.id} hover>
                    <TableCell><Chip label={req.id} size="small" variant="outlined" /></TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{req.employee}</TableCell>
                    <TableCell><Chip label={req.type} size="small" color={req.type === 'Leave' ? 'info' : req.type === 'Overtime' ? 'success' : 'warning'} /></TableCell>
                    <TableCell>{req.date}</TableCell>
                    <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.reason}</TableCell>
                    <TableCell>{req.submittedDate}</TableCell>
                    <TableCell><Chip label={s.label} size="small" color={s.color} /></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => { setSelectedReq(req); setNoteInput(''); setViewDialog(true); }}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {isSupervisor && req.status === 'Pending' && (
                          <>
                            <Button size="small" variant="contained" color="success" startIcon={<TaskAlt />} onClick={() => { setSelectedReq(req); setNoteInput(''); setViewDialog(true); }}>Approve</Button>
                            <Button size="small" variant="outlined" color="error" startIcon={<CancelOutlined />} onClick={() => supervisorDisapprove(req.id)}>Deny</Button>
                          </>
                        )}
                        {isHR && req.status === 'Supervisor Approved' && (
                          <>
                            <Button size="small" variant="contained" color="success" startIcon={<Security />} onClick={() => { setSelectedReq(req); setNoteInput(''); setViewDialog(true); }}>Validate</Button>
                            <Button size="small" variant="outlined" color="error" startIcon={<CancelOutlined />} onClick={() => hrReject(req.id)}>Reject</Button>
                          </>
                        )}
                        {isHR && (
                          <Tooltip title="Delete Request">
                            <IconButton size="small" color="error" onClick={() => handleDelete(req.id)}>
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Submit New Request Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Submit New Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={12}>
              <TextField fullWidth select label="Request Type" value={newRequest.type} onChange={e => setNewRequest({ ...newRequest, type: e.target.value as any })} InputLabelProps={{ shrink: true }}>
                <MenuItem key="Leave" value="Leave">Leave</MenuItem>
                <MenuItem key="Overtime" value="Overtime">Overtime</MenuItem>
                <MenuItem key="Undertime" value="Undertime">Undertime</MenuItem>
              </TextField>
            </Grid>

            {/* Undertime: single date only */}
            {newRequest.type === 'Undertime' ? (
              <Grid size={12}>
                <TextField fullWidth label="Date of Undertime" type="date"
                  value={newRequest.startDate}
                  onChange={e => setNewRequest({ ...newRequest, startDate: e.target.value, endDate: e.target.value, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  helperText="Undertime applies to a single specific date only"
                />
              </Grid>
            ) : (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="Start Date" type="date" value={newRequest.startDate} onChange={e => setNewRequest({ ...newRequest, startDate: e.target.value, date: e.target.value })} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="End Date" type="date" value={newRequest.endDate} onChange={e => setNewRequest({ ...newRequest, endDate: e.target.value })} InputLabelProps={{ shrink: true }} />
                </Grid>
              </>
            )}

            <Grid size={12}>
              <TextField fullWidth multiline rows={3} label="Reason / Details" value={newRequest.reason} onChange={e => setNewRequest({ ...newRequest, reason: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? 'Submitting…' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View / Approve Dialog */}
      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Request Details — {selectedReq?.id}</DialogTitle>
        <DialogContent>
          {selectedReq && (
            <Box sx={{ pt: 1 }}>
              {[['Employee', selectedReq.employee], ['Type', selectedReq.type], ['Date', `${selectedReq.startDate ?? selectedReq.date} – ${selectedReq.endDate ?? selectedReq.date}`], ['Reason', selectedReq.reason], ['Submitted', selectedReq.submittedDate]].map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary">{k}</Typography>
                  <Typography variant="body2" fontWeight={500}>{v}</Typography>
                </Box>
              ))}
              <Box sx={{ mt: 2 }}>
                <Chip label={STATUS_CHIP[selectedReq.status]?.label ?? selectedReq.status} color={STATUS_CHIP[selectedReq.status]?.color} />
              </Box>
              {selectedReq.supervisorNote && (
                <Alert severity="info" sx={{ mt: 2 }}>Supervisor Note: {selectedReq.supervisorNote}</Alert>
              )}
              {selectedReq.hrNote && (
                <Alert severity="success" sx={{ mt: 1 }}>HR Note: {selectedReq.hrNote}</Alert>
              )}
              {/* Action Note Input */}
              {((isSupervisor && selectedReq.status === 'Pending') || (isHR && selectedReq.status === 'Supervisor Approved')) && (
                <TextField fullWidth multiline rows={2} label="Note / Remarks (optional)" value={noteInput}
                  onChange={e => setNoteInput(e.target.value)} sx={{ mt: 2 }} />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
          {isSupervisor && selectedReq?.status === 'Pending' && (
            <>
              <Button variant="outlined" color="error" startIcon={<CancelOutlined />} onClick={() => { supervisorDisapprove(selectedReq.id); setViewDialog(false); }}>Disapprove</Button>
              <Button variant="contained" color="success" startIcon={<TaskAlt />} onClick={() => { supervisorApprove(selectedReq.id); setViewDialog(false); }}>Approve</Button>
            </>
          )}
          {isHR && selectedReq?.status === 'Supervisor Approved' && (
            <>
              <Button variant="outlined" color="error" startIcon={<CancelOutlined />} onClick={() => { hrReject(selectedReq.id); setViewDialog(false); }}>Reject</Button>
              <Button variant="contained" color="success" startIcon={<Security />} onClick={() => { hrApprove(selectedReq.id); setViewDialog(false); }}>Validate & Approve</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}