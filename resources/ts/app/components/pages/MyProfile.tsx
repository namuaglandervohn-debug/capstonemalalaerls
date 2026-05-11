import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Divider, CircularProgress,
  Alert, Card, CardContent, Avatar, TextField, Button, IconButton,
  Snackbar, Stack, LinearProgress,
} from '@mui/material';
import {
  AccountCircle, BusinessCenter, Phone, Email, LocationOn, CalendarMonth,
  Assignment, TaskAlt, CancelOutlined, HelpOutline, Badge,
  EditNote, Save, Close, CloudUpload, InsertDriveFile,
  DeleteOutline as DeleteIcon, FileDownload,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

interface Employee {
  id: string; name: string; position: string; department?: string;
  outlet: string; status: string; contact: string; email?: string;
  address?: string; supervisor?: string; dateHired?: string;
  emergencyContact?: string;
}

interface Application {
  id: string; name: string; position: string; dateApplied: string;
  status: string; hasResume?: boolean; hasBirthCert?: boolean;
  hasTOR?: boolean; hasMedCert?: boolean; requirementsNote?: string;
  education?: string; experience?: string;
}

interface DocFile { name: string; size: number; uploadedAt: string; dataUrl?: string; }

const EDITABLE_FIELDS: { key: keyof Employee; label: string; icon: React.ReactNode }[] = [
  { key: 'contact',          label: 'Contact Number',   icon: <Phone fontSize="small" /> },
  { key: 'email',            label: 'Email Address',    icon: <Email fontSize="small" /> },
  { key: 'address',          label: 'Home Address',     icon: <LocationOn fontSize="small" /> },
  { key: 'emergencyContact', label: 'Emergency Contact',icon: <Phone fontSize="small" /> },
];

const READONLY_FIELDS: { key: keyof Employee; label: string; icon: React.ReactNode }[] = [
  { key: 'position',   label: 'Position / Job Title',  icon: <BusinessCenter fontSize="small" /> },
  { key: 'department', label: 'Department',            icon: <Badge fontSize="small" /> },
  { key: 'outlet',     label: 'Outlet / Branch',       icon: <LocationOn fontSize="small" /> },
  { key: 'supervisor', label: 'Direct Supervisor',     icon: <AccountCircle fontSize="small" /> },
  { key: 'dateHired',  label: 'Date Hired',            icon: <CalendarMonth fontSize="small" /> },
];

const DOCS_KEY = 'my_profile_docs';

export default function MyProfile() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Document management
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [empRes, appRes] = await Promise.all([
          fetch(`${API}/employees`, { headers: HEADERS }),
          fetch(`${API}/applications`, { headers: HEADERS }),
        ]);
        const [empData, appData] = await Promise.all([empRes.json(), appRes.json()]);
        const employees: Employee[] = empData.employees ?? [];
        const found = employees.find(
          e => (user.employeeId && e.id === user.employeeId) ||
               e.name === user.name ||
               e.email?.toLowerCase() === user.email?.toLowerCase()
        );
        setEmployee(found ?? null);
        setEditForm(found ?? {});
        const applications: Application[] = appData.applications ?? [];
        const foundApp = applications.find(
          a => a.email?.toLowerCase() === user.email?.toLowerCase() || a.name === user.name
        );
        setApplication(foundApp ?? null);
      } catch (e) {
        console.error('MyProfile load error:', e);
      } finally {
        setLoading(false);
      }
    })();
    // Load local documents
    try {
      const stored = localStorage.getItem(`${DOCS_KEY}_${user.id ?? user.email}`);
      if (stored) setDocs(JSON.parse(stored));
    } catch (_) {}
  }, [user]);

  const saveDocs = (newDocs: DocFile[]) => {
    setDocs(newDocs);
    try {
      localStorage.setItem(`${DOCS_KEY}_${user?.id ?? user?.email}`, JSON.stringify(newDocs));
    } catch (_) {}
  };

  const handleSave = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/employees/${employee.id}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = { ...employee, ...editForm } as Employee;
      setEmployee(updated);
      setEditing(false);
      setSnackbar({ open: true, message: '✅ Profile updated successfully!', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed to save: ${e.message}`, severity: 'error' });
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newDocs: DocFile[] = [...docs];
    for (const file of Array.from(files)) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newDocs.push({
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            dataUrl: e.target?.result as string,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    saveDocs(newDocs);
    setUploading(false);
    setSnackbar({ open: true, message: `✅ ${files.length} document(s) uploaded!`, severity: 'success' });
  };

  const handleDownload = (doc: DocFile) => {
    if (!doc.dataUrl) return;
    const a = document.createElement('a');
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  };

  const handleDeleteDoc = (idx: number) => {
    saveDocs(docs.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 2 }}>
        <CircularProgress /><Typography color="text.secondary">Loading your profile…</Typography>
      </Box>
    );
  }

  const initials = (user?.name ?? 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            My Profile
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your personal information and documents on file — Buenaventura Estate
          </Typography>
        </Box>
        {employee && !editing && (
          <Button variant="outlined" startIcon={<EditNote />} onClick={() => { setEditing(true); setEditForm(employee); }}>
            Edit Profile
          </Button>
        )}
        {editing && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<Close />} onClick={() => { setEditing(false); setEditForm(employee ?? {}); }}>
              Cancel
            </Button>
            <Button variant="contained" color="success" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
              onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </Stack>
        )}
      </Box>

      {/* Profile Header */}
      <Paper sx={{ p: { xs: 2.5, sm: 3.5 }, mb: 3, background: 'linear-gradient(135deg, #1F7A47 0%, #2F8F8B 100%)', color: 'white', borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Avatar sx={{ width: 80, height: 80, bgcolor: 'rgba(255,255,255,0.2)', fontSize: '1.8rem', fontWeight: 'bold', border: '3px solid rgba(255,255,255,0.5)' }}>
            {initials}
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight="bold">{user?.name}</Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>{employee?.position ?? '—'}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Chip label={employee?.outlet ?? 'No outlet'} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.78rem' }} />
              <Chip label={employee?.status ?? 'Active'} size="small"
                sx={{ bgcolor: employee?.status === 'Active' ? 'rgba(76,175,80,0.7)' : 'rgba(255,152,0,0.7)', color: 'white', fontSize: '0.78rem' }} />
              {employee?.id && <Chip label={`ID: ${employee.id}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.78rem' }} />}
            </Box>
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Personal Information */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AccountCircle color="primary" />
              <Typography variant="h6" fontWeight="bold">Personal & Employment Information</Typography>
              {editing && <Chip label="Editing" size="small" color="warning" sx={{ ml: 'auto' }} />}
            </Box>
            <Divider sx={{ mb: 2 }} />

            {!employee ? (
              <Alert severity="info">No employee record found for your account. Please contact HR to link your profile.</Alert>
            ) : (
              <>
                {/* Read-only fields */}
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                  EMPLOYMENT DETAILS (HR managed)
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {READONLY_FIELDS.map(({ key, label, icon }) => (
                    <Grid key={key} size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label={label} value={(employee as any)[key] ?? '—'} disabled size="small"
                        InputProps={{ startAdornment: <Box sx={{ mr: 1, color: 'text.secondary', display: 'flex' }}>{icon}</Box> }} />
                    </Grid>
                  ))}
                </Grid>

                <Divider sx={{ my: 2 }} />

                {/* Editable fields */}
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                  {editing ? 'YOUR INFORMATION (editable)' : 'YOUR INFORMATION'}
                </Typography>
                <Grid container spacing={2}>
                  {EDITABLE_FIELDS.map(({ key, label, icon }) => (
                    <Grid key={key} size={{ xs: 12, sm: 6 }}>
                      <TextField fullWidth label={label} size="small"
                        value={editing ? (editForm as any)[key] ?? '' : (employee as any)[key] ?? '—'}
                        onChange={editing ? e => setEditForm({ ...editForm, [key]: e.target.value }) : undefined}
                        disabled={!editing}
                        InputProps={{ startAdornment: <Box sx={{ mr: 1, color: 'text.secondary', display: 'flex' }}>{icon}</Box> }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </>
            )}
          </Paper>

          {/* Account Info */}
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Badge color="primary" />
              <Typography variant="h6" fontWeight="bold">Account Information</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={1.5}>
              {[
                ['Account ID', user?.id ?? '—'],
                ['Username / Email', user?.email ?? '—'],
                ['Role', user?.role === 'hr' ? 'HR Personnel / Admin' : user?.role === 'employee' ? 'Employee' : user?.role === 'supervisor' ? 'Supervisor' : user?.role === 'gm' ? 'General Manager' : 'Accounting & Finance'],
                ['Linked Employee ID', user?.employeeId ?? '—'],
                ['Assigned Outlet', user?.outlet ?? employee?.outlet ?? '—'],
              ].map(([k, v]) => (
                <Grid key={k} size={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">{k}</Typography>
                    <Typography variant="body2" fontWeight={500}>{v}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Right Panel */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Document Upload */}
          <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CloudUpload color="primary" />
              <Typography variant="h6" fontWeight="bold">My Documents</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {/* Upload Area */}
            <Box
              onClick={() => fileRef.current?.click()}
              sx={{
                border: '2px dashed', borderColor: 'rgba(31,122,71,0.35)', borderRadius: 2,
                p: 2.5, textAlign: 'center', cursor: 'pointer', mb: 2,
                bgcolor: 'rgba(242,247,243,0.8)',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(31,122,71,0.04)' },
                transition: 'all 0.2s',
              }}
            >
              <input ref={fileRef} type="file" multiple hidden
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={e => handleFileUpload(e.target.files)} />
              <CloudUpload sx={{ fontSize: 36, color: 'rgba(31,122,71,0.4)', mb: 0.5 }} />
              <Typography variant="body2" fontWeight={600} color="text.primary">Click to Upload Documents</Typography>
              <Typography variant="caption" color="text.secondary">PDF, DOC, DOCX, JPG, PNG · Max 10 MB each</Typography>
            </Box>
            {uploading && <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />}

            {/* Uploaded files */}
            {docs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 1 }}>
                No documents uploaded yet
              </Typography>
            ) : (
              <Stack spacing={1}>
                {docs.map((doc, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'rgba(31,122,71,0.03)' }}>
                    <InsertDriveFile sx={{ color: 'primary.main', fontSize: 22, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" fontWeight={600} sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatBytes(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString()}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => handleDownload(doc)} title="Download">
                      <FileDownload fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteDoc(i)} title="Remove">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          {/* Application Documents */}
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Assignment color="primary" />
              <Typography variant="h6" fontWeight="bold">Application Documents</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {!application ? (
              <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
                No application record found. Documents will appear here once your application is on file.
              </Alert>
            ) : (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Application: {application.id} — Applied {application.dateApplied}
                </Typography>
                {[
                  { key: 'hasResume',    label: 'Resume / CV' },
                  { key: 'hasBirthCert', label: 'Birth Certificate' },
                  { key: 'hasTOR',       label: 'Transcript of Records (TOR)' },
                  { key: 'hasMedCert',   label: 'Medical Certificate' },
                ].map(({ key, label }) => {
                  const submitted = !!(application as any)[key];
                  return (
                    <Card key={key} variant="outlined"
                      sx={{ mb: 1.5, bgcolor: submitted ? '#f0fdf4' : '#fff5f5', borderColor: submitted ? '#86efac' : '#fca5a5' }}>
                      <CardContent sx={{ py: '10px !important', px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {submitted
                            ? <TaskAlt sx={{ color: 'success.main', fontSize: 20 }} />
                            : <CancelOutlined sx={{ color: 'error.main', fontSize: 20 }} />}
                          <Typography variant="body2" fontWeight={500}>{label}</Typography>
                        </Box>
                        <Chip label={submitted ? 'On File' : 'Missing'} size="small"
                          color={submitted ? 'success' : 'error'} variant="outlined" />
                      </CardContent>
                    </Card>
                  );
                })}
                {application.requirementsNote && (
                  <Alert severity="warning" sx={{ mt: 1 }} icon={<HelpOutline />}>
                    <Typography variant="caption"><strong>HR Note:</strong> {application.requirementsNote}</Typography>
                  </Alert>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}