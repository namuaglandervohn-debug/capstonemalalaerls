import { API, HEADERS } from '../../lib/api';
import { loadApplicationFiles } from '../../lib/localDb';
import { POSITIONS } from '../../lib/constants';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  AddCircleOutline, Sync, CalendarMonth, TaskAlt, Event, HowToReg,
  CancelOutlined, DeleteOutline, PictureAsPdf, Article, FileDownload, InsertDriveFile,
  Visibility, Image as ImageIcon, EditNote, AddCircle, RemoveCircle,
} from '@mui/icons-material';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  CircularProgress, Alert, Snackbar, Tooltip, Grid, Tabs, Tab,
  Checkbox, FormControlLabel, FormGroup, Divider, Stack,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';

interface DocFile {
  name: string;
  type: string;
  data: string; // base64 data URI
}

interface Application {
  id: string; name: string; position: string; dateApplied: string;
  status: 'Submitted' | 'Under Review' | 'Missing Requirements' | 'For Interview' | 'Hired' | 'Not Qualified';
  // Name parts (from new comprehensive form)
  firstName?: string; middleName?: string; lastName?: string; suffix?: string;
  // Personal info
  gender?: string; civilStatus?: string; birthdate?: string; birthplace?: string;
  height?: string; weight?: string;
  // Contact
  email: string; phone: string; address?: string;
  // Employment
  experience?: string; education?: string; coverLetter?: string;
  // Government IDs
  tin?: string; sss?: string; philhealth?: string; pagibig?: string;
  // Emergency contact
  emergencyContact?: string;
  // Submitted documents (file names + base64 data)
  resumeFileName?: string;
  resumeFileData?: string;           // base64 data URI
  supportingDocuments?: string[];
  supportingDocumentFiles?: DocFile[];
  // Requirements
  hasResume?: boolean; hasBirthCert?: boolean; hasTOR?: boolean; hasMedCert?: boolean;
  requirementsNote?: string;
  customRequirements?: { label: string; checked: boolean }[];
  // Interview
  interviewDate?: string; interviewTime?: string; interviewLocation?: string;
  interviewNotes?: string; interviewFeedback?: string; hiringDecision?: string; scheduledBy?: string;
}

const STATUS_COLORS: Record<string, any> = {
  'Submitted': 'default', 'Under Review': 'primary', 'Missing Requirements': 'warning',
  'For Interview': 'info', 'Hired': 'success', 'Not Qualified': 'error',
};

export default function RecruitmentManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [interviewDialog, setInterviewDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; data: string; type: string } | null>(null);

  // Interview scheduling form
  const [iForm, setIForm] = useState({ interviewDate: '', interviewTime: '', interviewLocation: 'HR Office, Buenaventura Estate', interviewNotes: '' });
  // GM hiring decision form
  const [gmForm, setGmForm] = useState({ interviewFeedback: '', hiringDecision: '' });
  // Requirements checklist
  const [reqForm, setReqForm] = useState({ hasResume: false, hasBirthCert: false, hasTOR: false, hasMedCert: false, requirementsNote: '', customRequirements: [] as { label: string; checked: boolean }[] });
  // Edit application
  const [editAppDialog, setEditAppDialog] = useState(false);
  const [editAppForm, setEditAppForm] = useState<Partial<Application>>({});
  // Edit requirements checklist dialog
  const [editReqDialog, setEditReqDialog] = useState(false);
  const [newReqText, setNewReqText] = useState('');

  const isHR = user?.role === 'hr';
  const isGM = user?.role === 'gm';

  const fetchApplications = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/applications`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setApplications(data.applications ?? []);
    } catch (e: any) { setError(`Could not load applications: ${e.message}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchApplications(); }, []);

  const updateApp = async (id: string, update: object, msg: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/applications/${id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(update) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setApplications(prev => prev.map(a => a.id === id ? data.application : a));
      if (selectedApp?.id === id) setSelectedApp(data.application);
      setSnackbar({ open: true, message: msg, severity: 'success' });
    } catch (e: any) { setSnackbar({ open: true, message: `Failed: ${e.message}`, severity: 'error' }); }
    finally { setSaving(false); }
  };

  const handleUpdateStatus = (id: string, status: string) => updateApp(id, { status }, `Status updated to "${status}"!`);
  const handleSaveRequirements = (id: string) => updateApp(id, { ...reqForm, status: (!reqForm.hasResume || !reqForm.hasBirthCert) ? 'Missing Requirements' : 'Under Review' },
    '✅ Requirements checklist saved!');
  const handleScheduleInterview = async () => {
    if (!selectedApp) return;
    await updateApp(selectedApp.id, { ...iForm, status: 'For Interview', scheduledBy: user?.name }, '✅ Interview scheduled! Status set to "For Interview".');
    setInterviewDialog(false);
  };
  const handleHiringDecision = (id: string, decision: string) => {
    const status = decision === 'Hired' ? 'Hired' : 'Not Qualified';
    updateApp(id, { ...gmForm, hiringDecision: decision, status }, `✅ Hiring decision: ${status}`);

    // ── Auto-create Employee Record + User Account when Hired ────────────────
    if (decision === 'Hired') {
      const app = applications.find(a => a.id === id);
      if (app) {
        const fullName = [app.firstName, app.middleName, app.lastName, app.suffix].filter(Boolean).join(' ') || app.name;
        const employeePayload = {
          name: fullName,
          position: app.position ?? '',
          department: '',
          outlet: '',
          email: app.email ?? '',
          phone: app.phone ?? '',
          address: app.address ?? '',
          hireDate: new Date().toISOString().split('T')[0],
          status: 'Active',
          salary: '',
          emergencyContact: app.emergencyContact ?? '',
          sss: app.sss ?? '',
          philhealth: app.philhealth ?? '',
          pagibig: app.pagibig ?? '',
          tin: app.tin ?? '',
        };
        // Create employee record (non-blocking)
        fetch(`${API}/employees`, { method: 'POST', headers: HEADERS, body: JSON.stringify(employeePayload) })
          .then(res => res.json())
          .then(data => {
            if (data.employee) {
              // Auto-create user login account
              const autoEmail = app.email?.trim() || `${fullName.toLowerCase().replace(/\s+/g, '.')}@buenaventura.com`;
              return fetch(`${API}/users`, {
                method: 'POST', headers: HEADERS,
                body: JSON.stringify({
                  name: fullName,
                  email: autoEmail,
                  role: 'employee',
                  employeeId: data.employee.id,
                  outlet: '',
                  password: 'password',
                }),
              });
            }
          })
          .catch(err => console.warn('Auto employee/user creation skipped:', err));
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    setViewDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete application ${id}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/applications/${id}`, { method: 'DELETE', headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setApplications(prev => prev.filter(a => a.id !== id));
      setSnackbar({ open: true, message: `🗑️ Application ${id} deleted.`, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed to delete: ${e.message}`, severity: 'error' });
    }
  };

  const openView = async (app: Application) => {
    // Show dialog immediately with list metadata so it feels instant
    setSelectedApp(app);
    setReqForm({
      hasResume: app.hasResume ?? false,
      hasBirthCert: app.hasBirthCert ?? false,
      hasTOR: app.hasTOR ?? false,
      hasMedCert: app.hasMedCert ?? false,
      requirementsNote: app.requirementsNote ?? '',
      customRequirements: app.customRequirements ?? [],
    });
    setGmForm({ interviewFeedback: app.interviewFeedback ?? '', hiringDecision: app.hiringDecision ?? '' });
    setViewDialog(true);
    setProfileLoading(true);

    try {
      // Fetch the application record (server or localDb via interceptor)
      const res = await fetch(`${API}/applications/${app.id}`, { headers: HEADERS });
      const data = await res.json();
      let fullApp: Application = (res.ok && data.application) ? data.application : app;

      // ALWAYS merge file data from the client-side store.
      // This is the source of truth for binary attachments — the server's KV
      // store may not have persisted them if the payload was too large.
      const fileData = loadApplicationFiles(app.id);
      if (fileData) {
        fullApp = { ...fullApp, ...fileData } as Application;
        console.log('[RecruitmentManagement] openView: merged file data for', app.id,
          '| resume:', !!fileData.resumeFileData,
          '| supporting:', fileData.supportingDocumentFiles?.length ?? 0);
      } else {
        console.log('[RecruitmentManagement] openView: no local file data for', app.id);
      }

      setSelectedApp(fullApp);
      setReqForm({
        hasResume: fullApp.hasResume ?? false,
        hasBirthCert: fullApp.hasBirthCert ?? false,
        hasTOR: fullApp.hasTOR ?? false,
        hasMedCert: fullApp.hasMedCert ?? false,
        requirementsNote: fullApp.requirementsNote ?? '',
        customRequirements: fullApp.customRequirements ?? [],
      });
      setGmForm({ interviewFeedback: fullApp.interviewFeedback ?? '', hiringDecision: fullApp.hiringDecision ?? '' });
    } catch (err) {
      console.warn('[RecruitmentManagement] openView fetch failed, using list data:', err);
      // Still try to merge file data even on network error
      const fileData = loadApplicationFiles(app.id);
      if (fileData) {
        setSelectedApp(prev => prev ? { ...prev, ...fileData } as Application : prev);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  // Tab data
  const tabData = [
    { label: 'All', data: applications },
    { label: 'Submitted', data: applications.filter(a => a.status === 'Submitted') },
    { label: 'Under Review', data: applications.filter(a => a.status === 'Under Review') },
    { label: 'Missing Requirements', data: applications.filter(a => a.status === 'Missing Requirements') },
    { label: 'For Interview', data: applications.filter(a => a.status === 'For Interview') },
    { label: 'Hired', data: applications.filter(a => a.status === 'Hired') },
  ];
  const displayData = tabData[tab]?.data ?? applications;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            Recruitment & Application Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isHR ? 'Review applications, check requirements, and schedule interviews' :
             isGM ? 'Conduct interviews and input final hiring decisions' :
             'View job applications'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh"><span><IconButton onClick={fetchApplications} disabled={loading}><Sync /></IconButton></span></Tooltip>
          {isHR && (
            <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => navigate('/dashboard/recruitment/apply')}>
              New Application
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={fetchApplications}>Retry</Button>}>{error}</Alert>}

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
          <Table sx={{ minWidth: 750 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>App ID</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Applicant Name</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Position</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Date Applied</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Interview Date</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 140 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayData.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>No applications in this category.</TableCell></TableRow>
              ) : displayData.map(app => (
                <TableRow key={app.id} hover>
                  <TableCell><Chip label={app.id} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{app.name}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.position}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.dateApplied}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.interviewDate ? `${app.interviewDate} ${app.interviewTime ?? ''}` : '—'}</TableCell>
                  <TableCell><Chip label={app.status} color={STATUS_COLORS[app.status]} size="small" sx={{ whiteSpace: 'nowrap' }} /></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {/* All actions are icon-only to keep column width consistent */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Chip
                        label="View Profile"
                        size="small"
                        clickable
                        variant="outlined"
                        color="primary"
                        onClick={() => openView(app)}
                      />
                      {(isHR || isGM) && (
                        <Chip
                          label="Delete"
                          size="small"
                          clickable
                          variant="outlined"
                          color="error"
                          onClick={() => handleDelete(app.id)}
                        />
                      )}
                      {isGM && app.status === 'For Interview' && (
                        <Tooltip title="Enter Hiring Decision">
                          <IconButton size="small" color="success" onClick={() => openView(app)}><HowToReg fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* View Application Dialog */}
      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <span>Application — {selectedApp?.id}</span>
            {selectedApp && <Chip label={selectedApp.status} color={STATUS_COLORS[selectedApp.status]} />}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedApp && (
            <Grid container spacing={2} sx={{ pt: 1 }}>

              {/* ── Applicant Profile ── */}
              <Grid size={12}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                  APPLICANT PROFILE
                </Typography>
              </Grid>

              {/* Full name — always shown */}
              <Grid size={12}>
                <TextField
                  fullWidth label="Full Name" disabled size="small"
                  value={[selectedApp.firstName, selectedApp.middleName, selectedApp.lastName, selectedApp.suffix]
                    .filter(Boolean).join(' ') || selectedApp.name || '—'}
                />
              </Grid>

              {/* Contact row */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Email Address" value={selectedApp.email ?? '—'} disabled size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Phone / Mobile" value={selectedApp.phone ?? '—'} disabled size="small" />
              </Grid>

              {/* Address — only if provided */}
              {selectedApp.address && (
                <Grid size={12}>
                  <TextField fullWidth label="Residential Address" value={selectedApp.address} disabled size="small" />
                </Grid>
              )}

              {/* Date of Birth — shown only if provided (useful for age verification) */}
              {selectedApp.birthdate && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="Date of Birth" value={selectedApp.birthdate} disabled size="small" />
                </Grid>
              )}
              {selectedApp.gender && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="Gender" value={selectedApp.gender} disabled size="small" />
                </Grid>
              )}

              {/* ── Position & Qualifications ── */}
              <Grid size={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mt: 1, letterSpacing: 0.5 }}>POSITION & QUALIFICATIONS</Typography></Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Position Applied For" value={selectedApp.position ?? '—'} disabled size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Date Applied" value={selectedApp.dateApplied ?? '—'} disabled size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth label="Years of Experience" disabled size="small"
                  value={selectedApp.experience != null && selectedApp.experience !== '' ? `${selectedApp.experience} year(s)` : '—'}
                />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth label="Highest Educational Attainment" value={selectedApp.education ?? '—'} disabled size="small" />
              </Grid>
              {selectedApp.coverLetter && (
                <Grid size={12}>
                  <TextField fullWidth multiline rows={3} label="Cover Letter / Message" value={selectedApp.coverLetter} disabled size="small" />
                </Grid>
              )}

              {/* ── Submitted Documents ── */}
              <Grid size={12}>
                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    SUBMITTED DOCUMENTS
                  </Typography>
                  {profileLoading && <CircularProgress size={14} />}
                </Box>
              </Grid>

              {/* Resume */}
              {profileLoading ? (
                <Grid size={12}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Loading files…</Typography>
                  </Paper>
                </Grid>
              ) : selectedApp.resumeFileName ? (
                <Grid size={12}>
                  <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 2 }}>
                    <DocIcon name={selectedApp.resumeFileName} type={selectedApp.resumeFileData?.split(';')[0].replace('data:', '')} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedApp.resumeFileName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Resume / CV</Typography>
                    </Box>
                    {selectedApp.resumeFileData && (
                      <>
                        <Tooltip title="Preview document">
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={<Visibility fontSize="small" />}
                            sx={{ fontSize: '0.72rem', px: 1.2, whiteSpace: 'nowrap' }}
                            onClick={() => setPreviewDoc({
                              name: selectedApp.resumeFileName!,
                              data: selectedApp.resumeFileData!,
                              type: selectedApp.resumeFileData!.split(';')[0].replace('data:', ''),
                            })}
                          >
                            Preview
                          </Button>
                        </Tooltip>
                        <Tooltip title="Download Resume">
                          <IconButton size="small" color="primary"
                            onClick={() => downloadFile(selectedApp.resumeFileData!, selectedApp.resumeFileName!)}>
                            <FileDownload fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Paper>
                </Grid>
              ) : (
                <Grid size={12}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50', textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">No resume uploaded.</Typography>
                  </Paper>
                </Grid>
              )}

              {/* Supporting Documents */}
              {(selectedApp.supportingDocumentFiles ?? []).length > 0
                ? (selectedApp.supportingDocumentFiles ?? []).map((doc, i) => (
                    <Grid key={i} size={12}>
                      <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 2 }}>
                        <DocIcon name={doc.name} type={doc.type} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Supporting Document</Typography>
                        </Box>
                        {doc.data && (
                          <>
                            <Tooltip title="Preview document">
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={<Visibility fontSize="small" />}
                                sx={{ fontSize: '0.72rem', px: 1.2, whiteSpace: 'nowrap' }}
                                onClick={() => setPreviewDoc({ name: doc.name, data: doc.data, type: doc.type })}
                              >
                                Preview
                              </Button>
                            </Tooltip>
                            <Tooltip title="Download">
                              <IconButton size="small" color="primary" onClick={() => downloadFile(doc.data, doc.name)}>
                                <FileDownload fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Paper>
                    </Grid>
                  ))
                : (selectedApp.supportingDocuments ?? []).length > 0
                  ? (selectedApp.supportingDocuments ?? []).map((name, i) => (
                      <Grid key={i} size={12}>
                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 2, opacity: 0.7 }}>
                          <DocIcon name={name} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>{name}</Typography>
                            <Typography variant="caption" color="text.secondary">File name only — re-submit to enable download</Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    ))
                  : null
              }

              {/* ── Requirements Checklist — HR ── */}
              {isHR && (
                <>
                  <Grid size={12}>
                    <Divider />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                        REQUIREMENTS CHECKLIST
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditNote />}
                        onClick={() => { setNewReqText(''); setEditReqDialog(true); }}
                        sx={{ ml: 1, fontSize: '0.72rem' }}
                      >
                        Edit
                      </Button>
                    </Box>
                  </Grid>
                  <Grid size={12}>
                    <FormGroup row>
                      {[['hasResume', 'Resume / CV'], ['hasBirthCert', 'Birth Certificate'], ['hasTOR', 'Transcript of Records (TOR)'], ['hasMedCert', 'Medical Certificate']].map(([key, label]) => (
                        <FormControlLabel key={key} control={<Checkbox checked={reqForm[key as keyof typeof reqForm] as boolean} onChange={e => setReqForm({ ...reqForm, [key]: e.target.checked })} />} label={label} />
                      ))}
                      {/* Custom requirements */}
                      {(reqForm.customRequirements ?? []).map((cr, idx) => (
                        <FormControlLabel
                          key={`custom-${idx}`}
                          control={
                            <Checkbox
                              checked={cr.checked}
                              onChange={e => {
                                const updated = reqForm.customRequirements!.map((r, i) => i === idx ? { ...r, checked: e.target.checked } : r);
                                setReqForm({ ...reqForm, customRequirements: updated });
                              }}
                            />
                          }
                          label={cr.label}
                        />
                      ))}
                    </FormGroup>
                    <TextField fullWidth multiline rows={2} label="Requirements Note" value={reqForm.requirementsNote} onChange={e => setReqForm({ ...reqForm, requirementsNote: e.target.value })} sx={{ mt: 1 }} size="small" />
                    <Button variant="outlined" sx={{ mt: 1 }} onClick={() => handleSaveRequirements(selectedApp.id)} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Requirements Checklist'}
                    </Button>
                  </Grid>
                </>
              )}

              {/* ── Interview Details ── */}
              {selectedApp.interviewDate && (
                <>
                  <Grid size={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mt: 1, letterSpacing: 0.5 }}>INTERVIEW DETAILS</Typography></Grid>
                  {[['Interview Date', selectedApp.interviewDate], ['Interview Time', selectedApp.interviewTime ?? '—'], ['Location', selectedApp.interviewLocation ?? '—'], ['Notes', selectedApp.interviewNotes ?? '—'], ['Scheduled By', selectedApp.scheduledBy ?? '—']].map(([k, v]) => (
                    <Grid key={k} size={{ xs: 12, md: 6 }}><TextField fullWidth label={k} value={v} disabled size="small" /></Grid>
                  ))}
                </>
              )}

              {/* ── GM Hiring Decision ── */}
              {isGM && selectedApp.status === 'For Interview' && (
                <>
                  <Grid size={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mt: 1, letterSpacing: 0.5 }}>GM HIRING DECISION</Typography></Grid>
                  <Grid size={12}>
                    <TextField fullWidth multiline rows={3} label="Interview Feedback / Remarks" value={gmForm.interviewFeedback} onChange={e => setGmForm({ ...gmForm, interviewFeedback: e.target.value })} />
                  </Grid>
                </>
              )}

              {/* ── Status Update — HR ── */}
              {isHR && (
                <>
                  <Grid size={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mt: 1, letterSpacing: 0.5 }}>UPDATE STATUS</Typography></Grid>
                  <Grid size={12}>
                    <TextField fullWidth select label="Application Status" value={selectedApp.status}
                      onChange={e => handleUpdateStatus(selectedApp.id, e.target.value)} disabled={saving}
                      InputLabelProps={{ shrink: true }}>
                      {Object.keys(STATUS_COLORS).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
          {isHR && selectedApp && selectedApp.status === 'For Interview' && (
            <Button variant="outlined" color="info" startIcon={<CalendarMonth />}
              onClick={() => { setInterviewDialog(true); setIForm({ interviewDate: selectedApp.interviewDate ?? '', interviewTime: selectedApp.interviewTime ?? '', interviewLocation: selectedApp.interviewLocation ?? 'HR Office, Buenaventura Estate', interviewNotes: selectedApp.interviewNotes ?? '' }); }}>
              Schedule Interview
            </Button>
          )}
          {isGM && selectedApp?.status === 'For Interview' && (
            <>
              <Button variant="outlined" color="error" startIcon={<CancelOutlined />} onClick={() => handleHiringDecision(selectedApp.id, 'Not Qualified')}>Not Qualified</Button>
              <Button variant="contained" color="success" startIcon={<TaskAlt />} onClick={() => handleHiringDecision(selectedApp.id, 'Hired')}>Hire Applicant</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '90vh', display: 'flex', flexDirection: 'column' } }}
      >
        <DialogTitle fontWeight={700} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {previewDoc && <DocIcon name={previewDoc.name} type={previewDoc.type} />}
            <Typography fontWeight={700} noWrap sx={{ flex: 1 }}>{previewDoc?.name}</Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownload />}
            onClick={() => previewDoc && downloadFile(previewDoc.data, previewDoc.name)}
            sx={{ ml: 2, flexShrink: 0 }}
          >
            Download
          </Button>
        </DialogTitle>
        <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 1, display: 'flex', flexDirection: 'column' }}>
          {previewDoc && (() => {
            const isPdf = previewDoc.type === 'application/pdf' || previewDoc.name.toLowerCase().endsWith('.pdf');
            const isImage = previewDoc.type.startsWith('image/') ||
              /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(previewDoc.name);

            if (isPdf) {
              return (
                <iframe
                  src={previewDoc.data}
                  title={previewDoc.name}
                  style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, flex: 1 }}
                />
              );
            }

            if (isImage) {
              return (
                <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f0f0f0', borderRadius: 2 }}>
                  <img
                    src={previewDoc.data}
                    alt={previewDoc.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                  />
                </Box>
              );
            }

            // DOC / DOCX or other unsupported types
            return (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <InsertDriveFile sx={{ fontSize: 72, color: 'text.disabled' }} />
                <Typography variant="h6" color="text.secondary">Preview not available for this file type</Typography>
                <Typography variant="body2" color="text.disabled">({previewDoc.type || 'unknown type'})</Typography>
                <Button
                  variant="contained"
                  startIcon={<FileDownload />}
                  onClick={() => downloadFile(previewDoc.data, previewDoc.name)}
                >
                  Download to view
                </Button>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreviewDoc(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Interview Dialog */}
      <Dialog open={interviewDialog} onClose={() => setInterviewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Event color="info" /> Schedule Interview — {selectedApp?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Interview Date" type="date" value={iForm.interviewDate} onChange={e => setIForm({ ...iForm, interviewDate: e.target.value })} InputLabelProps={{ shrink: true }} required />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Interview Time" type="time" value={iForm.interviewTime} onChange={e => setIForm({ ...iForm, interviewTime: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Interview Location" value={iForm.interviewLocation} onChange={e => setIForm({ ...iForm, interviewLocation: e.target.value })} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline rows={3} label="Interview Notes / Instructions for Applicant" value={iForm.interviewNotes} onChange={e => setIForm({ ...iForm, interviewNotes: e.target.value })} placeholder="e.g. Please bring original documents, 2 IDs..." />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInterviewDialog(false)}>Cancel</Button>
          <Button variant="contained" color="info" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CalendarMonth />}
            onClick={handleScheduleInterview} disabled={saving || !iForm.interviewDate}>
            {saving ? 'Saving…' : 'Confirm Interview Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Requirements Checklist Dialog */}
      <Dialog open={editReqDialog} onClose={() => setEditReqDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditNote color="primary" /> Edit Requirements Checklist
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Standard requirements are fixed. You may add custom requirements below.
          </Typography>

          {/* Standard (fixed) requirements — display only */}
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
            STANDARD REQUIREMENTS
          </Typography>
          <Box sx={{ mb: 2 }}>
            {['Resume / CV', 'Birth Certificate', 'Transcript of Records (TOR)', 'Medical Certificate'].map(label => (
              <Chip key={label} label={label} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
            ))}
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Custom requirements */}
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
            CUSTOM REQUIREMENTS
          </Typography>
          <Box sx={{ mb: 2, mt: 1 }}>
            {(reqForm.customRequirements ?? []).length === 0 ? (
              <Typography variant="caption" color="text.disabled">No custom requirements added yet.</Typography>
            ) : (
              (reqForm.customRequirements ?? []).map((cr, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip label={cr.label} size="small" variant="outlined" color="info" />
                  <Tooltip title="Remove">
                    <IconButton size="small" color="error" onClick={() => {
                      const updated = reqForm.customRequirements!.filter((_, i) => i !== idx);
                      setReqForm({ ...reqForm, customRequirements: updated });
                    }}>
                      <RemoveCircle fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))
            )}
          </Box>

          {/* Add new custom requirement */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              size="small"
              label="New Requirement"
              placeholder="e.g. NBI Clearance, Police Clearance, etc."
              value={newReqText}
              onChange={e => setNewReqText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newReqText.trim()) {
                  setReqForm({ ...reqForm, customRequirements: [...(reqForm.customRequirements ?? []), { label: newReqText.trim(), checked: false }] });
                  setNewReqText('');
                }
              }}
            />
            <Button
              variant="contained"
              startIcon={<AddCircle />}
              disabled={!newReqText.trim()}
              onClick={() => {
                setReqForm({ ...reqForm, customRequirements: [...(reqForm.customRequirements ?? []), { label: newReqText.trim(), checked: false }] });
                setNewReqText('');
              }}
              sx={{ flexShrink: 0 }}
            >
              Add
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditReqDialog(false)}>Close</Button>
          <Button variant="contained" onClick={() => setEditReqDialog(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Application Dialog */}
      <Dialog open={editAppDialog} onClose={() => setEditAppDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditNote color="primary" /> Edit Application — {selectedApp?.id}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={12}>
              <TextField fullWidth label="Full Name" value={editAppForm.name ?? ''} onChange={e => setEditAppForm(f => ({ ...f, name: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Email Address" type="email" value={editAppForm.email ?? ''} onChange={e => setEditAppForm(f => ({ ...f, email: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Phone / Mobile" value={editAppForm.phone ?? ''} onChange={e => setEditAppForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))} inputProps={{ maxLength: 11 }} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Residential Address" value={editAppForm.address ?? ''} onChange={e => setEditAppForm(f => ({ ...f, address: e.target.value }))} multiline rows={2} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Position Applied For" value={editAppForm.position ?? ''} onChange={e => setEditAppForm(f => ({ ...f, position: e.target.value }))} InputLabelProps={{ shrink: true }}>
                <MenuItem key="pos-empty" value="">Select Position…</MenuItem>
                {POSITIONS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Years of Experience" type="number" value={editAppForm.experience ?? ''} onChange={e => setEditAppForm(f => ({ ...f, experience: e.target.value }))} inputProps={{ min: 0 }} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Highest Educational Attainment" value={editAppForm.education ?? ''} onChange={e => setEditAppForm(f => ({ ...f, education: e.target.value }))} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline rows={3} label="Cover Letter / Message" value={editAppForm.coverLetter ?? ''} onChange={e => setEditAppForm(f => ({ ...f, coverLetter: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditAppDialog(false)}>Cancel</Button>
          <Button variant="contained" color="primary" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <EditNote />}
            disabled={saving}
            onClick={async () => {
              if (!selectedApp) return;
              await updateApp(selectedApp.id, editAppForm, '✅ Application updated!');
              setEditAppDialog(false);
            }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

/** Download a base64 data URI as a file */
function downloadFile(dataUri: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function DocIcon({ name, type }: { name: string; type?: string }) {
  if (type === 'application/pdf' || name.endsWith('.pdf'))
    return <PictureAsPdf fontSize="small" sx={{ color: '#E53935' }} />;
  if ((type ?? '').includes('word') || name.endsWith('.doc') || name.endsWith('.docx'))
    return <Article fontSize="small" sx={{ color: '#1565C0' }} />;
  if ((type ?? '').startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name))
    return <ImageIcon fontSize="small" sx={{ color: '#7B1FA2' }} />;
  return <InsertDriveFile fontSize="small" sx={{ color: '#546E7A' }} />;
}