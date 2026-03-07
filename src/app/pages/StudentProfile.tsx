import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { mockRiskFactors, mockAttendance, mockGrades, mockEngagement, mockGradeProgression } from '../mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BarChart, Bar, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowLeft, AlertTriangle, Calendar, FileText, Activity, TrendingDown, User, Mail, BookOpen, Award, Hash, GraduationCap, Clock, Users2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { useData } from '../DataContext';
import { toast } from 'sonner';

export default function StudentProfile() {
  const { studentId } = useParams();
  const { students, interventions, appointments, addIntervention, addAppointment } = useData();
  
  // Intervention state
  const [interventionType, setInterventionType] = useState('');
  const [interventionDescription, setInterventionDescription] = useState('');
  const [isInterventionDialogOpen, setIsInterventionDialogOpen] = useState(false);
  
  // Appointment state
  const [appointmentType, setAppointmentType] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);

  const student = students.find((s) => s.id === studentId);
  const riskFactors = mockRiskFactors[studentId || ''] || [];
  const attendance = mockAttendance[studentId || ''] || [];
  const grades = mockGrades[studentId || ''] || [];
  const engagement = mockEngagement[studentId || ''];
  const studentInterventions = interventions.filter((i) => i.studentId === studentId);
  const studentAppointments = appointments.filter((a) => a.studentId === studentId);
  const gradeProgression = mockGradeProgression[studentId || ''] || [];

  if (!student) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Student not found</p>
      </div>
    );
  }

  const handleCreateIntervention = () => {
    if (!interventionType || !interventionDescription) {
      toast.error('Please fill in all fields');
      return;
    }

    const newIntervention = {
      id: `int${Date.now()}`,
      studentId: studentId || '',
      type: interventionType,
      description: interventionDescription,
      assignedBy: 'adv1', // In a real app, this would be the current user's ID
      status: 'pending' as const,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    addIntervention(newIntervention);
    toast.success('Intervention created successfully');
    setIsInterventionDialogOpen(false);
    setInterventionType('');
    setInterventionDescription('');
  };

  const handleScheduleAppointment = () => {
    if (!appointmentType || !appointmentDate || !appointmentTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newAppointment = {
      id: `apt${Date.now()}`,
      studentId: studentId || '',
      advisorId: 'adv1', // In a real app, this would be the current user's ID
      type: appointmentType,
      date: appointmentDate,
      time: appointmentTime,
      status: 'scheduled' as const,
      notes: appointmentNotes,
    };

    addAppointment(newAppointment);
    toast.success('Appointment scheduled successfully');
    setIsAppointmentDialogOpen(false);
    setAppointmentType('');
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentNotes('');
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return '';
    }
  };

  // Prepare radar chart data for risk factors
  const radarData = riskFactors.map((factor) => ({
    category: factor.category,
    score: 100 - factor.value, // Invert so higher is better
    fullMark: 100,
  }));

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/advisor/dashboard">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>

      {/* Student Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
            {student.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{student.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <Mail className="mr-1 h-3 w-3" />
                {student.email}
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <BookOpen className="mr-1 h-3 w-3" />
                {student.program}
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <User className="mr-1 h-3 w-3" />
                Year {student.year}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge
            variant={student.riskLevel === 'critical' || student.riskLevel === 'high' ? 'destructive' : 'default'}
            className="text-lg px-4 py-1"
          >
            {student.riskLevel.toUpperCase()} RISK
          </Badge>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold">GPA: {student.gpa.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Risk Score Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Risk Assessment</CardTitle>
          <CardDescription>Comprehensive risk score based on multiple factors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Risk Score</span>
                <span className={`font-bold ${getRiskColor(student.riskLevel)}`}>
                  {student.riskScore}/100
                </span>
              </div>
              <Progress value={student.riskScore} className="h-3" />
            </div>
            <p className="text-sm text-muted-foreground">
              {student.riskLevel === 'critical' && 'This student requires immediate intervention and close monitoring.'}
              {student.riskLevel === 'high' && 'This student should be monitored closely and may benefit from intervention.'}
              {student.riskLevel === 'medium' && 'This student shows some concerning patterns. Regular check-ins recommended.'}
              {student.riskLevel === 'low' && 'This student is performing well with minimal risk factors.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detailed information */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-7">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="risk-factors">Risk Factors</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="interventions">Interventions</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Information</CardTitle>
              <CardDescription>Complete academic and personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Academic Information */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Academic Information</h3>
                  
                  <div className="space-y-6">
                    {/* Student ID */}
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <Hash className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">Student ID</p>
                        <p className="font-medium">{student.id}</p>
                      </div>
                    </div>

                    {/* Programme */}
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <GraduationCap className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">Programme</p>
                        <p className="font-medium">{student.program}</p>
                      </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">Date of Birth</p>
                        <p className="font-medium">30 Jan 2003</p>
                      </div>
                    </div>

                    {/* GPA */}
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <Award className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">GPA</p>
                        <p className="font-medium">{student.gpa.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Personal Details</h3>
                  
                  <div className="space-y-6">
                    {/* Sex */}
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">Sex</p>
                        <p className="font-medium">F</p>
                      </div>
                    </div>

                    {/* Year of Study */}
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">Year of Study</p>
                        <p className="font-medium">{student.year}</p>
                      </div>
                    </div>

                    {/* Mode */}
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">Mode</p>
                        <p className="font-medium">Full-time</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t my-6"></div>

              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Email</p>
                      <p className="font-medium">{student.email}</p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Phone</p>
                      <p className="font-medium">+94 77 123 4567</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Address</p>
                      <p className="font-medium">123 Galle Road, Colombo 03<br />Sri Lanka</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t my-6"></div>

              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Programme Details</h3>
                
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Faculty */}
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <Users2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Faculty</p>
                      <p className="font-medium">Faculty of Computing</p>
                    </div>
                  </div>

                  {/* Start Session */}
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Start Session</p>
                      <p className="font-medium">2024/2025</p>
                    </div>
                  </div>

                  {/* End Session */}
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">End Session</p>
                      <p className="font-medium">2027/2028</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Factors Tab */}
        <TabsContent value="risk-factors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Factor Breakdown</CardTitle>
              <CardDescription>Individual risk factors and their weighted contribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {riskFactors.map((factor, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{factor.category}</span>
                      <span className="text-muted-foreground">Weight: {factor.weight}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={factor.value} className="flex-1" />
                      <span className="text-sm font-medium w-12">{factor.value}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{factor.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {riskFactors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Risk Profile Visualization</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="category" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Performance" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>Course-by-course attendance tracking</CardDescription>
            </CardHeader>
            <CardContent>
              {attendance.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={attendance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="courseName" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="percentage" fill="#3b82f6" name="Attendance %" />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="space-y-3">
                    {attendance.map((record) => (
                      <div key={record.courseId} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium">{record.courseName}</h4>
                            <p className="text-sm text-muted-foreground">{record.courseId}</p>
                          </div>
                          <Badge variant={record.percentage < 75 ? 'destructive' : 'secondary'}>
                            {record.percentage}%
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Attended: {record.attended} / {record.totalClasses} classes
                        </div>
                        <Progress value={record.percentage} className="mt-2" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No attendance data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Academic Performance</CardTitle>
              <CardDescription>Grades and GPA progression over time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {gradeProgression.length > 0 && (
                <div>
                  <h4 className="font-medium mb-4">GPA Progression</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={gradeProgression}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="semester" />
                      <YAxis domain={[0, 4.0]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="gpa" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {grades.length > 0 && (
                <div>
                  <h4 className="font-medium mb-4">Course Grades</h4>
                  <div className="space-y-3">
                    {grades.map((grade) => (
                      <div key={grade.courseId} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-medium">{grade.courseName}</h5>
                            <p className="text-sm text-muted-foreground">
                              {grade.semester} • {grade.credits} credits
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">{grade.grade}</div>
                            <div className="text-sm text-muted-foreground">{grade.points.toFixed(1)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Engagement Metrics</CardTitle>
              <CardDescription>LMS activity and support service interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {engagement ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-blue-600">{engagement.lmsLogins}</div>
                      <div className="text-sm text-muted-foreground mt-1">LMS Logins</div>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-green-600">{engagement.assignmentSubmissions}</div>
                      <div className="text-sm text-muted-foreground mt-1">Assignments</div>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-purple-600">{engagement.forumParticipation}</div>
                      <div className="text-sm text-muted-foreground mt-1">Forum Posts</div>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-orange-600">{engagement.supportServiceInteractions}</div>
                      <div className="text-sm text-muted-foreground mt-1">Support Visits</div>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Last Activity:</span>
                      <span className="text-muted-foreground">{engagement.lastActivity}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No engagement data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interventions Tab */}
        <TabsContent value="interventions" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Intervention History</h3>
              <p className="text-sm text-muted-foreground">Track and manage student interventions</p>
            </div>
            <Dialog open={isInterventionDialogOpen} onOpenChange={setIsInterventionDialogOpen}>
              <DialogTrigger asChild>
                <Button>Create Intervention</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Intervention</DialogTitle>
                  <DialogDescription>Assign intervention strategy for {student.name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Intervention Type</Label>
                    <Select value={interventionType} onValueChange={setInterventionType}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Academic Tutoring">Academic Tutoring</SelectItem>
                        <SelectItem value="Counseling">Counseling</SelectItem>
                        <SelectItem value="Faculty Mentoring">Faculty Mentoring</SelectItem>
                        <SelectItem value="Study Skills Workshop">Study Skills Workshop</SelectItem>
                        <SelectItem value="Early Alert">Early Alert</SelectItem>
                        <SelectItem value="Peer Mentoring">Peer Mentoring</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the intervention strategy..."
                      value={interventionDescription}
                      onChange={(e) => setInterventionDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleCreateIntervention} className="w-full">
                    Create Intervention
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {studentInterventions.length > 0 ? (
              studentInterventions.map((intervention) => (
                <Card key={intervention.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">{intervention.type}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{intervention.description}</p>
                      </div>
                      <Badge
                        variant={
                          intervention.status === 'completed'
                            ? 'secondary'
                            : intervention.status === 'in-progress'
                            ? 'default'
                            : 'outline'
                        }
                      >
                        {intervention.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div>Created: {intervention.createdAt}</div>
                      <div>Updated: {intervention.updatedAt}</div>
                      {intervention.assignedTo && <div>Assigned to: {intervention.assignedTo}</div>}
                    </div>
                    {intervention.notes && (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <p className="text-sm">{intervention.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No interventions recorded yet
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Appointment Schedule</h3>
              <p className="text-sm text-muted-foreground">Manage appointments and meetings</p>
            </div>
            <Dialog open={isAppointmentDialogOpen} onOpenChange={setIsAppointmentDialogOpen}>
              <DialogTrigger asChild>
                <Button>Schedule Appointment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule New Appointment</DialogTitle>
                  <DialogDescription>Assign appointment for {student.name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Appointment Type</Label>
                    <Select value={appointmentType} onValueChange={setAppointmentType}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Counseling Session">Counseling Session</SelectItem>
                        <SelectItem value="Academic Advisor Meeting">Academic Advisor Meeting</SelectItem>
                        <SelectItem value="Peer Tutoring Session">Peer Tutoring Session</SelectItem>
                        <SelectItem value="Support Service Consultation">Support Service Consultation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={appointmentTime}
                      onChange={(e) => setAppointmentTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any additional notes..."
                      value={appointmentNotes}
                      onChange={(e) => setAppointmentNotes(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleScheduleAppointment} className="w-full">
                    Schedule Appointment
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {studentAppointments.length > 0 ? (
              studentAppointments.map((appointment) => (
                <Card key={appointment.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium">{appointment.type}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {appointment.date} at {appointment.time}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          appointment.status === 'completed'
                            ? 'secondary'
                            : appointment.status === 'scheduled'
                            ? 'default'
                            : 'destructive'
                        }
                      >
                        {appointment.status}
                      </Badge>
                    </div>
                    {appointment.notes && (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <p className="text-sm">{appointment.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No appointments scheduled
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}