import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Box, Typography, Button, Paper, TextField, Divider, Chip, Grid,
  CircularProgress, Alert, Snackbar, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip,
} from '@mui/material';
import { ArrowBackIosNew, EditNote, Save, CancelOutlined, AccountCircle, FileDownload, Visibility, InsertDriveFile, PictureAsPdf, Article, Image as ImageIcon, DeleteOutline } from '@mui/icons-material';
import { API, HEADERS } from '../../lib/api';
import { OUTLETS, POSITIONS, DEPARTMENTS } from '../../lib/constants';
import FileUploadField from '../FileUploadField';

interface DocFile {
  name: string; type: string; data: string;
}

interface Employee {
  id: string; name: string; position: string; outlet: string;
  status: 'Active' | 'On Leave' | 'Resigned'; contact: string;
  email?: string; address?: string; department?: string;
  supervisor?: string; dateHired?: string; emergencyContact?: string;
  createdAt?: string; updatedAt?: string;
  documents?: DocFile[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

export default function EmployeeProfile() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [deleteDialog, setDeleteDialog] = useState(false);
  // New document upload state
  const [newDocFiles, setNewDocFiles] = useState<File[]>([]);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; data: string; type: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/employees/${id}`, { headers: HEADERS });
        const data = await res.json();
        if (res.status === 404) { setError('Employee not found in the database.'); return; }
        if (!res.ok) throw new Error(data.error ?? 'Server error');
        setEmployee(data.employee);
        setEditForm(data.employee);
      } catch (e: any) {
        setError(`Could not load employee: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async () => {
    if (!editForm || !id) return;
    setSaving(true);
    try {
      // Encode any newly uploaded documents and merge with existing
      let updatedDocs = [...(editForm.documents ?? [])];
      if (newDocFiles.length > 0) {
        const encoded = await Promise.all(
          newDocFiles.map(async f => ({ name: f.name, type: f.type, data: await fileToBase64(f) }))
        );
        updatedDocs = [...updatedDocs, ...encoded];
      }

      const res = await fetch(`${API}/employees/${id}`, {
        method: 'PUT', headers: HEADERS,
        body: JSON.stringify({ ...editForm, documents: updatedDocs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setEmployee(data.employee);
      setEditForm(data.employee);
      setEditing(false);
      setNewDocFiles([]);
      setSnackbar({ open: true, message: 'Profile updated successfully!', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Save failed: ${e.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/employees/${id}`, { method: 'DELETE', headers: HEADERS });
      if (!res.ok) throw new Error('Delete failed');
      navigate('/dashboard/employees');
    } catch (e: any) {
      setSnackbar({ open: true, message: `Delete failed: ${e.message}`, severity: 'error' });
    }
    setDeleteDialog(false);
  };

  const handleRemoveDoc = (idx: number) => {
    if (!editForm) return;
    setEditForm({ ...editForm, documents: editForm.documents?.filter((_, i) => i !== idx) });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, gap: 2 }}>
        <CircularProgress /><Typography color="text.secondary">Loading from Supabase…</Typography>
      </Box>
    );
  }

  if (error || !employee || !editForm) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIosNew />} onClick={() => navigate('/dashboard/employees')} sx={{ mb: 2 }}>Back</Button>
        <Alert severity="error">{error ?? 'Employee not found.'}</Alert>
      </Box>
    );
  }

  const field = (key: keyof Employee, label: string, options?: string[]) => {
    if (editing) {
      if (options) {
        return (
          <TextField fullWidth select label={label} value={editForm[key] ?? ''} margin="normal"
            InputLabelProps={{ shrink: true }}
            onChange={e => setEditForm({ ...editForm, [key]: e.target.value as any })}>
            <MenuItem key="__empty__" value="">Select {label}…</MenuItem>
            {options.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
        );
      }
      return (
        <TextField fullWidth label={label} value={editForm[key] ?? ''} margin="normal"
          onChange={e => setEditForm({ ...editForm, [key]: e.target.value as any })} />
      );
    }
    return <TextField fullWidth label={label} value={employee[key] ?? '—'} margin="normal" disabled />;
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIosNew />} onClick={() => navigate('/dashboard/employees')} sx={{ mb: 2 }}>
        Back to Employee Records
      </Button>

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, boxShadow: '0px 4px 8px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AccountCircle sx={{ color: 'white', fontSize: 32 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="bold">{employee.name}</Typography>
              <Typography variant="body2" color="text.secondary">{employee.id} • {employee.position}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={employee.status} color={employee.status === 'Active' ? 'success' : employee.status === 'On Leave' ? 'warning' : 'default'} />
            {editing ? (
              <>
                <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />} onClick={handleSave} disabled={saving} color="success">
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button variant="outlined" startIcon={<CancelOutlined />} onClick={() => { setEditing(false); setEditForm(employee); setNewDocFiles([]); }}>Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="outlined" startIcon={<EditNote />} onClick={() => setEditing(true)}>Edit Profile</Button>
                <Button variant="outlined" color="error" size="small" onClick={() => setDeleteDialog(true)}>Remove</Button>
              </>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth label="Employee ID" value={employee.id} margin="normal" disabled />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>{field('name', 'Full Name')}</Grid>
          <Grid size={{ xs: 12, md: 6 }}>{field('position', 'Position / Job Title', POSITIONS)}</Grid>
          <Grid size={{ xs: 12, md: 6 }}>{field('department', 'Department', DEPARTMENTS)}</Grid>
          <Grid size={{ xs: 12, md: 6 }}>{field('outlet', 'Outlet / Branch', OUTLETS)}</Grid>
          <Grid size={{ xs: 12, md: 6 }}>{field('status', 'Employment Status', ['Active', 'On Leave', 'Resigned'])}</Grid>
          <Grid size={{ xs: 12, md: 6 }}>{field('contact', 'Contact Number')}</Grid>
          <Grid size={{ xs: 12, md: 6 }}>{field('email', 'Email Address')}</Grid>
          <Grid size={{ xs: 12, md: 6 }}>{field('dateHired', 'Date Hired')}</Grid>
          <Grid size={{ xs: 12, md: 6 }}>{field('supervisor', 'Direct Supervisor')}</Grid>
          <Grid size={12}>{field('address', 'Home Address')}</Grid>
          <Grid size={12}>{field('emergencyContact', 'Emergency Contact (Name & Number)')}</Grid>
        </Grid>

        {/* ── Documents Section ── */}
        <Divider sx={{ my: 3 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>Employee Documents</Typography>
        </Box>

        {/* Existing documents */}
        {(editForm.documents ?? []).length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {(editForm.documents ?? []).map((doc, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderRadius: 2 }}>
                <DocIcon name={doc.name} type={doc.type} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Employee Document</Typography>
                </Box>
                {doc.data && (
                  <>
                    <Tooltip title="Preview">
                      <Button size="small" variant="contained" color="primary"
                        startIcon={<Visibility fontSize="small" />}
                        sx={{ fontSize: '0.72rem', px: 1.2, whiteSpace: 'nowrap' }}
                        onClick={() => setPreviewDoc({ name: doc.name, data: doc.data, type: doc.type })}>
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
                {editing && (
                  <Tooltip title="Remove document">
                    <IconButton size="small" color="error" onClick={() => handleRemoveDoc(i)}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Paper>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No documents uploaded yet.</Typography>
        )}

        {/* Upload new documents — only in edit mode */}
        {editing && (
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Upload Additional Documents</Typography>
            <FileUploadField
              label="Upload Documents"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              multiple
              files={newDocFiles}
              onChange={setNewDocFiles}
              helperText="ID cards, certificates, contracts, medical records, etc."
            />
          </Box>
        )}

        {employee.updatedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Last updated: {new Date(employee.updatedAt).toLocaleString()}
          </Typography>
        )}
      </Paper>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onClose={() => setPreviewDoc(null)} maxWidth="lg" fullWidth
        PaperProps={{ sx: { height: '90vh', display: 'flex', flexDirection: 'column' } }}>
        <DialogTitle fontWeight={700} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {previewDoc && <DocIcon name={previewDoc.name} type={previewDoc.type} />}
            <Typography fontWeight={700} noWrap sx={{ flex: 1 }}>{previewDoc?.name}</Typography>
          </Box>
          <Button variant="outlined" size="small" startIcon={<FileDownload />}
            onClick={() => previewDoc && downloadFile(previewDoc.data, previewDoc.name)} sx={{ ml: 2, flexShrink: 0 }}>
            Download
          </Button>
        </DialogTitle>
        <DialogContent sx={{ flex: 1, overflow: 'hidden', p: 1, display: 'flex', flexDirection: 'column' }}>
          {previewDoc && (() => {
            const isPdf = previewDoc.type === 'application/pdf' || previewDoc.name.toLowerCase().endsWith('.pdf');
            const isImage = previewDoc.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(previewDoc.name);
            if (isPdf) return <iframe src={previewDoc.data} title={previewDoc.name} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, flex: 1 }} />;
            if (isImage) return (
              <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f0f0f0', borderRadius: 2 }}>
                <img src={previewDoc.data} alt={previewDoc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }} />
              </Box>
            );
            return (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <InsertDriveFile sx={{ fontSize: 72, color: 'text.disabled' }} />
                <Typography variant="h6" color="text.secondary">Preview not available</Typography>
                <Button variant="contained" startIcon={<FileDownload />} onClick={() => downloadFile(previewDoc.data, previewDoc.name)}>Download to view</Button>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreviewDoc(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle fontWeight={700}>Remove Employee</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to permanently remove <strong>{employee.name}</strong> ({employee.id}) from the database? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Remove Permanently</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
