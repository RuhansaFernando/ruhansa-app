/*
 * EMAILJS SETUP REQUIRED:
 * Create a new template in EmailJS dashboard with ID: template_alert
 *
 * Template subject: ⚠️ DropGuard Alert — {{alert_count}} High Risk Student(s) Detected
 *
 * Template body:
 * Dear {{to_name}},
 *
 * This is an automated early warning alert from DropGuard.
 *
 * {{alert_count}} student(s) have been identified as HIGH RISK today ({{alert_date}}):
 *
 * {{student_list}}
 *
 * Please log into DropGuard and take action within 24 hours:
 * {{dashboard_url}}
 *
 * This is an automated message from DropGuard Early Warning System.
 */

import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = 'service_y8aewpn';
const EMAILJS_PUBLIC_KEY = 'pqfkLZ1zbahk5O2Vi';
const RISK_THRESHOLD     = 70;

export interface HighRiskStudent {
  studentId: string;
  name: string;
  riskScore: number;
  attendancePercentage: number;
  gpa: number | null;
  dataAvailable: 'attendance_only' | 'attendance_and_gpa';
}

export interface AlertResult {
  alertsSent: number;
  highRiskStudents: HighRiskStudent[];
}

export async function runDailyAlertCheck(
  ssaEmail: string,
  ssaName: string
): Promise<AlertResult> {
  const today        = new Date().toISOString().split('T')[0];
  const studentsSnap = await getDocs(collection(db, 'students'));

  const highRiskStudents: HighRiskStudent[] = [];
  const updates: Promise<void>[]            = [];

  for (const studentDoc of studentsSnap.docs) {
    const data = studentDoc.data();

    const riskScore     = data.riskScore     ?? 0;
    const lastAlertDate = data.lastAlertSent ?? '';

    if (riskScore > 0 && riskScore >= RISK_THRESHOLD && lastAlertDate !== today) {
      const hasGpa = data.gpa && data.gpa > 0;

      highRiskStudents.push({
        studentId:            data.studentId ?? studentDoc.id,
        name:                 data.name      ?? 'Unknown',
        riskScore,
        attendancePercentage: data.attendancePercentage ?? 0,
        gpa:                  hasGpa ? data.gpa : null,
        dataAvailable:        hasGpa ? 'attendance_and_gpa' : 'attendance_only',
      });

      updates.push(
        updateDoc(doc(db, 'students', studentDoc.id), { lastAlertSent: today })
      );
    }
  }

  await Promise.all(updates);

  if (highRiskStudents.length > 0) {
    const studentList = highRiskStudents
      .map((s) => {
        const gpaText  = s.gpa ? `GPA: ${s.gpa}` : 'GPA: Not yet available';
        const dataNote = s.dataAvailable === 'attendance_only'
          ? '(Based on attendance only — GPA pending)'
          : '(Based on attendance + GPA)';
        return `• ${s.name} (${s.studentId}) — Risk: ${s.riskScore}/100 | Attendance: ${s.attendancePercentage}% | ${gpaText} ${dataNote}`;
      })
      .join('\n');

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        'template_alert',
        {
          to_name:       ssaName,
          to_email:      ssaEmail,
          alert_count:   String(highRiskStudents.length),
          student_list:  studentList,
          alert_date:    new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            year:    'numeric',
            month:   'long',
            day:     'numeric',
          }),
          dashboard_url: window.location.origin + '/sru/alerts',
        },
        EMAILJS_PUBLIC_KEY
      );
    } catch (emailErr) {
      console.error('Alert email failed:', emailErr);
    }
  }

  return { alertsSent: highRiskStudents.length, highRiskStudents };
}

export async function hasRunTodayCheck(): Promise<boolean> {
  const today     = new Date().toISOString().split('T')[0];
  const lastCheck = localStorage.getItem('dropguard_last_alert_check');
  return lastCheck === today;
}

export function markTodayCheckDone(): void {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('dropguard_last_alert_check', today);
}

export interface AcademicFeatures {
  attendanceRate: number;
  gpaCurrent: number;
  failedModules: number;
  academicWarningCount: number;
  creditsCompleted: number;
  gpaHistory: number[];
}

export async function collectAcademicFeatures(studentId: string): Promise<AcademicFeatures> {
  // Fetch student base data
  const studentSnap = await getDocs(
    query(collection(db, 'students'), where('studentId', '==', studentId))
  );
  const studentData = studentSnap.empty ? {} : studentSnap.docs[0].data();

  // Fetch intervention count
  const intSnap = await getDocs(
    query(collection(db, 'interventions'), where('studentId', '==', studentId))
  );
  const academicWarningCount = intSnap.size;

  // Fetch results for failed modules, credits, and GPA history
  const resultsSnap = await getDocs(
    query(collection(db, 'results'), where('studentId', '==', studentId))
  );
  const results = resultsSnap.docs.map((d) => d.data());
  const failedModules = results.filter((r) => (r.finalMark ?? r.mark ?? 0) < 40).length;
  const creditsCompleted = results.filter((r) => (r.finalMark ?? r.mark ?? 0) >= 40).length;

  const bySemester: Record<string, number[]> = {};
  results.forEach((r) => {
    const key = `${r.academicYear}-${r.semester}`;
    if (!bySemester[key]) bySemester[key] = [];
    bySemester[key].push(r.finalMark ?? r.mark ?? 0);
  });
  const gpaHistory = Object.values(bySemester).map((marks) => {
    const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
    return avg / 25; // convert marks to 0-4 GPA scale
  });

  return {
    attendanceRate: (studentData.attendancePercentage ?? 0) / 100,
    gpaCurrent: studentData.gpa ?? 0,
    failedModules,
    academicWarningCount,
    creditsCompleted,
    gpaHistory,
  };
}
