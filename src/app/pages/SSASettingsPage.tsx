import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Calendar, Save, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, updateDoc, doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';

export default function SSASettingsPage() {
  const { user } = useAuth();
  const [calendarLink, setCalendarLink] = useState('');
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    const fetchDoc = async () => {
      try {
        const snap = await getDocs(collection(db, 'student_support_advisors'));
        for (const d of snap.docs) {
          if (d.data().email?.toLowerCase().trim() === user.email.toLowerCase().trim()) {
            setDocId(d.id);
            setCalendarLink(d.data().calendarLink ?? '');
            return;
          }
        }
        // No document found — create one using user.id as fallback
        const fallbackId = user.id;
        await setDoc(doc(db, 'student_support_advisors', fallbackId), {
          email: user.email,
          name: user.name,
          role: user.role,
          calendarLink: '',
        });
        setDocId(fallbackId);
      } catch {
        toast.error('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [user]);

  const handleSave = async () => {
    if (!docId) {
      toast.error('Could not find your account record.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'student_support_advisors', docId), { calendarLink });
      toast.success('Calendar link saved successfully');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your Student Support Advisor profile settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-blue-600" />
            Google Calendar Booking Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calendarLink">Google Calendar Booking Link</Label>
            <Input
              id="calendarLink"
              value={calendarLink}
              onChange={(e) => setCalendarLink(e.target.value)}
              placeholder="https://calendar.app.google/..."
            />
            <p className="text-xs text-muted-foreground">
              Students will use this link to book sessions with you. You can find it in Google Calendar under Appointment Schedules.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
