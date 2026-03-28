import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../AuthContext';
import { mockAlerts } from '../mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { AlertTriangle, Bell, Users, FileText, TrendingDown, CheckCircle } from 'lucide-react';
import { useData } from '../DataContext';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const { students, interventions } = useData();
  const [concernStudent, setConcernStudent] = useState('');
  const [concernDescription, setConcernDescription] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get students assigned to this faculty member
  const assignedStudents = students.filter((s) => s.facultyMentorId === user?.id);
  
  // Get alerts for assigned students
  const studentAlerts = mockAlerts.filter((alert) =>
    assignedStudents.some((s) => s.id === alert.studentId)
  );

  // Get interventions for assigned students
  const facultyInterventions = interventions.filter((i) =>
    assignedStudents.some((s) => s.id === i.studentId)
  );

  const activeInterventions = facultyInterventions.filter((i) => i.status === 'in-progress');
  const criticalStudents = assignedStudents.filter((s) => s.riskLevel === 'critical' || s.riskLevel === 'high');
  const unacknowledgedAlerts = studentAlerts.filter((a) => !a.acknowledged);

  const handleSubmitConcern = () => {
    setIsDialogOpen(false);
    setConcernStudent('');
    setConcernDescription('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Faculty Dashboard</h1>
        <p className="text-muted-foreground">Monitor students and report concerns</p>
      </div>

      {/* Unacknowledged Alerts */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Recent Alerts</h2>
          {unacknowledgedAlerts.slice(0, 3).map((alert) => {
            const student = students.find((s) => s.id === alert.studentId);
            return (
              <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                <Bell className="h-4 w-4" />
                <AlertTitle>{alert.type} - {student?.name}</AlertTitle>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedStudents.length}</div>
            <p className="text-xs text-muted-foreground">Under your mentorship</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At-Risk Students</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalStudents.length}</div>
            <p className="text-xs text-muted-foreground">High or critical risk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Interventions</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeInterventions.length}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Alerts</CardTitle>
            <Bell className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unacknowledgedAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Report Student Concern
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Student Concern</DialogTitle>
              <DialogDescription>
                Submit a concern about a student who may need additional support
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="student">Student</Label>
                <Select value={concernStudent} onValueChange={setConcernStudent}>
                  <SelectTrigger id="student">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="concern">Concern Description</Label>
                <Textarea
                  id="concern"
                  placeholder="Describe your concerns about the student..."
                  value={concernDescription}
                  onChange={(e) => setConcernDescription(e.target.value)}
                  rows={5}
                />
              </div>
              <Button onClick={handleSubmitConcern} className="w-full">
                Submit Concern
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Assigned Students */}
      <Card>
        <CardHeader>
          <CardTitle>My Assigned Students</CardTitle>
          <CardDescription>Students under your mentorship or in your courses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assignedStudents.length > 0 ? (
              assignedStudents.map((student) => (
                <div key={student.id} className="flex items-center justify-between border rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                      {student.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-medium">{student.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {student.programme} • Year {student.year} • GPA: {student.gpa.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        student.riskLevel === 'critical' || student.riskLevel === 'high'
                          ? 'destructive'
                          : 'default'
                      }
                    >
                      {student.riskLevel.toUpperCase()}
                    </Badge>
                    <Link to={`/faculty/student/${student.id}`}>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No students assigned</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Interventions */}
      {activeInterventions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Intervention Progress</CardTitle>
            <CardDescription>Monitor ongoing interventions for your students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeInterventions.map((intervention) => {
                const student = students.find((s) => s.id === intervention.studentId);
                return (
                  <div key={intervention.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{intervention.type}</h4>
                        <p className="text-sm text-muted-foreground">{student?.name}</p>
                      </div>
                      <Badge variant="default">{intervention.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{intervention.description}</p>
                    {intervention.notes && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        {intervention.notes}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-2">
                      Last updated: {intervention.updatedAt}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}