import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Card, CardContent, TextField,
  MenuItem, Grid, CircularProgress, Alert, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Divider,
} from '@mui/material';
import { Print, GridView, Analytics as BarChartIcon, Sync, FileDownload } from '@mui/icons-material';
import { API, HEADERS } from '../../lib/api';

interface ReportData { [key: string]: any[] }

const REPORT_TYPES = [
  { value: 'employees', label: 'Employee Records', icon: <GridView />, endpoint: 'employees', key: 'employees' },
  { value: 'applications', label: 'Recruitment / Applications', icon: <GridView />, endpoint: 'applications', key: 'applications' },
  { value: 'attendance', label: 'Attendance Summary', icon: <GridView />, endpoint: 'attendance', key: 'attendance' },
  { value: 'payroll', label: 'Payroll Summary', icon: <GridView />, endpoint: 'payroll', key: 'payrolls' },
  { value: 'evaluations', label: 'Performance Evaluation (DSS)', icon: <BarChartIcon />, endpoint: 'evaluations', key: 'evaluations' },
  { value: 'requests', label: 'Leave / OT / Undertime Requests', icon: <GridView />, endpoint: 'requests', key: 'requests' },
];

const COLUMNS: Record<string, string[]> = {
  employees: ['id', 'name', 'position', 'outlet', 'status', 'contact'],
  applications: ['id', 'name', 'position', 'email', 'phone', 'dateApplied', 'status'],
  attendance: ['id', 'employee', 'date', 'timeIn', 'timeOut', 'totalHours', 'late', 'undertime', 'overtime', 'status'],
  payroll: ['id', 'employee', 'position', 'period', 'totalHours', 'overtime', 'grossPay', 'deductions', 'netPay', 'status'],
  evaluations: ['id', 'employee', 'position', 'period', 'finalScore', 'workQuality', 'jobKnowledge', 'teamwork', 'initiative', 'conduct', 'attendance', 'performance', 'status'],
  requests: ['id', 'employee', 'type', 'date', 'reason', 'status', 'submittedDate'],
};

export default function Reports() {
  const [reportType, setReportType] = useState('employees');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [allData, setAllData] = useState<ReportData>({});
  const [loadingAll, setLoadingAll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchAll = async () => {
    setLoadingAll(true); setError(null);
    try {
      const results = await Promise.all(
        REPORT_TYPES.map(rt => fetch(`${API}/${rt.endpoint}`, { headers: HEADERS }).then(r => r.json()).then(d => ({ type: rt.value, data: d[rt.key] ?? [] })))
      );
      const map: ReportData = {};
      results.forEach(r => { map[r.type] = r.data.filter((x: any) => x != null); });
      setAllData(map);
    } catch (e: any) {
      setError(`Failed to load report data: ${e.message}`);
    } finally { setLoadingAll(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const currentData: any[] = allData[reportType] ?? [];
  const cols = COLUMNS[reportType] ?? [];
  const selected = REPORT_TYPES.find(r => r.value === reportType)!;

  // Date filter (works on 'date', 'dateApplied', 'submittedDate', 'createdAt')
  const dateKeys = ['date', 'dateApplied', 'submittedDate', 'createdAt'];
  const filtered = currentData.filter(row => {
    const dateVal = dateKeys.map(k => row[k]).find(v => v);
    if (!dateVal) return true;
    const d = dateVal.slice(0, 10);
    return d >= dateFrom && d <= dateTo;
  });

  // CSV Export
  const exportCSV = () => {
    if (filtered.length === 0) return;
    const header = cols.join(',');
    const rows = filtered.map(row => cols.map(c => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${reportType}_report_${dateFrom}_to_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Print
  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>${selected.label} Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; }
        h2 { color: #2e7d32; margin-bottom: 4px; }
        p { color: #666; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #2e7d32; color: white; padding: 8px; text-align: left; font-size: 11px; }
        td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
        tr:nth-child(even) td { background: #f5f5f5; }
        .meta { display: flex; gap: 24px; margin-bottom: 16px; font-size: 12px; color: #444; }
      </style></head><body>
      <h2>Buenaventura Estate HRIS — ${selected.label} Report</h2>
      <p>Period: ${dateFrom} to ${dateTo} &nbsp;|&nbsp; Total records: ${filtered.length} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</p>
      ${content}
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
          <Typography variant="body2" color="text.secondary">Generate and export HRIS reports — live data from Supabase</Typography>
        </Box>
        <Button startIcon={loadingAll ? <CircularProgress size={16} /> : <Sync />} onClick={fetchAll} disabled={loadingAll} variant="outlined">Refresh Data</Button>
      </Box>

      {error &&
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      }

      {/* Config panel */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Report Configuration</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select label="Report Type" value={reportType} onChange={e => setReportType(e.target.value)}
              InputLabelProps={{ shrink: true }}>
              {REPORT_TYPES.map(rt => <MenuItem key={rt.value} value={rt.value}>{rt.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth label="Date From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth label="Date To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button fullWidth variant="outlined" sx={{ height: '56px' }} onClick={() => { setDateFrom('2026-01-01'); setDateTo('2026-12-31'); }}>Reset</Button>
          </Grid>
        </Grid>
        <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<Print />} onClick={handlePrint} disabled={loadingAll || filtered.length === 0}>Print Report</Button>
          <Button variant="contained" startIcon={<FileDownload />} color="success" onClick={exportCSV} disabled={loadingAll || filtered.length === 0}>Export CSV</Button>
        </Box>
      </Paper>

      {/* Report Type Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {REPORT_TYPES.map(rt => (
          <Grid key={rt.value} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }, bgcolor: reportType === rt.value ? 'primary.light' : 'white' }}
              onClick={() => setReportType(rt.value)}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ bgcolor: reportType === rt.value ? 'primary.dark' : 'primary.main', p: 0.75, borderRadius: 1, display: 'flex', color: 'white' }}>{rt.icon}</Box>
                    <Typography variant="body2" fontWeight={600} sx={{ color: reportType === rt.value ? 'white' : 'inherit' }}>{rt.label}</Typography>
                  </Box>
                  {loadingAll ? <CircularProgress size={16} /> : (
                    <Chip label={`${(allData[rt.value] ?? []).length}`} size="small"
                      color={reportType === rt.value ? 'default' : 'primary'} variant="outlined" />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Data Preview Table */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">{selected.label} — Data Preview</Typography>
          <Chip label={`${filtered.length} record${filtered.length !== 1 ? 's' : ''}`} color="primary" variant="outlined" />
        </Box>
        <Divider sx={{ mb: 2 }} />

        {loadingAll ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}><CircularProgress /><Typography color="text.secondary">Loading from Supabase…</Typography></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>No records found for this report type and date range.</Typography>
          </Box>
        ) : (
          <div ref={printRef}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {cols.map(c => (
                      <TableCell key={c} sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white', whiteSpace: 'nowrap' }}>
                        {c.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((row, i) => (
                    <TableRow key={i} hover>
                      {cols.map(c => (
                        <TableCell key={c} sx={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                          {c === 'status' ? (
                            <Chip label={String(row[c] ?? '—')} size="small"
                              color={['Active', 'Approved', 'Present', 'Processed', 'Hired', 'Confirmed', 'Published'].includes(row[c]) ? 'success' :
                                ['Pending', 'Draft', 'Under Review', 'Late'].includes(row[c]) ? 'warning' :
                                ['Resigned', 'Not Qualified', 'Absent', 'Disapproved'].includes(row[c]) ? 'error' : 'default'} />
                          ) : c === 'finalScore' ? (
                            <Typography variant="body2" fontWeight="bold" color="primary.main">{row[c] != null ? `${Number(row[c]).toFixed(2)}%` : '—'}</Typography>
                          ) : String(row[c] ?? '—')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        )}
      </Paper>
    </Box>
  );
}