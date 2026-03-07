import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { GraduationCap, TrendingDown, TrendingUp, BookOpen, Award, Search, Download, Activity, Target, Brain, Users } from 'lucide-react';
import { mockStudents, mockGrades, mockEngagement, mockRiskFactors, mockAttendance } from '../mockData';
import { useNavigate } from 'react-router';

export default function AcademicPerformancePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterRiskLevel, setFilterRiskLevel] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Prepare comprehensive student data
  const studentsWithPerformance = mockStudents.map(student => {
    const grades = mockGrades[student.id] || [];
    const engagement = mockEngagement[student.id] || {
      lmsLogins: 0,
      assignmentSubmissions: 0,
      forumParticipation: 0,
      supportServiceInteractions: 0,
      lastActivity: 'N/A',
    };
    const riskFactors = mockRiskFactors[student.id] || [];
    const attendance = mockAttendance[student.id] || [];

    // Calculate course completion rate
    const totalCreditsAttempted = grades.reduce((sum, g) => sum + g.credits, 0);
    const completedCredits = grades.filter(g => g.grade !== 'F' && g.grade !== 'W').reduce((sum, g) => sum + g.credits, 0);
    const completionRate = totalCreditsAttempted > 0 ? Math.round((completedCredits / totalCreditsAttempted) * 100) : 0;

    // Calculate GPA trend
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

    // Calculate engagement score (0-100)
    const engagementScore = Math.min(100, Math.round(
      (engagement.lmsLogins * 0.3) +
      (engagement.assignmentSubmissions * 2) +
      (engagement.forumParticipation * 3) +
      (engagement.supportServiceInteractions * 5)
    ));

    // Calculate average attendance
    const avgAttendance = attendance.length > 0
      ? Math.round(attendance.reduce((sum, a) => sum + a.percentage, 0) / attendance.length)
      : 0;

    return {
      ...student,
      grades,
      engagement,
      riskFactors,
      attendance,
      completionRate,
      gpaTrend,
      engagementScore,
      avgAttendance,
      fall2024GPA: Math.round(fall2024GPA * 100) / 100,
      spring2025GPA: Math.round(spring2025GPA * 100) / 100,
    };
  });

  // Filter students
  const filteredStudents = studentsWithPerformance.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProgram = filterProgram === 'all' || student.program === filterProgram;
    const matchesRisk = filterRiskLevel === 'all' || student.riskLevel === filterRiskLevel;
    return matchesSearch && matchesProgram && matchesRisk;
  });

  // Get unique programs
  const allPrograms = Array.from(new Set(mockStudents.map(s => s.program)));

  // Calculate statistics
  const totalStudents = filteredStudents.length;
  const avgGPA = filteredStudents.length > 0
    ? (filteredStudents.reduce((sum, s) => sum + s.gpa, 0) / filteredStudents.length).toFixed(2)
    : '0.00';
  const avgCompletionRate = filteredStudents.length > 0
    ? Math.round(filteredStudents.reduce((sum, s) => sum + s.completionRate, 0) / filteredStudents.length)
    : 0;
  const improvingStudents = filteredStudents.filter(s => s.gpaTrend === 'improving').length;
  const decliningStudents = filteredStudents.filter(s => s.gpaTrend === 'declining').length;

  // GPA Distribution
  const gpaDistribution = [
    { range: '0.0-1.5', count: filteredStudents.filter(s => s.gpa < 1.5).length, color: '#ef4444' },
    { range: '1.5-2.0', count: filteredStudents.filter(s => s.gpa >= 1.5 && s.gpa < 2.0).length, color: '#f59e0b' },
    { range: '2.0-2.5', count: filteredStudents.filter(s => s.gpa >= 2.0 && s.gpa < 2.5).length, color: '#fbbf24' },
    { range: '2.5-3.0', count: filteredStudents.filter(s => s.gpa >= 2.5 && s.gpa < 3.0).length, color: '#84cc16' },
    { range: '3.0-3.5', count: filteredStudents.filter(s => s.gpa >= 3.0 && s.gpa < 3.5).length, color: '#10b981' },
    { range: '3.5-4.0', count: filteredStudents.filter(s => s.gpa >= 3.5).length, color: '#3b82f6' },
  ];

  // GPA Trend Over Time (Mock data for all students)
  const gpaOverTime = [
    { semester: 'Fall 2023', avgGPA: 2.65 },
    { semester: 'Spring 2024', avgGPA: 2.62 },
    { semester: 'Fall 2024', avgGPA: 2.58 },
    { semester: 'Spring 2025', avgGPA: 2.55 },
  ];

  // Performance Metrics Comparison
  const performanceMetrics = [
    { metric: 'GPA', value: parseFloat(avgGPA) * 25, fullMark: 100 },
    { metric: 'Completion Rate', value: avgCompletionRate, fullMark: 100 },
    { metric: 'Attendance', value: filteredStudents.length > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.avgAttendance, 0) / filteredStudents.length) : 0, fullMark: 100 },
    { metric: 'Engagement', value: filteredStudents.length > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.engagementScore, 0) / filteredStudents.length) : 0, fullMark: 100 },
  ];

  // Engagement metrics summary
  const engagementMetrics = [
    { activity: 'LMS Logins', avg: filteredStudents.length > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.engagement.lmsLogins, 0) / filteredStudents.length) : 0 },
    { activity: 'Assignments', avg: filteredStudents.length > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.engagement.assignmentSubmissions, 0) / filteredStudents.length) : 0 },
    { activity: 'Forum Posts', avg: filteredStudents.length > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.engagement.forumParticipation, 0) / filteredStudents.length) : 0 },
    { activity: 'Support Services', avg: filteredStudents.length > 0 ? Math.round(filteredStudents.reduce((sum, s) => sum + s.engagement.supportServiceInteractions, 0) / filteredStudents.length) : 0 },
  ];

  // Selected student detailed view
  const selectedStudentData = selectedStudent 
    ? studentsWithPerformance.find(s => s.id === selectedStudent)
    : null;

  const getTrendBadge = (trend: string) => {
    if (trend === 'improving') return <Badge className="bg-green-500">Improving</Badge>;
    if (trend === 'declining') return <Badge className="bg-red-500">Declining</Badge>;
    return <Badge className="bg-gray-500">Stable</Badge>;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-400" />;
  };

  const getGPAColor = (gpa: number) => {
    if (gpa >= 3.5) return 'text-blue-600';
    if (gpa >= 3.0) return 'text-green-600';
    if (gpa >= 2.5) return 'text-yellow-600';
    if (gpa >= 2.0) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Academic Performance Monitoring</h1>
        <p className="text-muted-foreground">
          Track and monitor student academic performance, grades, GPA progression, and engagement metrics
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">Monitored students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average GPA</CardTitle>
            <Award className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getGPAColor(parseFloat(avgGPA))}`}>{avgGPA}</div>
            <p className="text-xs text-muted-foreground">Overall average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getCompletionColor(avgCompletionRate)}`}>{avgCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">Course completion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Improving</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{improvingStudents}</div>
            <p className="text-xs text-muted-foreground">GPA trending up</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Declining</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{decliningStudents}</div>
            <p className="text-xs text-muted-foreground">GPA trending down</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement Metrics</TabsTrigger>
          <TabsTrigger value="students">Student Details</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* GPA Trend and Distribution */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>GPA Progression Over Time</CardTitle>
                <CardDescription>Track grade progression to identify trends</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={gpaOverTime}>
                    <defs>
                      <linearGradient id="colorGPA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semester" />
                    <YAxis domain={[0, 4.0]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="avgGPA" stroke="#3b82f6" fillOpacity={1} fill="url(#colorGPA)" name="Average GPA" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <p className="text-sm text-orange-800">
                    <strong>Trend Alert:</strong> Overall GPA showing gradual decline. Immediate intervention recommended.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>GPA Distribution</CardTitle>
                <CardDescription>Student distribution across GPA ranges</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={gpaDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" name="Students">
                      {gpaDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics Radar */}
          <Card>
            <CardHeader>
              <CardTitle>Overall Performance Metrics</CardTitle>
              <CardDescription>Comprehensive view of academic performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={performanceMetrics}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="Performance" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Metrics Tab */}
        <TabsContent value="engagement" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>LMS Activity & Engagement Patterns</CardTitle>
              <CardDescription>Monitor student engagement including LMS activity, participation, and support services</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={engagementMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="activity" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avg" fill="#10b981" name="Average per Student" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Engagement Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Student Engagement Details</CardTitle>
              <CardDescription>Detailed LMS activity and academic participation metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Student</th>
                        <th className="p-3 text-center font-medium">LMS Logins</th>
                        <th className="p-3 text-center font-medium">Assignments</th>
                        <th className="p-3 text-center font-medium">Forum Posts</th>
                        <th className="p-3 text-center font-medium">Support Services</th>
                        <th className="p-3 text-center font-medium">Last Activity</th>
                        <th className="p-3 text-center font-medium">Engagement Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3">
                            <div className="font-medium">{student.name}</div>
                            <div className="text-xs text-muted-foreground">{student.id}</div>
                          </td>
                          <td className="p-3 text-center">{student.engagement.lmsLogins}</td>
                          <td className="p-3 text-center">{student.engagement.assignmentSubmissions}</td>
                          <td className="p-3 text-center">{student.engagement.forumParticipation}</td>
                          <td className="p-3 text-center">{student.engagement.supportServiceInteractions}</td>
                          <td className="p-3 text-center text-sm">{student.engagement.lastActivity}</td>
                          <td className="p-3 text-center">
                            <Badge className={student.engagementScore >= 70 ? 'bg-green-500' : student.engagementScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'}>
                              {student.engagementScore}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Student Details Tab */}
        <TabsContent value="students" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Academic Performance</CardTitle>
              <CardDescription>Comprehensive view of grades, GPA, and completion rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  
                  <Select value={filterProgram} onValueChange={setFilterProgram}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by program" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {allPrograms.map(program => (
                        <SelectItem key={program} value={program}>
                          {program}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterRiskLevel} onValueChange={setFilterRiskLevel}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk Levels</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>

                {/* Student Performance Table */}
                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left font-medium">Student</th>
                          <th className="p-3 text-center font-medium">Current GPA</th>
                          <th className="p-3 text-center font-medium">GPA Trend</th>
                          <th className="p-3 text-center font-medium">Completion Rate</th>
                          <th className="p-3 text-center font-medium">Courses</th>
                          <th className="p-3 text-center font-medium">Attendance</th>
                          <th className="p-3 text-center font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={student.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-3">
                              <div className="font-medium">{student.name}</div>
                              <div className="text-xs text-muted-foreground">{student.program}</div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`text-lg font-bold ${getGPAColor(student.gpa)}`}>
                                {student.gpa.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center items-center gap-2">
                                {getTrendIcon(student.gpaTrend)}
                                {getTrendBadge(student.gpaTrend)}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`font-bold ${getCompletionColor(student.completionRate)}`}>
                                {student.completionRate}%
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedStudent(student.id)}
                              >
                                {student.grades.length} courses
                              </Button>
                            </td>
                            <td className="p-3 text-center">
                              <span className="font-semibold">{student.avgAttendance}%</span>
                            </td>
                            <td className="p-3 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/advisor/student/${student.id}`)}
                              >
                                View Profile
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Student Detail View */}
          {selectedStudentData && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{selectedStudentData.name} - Grade History</CardTitle>
                    <CardDescription>Detailed grade progression and course performance</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 mb-6">
                  <div className="p-4 bg-white rounded-lg border">
                    <div className="text-sm text-muted-foreground">Fall 2024 GPA</div>
                    <div className={`text-2xl font-bold ${getGPAColor(selectedStudentData.fall2024GPA)}`}>
                      {selectedStudentData.fall2024GPA.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border">
                    <div className="text-sm text-muted-foreground">Spring 2025 GPA</div>
                    <div className={`text-2xl font-bold ${getGPAColor(selectedStudentData.spring2025GPA)}`}>
                      {selectedStudentData.spring2025GPA.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left font-medium">Course</th>
                          <th className="p-3 text-center font-medium">Semester</th>
                          <th className="p-3 text-center font-medium">Grade</th>
                          <th className="p-3 text-center font-medium">Points</th>
                          <th className="p-3 text-center font-medium">Credits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudentData.grades.map((grade, idx) => (
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
          )}
        </TabsContent>

        {/* Risk Analysis Tab */}
        <TabsContent value="risk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Risk Factor Analysis</CardTitle>
              <CardDescription>Detailed breakdown of individual risk factors and their weighted contribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {filteredStudents
                  .filter(s => s.riskFactors.length > 0)
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .map((student) => (
                    <div key={student.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{student.name}</h3>
                          <p className="text-sm text-muted-foreground">{student.id} • {student.program}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Overall Risk Score</div>
                          <div className="text-2xl font-bold text-red-600">{student.riskScore}</div>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {student.riskFactors.map((factor, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{factor.category}</span>
                                <Badge variant="outline" className="text-xs">
                                  Weight: {factor.weight}%
                                </Badge>
                              </div>
                              <span className="text-sm text-muted-foreground">{factor.description}</span>
                            </div>
                            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`absolute top-0 left-0 h-full rounded-full ${
                                  factor.value >= 70 ? 'bg-green-500' :
                                  factor.value >= 50 ? 'bg-yellow-500' :
                                  factor.value >= 30 ? 'bg-orange-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${factor.value}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Current: {factor.value}%</span>
                              <span>Contribution: {((factor.value / 100) * factor.weight).toFixed(1)} pts</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/advisor/student/${student.id}`)}
                          className="w-full"
                        >
                          View Full Profile & Interventions
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
