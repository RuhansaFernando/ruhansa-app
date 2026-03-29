import { StudentDataProvider } from '../contexts/StudentDataContext';
import DashboardLayout from './DashboardLayout';

export default function StudentLayout() {
  return (
    <StudentDataProvider>
      <DashboardLayout />
    </StudentDataProvider>
  );
}
