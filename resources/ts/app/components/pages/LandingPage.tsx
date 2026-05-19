import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Snackbar, Alert, Divider, Paper, Stack,
  Container,
} from "@mui/material";
import {
  Work, LocationOn, AccessTime, Edit, Campaign, Business,
  Login, Search, AssignmentTurnedIn, TrackChanges,
} from "@mui/icons-material";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  salary_range: string;
  description: string;
  qualifications: string;
  responsibilities: string;
  is_active: boolean;
  created_at?: string;
}

const EMPTY_FORM = {
  title: "",
  department: "",
  location: "",
  employment_type: "Full-Time",
  salary_range: "",
  description: "",
  qualifications: "",
  responsibilities: "",
};

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const fetchJobs = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("job_postings")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setJobs(data ?? []);

    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const filteredJobs = jobs.filter((job) =>
    `${job.title} ${job.department} ${job.location} ${job.employment_type}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingJob(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setOpenDialog(true);
  };

  const handleEdit = (job: JobPosting) => {
    setEditingJob(job);
    setForm({
      title: job.title,
      department: job.department,
      location: job.location,
      employment_type: job.employment_type,
      salary_range: job.salary_range,
      description: job.description,
      qualifications: job.qualifications,
      responsibilities: job.responsibilities,
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (editingJob) {
        const { error } = await supabase
          .from("job_postings")
          .update({ ...form })
          .eq("id", editingJob.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("job_postings")
          .insert({ ...form, is_active: true });

        if (error) throw error;
      }

      setSnackbar({
        open: true,
        message: editingJob ? "Job posting updated successfully!" : "Job posting created successfully!",
        severity: "success",
      });

      setOpenDialog(false);
      resetForm();
      fetchJobs();
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!window.confirm("Deactivate this job posting?")) return;

    const { error } = await supabase
      .from("job_postings")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      setSnackbar({ open: true, message: error.message, severity: "error" });
      return;
    }

    setSnackbar({
      open: true,
      message: "Job posting removed successfully!",
      severity: "success",
    });

    fetchJobs();
  };

  return (
    <Box sx={{ minHeight: "100vh", background: "#f4faf5" }}>
      {/* NAVBAR */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(31,122,71,0.12)",
        }}
      >
        <Container maxWidth="xl">
          <Box
            sx={{
              height: 76,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 3,
                  background: "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 24px rgba(31,122,71,0.30)",
                }}
              >
                <Business sx={{ color: "#fff" }} />
              </Box>

              <Box>
                <Typography fontWeight={900} sx={{ color: "#1F7A47", lineHeight: 1 }}>
                  Buenaventura Estate
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  HRIS • DSS Career Portal
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ display: { xs: "none", md: "flex" } }}>
              <Button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Home</Button>
              <Button onClick={() => document.getElementById("jobs")?.scrollIntoView({ behavior: "smooth" })}>Jobs</Button>
              <Button onClick={() => navigate("/apply")}>Apply</Button>
              <Button onClick={() => navigate("/track")}>Track</Button>
            </Stack>

            <Button
              variant="contained"
              startIcon={<Login />}
              onClick={() => navigate("/login")}
              sx={{
                borderRadius: 999,
                px: 3,
                fontWeight: 800,
                textTransform: "none",
                background: "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
                boxShadow: "0 10px 24px rgba(31,122,71,0.35)",
              }}
            >
              Employee Login
            </Button>
          </Box>
        </Container>
      </Box>

      {/* HERO */}
      <Box
        sx={{
          background:
            "linear-gradient(135deg, rgba(31,122,71,0.96), rgba(63,164,106,0.88))",
          color: "#fff",
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="xl">
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Chip
                icon={<Campaign />}
                label="Now Hiring"
                sx={{
                  mb: 3,
                  bgcolor: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  fontWeight: 800,
                }}
              />

              <Typography
                sx={{
                  fontSize: { xs: "2.6rem", sm: "3.4rem", md: "5rem" },
                  lineHeight: 0.98,
                  fontWeight: 900,
                  mb: 3,
                  maxWidth: 800,
                }}
              >
                Start Your Career at Buenaventura Estate
              </Typography>

              <Typography
                sx={{
                  maxWidth: 680,
                  fontSize: { xs: "1rem", md: "1.2rem" },
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.92)",
                  mb: 4,
                }}
              >
                Discover job opportunities, submit your application online, and track your
                application status through our Human Resource Information System.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  size="large"
                  startIcon={<AssignmentTurnedIn />}
                  onClick={() => navigate("/apply")}
                  sx={{
                    borderRadius: 999,
                    px: 4,
                    py: 1.4,
                    fontWeight: 900,
                    textTransform: "none",
                    color: "#1F7A47",
                    bgcolor: "#ffffff",
                    boxShadow: "0 10px 24px rgba(255,255,255,0.25)",
                    "&:hover": {
                        bgcolor: "#eef7ee",
                        color: "#1F7A47",
                    },
                    }}
                >
                  Apply for Job
                </Button>

                <Button
                  size="large"
                  variant="outlined"
                  startIcon={<TrackChanges />}
                  onClick={() => navigate("/track")}
                  sx={{
                    borderRadius: 999,
                    px: 4,
                    py: 1.4,
                    fontWeight: 900,
                    textTransform: "none",
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.75)",
                    "&:hover": {
                      borderColor: "#fff",
                      background: "rgba(255,255,255,0.12)",
                    },
                  }}
                >
                  Track Application
                </Button>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card
                sx={{
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.95)",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
                }}
              >
                <CardContent sx={{ p: { xs: 3, md: 5 } }}>
                  <Typography variant="h4" fontWeight={900} sx={{ color: "#1F7A47", mb: 3 }}>
                    Why Work With Us?
                  </Typography>

                  {[
                    "Career growth opportunities",
                    "Supportive workplace environment",
                    "Professional development",
                    "Service-oriented organization",
                  ].map((item) => (
                    <Typography key={item} sx={{ mb: 1.7, color: "#1f2937" }}>
                      ✓ {item}
                    </Typography>
                  ))}

                  <Divider sx={{ my: 3 }} />

                  <Typography color="text.secondary">
                    Be part of a growing hospitality and service enterprise in Panabo City.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* SEARCH / QUICK ACTIONS */}
      <Container maxWidth="xl">
        <Paper
          elevation={0}
          sx={{
            mt: -4,
            p: 2,
            borderRadius: 5,
            display: "flex",
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
            alignItems: "center",
            boxShadow: "0 16px 40px rgba(31,122,71,0.18)",
            border: "1px solid rgba(31,122,71,0.12)",
          }}
        >
          <TextField
            fullWidth
            placeholder="Search job title, department, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <Search sx={{ mr: 1, color: "text.secondary" }} /> }}
          />

          <Button
            variant="contained"
            onClick={() => navigate("/apply")}
            sx={{
              borderRadius: 999,
              px: 4,
              py: 1.6,
              fontWeight: 900,
              whiteSpace: "nowrap",
              background: "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
            }}
          >
            Search
          </Button>
        </Paper>
      </Container>

      {/* JOB POSTINGS */}
      <Box id="jobs" sx={{ py: 8 }}>
        <Container maxWidth="xl">
          <Box
            sx={{
              mb: 4,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: "#0f172a" }}>
                Open Positions
              </Typography>
              <Typography color="text.secondary">
                Review current available job opportunities.
              </Typography>
            </Box>

            {(user?.role === "hr" || user?.role === "gm") && (
              <Button
                variant="contained"
                startIcon={<Edit />}
                onClick={handleOpenCreate}
                sx={{
                  borderRadius: 999,
                  px: 3,
                  py: 1.2,
                  fontWeight: 900,
                  background: "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
                }}
              >
                Create Job Posting
              </Button>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : filteredJobs.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 6,
                textAlign: "center",
                borderRadius: 5,
                border: "1px solid rgba(31,122,71,0.12)",
              }}
            >
              <Typography color="text.secondary">
                No active job postings available.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {filteredJobs.map((job) => (
                <Grid key={job.id} size={{ xs: 12, md: 6, lg: 4 }}>
                  <Card
                    sx={{
                      height: "100%",
                      borderRadius: 5,
                      boxShadow: "0 14px 36px rgba(15,23,42,0.08)",
                      border: "1px solid rgba(31,122,71,0.10)",
                    }}
                  >
                    <CardContent sx={{ p: 3.5 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                        <Typography variant="h5" fontWeight={900}>
                          {job.title}
                        </Typography>
                        <Chip label={job.employment_type} size="small" color="success" />
                      </Stack>

                      <Stack spacing={1.2} sx={{ mb: 2 }}>
                        <Typography color="text.secondary"><Work fontSize="small" /> {job.department}</Typography>
                        <Typography color="text.secondary"><LocationOn fontSize="small" /> {job.location}</Typography>
                        <Typography color="text.secondary">
                          <AccessTime fontSize="small" /> {job.salary_range || "Salary Negotiable"}
                        </Typography>
                      </Stack>

                      <Divider sx={{ my: 2 }} />

                      <Typography fontWeight={800} sx={{ mb: 1 }}>
                        Job Description
                      </Typography>
                      <Typography color="text.secondary" sx={{ mb: 3 }}>
                        {job.description || "No description provided."}
                      </Typography>

                      <Button
                        fullWidth
                        variant="contained"
                        onClick={() => navigate("/apply")}
                        sx={{
                          borderRadius: 999,
                          fontWeight: 900,
                          background: "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
                        }}
                      >
                        Apply for this Position
                      </Button>

                      {(user?.role === "hr" || user?.role === "gm") && (
                        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                          <Button fullWidth variant="outlined" onClick={() => handleEdit(job)}>
                            Edit
                          </Button>
                          <Button fullWidth variant="outlined" color="error" onClick={() => handleDeactivate(job.id)}>
                            Remove
                          </Button>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingJob ? "Edit Job Posting" : "Create Job Posting"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Job Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Employment Type" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Salary Range" value={form.salary_range} onChange={(e) => setForm({ ...form, salary_range: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline minRows={4} label="Job Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline minRows={4} label="Qualifications" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline minRows={4} label="Responsibilities" value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : editingJob ? "Save Changes" : "Create Posting"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}