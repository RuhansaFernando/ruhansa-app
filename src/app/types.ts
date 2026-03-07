export type UserRole = 'advisor' | 'student' | 'faculty' | 'counselor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password: string;
  status?: 'active' | 'inactive';
  department?: string;
  createdAt?: string;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Student {
  id: string;
  name: string;
  email: string;
  program: string;
  year: number;
  gpa: number;
  riskLevel: RiskLevel;
  riskScore: number;
  advisorId: string;
  counselorId?: string;
  facultyMentorId?: string;
  joinedDate?: string;
}

export interface RiskFactor {
  category: string;
  value: number;
  weight: number;
  description: string;
}

export interface AttendanceRecord {
  courseId: string;
  courseName: string;
  totalClasses: number;
  attended: number;
  percentage: number;
}

export interface GradeRecord {
  courseId: string;
  courseName: string;
  grade: string;
  points: number;
  credits: number;
  semester: string;
}

export interface EngagementMetrics {
  lmsLogins: number;
  assignmentSubmissions: number;
  forumParticipation: number;
  supportServiceInteractions: number;
  lastActivity: string;
}

export interface Intervention {
  id: string;
  studentId: string;
  type: string;
  description: string;
  assignedBy: string;
  assignedTo?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface Appointment {
  id: string;
  studentId: string;
  advisorId: string;
  type: string;
  date: string;
  time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
}

export interface Alert {
  id: string;
  studentId: string;
  studentName?: string;
  type: string;
  title?: string;
  description?: string;
  severity: 'info' | 'warning' | 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp?: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

export interface Report {
  id: string;
  title: string;
  type: string;
  generatedBy: string;
  generatedAt: string;
  data: any;
}