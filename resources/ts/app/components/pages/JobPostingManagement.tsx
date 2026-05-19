import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
} from "@mui/material";

import { Add, Edit, Delete } from "@mui/icons-material";
import { supabase } from "../../lib/supabaseClient";

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  salary_range: string;
  description: string;
  is_active: boolean;
}

const EMPTY_FORM = {
  title: "",
  department: "",
  location: "",
  employment_type: "Full-Time",
  salary_range: "",
  description: "",
};

export default function JobPostingManagement() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosting | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("job_postings")
      .select("*")
      .order("created_at", { ascending: false });

    setJobs(data || []);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const handleEdit = (job: JobPosting) => {
    setEditing(job);

    setForm({
      title: job.title,
      department: job.department,
      location: job.location,
      employment_type: job.employment_type,
      salary_range: job.salary_range,
      description: job.description,
    });

    setOpen(true);
  };

  const handleSave = async () => {
  try {
    if (editing) {
      const { error } = await supabase
        .from("job_postings")
        .update(form)
        .eq("id", editing.id);

      if (error) throw error;

      setSnackbar({
        open: true,
        message: "Job posting updated!",
        severity: "success",
      });
    } else {
      const { error } = await supabase
        .from("job_postings")
        .insert({
          ...form,
          is_active: true,
        });

      if (error) throw error;

      setSnackbar({
        open: true,
        message: "Job posting created!",
        severity: "success",
      });
    }

    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    fetchJobs();
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed: ${e.message}`,
      severity: "error",
    });
  }
};

  const handleDelete = async (id: string) => {
  if (!window.confirm("Remove this job posting?")) return;

  try {
    const { error } = await supabase
      .from("job_postings")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    setJobs(prev =>
      prev.map(job =>
        job.id === id ? { ...job, is_active: false } : job
      )
    );

    setSnackbar({
      open: true,
      message: "Job posting removed!",
      severity: "success",
    });

    fetchJobs();
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed: ${e.message}`,
      severity: "error",
    });
  }
};

const handleToggleActive = async (job: JobPosting) => {
  const newStatus = !job.is_active;

  try {
    const { error } = await supabase
      .from("job_postings")
      .update({ is_active: newStatus })
      .eq("id", job.id);

    if (error) throw error;

    setJobs(prev =>
      prev.map(j =>
        j.id === job.id ? { ...j, is_active: newStatus } : j
      )
    );

    setSnackbar({
      open: true,
      message: `Job posting ${newStatus ? "activated" : "deactivated"}!`,
      severity: "success",
    });
  } catch (e: any) {
    setSnackbar({
      open: true,
      message: `Failed: ${e.message}`,
      severity: "error",
    });
  }
};

  return (
    <Box>
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={900}>
            Job Posting Management
          </Typography>

          <Typography color="text.secondary">
            Create and manage career opportunities.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenCreate}
          sx={{
            borderRadius: 999,
            fontWeight: 800,
            background:
              "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
          }}
        >
          Create Job Posting
        </Button>
      </Box>

      <Grid container spacing={3}>
        {jobs.map((job) => (
          <Grid key={job.id} size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 4 }}>
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Typography variant="h5" fontWeight={800}>
                    {job.title}
                  </Typography>

                  <Chip
                    label={job.is_active ? "Active" : "Inactive"}
                    color={job.is_active ? "success" : "default"}
                  />
                </Stack>

                <Typography>{job.department}</Typography>
                <Typography>{job.location}</Typography>

                <Typography sx={{ mt: 2 }} color="text.secondary">
                  {job.description}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleEdit(job)}
                  >
                    Edit
                  </Button>

                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<Delete />}
                    onClick={() => handleDelete(job.id)}
                  >
                    Delete
                  </Button>

                  <Button
                    color={job.is_active ? "warning" : "success"}
                    variant="outlined"
                    onClick={() => handleToggleActive(job)}
                    >
                    {job.is_active ? "Set Inactive" : "Set Active"}
                    </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editing ? "Edit Job Posting" : "Create Job Posting"}
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Job Title"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Department"
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Location"
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>

          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() =>
          setSnackbar({ ...snackbar, open: false })
        }
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}