import { mockStudents, mockInterventions } from '../mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Link } from 'react-router';
import { Search, Users, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { useData } from '../DataContext';
import { toast } from 'sonner';

export default function CounselorCasesPage() {
  const { addAppointment } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [newSession, setNewSession] = useState({
    type: 'Counseling Session',
    date: '',
    time: '',
    notes: '',
  });

  // Get students assigned to counselor
  const myCases = mockStudents.filter((s) => s.riskLevel === 'critical' || s.riskLevel === 'high').slice(0, 12);

  const filteredCases = myCases.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Calculate case statistics
  const activeInterventions = mockInterventions.filter(
    (i) => i.status === 'in-progress' && myCases.some((s) => s.id === i.studentId)
  ).length;

  const completedInterventions = mockInterventions.filter(
    (i) => i.status === 'completed' && myCases.some((s) => s.id === i.studentId)
  ).length;

  const handleScheduleSession = (studentId: string) => {
    setSelectedStudentId(studentId);
    setScheduleDialogOpen(true);
  };

  const handleSaveSession = () => {
    if (!newSession.date || !newSession.time) {
      toast.error('Please fill in date and time');
      return;
    }

    const appointment = {
      id: `apt${Date.now()}`,
      advisorId: 'coun1', // Counselor ID
      studentId: selectedStudentId,
      type: newSession.type,
      date: newSession.date,
      time: newSession.time,
      status: 'scheduled',
      notes: newSession.notes,
    };

    addAppointment(appointment);
    toast.success('Counseling session scheduled successfully');
    setScheduleDialogOpen(false);
    setSelectedStudentId('');
    setNewSession({
      type: 'Counseling Session',
      date: '',
      time: '',
      notes: '',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Cases</h1>
        <p className="text-muted-foreground">
          Track and manage students assigned to you for counseling
        </p>
      </div>

      {/* Case Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Cases</CardDescription>
            <CardTitle className="text-3xl">{myCases.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Active students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Critical Cases</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {myCases.filter((s) => s.riskLevel === 'critical').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Interventions</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{activeInterventions}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">In progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-green-600">{completedInterventions}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">This semester</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cases List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Cases</CardTitle>
          <CardDescription>Students currently under your counseling supervision</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredCases.map((student) => {
              const studentInterventions = mockInterventions.filter(
                (i) => i.studentId === student.id
              );
              const activeCount = studentInterventions.filter(
                (i) => i.status === 'in-progress'
              ).length;

              return (
                <div
                  key={student.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{student.name}</h3>
                        <Badge className={getRiskColor(student.riskLevel)}>
                          {student.riskLevel}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1 mb-3">
                        <p>
                          <span className="font-medium">ID:</span> {student.id}
                        </p>
                        <p>
                          <span className="font-medium">Program:</span> {student.program}
                        </p>
                        <p>
                          <span className="font-medium">GPA:</span> {student.gpa.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-muted-foreground">
                            {activeCount} active intervention{activeCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-muted-foreground">
                            {studentInterventions.filter((i) => i.status === 'completed').length}{' '}
                            completed
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link to={`/counselor/student/${student.id}`}>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </Link>
                      <Button size="sm" variant="default" onClick={() => handleScheduleSession(student.id)}>
                        Schedule Session
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCases.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No cases found matching your search</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Session Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Counseling Session</DialogTitle>
            <DialogDescription>
              Schedule a new counseling session for the selected student.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Session Type</Label>
              <Input
                id="type"
                value={newSession.type}
                onChange={(e) => setNewSession({ ...newSession, type: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={newSession.date}
                onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={newSession.time}
                onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={newSession.notes}
                onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveSession}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}