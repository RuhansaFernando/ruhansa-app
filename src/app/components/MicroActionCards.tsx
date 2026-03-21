// ============================================================
// MicroActionCards.tsx  —  Novelty 3
// Personalised micro-action cards linked to the student's
// weakest factor. Each card has a CTA that navigates in-app.
// ============================================================

import { useNavigate } from 'react-router';
import { CALENDAR_LINKS } from '../config/calendarLinks';

interface MicroActionCardsProps {
  attendancePct: number;
  gpa: number;
  engagementPct: number;
  riskScore: number;
}

interface ActionCard {
  icon: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
  urgency: 'urgent' | 'warning' | 'info';
}

export function MicroActionCards({
  attendancePct,
  gpa,
  engagementPct,
}: MicroActionCardsProps) {
  const navigate = useNavigate();

  const actions: ActionCard[] = [];

  // Attendance action
  if (attendancePct < 75) {
    actions.push({
      icon: '📅',
      title: attendancePct < 60 ? 'Book a session with your SSA urgently' : 'Book a check-in with your SSA',
      description: attendancePct < 60
        ? `Your attendance is at ${attendancePct}%. Your Student Support Advisor is here to help you understand what's getting in the way and how to fix it.`
        : `Your attendance is at ${attendancePct}% — just below the 75% target. A quick chat with your SSA can help you get back on track.`,
      ctaLabel: 'Book Appointment',
      ctaPath: CALENDAR_LINKS.ssa,
      urgency: attendancePct < 60 ? 'urgent' : 'warning',
    });
  }

  // Academic action
  if (gpa < 2.5) {
    actions.push({
      icon: '📚',
      title: gpa < 2.0 ? 'Get tutoring support for struggling modules' : 'Review your module performance',
      description: gpa < 2.0
        ? `Your GPA is ${gpa.toFixed(1)}. The tutoring centre offers free 1-to-1 sessions. Booking early gives you the best chance of improving your grades.`
        : `Your GPA is ${gpa.toFixed(1)} — close to the 2.5 target. Reviewing your weakest modules now will help you reach it.`,
      ctaLabel: 'View My Marks',
      ctaPath: '/student/marks',
      urgency: gpa < 2.0 ? 'urgent' : 'warning',
    });
  }

  // Engagement action
  if (engagementPct < 60) {
    actions.push({
      icon: '💻',
      title: 'Log into your course materials today',
      description: `Your online engagement has dropped to ${engagementPct}% of the expected level. Even 20 minutes of reading or reviewing notes helps keep your score on track.`,
      ctaLabel: 'View My Attendance',
      ctaPath: '/student/attendance',
      urgency: 'info',
    });
  }

  // If all good
  if (actions.length === 0) {
    actions.push({
      icon: '✅',
      title: 'You are on track — keep it up!',
      description: 'Your attendance, grades, and engagement are all within healthy ranges. Continue your current habits to maintain your standing.',
      ctaLabel: 'View Dashboard',
      ctaPath: '/student/dashboard',
      urgency: 'info',
    });
  }

  const urgencyStyles = {
    urgent:  { border: 'border-l-4 border-l-red-400',   icon: 'bg-red-50',    btn: 'bg-red-600 hover:bg-red-700 text-white' },
    warning: { border: 'border-l-4 border-l-amber-400', icon: 'bg-amber-50',  btn: 'bg-amber-600 hover:bg-amber-700 text-white' },
    info:    { border: 'border-l-4 border-l-blue-400',  icon: 'bg-blue-50',   btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
        Steps you can take right now
      </p>
      {actions.map((action, i) => {
        const styles = urgencyStyles[action.urgency];
        return (
          <div
            key={i}
            className={`flex gap-3 p-3.5 rounded-xl border border-gray-100 bg-white ${styles.border}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${styles.icon}`}>
              {action.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 mb-1">{action.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed mb-2.5">{action.description}</p>
              <button
                onClick={() => action.ctaPath.startsWith('http') ? window.open(action.ctaPath, '_blank') : navigate(action.ctaPath)}
                className={`inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${styles.btn}`}
              >
                {action.ctaLabel} →
              </button>
            </div>
          </div>
        );
      })}

      {/* SSA notified indicator */}
      <div className="mt-1 bg-gray-50 rounded-xl px-4 py-3 text-center border border-gray-100">
        <p className="text-xs font-medium text-gray-700 mb-1">Your SSA has been notified</p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Your Student Support Advisor can see your current score and factors. They may reach out to you this week. You can also contact them directly at any time.
        </p>
      </div>
    </div>
  );
}
