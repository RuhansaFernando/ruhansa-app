import AdminSystemHealthPage from './pages/AdminSystemHealthPage';
import AttendanceMonitoringPage from './pages/AttendanceMonitoringPage';
import AcademicPerformancePage from './pages/AcademicPerformancePage';
import InterventionManagementPage from './pages/InterventionManagementPage';
import { createBrowserRouter, redirect } from 'react-router';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import AdvisorDashboard from './pages/AdvisorDashboard';
import StudentProfile from './pages/StudentProfile';
import StudentDashboard from './pages/StudentDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import CounselorDashboard from './pages/CounselorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ReportsPage from './pages/ReportsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import SettingsPage from './pages/SettingsPage';
import FacultyStudentsPage from './pages/FacultyStudentsPage';
import FacultyAlertsPage from './pages/FacultyAlertsPage';
import CounselorCasesPage from './pages/CounselorCasesPage';
import CounselorAnalyticsPage from './pages/CounselorAnalyticsPage';
import StudentAppointmentsPage from './pages/StudentAppointmentsPage';
import AdminStudentsPage from './pages/AdminStudentsPage';
import AdminFacultyPage from './pages/AdminFacultyPage';
import AdminAdvisorsPage from './pages/AdminAdvisorsPage';
import AdminCounselorsPage from './pages/AdminCounselorsPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import AdminAlertsPage from './pages/AdminAlertsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import {
  RedirectToLogin,
  NotFound,
} from './components/RouteComponents';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/',
    Component: RedirectToLogin,
  },
  {
    path: '/advisor',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/advisor/dashboard'),
      },
      {
        path: 'dashboard',
        Component: AdvisorDashboard,
      },
      {
        path: 'student/:studentId',
        Component: StudentProfile,
      },
      {
        path: 'reports',
        Component: ReportsPage,
      },
      {
        path: 'appointments',
        Component: AppointmentsPage,
      },
      {
        path: 'attendance',
        Component: AttendanceMonitoringPage,
      },
      {
        path: 'performance',
        Component: AcademicPerformancePage,
      },
      {
        path: 'interventions',
        Component: InterventionManagementPage,
      },
      {
        path: 'settings',
        Component: SettingsPage,
      },
    ],
  },
  {
    path: '/student',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/student/dashboard'),
      },
      {
        path: 'dashboard',
        Component: StudentDashboard,
      },
      {
        path: 'appointments',
        Component: StudentAppointmentsPage,
      },
      {
        path: 'settings',
        Component: SettingsPage,
      },
    ],
  },
  {
    path: '/faculty',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/faculty/dashboard'),
      },
      {
        path: 'dashboard',
        Component: FacultyDashboard,
      },
      {
        path: 'student/:studentId',
        Component: StudentProfile,
      },
      {
        path: 'students',
        Component: FacultyStudentsPage,
      },
      {
        path: 'alerts',
        Component: FacultyAlertsPage,
      },
      {
        path: 'settings',
        Component: SettingsPage,
      },
    ],
  },
  {
    path: '/counselor',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/counselor/dashboard'),
      },
      {
        path: 'dashboard',
        Component: CounselorDashboard,
      },
      {
        path: 'student/:studentId',
        Component: StudentProfile,
      },
      {
        path: 'cases',
        Component: CounselorCasesPage,
      },
      {
        path: 'analytics',
        Component: CounselorAnalyticsPage,
      },
      {
        path: 'settings',
        Component: SettingsPage,
      },
    ],
  },
  {
    path: '/admin',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/admin/dashboard'),
      },
      {
        path: 'dashboard',
        Component: AdminDashboard,
      },
      {
        path: 'student/:studentId',
        Component: StudentProfile,
      },
      {
        path: 'students',
        Component: AdminStudentsPage,
      },
      {
        path: 'faculty',
        Component: AdminFacultyPage,
      },
      {
        path: 'advisors',
        Component: AdminAdvisorsPage,
      },
      {
        path: 'counselors',
        Component: AdminCounselorsPage,
      },
      {
        path: 'analytics',
        Component: AdminAnalyticsPage,
      },
      {
        path: 'alerts',
        Component: AdminAlertsPage,
      },
      {
        path: 'users',
        Component: AdminUsersPage,
      },
      {
        path: 'health',
        Component: AdminSystemHealthPage,
      },
      {
        path: 'settings',
        Component: SettingsPage,
      },
      {
        path: 'interventions',
        Component: InterventionManagementPage,
      },
    ],
  },
  {
    path: '*',
    Component: NotFound,
  },
]);