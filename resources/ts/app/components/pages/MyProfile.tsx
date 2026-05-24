import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Divider, CircularProgress,
  Alert, Card, CardContent, Avatar, TextField, Button, IconButton,
  Snackbar, Stack, LinearProgress, Tooltip,
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
  status: string; email?: string; hasResume?: boolean; hasBirthCert?: boolean;
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

const GREEN_UI = {
  pageBg: 'radial-gradient(circle at top left, rgba(220, 246, 219, 0.95), rgba(248, 252, 245, 0.98) 34%, #f7fbf3 100%)',
  cardBg: 'rgba(255, 255, 255, 0.92)',
  cardBgSoft: 'rgba(245, 252, 241, 0.88)',
  border: 'rgba(139, 184, 144, 0.24)',
  borderStrong: 'rgba(73, 156, 92, 0.32)',
  green: '#3aa865',
  greenDark: '#1f7a46',
  greenSoft: '#e6f8e9',
  text: '#1e2d24',
  muted: '#6c7d70',
  shadow: '0 20px 55px rgba(43, 91, 55, 0.10)',
  shadowSoft: '0 12px 28px rgba(43, 91, 55, 0.08)',
};

const softCardSx = {
  borderRadius: '26px',
  border: `1px solid ${GREEN_UI.border}`,
  background: GREEN_UI.cardBg,
  boxShadow: GREEN_UI.shadow,
};

const innerCardSx = {
  borderRadius: '20px',
  border: `1px solid ${GREEN_UI.border}`,
  background: GREEN_UI.cardBgSoft,
  boxShadow: GREEN_UI.shadowSoft,
};

const pillButtonSx = {
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 800,
  px: 2,
};

const softTextFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '16px',
    backgroundColor: '#fbfef9',
    transition: 'all 180ms ease',
    '& fieldset': { borderColor: GREEN_UI.border },
    '&:hover fieldset': { borderColor: GREEN_UI.borderStrong },
    '&.Mui-focused fieldset': { borderColor: GREEN_UI.green, borderWidth: 1.5 },
    '&.Mui-disabled': { backgroundColor: '#f6fbf4' },
  },
  '& .MuiInputLabel-root': { color: GREEN_UI.muted },
  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: GREEN_UI.text },
  '& .MuiFormHelperText-root': { color: GREEN_UI.muted },
};

const sectionHeaderSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1.5,
  mb: 2,
  flexWrap: 'wrap',
};

const sectionIconSx = {
  width: 42,
  height: 42,
  borderRadius: '16px',
  display: 'grid',
  placeItems: 'center',
  bgcolor: GREEN_UI.greenSoft,
  color: GREEN_UI.greenDark,
  flexShrink: 0,
};

const rowCardSx = {
  borderRadius: '18px',
  border: `1px solid ${GREEN_UI.border}`,
  background: '#fbfff9',
};

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

  const initials = (user?.name ?? 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
  const profileName = user?.name ?? employee?.name ?? 'My Profile';
  const profileStatus = employee?.status ?? 'Active';
  const applicationStatus = application?.status ?? 'No application record';

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100%',
          p: { xs: 1.5, sm: 2.25, md: 3 },
          background: GREEN_UI.pageBg,
          color: GREEN_UI.text,
          borderRadius: { xs: 0, md: '32px' },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            ...softCardSx,
            minHeight: 320,
            display: 'grid',
            placeItems: 'center',
            p: 4,
          }}
        >
          <Stack spacing={2} alignItems="center">
            <CircularProgress sx={{ color: GREEN_UI.green }} />
            <Typography variant="body2" sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>
              Loading your profile…
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        p: { xs: 1.5, sm: 2.25, md: 3 },
        background: GREEN_UI.pageBg,
        color: GREEN_UI.text,
        borderRadius: { xs: 0, md: '32px' },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          ...softCardSx,
          p: { xs: 2, sm: 2.75, md: 3.25 },
          mb: 2.5,
          position: 'relative',
          overflow: 'hidden',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(239,250,235,0.96) 60%, rgba(225,248,224,0.94) 100%)',
          '&:before': {
            content: '""',
            position: 'absolute',
            width: 260,
            height: 260,
            borderRadius: '50%',
            right: -90,
            top: -110,
            background: 'rgba(76, 175, 80, 0.12)',
          },
          '&:after': {
            content: '""',
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: '50%',
            left: { xs: '70%', md: '44%' },
            bottom: -95,
            background: 'rgba(174, 222, 144, 0.18)',
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <Avatar
              sx={{
                width: { xs: 68, sm: 82 },
                height: { xs: 68, sm: 82 },
                bgcolor: GREEN_UI.green,
                color: '#fff',
                fontSize: { xs: '1.45rem', sm: '1.85rem' },
                fontWeight: 900,
                border: '4px solid rgba(255,255,255,0.84)',
                boxShadow: '0 18px 34px rgba(31, 122, 70, 0.20)',
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Chip
                icon={<AccountCircle sx={{ fontSize: '16px !important' }} />}
                label="Employee Self-Service"
                size="small"
                sx={{
                  mb: 1.2,
                  bgcolor: GREEN_UI.greenSoft,
                  color: GREEN_UI.greenDark,
                  fontWeight: 900,
                }}
              />
              <Typography
                variant="h4"
                fontWeight={900}
                sx={{
                  fontSize: { xs: '1.55rem', sm: '2rem', md: '2.35rem' },
                  color: GREEN_UI.text,
                  letterSpacing: '-0.04em',
                  lineHeight: 1.08,
                  mb: 0.75,
                }}
              >
                {profileName}
              </Typography>
              <Typography variant="body2" sx={{ color: GREEN_UI.muted, maxWidth: 680, lineHeight: 1.7 }}>
                Manage your personal information, employment profile, and supporting documents in one clean workspace.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  icon={<BusinessCenter sx={{ fontSize: '16px !important' }} />}
                  label={employee?.position ?? 'No position linked'}
                  size="small"
                  sx={{ bgcolor: '#fbfff9', border: `1px solid ${GREEN_UI.border}`, color: GREEN_UI.text, fontWeight: 800}}
                />
                <Chip
                  icon={<LocationOn sx={{ fontSize: '16px !important' }} />}
                  label={employee?.outlet ?? 'No outlet'}
                  size="small"
                  sx={{ bgcolor: '#fbfff9', border: `1px solid ${GREEN_UI.border}`, color: GREEN_UI.text, fontWeight: 800}}
                />
                <Chip
                  label={profileStatus}
                  size="small"
                  sx={{
                    bgcolor: profileStatus === 'Active' ? '#e5f8e9' : '#fff7e0',
                    color: profileStatus === 'Active' ? '#217a43' : '#9b6b00',
                    border: `1px solid ${profileStatus === 'Active' ? '#a9dfb6' : '#f5d786'}`,
                    fontWeight: 900,
                  }}
                />
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {employee && !editing && (
              <Button
                variant="contained"
                startIcon={<EditNote />}
                onClick={() => { setEditing(true); setEditForm(employee); }}
                sx={{
                  ...pillButtonSx,
                  py: 1.1,
                  bgcolor: GREEN_UI.green,
                  boxShadow: '0 12px 24px rgba(58, 168, 101, 0.25)',
                  '&:hover': { bgcolor: GREEN_UI.greenDark, boxShadow: '0 16px 28px rgba(31, 122, 70, 0.28)' },
                }}
              >
                Edit Profile
              </Button>
            )}
            {editing && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  startIcon={<Close />}
                  onClick={() => { setEditing(false); setEditForm(employee ?? {}); }}
                  sx={{ ...pillButtonSx, borderColor: GREEN_UI.borderStrong, color: GREEN_UI.greenDark, bgcolor: '#fbfff9' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                  onClick={handleSave}
                  disabled={saving}
                  sx={{
                    ...pillButtonSx,
                    bgcolor: GREEN_UI.green,
                    boxShadow: '0 12px 24px rgba(58, 168, 101, 0.25)',
                    '&:hover': { bgcolor: GREEN_UI.greenDark },
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </Stack>
            )}
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {[
          { label: 'Employee ID', value: employee?.id ?? 'Not linked', caption: 'System profile record', icon: <Badge /> },
          { label: 'Application', value: applicationStatus, caption: application ? `Applied ${application.dateApplied}` : 'No application on file', icon: <Assignment /> },
          { label: 'Documents', value: docs.length, caption: 'Uploaded self-service files', icon: <InsertDriveFile /> },
          { label: 'Contact', value: employee?.contact ?? 'Not set', caption: employee?.email ?? 'Update your contact details', icon: <Phone /> },
        ].map(stat => (
          <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              elevation={0}
              sx={{
                ...softCardSx,
                p: 2,
                minHeight: 126,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 180ms ease, box-shadow 180ms ease',
                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 22px 48px rgba(43, 91, 55, 0.13)' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: GREEN_UI.muted, fontWeight: 800 }}>
                    {stat.label}
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={900}
                    sx={{
                      color: GREEN_UI.text,
                      mt: 0.5,
                      letterSpacing: '-0.04em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 210,
                    }}
                  >
                    {stat.value}
                  </Typography>
                </Box>
                <Box sx={sectionIconSx}>{stat.icon}</Box>
              </Box>
              <Typography variant="caption" sx={{ color: GREEN_UI.muted, mt: 1.2 }}>
                {stat.caption}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 }, mb: 2.5 }}>
            <Box sx={sectionHeaderSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={sectionIconSx}><AccountCircle /></Box>
                <Box>
                  <Typography variant="h6" fontWeight={900} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                    Personal & Employment Information
                  </Typography>
                  <Typography variant="body2" sx={{ color: GREEN_UI.muted }}>
                    Review HR-managed details and update your personal contact information.
                  </Typography>
                </Box>
              </Box>
              {editing && (
                <Chip
                  label="Editing"
                  size="small"
                  sx={{ bgcolor: '#fff7e0', color: '#9b6b00', border: '1px solid #f5d786', fontWeight: 900}}
                />
              )}
            </Box>
            <Divider sx={{ mb: 2.5, borderColor: GREEN_UI.border }} />

            {!employee ? (
              <Alert severity="info" sx={{ borderRadius: '18px', border: `1px solid ${GREEN_UI.border}` }}>
                No employee record found for your account. Please contact HR to link your profile.
              </Alert>
            ) : (
              <>
                <Paper elevation={0} sx={{ ...innerCardSx, p: { xs: 1.5, sm: 2 }, mb: 2.25 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: GREEN_UI.greenDark, fontWeight: 900, letterSpacing: '0.08em' }}>
                    EMPLOYMENT DETAILS · HR MANAGED
                  </Typography>
                  <Grid container spacing={1.5}>
                    {READONLY_FIELDS.map(({ key, label, icon }) => (
                      <Grid key={key} size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label={label}
                          value={(employee as any)[key] ?? '—'}
                          disabled
                          size="small"
                          sx={softTextFieldSx}
                          InputProps={{ startAdornment: <Box sx={{ mr: 1, color: GREEN_UI.greenDark, display: 'flex' }}>{icon}</Box> }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>

                <Paper elevation={0} sx={{ ...innerCardSx, p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: GREEN_UI.greenDark, fontWeight: 900, letterSpacing: '0.08em' }}>
                    {editing ? 'YOUR INFORMATION · EDITABLE' : 'YOUR INFORMATION'}
                  </Typography>
                  <Grid container spacing={1.5}>
                    {EDITABLE_FIELDS.map(({ key, label, icon }) => (
                      <Grid key={key} size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label={label}
                          size="small"
                          value={editing ? (editForm as any)[key] ?? '' : (employee as any)[key] ?? '—'}
                          onChange={editing ? e => {
                            const v = key === 'contact'
                              ? e.target.value.replace(/\D/g, '').slice(0, 11)
                              : e.target.value;
                            setEditForm({ ...editForm, [key]: v });
                          } : undefined}
                          disabled={!editing}
                          inputProps={key === 'contact' ? { maxLength: 11, inputMode: 'numeric' } : undefined}
                          placeholder={key === 'contact' && editing ? '09XXXXXXXXX' : undefined}
                          helperText={key === 'contact' && editing ? `${((editForm as any)[key] ?? '').length}/11` : undefined}
                          sx={softTextFieldSx}
                          InputProps={{ startAdornment: <Box sx={{ mr: 1, color: GREEN_UI.greenDark, display: 'flex' }}>{icon}</Box> }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </>
            )}
          </Paper>

          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 } }}>
            <Box sx={sectionHeaderSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={sectionIconSx}><Badge /></Box>
                <Box>
                  <Typography variant="h6" fontWeight={900} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                    Account Information
                  </Typography>
                  <Typography variant="body2" sx={{ color: GREEN_UI.muted }}>
                    Login and access details connected to your system account.
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Divider sx={{ mb: 2, borderColor: GREEN_UI.border }} />
            <Grid container spacing={1.25}>
              {[
                ['Account ID', user?.id ?? '—', <Badge fontSize="small" />],
                ['Username / Email', user?.email ?? '—', <Email fontSize="small" />],
                ['Role', user?.role === 'hr' ? 'HR Personnel / Admin' : user?.role === 'employee' ? 'Employee' : user?.role === 'supervisor' ? 'Supervisor' : user?.role === 'gm' ? 'General Manager' : 'Accounting & Finance', <AccountCircle fontSize="small" />],
                ['Linked Employee ID', user?.employeeId ?? '—', <Badge fontSize="small" />],
                ['Assigned Outlet', user?.outlet ?? employee?.outlet ?? '—', <LocationOn fontSize="small" />],
              ].map(([k, v, icon]) => (
                <Grid key={String(k)} size={12}>
                  <Box
                    sx={{
                      ...rowCardSx,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      gap: 1.5,
                      p: 1.35,
                      flexDirection: { xs: 'column', sm: 'row' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: GREEN_UI.muted }}>
                      {icon}
                      <Typography variant="body2" fontWeight={800}>{k}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={800} sx={{ color: GREEN_UI.text, textAlign: { xs: 'left', sm: 'right' }, wordBreak: 'break-word' }}>
                      {v}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 }, mb: 2.5 }}>
            <Box sx={sectionHeaderSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={sectionIconSx}><CloudUpload /></Box>
                <Box>
                  <Typography variant="h6" fontWeight={900} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                    My Documents
                  </Typography>
                  <Typography variant="body2" sx={{ color: GREEN_UI.muted }}>
                    Upload and manage your personal files.
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Divider sx={{ mb: 2, borderColor: GREEN_UI.border }} />

            <Box
              onClick={() => fileRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: GREEN_UI.borderStrong,
                borderRadius: '20px',
                p: { xs: 2, sm: 2.5 },
                textAlign: 'center',
                cursor: 'pointer',
                mb: 2,
                bgcolor: '#fbfff9',
                transition: 'all 180ms ease',
                '&:hover': {
                  borderColor: GREEN_UI.green,
                  bgcolor: GREEN_UI.greenSoft,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={e => handleFileUpload(e.target.files)}
              />
              <Box
                sx={{
                  width: 54,
                  height: 54,
                  borderRadius: '18px',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: GREEN_UI.greenSoft,
                  color: GREEN_UI.greenDark,
                  mx: 'auto',
                  mb: 1,
                }}
              >
                <CloudUpload />
              </Box>
              <Typography variant="body2" fontWeight={900} sx={{ color: GREEN_UI.text }}>
                Click to Upload Documents
              </Typography>
              <Typography variant="caption" sx={{ color: GREEN_UI.muted }}>
                PDF, DOC, DOCX, JPG, PNG · Max 10 MB each
              </Typography>
            </Box>
            {uploading && <LinearProgress sx={{ mb: 1.5, bgcolor: GREEN_UI.greenSoft }} />}

            {docs.length === 0 ? (
              <Paper elevation={0} sx={{ ...innerCardSx, p: 2, textAlign: 'center' }}>
                <InsertDriveFile sx={{ color: GREEN_UI.muted, mb: 0.5 }} />
                <Typography variant="body2" sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>
                  No documents uploaded yet
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={1}>
                {docs.map((doc, i) => (
                  <Box
                    key={i}
                    sx={{
                      ...rowCardSx,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1.25,
                      transition: 'all 180ms ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: GREEN_UI.shadowSoft },
                    }}
                  >
                    <Box sx={{ ...sectionIconSx, width: 38, height: 38, borderRadius: '14px' }}>
                      <InsertDriveFile sx={{ fontSize: 20 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" fontWeight={900} sx={{ color: GREEN_UI.text, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: GREEN_UI.muted }}>
                        {formatBytes(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleDownload(doc)} sx={{ color: GREEN_UI.greenDark }}>
                        <FileDownload fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <IconButton size="small" color="error" onClick={() => handleDeleteDoc(i)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.5 } }}>
            <Box sx={sectionHeaderSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={sectionIconSx}><Assignment /></Box>
                <Box>
                  <Typography variant="h6" fontWeight={900} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                    Application Documents
                  </Typography>
                  <Typography variant="body2" sx={{ color: GREEN_UI.muted }}>
                    Requirement status from your application record.
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Divider sx={{ mb: 2, borderColor: GREEN_UI.border }} />

            {!application ? (
              <Alert severity="info" sx={{ fontSize: '0.82rem', borderRadius: '18px', border: `1px solid ${GREEN_UI.border}` }}>
                No application record found. Documents will appear here once your application is on file.
              </Alert>
            ) : (
              <Box>
                <Paper elevation={0} sx={{ ...innerCardSx, p: 1.5, mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: GREEN_UI.muted, display: 'block', fontWeight: 800 }}>
                    Application: {application.id}
                  </Typography>
                  <Typography variant="caption" sx={{ color: GREEN_UI.text, display: 'block', fontWeight: 900 }}>
                    Applied {application.dateApplied}
                  </Typography>
                </Paper>
                {[
                  { key: 'hasResume',    label: 'Resume / CV' },
                  { key: 'hasBirthCert', label: 'Birth Certificate' },
                  { key: 'hasTOR',       label: 'Transcript of Records (TOR)' },
                  { key: 'hasMedCert',   label: 'Medical Certificate' },
                ].map(({ key, label }) => {
                  const submitted = !!(application as any)[key];
                  return (
                    <Card
                      key={key}
                      variant="outlined"
                      sx={{
                        mb: 1.25,
                        borderRadius: '18px',
                        bgcolor: submitted ? '#f0fdf4' : '#fff5f5',
                        borderColor: submitted ? '#86efac' : '#fca5a5',
                      }}
                    >
                      <CardContent sx={{ py: '10px !important', px: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          {submitted
                            ? <TaskAlt sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
                            : <CancelOutlined sx={{ color: 'error.main', fontSize: 20, flexShrink: 0 }} />}
                          <Typography variant="body2" fontWeight={800} sx={{ color: GREEN_UI.text }}>{label}</Typography>
                        </Box>
                        <Chip
                          label={submitted ? 'On File' : 'Missing'}
                          size="small"
                          sx={{
                            bgcolor: submitted ? '#e5f8e9' : '#fdeaea',
                            color: submitted ? '#217a43' : '#9c2f2f',
                            border: `1px solid ${submitted ? '#a9dfb6' : '#efb8b8'}`,
                            fontWeight: 900,
                            flexShrink: 0,
                          }}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
                {application.requirementsNote && (
                  <Alert severity="warning" sx={{ mt: 1.25, borderRadius: '18px', border: `1px solid ${GREEN_UI.border}` }} icon={<HelpOutline />}>
                    <Typography variant="caption"><strong>HR Note:</strong> {application.requirementsNote}</Typography>
                  </Alert>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          sx={{ borderRadius: '18px', border: `1px solid ${GREEN_UI.border}` }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
