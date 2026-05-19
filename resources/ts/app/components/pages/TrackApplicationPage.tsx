import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Box, Typography, Paper, TextField, Button, Container, Card,
  CardContent, Chip, Alert, Divider, Grid, CircularProgress,
} from '@mui/material';
import { ArrowBackIosNew, ManageSearch, AccountCircle, BusinessCenter, Event, InfoOutlined, Sell, LocationOn, Schedule, Person, Notes } from '@mui/icons-material';
import AuthBackground from '../AuthBackground';
import { supabase } from '../../lib/supabaseClient';
interface ApplicationStatus {
  id: string; name: string; position: string; email: string; phone: string;
  status: 'Submitted' | 'Under Review' | 'Missing Requirements' | 'For Interview' | 'Hired' | 'Not Qualified';
  dateApplied: string;
  // Interview fields set by HR
  interviewDate?: string;
  interviewTime?: string;
  interviewLocation?: string;
  interviewNotes?: string;
  scheduledBy?: string;
  notes?: string;
}

const STATUS_COLORS: Record<string, any> = {
  'Submitted': 'default', 'Under Review': 'primary', 'Missing Requirements': 'warning',
  'For Interview': 'info', 'Hired': 'success', 'Not Qualified': 'error',
};

const STATUS_MESSAGES: Record<string, string> = {
  'Submitted': 'Your application has been received and is in the queue for review.',
  'Under Review': 'Your application is currently being reviewed by our HR team.',
  'Missing Requirements': 'Additional documents are required to complete your application. Please contact HR.',
  'For Interview': 'Congratulations! You have been selected for an interview. Please see your schedule below.',
  'Hired': 'Congratulations! You have been selected to join Buenaventura Estate.',
  'Not Qualified': 'Thank you for your interest. Unfortunately, you do not meet the requirements for this position.',
};

const formatTime = (time?: string) => {
  if (!time) return "—";

  const [hourStr, minute] = time.split(":");

  let hour = parseInt(hourStr);

  const ampm = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  hour = hour ? hour : 12;

  return `${hour}:${minute} ${ampm}`;
};
export default function TrackApplicationPage() {
  const navigate = useNavigate();
  const [applicantId, setApplicantId] = useState('');
  const [applicationData, setApplicationData] = useState<ApplicationStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setApplicationData(null);
  setLoading(true);

  try {
    const id = applicantId.trim().toUpperCase();

    const { data, error } = await supabase
      .from("applicants")
      .select("*")
      .eq("applicant_id", id)
      .single();

    if (error || !data) {
      setError("Applicant ID not found. Please check your ID and try again.");
      return;
    }

    setApplicationData({
      id: data.applicant_id,
      name: `${data.first_name ?? ""} ${data.middle_name ?? ""} ${data.last_name ?? ""}`.replace(/\s+/g, " ").trim(),
      position: data.position_applied ?? "",
      email: data.email ?? "",
      phone: data.phone_number ?? "",
      status: data.status ?? "Submitted",
      dateApplied: data.created_at
        ? new Date(data.created_at).toLocaleDateString()
        : "",
      interviewDate: data.interview_date ?? "",
      interviewTime: data.interview_time ?? "",
      interviewLocation: data.interview_location ?? "",
      interviewNotes: data.interview_notes ?? "",
      scheduledBy: data.scheduled_by ?? "",
      notes: data.notes ?? "",
    });
  } catch (e: any) {
    setError(`Could not retrieve application: ${e.message}`);
  } finally {
    setLoading(false);
  }
};

  return (
    <AuthBackground>
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Button startIcon={<ArrowBackIosNew />} onClick={() => navigate('/')} variant="contained" color="inherit"
          sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.92)', color: 'primary.dark', '&:hover': { bgcolor: 'white' } }}>
          Back
        </Button>

        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4, md: 5 }, borderRadius: 4, backdropFilter: 'blur(18px)', background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 30px 60px rgba(8,40,20,0.30)' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">Track Your Application</Typography>
            <Typography variant="body1" color="text.secondary">Enter your Applicant ID to check your application status</Typography>
          </Box>
          <Divider sx={{ mb: 4 }} />

          <form onSubmit={handleTrack}>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField fullWidth label="Enter Applicant ID" value={applicantId}
                  onChange={(e) => setApplicantId(e.target.value)} placeholder="APP-2026-0001"
                  required helperText="Format: APP-YYYY-XXXX (provided after submission)"
                  InputProps={{ startAdornment: <Sell sx={{ mr: 1, color: 'text.secondary' }} /> }} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Button type="submit" fullWidth variant="contained" size="large"
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ManageSearch />}
                  disabled={loading} sx={{ height: '56px' }}>
                  {loading ? 'Searching…' : 'Track Status'}
                </Button>
              </Grid>
            </Grid>
          </form>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          {applicationData && (
            <Card elevation={3} sx={{ mt: 4, borderTop: 4, borderColor: 'primary.main' }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                  <Typography variant="h5" fontWeight="bold" color="primary">Application Status</Typography>
                  <Chip label={applicationData.id} variant="outlined" color="primary" icon={<Sell />} />
                </Box>
                <Divider sx={{ my: 2 }} />

                {/* Status Banner */}
                <Alert
                  severity={
                    applicationData.status === 'Hired' ? 'success'
                    : applicationData.status === 'For Interview' ? 'info'
                    : applicationData.status === 'Not Qualified' ? 'error'
                    : applicationData.status === 'Missing Requirements' ? 'warning'
                    : 'info'
                  }
                  sx={{ mb: 3 }}
                >
                  <Typography variant="body2" fontWeight="bold">{applicationData.status}</Typography>
                  <Typography variant="body2">{STATUS_MESSAGES[applicationData.status]}</Typography>
                </Alert>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <AccountCircle sx={{ mr: 1.5, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Applicant Name</Typography>
                        <Typography variant="body1" fontWeight="bold">{applicationData.name}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <BusinessCenter sx={{ mr: 1.5, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Position Applied</Typography>
                        <Typography variant="body1" fontWeight="bold">{applicationData.position}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Event sx={{ mr: 1.5, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Date Submitted</Typography>
                        <Typography variant="body1" fontWeight="bold">{applicationData.dateApplied}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <InfoOutlined sx={{ mr: 1.5, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">Current Status</Typography>
                        <Chip label={applicationData.status} color={STATUS_COLORS[applicationData.status]} size="small" sx={{ mt: 0.5 }} />
                      </Box>
                    </Box>
                  </Grid>

                  {/* ── Interview Schedule — shown only when status is "For Interview" ── */}
                  {applicationData.status === 'For Interview' && applicationData.interviewDate && (
                    <Grid size={12}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          borderColor: 'info.main',
                          borderWidth: 2,
                          bgcolor: 'rgba(33,150,243,0.04)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Event color="info" />
                          <Typography variant="subtitle1" fontWeight={700} color="info.main">
                            Your Interview Schedule
                          </Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                              <Event sx={{ color: 'info.main', mt: 0.25 }} fontSize="small" />
                              <Box>
                                <Typography variant="caption" color="text.secondary" display="block">Interview Date</Typography>
                                <Typography variant="body1" fontWeight={600}>{applicationData.interviewDate}</Typography>
                              </Box>
                            </Box>
                          </Grid>
                          {applicationData.interviewTime && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                <Schedule sx={{ color: 'info.main', mt: 0.25 }} fontSize="small" />
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">Interview Time</Typography>
                                  <Typography variant="body1" fontWeight={600}>{formatTime(applicationData.interviewTime)}</Typography>
                                </Box>
                              </Box>
                            </Grid>
                          )}
                          {applicationData.interviewLocation && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                <LocationOn sx={{ color: 'info.main', mt: 0.25 }} fontSize="small" />
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">Location</Typography>
                                  <Typography variant="body1" fontWeight={600}>{applicationData.interviewLocation}</Typography>
                                </Box>
                              </Box>
                            </Grid>
                          )}
                          {applicationData.scheduledBy && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                <Person sx={{ color: 'info.main', mt: 0.25 }} fontSize="small" />
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">Scheduled By</Typography>
                                  <Typography variant="body1" fontWeight={600}>{applicationData.scheduledBy}</Typography>
                                </Box>
                              </Box>
                            </Grid>
                          )}
                          {applicationData.interviewNotes && (
                            <Grid size={12}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                <Notes sx={{ color: 'info.main', mt: 0.25 }} fontSize="small" />
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">Notes / Instructions</Typography>
                                  <Typography variant="body2">{applicationData.interviewNotes}</Typography>
                                </Box>
                              </Box>
                            </Grid>
                          )}
                        </Grid>
                      </Paper>
                    </Grid>
                  )}

                  {/* Fallback when status is For Interview but no date yet */}
                  {applicationData.status === 'For Interview' && !applicationData.interviewDate && (
                    <Grid size={12}>
                      <Alert severity="info" icon={<Event />}>
                        <Typography variant="body2" fontWeight="bold">Interview Schedule Pending</Typography>
                        <Typography variant="body2">Your interview schedule has not been set yet. Please check back later or contact HR.</Typography>
                      </Alert>
                    </Grid>
                  )}

                  {applicationData.notes && (
                    <Grid size={12}>
                      <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>Additional Notes:</Typography>
                        <Typography variant="body1">{applicationData.notes}</Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          )}

          <Box sx={{ mt: 4, p: 3, bgcolor: '#f5f5f5', borderRadius: 2 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>How to get your Applicant ID?</Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              Your Applicant ID (format: APP-2026-XXXX) is given to you when you submit an application through the <strong>Apply for a Job</strong> page. Make sure to save it.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </AuthBackground>
  );
}
