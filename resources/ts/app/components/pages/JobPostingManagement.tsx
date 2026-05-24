import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  AddCircleOutline,
  AccessTime,
  Delete,
  Edit,
  LocationOn,
  Work,
} from "@mui/icons-material";
import { supabase } from "../../lib/supabaseClient";

interface JobPosting {
  id: string;
  title: string | null;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  salary_range?: string | null;
  description?: string | null;
  qualifications?: string | null;
  responsibilities?: string | null;
  is_active: boolean;
  created_at?: string | null;
}

type JobForm = {
  title: string;
  department: string;
  location: string;
  employment_type: string;
  salary_range: string;
  description: string;
  qualifications: string;
  responsibilities: string;
};

type SnackbarState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info" | "warning";
};

const EMPTY_FORM: JobForm = {
  title: "",
  department: "",
  location: "",
  employment_type: "Full-Time",
  salary_range: "",
  description: "",
  qualifications: "",
  responsibilities: "",
};


const JOB_TITLES = [
  "General Manager",
  "Assistant General Manager",
  "Operations Manager",
  "Front Office & Sales Supervisor",
  "Chef/Cook",
  "Commis Chef",
  "Dispatcher/Steward",
  "Public/Room Attendant",
  "Pool Attendant",
  "Laundry Attendant",
  "Gardener",
  "HR and Admin Manager",
  "Driver/Liaison",
  "Purchaser",
  "Stockman",
  "Accounting and Finance Manager",
  "Accounting Officer",
  "Finance Officer",
  "Compliance Officer",
  "Service Crew",
  "Sales Associate",
  "Cashier",
  "HR Assistant",
  "Security Guard",
  "Maintenance Staff",
];

const DEPARTMENTS = [
  "Management",
  "Operations",
  "Human Resource and Administration",
  "Accounting and Finance",
  "Restaurant",
  "Resort",
  "Café",
];

const EMPLOYMENT_TYPES = ["Full-Time", "Part-Time", "Contractual", "Internship"];

const REQUIRED_FIELDS: Array<keyof JobForm> = [
  "title",
  "department",
  "location",
  "employment_type",
  "salary_range",
  "description",
];

const FIELD_LABELS: Record<keyof JobForm, string> = {
  title: "Job Title",
  department: "Department",
  location: "Location",
  employment_type: "Employment Type",
  salary_range: "Salary Range / Daily Rate",
  description: "Description",
  qualifications: "Qualifications",
  responsibilities: "Responsibilities",
};

function normalizeForm(form: JobForm) {
  return {
    title: form.title.trim(),
    department: form.department.trim(),
    location: form.location.trim(),
    employment_type: form.employment_type.trim(),
    salary_range: form.salary_range.trim() || null,
    description: form.description.trim(),
    qualifications: form.qualifications.trim() || null,
    responsibilities: form.responsibilities.trim() || null,
  };
}

function getMissingRequiredFields(form: JobForm) {
  return REQUIRED_FIELDS.filter((field) => !form[field].trim());
}

function formatSalary(salary?: string | null) {
  if (!salary?.trim()) return "Salary not set";
  return salary.includes("₱") ? salary : `₱ ${salary}`;
}

const cardGridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    md: "repeat(2, minmax(0, 1fr))",
    lg: "repeat(3, minmax(0, 1fr))",
  },
  gap: { xs: 2, md: 3 },
  alignItems: "stretch",
};

const dialogGridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    md: "repeat(2, minmax(0, 1fr))",
  },
  gap: { xs: 2, sm: 2.5 },
  alignItems: "start",
};

const fullRowSx = {
  gridColumn: { xs: "1", md: "1 / -1" },
};

const textFieldSx = {
  minWidth: 0,
  "& .MuiOutlinedInput-root": {
    borderRadius: 2,
  },
};

export default function JobPostingManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosting | null>(null);
  const [form, setForm] = useState<JobForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: "",
    severity: "success",
  });

  const missingFields = useMemo(() => getMissingRequiredFields(form), [form]);

  const showSnackbar = useCallback(
    (message: string, severity: SnackbarState["severity"] = "success") => {
      setSnackbar({ open: true, message, severity });
    },
    []
  );

  const fetchJobs = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setJobs((data as JobPosting[]) || []);
    } catch (error: any) {
      showSnackbar(error?.message || "Failed to load job postings.", "error");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSubmitted(false);
    setOpen(true);
  };

  const handleCloseDialog = () => {
    if (saving) return;
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setSubmitted(false);
  };

  const handleEdit = (job: JobPosting) => {
    setEditing(job);
    setSubmitted(false);

    setForm({
      title: job.title ?? "",
      department: job.department ?? "",
      location: job.location ?? "",
      employment_type: job.employment_type ?? "Full-Time",
      salary_range: job.salary_range ?? "",
      description: job.description ?? "",
      qualifications: job.qualifications ?? "",
      responsibilities: job.responsibilities ?? "",
    });

    setOpen(true);
  };

  const updateFormField = (field: keyof JobForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const hasFieldError = (field: keyof JobForm) =>
    submitted && REQUIRED_FIELDS.includes(field) && !form[field].trim();

  const handleSave = async () => {
    setSubmitted(true);

    const missing = getMissingRequiredFields(form);
    if (missing.length > 0) {
      showSnackbar(
        `Please complete: ${missing.map((field) => FIELD_LABELS[field]).join(", ")}.`,
        "warning"
      );
      return;
    }

    setSaving(true);

    try {
      const payload = normalizeForm(form);

      if (editing) {
        const { data, error } = await supabase
          .from("job_postings")
          .update(payload)
          .eq("id", editing.id)
          .select("*")
          .single();

        if (error) throw error;

        setJobs((prev) =>
          prev.map((job) => (job.id === editing.id ? (data as JobPosting) : job))
        );

        showSnackbar("Job posting updated successfully.");
      } else {
        const { data, error } = await supabase
          .from("job_postings")
          .insert({
            ...payload,
            is_active: true,
          })
          .select("*")
          .single();

        if (error) throw error;

        setJobs((prev) => [data as JobPosting, ...prev]);
        showSnackbar("Job posting created successfully.");
      }

      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setSubmitted(false);
    } catch (error: any) {
      showSnackbar(error?.message || "Failed to save job posting.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Permanently delete this job posting? This cannot be undone.")) {
      return;
    }

    setBusyJobId(id);

    try {
      const { error } = await supabase.from("job_postings").delete().eq("id", id);

      if (error) throw error;

      setJobs((prev) => prev.filter((job) => job.id !== id));
      showSnackbar("Job posting deleted permanently.");
    } catch (error: any) {
      showSnackbar(error?.message || "Failed to delete job posting.", "error");
    } finally {
      setBusyJobId(null);
    }
  };

  const handleToggleActive = async (job: JobPosting) => {
    const newStatus = !job.is_active;
    setBusyJobId(job.id);

    try {
      const { data, error } = await supabase
        .from("job_postings")
        .update({ is_active: newStatus })
        .eq("id", job.id)
        .select("*")
        .single();

      if (error) throw error;

      setJobs((prev) =>
        prev.map((item) => (item.id === job.id ? (data as JobPosting) : item))
      );

      showSnackbar(`Job posting ${newStatus ? "activated" : "deactivated"} successfully.`);
    } catch (error: any) {
      showSnackbar(error?.message || "Failed to update job posting status.", "error");
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<AddCircleOutline />}
          onClick={handleOpenCreate}
        >
          Create Job Posting
        </Button>
      </Box>
      
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "stretch", md: "center" },
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
        }}
      >
      </Box>

      {loading ? (
        <Box sx={cardGridSx}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} sx={{ borderRadius: 4, height: "100%" }}>
              <CardContent sx={{ p: { xs: 2.2, sm: 3 } }}>
                <Stack spacing={1.5}>
                  <Skeleton variant="text" width="75%" height={36} />
                  <Skeleton variant="rounded" width={90} height={26} />
                  <Skeleton variant="text" width="90%" />
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="70%" />
                  <Divider sx={{ my: 1 }} />
                  <Skeleton variant="text" width="40%" />
                  <Skeleton variant="text" width="100%" />
                  <Skeleton variant="text" width="95%" />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : jobs.length === 0 ? (
        <Card
          sx={{
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: "center" }}>
            <Typography variant="h6" fontWeight={800}>
              No job postings found
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Create your first job posting to display available career opportunities.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={cardGridSx}>
          {jobs.map((job) => {
            const isBusy = busyJobId === job.id;

            return (
              
              <Card
                key={job.id}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                }}
              >
                
                <CardContent
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    p: { xs: 2.2, sm: 3 },
                    minWidth: 0,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={1}
                    sx={{ mb: 2 }}
                  >
                    <Typography
                      variant="h5"
                      fontWeight={800}
                      sx={{
                        fontSize: { xs: "1.2rem", sm: "1.5rem" },
                        wordBreak: "break-word",
                      }}
                    >
                      {job.title || "Untitled Job"}
                    </Typography>

                    <Chip
                      label={job.is_active ? "Active" : "Inactive"}
                      color={job.is_active ? "success" : "default"}
                      size="small"
                      sx={{ fontWeight: 700 }}
                    />
                  </Stack>

                  <Stack spacing={1.2} sx={{ mb: 2 }}>
                    <Typography
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        color: "text.secondary",
                        wordBreak: "break-word",
                      }}
                    >
                      <Work fontSize="small" />
                      <Box component="span">
                        <strong>Department:</strong> {job.department || "Not specified"}
                      </Box>
                    </Typography>

                    <Typography
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        color: "text.secondary",
                        wordBreak: "break-word",
                      }}
                    >
                      <LocationOn fontSize="small" />
                      <Box component="span">
                        <strong>Location:</strong> {job.location || "Not specified"}
                      </Box>
                    </Typography>

                    <Typography
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        color: "#166534",
                        fontWeight: 700,
                        wordBreak: "break-word",
                      }}
                    >
                      <Box component="span">
                        <strong>Salary Range / Daily Rate:</strong> {formatSalary(job.salary_range)}
                      </Box>
                    </Typography>
                  </Stack>

                  {job.employment_type && (
                    <Box sx={{ mb: 2 }}>
                      <Chip label={job.employment_type} size="small" variant="outlined" />
                    </Box>
                  )}

                  <Divider sx={{ my: 2 }} />

                  <Typography fontWeight={800} sx={{ mb: 1 }}>
                    Job Description
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{
                      mb: 3,
                      flexGrow: 1,
                      wordBreak: "break-word",
                      lineHeight: 1.7,
                    }}
                  >
                    {job.description || "No description provided."}
                  </Typography>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ mt: "auto", pt: 1 }}
                  >
                    <Button
                      fullWidth={isMobile}
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => handleEdit(job)}
                      disabled={isBusy}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Edit
                    </Button>

                    <Button
                      fullWidth={isMobile}
                      color="error"
                      variant="outlined"
                      startIcon={<Delete />}
                      onClick={() => handleDelete(job.id)}
                      disabled={isBusy}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      Delete
                    </Button>

                    <Button
                      fullWidth={isMobile}
                      color={job.is_active ? "warning" : "success"}
                      variant="outlined"
                      onClick={() => handleToggleActive(job)}
                      disabled={isBusy}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      {isBusy ? "Updating..." : job.is_active ? "Set Inactive" : "Set Active"}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <Dialog
        open={open}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 3 },
            width: { xs: "100%", sm: "min(920px, calc(100% - 48px))" },
            m: { xs: 0, sm: 2 },
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle sx={{ px: { xs: 2.5, sm: 3 }, py: 2.2, fontWeight: 800 }}>
          {editing ? "Edit Job Posting" : "Create Job Posting"}
        </DialogTitle>

        <DialogContent dividers sx={{ px: { xs: 2.5, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
          <Box sx={dialogGridSx}>
            <TextField
              fullWidth
              required
              select
              label="Job Title"
              value={form.title}
              error={hasFieldError("title")}
              helperText={hasFieldError("title") ? "Job title is required." : " "}
              onChange={(e) => updateFormField("title", e.target.value)}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="">Select Job Title...</MenuItem>
              {JOB_TITLES.map((title) => (
                <MenuItem key={title} value={title}>
                  {title}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              required
              select
              label="Department"
              value={form.department}
              error={hasFieldError("department")}
              helperText={hasFieldError("department") ? "Department is required." : " "}
              onChange={(e) => updateFormField("department", e.target.value)}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="">Select Department...</MenuItem>
              {DEPARTMENTS.map((dept) => (
                <MenuItem key={dept} value={dept}>
                  {dept}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              required
              label="Location"
              value={form.location}
              error={hasFieldError("location")}
              helperText={hasFieldError("location") ? "Location is required." : " "}
              onChange={(e) => updateFormField("location", e.target.value)}
            />

            <TextField
              fullWidth
              required
              select
              label="Employment Type"
              value={form.employment_type}
              error={hasFieldError("employment_type")}
              helperText={
                hasFieldError("employment_type") ? "Employment type is required." : " "
              }
              onChange={(e) => updateFormField("employment_type", e.target.value)}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="">Select Employment Type...</MenuItem>
              {EMPLOYMENT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              required
              label="Salary Range / Daily Rate"
              value={form.salary_range}
              error={hasFieldError("salary_range")}
              helperText={hasFieldError("salary_range") ? "Salary rate is required for payroll computation." : "Example: 510 for Service Crew daily rate. Payroll uses this to compute hourly pay, OT, late, and undertime deductions."}
              onChange={(e) => updateFormField("salary_range", e.target.value)}
            />

            <TextField
              fullWidth
              required
              multiline
              label="Description"
              value={form.description}
              error={hasFieldError("description")}
              helperText={hasFieldError("description") ? "Description is required." : " "}
              onChange={(e) => updateFormField("description", e.target.value)}
            />

            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Qualifications"
              value={form.qualifications}
              onChange={(e) => updateFormField("qualifications", e.target.value)}
              sx={textFieldSx}
            />

            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Responsibilities"
              value={form.responsibilities}
              onChange={(e) => updateFormField("responsibilities", e.target.value)}
              sx={textFieldSx}
            />
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            flexDirection: { xs: "column-reverse", sm: "row" },
            gap: 1,
            px: { xs: 2.5, sm: 3 },
            py: 2,
          }}
        >
          <Button
            fullWidth={isMobile}
            onClick={handleCloseDialog}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            fullWidth={isMobile}
            variant="contained"
            onClick={handleSave}
            disabled={saving || (submitted && missingFields.length > 0)}
            startIcon={saving ? <CircularProgress color="inherit" size={16} /> : null}
            sx={{
              textTransform: "none",
              fontWeight: 800,
              minWidth: 96,
              background: "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
              "&.Mui-disabled": {
                background: "rgba(0, 0, 0, 0.12)",
              },
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
