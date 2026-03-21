import { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { ClipboardList, Plus, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

const INTERVENTION_TYPES = [
  'Phone Call',
  'Email',
  'In-Person Meeting',
  'Referred to Registry',
  'Referred to Counsellor',
  'Referred to External Counsellor',
  'Referred to Academic Mentor',
  'Other',
];

const OUTCOME_OPTIONS = [
  'Positive Response',
  'No Response',
  'Follow Up Required',
  'Resolved',
];

interface InterventionDoc {
  id: string;
  studentId: string;
  studentName: string;
  programme: string;
  riskLevel: string;
  interventionType: string;
  date: string;
  outcome: string;
  notes: string;
  recordedBy: string;
  createdAt: any;
  status: 'active' | 'pending' | 'completed';
}

interface StudentOption {
  id: string;
  name: string;
  programme: string;
  riskLevel: string;
}

const getOutcomeBadge = (outcome: string) => {
  switch (outcome) {
    case 'Positive Response':
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">{outcome}</Badge>;
    case 'Resolved':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">{outcome}</Badge>;
    case 'No Response':
      return <Badge className="bg-gray-100 text-gray-700 border-gray-200 text-xs">{outcome}</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{outcome || '—'}</Badge>;
  }
};

const deriveStatus = (outcome: string): InterventionDoc['status'] => {
  if (!outcome) return 'pending';
  if (outcome === 'Resolved') return 'completed';
  return 'active';
};

const formatDate = (val: any) => {
  if (!val) return '—';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const todayStr = () => new Date().toISOString().split('T')[0];

export default function SRUInterventionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [interventions, setInterventions] = useState<InterventionDoc[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  // Tabs
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'completed'>('active');

  // Modal
  const [isOpen, setIsOpen] = useState(false);
  const [formStudent, setFormStudent] = useState('');
  const [formType, setFormType] = useState('');
  const [formDate, setFormDate] = useState(todayStr());
  const [formOutcome, setFormOutcome] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'interventions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setInterventions(
        snap.docs.map((d) => {
          const outcome = d.data().outcome ?? '';
          return {
            id: d.id,
            studentId: d.data().studentId ?? '',
            studentName: d.data().studentName ?? '',
            programme: d.data().programme ?? '',
            riskLevel: d.data().riskLevel ?? 'low',
            interventionType: d.data().interventionType ?? '',
            date: d.data().date ?? '',
            outcome,
            notes: d.data().notes ?? '',
            recordedBy: d.data().recordedBy ?? '',
            createdAt: d.data().createdAt,
            status: d.data().status ?? deriveStatus(outcome),
          };
        })
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(collection(db, 'students')).then((snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? '',
          programme: d.data().programme ?? '',
          riskLevel: d.data().riskLevel ?? 'low',
        })).sort((a, b) => a.name.localeCompare(b.name))
      );
    });
  }, []);

  const now = new Date();
  const thisMonthCount = interventions.filter((i) => {
    if (!i.createdAt) return false;
    const d = i.createdAt?.toDate ? i.createdAt.toDate() : new Date(i.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const highRiskCount = interventions.filter((i) => i.riskLevel === 'high').length;

  const filtered = useMemo(() => {
    return interventions.filter((i) => {
      // Tab filter
      if (i.status !== activeTab) return false;
      // Dropdown filters
      const matchesSearch  = !search || i.studentName.toLowerCase().includes(search.toLowerCase());
      const matchesType    = typeFilter === 'all' || i.interventionType === typeFilter;
      const matchesOutcome = outcomeFilter === 'all' || i.outcome === outcomeFilter;
      const matchesRisk    = riskFilter === 'all' || i.riskLevel === riskFilter;
      return matchesSearch && matchesType && matchesOutcome && matchesRisk;
    });
  }, [interventions, search, typeFilter, outcomeFilter, riskFilter, activeTab]);

  const resetForm = () => {
    setFormStudent('');
    setFormType('');
    setFormDate(todayStr());
    setFormOutcome('');
    setFormNotes('');
  };

  const handleSave = async () => {
    if (!formStudent || !formType || !formDate || !formOutcome) {
      toast.error('Please fill in all required fields.');
      return;
    }
    const selectedStudent = students.find((s) => s.id === formStudent);
    if (!selectedStudent) return;

    setSaving(true);
    try {
      await addDoc(collection(db, 'interventions'), {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        programme: selectedStudent.programme,
        riskLevel: selectedStudent.riskLevel,
        interventionType: formType,
        date: formDate,
        outcome: formOutcome,
        notes: formNotes.trim(),
        recordedBy: user?.name ?? 'Staff',
        status: deriveStatus(formOutcome),
        createdAt: serverTimestamp(),
      });
      toast.success('Intervention logged successfully.');
      setIsOpen(false);
      resetForm();
    } catch {
      toast.error('Failed to save intervention. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'active',    label: 'Active' },
    { key: 'pending',   label: 'Pending' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interventions</h1>
          <p className="text-muted-foreground text-sm mt-1">Log and track student interventions</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => { resetForm(); setIsOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Log Intervention
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Interventions</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : interventions.length}</p>
                <p className="text-xs text-muted-foreground mt-1">All records</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : thisMonthCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Current month</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Risk Interventions</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : highRiskCount}</p>
                <p className="text-xs text-muted-foreground mt-1">High risk students</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intervention list with tabs + filters */}
      <div className="rounded-xl border bg-white">
        <div className="px-4 pt-4 pb-0 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            {/* Tabs */}
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === t.key
                      ? 'bg-gray-900 text-white'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search student..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-36"
                  autoComplete="off"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {INTERVENTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="All Outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  {OUTCOME_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Intervention cards */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No interventions found.</p>
            </div>
          ) : (
            filtered.map((intervention) => (
              <div key={intervention.id} className="border rounded-xl p-4 mb-3 last:mb-0 bg-white">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {intervention.studentName} — {intervention.interventionType || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Started {intervention.date || formatDate(intervention.createdAt)} · Recorded by {intervention.recordedBy || '—'}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <Badge className={
                      intervention.riskLevel === 'high'
                        ? 'bg-red-100 text-red-800 border-red-200 text-xs'
                        : 'bg-amber-100 text-amber-800 border-amber-200 text-xs'
                    }>
                      {intervention.riskLevel === 'high' ? 'High' : 'Medium'}
                    </Badge>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs capitalize">
                      {intervention.status}
                    </Badge>
                    {intervention.outcome && getOutcomeBadge(intervention.outcome)}
                  </div>
                </div>

                {/* Next Best Action box */}
                <div className="bg-blue-50 rounded-lg px-3 py-2 mb-3 text-xs text-blue-800 border border-blue-100">
                  <span className="font-semibold">Next Best Action: </span>
                  {intervention.notes || 'Schedule a follow-up meeting with the student to review progress.'}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{intervention.interventionType || '—'}</Badge>
                    <Badge variant="outline" className="text-xs">{intervention.programme || 'Unknown programme'}</Badge>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => navigate(`/sru/students/${intervention.studentId}`)}
                    >
                      View Profile
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-xs"
                      onClick={() => { resetForm(); setFormStudent(intervention.studentId); setIsOpen(true); }}
                    >
                      Update Progress
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Log Intervention Modal */}
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) resetForm(); setIsOpen(o); }}>
        <DialogContent className="max-w-md" autoComplete="off">
          <DialogHeader>
            <DialogTitle>Log Intervention</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Student <span className="text-red-500">*</span></Label>
              <Select value={formStudent} onValueChange={setFormStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Intervention Type <span className="text-red-500">*</span></Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {INTERVENTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Outcome <span className="text-red-500">*</span></Label>
              <Select value={formOutcome} onValueChange={setFormOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOME_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                autoComplete="off"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
