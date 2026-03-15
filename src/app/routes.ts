import AdminSystemHealthPage from './pages/AdminSystemHealthPage';
import SRUDashboard from './pages/SRUDashboard';
import SRUStudentListPage from './pages/SRUStudentListPage';
import SRUStudentsPage from './pages/SRUStudentsPage';
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
import AdminTutorsPage from './pages/AdminTutorsPage';
import AdminCounsellorsPage from './pages/AdminCounsellorsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminSRUPage from './pages/AdminSRUPage';
import AdminRegistryPage from './pages/AdminRegistryPage';
import AdminAcademicPage from './pages/AdminAcademicPage';
import AdminSRUManagementPage from './pages/AdminSRUManagementPage';
import AdminRegistryManagementPage from './pages/AdminRegistryManagementPage';
import RegistryModulesPage from './pages/RegistryModulesPage';
import RegistryGradesPage from './pages/RegistryGradesPage';
import RegistryReportsPage from './pages/RegistryReportsPage';
import RegistryStudentDetailsPage from './pages/RegistryStudentDetailsPage';
import AcademicUploadPage from './pages/AcademicUploadPage';
import MentorDashboard from './pages/MentorDashboard';
import CounsellorDashboard from './pages/CounsellorDashboard';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AvailabilitySettingsPage from './pages/AvailabilitySettingsPage';
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
      {
        path: 'change-password',
        Component: ChangePasswordPage,
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
      {
        path: 'change-password',
        Component: ChangePasswordPage,
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
      {
        path: 'change-password',
        Component: ChangePasswordPage,
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
      {
        path: 'change-password',
        Component: ChangePasswordPage,
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
        path: 'tutors',
        Component: AdminTutorsPage,
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
        path: 'reports',
        Component: ReportsPage,
      },
      {
        path: 'sru',
        Component: AdminSRUManagementPage,
      },
      {
        path: 'registry',
        Component: AdminRegistryManagementPage,
      },
      {
        path: 'sru-staff',
        Component: AdminSRUPage,
      },
      {
        path: 'registry-staff',
        Component: AdminRegistryPage,
      },
      {
        path: 'academic-staff',
        Component: AdminAcademicPage,
      },
      {
        path: 'counsellors',
        Component: AdminCounsellorsPage,
      },
      {
        path: 'settings',
        Component: SettingsPage,
      },
      {
        path: 'interventions',
        Component: InterventionManagementPage,
      },
      {
        path: 'change-password',
        Component: ChangePasswordPage,
      },
    ],
  },
  {
    path: '/registry',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/registry/dashboard'),
      },
      {
        path: 'dashboard',
        Component: AdminRegistryManagementPage,
      },
      {
        path: 'students',
        Component: RegistryStudentDetailsPage,
      },
      {
        path: 'modules',
        Component: RegistryModulesPage,
      },
      {
        path: 'grades',
        Component: RegistryGradesPage,
      },
      {
        path: 'reports',
        Component: RegistryReportsPage,
      },
      {
        path: 'change-password',
        Component: ChangePasswordPage,
      },
    ],
  },
  {
    path: '/academic',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/academic/upload'),
      },
      {
        path: 'upload',
        Component: AcademicUploadPage,
      },
      {
        path: 'change-password',
        Component: ChangePasswordPage,
      },
    ],
  },
  {
    path: '/mentor',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/mentor/dashboard'),
      },
      {
        path: 'dashboard',
        Component: MentorDashboard,
      },
      {
        path: 'change-password',
        Component: ChangePasswordPage,
      },
      {
        path: 'availability',
        Component: AvailabilitySettingsPage,
      },
    ],
  },
  {
    path: '/counsellor',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/counsellor/dashboard'),
      },
      {
        path: 'dashboard',
        Component: CounsellorDashboard,
      },
      {
        path: 'change-password',
        Component: ChangePasswordPage,
      },
      {
        path: 'availability',
        Component: AvailabilitySettingsPage,
      },
    ],
  },
  {
    path: '/sru',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/sru/dashboard'),
      },
      {
        path: 'dashboard',
        Component: SRUDashboard,
      },
      {
        path: 'students',
        Component: SRUStudentsPage,
      },
      {
        path: 'student/:studentId',
        Component: StudentProfile,
      },
      {
        path: 'change-password',
        Component: ChangePasswordPage,
      },
      {
        path: 'availability',
        Component: AvailabilitySettingsPage,
      },
    ],
  },
  {
    path: '*',
    Component: NotFound,
  },
]);