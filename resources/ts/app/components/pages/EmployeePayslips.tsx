import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Divider, Grid,
} from '@mui/material';
import { Payments, Print, Visibility, Sync } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { API, HEADERS } from '../../lib/api';

interface Payslip {
  id: string; employee: string; position: string; period: string;
  totalHours: string; overtime: string; deductions: string;
  grossPay: string; netPay: string; sss?: string; philhealth?: string; pagibig?: string;
  status: string; releasedAt?: string;
}

export default function EmployeePayslips() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Payslip | null>(null);
  const [viewDialog, setViewDialog] = useState(false);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/payroll`, { headers: HEADERS });
      const data = await res.json();
      const mine = (data.payrolls ?? []).filter((p: any) => p?.employee === user?.name && p != null);
      setPayslips(mine.sort((a: any, b: any) => b.period.localeCompare(a.period)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPayslips(); }, [user]);

  const handlePrint = (slip: Payslip) => {
    const win = window.open('', '_blank', 'width=700,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Payslip — ${slip.employee}</title>
      <style>
        body { font-family: Arial,sans-serif; padding: 32px; font-size: 13px; color: #111; }
        .header { text-align:center; border-bottom: 2px solid #1F7A47; pb: 12px; margin-bottom: 20px; }
        h2 { color: #1F7A47; margin-bottom: 4px; }
        .row { display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .net { font-size:18px; font-weight:bold; color:#1F7A47; }
        .tag { background:#f0f7f0; padding:4px 10px; border-radius:6px; display:inline-block; margin-top:8px; }
      </style></head><body>
      <div class="header">
        <h2>Buenaventura Estate</h2>
        <p style="color:#666;margin:0">Wharf Road, Barangay San Pedro, Panabo City, Davao del Norte</p>
        <h3 style="margin-top:12px">ELECTRONIC PAYSLIP</h3>
      </div>
      <div class="row"><span>Employee Name</span><strong>${slip.employee}</strong></div>
      <div class="row"><span>Position</span><strong>${slip.position}</strong></div>
      <div class="row"><span>Payroll Period</span><strong>${slip.period}</strong></div>
      <div class="row"><span>Payroll ID</span><strong>${slip.id}</strong></div>
      <br/>
      <div class="row"><span>Total Hours Worked</span><strong>${slip.totalHours} hrs</strong></div>
      <div class="row"><span>Overtime Hours</span><strong>${slip.overtime} hrs</strong></div>
      <div class="row"><span>Gross Pay</span><strong>${slip.grossPay}</strong></div>
      <br/>
      <div class="row" style="color:#c00"><span>SSS Contribution</span><strong>${slip.sss ?? '—'}</strong></div>
      <div class="row" style="color:#c00"><span>PhilHealth Contribution</span><strong>${slip.philhealth ?? '—'}</strong></div>
      <div class="row" style="color:#c00"><span>Pag-IBIG Contribution</span><strong>${slip.pagibig ?? '—'}</strong></div>
      <div class="row" style="color:#c00"><span>Total Deductions</span><strong>${slip.deductions}</strong></div>
      <br/>
      <div class="row"><span class="net">NET PAY</span><span class="net">${slip.netPay}</span></div>
      <br/>
      <div><span class="tag">Status: ${slip.status}</span> ${slip.releasedAt ? `<span class="tag">Released: ${new Date(slip.releasedAt).toLocaleDateString()}</span>` : ''}</div>
      <br/><p style="color:#888;font-size:11px">Generated: ${new Date().toLocaleString()} · This is an electronically generated payslip.</p>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2.125rem' } }}>
            My Payslips
          </Typography>
          <Typography variant="body2" color="text.secondary">View and print your electronic payslips — {user?.name}</Typography>
        </Box>
        <Button startIcon={loading ? <CircularProgress size={16} /> : <Sync />} onClick={fetchPayslips} disabled={loading} variant="outlined">Refresh</Button>
      </Box>

      {!loading && payslips.length === 0 && (
        <Alert severity="info">No payslips found for your account. Contact HR if you believe this is an error.</Alert>
      )}

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, gap: 2 }}><CircularProgress size={28} /><Typography color="text.secondary">Loading payslips…</Typography></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Payroll ID</TableCell><TableCell>Period</TableCell><TableCell>Position</TableCell>
                <TableCell>Gross Pay</TableCell><TableCell>Deductions</TableCell><TableCell>Net Pay</TableCell>
                <TableCell>Status</TableCell><TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payslips.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No payslips found.</TableCell></TableRow>
              ) : payslips.map(p => (
                <TableRow key={p.id} hover>
                  <TableCell><Chip label={p.id} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{p.period}</TableCell>
                  <TableCell>{p.position}</TableCell>
                  <TableCell>{p.grossPay}</TableCell>
                  <TableCell sx={{ color: 'error.main' }}>{p.deductions}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>{p.netPay}</TableCell>
                  <TableCell>
                    <Chip label={p.status} size="small"
                      color={p.status === 'Released' ? 'success' : p.status === 'For Review' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button size="small" startIcon={<Visibility />} onClick={() => { setSelected(p); setViewDialog(true); }}>View</Button>
                      {(p.status === 'Released' || p.status === 'For Review') && (
                        <Button size="small" variant="outlined" startIcon={<Print />} onClick={() => handlePrint(p)}>Print</Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Payslip Detail Dialog */}
      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={700}>Payslip Detail</Typography>
            {selected && <Chip label={selected.id} size="small" variant="outlined" />}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selected && (
            <Box>
              <Box sx={{ textAlign: 'center', mb: 3, p: 2, bgcolor: 'primary.main', borderRadius: 2, color: 'white' }}>
                <Payments sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h6" fontWeight="bold">{selected.employee}</Typography>
                <Typography variant="body2">{selected.position}</Typography>
                <Typography variant="caption">Payroll Period: {selected.period}</Typography>
              </Box>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>EARNINGS</Typography>
                {[['Total Hours', `${selected.totalHours} hrs`], ['Overtime Hours', `${selected.overtime} hrs`], ['Gross Pay', selected.grossPay]].map(([k, v]) => (
                  <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2">{k}</Typography>
                    <Typography variant="body2" fontWeight={500}>{v}</Typography>
                  </Box>
                ))}
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" color="error.main" gutterBottom>DEDUCTIONS</Typography>
                {[
                  ['SSS Contribution', selected.sss],
                  ['PhilHealth Contribution', selected.philhealth],
                  ['Pag-IBIG Contribution', selected.pagibig],
                  ['Total Deductions', selected.deductions],
                ].filter(([, v]) => v != null && v !== '' && v !== '0' && v !== '₱0').map(([k, v]) => (
                  <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color={k === 'Total Deductions' ? 'error.main' : 'inherit'}>{k}</Typography>
                    <Typography variant="body2" fontWeight={k === 'Total Deductions' ? 'bold' : 500} color={k === 'Total Deductions' ? 'error.main' : 'inherit'}>{v}</Typography>
                  </Box>
                ))}
                {(!selected.sss && !selected.philhealth && !selected.pagibig) && (
                  <Typography variant="caption" color="text.secondary">
                    No statutory deduction breakdown available. Total deductions: <strong>{selected.deductions || '₱0'}</strong>
                  </Typography>
                )}
              </Paper>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
                <Typography variant="h6" fontWeight="bold">NET PAY</Typography>
                <Typography variant="h6" fontWeight="bold" color="success.main">{selected.netPay}</Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Chip label={`Status: ${selected.status}`} color={selected.status === 'Released' ? 'success' : 'warning'} />
                {selected.releasedAt && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>Released: {new Date(selected.releasedAt).toLocaleDateString()}</Typography>}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
          {selected && (selected.status === 'Released' || selected.status === 'For Review') && (
            <Button variant="contained" startIcon={<Print />} onClick={() => { handlePrint(selected!); }}>Print Payslip</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}