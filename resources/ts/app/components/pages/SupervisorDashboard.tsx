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
  CalendarMonth,
  Assignment,
  QueryStats,
  PeopleAlt,
  TaskAlt,
  Timelapse,
  EventAvailable,
  Refresh,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

interface DashboardStats {
  pendingRequests: number;
  publishedSchedules: number;
  evaluationsSubmitted: number;
}

interface EmployeeRow {
  employee_id: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  position?: string | null;
  outlet?: string | null;
}

interface RequestRow {
  id: string;
  request_id: string;
  employee_id: string;
  request_type: string;
  leave_type?: string | null;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  total_days?: number | null;
  total_hours?: number | null;
  reason?: string | null;
  status?: string | null;
  supervisor_status?: string | null;
  hr_status?: string | null;
  created_at?: string | null;
}

interface RequestPreview {
  id: string;
  requestId: string;
  employeeId: string;
  employee: string;
  type: string;
  dateLabel: string;
  reason: string;
}

interface ScheduleRow {
  schedule_id: string;
  employee_id?: string | null;
  week?: string | null;
  outlet?: string | null;
  position?: string | null;
  time_in?: string | null;
  time_out?: string | null;
  break_time?: string | null;
  monday?: string | null;
  tuesday?: string | null;
  wednesday?: string | null;
  thursday?: string | null;
  friday?: string | null;
  saturday?: string | null;
  sunday?: string | null;
  status?: string | null;
  created_at?: string | null;
}

interface SchedulePreview {
  id: string;
  employeeId: string;
  employee: string;
  week: string;
  outlet: string;
  status: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

interface EvaluationRow {
  evaluation_id: string;
  employee_id: string;
  employee_name?: string | null;
  evaluator_user_id?: string | null;
  evaluator_name?: string | null;
  evaluator_role?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
}

type UnknownRecord = Record<string, unknown>;

const DEFAULT_STATS: DashboardStats = {
  pendingRequests: 0,
  publishedSchedules: 0,
  evaluationsSubmitted: 0,
};

const DAY_KEYS: (keyof SchedulePreview)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const normalizeUserId = (value: unknown): string => String(value ?? '').trim();

const makeFullName = (row: Partial<EmployeeRow> | UnknownRecord | null | undefined): string =>
  [
    (row as any)?.first_name,
    (row as any)?.middle_name,
    (row as any)?.last_name,
    (row as any)?.suffix,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const getCurrentUserName = (currentUser: any): string => {
  const directName = currentUser?.name || currentUser?.full_name;
  if (directName) return String(directName).trim();

  const composedName = [currentUser?.first_name, currentUser?.middle_name, currentUser?.last_name, currentUser?.suffix]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return composedName || currentUser?.email || 'Supervisor';
};

const getCurrentUserId = (currentUser: any): string =>
  normalizeUserId(currentUser?.user_id || currentUser?.userId || currentUser?.id);

const getCurrentOutlet = (currentUser: any): string => {
  const outlet = String(currentUser?.outlet ?? '').trim();
  const normalizedOutlet = normalizeText(outlet);

  if (!outlet || ['all', 'n/a', 'na', 'buenaventura estate', 'admin', 'administrator'].includes(normalizedOutlet)) {
    return '';
  }

  return outlet;
};

const formatDate = (value?: string | null): string => {
  if (!value) return '—';

  const dateOnly = String(value).slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateOnly;

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
};

const formatRequestDate = (row: RequestRow): string => {
  if (row.start_date && row.end_date && row.start_date !== row.end_date) {
    return `${formatDate(row.start_date)} – ${formatDate(row.end_date)}`;
  }

  return formatDate(row.start_date || row.created_at);
};

const isPendingSupervisorRequest = (row: RequestRow): boolean => {
  const status = normalizeText(row.status);
  const supervisorStatus = normalizeText(row.supervisor_status);
  const hrStatus = normalizeText(row.hr_status);

  if (['approved', 'disapproved', 'rejected', 'cancelled', 'supervisor approved'].includes(status)) return false;
  if (['approved', 'disapproved'].includes(supervisorStatus)) return false;
  if (['approved', 'disapproved'].includes(hrStatus)) return false;

  return status === 'pending' || supervisorStatus === 'pending' || !supervisorStatus;
};

const isPublishedSchedule = (row: ScheduleRow): boolean => normalizeText(row.status) === 'published';

const isSubmittedEvaluation = (row: EvaluationRow, currentUserName: string, currentUserId: string): boolean => {
  const status = normalizeText(row.status);
  const evaluatorName = normalizeText(row.evaluator_name);
  const evaluatorRole = normalizeText(row.evaluator_role);
  const currentName = normalizeText(currentUserName);

  if (status !== 'submitted') return false;

  if (currentUserId && normalizeUserId(row.evaluator_user_id) === currentUserId) return true;
  if (currentName && evaluatorName && evaluatorName === currentName) return true;

  // Fallback for records that do not store evaluator_user_id/evaluator_name.
  return !currentUserId && !currentName && evaluatorRole.includes('supervisor');
};

const fetchTableRows = async <T,>(
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

const buildEmployeeMap = (employees: EmployeeRow[]) => {
  const map = new Map<string, { name: string; position: string; outlet: string }>();

  employees.forEach((employee) => {
    if (!employee.employee_id) return;

    map.set(employee.employee_id, {
      name: makeFullName(employee) || employee.employee_id,
      position: employee.position || '',
      outlet: employee.outlet || '',
    });
  });

  return map;
};

const isWithinSupervisorOutlet = (
  employeeId: string | null | undefined,
  rowOutlet: string | null | undefined,
  employeeMap: Map<string, { name: string; position: string; outlet: string }>,
  supervisorOutlet: string,
): boolean => {
  if (!supervisorOutlet) return true;

  const normalizedSupervisorOutlet = normalizeText(supervisorOutlet);
  const employeeOutlet = employeeId ? employeeMap.get(employeeId)?.outlet : '';
  const normalizedRowOutlet = normalizeText(rowOutlet);
  const normalizedEmployeeOutlet = normalizeText(employeeOutlet);

  return normalizedRowOutlet === normalizedSupervisorOutlet || normalizedEmployeeOutlet === normalizedSupervisorOutlet;
};

const mapRequestPreview = (
  row: RequestRow,
  employeeMap: Map<string, { name: string; position: string; outlet: string }>,
): RequestPreview => ({
  id: row.id,
  requestId: row.request_id || row.id,
  employeeId: row.employee_id || '',
  employee: employeeMap.get(row.employee_id)?.name || row.employee_id || 'Unknown Employee',
  type: row.leave_type ? `${row.request_type} · ${row.leave_type}` : row.request_type,
  dateLabel: formatRequestDate(row),
  reason: row.reason || '',
});

const mapSchedulePreview = (
  row: ScheduleRow,
  employeeMap: Map<string, { name: string; position: string; outlet: string }>,
): SchedulePreview => ({
  id: row.schedule_id,
  employeeId: row.employee_id || '',
  employee: employeeMap.get(row.employee_id || '')?.name || row.employee_id || 'Unknown Employee',
  week: row.week || '—',
  outlet: row.outlet || employeeMap.get(row.employee_id || '')?.outlet || '—',
  status: row.status || 'Published',
  monday: row.monday || '',
  tuesday: row.tuesday || '',
  wednesday: row.wednesday || '',
  thursday: row.thursday || '',
  friday: row.friday || '',
  saturday: row.saturday || '',
  sunday: row.sunday || '',
});

const resolveSupervisorDashboardData = async (currentUser: any) => {
  const currentUserName = getCurrentUserName(currentUser);
  const currentUserId = getCurrentUserId(currentUser);
  const supervisorOutlet = getCurrentOutlet(currentUser);

  const [employees, requestRows, scheduleRows, evaluationRows] = await Promise.all([
    fetchTableRows<EmployeeRow>('employees', 'employee_id, first_name, middle_name, last_name, suffix, position, outlet'),
    fetchTableRows<RequestRow>(
      'employee_requests',
      'id, request_id, employee_id, request_type, leave_type, start_date, end_date, start_time, end_time, total_days, total_hours, reason, status, supervisor_status, hr_status, created_at',
      { column: 'created_at', ascending: false },
    ),
    fetchTableRows<ScheduleRow>(
      'schedule',
      'schedule_id, employee_id, week, outlet, position, time_in, time_out, break_time, monday, tuesday, wednesday, thursday, friday, saturday, sunday, status',
      { column: 'schedule_id', ascending: false },
    ),
    fetchTableRows<EvaluationRow>(
      'employee_evaluations',
      'evaluation_id, employee_id, employee_name, evaluator_user_id, evaluator_name, evaluator_role, status, submitted_at, created_at',
      { column: 'created_at', ascending: false },
    ),
  ]);

  const employeeMap = buildEmployeeMap(employees);

  const scopedRequests = requestRows.filter((row) =>
    isWithinSupervisorOutlet(row.employee_id, null, employeeMap, supervisorOutlet),
  );

  const pendingRequests = scopedRequests.filter(isPendingSupervisorRequest);

  const publishedSchedules = scheduleRows
    .filter((row) => isPublishedSchedule(row))
    .filter((row) => isWithinSupervisorOutlet(row.employee_id, row.outlet, employeeMap, supervisorOutlet));

  const scopedEvaluations = evaluationRows.filter((row) =>
    isWithinSupervisorOutlet(row.employee_id, null, employeeMap, supervisorOutlet),
  );

  const submittedByCurrentSupervisor = scopedEvaluations.filter((row) =>
    isSubmittedEvaluation(row, currentUserName, currentUserId),
  );

  const fallbackSupervisorSubmitted =
    submittedByCurrentSupervisor.length > 0
      ? submittedByCurrentSupervisor
      : scopedEvaluations.filter(
          (row) => normalizeText(row.status) === 'submitted' && normalizeText(row.evaluator_role).includes('supervisor'),
        );

  return {
    stats: {
      pendingRequests: pendingRequests.length,
      publishedSchedules: publishedSchedules.length,
      evaluationsSubmitted: fallbackSupervisorSubmitted.length,
    },
    pendingRequests: pendingRequests.slice(0, 5).map((row) => mapRequestPreview(row, employeeMap)),
    publishedSchedules: publishedSchedules.slice(0, 8).map((row) => mapSchedulePreview(row, employeeMap)),
  };
};

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [pendingRequests, setPendingRequests] = useState<RequestPreview[]>([]);
  const [publishedSchedules, setPublishedSchedules] = useState<SchedulePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const currentUserName = getCurrentUserName(user);

  const loadDashboardStats = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setErrorMessage(null);
      } else {
        setRefreshing(true);
      }

      try {
        const liveData = await resolveSupervisorDashboardData(user);

        if (!isMountedRef.current) return;

        setStats(liveData.stats);
        setPendingRequests(liveData.pendingRequests);
        setPublishedSchedules(liveData.publishedSchedules);
        setLastUpdatedAt(new Date());
        setErrorMessage(null);
      } catch (error: any) {
        if (!isMountedRef.current) return;

        console.error('Supervisor dashboard live indicator error:', error);
        setStats(DEFAULT_STATS);
        setPendingRequests([]);
        setPublishedSchedules([]);
        setErrorMessage(
          `Unable to load live supervisor indicators: ${error?.message || 'Please check Supabase access and table permissions.'}`,
        );
      } finally {
        if (!isMountedRef.current) return;

        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

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
      .channel('supervisor-dashboard-live-indicators')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_requests' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, scheduleSilentRefresh)
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
        title: 'Pending Requests',
        value: loading ? '…' : String(stats.pendingRequests),
        icon: <Timelapse />,
        color: '#D9A441',
      },
      {
        title: 'Published Schedules',
        value: loading ? '…' : String(stats.publishedSchedules),
        icon: <EventAvailable />,
        color: '#1F7A47',
      },
      {
        title: 'Evaluations Submitted',
        value: loading ? '…' : String(stats.evaluationsSubmitted),
        icon: <QueryStats />,
        color: '#2F8F8B',
      },
    ],
    [loading, stats],
  );

  const shortcuts = [
    { title: 'Schedule Management', icon: <CalendarMonth />, path: '/dashboard/schedule', color: '#1F7A47' },
    { title: 'Request Inbox', icon: <Assignment />, path: '/dashboard/requests', color: '#D9A441' },
    { title: 'Evaluate Employees', icon: <QueryStats />, path: '/dashboard/evaluation', color: '#2F8F8B' },
    { title: 'Employee Directory', icon: <PeopleAlt />, path: '/dashboard/employees', color: '#9C27B0' },
  ];

  const lastUpdatedLabel = lastUpdatedAt
    ? `Last updated ${lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : 'Waiting for live data';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          fontWeight="bold"
          sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}
        >
          Supervisor Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome, {currentUserName} — Buenaventura Estate
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

      {/* Stat Cards */}
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
              <CardContent sx={{ height: '100%', display: 'flex', alignItems: 'center', p: '16px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                  <Box sx={{ bgcolor: stat.color, borderRadius: '14px', p: 1.5, display: 'flex', flexShrink: 0 }}>
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

      {/* Quick Actions */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Quick Actions
          </Typography>
          <Button
            size="small"
            startIcon={<Refresh />}
            onClick={() => void loadDashboardStats(false)}
            disabled={loading || refreshing}
          >
            Refresh
          </Button>
        </Box>
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

      {/* Published Schedules Panel */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <EventAvailable sx={{ color: '#1F7A47' }} />
            <Typography variant="h6" fontWeight="bold">
              Published Schedules
            </Typography>
            <Chip label={stats.publishedSchedules} size="small" color="success" variant="outlined" />
          </Box>
          <Button size="small" variant="outlined" onClick={() => navigate('/dashboard/schedule')}>
            Manage Schedules
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3, gap: 1 }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary" variant="body2">
              Loading schedules…
            </Typography>
          </Box>
        ) : publishedSchedules.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CalendarMonth sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No published schedules yet.</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              Go to Schedule Management to create and publish employee schedules.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Week / Period</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Outlet</TableCell>
                  {DAY_LABELS.map((day) => (
                    <TableCell key={day} sx={{ fontWeight: 700, textAlign: 'center', fontSize: '0.75rem' }}>
                      {day}
                    </TableCell>
                  ))}
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {publishedSchedules.map((schedule) => (
                  <TableRow key={schedule.id} hover>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{schedule.employee}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.82rem' }}>
                      {schedule.week}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.82rem' }}>
                      {schedule.outlet}
                    </TableCell>
                    {DAY_KEYS.map((day) => {
                      const value = schedule[day] as string | undefined;
                      const normalizedValue = normalizeText(value);
                      const isOff = !value || normalizedValue === 'off' || normalizedValue === 'rest';

                      return (
                        <TableCell key={String(day)} sx={{ textAlign: 'center', p: '6px 4px' }}>
                          {isOff ? (
                            <Typography variant="caption" color="text.disabled">
                              —
                            </Typography>
                          ) : (
                            <Chip
                              label={value}
                              size="small"
                              variant="outlined"
                              color="success"
                              sx={{ fontSize: '0.68rem', height: 20, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Chip label="Published" size="small" color="success" sx={{ fontWeight: 600 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Pending Request Inbox */}
      <Paper sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight="bold">
              Pending Requests
            </Typography>
            <Chip label={stats.pendingRequests} size="small" color="warning" variant="outlined" />
          </Box>
          <Button size="small" onClick={() => navigate('/dashboard/requests')}>
            View All
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3, gap: 1 }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary" variant="body2">
              Loading pending requests…
            </Typography>
          </Box>
        ) : pendingRequests.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <TaskAlt color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography color="text.secondary">No pending requests — all clear!</Typography>
          </Box>
        ) : (
          pendingRequests.map((request) => (
            <Box
              key={request.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 2,
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexDirection: { xs: 'column', sm: 'row' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                  <Typography variant="body2" fontWeight={600} component="span">
                    {request.employee}
                  </Typography>
                  <Chip label={request.type} size="small" />
                  <Typography variant="caption" color="text.secondary">
                    {request.requestId}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Date: {request.dateLabel} · {request.reason ? request.reason.slice(0, 80) : 'No reason provided'}
                  {request.reason && request.reason.length > 80 ? '…' : ''}
                </Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={() => navigate('/dashboard/requests')}>
                Review
              </Button>
            </Box>
          ))
        )}
      </Paper>
    </Box>
  );
}
