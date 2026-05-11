import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
  Divider,
  InputAdornment,
  IconButton,
  Stack,
  Chip,
  Grid,
} from "@mui/material";
import {
  Lock,
  PersonAdd,
  Search,
  Business,
  Visibility,
  VisibilityOff,
  Email,
  VpnKey,
} from "@mui/icons-material";
import AuthBackground from "../AuthBackground";
import { COMPANY } from "../../lib/constants";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [selectedDemo, setSelectedDemo] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  const demoAccounts = [
    {
      email: "admin",
      password: "admin123",
      role: "HR Personnel/Admin",
    },
    {
      email: "employee@company.com",
      password: "password",
      role: "Employee",
    },
    {
      email: "supervisor@company.com",
      password: "password",
      role: "Supervisor",
    },
    {
      email: "gm@company.com",
      password: "password",
      role: "General Manager",
    },
    {
      email: "accounting@company.com",
      password: "password",
      role: "Accounting & Finance",
    },
  ];

  return (
    <AuthBackground>
      <Container
        maxWidth="sm"
        sx={{ position: "relative", zIndex: 1 }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4, md: 5 },
            borderRadius: 4,
            backdropFilter: "blur(18px)",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(255,255,255,0.5)",
            boxShadow: "0 30px 60px rgba(8,25,48,0.35)",
          }}
        >
          {/* Brand header */}
          <Stack
            alignItems="center"
            spacing={1.5}
            sx={{ mb: 3 }}
          >
            <Box
              sx={{
                width: { xs: 64, sm: 72 },
                height: { xs: 64, sm: 72 },
                borderRadius: "22px",
                background:
                  "linear-gradient(135deg, #1F7A47 0%, #3FA46A 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 12px 28px rgba(31,122,71,0.45)",
              }}
            >
              <Business
                sx={{
                  fontSize: { xs: 32, sm: 38 },
                  color: "white",
                }}
              />
            </Box>
            <Chip
              size="small"
              label="BUENAVENTURA ESTATE"
              sx={{
                letterSpacing: 2,
                bgcolor: "rgba(31,122,71,0.10)",
                color: "primary.dark",
                fontWeight: 700,
              }}
            />
            <Typography
              align="center"
              sx={{
                fontSize: { xs: "1.25rem", sm: "1.5rem" },
                fontWeight: 700,
                color: "text.primary",
                lineHeight: 1.2,
              }}
            >
              Human Resource Information System
            </Typography>
            <Typography
              align="center"
              sx={{
                color: "text.secondary",
                fontSize: { xs: "0.85rem", sm: "0.95rem" },
              }}
            >
              with Decision Support System
            </Typography>
            <Typography
              align="center"
              variant="caption"
              sx={{
                color: "text.disabled",
                fontSize: "0.72rem",
                letterSpacing: 0.5,
              }}
            >
              {COMPANY.address}
            </Typography>
          </Stack>

          <Divider sx={{ mb: 3 }}>
            <Chip
              icon={<Lock sx={{ fontSize: 16 }} />}
              label="Employee Sign In"
              size="small"
              color="primary"
              variant="outlined"
            />
          </Divider>

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2, borderRadius: 2 }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <TextField
              select
              fullWidth
              label="Quick Demo Account"
              value={selectedDemo}
              onChange={(e) => {
                const val = e.target.value;
                const acc = demoAccounts.find((a) => a.email === val);
                setSelectedDemo(val);
                if (acc) {
                  setEmail(acc.email);
                  setPassword(acc.password);
                }
              }}
              margin="normal"
              size="medium"
              helperText="Choose a role to auto-fill credentials"
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem key="demo-placeholder" value="" disabled>
                <em style={{ color: '#9e9e9e', fontStyle: 'normal' }}>— Select a demo role —</em>
              </MenuItem>
              {demoAccounts.map((account) => (
                <MenuItem
                  key={account.email}
                  value={account.email}
                >
                  {account.role}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Email / Username"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              helperText="Demo password: password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <VpnKey fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? (
                        <VisibilityOff />
                      ) : (
                        <Visibility />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, mb: 2, py: 1.4, fontSize: "1rem" }}
            >
              Sign In to HRIS
            </Button>
          </form>

          <Divider sx={{ my: 2.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ letterSpacing: 1 }}
            >
              APPLICANT PORTAL
            </Typography>
          </Divider>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<PersonAdd />}
                onClick={() => navigate("/apply")}
                sx={{ py: 1.3 }}
              >
                Apply for Job
              </Button>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                color="secondary"
                startIcon={<Search />}
                onClick={() => navigate("/track")}
                sx={{ py: 1.3 }}
              >
                Track Application
              </Button>
            </Grid>
          </Grid>

          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 2,
              background:
                "linear-gradient(135deg, rgba(31,122,71,0.08) 0%, rgba(217,164,65,0.10) 100%)",
              border: "1px dashed rgba(31,122,71,0.22)",
            }}
          >
            <Typography
              variant="caption"
              display="block"
              gutterBottom
              fontWeight={700}
              color="primary.dark"
            >
              Quick Access — Demo Roles
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
            >
              {demoAccounts.map((a) => (
                <Chip
                  key={a.email}
                  label={a.role}
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                  }}
                  sx={{ mb: 0.5, cursor: "pointer" }}
                />
              ))}
            </Stack>
          </Box>
        </Paper>

        <Typography
          align="center"
          sx={{
            mt: 2.5,
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.78rem",
          }}
        >
          © {new Date().getFullYear()} {COMPANY.name} · Est.{" "}
          {COMPANY.established} · HRIS-DSS Capstone
        </Typography>
      </Container>
    </AuthBackground>
  );
}