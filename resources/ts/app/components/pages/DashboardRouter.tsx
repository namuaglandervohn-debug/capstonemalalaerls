import { useAuth } from '../../context/AuthContext';
import HRDashboard from './HRDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import GMDashboard from './GMDashboard';
import AccountingDashboard from './AccountingDashboard';

export default function DashboardRouter() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'employee': return <EmployeeDashboard />;
    case 'supervisor': return <SupervisorDashboard />;
    case 'gm': return <GMDashboard />;
    case 'accounting': return <AccountingDashboard />;
    case 'hr':
    default:
      return <HRDashboard />;
  }
}
