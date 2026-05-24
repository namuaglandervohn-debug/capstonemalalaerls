import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  Snackbar,
  Tooltip,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import { AddCircleOutline, TaskAlt, CancelOutlined, Sync, Security } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from "../../lib/supabaseClient";

type RequestType = 'Leave' | 'Overtime' | 'Undertime';
type RequestStatus = 'Pending' | 'Supervisor Approved' | 'Approved' | 'Disapproved' | 'Rejected' | 'Cancelled';

type SnackbarSeverity = 'success' | 'error' | 'info' | 'warning';

interface RequestRecord {
  id: string;
  requestId: string;
  databaseRequestId?: string;
  employeeId: string;
  employee: string;
  type: RequestType;
  leaveType?: string | null;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  totalDays?: number | null;
  totalHours?: number | null;
  reason: string;
  status: RequestStatus;
  supervisorStatus?: string | null;
  supervisorNote?: string | null;
  supervisorName?: string | null;
  hrStatus?: string | null;
  hrNote?: string | null;
  hrName?: string | null;
  submittedDate: string;
}

interface NewRequestState {
  type: RequestType;
  leaveType: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
}

const EMPTY: NewRequestState = {
  type: 'Leave',
  leaveType: 'Vacation Leave',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  reason: '',
};

const REQUEST_SELECT = `
  id,
  request_id,
  employee_id,
  request_type,
  leave_type,
  start_date,
  end_date,
  start_time,
  end_time,
  total_days,
  total_hours,
  reason,
  status,
  supervisor_status,
  supervisor_note,
  supervisor_name,
  hr_status,
  hr_note,
  hr_name,
  created_at,
  employees:employees!employee_requests_employee_id_fkey (
    employee_id,
    first_name,
    middle_name,
    last_name,
    suffix
  )
`;

const STATUS_CHIP: Record<string, { color: any; label: string }> = {
  Pending: { color: 'warning', label: 'Pending' },
  'Supervisor Approved': { color: 'info', label: 'Supervisor Approved' },
  Approved: { color: 'success', label: 'HR Approved' },
  Disapproved: { color: 'error', label: 'Disapproved' },
  Rejected: { color: 'error', label: 'Rejected' },
  Cancelled: { color: 'default', label: 'Cancelled' },
};

const LEAVE_TYPES = [
  'Vacation Leave',
  'Sick Leave',
  'Emergency Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Bereavement Leave',
  'Other',
];

function normalizeRole(role?: string | null) {
  return String(role ?? '').trim().toLowerCase();
}

function getUserName(currentUser: any) {
  const directName = currentUser?.name || currentUser?.full_name;
  if (directName) return directName;

  const fullName = [currentUser?.first_name, currentUser?.middle_name, currentUser?.last_name, currentUser?.suffix]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return fullName || currentUser?.email || 'User';
}

function getReviewerUserId(currentUser: any) {
  return currentUser?.user_id || null;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const dateOnly = value.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateOnly;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  return value.slice(0, 5);
}

function computeTotalDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / 86_400_000) + 1;
}

function computeTotalHours(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  if ([startHour, startMinute, endHour, endMinute].some(value => Number.isNaN(value))) return 0;

  let diffMinutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (diffMinutes < 0) diffMinutes += 24 * 60;

  return Number((diffMinutes / 60).toFixed(2));
}

const SEQUENTIAL_REQUEST_ID_REGEX = /^REQ-(\d{4})-(\d+)$/i;

function getRequestYear(value?: string | null) {
  if (!value) return new Date().getFullYear();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
}

function buildSequentialRequestId(year: number, sequence: number) {
  return `REQ-${year}-${String(sequence).padStart(4, '0')}`;
}

function applyDisplayRequestIds(records: RequestRecord[]) {
  const usedSequenceByYear = new Map<number, Set<number>>();
  const assignedDisplayId = new Map<string, string>();

  records.forEach(record => {
    const match = String(record.databaseRequestId ?? record.requestId ?? '').match(SEQUENTIAL_REQUEST_ID_REGEX);
    if (!match) return;

    const year = Number(match[1]);
    const sequence = Number(match[2]);

    if (!Number.isFinite(year) || !Number.isFinite(sequence)) return;

    if (!usedSequenceByYear.has(year)) usedSequenceByYear.set(year, new Set<number>());
    usedSequenceByYear.get(year)?.add(sequence);
    assignedDisplayId.set(record.id, buildSequentialRequestId(year, sequence));
  });

  const nextSequenceByYear = new Map<number, number>();
  const sortedRecords = [...records].sort((a, b) => {
    const dateA = new Date(a.submittedDate || '').getTime();
    const dateB = new Date(b.submittedDate || '').getTime();
    const safeDateA = Number.isNaN(dateA) ? 0 : dateA;
    const safeDateB = Number.isNaN(dateB) ? 0 : dateB;

    if (safeDateA !== safeDateB) return safeDateA - safeDateB;
    return a.id.localeCompare(b.id);
  });

  sortedRecords.forEach(record => {
    if (assignedDisplayId.has(record.id)) return;

    const year = getRequestYear(record.submittedDate);
    if (!usedSequenceByYear.has(year)) usedSequenceByYear.set(year, new Set<number>());

    const usedSequences = usedSequenceByYear.get(year)!;
    let nextSequence = nextSequenceByYear.get(year) ?? 1;

    while (usedSequences.has(nextSequence)) {
      nextSequence += 1;
    }

    usedSequences.add(nextSequence);
    nextSequenceByYear.set(year, nextSequence + 1);
    assignedDisplayId.set(record.id, buildSequentialRequestId(year, nextSequence));
  });

  return records.map(record => ({
    ...record,
    requestId: assignedDisplayId.get(record.id) ?? record.requestId,
  }));
}

function mapRequestRow(row: any): RequestRecord {
  const employeeRow = Array.isArray(row.employees) ? row.employees[0] : row.employees;
  const employeeName = [employeeRow?.first_name, employeeRow?.middle_name, employeeRow?.last_name, employeeRow?.suffix]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    id: row.id,
    requestId: row.request_id || row.id,
    databaseRequestId: row.request_id || row.id,
    employeeId: row.employee_id || '',
    employee: employeeName || row.employee_id || 'Unknown Employee',
    type: row.request_type as RequestType,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    totalDays: row.total_days,
    totalHours: row.total_hours,
    reason: row.reason || '',
    status: (row.status || 'Pending') as RequestStatus,
    supervisorStatus: row.supervisor_status,
    supervisorNote: row.supervisor_note,
    supervisorName: row.supervisor_name,
    hrStatus: row.hr_status,
    hrNote: row.hr_note,
    hrName: row.hr_name,
    submittedDate: row.created_at,
  };
}

export default function RequestManagement() {
  const { user } = useAuth();
  const currentUser = user as any;

  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedReq, setSelectedReq] = useState<RequestRecord | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [newRequest, setNewRequest] = useState<NewRequestState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as SnackbarSeverity,
  });

  const role = normalizeRole(currentUser?.role);
  const isSupervisor = role.includes('supervisor');
  const isHR = role === 'hr_admin' || role.includes('hr') || role.includes('admin') || role.includes('human resource');
  const isGM = role === 'general_manager' || role.includes('general manager') || role.includes('general_manager');
  const isEmployee = role === 'employee' || role.includes('employee');

  const resolveCurrentEmployeeId = async () => {
    if (currentUser?.employee_id) return currentUser.employee_id as string;

    if (currentUser?.email) {
      const { data: account } = await supabase
        .from('user_accounts')
        .select('employee_id')
        .eq('email', currentUser.email)
        .maybeSingle();

      if (account?.employee_id) return account.employee_id as string;

      const { data: employee } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('email', currentUser.email)
        .maybeSingle();

      if (employee?.employee_id) return employee.employee_id as string;
    }

    return null;
  };

  const generateNextRequestId = async () => {
    const year = new Date().getFullYear();
    const startOfYear = `${year}-01-01T00:00:00.000Z`;
    const startOfNextYear = `${year + 1}-01-01T00:00:00.000Z`;

    const { data, error: sequenceError } = await supabase
      .from('employee_requests')
      .select('request_id, created_at')
      .gte('created_at', startOfYear)
      .lt('created_at', startOfNextYear);

    if (sequenceError) throw sequenceError;

    const usedSequences = new Set<number>();
    const recordsThisYear = data ?? [];

    recordsThisYear.forEach(row => {
      const match = String(row.request_id ?? '').match(SEQUENTIAL_REQUEST_ID_REGEX);
      if (!match || Number(match[1]) !== year) return;

      const sequence = Number(match[2]);
      if (Number.isFinite(sequence)) usedSequences.add(sequence);
    });

    let nextSequence = 1;
    while (usedSequences.has(nextSequence)) {
      nextSequence += 1;
    }

    /*
      Legacy records may still have request IDs like REQ-AB3D15D9A9.
      This keeps new IDs from duplicating the display sequence assigned to those old rows.
    */
    nextSequence = Math.max(nextSequence, recordsThisYear.length + 1);

    return buildSequentialRequestId(year, nextSequence);
  };

  const fetchRequests = async (employeeIdOverride?: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const employeeIdForFilter = employeeIdOverride ?? currentEmployeeId;

      if (isEmployee && !employeeIdForFilter && !isHR && !isSupervisor && !isGM) {
        setRequests([]);
        setError('Your account is not linked to an employee record yet. Please make sure your user account has an employee_id.');
        return;
      }

      let query = supabase
        .from('employee_requests')
        .select(REQUEST_SELECT)
        .order('created_at', { ascending: false });

      if (isEmployee && !isHR && !isSupervisor && !isGM && employeeIdForFilter) {
        query = query.eq('employee_id', employeeIdForFilter);
      }

      const { data, error: requestError } = await query;

      if (requestError) throw requestError;

      setRequests(applyDisplayRequestIds((data ?? []).map(mapRequestRow)));
    } catch (e: any) {
      setError(`Could not load requests: ${e.message ?? 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      setLoading(true);
      try {
        const employeeId = await resolveCurrentEmployeeId();
        if (!active) return;
        setCurrentEmployeeId(employeeId);
        await fetchRequests(employeeId);
      } catch (e: any) {
        if (!active) return;
        setError(`Could not initialize requests: ${e.message ?? 'Unknown error'}`);
        setLoading(false);
      }
    };

    initialize();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.email, currentUser?.employee_id, currentUser?.role]);

  const handleSubmit = async () => {
    const startDate = newRequest.startDate;
    const endDate = newRequest.type === 'Undertime' ? newRequest.startDate : newRequest.endDate || newRequest.startDate;
    const reason = newRequest.reason.trim();

    if (!currentEmployeeId) {
      setSnackbar({
        open: true,
        message: 'Your account is not linked to an employee record. Please add employee_id to your user account first.',
        severity: 'error',
      });
      return;
    }

    if (!startDate || !endDate || !reason) {
      setSnackbar({ open: true, message: 'Please complete the required date and reason fields.', severity: 'error' });
      return;
    }

    if (endDate < startDate) {
      setSnackbar({ open: true, message: 'End date cannot be earlier than start date.', severity: 'error' });
      return;
    }

    if (newRequest.type === 'Leave' && !newRequest.leaveType) {
      setSnackbar({ open: true, message: 'Please select a leave type.', severity: 'error' });
      return;
    }

    if ((newRequest.type === 'Overtime' || newRequest.type === 'Undertime') && (!newRequest.startTime || !newRequest.endTime)) {
      setSnackbar({ open: true, message: 'Please provide start time and end time.', severity: 'error' });
      return;
    }

    setSaving(true);

    try {
      const totalDays = newRequest.type === 'Leave' ? computeTotalDays(startDate, endDate) : 0;
      const totalHours = newRequest.type === 'Overtime' || newRequest.type === 'Undertime'
        ? computeTotalHours(newRequest.startTime, newRequest.endTime)
        : 0;

      const generatedRequestId = await generateNextRequestId();

      const payload = {
        request_id: generatedRequestId,
        employee_id: currentEmployeeId,
        request_type: newRequest.type,
        leave_type: newRequest.type === 'Leave' ? newRequest.leaveType : null,
        start_date: startDate,
        end_date: endDate,
        start_time: newRequest.type === 'Leave' ? null : newRequest.startTime,
        end_time: newRequest.type === 'Leave' ? null : newRequest.endTime,
        total_days: totalDays,
        total_hours: totalHours,
        reason,
        status: 'Pending',
        supervisor_status: 'Pending',
        hr_status: 'Pending',
      };

      const { data, error: insertError } = await supabase
        .from('employee_requests')
        .insert(payload)
        .select(REQUEST_SELECT)
        .single();

      if (insertError) throw insertError;

      setRequests(prev => applyDisplayRequestIds([mapRequestRow(data), ...prev]));
      setOpenDialog(false);
      setNewRequest(EMPTY);
      setSnackbar({ open: true, message: '✅ Request submitted successfully!', severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed to submit request: ${e.message ?? 'Unknown error'}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updateRequest = async (id: string, update: Record<string, any>, successMsg: string) => {
    try {
      const { data, error: updateError } = await supabase
        .from('employee_requests')
        .update(update)
        .eq('id', id)
        .select(REQUEST_SELECT)
        .single();

      if (updateError) throw updateError;

      const updatedRecord = mapRequestRow(data);
      setRequests(prev => {
        const existingDisplayId = prev.find(r => r.id === id)?.requestId;
        return applyDisplayRequestIds(prev.map(r => (r.id === id ? { ...updatedRecord, requestId: existingDisplayId ?? updatedRecord.requestId } : r)));
      });
      if (selectedReq?.id === id) {
        setSelectedReq({ ...updatedRecord, requestId: selectedReq.requestId });
      }
      setSnackbar({ open: true, message: successMsg, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed to update request: ${e.message ?? 'Unknown error'}`, severity: 'error' });
    }
  };

  const supervisorApprove = (id: string) => updateRequest(
    id,
    {
      status: 'Supervisor Approved',
      supervisor_status: 'Approved',
      supervisor_note: noteInput.trim() || null,
      supervisor_name: getUserName(currentUser),
      supervisor_user_id: getReviewerUserId(currentUser),
      supervisor_reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: getReviewerUserId(currentUser),
      reviewed_at: new Date().toISOString(),
      reviewer_remarks: noteInput.trim() || null,
    },
    '✅ Request approved by Supervisor and forwarded to HR for final validation.'
  );

  const supervisorDisapprove = (id: string) => updateRequest(
    id,
    {
      status: 'Disapproved',
      supervisor_status: 'Disapproved',
      supervisor_note: noteInput.trim() || null,
      supervisor_name: getUserName(currentUser),
      supervisor_user_id: getReviewerUserId(currentUser),
      supervisor_reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: getReviewerUserId(currentUser),
      reviewed_at: new Date().toISOString(),
      reviewer_remarks: noteInput.trim() || null,
    },
    '❌ Request disapproved by Supervisor.'
  );

  const hrApprove = (id: string) => updateRequest(
    id,
    {
      status: 'Approved',
      hr_status: 'Approved',
      hr_note: noteInput.trim() || null,
      hr_name: getUserName(currentUser),
      hr_user_id: getReviewerUserId(currentUser),
      hr_reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: getReviewerUserId(currentUser),
      reviewed_at: new Date().toISOString(),
      reviewer_remarks: noteInput.trim() || null,
    },
    '✅ Request validated and fully approved by HR.'
  );

  const hrReject = (id: string) => updateRequest(
    id,
    {
      status: 'Disapproved',
      hr_status: 'Disapproved',
      hr_note: noteInput.trim() || null,
      hr_name: getUserName(currentUser),
      hr_user_id: getReviewerUserId(currentUser),
      hr_reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: getReviewerUserId(currentUser),
      reviewed_at: new Date().toISOString(),
      reviewer_remarks: noteInput.trim() || null,
    },
    '❌ Request rejected by HR.'
  );

  const cancelRequest = (id: string) => updateRequest(
    id,
    { status: 'Cancelled' },
    'Request cancelled.'
  );

  const handleDelete = async (request: RequestRecord) => {
    if (!window.confirm(`Delete request ${request.requestId}? This cannot be undone.`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('employee_requests')
        .delete()
        .eq('id', request.id);

      if (deleteError) throw deleteError;

      setRequests(prev => prev.filter(r => r.id !== request.id));
      setSnackbar({ open: true, message: `🗑️ Request ${request.requestId} deleted.`, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: `Failed to delete request: ${e.message ?? 'Unknown error'}`, severity: 'error' });
    }
  };

  const tabData = [
    { label: 'All', data: requests },
    { label: 'Pending', data: requests.filter(r => r.status === 'Pending') },
    { label: 'Supervisor Approved', data: requests.filter(r => r.status === 'Supervisor Approved') },
    { label: 'Approved', data: requests.filter(r => r.status === 'Approved') },
    { label: 'Disapproved', data: requests.filter(r => r.status === 'Disapproved' || r.status === 'Rejected') },
    { label: 'Cancelled', data: requests.filter(r => r.status === 'Cancelled') },
  ];

  const displayData = tabData[tab]?.data ?? requests;

  const resetNewRequestType = (type: RequestType) => {
    setNewRequest(prev => ({
      ...prev,
      type,
      leaveType: type === 'Leave' ? prev.leaveType || 'Vacation Leave' : '',
      startTime: type === 'Leave' ? '' : prev.startTime,
      endTime: type === 'Leave' ? '' : prev.endTime,
      endDate: type === 'Undertime' ? prev.startDate : prev.endDate,
    }));
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            Leave, Overtime & Undertime Requests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isSupervisor
              ? 'Inbox: Review and approve/disapprove employee requests.'
              : isHR
                ? 'HR Validation: Confirm supervisor-approved requests for final approval.'
                : 'Submit and track your requests.'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={() => fetchRequests(currentEmployeeId)} disabled={loading}>
                <Sync />
              </IconButton>
            </span>
          </Tooltip>
          {(isEmployee || Boolean(currentEmployeeId)) && (
            <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setOpenDialog(true)}>
              New Request
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" onClick={() => fetchRequests(currentEmployeeId)}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {(isSupervisor || isHR) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>Two-Step Approval Flow:</strong> Employee submits → <strong>Supervisor</strong> reviews and approves → <strong>HR</strong> validates for final approval.
          {isSupervisor && ' You can approve or disapprove Pending requests.'}
          {isHR && ' You validate Supervisor Approved requests for final HR approval.'}
        </Alert>
      )}

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
          {tabData.map((tabItem, index) => (
            <Tab key={tabItem.label} label={`${tabItem.label} (${tabItem.data.length})`} value={index} />
          ))}
        </Tabs>
      </Paper>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading requests…</Typography>
          </Box>
        ) : (
          <Table sx={{ minWidth: 950 }}>
            <TableHead>
              <TableRow>
                <TableCell>Request ID</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Date Coverage</TableCell>
                <TableCell>Time / Total</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No requests in this category.
                  </TableCell>
                </TableRow>
              ) : (
                displayData.map(req => {
                  const chip = STATUS_CHIP[req.status] ?? { color: 'default', label: req.status };
                  const canSupervisorReview = isSupervisor && req.status === 'Pending';
                  const canHrReview = isHR && req.status === 'Supervisor Approved';
                  const canCancel = isEmployee && req.status === 'Pending' && req.employeeId === currentEmployeeId;

                  return (
                    <TableRow key={req.id} hover>
                      <TableCell>
                        <Chip label={req.requestId} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{req.employee}</TableCell>
                      <TableCell>
                        <Chip
                          label={req.type}
                          size="small"
                          color={req.type === 'Leave' ? 'info' : req.type === 'Overtime' ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>
                        {formatDate(req.startDate)} {req.endDate && req.endDate !== req.startDate ? `– ${formatDate(req.endDate)}` : ''}
                      </TableCell>
                      <TableCell>
                        {req.type === 'Leave'
                          ? `${req.totalDays ?? computeTotalDays(req.startDate, req.endDate)} day(s)`
                          : `${formatTime(req.startTime)} – ${formatTime(req.endTime)} (${req.totalHours ?? 0} hr/s)`}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.reason}
                      </TableCell>
                      <TableCell>{formatDate(req.submittedDate)}</TableCell>
                      <TableCell>
                        <Chip label={chip.label} size="small" color={chip.color} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                          <Chip
                            label="View Details"
                            size="small"
                            clickable
                            variant="outlined"
                            color="primary"
                            onClick={() => {
                              setSelectedReq(req);
                              setNoteInput('');
                              setViewDialog(true);
                            }}
                            sx={{ minWidth: 115 }}
                          />

                          {(canSupervisorReview || canHrReview) && (
                            <Chip
                              label={canHrReview ? 'Validate' : 'Review'}
                              size="small"
                              clickable
                              variant="outlined"
                              color="success"
                              onClick={() => {
                                setSelectedReq(req);
                                setNoteInput('');
                                setViewDialog(true);
                              }}
                              sx={{ minWidth: 115 }}
                            />
                          )}

                          {canCancel && (
                            <Chip
                              label="Cancel"
                              size="small"
                              clickable
                              variant="outlined"
                              color="warning"
                              onClick={() => cancelRequest(req.id)}
                              sx={{ minWidth: 115 }}
                            />
                          )}

                          {isHR && (
                            <Chip
                              label="Delete"
                              size="small"
                              clickable
                              variant="outlined"
                              color="error"
                              onClick={() => handleDelete(req)}
                              sx={{ minWidth: 115 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Submit New Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                select
                label="Request Type"
                value={newRequest.type}
                onChange={event => resetNewRequestType(event.target.value as RequestType)}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="Leave">Leave</MenuItem>
                <MenuItem value="Overtime">Overtime</MenuItem>
                <MenuItem value="Undertime">Undertime</MenuItem>
              </TextField>
            </Grid>

            {newRequest.type === 'Leave' && (
              <Grid size={12}>
                <TextField
                  fullWidth
                  select
                  label="Leave Type"
                  value={newRequest.leaveType}
                  onChange={event => setNewRequest({ ...newRequest, leaveType: event.target.value })}
                  InputLabelProps={{ shrink: true }}
                >
                  {LEAVE_TYPES.map(type => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}

            {newRequest.type === 'Undertime' ? (
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Date of Undertime"
                  type="date"
                  value={newRequest.startDate}
                  onChange={event => setNewRequest({ ...newRequest, startDate: event.target.value, endDate: event.target.value })}
                  InputLabelProps={{ shrink: true }}
                  helperText="Undertime applies to a single specific date only."
                />
              </Grid>
            ) : (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Start Date"
                    type="date"
                    value={newRequest.startDate}
                    onChange={event => setNewRequest({ ...newRequest, startDate: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="End Date"
                    type="date"
                    value={newRequest.endDate}
                    onChange={event => setNewRequest({ ...newRequest, endDate: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}

            {(newRequest.type === 'Overtime' || newRequest.type === 'Undertime') && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Start Time"
                    type="time"
                    value={newRequest.startTime}
                    onChange={event => setNewRequest({ ...newRequest, startTime: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="End Time"
                    type="time"
                    value={newRequest.endTime}
                    onChange={event => setNewRequest({ ...newRequest, endTime: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                    helperText={
                      newRequest.startTime && newRequest.endTime
                        ? `Computed total: ${computeTotalHours(newRequest.startTime, newRequest.endTime)} hour(s)`
                        : 'Required for overtime and undertime.'
                    }
                  />
                </Grid>
              </>
            )}

            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason / Details"
                value={newRequest.reason}
                onChange={event => setNewRequest({ ...newRequest, reason: event.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saving ? 'Submitting…' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Request Details — {selectedReq?.requestId}</DialogTitle>
        <DialogContent>
          {selectedReq && (
            <Box sx={{ pt: 1 }}>
              {[
                ['Request ID', selectedReq.requestId],
                ['Employee', selectedReq.employee],
                ['Employee ID', selectedReq.employeeId],
                ['Type', selectedReq.type],
                ['Leave Type', selectedReq.type === 'Leave' ? selectedReq.leaveType || '—' : 'N/A'],
                ['Date Coverage', `${formatDate(selectedReq.startDate)}${selectedReq.endDate && selectedReq.endDate !== selectedReq.startDate ? ` – ${formatDate(selectedReq.endDate)}` : ''}`],
                ['Time Coverage', selectedReq.type === 'Leave' ? 'N/A' : `${formatTime(selectedReq.startTime)} – ${formatTime(selectedReq.endTime)}`],
                ['Total', selectedReq.type === 'Leave' ? `${selectedReq.totalDays ?? 0} day(s)` : `${selectedReq.totalHours ?? 0} hour(s)`],
                ['Reason', selectedReq.reason],
                ['Submitted', formatDate(selectedReq.submittedDate)],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={500} textAlign="right">{value}</Typography>
                </Box>
              ))}

              <Box sx={{ mt: 2 }}>
                <Chip
                  label={STATUS_CHIP[selectedReq.status]?.label ?? selectedReq.status}
                  color={STATUS_CHIP[selectedReq.status]?.color ?? 'default'}
                />
              </Box>

              {selectedReq.supervisorName && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Supervisor Review: {selectedReq.supervisorStatus || 'Reviewed'} by {selectedReq.supervisorName}
                  {selectedReq.supervisorNote ? ` — ${selectedReq.supervisorNote}` : ''}
                </Alert>
              )}

              {selectedReq.hrName && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  HR Review: {selectedReq.hrStatus || 'Reviewed'} by {selectedReq.hrName}
                  {selectedReq.hrNote ? ` — ${selectedReq.hrNote}` : ''}
                </Alert>
              )}

              {((isSupervisor && selectedReq.status === 'Pending') || (isHR && selectedReq.status === 'Supervisor Approved')) && (
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Note / Remarks (optional)"
                  value={noteInput}
                  onChange={event => setNoteInput(event.target.value)}
                  sx={{ mt: 2 }}
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setViewDialog(false)}>Close</Button>

          {isSupervisor && selectedReq?.status === 'Pending' && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelOutlined />}
                onClick={() => {
                  supervisorDisapprove(selectedReq.id);
                  setViewDialog(false);
                }}
              >
                Disapprove
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<TaskAlt />}
                onClick={() => {
                  supervisorApprove(selectedReq.id);
                  setViewDialog(false);
                }}
              >
                Approve
              </Button>
            </>
          )}

          {isHR && selectedReq?.status === 'Supervisor Approved' && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelOutlined />}
                onClick={() => {
                  hrReject(selectedReq.id);
                  setViewDialog(false);
                }}
              >
                Reject
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<Security />}
                onClick={() => {
                  hrApprove(selectedReq.id);
                  setViewDialog(false);
                }}
              >
                Validate & Approve
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(previous => ({ ...previous, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(previous => ({ ...previous, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
