import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Clock, Save } from 'lucide-react';
import { db } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
];

const TIME_OPTIONS: string[] = [];
for (let h = 8; h <= 20; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 20) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

interface DayAvailability {
  available: boolean;
  from: string;
  to: string;
}

type AvailabilityMap = Record<string, DayAvailability>;

const defaultAvailability = (): AvailabilityMap =>
  Object.fromEntries(
    DAYS.map((d) => [d.key, { available: false, from: '09:00', to: '17:00' }])
  );

const getCollection = (role: string): string | null => {
  switch (role) {
    case 'sru':
      return 'student_support_advisors';
    case 'academic_mentor':
      return 'academic_mentors';
    case 'student_counsellor':
      return 'student_counsellors';
    default:
      return null;
  }
};

export default function AvailabilitySettingsPage() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<AvailabilityMap>(defaultAvailability());
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const collectionName = getCollection(user.role);
    if (!collectionName) return;

    const fetchAvailability = async () => {
      try {
        const q = query(collection(db, collectionName), where('email', '==', user.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          setDocId(docSnap.id);
          const data = docSnap.data();
          if (data.availability) {
            setAvailability({ ...defaultAvailability(), ...data.availability });
          }
        }
      } catch {
        toast.error('Failed to load availability settings.');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [user]);

  const toggleDay = (day: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], available: !prev[day].available },
    }));
  };

  const updateTime = (day: string, field: 'from' | 'to', value: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    const collectionName = getCollection(user.role);
    if (!collectionName || !docId) {
      toast.error('Could not find your account record.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, collectionName, docId), { availability });
      toast.success('Availability settings saved.');
    } catch {
      toast.error('Failed to save availability settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Availability Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set your weekly availability for appointments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-blue-600" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAYS.map((day) => {
            const dayData = availability[day.key];
            return (
              <div
                key={day.key}
                className={`rounded-lg border p-4 transition-colors ${
                  dayData.available ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-gray-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-[110px]">
                    <button
                      type="button"
                      onClick={() => toggleDay(day.key)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        dayData.available ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={dayData.available}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          dayData.available ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <Label
                      className={`text-sm font-medium cursor-pointer select-none ${
                        dayData.available ? 'text-gray-900' : 'text-gray-400'
                      }`}
                      onClick={() => toggleDay(day.key)}
                    >
                      {day.label}
                    </Label>
                  </div>

                  {dayData.available ? (
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">From</span>
                        <Select
                          value={dayData.from}
                          onValueChange={(v) => updateTime(day.key, 'from', v)}
                        >
                          <SelectTrigger className="w-24 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t} className="text-sm">
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">To</span>
                        <Select
                          value={dayData.to}
                          onValueChange={(v) => updateTime(day.key, 'to', v)}
                        >
                          <SelectTrigger className="w-24 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t} className="text-sm">
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground flex-1 text-right">
                      Unavailable
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Availability'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
