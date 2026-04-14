import { createBrowserRouter, redirect } from 'react-router';
import DashboardLayout from './layouts/DashboardLayout';
import StudentLayout from './layouts/StudentLayout';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import StudentMarksPage from './pages/StudentMarksPage';
import StudentAttendancePage from './pages/StudentAttendancePage';
import StudentAppointmentsPage from './pages/StudentAppointmentsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import StudentAlertsPage from './pages/StudentAlertsPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminStudentsPage from './pages/AdminStudentsPage';
import AdminAdvisorsPage from './pages/AdminAdvisorsPage';
import AdminCounselorsPage from './pages/AdminCounselorsPage';
import AdminTutorsPage from './pages/AdminTutorsPage';
import AdminAcademicPage from './pages/AdminAcademicPage';
import AdminSRUPage from './pages/AdminSRUPage';
import AdminRegistryManagementPage from './pages/AdminRegistryManagementPage';
import AdminRegistryPage from './pages/AdminRegistryPage';
import AdminCourseLeadersPage from './pages/AdminCourseLeadersPage';
import AdminProgrammesPage from './pages/AdminProgrammesPage';
import AdminFacultiesPage from './pages/AdminFacultiesPage';
import RegistryStudentsPage from './pages/RegistryStudentsPage';
import RegistryAcademicRecordsPage from './pages/RegistryAcademicRecordsPage';
import RegistryModuleEnrollmentPage from './pages/RegistryModuleEnrollmentPage';
import RegistryReportsPage from './pages/RegistryReportsPage';
import AcademicUploadPage from './pages/AcademicUploadPage';
import FacultyAdminDashboard from './pages/FacultyAdminDashboard';
import FacultyAdminModulesPage from './pages/FacultyAdminModulesPage';
import FacultyAdminReportsPage from './pages/FacultyAdminReportsPage';
import MentorDashboard from './pages/MentorDashboard';
import MentorStudentsPage from './pages/MentorStudentsPage';
import MentorSettingsPage from './pages/MentorSettingsPage';
import SRUDashboard from './pages/SRUDashboard';
import SRUStudentsPage from './pages/SRUStudentsPage';
import SRUStudentProfilePage from './pages/SRUStudentProfilePage';
import SRUInterventionsPage from './pages/SRUInterventionsPage';
import SRUAlertsPage from './pages/SRUAlertsPage';
import SSASettingsPage from './pages/SSASettingsPage';
import SRUAppointmentsPage from './pages/SRUAppointmentsPage';
import SRUReportsPage from './pages/SRUReportsPage';
import CourseLeaderDashboard from './pages/CourseLeaderDashboard';
import CourseLeaderPage from './pages/CourseLeaderPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import StudentWellbeingCheckIn from './pages/StudentWellbeingCheckIn';
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
    path: '/student',
    Component: StudentLayout,
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
        path: 'profile',
        Component: StudentProfilePage,
      },
      {
        path: 'alerts',
        Component: StudentAlertsPage,
      },
      {
        path: 'marks',
        Component: StudentMarksPage,
      },
      {
        path: 'attendance',
        Component: StudentAttendancePage,
      },
      {
        path: 'appointments',
        Component: StudentAppointmentsPage,
      },
      {
        path: 'wellbeing',
        Component: StudentWellbeingCheckIn,
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
        path: 'students',
        Component: AdminStudentsPage,
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
        path: 'course-leaders',
        Component: AdminCourseLeadersPage,
      },
      {
        path: 'programmes',
        Component: AdminProgrammesPage,
      },
      {
        path: 'faculties',
        Component: AdminFacultiesPage,
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
        Component: RegistryStudentsPage,
      },
      {
        path: 'academic-records',
        Component: RegistryAcademicRecordsPage,
      },
      {
        path: 'module-enrollment',
        Component: RegistryModuleEnrollmentPage,
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
        loader: () => redirect('/academic/dashboard'),
      },
      {
        path: 'dashboard',
        Component: FacultyAdminDashboard,
      },
      {
        path: 'upload',
        Component: AcademicUploadPage,
      },
      {
        path: 'modules',
        Component: FacultyAdminModulesPage,
      },
      {
        path: 'reports',
        Component: FacultyAdminReportsPage,
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
        path: 'students',
        Component: MentorStudentsPage,
      },
      {
        path: 'availability',
        loader: () => redirect('/mentor/dashboard'),
      },
      {
        path: 'settings',
        Component: MentorSettingsPage,
      },
      {
        path: 'change-password',
        Component: ChangePasswordPage,
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
        path: 'students/:studentId',
        Component: SRUStudentProfilePage,
      },
      {
        path: 'interventions',
        Component: SRUInterventionsPage,
      },
      {
        path: 'alerts',
        Component: SRUAlertsPage,
      },
      {
        path: 'appointments',
        Component: SRUAppointmentsPage,
      },
      {
        path: 'appointments/new',
        loader: () => redirect('/sru/appointments'),
      },
      {
        path: 'reports',
        Component: SRUReportsPage,
      },
      {
        path: 'settings',
        Component: SSASettingsPage,
      },
      {
        path: 'change-password',
        Component: ChangePasswordPage,
      },
    ],
  },
  {
    path: '/course-leader',
    Component: DashboardLayout,
    children: [
      {
        index: true,
        loader: () => redirect('/course-leader/dashboard'),
      },
      {
        path: 'dashboard',
        Component: CourseLeaderDashboard,
      },
      {
        path: 'mentor-assignment',
        Component: CourseLeaderPage,
      },
      {
        path: 'change-password',
        Component: ChangePasswordPage,
      },
    ],
  },
  {
    path: '*',
    Component: NotFound,
  },
]);
