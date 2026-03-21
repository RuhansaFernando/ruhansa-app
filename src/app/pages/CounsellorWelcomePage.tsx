import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Button } from '../components/ui/button';
import { ExternalLink, Calendar, Heart } from 'lucide-react';
import { CALENDAR_LINKS } from '../config/calendarLinks';

export default function CounsellorWelcomePage() {
  const { user } = useAuth();
  const [calendarLink, setCalendarLink] = useState(CALENDAR_LINKS.counsellor);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLink = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'student_counsellors'), where('name', '==', user?.name))
        );
        if (!snap.empty) {
          const link = snap.docs[0].data().calendarLink;
          if (link) setCalendarLink(link);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLink();
  }, [user?.name]);

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto">
          <Heart className="h-8 w-8 text-purple-600" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {user?.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Student Counsellor · DropGuard
          </p>
        </div>

        <div className="rounded-xl border border-purple-100 bg-purple-50 px-6 py-5 text-left space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600 flex-shrink-0" />
            <p className="text-sm font-medium text-purple-900">Your booking page is on Google Calendar</p>
          </div>
          <p className="text-sm text-purple-700 leading-relaxed">
            Students book confidential counselling sessions directly through your Google Calendar booking link. No portal required — everything is managed through Google Calendar.
          </p>
        </div>

        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white w-full gap-2"
          disabled={loading}
          onClick={() => window.open(calendarLink, '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          Open My Booking Calendar
        </Button>

        <p className="text-xs text-gray-400">
          New appointments will appear in your Google Calendar. Students can book sessions 24/7 using this link.
        </p>
      </div>
    </div>
  );
}
