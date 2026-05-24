import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Payments,
  Analytics,
  TaskAlt,
  Timelapse,
  AccountBalanceWallet,
  Refresh,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

interface PayrollSummaryRow {
  id?: string | null;
  payroll_id: string;
  period_start?: string | null;
  period_end?: string | null;
  cutoff_label?: string | null;
  total_employees?: number | string | null;
  total_net_pay?: number | string | null;
  status?: string | null;
  endorsed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

interface PayrollItemRow {
  id?: string | null;
  payroll_item_id: string;
  payroll_id: string;
  employee_id?: string | null;
  employee_name?: string | null;
  position?: string | null;
  outlet?: string | null;
  net_pay?: number | string | null;
  gross_pay?: number | string | null;
  total_deductions?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PayrollPreview {
  id: string;
  displayId: string;
  payrollId: string;
  employee: string;
  employeeId: string;
  position: string;
  outlet: string;
  period: string;
  netPay: number;
  status: 'For Review' | 'Processed';
}

interface DashboardStats {
  payrollForReview: number;
  payrollReleased: number;
  totalNetPayable: number;
}

const DEFAULT_STATS: DashboardStats = {
  payrollForReview: 0,
  payrollReleased: 0,
  totalNetPayable: 0,
};

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const parsed = Number(String(value ?? '').replace(/[₱,%]/g, '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: unknown): string =>
  `₱${toNumber(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value?: string | null): string => {
  if (!value) return '—';

  const dateOnly = String(value).slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateOnly;

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
};

const formatPeriod = (summary?: PayrollSummaryRow): string => {
  if (!summary) return '—';
  if (summary.cutoff_label?.trim()) return summary.cutoff_label.trim();

  if (summary.period_start && summary.period_end) {
    return `${formatDate(summary.period_start)} – ${formatDate(summary.period_end)}`;
  }

  return formatDate(summary.period_start ?? summary.period_end ?? null);
};

const isPayrollForAccountingReview = (status: unknown): boolean => {
  const normalized = normalizeText(status);

  // Reviewed = forwarded by HR to Accounting/Finance.
  // Approved = already processed/approved but still not released.
  return normalized === 'reviewed' || normalized === 'approved';
};

const isPayrollReleased = (status: unknown): boolean => {
  const normalized = normalizeText(status);

  // Endorsed is the status used by PayrollComputation when Accounting releases salary.
  // Exported is also treated as released because the schema allows it as a final payroll status.
  return normalized === 'endorsed' || normalized === 'exported';
};

const uiStatusFromDb = (status: unknown): PayrollPreview['status'] => {
  const normalized = normalizeText(status);
  return normalized === 'approved' ? 'Processed' : 'For Review';
};

const buildDisplayIds = (items: PayrollItemRow[], summariesById: Map<string, PayrollSummaryRow>): Map<string, string> => {
  const sorted = [...items].sort((a, b) => {
    const summaryA = summariesById.get(a.payroll_id);
    const summaryB = summariesById.get(b.payroll_id);
    const dateA = String(summaryA?.period_start ?? a.created_at ?? '');
    const dateB = String(summaryB?.period_start ?? b.created_at ?? '');

    return dateA.localeCompare(dateB) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  });

  const counters: Record<string, number> = {};
  const displayIds = new Map<string, string>();

  sorted.forEach((item) => {
    const summary = summariesById.get(item.payroll_id);
    const sourceDate = String(summary?.period_start ?? item.created_at ?? new Date().toISOString());
    const year = sourceDate.slice(0, 4) || String(new Date().getFullYear());

    counters[year] = (counters[year] ?? 0) + 1;
    displayIds.set(item.payroll_item_id, `PAYROLL-${year}-${String(counters[year]).padStart(4, '0')}`);
  });

  return displayIds;
};

const fetchPayrollSummaries = async (): Promise<PayrollSummaryRow[]> => {
  const { data, error } = await supabase
    .from('payroll_summaries')
    .select('id, payroll_id, period_start, period_end, cutoff_label, total_employees, total_net_pay, status, endorsed_at, updated_at, created_at')
    .order('period_start', { ascending: false });

  if (error) throw error;

  return (data ?? []) as PayrollSummaryRow[];
};

const fetchPayrollItems = async (payrollIds: string[]): Promise<PayrollItemRow[]> => {
  if (payrollIds.length === 0) return [];

  const { data, error } = await supabase
    .from('payroll_items')
    .select('id, payroll_item_id, payroll_id, employee_id, employee_name, position, outlet, net_pay, gross_pay, total_deductions, created_at, updated_at')
    .in('payroll_id', payrollIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []) as PayrollItemRow[];
};

const resolveAccountingDashboardData = async (): Promise<{
  stats: DashboardStats;
  forReview: PayrollPreview[];
}> => {
  const summaries = await fetchPayrollSummaries();
  const summariesById = new Map<string, PayrollSummaryRow>(summaries.map((summary) => [summary.payroll_id, summary]));

  const reviewPayrollIds = summaries
    .filter((summary) => isPayrollForAccountingReview(summary.status))
    .map((summary) => summary.payroll_id);

  const releasedPayrollIds = summaries
    .filter((summary) => isPayrollReleased(summary.status))
    .map((summary) => summary.payroll_id);

  const allRelevantIds = [...new Set([...reviewPayrollIds, ...releasedPayrollIds])];
  const relevantItems = await fetchPayrollItems(allRelevantIds);

  const reviewIdSet = new Set(reviewPayrollIds);
  const releasedIdSet = new Set(releasedPayrollIds);

  const reviewItems = relevantItems.filter((item) => reviewIdSet.has(item.payroll_id));
  const releasedItems = relevantItems.filter((item) => releasedIdSet.has(item.payroll_id));
  const displayIds = buildDisplayIds(relevantItems, summariesById);

  const forReview = reviewItems
    .map((item): PayrollPreview => {
      const summary = summariesById.get(item.payroll_id);

      return {
        id: item.payroll_item_id,
        displayId: displayIds.get(item.payroll_item_id) ?? item.payroll_item_id,
        payrollId: item.payroll_id,
        employee: String(item.employee_name ?? 'Unnamed Employee').trim() || 'Unnamed Employee',
        employeeId: String(item.employee_id ?? '').trim() || '—',
        position: String(item.position ?? '').trim() || '—',
        outlet: String(item.outlet ?? '').trim() || '—',
        period: formatPeriod(summary),
        netPay: toNumber(item.net_pay),
        status: uiStatusFromDb(summary?.status),
      };
    })
    .sort((a, b) => b.netPay - a.netPay)
    .slice(0, 5);

  return {
    stats: {
      payrollForReview: reviewItems.length,
      payrollReleased: releasedItems.length,
      totalNetPayable: reviewItems.reduce((sum, item) => sum + toNumber(item.net_pay), 0),
    },
    forReview,
  };
};

export default function AccountingDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [forReview, setForReview] = useState<PayrollPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const loadDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) setRefreshing(true);
    setError(null);

    try {
      const nextData = await resolveAccountingDashboardData();

      if (!mountedRef.current) return;

      setStats(nextData.stats);
      setForReview(nextData.forReview);
      setLastUpdated(new Date());
    } catch (dashboardError: any) {
      console.error('Accounting dashboard error:', dashboardError);

      if (!mountedRef.current) return;

      setError(dashboardError?.message ?? 'Could not load Accounting & Finance dashboard indicators.');
    } finally {
      if (!mountedRef.current) return;

      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    loadDashboard(false);

    const channel = supabase
      .channel('accounting-dashboard-live-indicators')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_summaries' }, () => loadDashboard(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_items' }, () => loadDashboard(false))
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const statCards = useMemo(() => [
    {
      title: 'Payroll For Review',
      value: loading ? '…' : String(stats.payrollForReview),
      icon: <Timelapse />,
      color: '#D9A441',
    },
    {
      title: 'Payroll Released',
      value: loading ? '…' : String(stats.payrollReleased),
      icon: <TaskAlt />,
      color: '#1F7A47',
    },
    {
      title: 'Total Net Payable',
      value: loading ? '…' : formatCurrency(stats.totalNetPayable),
      icon: <AccountBalanceWallet />,
      color: '#2F8F8B',
    },
  ], [loading, stats.payrollForReview, stats.payrollReleased, stats.totalNetPayable]);

  const shortcuts = [
    { title: 'Payroll Dashboard', icon: <Payments />, path: '/dashboard/payroll', color: '#1F7A47' },
    { title: 'Reports', icon: <Analytics />, path: '/dashboard/reports', color: '#2F8F8B' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
          Accounting & Finance Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome, {(user as any)?.name ?? (user as any)?.full_name ?? (user as any)?.email ?? 'Accounting Staff'} — Buenaventura Estate
        </Typography>
      </Box>

      {(loading || refreshing || lastUpdated) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 2 }}>
          {(loading || refreshing) && <CircularProgress size={18} />}
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Loading live Accounting & Finance indicators…' : refreshing ? 'Refreshing indicators…' : `Last updated: ${lastUpdated?.toLocaleTimeString()}`}
          </Typography>
          {!loading && (
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              sx={{ ml: { xs: 0, sm: 1 } }}
            >
              Refresh
            </Button>
          )}
        </Box>
      )}

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Stat Cards */}
      <Grid container spacing={{ xs: 2, md: 2.5 }} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }} sx={{ display: 'flex' }}>
            <Card elevation={0} sx={{
              height: 96,
              width: '100%',
              border: '1px solid',
              borderColor: 'divider',
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: 4 },
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

      {/* Quick Actions */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">Quick Actions</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {shortcuts.map((shortcut, index) => (
            <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<Box sx={{ color: shortcut.color, display: 'flex' }}>{shortcut.icon}</Box>}
                onClick={() => navigate(shortcut.path)}
                sx={{
                  py: 1.5,
                  justifyContent: 'flex-start',
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': { borderColor: shortcut.color, bgcolor: `${shortcut.color}11` },
                }}
              >
                {shortcut.title}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Payroll Awaiting Release */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">Payroll Awaiting Release</Typography>
            <Typography variant="body2" color="text.secondary">
              Shows payroll items with database status Reviewed or Approved.
            </Typography>
          </Box>
          <Button variant="contained" size="small" onClick={() => navigate('/dashboard/payroll')}>Go to Payroll</Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : forReview.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <TaskAlt color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography color="text.secondary">No payroll records awaiting release</Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Payroll ID</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>Position</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Net Pay</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forReview.map((payroll) => (
                    <TableRow key={payroll.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{payroll.displayId}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{payroll.employee}</Typography>
                        <Typography variant="caption" color="text.secondary">{payroll.employeeId}</Typography>
                      </TableCell>
                      <TableCell>{payroll.position}</TableCell>
                      <TableCell>{payroll.period}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(payroll.netPay)}</TableCell>
                      <TableCell>
                        <Chip
                          label={payroll.status}
                          size="small"
                          color={payroll.status === 'Processed' ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

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
