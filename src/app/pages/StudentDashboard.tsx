import { useAuth } from '../AuthContext';
import { mockGrades, mockGradeProgression } from '../mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Award, Calendar, BookOpen, TrendingUp, AlertTriangle, Target, Brain, Heart, Users, Lightbulb, GraduationCap, Clock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { useData } from '../DataContext';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { students, appointments } = useData();
  const navigate = useNavigate();
  const student = students.find((s) => s.id === user?.id);
  const grades = mockGrades[user?.id || ''] || [];
  const studentAppointments = appointments.filter((a) => a.studentId === user?.id);
  const gradeProgression = mockGradeProgression[user?.id || ''] || [];

  if (!student) {
    return <div className="flex items-center justify-center h-96">
      <p className="text-muted-foreground">Student data not found</p>
    </div>;
  }

  const upcomingAppointments = studentAppointments.filter((a) => a.status === 'scheduled');

  // Calculate course completion rate
  const totalCreditsAttempted = grades.reduce((sum, g) => sum + g.credits, 0);
  const completedCredits = grades.filter(g => g.grade !== 'F' && g.grade !== 'W').reduce((sum, g) => sum + g.credits, 0);
  const completionRate = totalCreditsAttempted > 0 ? Math.round((completedCredits / totalCreditsAttempted) * 100) : 0;

  // Calculate semester GPAs
  const fall2024Grades = grades.filter(g => g.semester === 'Fall 2024');
  const spring2025Grades = grades.filter(g => g.semester === 'Spring 2025');
  
  const fall2024GPA = fall2024Grades.length > 0 
    ? fall2024Grades.reduce((sum, g) => sum + g.points * g.credits, 0) / fall2024Grades.reduce((sum, g) => sum + g.credits, 0)
    : 0;
  const spring2025GPA = spring2025Grades.length > 0 
    ? spring2025Grades.reduce((sum, g) => sum + g.points * g.credits, 0) / spring2025Grades.reduce((sum, g) => sum + g.credits, 0)
    : 0;

  const gpaTrend = spring2025GPA > fall2024GPA + 0.2 ? 'improving' : 
                   spring2025GPA < fall2024GPA - 0.2 ? 'declining' : 'stable';

  // Generate personalized recommendations based on profile
  const getPersonalizedRecommendations = () => {
    const recommendations = [];

    if (student.gpa < 2.5) {
      recommendations.push({
        type: 'Academic Support',
        icon: BookOpen,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        title: 'Academic Tutoring Available',
        description: 'Free one-on-one tutoring sessions to help improve your grades',
        action: 'Book Tutoring Session',
        actionType: 'tutoring',
      });
    }

    if (gpaTrend === 'declining') {
      recommendations.push({
        type: 'Academic Planning',
        icon: Target,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        title: 'Academic Success Plan',
        description: 'Work with an advisor to create a personalized success strategy',
        action: 'Schedule Appointment',
        actionType: 'appointment',
      });
    }

    // Always include wellness
    recommendations.push({
      type: 'Wellness',
      icon: Heart,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      title: 'Student Wellness Services',
      description: 'Mental health and wellness support available for all students',
      action: 'Learn More',
      actionType: 'wellness',
    });

    // Study skills if needed
    if (student.gpa < 3.0) {
      recommendations.push({
        type: 'Study Skills',
        icon: Brain,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        title: 'Study Skills Workshop',
        description: 'Learn time management and effective study techniques',
        action: 'Register Now',
        actionType: 'workshop',
      });
    }

    return recommendations;
  };

  const recommendations = getPersonalizedRecommendations();

  const handleRecommendationAction = (actionType: string) => {
    switch (actionType) {
      case 'tutoring':
        toast.success('Redirecting to tutoring booking system...');
        setTimeout(() => {
          toast.info('Tutoring session scheduled for next available slot');
        }, 1500);
        break;
      case 'appointment':
        navigate('/student/appointments');
        toast.info('Opening appointment booking page...');
        break;
      case 'wellness':
        toast.info('Opening Wellness & Counseling services...', {
          description: 'Contact: counseling@novara.ac.lk or visit Room 204'
        });
        break;
      case 'workshop':
        toast.success('Registration confirmed!', {
          description: 'Study Skills Workshop - March 15, 2026. Check your email for details.'
        });
        break;
      default:
        toast.info('Feature coming soon!');
    }
  };

  const getGPAColor = (gpa: number) => {
    if (gpa >= 3.5) return 'text-blue-600';
    if (gpa >= 3.0) return 'text-green-600';
    if (gpa >= 2.5) return 'text-yellow-600';
    if (gpa >= 2.0) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Academic Dashboard</h1>
        <p className="text-muted-foreground">Track your progress and access personalized support resources</p>
      </div>

      {/* Academic Status Alert */}
      {(student.riskLevel === 'high' || student.riskLevel === 'critical') && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-900">Academic Support Available</h3>
                <p className="text-sm text-orange-700 mt-1">
                  Your academic advisor has identified some areas where additional support might be helpful.
                  Check your recommended resources below or schedule an appointment to discuss your progress.
                </p>
                <Button 
                  size="sm" 
                  className="mt-3 bg-orange-600 hover:bg-orange-700"
                  onClick={() => navigate('/student/appointments')}
                >
                  Schedule Appointment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Academic Progress</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current GPA</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getGPAColor(student.gpa)}`}>
                  {student.gpa.toFixed(2)}
                </div>
                <Progress value={(student.gpa / 4.0) * 100} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">Out of 4.0</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Course Completion</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completionRate}%</div>
                <Progress value={completionRate} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {completedCredits} of {totalCreditsAttempted} credits
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{upcomingAppointments.length}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {upcomingAppointments.length === 0 ? 'No scheduled appointments' : 'Scheduled sessions'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Overview */}
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>GPA Progression</CardTitle>
                <CardDescription>Your grade point average over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={gradeProgression}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semester" />
                    <YAxis domain={[0, 4.0]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="gpa" stroke="#3b82f6" strokeWidth={2} name="GPA" />
                  </LineChart>
                </ResponsiveContainer>
                {gpaTrend === 'improving' && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <p className="text-sm text-green-800">Great job! Your GPA is improving.</p>
                  </div>
                )}
                {gpaTrend === 'declining' && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <p className="text-sm text-orange-800">Consider scheduling time with your advisor.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Academic Progress Tab */}
        <TabsContent value="progress" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Grade Report</CardTitle>
              <CardDescription>Your current grades and course performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Course</th>
                        <th className="p-3 text-center font-medium">Semester</th>
                        <th className="p-3 text-center font-medium">Grade</th>
                        <th className="p-3 text-center font-medium">Grade Points</th>
                        <th className="p-3 text-center font-medium">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((grade, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3 font-medium">{grade.courseName}</td>
                          <td className="p-3 text-center text-sm">{grade.semester}</td>
                          <td className="p-3 text-center">
                            <Badge className={grade.points >= 3.0 ? 'bg-green-500' : grade.points >= 2.0 ? 'bg-yellow-500' : 'bg-red-500'}>
                              {grade.grade}
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-semibold">{grade.points.toFixed(1)}</td>
                          <td className="p-3 text-center">{grade.credits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-blue-600" />
                <CardTitle>Personalized Recommendations</CardTitle>
              </div>
              <CardDescription>
                Resources and support services tailored to your academic profile
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {recommendations.map((rec, idx) => (
              <Card key={idx} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 ${rec.bgColor} rounded-lg`}>
                      <rec.icon className={`h-6 w-6 ${rec.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{rec.title}</h3>
                        <Badge variant="outline" className="text-xs">{rec.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{rec.description}</p>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleRecommendationAction(rec.actionType)}
                      >
                        {rec.action}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Additional Resources</CardTitle>
              <CardDescription>Campus services available to all students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium">Academic Success Center</div>
                      <div className="text-xs text-muted-foreground">Room 101, Library Building</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Visit</Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Heart className="h-5 w-5 text-pink-600" />
                    <div>
                      <div className="font-medium">Counseling Services</div>
                      <div className="text-xs text-muted-foreground">Room 204, Student Services</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Contact</Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">Career Services</div>
                      <div className="text-xs text-muted-foreground">Room 305, Administration</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Learn More</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>My Appointments</CardTitle>
                  <CardDescription>View and manage your scheduled appointments</CardDescription>
                </div>
                <Button onClick={() => navigate('/student/appointments')}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Book New Appointment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No upcoming appointments</p>
                  <Button onClick={() => navigate('/student/appointments')}>
                    Schedule Your First Appointment
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.map((appointment) => (
                    <Card key={appointment.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{appointment.type}</h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {appointment.date}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {appointment.time}
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-blue-500">Scheduled</Badge>
                        </div>
                        {appointment.notes && (
                          <div className="mt-3 p-2 bg-muted rounded text-sm">
                            {appointment.notes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}