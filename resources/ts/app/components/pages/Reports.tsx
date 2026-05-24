import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  TablePagination,
} from '@mui/material';
import {
  Print,
  GridView,
  Analytics as BarChartIcon,
  Sync,
  FileDownload,
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';

interface ReportData {
  [key: string]: any[];
}

interface ReportType {
  value: string;
  label: string;
  icon: JSX.Element;
}

const REPORT_TYPES: ReportType[] = [
  { value: 'employees', label: 'Employee Records', icon: <GridView /> },
  { value: 'applications', label: 'Recruitment / Applications', icon: <GridView /> },
  { value: 'schedules', label: 'Weekly Schedules', icon: <GridView /> },
  { value: 'attendance', label: 'Attendance Summary', icon: <GridView /> },
  { value: 'attendanceLogs', label: 'Attendance Logs', icon: <GridView /> },
  { value: 'payroll', label: 'Payroll Summary', icon: <GridView /> },
  { value: 'evaluations', label: 'Performance Evaluations', icon: <BarChartIcon /> },
  { value: 'dss', label: 'DSS Rankings', icon: <BarChartIcon /> },
  { value: 'requests', label: 'Leave / OT / Undertime Requests', icon: <GridView /> },
  { value: 'criteria', label: 'DSS Criteria & Weights', icon: <BarChartIcon /> },
  { value: 'systemLogs', label: 'System Logs', icon: <GridView /> },
];

const COLUMNS: Record<string, string[]> = {
  employees: ['id', 'name', 'position', 'outlet', 'employmentType', 'salary', 'status', 'contact', 'date'],
  applications: ['id', 'name', 'position', 'email', 'phone', 'dateApplied', 'status', 'hiringDecision'],
  schedules: ['id', 'employee', 'week', 'position', 'outlet', 'timeIn', 'timeOut', 'finalized', 'status'],
  attendance: [
    'id',
    'employee',
    'position',
    'outlet',
    'period',
    'presentDays',
    'absentDays',
    'incompleteDays',
    'lateMinutes',
    'undertimeMinutes',
    'overtimeMinutes',
    'workHours',
    'status',
  ],
  attendanceLogs: [
    'id',
    'employee',
    'date',
    'timeIn',
    'timeOut',
    'totalHours',
    'lateMinutes',
    'undertimeMinutes',
    'overtimeMinutes',
    'validationStatus',
    'source',
  ],
  payroll: [
    'id',
    'employee',
    'position',
    'outlet',
    'period',
    'regularHours',
    'overtimeHours',
    'grossPay',
    'deductions',
    'netPay',
    'status',
  ],
  evaluations: ['id', 'employee', 'position', 'outlet', 'period', 'rawScore', 'finalScore', 'rating', 'status'],
  dss: ['rank', 'employee', 'position', 'outlet', 'period', 'finalScore', 'rating', 'recommendation'],
  requests: ['id', 'employee', 'type', 'leaveType', 'date', 'time', 'reason', 'status', 'reviewerRemarks'],
  criteria: ['id', 'criteriaName', 'category', 'weight', 'maxScore', 'active', 'description'],
  systemLogs: ['id', 'userName', 'userRole', 'action', 'module', 'recordTable', 'description', 'date'],
};

const currencyColumns = new Set(['salary', 'grossPay', 'deductions', 'netPay']);
const percentColumns = new Set(['finalScore', 'rawScore', 'weight', 'maxScore']);
const statusColumns = new Set(['status', 'validationStatus', 'finalized', 'active']);

const getFullName = (row: any) =>
  [row?.first_name, row?.middle_name, row?.last_name, row?.suffix]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const toDateOnly = (value: any) => {
  if (!value) return '';
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
};

const money = (value: any) => {
  const n = Number(value ?? 0);
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatTime = (value: any) => {
  if (!value) return '—';
  return String(value).slice(0, 5);
};

const buildPeriod = (start: any, end: any, label?: string | null) => {
  if (label) return label;
  const s = toDateOnly(start);
  const e = toDateOnly(end);
  if (!s && !e) return '—';
  return s === e ? s : `${s} to ${e}`;
};

const labelize = (key: string) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace('Id', 'ID')
    .replace('Dss', 'DSS');

const getStatusColor = (value: any) => {
  const status = String(value ?? '').toLowerCase();
  if (
    ['active', 'approved', 'present', 'processed', 'hired', 'confirmed', 'published', 'validated', 'reviewed', 'endorsed', 'exported', 'true'].some(s =>
      status.includes(s),
    )
  ) {
    return 'success' as const;
  }
  if (
    ['pending', 'draft', 'under review', 'late', 'needs review', 'unprocessed'].some(s => status.includes(s))
  ) {
    return 'warning' as const;
  }
  if (
    ['resigned', 'not qualified', 'absent', 'disapproved', 'rejected', 'declined', 'cancelled', 'invalid', 'false'].some(s =>
      status.includes(s),
    )
  ) {
    return 'error' as const;
  }
  return 'default' as const;
};

export default function Reports() {
  const [reportType, setReportType] = useState('employees');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [allData, setAllData] = useState<ReportData>({});
  const [loadingAll, setLoadingAll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const printRef = useRef<HTMLDivElement>(null);

  const loadTable = async (tableName: string, orderColumn?: string) => {
    let query = supabase.from(tableName).select('*');

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: false });
    }

    const { data, error: tableError } = await query;
    if (tableError) {
      throw new Error(`${tableName}: ${tableError.message}`);
    }

    return data ?? [];
  };

  const fetchAll = async () => {
    setLoadingAll(true);
    setError(null);
    setWarning(null);

    const warnings: string[] = [];

    const safe = async (tableName: string, orderColumn?: string) => {
      try {
        return await loadTable(tableName, orderColumn);
      } catch (err: any) {
        warnings.push(err?.message ?? `Unable to load ${tableName}`);
        return [];
      }
    };

    try {
      const [
        employees,
        applicants,
        schedules,
        attendanceSummaries,
        attendanceLogs,
        payrollSummaries,
        payrollItems,
        requests,
        criteria,
        evaluations,
        dssResults,
        dssItems,
        systemLogs,
      ] = await Promise.all([
        safe('employees', 'created_at'),
        safe('applicants', 'created_at'),
        safe('schedule'),
        safe('attendance_summaries', 'created_at'),
        safe('attendance_logs', 'created_at'),
        safe('payroll_summaries', 'created_at'),
        safe('payroll_items', 'created_at'),
        safe('employee_requests', 'created_at'),
        safe('evaluation_criteria', 'created_at'),
        safe('employee_evaluations', 'created_at'),
        safe('dss_results', 'created_at'),
        safe('dss_result_items', 'rank_no'),
        safe('system_logs', 'created_at'),
      ]);

      const employeeById = new Map<string, any>();
      employees.forEach((e: any) => employeeById.set(e.employee_id, e));

      const payrollById = new Map<string, any>();
      payrollSummaries.forEach((p: any) => payrollById.set(p.payroll_id, p));

      const dssById = new Map<string, any>();
      dssResults.forEach((d: any) => dssById.set(d.result_id, d));

      const map: ReportData = {
        employees: employees.map((e: any) => ({
          id: e.employee_id,
          name: getFullName(e) || e.employee_name || '—',
          position: e.position || '—',
          outlet: e.outlet || '—',
          employmentType: e.employment_type || '—',
          salary: e.salary ?? 0,
          status: e.status || '—',
          contact: [e.email, e.phone_number].filter(Boolean).join(' / ') || '—',
          date: toDateOnly(e.hire_date || e.created_at),
        })),

        applications: applicants.map((a: any) => ({
          id: a.applicant_id,
          name: a.name || getFullName(a) || '—',
          position: a.position_applied || '—',
          email: a.email || '—',
          phone: a.phone_number || '—',
          dateApplied: toDateOnly(a.created_at),
          date: toDateOnly(a.created_at),
          status: a.status || '—',
          hiringDecision: a.hiring_decision || '—',
        })),

        schedules: schedules.map((s: any) => {
          const emp = s.employee_id ? employeeById.get(s.employee_id) : null;
          return {
            id: s.schedule_id,
            employee: s.employee_id
              ? `${s.employee_id}${emp ? ` - ${getFullName(emp)}` : ''}`
              : '—',
            week: s.week || '—',
            position: s.position || emp?.position || '—',
            outlet: s.outlet || emp?.outlet || '—',
            timeIn: formatTime(s.time_in),
            timeOut: formatTime(s.time_out),
            finalized: s.is_finalized ? 'Finalized' : 'Draft',
            status: s.status || (s.is_finalized ? 'Finalized' : 'Draft'),
            date: s.week || '',
          };
        }),

        attendance: attendanceSummaries.map((a: any) => ({
          id: a.summary_id,
          employee: `${a.employee_id}${a.employee_name ? ` - ${a.employee_name}` : ''}`,
          position: a.position || '—',
          outlet: a.outlet || '—',
          period: buildPeriod(a.period_start, a.period_end),
          presentDays: a.total_present_days ?? 0,
          absentDays: a.total_absent_days ?? 0,
          incompleteDays: a.total_incomplete_days ?? 0,
          lateMinutes: a.total_late_minutes ?? 0,
          undertimeMinutes: a.total_undertime_minutes ?? 0,
          overtimeMinutes: a.total_overtime_minutes ?? 0,
          workHours: a.total_work_hours ?? 0,
          status: a.status || 'Draft',
          date: toDateOnly(a.period_start),
        })),

        attendanceLogs: attendanceLogs.map((a: any) => ({
          id: a.log_id,
          employee: `${a.employee_id || a.biometric_user_id || '—'}${a.employee_name ? ` - ${a.employee_name}` : ''}`,
          date: toDateOnly(a.attendance_date),
          timeIn: formatTime(a.time_in),
          timeOut: formatTime(a.time_out),
          totalHours: a.total_hours ?? 0,
          lateMinutes: a.late_minutes ?? 0,
          undertimeMinutes: a.undertime_minutes ?? 0,
          overtimeMinutes: a.overtime_minutes ?? 0,
          validationStatus: a.validation_status || 'Unprocessed',
          source: a.source || '—',
        })),

        payroll: payrollItems.map((item: any) => {
          const payroll = payrollById.get(item.payroll_id);
          return {
            id: item.payroll_item_id,
            employee: `${item.employee_id}${item.employee_name ? ` - ${item.employee_name}` : ''}`,
            position: item.position || '—',
            outlet: item.outlet || '—',
            period: buildPeriod(payroll?.period_start, payroll?.period_end, payroll?.cutoff_label),
            regularHours: item.regular_hours ?? 0,
            overtimeHours: item.overtime_hours ?? 0,
            grossPay: item.gross_pay ?? 0,
            deductions: item.total_deductions ?? 0,
            netPay: item.net_pay ?? 0,
            status: payroll?.status || 'Draft',
            date: toDateOnly(payroll?.period_start || item.created_at),
          };
        }),

        evaluations: evaluations.map((e: any) => ({
          id: e.evaluation_id,
          employee: `${e.employee_id}${e.employee_name ? ` - ${e.employee_name}` : ''}`,
          position: e.position || '—',
          outlet: e.outlet || '—',
          period: buildPeriod(e.evaluation_period_start, e.evaluation_period_end, e.evaluation_period_label),
          rawScore: e.total_raw_score ?? 0,
          finalScore: e.final_weighted_score ?? 0,
          rating: e.rating_label || '—',
          status: e.status || 'Draft',
          date: toDateOnly(e.evaluation_period_start),
        })),

        dss: dssItems.map((item: any) => {
          const result = dssById.get(item.result_id);
          return {
            rank: item.rank_no,
            employee: `${item.employee_id}${item.employee_name ? ` - ${item.employee_name}` : ''}`,
            position: item.position || '—',
            outlet: item.outlet || '—',
            period: buildPeriod(result?.result_period_start, result?.result_period_end, result?.result_period_label),
            finalScore: item.final_weighted_score ?? 0,
            rating: item.rating_label || '—',
            recommendation: item.recommendation || '—',
            date: toDateOnly(result?.result_period_start || item.created_at),
          };
        }),

        requests: requests.map((r: any) => ({
          id: r.request_id,
          employee: r.employee_id || '—',
          type: r.request_type || '—',
          leaveType: r.leave_type || '—',
          date: buildPeriod(r.start_date, r.end_date),
          time: r.start_time || r.end_time ? `${formatTime(r.start_time)} - ${formatTime(r.end_time)}` : '—',
          reason: r.reason || '—',
          status: r.status || 'Pending',
          reviewerRemarks: r.reviewer_remarks || '—',
          createdAt: toDateOnly(r.created_at),
        })),

        criteria: criteria.map((c: any) => ({
          id: c.criteria_id,
          criteriaName: c.criteria_name || '—',
          category: c.category || '—',
          weight: c.weight ?? 0,
          maxScore: c.max_score ?? 100,
          active: c.is_active ? 'Active' : 'Inactive',
          description: c.description || '—',
          date: toDateOnly(c.created_at),
        })),

        systemLogs: systemLogs.map((l: any) => ({
          id: l.log_id,
          userName: l.user_name || '—',
          userRole: l.user_role || '—',
          action: l.action || '—',
          module: l.module || '—',
          recordTable: l.record_table || '—',
          description: l.description || '—',
          date: toDateOnly(l.created_at),
        })),
      };

      setAllData(map);
      if (warnings.length > 0) {
        setWarning(`Some report sources could not be loaded: ${warnings.join(' | ')}`);
      }
    } catch (err: any) {
      setError(`Failed to load report data: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [reportType, dateFrom, dateTo, rowsPerPage]);

  const selected = REPORT_TYPES.find(r => r.value === reportType) ?? REPORT_TYPES[0];
  const currentData: any[] = allData[reportType] ?? [];
  const cols = COLUMNS[reportType] ?? [];

  const filtered = useMemo(() => {
    return currentData.filter(row => {
      const dateVal = row.date || row.dateApplied || row.createdAt || row.periodStart || row.submittedDate;
      if (!dateVal) return true;
      const d = String(dateVal).slice(0, 10);
      return d >= dateFrom && d <= dateTo;
    });
  }, [currentData, dateFrom, dateTo]);

  const paginated = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const formatValue = (key: string, value: any) => {
    if (value === null || value === undefined || value === '') return '—';
    if (currencyColumns.has(key)) return money(value);
    if (percentColumns.has(key)) return `${Number(value).toFixed(2)}${key === 'weight' || key === 'finalScore' || key === 'rawScore' ? '%' : ''}`;
    return String(value);
  };

  const exportCSV = () => {
    if (filtered.length === 0) return;

    const header = cols.map(labelize).join(',');
    const rows = filtered.map(row =>
      cols
        .map(c => `"${String(formatValue(c, row[c])).replace(/"/g, '""')}"`)
        .join(','),
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_report_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    win.document.write(`
      <html><head><title>${selected.label} Report</title>
      <style>
        @media print { @page { size: A4 landscape; margin: 15mm; } body { padding: 0; } }
        body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; color: #1b1b1b; }
        h2 { color: #2e7d32; margin-bottom: 4px; }
        p { color: #555; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #2e7d32; color: white; padding: 8px; text-align: left; font-size: 11px; }
        td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
        tr:nth-child(even) td { background: #f5f5f5; }
        .footer { color: #777; font-size: 10px; text-align: center; margin-top: 20px; }
      </style></head><body>
      <h2>Buenaventura Estate HRIS — ${selected.label} Report</h2>
      <p>Period: ${dateFrom} to ${dateTo} &nbsp;|&nbsp; Total records: ${filtered.length} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</p>
      ${content}
      <div class="footer">Buenaventura Estate HRIS &nbsp;·&nbsp; Printed: ${new Date().toLocaleString()} &nbsp;·&nbsp; Confidential</div>
      </body></html>
    `);

    win.document.close();
    win.print();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate, print, and export HRIS reports using live Supabase records.
          </Typography>
        </Box>
        <Button startIcon={loadingAll ? <CircularProgress size={16} /> : <Sync />} onClick={fetchAll} disabled={loadingAll} variant="outlined">
          Refresh Data
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {warning && <Alert severity="warning" sx={{ mb: 2 }}>{warning}</Alert>}

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Report Configuration
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select label="Report Type" value={reportType} onChange={e => setReportType(e.target.value)} InputLabelProps={{ shrink: true }}>
              {REPORT_TYPES.map(rt => (
                <MenuItem key={rt.value} value={rt.value}>
                  {rt.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth label="Date From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth label="Date To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button fullWidth variant="outlined" sx={{ height: '56px' }} onClick={() => { setDateFrom('2026-01-01'); setDateTo('2026-12-31'); }}>
              Reset
            </Button>
          </Grid>
        </Grid>
        <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<Print />} onClick={handlePrint} disabled={loadingAll || filtered.length === 0}>
            Print Report
          </Button>
          <Button variant="contained" startIcon={<FileDownload />} color="success" onClick={exportCSV} disabled={loadingAll || filtered.length === 0}>
            Export CSV
          </Button>
        </Box>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {REPORT_TYPES.map(rt => (
          <Grid key={rt.value} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '100%',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                bgcolor: reportType === rt.value ? 'primary.light' : 'white',
              }}
              onClick={() => setReportType(rt.value)}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <Box sx={{ bgcolor: reportType === rt.value ? 'primary.dark' : 'primary.main', p: 0.75, borderRadius: 1, display: 'flex', color: 'white' }}>{rt.icon}</Box>
                    <Typography variant="body2" fontWeight={600} sx={{ color: reportType === rt.value ? 'white' : 'inherit' }}>
                      {rt.label}
                    </Typography>
                  </Box>
                  {loadingAll ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Chip label={`${(allData[rt.value] ?? []).length}`} size="small" color={reportType === rt.value ? 'default' : 'primary'} variant="outlined" />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight="bold">
            {selected.label} — Data Preview
          </Typography>
          <Chip label={`${filtered.length} record${filtered.length !== 1 ? 's' : ''}`} color="primary" variant="outlined" />
        </Box>
        <Divider sx={{ mb: 2 }} />

        {loadingAll ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}>
            <CircularProgress />
            <Typography color="text.secondary">Loading report data…</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>No records found for this report type and date range.</Typography>
          </Box>
        ) : (
          <>
            <div ref={printRef}>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {cols.map(c => (
                        <TableCell key={c} sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white', whiteSpace: 'nowrap' }}>
                          {labelize(c)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginated.map((row, i) => (
                      <TableRow key={`${reportType}-${row.id ?? row.rank ?? i}`} hover>
                        {cols.map(c => (
                          <TableCell key={c} sx={{ whiteSpace: 'nowrap', fontSize: '0.82rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {statusColumns.has(c) ? (
                              <Chip label={formatValue(c, row[c])} size="small" color={getStatusColor(row[c])} />
                            ) : c === 'finalScore' || c === 'rawScore' ? (
                              <Typography variant="body2" fontWeight="bold" color="primary.main">
                                {formatValue(c, row[c])}
                              </Typography>
                            ) : (
                              formatValue(c, row[c])
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>

            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={event => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
            
          </>
        )}
      </Paper>
    </Box>
  );
}
