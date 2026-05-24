import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
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

const GREEN_UI = {
  pageBg: 'radial-gradient(circle at top left, rgba(220, 246, 219, 0.95), rgba(248, 252, 245, 0.98) 34%, #f7fbf3 100%)',
  cardBg: 'rgba(255, 255, 255, 0.92)',
  cardBgSoft: 'rgba(245, 252, 241, 0.88)',
  border: 'rgba(139, 184, 144, 0.24)',
  borderStrong: 'rgba(73, 156, 92, 0.32)',
  green: '#3aa865',
  greenDark: '#1f7a46',
  greenSoft: '#e6f8e9',
  amberSoft: '#fff7e2',
  amberDark: '#9b6b00',
  tealSoft: '#e9f8f6',
  tealDark: '#207c78',
  text: '#1e2d24',
  muted: '#6c7d70',
  shadow: '0 20px 55px rgba(43, 91, 55, 0.10)',
  shadowSoft: '0 12px 28px rgba(43, 91, 55, 0.08)',
};

const softCardSx = {
  borderRadius: '26px',
  border: `1px solid ${GREEN_UI.border}`,
  background: GREEN_UI.cardBg,
  boxShadow: GREEN_UI.shadow,
};

const innerCardSx = {
  borderRadius: '20px',
  border: `1px solid ${GREEN_UI.border}`,
  background: GREEN_UI.cardBgSoft,
  boxShadow: GREEN_UI.shadowSoft,
};

const pillButtonSx = {
  borderRadius: 999,
  textTransform: 'none',
  fontWeight: 800,
  px: 2,
};

const tableSx = {
  minWidth: 940,
  '& th, & td': { borderColor: 'rgba(139, 184, 144, 0.16)' },
  '& tbody tr': { transition: 'background-color 160ms ease' },
  '& tbody tr:hover': { backgroundColor: 'rgba(230, 248, 233, 0.42)' },
};

const tableHeadRowSx = {
  background: 'linear-gradient(90deg, #eff8eb 0%, #f8fcf5 100%)',
  '& th': {
    color: GREEN_UI.greenDark,
    fontWeight: 900,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    py: 1.7,
  },
};

const iconTileSx = {
  width: 42,
  height: 42,
  borderRadius: '16px',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
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
        caption: 'Requests waiting for supervisor review',
        value: loading ? '…' : String(stats.pendingRequests),
        icon: <Timelapse />,
        bg: GREEN_UI.amberSoft,
        color: GREEN_UI.amberDark,
      },
      {
        title: 'Published Schedules',
        caption: 'Approved schedules visible to employees',
        value: loading ? '…' : String(stats.publishedSchedules),
        icon: <EventAvailable />,
        bg: GREEN_UI.greenSoft,
        color: GREEN_UI.greenDark,
      },
      {
        title: 'Evaluations Submitted',
        caption: 'Performance evaluations already submitted',
        value: loading ? '…' : String(stats.evaluationsSubmitted),
        icon: <QueryStats />,
        bg: GREEN_UI.tealSoft,
        color: GREEN_UI.tealDark,
      },
    ],
    [loading, stats],
  );

  const shortcuts = [
    { title: 'Schedule Management', caption: 'Create, publish, and monitor employee schedules.', icon: <CalendarMonth />, path: '/dashboard/schedule', bg: GREEN_UI.greenSoft, color: GREEN_UI.greenDark },
    { title: 'Request Inbox', caption: 'Review leave, overtime, and undertime requests.', icon: <Assignment />, path: '/dashboard/requests', bg: GREEN_UI.amberSoft, color: GREEN_UI.amberDark },
    { title: 'Evaluate Employees', caption: 'Submit performance evaluations and check progress.', icon: <QueryStats />, path: '/dashboard/evaluation', bg: GREEN_UI.tealSoft, color: GREEN_UI.tealDark },
    { title: 'Employee Directory', caption: 'View employee profiles assigned to your area.', icon: <PeopleAlt />, path: '/dashboard/employees', bg: '#f2e9fb', color: '#6e3f9a' },
  ];

  const lastUpdatedLabel = lastUpdatedAt
    ? `Last updated ${lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : 'Waiting for live data';

  return (
    <Box
      sx={{
        minHeight: '100%',
        p: { xs: 1.5, sm: 2.25, md: 3 },
        background: GREEN_UI.pageBg,
        color: GREEN_UI.text,
        borderRadius: { xs: 0, md: '32px' },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          ...softCardSx,
          p: { xs: 2, sm: 2.75, md: 3.25 },
          mb: 2.5,
          position: 'relative',
          overflow: 'hidden',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(239,250,235,0.96) 60%, rgba(225,248,224,0.94) 100%)',
          '&:before': {
            content: '""',
            position: 'absolute',
            width: 260,
            height: 260,
            borderRadius: '50%',
            right: -90,
            top: -110,
            background: 'rgba(76, 175, 80, 0.12)',
          },
          '&:after': {
            content: '""',
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: '50%',
            left: { xs: '70%', md: '44%' },
            bottom: -95,
            background: 'rgba(174, 222, 144, 0.18)',
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ maxWidth: 730 }}>
            <Chip
              icon={<TaskAlt sx={{ fontSize: '1rem !important' }} />}
              label="Supervisor Workspace"
              size="small"
              sx={{
                mb: 1.2,
                bgcolor: GREEN_UI.greenSoft,
                color: GREEN_UI.greenDark,
                fontWeight: 900,
                borderRadius: 999,
                '& .MuiChip-icon': { color: GREEN_UI.greenDark },
              }}
            />
            <Typography
              variant="h4"
              fontWeight={900}
              sx={{
                fontSize: { xs: '1.55rem', sm: '2rem', md: '2.35rem' },
                color: GREEN_UI.text,
                letterSpacing: '-0.04em',
                lineHeight: 1.08,
                mb: 0.75,
              }}
            >
              Supervisor Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: GREEN_UI.muted, maxWidth: 670, lineHeight: 1.7 }}>
              Welcome, {currentUserName}. Monitor published schedules, review pending employee requests, and track submitted evaluations in one clean workspace.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={(loading || refreshing) ? <CircularProgress size={14} sx={{ color: `${GREEN_UI.greenDark} !important` }} /> : <TaskAlt sx={{ fontSize: '1rem !important' }} />}
              label={loading ? 'Loading live stats…' : refreshing ? 'Refreshing live stats…' : lastUpdatedLabel}
              size="small"
              sx={{
                maxWidth: { xs: '100%', sm: 260 },
                borderRadius: 999,
                bgcolor: '#f8fcf5',
                color: GREEN_UI.muted,
                fontWeight: 800,
                border: `1px solid ${GREEN_UI.border}`,
                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                '& .MuiChip-icon': { color: GREEN_UI.greenDark },
              }}
            />
            <Button
              variant="contained"
              startIcon={(loading || refreshing) ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
              onClick={() => void loadDashboardStats(false)}
              disabled={loading || refreshing}
              sx={{
                ...pillButtonSx,
                py: 1.1,
                bgcolor: GREEN_UI.green,
                boxShadow: '0 12px 24px rgba(58, 168, 101, 0.25)',
                '&:hover': { bgcolor: GREEN_UI.greenDark, boxShadow: '0 16px 28px rgba(31, 122, 70, 0.28)' },
              }}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {errorMessage && !loading && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: '18px', border: `1px solid ${GREEN_UI.border}` }}
          action={
            <Button color="inherit" size="small" onClick={() => void loadDashboardStats(false)} sx={{ ...pillButtonSx }}>
              Retry
            </Button>
          }
        >
          {errorMessage}
        </Alert>
      )}

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {statCards.map((stat) => (
          <Grid key={stat.title} size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper
              elevation={0}
              sx={{
                ...softCardSx,
                p: 2,
                minHeight: 126,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 180ms ease, box-shadow 180ms ease',
                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 22px 48px rgba(43, 91, 55, 0.13)' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                <Box>
                  <Typography variant="body2" sx={{ color: GREEN_UI.muted, fontWeight: 800 }}>
                    {stat.title}
                  </Typography>
                  <Typography variant="h4" fontWeight={900} sx={{ color: GREEN_UI.text, mt: 0.5, letterSpacing: '-0.04em' }}>
                    {stat.value}
                  </Typography>
                </Box>
                <Box sx={{ ...iconTileSx, bgcolor: stat.bg, color: stat.color }}>
                  {stat.icon}
                </Box>
              </Box>
              <Typography variant="caption" sx={{ color: GREEN_UI.muted, mt: 1.2 }}>
                {stat.caption}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.4 }, mb: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ ...iconTileSx, width: 40, height: 40, bgcolor: GREEN_UI.greenSoft, color: GREEN_UI.greenDark }}>
              <Assignment />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                Quick Actions
              </Typography>
              <Typography variant="caption" sx={{ color: GREEN_UI.muted, fontWeight: 600 }}>
                Jump directly to the supervisor tools you use most.
              </Typography>
            </Box>
          </Box>
        </Box>
        <Divider sx={{ borderColor: GREEN_UI.border, mb: 2 }} />
        <Grid container spacing={1.5}>
          {shortcuts.map((shortcut) => (
            <Grid key={shortcut.title} size={{ xs: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate(shortcut.path)}
                sx={{
                  ...innerCardSx,
                  minHeight: 104,
                  p: 1.75,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  color: GREEN_UI.text,
                  textTransform: 'none',
                  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: shortcut.color,
                    bgcolor: '#ffffff',
                    boxShadow: '0 18px 36px rgba(43, 91, 55, 0.12)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', width: '100%' }}>
                  <Box sx={{ ...iconTileSx, width: 38, height: 38, bgcolor: shortcut.bg, color: shortcut.color }}>
                    {shortcut.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={900} sx={{ color: GREEN_UI.text, lineHeight: 1.2 }}>
                      {shortcut.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: GREEN_UI.muted, display: 'block', mt: 0.5, lineHeight: 1.45 }}>
                      {shortcut.caption}
                    </Typography>
                  </Box>
                </Box>
              </Button>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Grid container spacing={2.5} alignItems="stretch">
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper elevation={0} sx={{ ...softCardSx, overflow: 'hidden', height: '100%' }}>
            <Box sx={{ p: { xs: 2, sm: 2.4 }, pb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                  <Box sx={{ ...iconTileSx, bgcolor: GREEN_UI.greenSoft, color: GREEN_UI.greenDark }}>
                    <EventAvailable />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="h6" fontWeight={900} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                        Published Schedules
                      </Typography>
                      <Chip
                        label={stats.publishedSchedules}
                        size="small"
                        sx={{ borderRadius: 999, bgcolor: GREEN_UI.greenSoft, color: GREEN_UI.greenDark, fontWeight: 900 }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: GREEN_UI.muted, fontWeight: 600 }}>
                      Latest schedules currently visible to employees.
                    </Typography>
                  </Box>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CalendarMonth />}
                  onClick={() => navigate('/dashboard/schedule')}
                  sx={{
                    ...pillButtonSx,
                    borderColor: GREEN_UI.borderStrong,
                    color: GREEN_UI.greenDark,
                    '&:hover': { borderColor: GREEN_UI.green, bgcolor: GREEN_UI.greenSoft },
                  }}
                >
                  Manage Schedules
                </Button>
              </Box>
            </Box>
            {refreshing && !loading && <LinearProgress sx={{ bgcolor: '#edf7eb', '& .MuiLinearProgress-bar': { bgcolor: GREEN_UI.green } }} />}
            <Divider sx={{ borderColor: GREEN_UI.border }} />

            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 7, gap: 2 }}>
                <CircularProgress size={28} sx={{ color: GREEN_UI.green }} />
                <Typography sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>Loading schedules…</Typography>
              </Box>
            ) : publishedSchedules.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 7, px: 2 }}>
                <Box sx={{ ...iconTileSx, width: 58, height: 58, bgcolor: GREEN_UI.greenSoft, color: GREEN_UI.greenDark, mx: 'auto', mb: 1.5 }}>
                  <CalendarMonth sx={{ fontSize: 30 }} />
                </Box>
                <Typography fontWeight={900} sx={{ color: GREEN_UI.text }}>No published schedules yet.</Typography>
                <Typography variant="body2" sx={{ color: GREEN_UI.muted, mt: 0.5 }}>
                  Go to Schedule Management to create and publish employee schedules.
                </Typography>
              </Box>
            ) : (
              <TableContainer
                sx={{
                  overflowX: 'auto',
                  '&::-webkit-scrollbar': { height: 10 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: '#cfe8d1', borderRadius: 999 },
                }}
              >
                <Table sx={tableSx}>
                  <TableHead>
                    <TableRow sx={tableHeadRowSx}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Employee</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Week / Period</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Outlet</TableCell>
                      {DAY_LABELS.map((day) => (
                        <TableCell key={day} sx={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {day}
                        </TableCell>
                      ))}
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {publishedSchedules.map((schedule) => (
                      <TableRow key={schedule.id} hover>
                        <TableCell sx={{ fontWeight: 900, color: GREEN_UI.text, whiteSpace: 'nowrap' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ ...iconTileSx, width: 32, height: 32, borderRadius: '12px', bgcolor: GREEN_UI.greenSoft, color: GREEN_UI.greenDark }}>
                              <PeopleAlt sx={{ fontSize: 18 }} />
                            </Box>
                            <Box>
                              <Typography variant="body2" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                                {schedule.employee}
                              </Typography>
                              <Typography variant="caption" sx={{ color: GREEN_UI.muted }}>
                                {schedule.employeeId || 'Employee'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: GREEN_UI.muted, fontSize: '0.82rem', fontWeight: 700 }}>
                          {schedule.week}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: GREEN_UI.muted, fontSize: '0.82rem', fontWeight: 700 }}>
                          {schedule.outlet}
                        </TableCell>
                        {DAY_KEYS.map((day) => {
                          const value = schedule[day] as string | undefined;
                          const normalizedValue = normalizeText(value);
                          const isOff = !value || normalizedValue === 'off' || normalizedValue === 'rest';

                          return (
                            <TableCell key={String(day)} sx={{ textAlign: 'center', p: '7px 5px' }}>
                              {isOff ? (
                                <Typography variant="caption" sx={{ color: '#a4b2a7', fontWeight: 900 }}>
                                  —
                                </Typography>
                              ) : (
                                <Chip
                                  label={value}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    height: 23,
                                    borderRadius: 999,
                                    bgcolor: '#fbfef9',
                                    color: GREEN_UI.greenDark,
                                    borderColor: GREEN_UI.borderStrong,
                                    fontSize: '0.68rem',
                                    fontWeight: 900,
                                    '& .MuiChip-label': { px: 0.8 },
                                  }}
                                />
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <Chip
                            label="Published"
                            size="small"
                            icon={<TaskAlt sx={{ fontSize: '1rem !important' }} />}
                            sx={{
                              borderRadius: 999,
                              bgcolor: GREEN_UI.greenSoft,
                              color: GREEN_UI.greenDark,
                              fontWeight: 900,
                              '& .MuiChip-icon': { color: GREEN_UI.greenDark },
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} sx={{ ...softCardSx, p: { xs: 2, sm: 2.4 }, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ ...iconTileSx, bgcolor: GREEN_UI.amberSoft, color: GREEN_UI.amberDark }}>
                  <Timelapse />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="h6" fontWeight={900} sx={{ color: GREEN_UI.text, letterSpacing: '-0.02em' }}>
                      Pending Requests
                    </Typography>
                    <Chip
                      label={stats.pendingRequests}
                      size="small"
                      sx={{ borderRadius: 999, bgcolor: GREEN_UI.amberSoft, color: GREEN_UI.amberDark, fontWeight: 900 }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: GREEN_UI.muted, fontWeight: 600 }}>
                    Requests needing your next action.
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                onClick={() => navigate('/dashboard/requests')}
                sx={{ ...pillButtonSx, color: GREEN_UI.greenDark, bgcolor: GREEN_UI.greenSoft, '&:hover': { bgcolor: '#d8f1dd' } }}
              >
                View All
              </Button>
            </Box>
            <Divider sx={{ borderColor: GREEN_UI.border, mb: 1.5 }} />

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 7, gap: 1.5 }}>
                <CircularProgress size={24} sx={{ color: GREEN_UI.green }} />
                <Typography sx={{ color: GREEN_UI.muted, fontWeight: 700 }}>Loading requests…</Typography>
              </Box>
            ) : pendingRequests.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 7, px: 2 }}>
                <Box sx={{ ...iconTileSx, width: 58, height: 58, bgcolor: GREEN_UI.greenSoft, color: GREEN_UI.greenDark, mx: 'auto', mb: 1.5 }}>
                  <TaskAlt sx={{ fontSize: 30 }} />
                </Box>
                <Typography fontWeight={900} sx={{ color: GREEN_UI.text }}>No pending requests</Typography>
                <Typography variant="body2" sx={{ color: GREEN_UI.muted, mt: 0.5 }}>
                  All clear for now.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                {pendingRequests.map((request) => (
                  <Paper key={request.id} elevation={0} sx={{ ...innerCardSx, p: 1.6 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.2, alignItems: 'flex-start' }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap', mb: 0.7 }}>
                          <Typography variant="body2" fontWeight={900} sx={{ color: GREEN_UI.text }}>
                            {request.employee}
                          </Typography>
                          <Chip
                            label={request.type}
                            size="small"
                            sx={{
                              height: 24,
                              borderRadius: 999,
                              bgcolor: GREEN_UI.amberSoft,
                              color: GREEN_UI.amberDark,
                              fontWeight: 900,
                              '& .MuiChip-label': { px: 1 },
                            }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: GREEN_UI.muted, display: 'block', fontWeight: 700 }}>
                          {request.requestId} · {request.dateLabel}
                        </Typography>
                        <Typography variant="body2" sx={{ color: GREEN_UI.muted, mt: 0.75, lineHeight: 1.5 }}>
                          {request.reason ? request.reason.slice(0, 96) : 'No reason provided'}
                          {request.reason && request.reason.length > 96 ? '…' : ''}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate('/dashboard/requests')}
                        sx={{
                          ...pillButtonSx,
                          minWidth: 74,
                          borderColor: GREEN_UI.borderStrong,
                          color: GREEN_UI.greenDark,
                          '&:hover': { borderColor: GREEN_UI.green, bgcolor: GREEN_UI.greenSoft },
                        }}
                      >
                        Review
                      </Button>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
