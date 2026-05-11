import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, Typography, Box, Button, Grid, Paper, Chip, CircularProgress } from '@mui/material';
import {
  PersonAddAlt1, QueryStats, PeopleAlt, Analytics,
  EmojiEvents, Timelapse, TrendingUp, Visibility,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

export default function GMDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [forInterview, setForInterview] = useState<any[]>([]);
  const [topEvaluations, setTopEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, appRes, evalRes] = await Promise.all([
          fetch(`${API}/dashboard/stats`, { headers: HEADERS }),
          fetch(`${API}/applications`, { headers: HEADERS }),
          fetch(`${API}/evaluations`, { headers: HEADERS }),
        ]);
        const [statsData, appData, evalData] = await Promise.all([
          statsRes.json(), appRes.json(), evalRes.json(),
        ]);
        setStats(statsData);
        setForInterview((appData.applications ?? []).filter((a: any) => a?.status === 'For Interview').slice(0, 5));
        const evals = (evalData.evaluations ?? []).filter((e: any) => e?.status === 'Pending GM Approval');
        setTopEvaluations(evals.sort((a: any, b: any) => b.finalScore - a.finalScore).slice(0, 5));
      } catch (e) { console.error('GM dashboard error:', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const shortcuts = [
    { label: 'Recruitment & Hiring',   icon: <PersonAddAlt1 />, path: '/dashboard/recruitment', color: '#1F7A47', desc: `${stats?.forInterviewCount ?? 0} awaiting interview` },
    { label: 'DSS Performance Review', icon: <QueryStats />,    path: '/dashboard/evaluation',  color: '#D9A441', desc: 'Review & approve evaluations' },
    { label: 'Employee Directory',     icon: <PeopleAlt />,     path: '/dashboard/employees',   color: '#2F8F8B', desc: `${stats?.activeEmployees ?? 0} active employees (view only)` },
    { label: 'Reports & Analytics',    icon: <Analytics />,      path: '/dashboard/reports',     color: '#9C27B0', desc: 'Generate & view reports' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          General Manager Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">Welcome, {user?.name} — Estate-wide Overview</Typography>
      </Box>

      {loading && <Box sx={{ display: 'flex', gap: 1, my: 2 }}><CircularProgress size={18} /><Typography variant="body2" color="text.secondary">Loading estate data…</Typography></Box>}

      {/* EOTM Banner */}
      {stats?.eotmEmployee && (
        <Paper sx={{ p: 2.5, mb: 3, background: 'linear-gradient(135deg, #D9A441 0%, #E8C06A 100%)', color: 'white', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EmojiEvents sx={{ fontSize: 48 }} />
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.9, letterSpacing: 1 }}>🏆 EMPLOYEE OF THE MONTH</Typography>
              <Typography variant="h5" fontWeight="bold">{stats.eotmEmployee}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>Highest DSS Performance Score</Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Active Employees',      value: stats?.activeEmployees ?? '—',   icon: <PeopleAlt />,      color: '#1F7A47' },
          { label: 'For Interview',         value: stats?.forInterviewCount ?? '—', icon: <PersonAddAlt1 />,  color: '#2F8F8B' },
          { label: 'Pending DSS Approvals', value: topEvaluations.length,           icon: <TrendingUp />,     color: '#D9A441' },
          { label: 'Pending Requests',      value: stats?.pendingRequests ?? '—',   icon: <Timelapse />, color: '#B73E2D' },
        ].map(s => (
          <Grid key={s.label} size={{ xs: 6, md: 3 }}>
            <Card elevation={0} sx={{
              height: 88, border: '1px solid', borderColor: 'divider',
              transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 3 },
            }}>
              <CardContent sx={{ height: '100%', display: 'flex', alignItems: 'center', p: '14px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <Box sx={{ bgcolor: s.color, borderRadius: '12px', p: 1.25, color: 'white', display: 'flex', flexShrink: 0 }}>{s.icon}</Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight="bold" sx={{ fontSize: '1.35rem', lineHeight: 1.2 }}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Quick Access */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Quick Access</Typography>
            {shortcuts.map(s => (
              <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1, px: 1, transition: 'background 0.15s' }}
                onClick={() => navigate(s.path)}>
                <Box sx={{ bgcolor: s.color, borderRadius: 1.5, p: 0.75, color: 'white', display: 'flex' }}>{s.icon}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" fontWeight={600}>{s.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.desc}</Typography>
                </Box>
                <Visibility sx={{ color: 'text.disabled', fontSize: 18 }} />
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Applicants For Interview */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">Applicants for Interview</Typography>
              <Button size="small" onClick={() => navigate('/dashboard/recruitment')}>Manage</Button>
            </Box>
            {forInterview.length === 0 ? (
              <Typography color="text.secondary" variant="body2">No applicants scheduled for interview.</Typography>
            ) : forInterview.map(a => (
              <Box key={a.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{a.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{a.position} · {a.interviewDate ?? 'Date TBD'}</Typography>
                </Box>
                <Chip label="For Interview" size="small" color="info" />
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Pending DSS Evaluations */}
        {topEvaluations.length > 0 && (
          <Grid size={12}>
            <Paper sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">DSS Evaluations — Pending Your Approval</Typography>
                <Button size="small" variant="contained" onClick={() => navigate('/dashboard/evaluation')}>Approve Now</Button>
              </Box>
              {topEvaluations.map((e, i) => (
                <Box key={e.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Chip label={`#${i + 1}`} size="small" color={i === 0 ? 'warning' : 'default'} />
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{e.employee}</Typography>
                      <Typography variant="caption" color="text.secondary">{e.position} · {e.period}</Typography>
                    </Box>
                  </Box>
                  <Typography variant="body1" fontWeight="bold" color="primary">{e.finalScore?.toFixed(2)}%</Typography>
                </Box>
              ))}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}