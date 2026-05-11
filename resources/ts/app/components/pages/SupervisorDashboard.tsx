import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, Typography, Box, Button, Grid, Paper, Chip, CircularProgress } from '@mui/material';
import {
  CalendarMonth, Assignment, QueryStats, PeopleAlt,
  TaskAlt, Timelapse, EventAvailable,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pendingRequests: 0, publishedSchedules: 0, pendingEvals: 0 });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [reqRes, schedRes, evalRes] = await Promise.all([
          fetch(`${API}/requests`, { headers: HEADERS }),
          fetch(`${API}/schedules`, { headers: HEADERS }),
          fetch(`${API}/evaluations`, { headers: HEADERS }),
        ]);
        const [req, sched, evalData] = await Promise.all([reqRes.json(), schedRes.json(), evalRes.json()]);
        const allReqs: any[] = (req.requests ?? []).filter((r: any) => r != null);
        const pending = allReqs.filter(r => r.status === 'Pending');
        setPendingRequests(pending.slice(0, 5));
        setStats({
          pendingRequests: pending.length,
          publishedSchedules: (sched.schedules ?? []).filter((s: any) => s?.status === 'Published').length,
          pendingEvals: (evalData.evaluations ?? []).filter((e: any) => e?.status === 'Pending GM Approval').length,
        });
      } catch (e) { console.error('Supervisor dashboard error:', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const shortcuts = [
    { label: 'Schedule Management', icon: <CalendarMonth />, path: '/dashboard/schedule',    color: '#1F7A47', desc: 'Create & publish schedules' },
    { label: 'Request Inbox',       icon: <Assignment />,  path: '/dashboard/requests',    color: '#D9A441', desc: `${stats.pendingRequests} pending approval` },
    { label: 'Evaluate Employees',  icon: <QueryStats />,   path: '/dashboard/evaluation',  color: '#2F8F8B', desc: 'Rate employee performance' },
    { label: 'Employee Directory',  icon: <PeopleAlt />,    path: '/dashboard/employees',   color: '#9C27B0', desc: 'View team (view only)' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          Supervisor Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">Welcome, {user?.name} — Buenaventura Estate</Typography>
      </Box>

      {loading && <Box sx={{ display: 'flex', gap: 1, my: 2 }}><CircularProgress size={18} /><Typography variant="body2" color="text.secondary">Loading…</Typography></Box>}

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Pending Requests',       value: stats.pendingRequests,    icon: <Timelapse />,  color: '#D9A441' },
          { label: 'Published Schedules',    value: stats.publishedSchedules, icon: <EventAvailable />,  color: '#1F7A47' },
          { label: 'Evaluations Submitted',  value: stats.pendingEvals,       icon: <QueryStats />,      color: '#2F8F8B' },
        ].map(s => (
          <Grid key={s.label} size={{ xs: 12, sm: 4 }}>
            <Card elevation={0} sx={{
              height: 88, border: '1px solid', borderColor: 'divider',
              transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 3 },
            }}>
              <CardContent sx={{ height: '100%', display: 'flex', alignItems: 'center', p: '14px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ bgcolor: s.color, borderRadius: '12px', p: 1.25, color: 'white', display: 'flex', flexShrink: 0 }}>{s.icon}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight="bold" sx={{ fontSize: '1.5rem', lineHeight: 1.2 }}>{s.value}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Access */}
      <Typography variant="h6" fontWeight="bold" gutterBottom>Quick Access</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {shortcuts.map(s => (
          <Grid key={s.label} size={{ xs: 12, sm: 6 }}>
            <Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}
              onClick={() => navigate(s.path)}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ bgcolor: s.color, borderRadius: '12px', p: 1.25, color: 'white', display: 'flex' }}>{s.icon}</Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">{s.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.desc}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pending Request Inbox */}
      <Paper sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">Pending Requests (Inbox)</Typography>
          <Button size="small" onClick={() => navigate('/dashboard/requests')}>View All</Button>
        </Box>
        {pendingRequests.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <TaskAlt color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography color="text.secondary">No pending requests — all clear!</Typography>
          </Box>
        ) : pendingRequests.map(r => (
          <Box key={r.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>{r.employee} — <Chip label={r.type} size="small" /></Typography>
              <Typography variant="caption" color="text.secondary">Date: {r.date} · {r.reason?.slice(0, 50)}</Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={() => navigate('/dashboard/requests')}>Review</Button>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}