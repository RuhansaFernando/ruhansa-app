import { Link } from 'react-router';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Users, Calendar, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { useData } from '../DataContext';

export default function CounselorDashboard() {
  const { user } = useAuth();
  const { students, interventions, appointments } = useData();

  // Get students assigned to this counselor
  const assignedStudents = students.filter((s) => s.counselorId === user?.id);
  
  // Get counseling interventions
  const counselingInterventions = interventions.filter(
    (i) => i.type === 'Counseling' && assignedStudents.some((s) => s.id === i.studentId)
  );

  // Get appointments
  const counselorAppointments = appointments.filter((a) => a.advisorId === user?.id);
  const upcomingAppointments = counselorAppointments.filter((a) => a.status === 'scheduled');
  const completedAppointments = counselorAppointments.filter((a) => a.status === 'completed');

  const activeInterventions = counselingInterventions.filter((i) => i.status === 'in-progress');
  const completedInterventions = counselingInterventions.filter((i) => i.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Counselor Dashboard</h1>
        <p className="text-muted-foreground">Support students through counseling and guidance</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedStudents.length}</div>
            <p className="text-xs text-muted-foreground">Under your counseling</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeInterventions.length}</div>
            <p className="text-xs text-muted-foreground">Ongoing counseling</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAppointments.length}</div>
            <p className="text-xs text-muted-foreground">Scheduled appointments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Cases</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedInterventions.length}</div>
            <p className="text-xs text-muted-foreground">Successfully resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Counseling Sessions</CardTitle>
            <CardDescription>Your scheduled appointments for this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => {
                const student = students.find((s) => s.id === appointment.studentId);
                return (
                  <div key={appointment.id} className="flex items-center justify-between border rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <div>
                        <h4 className="font-medium">{student?.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {appointment.date} at {appointment.time}
                        </p>
                        {appointment.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{appointment.notes}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="default">{appointment.type}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assigned Students */}
      <Card>
        <CardHeader>
          <CardTitle>Students Under Counseling</CardTitle>
          <CardDescription>Track progress and manage counseling sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assignedStudents.length > 0 ? (
              assignedStudents.map((student) => {
                const studentInterventions = counselingInterventions.filter(
                  (i) => i.studentId === student.id
                );
                const activeCount = studentInterventions.filter((i) => i.status === 'in-progress').length;
                const completedCount = studentInterventions.filter((i) => i.status === 'completed').length;
                const totalSessions = activeCount + completedCount;

                return (
                  <div key={student.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold">
                          {student.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="font-medium">{student.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {student.programme} • Year {student.year}
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
                        <Link to={`/counselor/student/${student.id}`}>
                          <Button size="sm" variant="outline">
                            View Progress
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {totalSessions > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Counseling Progress</span>
                          <span className="font-medium">
                            {completedCount} of {totalSessions} sessions completed
                          </span>
                        </div>
                        <Progress value={(completedCount / totalSessions) * 100} />
                      </div>
                    )}
                  </div>
                );
              })
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
            <CardTitle>Active Counseling Cases</CardTitle>
            <CardDescription>Ongoing interventions and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeInterventions.map((intervention) => {
                const student = students.find((s) => s.id === intervention.studentId);
                return (
                  <div key={intervention.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{student?.name}</h4>
                        <p className="text-sm text-muted-foreground">{intervention.description}</p>
                      </div>
                      <Badge variant="default">{intervention.status}</Badge>
                    </div>
                    {intervention.notes && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        {intervention.notes}
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
                      <span>Started: {intervention.createdAt}</span>
                      <span>Last updated: {intervention.updatedAt}</span>
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