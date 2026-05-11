import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, Typography, Box, Button, Paper, Grid, CircularProgress, Divider } from '@mui/material';
import {
  PeopleAlt, PersonAddAlt1, EventAvailable, PendingActions,
  WarningAmber, AccountBalance, EmojiEvents,
  ManageAccounts, CloudUpload, Payments, QueryStats, GroupAdd,
} from '@mui/icons-material';
import { API, HEADERS } from '../../lib/api';

interface Stats {
  activeEmployees: number;
  pendingApplications: number;
  forInterviewCount: number;
  pendingRequests: number;
  supervisorApprovedRequests: number;
  attendanceIssues: number;
  payrollForReview: number;
  topEvaluee: string | null;
  topScore: number | null;
}

export default function HRDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/dashboard/stats`, { headers: HEADERS });
        const data = await res.json();
        if (res.ok) setStats(data);
      } catch (e) {
        console.error('Dashboard stats error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statCards = [
    { title: 'Active Employees',      value: loading ? '…' : String(stats?.activeEmployees ?? 0),            icon: <PeopleAlt />,        color: '#1F7A47' },
    { title: 'Pending Applications',  value: loading ? '…' : String(stats?.pendingApplications ?? 0),        icon: <PersonAddAlt1 />,    color: '#ed6c02' },
    { title: 'For Interview',         value: loading ? '…' : String(stats?.forInterviewCount ?? 0),          icon: <EventAvailable />,   color: '#2F8F8B' },
    { title: 'Pending HR Validation', value: loading ? '…' : String(stats?.supervisorApprovedRequests ?? 0), icon: <PendingActions />,   color: '#9c27b0' },
    { title: 'Attendance Issues',     value: loading ? '…' : String(stats?.attendanceIssues ?? 0),           icon: <WarningAmber />,    color: '#d32f2f' },
    { title: 'Payroll For Review',    value: loading ? '…' : String(stats?.payrollForReview ?? 0),           icon: <AccountBalance />,   color: '#0277BD' },
    {
      title: 'Top Performer',
      value: loading ? '…' : stats?.topEvaluee ? `${stats.topEvaluee} (${stats.topScore?.toFixed(1)}%)` : 'No data',
      icon: <EmojiEvents />, color: '#b8860b',
    },
  ];

  const shortcuts = [
    { title: 'Manage Employees',   icon: <ManageAccounts />,  path: '/dashboard/employees',  color: '#1F7A47' },
    { title: 'Review Applications',icon: <PersonAddAlt1 />,   path: '/dashboard/recruitment', color: '#ed6c02' },
    { title: 'Import Attendance',  icon: <CloudUpload />,     path: '/dashboard/attendance',  color: '#2F8F8B' },
    { title: 'Generate Payroll',   icon: <Payments />,        path: '/dashboard/payroll',     color: '#0277BD' },
    { title: 'View DSS Results',   icon: <QueryStats />,      path: '/dashboard/evaluation',  color: '#9c27b0' },
    { title: 'User Accounts',      icon: <GroupAdd />,        path: '/dashboard/users',       color: '#b8860b' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          HR / Admin Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome to Buenaventura Estate HRIS — live data from Supabase
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Loading live stats…</Typography>
        </Box>
      )}

      <Grid container spacing={{ xs: 2, md: 2.5 }} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }} sx={{ display: 'flex' }}>
            <Card elevation={0} sx={{
              height: 96, width: '100%',
              border: '1px solid', borderColor: 'divider',
              transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 },
            }}>
              <CardContent sx={{ height: '100%', display: 'flex', alignItems: 'center', p: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                  <Box sx={{ bgcolor: stat.color, borderRadius: '14px', p: 1.5, display: 'flex', flexShrink: 0 }}>
                    <Box sx={{ color: 'white', display: 'flex', fontSize: '1.35rem' }}>{stat.icon}</Box>
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight="bold" sx={{ fontSize: '1.25rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">Quick Actions</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {shortcuts.map((shortcut, index) => (
            <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
              <Button
                fullWidth variant="outlined" size="large"
                startIcon={<Box sx={{ color: shortcut.color, display: 'flex' }}>{shortcut.icon}</Box>}
                onClick={() => navigate(shortcut.path)}
                sx={{ py: 1.5, justifyContent: 'flex-start', borderColor: 'divider', color: 'text.primary', '&:hover': { borderColor: shortcut.color, bgcolor: `${shortcut.color}11` } }}
              >
                {shortcut.title}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
}