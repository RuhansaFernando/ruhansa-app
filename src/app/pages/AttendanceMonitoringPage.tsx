import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { Calendar, TrendingDown, TrendingUp, AlertTriangle, Search, Download, Activity, AlertCircle, BarChart3 } from 'lucide-react';
import { mockStudents, mockAttendance } from '../mockData';
import { useNavigate } from 'react-router';

export default function AttendanceMonitoringPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterRiskLevel, setFilterRiskLevel] = useState('all');

  // Prepare attendance data for all students with enhanced analytics
  const studentsWithAttendance = mockStudents.map(student => {
    const attendanceRecords = mockAttendance[student.id] || [];
    const avgAttendance = attendanceRecords.length > 0
      ? attendanceRecords.reduce((sum, record) => sum + record.percentage, 0) / attendanceRecords.length
      : 0;
    
    // Calculate attendance pattern (declining, stable, improving)
    let attendancePattern = 'stable';
    if (attendanceRecords.length >= 2) {
      const firstHalf = attendanceRecords.slice(0, Math.ceil(attendanceRecords.length / 2));
      const secondHalf = attendanceRecords.slice(Math.ceil(attendanceRecords.length / 2));
      const firstAvg = firstHalf.reduce((sum, r) => sum + r.percentage, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, r) => sum + r.percentage, 0) / secondHalf.length;
      
      if (secondAvg < firstAvg - 5) attendancePattern = 'declining';
      else if (secondAvg > firstAvg + 5) attendancePattern = 'improving';
    }

    // Calculate risk prediction score based on attendance and GPA correlation
    const attendanceRiskScore = avgAttendance < 60 ? 0.8 : avgAttendance < 75 ? 0.5 : 0.2;
    const gpaRiskScore = student.gpa < 2.0 ? 0.8 : student.gpa < 2.5 ? 0.5 : 0.2;
    const patternRiskScore = attendancePattern === 'declining' ? 0.7 : 0.2;
    
    const predictedRisk = (attendanceRiskScore * 0.4 + gpaRiskScore * 0.4 + patternRiskScore * 0.2);
    
    // Determine if early warning is needed
    const earlyWarning = predictedRisk >= 0.6 || (avgAttendance < 75 && student.gpa < 2.5) || attendancePattern === 'declining';

    return {
      ...student,
      attendanceRecords,
      avgAttendance: Math.round(avgAttendance),
      attendancePattern,
      predictedRisk: Math.round(predictedRisk * 100),
      earlyWarning,
    };
  });

  // Filter students
  const filteredStudents = studentsWithAttendance.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = filterRiskLevel === 'all' || student.riskLevel === filterRiskLevel;
    const matchesCourse = filterCourse === 'all' || 
                         student.attendanceRecords.some(record => record.courseId === filterCourse);
    return matchesSearch && matchesRisk && matchesCourse;
  });

  // Get all unique courses
  const allCourses = Array.from(
    new Set(
      Object.values(mockAttendance)
        .flat()
        .map(record => `${record.courseId}|${record.courseName}`)
    )
  ).map(course => {
    const [id, name] = course.split('|');
    return { id, name };
  });

  // Calculate statistics
  const totalStudents = filteredStudents.length;
  const criticalAttendance = filteredStudents.filter(s => s.avgAttendance < 60).length;
  const lowAttendance = filteredStudents.filter(s => s.avgAttendance >= 60 && s.avgAttendance < 75).length;
  const goodAttendance = filteredStudents.filter(s => s.avgAttendance >= 75).length;
  const earlyWarningCount = filteredStudents.filter(s => s.earlyWarning).length;

  // Attendance-GPA Correlation Data
  const correlationData = studentsWithAttendance
    .filter(s => s.attendanceRecords.length > 0)
    .map(student => ({
      attendance: student.avgAttendance,
      gpa: student.gpa,
      name: student.name,
      risk: student.riskLevel,
    }));

  // Calculate correlation coefficient
  const calculateCorrelation = () => {
    if (correlationData.length < 2) return 0;
    
    const n = correlationData.length;
    const sumX = correlationData.reduce((sum, d) => sum + d.attendance, 0);
    const sumY = correlationData.reduce((sum, d) => sum + d.gpa, 0);
    const sumXY = correlationData.reduce((sum, d) => sum + d.attendance * d.gpa, 0);
    const sumX2 = correlationData.reduce((sum, d) => sum + d.attendance * d.attendance, 0);
    const sumY2 = correlationData.reduce((sum, d) => sum + d.gpa * d.gpa, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  };

  const correlationCoefficient = calculateCorrelation();

  // Early Warning Students
  const earlyWarningStudents = filteredStudents
    .filter(s => s.earlyWarning)
    .sort((a, b) => b.predictedRisk - a.predictedRisk)
    .slice(0, 10);

  // Attendance distribution data
  const attendanceDistribution = [
    { name: 'Critical (<60%)', value: criticalAttendance, color: '#ef4444' },
    { name: 'Low (60-74%)', value: lowAttendance, color: '#f59e0b' },
    { name: 'Good (75-89%)', value: goodAttendance, color: '#10b981' },
    { name: 'Excellent (90%+)', value: filteredStudents.filter(s => s.avgAttendance >= 90).length, color: '#3b82f6' },
  ];

  // Course-wise attendance data
  const courseAttendanceData = allCourses.map(course => {
    const courseRecords = Object.values(mockAttendance)
      .flat()
      .filter(record => record.courseId === course.id);
    
    const avgAttendance = courseRecords.length > 0
      ? courseRecords.reduce((sum, record) => sum + record.percentage, 0) / courseRecords.length
      : 0;

    return {
      course: course.name,
      attendance: Math.round(avgAttendance),
      students: courseRecords.length,
    };
  });

  // Trend data (mock weekly data showing decline)
  const trendData = [
    { week: 'Week 1', attendance: 82, avgGPA: 2.8 },
    { week: 'Week 2', attendance: 80, avgGPA: 2.75 },
    { week: 'Week 3', attendance: 78, avgGPA: 2.7 },
    { week: 'Week 4', attendance: 75, avgGPA: 2.65 },
    { week: 'Week 5', attendance: 73, avgGPA: 2.6 },
    { week: 'Week 6', attendance: 71, avgGPA: 2.55 },
    { week: 'Week 7', attendance: 70, avgGPA: 2.5 },
    { week: 'Week 8', attendance: 69, avgGPA: 2.45 },
  ];

  // Pattern analysis data
  const patternData = [
    { pattern: 'Declining', count: studentsWithAttendance.filter(s => s.attendancePattern === 'declining').length, color: '#ef4444' },
    { pattern: 'Stable', count: studentsWithAttendance.filter(s => s.attendancePattern === 'stable').length, color: '#f59e0b' },
    { pattern: 'Improving', count: studentsWithAttendance.filter(s => s.attendancePattern === 'improving').length, color: '#10b981' },
  ];

  const getAttendanceBadge = (percentage: number) => {
    if (percentage >= 90) return <Badge className="bg-blue-500">Excellent</Badge>;
    if (percentage >= 75) return <Badge className="bg-green-500">Good</Badge>;
    if (percentage >= 60) return <Badge className="bg-yellow-500">Low</Badge>;
    return <Badge className="bg-red-500">Critical</Badge>;
  };

  const getPatternBadge = (pattern: string) => {
    if (pattern === 'improving') return <Badge className="bg-green-500">Improving</Badge>;
    if (pattern === 'declining') return <Badge className="bg-red-500">Declining</Badge>;
    return <Badge className="bg-gray-500">Stable</Badge>;
  };

  const getTrendIcon = (pattern: string) => {
    if (pattern === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (pattern === 'declining') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-400" />;
  };

  const getRiskBadge = (risk: number) => {
    if (risk >= 70) return <Badge className="bg-red-500">High Risk</Badge>;
    if (risk >= 50) return <Badge className="bg-yellow-500">Medium Risk</Badge>;
    return <Badge className="bg-green-500">Low Risk</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Attendance Pattern Analysis</h1>
        <p className="text-muted-foreground">
          Analyze attendance patterns and correlate with academic performance to identify early warning signs
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">Monitored students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Early Warnings</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{earlyWarningCount}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAttendance}</div>
            <p className="text-xs text-muted-foreground">Below 60% attendance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Correlation</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{(correlationCoefficient * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Attendance-GPA link</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Good Attendance</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{goodAttendance}</div>
            <p className="text-xs text-muted-foreground">75%+ attendance</p>
          </CardContent>
        </Card>
      </div>

      {/* Correlation Analysis Section */}
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <CardTitle>Performance Correlation Analysis</CardTitle>
          </div>
          <CardDescription>
            Strong correlation detected: Students with attendance below 75% show {correlationCoefficient > 0.6 ? 'significantly' : 'moderately'} lower GPAs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Scatter Plot */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Attendance vs GPA Correlation</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    dataKey="attendance" 
                    name="Attendance %" 
                    domain={[0, 100]}
                    label={{ value: 'Attendance %', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="gpa" 
                    name="GPA" 
                    domain={[0, 4.0]}
                    label={{ value: 'GPA', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter 
                    name="Students" 
                    data={correlationData} 
                    fill="#3b82f6"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Attendance Patterns */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Attendance Patterns</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={patternData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ pattern, count }) => `${pattern}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {patternData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    Declining Pattern
                  </span>
                  <span className="font-semibold">{patternData.find(p => p.pattern === 'Declining')?.count || 0} students</span>
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  These students show decreasing attendance over time and require immediate intervention
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Early Warning System */}
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle>Early Warning System</CardTitle>
            </div>
            <Badge className="bg-red-600">{earlyWarningCount} Alerts</Badge>
          </div>
          <CardDescription>
            Students identified as at-risk based on attendance patterns and academic performance correlation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Student</th>
                    <th className="p-3 text-center font-medium">Attendance</th>
                    <th className="p-3 text-center font-medium">GPA</th>
                    <th className="p-3 text-center font-medium">Pattern</th>
                    <th className="p-3 text-center font-medium">Risk Score</th>
                    <th className="p-3 text-left font-medium">Warning Indicators</th>
                    <th className="p-3 text-center font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {earlyWarningStudents.map((student) => {
                    const warnings = [];
                    if (student.avgAttendance < 60) warnings.push('Critical attendance');
                    if (student.avgAttendance < 75 && student.gpa < 2.5) warnings.push('Low attendance + Low GPA');
                    if (student.attendancePattern === 'declining') warnings.push('Declining pattern');
                    if (student.gpa < 2.0) warnings.push('Critical GPA');
                    
                    return (
                      <tr key={student.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <div className="font-medium">{student.name}</div>
                          <div className="text-xs text-muted-foreground">{student.id}</div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold">{student.avgAttendance}%</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold">{student.gpa.toFixed(2)}</span>
                        </td>
                        <td className="p-3 text-center">
                          {getPatternBadge(student.attendancePattern)}
                        </td>
                        <td className="p-3 text-center">
                          {getRiskBadge(student.predictedRisk)}
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {warnings.map((warning, idx) => (
                              <div key={idx} className="text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {warning}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => navigate(`/advisor/student/${student.id}`)}
                          >
                            Intervene
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {earlyWarningStudents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No early warnings at this time
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trend Analysis */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Attendance and GPA Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance & GPA Trend Correlation</CardTitle>
            <CardDescription>Observe how attendance decline affects GPA over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis yAxisId="left" domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 4]} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="attendance" stroke="#3b82f6" strokeWidth={2} name="Attendance %" />
                <Line yAxisId="right" type="monotone" dataKey="avgGPA" stroke="#10b981" strokeWidth={2} name="Avg GPA" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attendance Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Distribution</CardTitle>
            <CardDescription>Student attendance by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={attendanceDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {attendanceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Course-wise Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Course-wise Attendance Analysis</CardTitle>
          <CardDescription>Identify courses with low attendance rates</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={courseAttendanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="course" angle={-45} textAnchor="end" height={120} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="attendance" fill="#3b82f6" name="Attendance %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* All Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Student Attendance Records</CardTitle>
          <CardDescription>Comprehensive view with pattern analysis</CardDescription>
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
              
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {allCourses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
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

            {/* Student List */}
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Student</th>
                      <th className="p-3 text-center font-medium">Attendance</th>
                      <th className="p-3 text-center font-medium">GPA</th>
                      <th className="p-3 text-center font-medium">Pattern</th>
                      <th className="p-3 text-center font-medium">Status</th>
                      <th className="p-3 text-center font-medium">Warning</th>
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
                          <span className="font-bold text-lg">{student.avgAttendance}%</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold">{student.gpa.toFixed(2)}</span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center items-center gap-2">
                            {getTrendIcon(student.attendancePattern)}
                            {getPatternBadge(student.attendancePattern)}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {getAttendanceBadge(student.avgAttendance)}
                        </td>
                        <td className="p-3 text-center">
                          {student.earlyWarning && (
                            <AlertCircle className="h-5 w-5 text-orange-500 mx-auto" />
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/advisor/student/${student.id}`)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredStudents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No students found matching your filters
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
