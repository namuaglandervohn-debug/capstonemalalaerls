import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, Typography, Box, Button, Grid, Paper, Chip, CircularProgress } from '@mui/material';
import { Payments, Analytics, TaskAlt, Timelapse, AccountBalanceWallet } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

export default function AccountingDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [forReview, setForReview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, payRes] = await Promise.all([
          fetch(`${API}/dashboard/stats`, { headers: HEADERS }),
          fetch(`${API}/payroll`, { headers: HEADERS }),
        ]);
        const [statsData, payData] = await Promise.all([statsRes.json(), payRes.json()]);
        setStats(statsData);
        const allPayrolls: any[] = (payData.payrolls ?? []).filter((p: any) => p != null);
        setForReview(allPayrolls.filter(p => p.status === 'For Review').slice(0, 5));
      } catch (e) { console.error('Accounting dashboard error:', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const totalNet = forReview.reduce((sum, p) => {
    const v = parseFloat((p.netPay ?? '').replace(/[₱,]/g, '')) || 0;
    return sum + v;
  }, 0);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          Accounting & Finance Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">Welcome, {user?.name} — Buenaventura Estate</Typography>
      </Box>

      {loading && <Box sx={{ display: 'flex', gap: 1, my: 2 }}><CircularProgress size={18} /><Typography variant="body2" color="text.secondary">Loading…</Typography></Box>}

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Payroll For Review', value: stats?.payrollForReview ?? '—', icon: <Timelapse />, color: '#D9A441' },
          { label: 'Payroll Released', value: stats?.payrollReleased ?? '—', icon: <TaskAlt />, color: '#1F7A47' },
          { label: 'Total Net Payable (For Review)', value: totalNet > 0 ? `₱${Math.round(totalNet).toLocaleString()}` : '₱0', icon: <AccountBalanceWallet />, color: '#2F8F8B' },
        ].map(s => (
          <Grid key={s.label} size={{ xs: 12, sm: 4 }}>
            <Card elevation={2}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ bgcolor: s.color, borderRadius: 2, p: 1.25, color: 'white', display: 'flex' }}>{s.icon}</Box>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">{s.value}</Typography>
                    <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Access */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Payroll Dashboard', icon: <Payments />, path: '/dashboard/payroll', color: '#1F7A47', desc: 'Review & release payroll' },
          { label: 'Reports', icon: <Analytics />, path: '/dashboard/reports', color: '#2F8F8B', desc: 'Generate payroll reports' },
        ].map(s => (
          <Grid key={s.label} size={{ xs: 12, sm: 6 }}>
            <Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}
              onClick={() => navigate(s.path)}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ bgcolor: s.color, borderRadius: 2, p: 1.25, color: 'white', display: 'flex' }}>{s.icon}</Box>
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

      {/* Payroll For Review */}
      <Paper sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">Payroll Awaiting Release</Typography>
          <Button variant="contained" size="small" onClick={() => navigate('/dashboard/payroll')}>Go to Payroll</Button>
        </Box>
        {forReview.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <TaskAlt color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography color="text.secondary">No payroll records awaiting release</Typography>
          </Box>
        ) : (
          <>
            {forReview.map(p => (
              <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{p.employee}</Typography>
                  <Typography variant="caption" color="text.secondary">{p.position} · Period: {p.period}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body1" fontWeight="bold" color="success.main">{p.netPay}</Typography>
                  <Chip label="For Review" size="small" color="warning" />
                </Box>
              </Box>
            ))}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" color="success" onClick={() => navigate('/dashboard/payroll')}>
                Proceed to Salary Release
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}