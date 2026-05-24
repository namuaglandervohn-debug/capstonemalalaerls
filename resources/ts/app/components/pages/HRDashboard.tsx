import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import {
  AccountBalance,
  CloudUpload,
  EmojiEvents,
  EventAvailable,
  GroupAdd,
  ManageAccounts,
  Payments,
  PendingActions,
  PeopleAlt,
  PersonAddAlt1,
  QueryStats,
  WarningAmber,
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';

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

type StatusRecord = Record<string, unknown>;

const DEFAULT_STATS: Stats = {
  activeEmployees: 0,
  pendingApplications: 0,
  forInterviewCount: 0,
  pendingRequests: 0,
  supervisorApprovedRequests: 0,
  attendanceIssues: 0,
  payrollForReview: 0,
  topEvaluee: null,
  topScore: null,
};

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const parsed = Number(String(value ?? '').replace(/[,%₱]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value);
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
};

const isPendingApplicationStatus = (status: unknown): boolean => {
  const normalized = normalizeText(status);

  return ['submitted', 'pending', 'for review', 'under review'].includes(normalized);
};

const isForInterviewStatus = (status: unknown): boolean => {
  const normalized = normalizeText(status);

  return normalized.includes('interview') && !normalized.includes('cancelled') && !normalized.includes('rejected');
};

const isPendingHrValidationRequest = (request: StatusRecord): boolean => {
  const overallStatus = normalizeText(request.status);
  const supervisorStatus = normalizeText(request.supervisor_status);
  const hrStatus = normalizeText(request.hr_status);

  const alreadyClosed = ['approved', 'disapproved', 'rejected', 'cancelled'].includes(overallStatus);
  const supervisorApproved = overallStatus === 'supervisor approved' || supervisorStatus === 'approved';
  const waitingForHr = !hrStatus || hrStatus === 'pending';

  return supervisorApproved && waitingForHr && !alreadyClosed;
};

const isAttendanceIssue = (row: StatusRecord): boolean => {
  const validationStatus = normalizeText(row.validation_status);

  return (
    validationStatus === 'needs review' ||
    validationStatus === 'invalid' ||
    toBoolean(row.is_late) ||
    toBoolean(row.is_undertime) ||
    toBoolean(row.is_absent) ||
    toBoolean(row.is_incomplete)
  );
};

const isPayrollForReview = (status: unknown): boolean => {
  const normalized = normalizeText(status);

  // Reviewed = forwarded to Accounting/Finance; Approved = processed but not yet released.
  return normalized === 'reviewed' || normalized === 'approved';
};

const fetchRows = async <T extends StatusRecord>(
  table: string,
  columns: string,
  orderBy?: { column: string; ascending?: boolean },
): Promise<T[]> => {
  let query = (supabase as any).from(table).select(columns);

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as T[];
};

const fetchActiveEmployeesCount = async (): Promise<number> => {
  const rows = await fetchRows('employees', 'id, employee_id, status');

  return rows.filter((row) => normalizeText(row.status) === 'active').length;
};

const fetchPendingApplicationsCount = async (): Promise<number> => {
  const rows = await fetchRows('applicants', 'id, applicant_id, status');

  return rows.filter((row) => isPendingApplicationStatus(row.status)).length;
};

const fetchForInterviewCount = async (): Promise<number> => {
  const rows = await fetchRows('applicants', 'id, applicant_id, status');

  return rows.filter((row) => isForInterviewStatus(row.status)).length;
};

const fetchPendingRequestsCount = async (): Promise<number> => {
  const rows = await fetchRows('employee_requests', 'id, request_id, status');

  return rows.filter((row) => normalizeText(row.status) === 'pending').length;
};

const fetchPendingHrValidationCount = async (): Promise<number> => {
  const rows = await fetchRows(
    'employee_requests',
    'id, request_id, status, supervisor_status, hr_status',
  );

  return rows.filter(isPendingHrValidationRequest).length;
};

const fetchAttendanceIssuesCount = async (): Promise<number> => {
  const rows = await fetchRows(
    'attendance_logs',
    'id, log_id, validation_status, is_late, is_undertime, is_absent, is_incomplete',
  );

  return rows.filter(isAttendanceIssue).length;
};

const fetchPayrollForReviewCount = async (): Promise<number> => {
  const rows = await fetchRows('payroll_summaries', 'id, payroll_id, status');

  return rows.filter((row) => isPayrollForReview(row.status)).length;
};

const fetchTopPerformer = async (): Promise<Pick<Stats, 'topEvaluee' | 'topScore'>> => {
  const dssRows = await fetchRows(
    'dss_results',
    'id, result_id, top_employee_name, highest_score, status, result_period_end, created_at',
    { column: 'result_period_end', ascending: false },
  );

  const latestPublishedDss =
    dssRows.find((row) => ['approved', 'exported', 'reviewed'].includes(normalizeText(row.status))) ??
    dssRows.find((row) => String(row.top_employee_name ?? '').trim());

  if (latestPublishedDss?.top_employee_name) {
    return {
      topEvaluee: String(latestPublishedDss.top_employee_name).trim(),
      topScore: toNumber(latestPublishedDss.highest_score),
    };
  }

  const topRankedItems = await fetchRows(
    'dss_result_items',
    'id, item_id, employee_name, final_weighted_score, rank_no, created_at',
    { column: 'created_at', ascending: false },
  );

  const topRankedItem = topRankedItems.find((row) => toNumber(row.rank_no) === 1 && String(row.employee_name ?? '').trim());

  if (topRankedItem) {
    return {
      topEvaluee: String(topRankedItem.employee_name).trim(),
      topScore: toNumber(topRankedItem.final_weighted_score),
    };
  }

  const evaluationRows = await fetchRows(
    'employee_evaluations',
    'id, evaluation_id, employee_name, employee_id, final_weighted_score, status, updated_at',
    { column: 'updated_at', ascending: false },
  );

  const rankedEvaluations = evaluationRows
    .filter((row) => ['approved', 'reviewed', 'submitted'].includes(normalizeText(row.status)))
    .sort((a, b) => toNumber(b.final_weighted_score) - toNumber(a.final_weighted_score));

  const topEvaluation = rankedEvaluations[0];

  if (topEvaluation) {
    return {
      topEvaluee: String(topEvaluation.employee_name ?? topEvaluation.employee_id ?? '').trim() || null,
      topScore: toNumber(topEvaluation.final_weighted_score),
    };
  }

  return { topEvaluee: null, topScore: null };
};

const resolveLiveDashboardStats = async (): Promise<{ stats: Stats; failedSources: string[] }> => {
  const failedSources: string[] = [];

  const safe = async <T,>(label: string, fallback: T, task: () => Promise<T>): Promise<T> => {
    try {
      return await task();
    } catch (error) {
      console.error(`${label} dashboard stat failed:`, error);
      failedSources.push(label);
      return fallback;
    }
  };

  const [
    activeEmployees,
    pendingApplications,
    forInterviewCount,
    pendingRequests,
    supervisorApprovedRequests,
    attendanceIssues,
    payrollForReview,
    topPerformer,
  ] = await Promise.all([
    safe('Active Employees', 0, fetchActiveEmployeesCount),
    safe('Pending Applications', 0, fetchPendingApplicationsCount),
    safe('For Interview', 0, fetchForInterviewCount),
    safe('Pending Requests', 0, fetchPendingRequestsCount),
    safe('Pending HR Validation', 0, fetchPendingHrValidationCount),
    safe('Attendance Issues', 0, fetchAttendanceIssuesCount),
    safe('Payroll For Review', 0, fetchPayrollForReviewCount),
    safe('Top Performer', { topEvaluee: null, topScore: null }, fetchTopPerformer),
  ]);

  return {
    stats: {
      activeEmployees,
      pendingApplications,
      forInterviewCount,
      pendingRequests,
      supervisorApprovedRequests,
      attendanceIssues,
      payrollForReview,
      topEvaluee: topPerformer.topEvaluee,
      topScore: topPerformer.topScore,
    },
    failedSources,
  };
};

export default function HRDashboard() {
  const navigate = useNavigate();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadDashboardStats = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setErrorMessage(null);
    } else {
      setRefreshing(true);
    }

    try {
      const { stats: liveStats, failedSources } = await resolveLiveDashboardStats();

      if (!isMountedRef.current) return;

      setStats(liveStats);
      setLastUpdatedAt(new Date());

      if (failedSources.length > 0) {
        setErrorMessage(`Some live indicators could not be loaded: ${failedSources.join(', ')}.`);
      } else {
        setErrorMessage(null);
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      console.error('Dashboard live stats error:', error);
      setStats(DEFAULT_STATS);
      setErrorMessage('Unable to load live dashboard indicators. Please check Supabase access and table permissions.');
    } finally {
      if (!isMountedRef.current) return;

      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadDashboardStats(false);

    return () => {
      isMountedRef.current = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [loadDashboardStats]);

  useEffect(() => {
    const scheduleSilentRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

      refreshTimerRef.current = setTimeout(() => {
        void loadDashboardStats(true);
      }, 450);
    };

    const channel = supabase
      .channel('hr-dashboard-live-indicators')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applicants' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_requests' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_summaries' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dss_results' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dss_result_items' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_evaluations' }, scheduleSilentRefresh)
      .subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [loadDashboardStats]);

  const statCards = useMemo(
    () => [
      {
        title: 'Active Employees',
        value: loading ? '…' : String(stats.activeEmployees),
        icon: <PeopleAlt />,
        color: '#1F7A47',
      },
      {
        title: 'Pending Applications',
        value: loading ? '…' : String(stats.pendingApplications),
        icon: <PersonAddAlt1 />,
        color: '#ed6c02',
      },
      {
        title: 'For Interview',
        value: loading ? '…' : String(stats.forInterviewCount),
        icon: <EventAvailable />,
        color: '#2F8F8B',
      },
      {
        title: 'Pending HR Validation',
        value: loading ? '…' : String(stats.supervisorApprovedRequests),
        icon: <PendingActions />,
        color: '#9c27b0',
      },
      {
        title: 'Attendance Issues',
        value: loading ? '…' : String(stats.attendanceIssues),
        icon: <WarningAmber />,
        color: '#d32f2f',
      },
      {
        title: 'Payroll For Review',
        value: loading ? '…' : String(stats.payrollForReview),
        icon: <AccountBalance />,
        color: '#0277BD',
      },
      {
        title: 'Top Performer',
        value: loading
          ? '…'
          : stats.topEvaluee
            ? `${stats.topEvaluee} (${stats.topScore?.toFixed(1) ?? '0.0'}%)`
            : 'No data',
        icon: <EmojiEvents />,
        color: '#b8860b',
      },
    ],
    [loading, stats],
  );

  const shortcuts = [
    { title: 'Manage Employees', icon: <ManageAccounts />, path: '/dashboard/employees', color: '#1F7A47' },
    { title: 'Review Applications', icon: <PersonAddAlt1 />, path: '/dashboard/recruitment', color: '#ed6c02' },
    { title: 'Import Attendance', icon: <CloudUpload />, path: '/dashboard/attendance', color: '#2F8F8B' },
    { title: 'Generate Payroll', icon: <Payments />, path: '/dashboard/payroll', color: '#0277BD' },
    { title: 'View DSS Results', icon: <QueryStats />, path: '/dashboard/evaluation', color: '#9c27b0' },
    { title: 'User Accounts', icon: <GroupAdd />, path: '/dashboard/users', color: '#b8860b' },
  ];

  const lastUpdatedLabel = lastUpdatedAt
    ? `Last updated ${lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : 'Waiting for live data';

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          fontWeight="bold"
          sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}
        >
          HR / Admin Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome to Buenaventura Estate HRIS
        </Typography>
      </Box>

      {(loading || refreshing || lastUpdatedAt) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
          {(loading || refreshing) && <CircularProgress size={18} />}
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Loading live stats…' : refreshing ? 'Refreshing live stats…' : lastUpdatedLabel}
          </Typography>
        </Box>
      )}

      {errorMessage && !loading && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void loadDashboardStats(false)}>
              Retry
            </Button>
          }
        >
          {errorMessage}
        </Alert>
      )}

      <Grid container spacing={{ xs: 2, md: 2.5 }} sx={{ mb: 4 }}>
        {statCards.map((stat) => (
          <Grid key={stat.title} size={{ xs: 12, sm: 6, md: 4, lg: 3 }} sx={{ display: 'flex' }}>
            <Card
              elevation={0}
              sx={{
                height: 96,
                width: '100%',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: 4 },
              }}
            >
              <CardContent
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  p: '16px !important',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                  <Box
                    sx={{
                      bgcolor: stat.color,
                      borderRadius: '14px',
                      p: 1.5,
                      display: 'flex',
                      flexShrink: 0,
                    }}
                  >
                    <Box sx={{ color: 'white', display: 'flex', fontSize: '1.35rem' }}>{stat.icon}</Box>
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      fontWeight="bold"
                      sx={{
                        fontSize: '1.25rem',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
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
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Quick Actions
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {shortcuts.map((shortcut) => (
            <Grid key={shortcut.title} size={{ xs: 12, sm: 6, md: 4 }}>
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
    </Box>
  );
}
