import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  MenuItem,
  Container,
  Alert,
  Dialog,
  DialogContent,
  DialogActions,
  Grid,
  CircularProgress,
  Stack,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';

import {
  Send,
  TaskAlt,
  ContentCopy,
} from '@mui/icons-material';

import AuthBackground from '../AuthBackground';
import { POSITIONS } from '../../lib/constants';
import FileUploadField from '../FileUploadField';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { saveApplicationFiles } from '../../lib/localDb';
import { supabase } from '../../lib/supabaseClient';

const CIVIL_STATUS = ['Single', 'Married', 'Widowed', 'Separated'];
const GENDER = ['Male', 'Female', 'Prefer not to say'];
const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV'];

const EDUCATIONAL_ATTAINMENT = [
  'Elementary',
  'Junior High School',
  'Senior High School',
  'College / Vocational',
  'Postgraduate',
];

const HEAR_ABOUT_OPTIONS = [
  'Facebook',
  'Referral',
  'Walk-in',
  'Job Posting',
  'Other',
];

const NATIONALITIES = ['Filipino', 'Other'];

const SKILLS = [
  'Communication Skills',
  'Customer Service',
  'Computer Literacy',
  'Leadership',
  'Time Management',
  'Teamwork',
  'Problem-Solving',
  'Cash Handling',
  'Food and Beverage Service',
  'Housekeeping',
  'Administrative Work',
];

const REQUIRED_DOCUMENTS = [
  'Resume/Biodata',
  'Application Letter',
  'Valid ID',
  'Birth Certificate',
  'Transcript of Records/Diploma',
  'Certificate of Employment',
  'Training Certificates',
  'NBI/Police Clearance',
  'Barangay Clearance',
  'Medical Certificate',
];

const steps = [
  'Position',
  'Personal',
  'Education & Work',
  'Skills',
  'References',
  'Documents',
];

const EMPTY = {
  position: '',
  hearAbout: '',
  hearAboutOther: '',

  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  birthdate: '',
  age: '',
  gender: '',
  civilStatus: '',
  nationality: '',
  contactNumber: '',
  email: '',
  currentAddress: '',
  permanentAddress: '',

  emergencyContactName: '',
  emergencyContactRelation: '',
  emergencyContactPhone: '',
  emergencyContactAddress: '',

  education: '',
  schoolName: '',
  courseProgram: '',
  yearGraduated: '',
  honorsAwards: '',

  companyOrganization: '',
  positionHeld: '',
  employmentPeriod: '',
  dutiesResponsibilities: '',
  reasonForLeaving: '',
  totalYearsExperience: '',
  previousSupervisor: '',
  supervisorContact: '',

  skills: [] as string[],
  otherSkills: '',
  certification1: '',
  certification2: '',
  certification3: '',

  referenceName: '',
  referencePosition: '',
  referenceCompany: '',
  referenceContact: '',

  submittedDocuments: [] as string[],
  otherDocument: '',

  applicantSignature: '',
  declarationDate: '',

  birthplace: '',
  height: '',
  weight: '',
  address: '',
  experience: '',
  tin: '',
  sss: '',
  philhealth: '',
  pagibig: '',
};

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
  const [activeStep, setActiveStep] = useState(0);

  const set = (key: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  const setPhone =
    (key: 'contactNumber' | 'emergencyContactPhone') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 11);
      setFormData((prev) => ({ ...prev, [key]: v }));
    };

  const maskGovId = (value: string, segLengths: number[]) => {
    const digits = value
      .replace(/\D/g, '')
      .slice(0, segLengths.reduce((a, b) => a + b, 0));

    let result = '';
    let pos = 0;

    for (let i = 0; i < segLengths.length; i++) {
      if (pos >= digits.length) break;
      result += digits.slice(pos, pos + segLengths[i]);
      pos += segLengths[i];

      if (pos < digits.length && i < segLengths.length - 1) {
        result += '-';
      }
    }

    return result;
  };

  const setGovId =
    (key: 'tin' | 'sss' | 'philhealth' | 'pagibig', segs: number[]) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({
        ...prev,
        [key]: maskGovId(e.target.value, segs),
      }));

  const toggleListItem = (
    key: 'skills' | 'submittedDocuments',
    value: string
  ) => {
    setFormData((prev) => {
      const current = prev[key] as string[];

      return {
        ...prev,
        [key]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  };

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.position || !formData.email) {
      setError('Please fill in all required fields: First Name, Last Name, Email, and Position.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { count } = await supabase
        .from('applicants')
        .select('*', { count: 'exact', head: true });

      const nextNumber = ((count ?? 0) + 1).toString().padStart(4, '0');
      const applicantIdGenerated = `APP-2026-${nextNumber}`;

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

      const coverLetterData = {
        hearAbout: formData.hearAbout,
        hearAboutOther: formData.hearAboutOther,
        age: formData.age,
        nationality: formData.nationality,
        currentAddress: formData.currentAddress,
        permanentAddress: formData.permanentAddress,

        educationBackground: {
          level: formData.education,
          schoolName: formData.schoolName,
          courseProgram: formData.courseProgram,
          yearGraduated: formData.yearGraduated,
          honorsAwards: formData.honorsAwards,
        },

        workExperience: {
          companyOrganization: formData.companyOrganization,
          positionHeld: formData.positionHeld,
          employmentPeriod: formData.employmentPeriod,
          dutiesResponsibilities: formData.dutiesResponsibilities,
          reasonForLeaving: formData.reasonForLeaving,
          totalYearsExperience: formData.totalYearsExperience,
          previousSupervisor: formData.previousSupervisor,
          supervisorContact: formData.supervisorContact,
        },

        skills: formData.skills,
        otherSkills: formData.otherSkills,
        certifications: [
          formData.certification1,
          formData.certification2,
          formData.certification3,
        ],

        characterReference: {
          name: formData.referenceName,
          position: formData.referencePosition,
          company: formData.referenceCompany,
          contact: formData.referenceContact,
        },

        emergencyContact: {
          name: formData.emergencyContactName,
          relation: formData.emergencyContactRelation,
          phone: formData.emergencyContactPhone,
          address: formData.emergencyContactAddress,
        },

        submittedDocuments: formData.submittedDocuments,
        otherDocument: formData.otherDocument,

        applicantSignature: formData.applicantSignature,
        declarationDate: formData.declarationDate,
      };

      const { error } = await supabase
        .from('applicants')
        .insert({
          applicant_id: applicantIdGenerated,

          name: `${formData.firstName} ${formData.middleName} ${formData.lastName}`
            .replace(/\s+/g, ' ')
            .trim(),
          first_name: formData.firstName,
          middle_name: formData.middleName,
          last_name: formData.lastName,
          suffix: formData.suffix,

          gender: formData.gender,
          civil_status: formData.civilStatus,
          birthdate: formData.birthdate || null,
          birthplace: formData.birthplace,
          height: formData.height,
          weight: formData.weight,

          email: formData.email,
          phone_number: formData.contactNumber,
          address: formData.currentAddress,

          position_applied: formData.position,
          education: formData.education,
          experience: formData.totalYearsExperience,
          cover_letter: JSON.stringify(coverLetterData),

          tin: formData.tin,
          sss: formData.sss,
          philhealth: formData.philhealth,
          pagibig: formData.pagibig,

          emergency_contact: `${formData.emergencyContactName} - ${formData.emergencyContactRelation} - ${formData.emergencyContactPhone}`,

          resume_file_name: resumeFiles[0]?.name ?? null,
          resume_file_data: resumeFileData,
          supporting_documents: supportingFiles.map((f) => f.name),
          supporting_document_files: supportingDocumentFiles,

          status: 'Submitted',
        });

      if (error) throw error;

      saveApplicationFiles(applicantIdGenerated, {
        resumeFileName: resumeFiles[0]?.name ?? null,
        resumeFileData,
        supportingDocuments: supportingFiles.map((f) => f.name),
        supportingDocumentFiles,
      });

      await supabase.from('notifications').insert([
        {
          recipient_role: 'hr',
          title: 'New Application Submitted',
          message: `${formData.firstName} ${formData.lastName} submitted a new application for ${formData.position}.`,
          type: 'application',
        },
        {
          recipient_role: 'gm',
          title: 'New Application Submitted',
          message: `${formData.firstName} ${formData.lastName} submitted a new application for ${formData.position}.`,
          type: 'application',
        },
      ]);

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
    setActiveStep(0);
  };

  const stepPaperSx = {
    p: { xs: 2.5, md: 3.5 },
    mb: 3,
    borderRadius: 4,
    border: '1px solid rgba(22,101,52,0.08)',
    minHeight: { xs: 'auto', md: 270 },
  };

  const fieldGrid = { xs: 12, md: 4 };

  return (
    <AuthBackground>
      <Box
        sx={{
          background: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)',
          borderRadius: 4,
          py: { xs: 2, md: 5 },
          px: { xs: 1.5, md: 3 },
        }}
      >
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography variant="h3" fontWeight={900} sx={{ color: '#14532d', lineHeight: 1 }}>
                Buenaventura Estate
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Human Resource Information System — Applicant Portal
              </Typography>
            </Box>

            <Button
              variant="contained"
              onClick={() => navigate('/')}
              sx={{
                borderRadius: 999,
                px: 4,
                py: 1.2,
                fontWeight: 800,
                background: '#166534',
                '&:hover': { background: '#14532d' },
              }}
            >
              Back to Careers
            </Button>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              borderRadius: 6,
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 25px 70px rgba(0,0,0,0.14)',
            }}
          >
            <Box
              sx={{
                p: { xs: 2.5, md: 3.5 },
                borderBottom: '1px solid rgba(22,101,52,0.08)',
              }}
            >
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={3}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', lg: 'center' }}
              >
                <Box>
                  <Typography variant="h4" fontWeight={900} sx={{ color: '#14532d', mb: 1 }}>
                    Job Application Form
                  </Typography>
                  <Typography color="text.secondary">
                    Complete your application details and upload your requirements.
                  </Typography>
                </Box>

                <Stack
                  direction="row"
                  justifyContent="center"
                  alignItems="flex-start"
                  spacing={{ xs: 1.5, md: 2 }}
                  sx={{ width: { xs: '100%', lg: 'auto' }, flexWrap: 'wrap' }}
                >
                  {steps.map((step, index) => (
                    <Stack
                      key={step}
                      alignItems="center"
                      spacing={1}
                      onClick={() => setActiveStep(index)}
                      sx={{ cursor: 'pointer', width: 86, flexShrink: 0 }}
                    >
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          minWidth: 44,
                          minHeight: 44,
                          borderRadius: '50%',
                          bgcolor: activeStep === index ? '#16a34a' : '#f0fdf4',
                          color: activeStep === index ? '#fff' : '#166534',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: '1rem',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        {index + 1}
                      </Box>

                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: '#475569',
                          textAlign: 'center',
                          lineHeight: 1.2,
                        }}
                      >
                        {step}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Box>

            <Box component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2.5, md: 4.5 } }}>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {activeStep === 0 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <Typography variant="h6" fontWeight={900} sx={{ mb: 2, color: '#14532d' }}>
                    I. Position Applied For
                  </Typography>

                  <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField fullWidth required select label="Position Title" value={formData.position} onChange={set('position')} InputLabelProps={{ shrink: true }}>
                        {POSITIONS.map((p) => (
                          <MenuItem key={p} value={p}>{p}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField fullWidth select label="How did you hear about this job opening?" value={formData.hearAbout} onChange={set('hearAbout')} InputLabelProps={{ shrink: true }}>
                        {HEAR_ABOUT_OPTIONS.map((item) => (
                          <MenuItem key={item} value={item}>{item}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>

                    {formData.hearAbout === 'Other' && (
                      <Grid size={{ xs: 12 }}>
                        <TextField fullWidth label="Please specify" value={formData.hearAboutOther} onChange={set('hearAboutOther')} />
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              )}

              {activeStep === 1 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <Typography variant="h6" fontWeight={900} sx={{ mb: 2, color: '#14532d' }}>
                    II. Personal Details
                  </Typography>

                  <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField fullWidth required label="First Name" value={formData.firstName} onChange={set('firstName')} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField fullWidth label="Middle Name" value={formData.middleName} onChange={set('middleName')} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField fullWidth required label="Last Name" value={formData.lastName} onChange={set('lastName')} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField fullWidth select label="Suffix" value={formData.suffix} onChange={set('suffix')} InputLabelProps={{ shrink: true }}>
                        {SUFFIXES.map((s) => (
                          <MenuItem key={s || 'none'} value={s}>{s || 'None'}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>

                    <Grid size={fieldGrid}>
                      <TextField fullWidth type="date" label="Date of Birth" value={formData.birthdate} onChange={set('birthdate')} InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Age" value={formData.age} onChange={set('age')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth select label="Gender" value={formData.gender} onChange={set('gender')} InputLabelProps={{ shrink: true }}>
                        {GENDER.map((g) => (
                          <MenuItem key={g} value={g}>{g}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>

                    <Grid size={fieldGrid}>
                      <TextField fullWidth select label="Civil Status" value={formData.civilStatus} onChange={set('civilStatus')} InputLabelProps={{ shrink: true }}>
                        {CIVIL_STATUS.map((c) => (
                          <MenuItem key={c} value={c}>{c}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth select label="Nationality" value={formData.nationality} onChange={set('nationality')} InputLabelProps={{ shrink: true }}>
                        {NATIONALITIES.map((n) => (
                          <MenuItem key={n} value={n}>{n}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Contact Number" value={formData.contactNumber} onChange={setPhone('contactNumber')} />
                    </Grid>

                    <Grid size={fieldGrid}>
                      <TextField fullWidth required type="email" label="Email Address" value={formData.email} onChange={set('email')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Current Address" value={formData.currentAddress} onChange={set('currentAddress')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Permanent Address" value={formData.permanentAddress} onChange={set('permanentAddress')} />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {activeStep === 2 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <Typography variant="h6" fontWeight={900} sx={{ mb: 2, color: '#14532d' }}>
                    III. Educational Background and IV. Work Experience
                  </Typography>

                  <Grid container spacing={2.5}>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth select label="Educational Level" value={formData.education} onChange={set('education')} InputLabelProps={{ shrink: true }}>
                        {EDUCATIONAL_ATTAINMENT.map((e) => (
                          <MenuItem key={e} value={e}>{e}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Name of School" value={formData.schoolName} onChange={set('schoolName')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Course / Program" value={formData.courseProgram} onChange={set('courseProgram')} />
                    </Grid>

                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Year Graduated" value={formData.yearGraduated} onChange={set('yearGraduated')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Honors / Awards" value={formData.honorsAwards} onChange={set('honorsAwards')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Company / Organization" value={formData.companyOrganization} onChange={set('companyOrganization')} />
                    </Grid>

                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Position Held" value={formData.positionHeld} onChange={set('positionHeld')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Employment Period" value={formData.employmentPeriod} onChange={set('employmentPeriod')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Total Years of Work Experience" value={formData.totalYearsExperience} onChange={set('totalYearsExperience')} />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField fullWidth multiline minRows={2} label="Duties / Responsibilities" value={formData.dutiesResponsibilities} onChange={set('dutiesResponsibilities')} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField fullWidth multiline minRows={2} label="Reason for Leaving" value={formData.reasonForLeaving} onChange={set('reasonForLeaving')} />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField fullWidth label="Previous Supervisor / Manager" value={formData.previousSupervisor} onChange={set('previousSupervisor')} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField fullWidth label="Supervisor Contact Number / Email" value={formData.supervisorContact} onChange={set('supervisorContact')} />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {activeStep === 3 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <Typography variant="h6" fontWeight={900} sx={{ mb: 2, color: '#14532d' }}>
                    V. Skills and Qualifications
                  </Typography>

                  <FormGroup row>
                    {SKILLS.map((skill) => (
                      <FormControlLabel
                        key={skill}
                        control={
                          <Checkbox
                            checked={formData.skills.includes(skill)}
                            onChange={() => toggleListItem('skills', skill)}
                          />
                        }
                        label={skill}
                        sx={{ width: { xs: '100%', md: '32%' }, mr: 0 }}
                      />
                    ))}
                  </FormGroup>

                  <Grid container spacing={2.5} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth label="Other Skills" value={formData.otherSkills} onChange={set('otherSkills')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Certification / Training 1" value={formData.certification1} onChange={set('certification1')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Certification / Training 2" value={formData.certification2} onChange={set('certification2')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Certification / Training 3" value={formData.certification3} onChange={set('certification3')} />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {activeStep === 4 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <Typography variant="h6" fontWeight={900} sx={{ mb: 2, color: '#14532d' }}>
                    VI. Character References and Emergency Contact
                  </Typography>

                  <Grid container spacing={2.5}>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Reference Name" value={formData.referenceName} onChange={set('referenceName')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Position / Relationship" value={formData.referencePosition} onChange={set('referencePosition')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Company / Organization" value={formData.referenceCompany} onChange={set('referenceCompany')} />
                    </Grid>

                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Reference Contact Number" value={formData.referenceContact} onChange={set('referenceContact')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Emergency Contact Person" value={formData.emergencyContactName} onChange={set('emergencyContactName')} />
                    </Grid>
                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Relationship" value={formData.emergencyContactRelation} onChange={set('emergencyContactRelation')} />
                    </Grid>

                    <Grid size={fieldGrid}>
                      <TextField fullWidth label="Emergency Contact Number" value={formData.emergencyContactPhone} onChange={setPhone('emergencyContactPhone')} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 8 }}>
                      <TextField fullWidth label="Emergency Contact Address" value={formData.emergencyContactAddress} onChange={set('emergencyContactAddress')} />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {activeStep === 5 && (
                <Paper elevation={0} sx={stepPaperSx}>
                  <Typography variant="h6" fontWeight={900} sx={{ mb: 2, color: '#14532d' }}>
                    VII. Required Documents and VIII. Applicant Declaration
                  </Typography>

                  <FormGroup row>
                    {REQUIRED_DOCUMENTS.map((doc) => (
                      <FormControlLabel
                        key={doc}
                        control={
                          <Checkbox
                            checked={formData.submittedDocuments.includes(doc)}
                            onChange={() => toggleListItem('submittedDocuments', doc)}
                          />
                        }
                        label={doc}
                        sx={{ width: { xs: '100%', md: '32%' }, mr: 0 }}
                      />
                    ))}
                  </FormGroup>

                  <Grid container spacing={2.5} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12 }}>
                      <TextField fullWidth label="Other Document" value={formData.otherDocument} onChange={set('otherDocument')} />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <FileUploadField label="Resume / Biodata" files={resumeFiles} setFiles={setResumeFiles} accept=".pdf,.doc,.docx" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FileUploadField label="Supporting Documents" files={supportingFiles} setFiles={setSupportingFiles} multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <Alert severity="info">
                        I hereby certify that all information provided in this application form is true, complete, and correct to the best of my knowledge. I understand that any false information or omission may result in the rejection of my application or termination of employment if hired.
                      </Alert>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField fullWidth label="Applicant's Signature / Full Name" value={formData.applicantSignature} onChange={set('applicantSignature')} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField fullWidth type="date" label="Date" value={formData.declarationDate} onChange={set('declarationDate')} InputLabelProps={{ shrink: true }} />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" sx={{ mt: 4 }}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={activeStep === 0 ? () => navigate('/') : handleBack}
                  sx={{
                    borderRadius: 999,
                    px: 5,
                    py: 1.5,
                    fontWeight: 800,
                    borderColor: '#166534',
                    color: '#166534',
                  }}
                >
                  {activeStep === 0 ? 'Cancel' : 'Back'}
                </Button>

                {activeStep < steps.length - 1 ? (
                  <Button
                    type="button"
                    variant="contained"
                    onClick={handleNext}
                    sx={{
                      borderRadius: 999,
                      px: 6,
                      py: 1.5,
                      fontWeight: 900,
                      background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
                      boxShadow: '0 12px 25px rgba(22,101,52,0.25)',
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send />}
                    disabled={submitting}
                    sx={{
                      borderRadius: 999,
                      px: 6,
                      py: 1.5,
                      fontWeight: 900,
                      background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
                      boxShadow: '0 12px 25px rgba(22,101,52,0.25)',
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </Button>
                )}
              </Stack>
            </Box>
          </Paper>
        </Container>
      </Box>

      <Dialog open={successDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogContent sx={{ textAlign: 'center', p: 4 }}>
          <TaskAlt color="success" sx={{ fontSize: 70, mb: 2 }} />

          <Typography variant="h5" fontWeight={900} gutterBottom>
            Application Submitted Successfully
          </Typography>

          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Please save your Applicant ID. You will use this to track your application status.
          </Typography>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: 'rgba(31,122,71,0.08)',
              border: '1px solid rgba(31,122,71,0.18)',
              mb: 2,
            }}
          >
            <Typography variant="h6" fontWeight={900} color="primary">
              {applicantId}
            </Typography>
          </Paper>

          {copied && <Alert severity="success" sx={{ mb: 2 }}>Applicant ID copied!</Alert>}
          {copyFailed && <Alert severity="error" sx={{ mb: 2 }}>Unable to copy Applicant ID.</Alert>}
        </DialogContent>

        <DialogActions sx={{ p: 3, justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<ContentCopy />} onClick={handleCopyId} sx={{ borderRadius: 999 }}>
            Copy Applicant ID
          </Button>

          <Button
            variant="contained"
            onClick={() => navigate('/track')}
            sx={{
              borderRadius: 999,
              background: 'linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)',
            }}
          >
            Track Application
          </Button>

          <Button onClick={handleCloseDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </AuthBackground>
  );
}