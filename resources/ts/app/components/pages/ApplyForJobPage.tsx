import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Box, Typography, Paper, TextField, Button, MenuItem, Container,
  Alert, Dialog, DialogContent, DialogActions, Divider, Grid, CircularProgress,
} from '@mui/material';
import { ArrowBackIosNew, Send, TaskAlt, ContentCopy } from '@mui/icons-material';
import AuthBackground from '../AuthBackground';
import { API, HEADERS } from '../../lib/api';
import { POSITIONS, COMPANY } from '../../lib/constants';
import FileUploadField from '../FileUploadField';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { saveApplicationFiles } from '../../lib/localDb';
import { supabase } from "../../lib/supabaseClient";
const CIVIL_STATUS = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled'];
const GENDER = ['Male', 'Female', 'Prefer not to say'];
const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV'];
const EDUCATIONAL_ATTAINMENT = [
  'High School Graduate',
  'Vocational / Technical Course',
  'Some College',
  "Bachelor's Degree",
  "Master's Degree",
  'Doctorate',
  'Others',
];

const EMPTY = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  gender: '',
  civilStatus: '',
  birthdate: '',
  birthplace: '',
  height: '',
  weight: '',
  contactNumber: '',
  email: '',
  address: '',
  position: '',
  education: '',
  experience: '',
  tin: '',
  sss: '',
  philhealth: '',
  pagibig: '',
  emergencyContactName: '',
  emergencyContactRelation: '',
  emergencyContactPhone: '',
};

/** Convert a File to a base64 data URI */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ApplyForJobPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(EMPTY);
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [successDialog, setSuccessDialog] = useState(false);
  const [applicantId, setApplicantId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, [key]: e.target.value }));

  /** Phone: digits only, max 11 chars */
  const setPhone = (key: 'contactNumber' | 'emergencyContactPhone') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 11);
      setFormData(prev => ({ ...prev, [key]: v }));
    };

  /** Government ID masking — format e.g. "3-3-3" → "000-000-000" */
  const maskGovId = (value: string, segLengths: number[]): string => {
    const digits = value.replace(/\D/g, '').slice(0, segLengths.reduce((a, b) => a + b, 0));
    let result = '';
    let pos = 0;
    for (let i = 0; i < segLengths.length; i++) {
      if (pos >= digits.length) break;
      result += digits.slice(pos, pos + segLengths[i]);
      pos += segLengths[i];
      if (pos < digits.length && i < segLengths.length - 1) result += '-';
    }
    return result;
  };
  const setGovId = (key: 'tin' | 'sss' | 'philhealth' | 'pagibig', segs: number[]) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData(prev => ({ ...prev, [key]: maskGovId(e.target.value, segs) }));

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!formData.firstName || !formData.lastName || !formData.position || !formData.email) {
    setError('Please fill in all required fields: First Name, Last Name, Email, and Position.');
    return;
  }

  setSubmitting(true);
  setError('');

  try {
    const applicantIdGenerated = `APP-2026-${Date.now()}`;

    const resumeFileData = resumeFiles[0]
      ? await fileToBase64(resumeFiles[0])
      : null;

    const supportingDocumentFiles = await Promise.all(
      supportingFiles.map(async (f) => ({
        name: f.name,
        type: f.type,
        data: await fileToBase64(f),
      }))
    );

    const { data: applicantData, error } = await supabase
      .from("applicants")
      .insert({
        applicant_id: applicantIdGenerated,
        first_name: formData.firstName,
        middle_name: formData.middleName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: formData.contactNumber,
        address: formData.address,
        position_applied: formData.position,
        gender: formData.gender,
        civil_status: formData.civilStatus,
        education: formData.education,
        experience: formData.experience,
        status: "Submitted",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    saveApplicationFiles(applicantIdGenerated, {
      resumeFileName: resumeFiles[0]?.name ?? null,
      resumeFileData,
      supportingDocuments: supportingFiles.map((f) => f.name),
      supportingDocumentFiles,
    });

    setApplicantId(applicantIdGenerated);
    setSuccessDialog(true);

  } catch (err: any) {
    setError(err.message);
  } finally {
    setSubmitting(false);
  }
};

  const handleCopyId = async () => {
    setCopyFailed(false);
    const ok = await copyToClipboard(applicantId);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setCopyFailed(true);
    }
  };

  const handleCloseDialog = () => {
    setSuccessDialog(false);
    setFormData(EMPTY);
    setResumeFiles([]);
    setSupportingFiles([]);
  };

  return (
    <AuthBackground>
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Button
          startIcon={<ArrowBackIosNew />}
          onClick={() => navigate('/')}
          variant="contained"
          color="inherit"
          sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.92)', color: 'primary.dark', '&:hover': { bgcolor: 'white' } }}
        >
          Back to Login
        </Button>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            borderRadius: 4,
            backdropFilter: 'blur(18px)',
            background: 'rgba(255,255,255,0.94)',
            border: '1px solid rgba(255,255,255,0.5)',
            boxShadow: '0 30px 60px rgba(8,40,20,0.30)',
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
              Join Buenaventura Estate
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Complete the form below — all information will be kept confidential
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {COMPANY.address}
            </Typography>
          </Box>
          <Divider sx={{ mb: 4 }} />

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            {/* ── Section 1: Personal Information ── */}
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2, color: 'primary.dark' }}>
              I. Personal Information
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="First Name" value={formData.firstName} onChange={set('firstName')} required />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Middle Name" value={formData.middleName} onChange={set('middleName')} placeholder="(Optional)" />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField fullWidth label="Last Name" value={formData.lastName} onChange={set('lastName')} required />
              </Grid>
              <Grid size={{ xs: 6, sm: 1 }}>
                <TextField fullWidth select label="Sfx." value={formData.suffix} onChange={set('suffix')} InputLabelProps={{ shrink: true }}>
                  {SUFFIXES.map(s => <MenuItem key={s || 'none'} value={s}>{s || '—'}</MenuItem>)}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth select label="Gender" value={formData.gender} onChange={set('gender')} InputLabelProps={{ shrink: true }}>
                  <MenuItem key="gender-empty" value="">Select…</MenuItem>
                  {GENDER.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth select label="Civil Status" value={formData.civilStatus} onChange={set('civilStatus')} InputLabelProps={{ shrink: true }}>
                  <MenuItem key="civil-empty" value="">Select…</MenuItem>
                  {CIVIL_STATUS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Date of Birth" type="date" value={formData.birthdate} onChange={set('birthdate')} InputLabelProps={{ shrink: true }} />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Place of Birth" value={formData.birthplace} onChange={set('birthplace')} placeholder="City, Province" />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField fullWidth label="Height (cm)" value={formData.height} onChange={set('height')} type="number" inputProps={{ min: 100, max: 250, step: 0.1 }} placeholder="e.g. 165" />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField fullWidth label="Weight (kg)" value={formData.weight} onChange={set('weight')} type="number" inputProps={{ min: 30, max: 200, step: 0.1 }} placeholder="e.g. 60" />
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* ── Section 2: Contact Information ── */}
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2, color: 'primary.dark' }}>
              II. Contact Information
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Mobile / Contact Number" value={formData.contactNumber}
                  onChange={setPhone('contactNumber')} required placeholder="09XXXXXXXXX"
                  inputProps={{ maxLength: 11 }} helperText={`${formData.contactNumber.length}/11 digits`} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Email Address" type="email" value={formData.email} onChange={set('email')} required placeholder="yourname@email.com" />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth label="Residential Address" multiline rows={2} value={formData.address} onChange={set('address')} required placeholder="House No., Street, Barangay, City / Municipality, Province" />
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* ── Section 3: Employment Details ── */}
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2, color: 'primary.dark' }}>
              III. Employment Application
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Position Applied For" value={formData.position} onChange={set('position')} required InputLabelProps={{ shrink: true }}>
                  <MenuItem key="pos-empty" value="">Select Position…</MenuItem>
                  {POSITIONS.map(pos => <MenuItem key={pos} value={pos}>{pos}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Years of Relevant Experience" type="number" value={formData.experience} onChange={set('experience')} inputProps={{ min: 0 }} placeholder="0" />
              </Grid>
              <Grid size={12}>
                <TextField fullWidth select label="Highest Educational Attainment" value={formData.education} onChange={set('education')} InputLabelProps={{ shrink: true }}>
                  <MenuItem key="edu-empty" value="">Select…</MenuItem>
                  {EDUCATIONAL_ATTAINMENT.map(e => <MenuItem key={e} value={e}>{e}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* ── Section 4: Government IDs ── */}
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2, color: 'primary.dark' }}>
              IV. Government IDs{' '}
              <Typography component="span" variant="caption" color="text.secondary">(Optional)</Typography>
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField fullWidth label="TIN No." value={formData.tin}
                  onChange={setGovId('tin', [3, 3, 3])} placeholder="000-000-000"
                  inputProps={{ maxLength: 11 }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField fullWidth label="SSS No." value={formData.sss}
                  onChange={setGovId('sss', [2, 7, 1])} placeholder="00-0000000-0"
                  inputProps={{ maxLength: 12 }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField fullWidth label="PhilHealth No." value={formData.philhealth}
                  onChange={setGovId('philhealth', [2, 9, 1])} placeholder="00-000000000-0"
                  inputProps={{ maxLength: 14 }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField fullWidth label="Pag-IBIG No." value={formData.pagibig}
                  onChange={setGovId('pagibig', [4, 4, 4])} placeholder="0000-0000-0000"
                  inputProps={{ maxLength: 14 }} />
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* ── Section 5: Emergency Contact ── */}
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2, color: 'primary.dark' }}>
              V. Emergency Contact
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField fullWidth label="Contact Person Name" value={formData.emergencyContactName} onChange={set('emergencyContactName')} placeholder="Full name" />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField fullWidth label="Relationship" value={formData.emergencyContactRelation} onChange={set('emergencyContactRelation')} placeholder="e.g. Spouse" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Contact Number" value={formData.emergencyContactPhone}
                  onChange={setPhone('emergencyContactPhone')} placeholder="09XXXXXXXXX"
                  inputProps={{ maxLength: 11 }} helperText={`${formData.emergencyContactPhone.length}/11 digits`} />
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* ── Section 6: Documents ── */}
            <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 2, color: 'primary.dark' }}>
              VI. Documents
            </Typography>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Resume / CV</Typography>
                <FileUploadField
                  label="Upload Resume"
                  accept=".pdf,.doc,.docx"
                  multiple={false}
                  files={resumeFiles}
                  onChange={setResumeFiles}
                  helperText="PDF, DOC, DOCX · Max 10 MB"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Supporting Documents</Typography>
                <FileUploadField
                  label="Upload Supporting Documents"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  multiple
                  files={supportingFiles}
                  onChange={setSupportingFiles}
                  helperText="IDs, Certificates, TOR, Birth Cert, etc."
                />
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mb: 3 }}>
              After submitting, you will receive an <strong>Applicant ID</strong> to track your application status online.
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap', flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
              <Button variant="outlined" onClick={() => navigate('/')} size="large" sx={{ width: { xs: '100%', sm: 'auto' } }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send />}
                size="large"
                disabled={submitting}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {submitting ? 'Submitting…' : 'Submit Application'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Container>

      {/* ── Success Dialog ── */}
      <Dialog open={successDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 5 }}>
          <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'success.light', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', mb: 3 }}>
            <TaskAlt sx={{ fontSize: 50, color: 'success.main' }} />
          </Box>
          <Typography variant="h5" gutterBottom fontWeight="bold" color="success.main">
            Application Submitted!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Your application has been received and saved to our database.
          </Typography>
          <Paper sx={{ p: 3, bgcolor: 'primary.light', color: 'primary.contrastText', borderRadius: 2 }}>
            <Typography variant="body2" gutterBottom>Your Applicant ID is:</Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ my: 2, letterSpacing: 2 }}>{applicantId}</Typography>

            <TextField
              value={applicantId}
              inputProps={{ readOnly: true, style: { textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', letterSpacing: 2 } }}
              size="small"
              fullWidth
              onClick={e => (e.target as HTMLInputElement).select()}
              sx={{
                mb: 1.5,
                '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.2)', color: 'white' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
              }}
              helperText={
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>
                  Click the field above to select all, then Ctrl+C / Cmd+C to copy
                </span>
              }
            />

            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopy />}
              onClick={handleCopyId}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.7)' }}
            >
              {copied ? '✅ Copied!' : 'Copy ID'}
            </Button>

            {copyFailed && (
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'rgba(255,255,255,0.85)' }}>
                Auto-copy unavailable — please select the ID field above and copy manually.
              </Typography>
            )}
            <Typography variant="body2" sx={{ mt: 2 }}>
              Use this ID to track your application status online.
            </Typography>
          </Paper>
          <Alert severity="warning" sx={{ mt: 3, textAlign: 'left' }}>
            <strong>Important:</strong> Save your Applicant ID. You will need it to check your status.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 1 }}>
          <Button variant="outlined" onClick={handleCloseDialog}>Submit Another Application</Button>
          <Button variant="contained" onClick={() => { handleCloseDialog(); navigate('/track'); }}>
            Track My Application
          </Button>
        </DialogActions>
      </Dialog>
    </AuthBackground>
  );
}