import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, Typography, Box, Button, Grid, Paper, Chip, CircularProgress } from '@mui/material';
import {
  CalendarMonth, ReceiptLong, Assignment, Payments,
  QueryStats, ManageAccounts, Fingerprint,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mySchedule, setMySchedule] = useState<any | null>(null);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [myPayslips, setMyPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [schedRes, reqRes, attRes, payRes] = await Promise.all([
          fetch(`${API}/schedules`, { headers: HEADERS }),
          fetch(`${API}/requests`, { headers: HEADERS }),
          fetch(`${API}/attendance`, { headers: HEADERS }),
          fetch(`${API}/payroll`, { headers: HEADERS }),
        ]);
        const [sched, req, att, pay] = await Promise.all([
          schedRes.json(), reqRes.json(), attRes.json(), payRes.json(),
        ]);
        const name = user?.name ?? '';
        const allSchedules = (sched.schedules ?? []).filter((s: any) => s?.employee === name);
        setMySchedule(allSchedules[allSchedules.length - 1] ?? null);
        setMyRequests((req.requests ?? []).filter((r: any) => r?.employee === name));
        setMyAttendance((att.attendance ?? []).filter((a: any) => a?.employee === name).slice(-7));
        setMyPayslips((pay.payrolls ?? []).filter((p: any) => p?.employee === name));
      } catch (e) {
        console.error('Employee dashboard error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const todayAtt = myAttendance.find(a => a.date === new Date().toISOString().split('T')[0]);
  const pendingReqs = myRequests.filter(r => r.status === 'Pending').length;
  const latestPayslip = myPayslips[myPayslips.length - 1];

  const shortcuts = [
    { label: 'My Schedule',       icon: <CalendarMonth />,           path: '/dashboard/schedule',    color: '#1F7A47', desc: mySchedule ? `Week: ${mySchedule.week}` : 'No schedule yet' },
    { label: 'Daily Time Record', icon: <Fingerprint />,             path: '/dashboard/time',        color: '#2F8F8B', desc: 'Clock in/out & view DTR history' },
    { label: 'My Requests',       icon: <Assignment />,             path: '/dashboard/requests',    color: '#D9A441', desc: `${pendingReqs} pending request${pendingReqs !== 1 ? 's' : ''}` },
    { label: 'My Payslips',       icon: <Payments />,                path: '/dashboard/payslips',    color: '#9C27B0', desc: latestPayslip ? `Latest: ${latestPayslip.period} — ${latestPayslip.netPay}` : 'No payslips yet' },
    { label: 'My Evaluation',     icon: <QueryStats />,              path: '/dashboard/evaluation',  color: '#D32F2F', desc: 'View DSS performance results' },
    { label: 'My Profile',        icon: <ManageAccounts />,  path: '/dashboard/profile',     color: '#0277BD', desc: 'Edit profile & upload documents' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          Welcome back, {user?.name}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Employee Portal — Buenaventura Estate
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
          <CircularProgress size={18} /><Typography variant="body2" color="text.secondary">Loading your data…</Typography>
        </Box>
      )}

      {/* Today's Summary */}
      <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'primary.main', color: 'white', borderRadius: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>Today's Summary</Typography>
        <Grid container spacing={2}>
          {[
            ['Attendance Today', todayAtt ? `${todayAtt.status} — ${todayAtt.timeIn || 'No time-in'}` : 'No entry yet'],
            ['Active Schedule', mySchedule ? `${mySchedule.outlet} · ${mySchedule.timeIn}–${mySchedule.timeOut}` : 'No schedule'],
            ['Pending Requests', String(pendingReqs)],
            ['Latest Payslip', latestPayslip ? latestPayslip.netPay : '—'],
          ].map(([k, v]) => (
            <Grid key={k} size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>{k}</Typography>
              <Typography variant="body1" fontWeight="bold">{v}</Typography>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Quick Access */}
      <Typography variant="h6" fontWeight="bold" gutterBottom>Quick Access</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {shortcuts.map((s) => (
          <Grid key={s.label} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}
              onClick={() => navigate(s.path)}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box sx={{ bgcolor: s.color, borderRadius: 2, p: 1.25, display: 'flex', color: 'white', flexShrink: 0 }}>{s.icon}</Box>
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

      {/* Recent Attendance */}
      {myAttendance.length > 0 && (
        <Paper sx={{ p: 2.5, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="h6" fontWeight="bold">Recent Attendance</Typography>
            <Button size="small" onClick={() => navigate('/dashboard/time')}>View All</Button>
          </Box>
          <Grid container spacing={1}>
            {myAttendance.slice(-5).reverse().map(a => (
              <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight={600}>{a.date}</Typography>
                    <Chip label={a.status} size="small" color={a.status === 'Present' ? 'success' : a.status === 'Late' ? 'warning' : 'error'} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {a.timeIn || '—'} – {a.timeOut || '—'} · {a.totalHours || '—'} hrs
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Recent Requests */}
      {myRequests.length > 0 && (
        <Paper sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="h6" fontWeight="bold">My Requests</Typography>
            <Button size="small" onClick={() => navigate('/dashboard/requests')}>View All</Button>
          </Box>
          {myRequests.slice(-3).reverse().map(r => (
            <Box key={r.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>{r.type} — {r.date}</Typography>
                <Typography variant="caption" color="text.secondary">{r.reason?.slice(0, 60)}</Typography>
              </Box>
              <Chip label={r.status} size="small"
                color={r.status === 'Approved' ? 'success' : r.status === 'Disapproved' ? 'error' : r.status === 'Supervisor Approved' ? 'info' : 'warning'} />
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}