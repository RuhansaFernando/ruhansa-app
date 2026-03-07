import { useState } from 'react';
import { mockStudents, mockInterventions } from '../mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, Download, Calendar } from 'lucide-react';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('risk-summary');
  const [timeframe, setTimeframe] = useState('semester');

  // Calculate report data
  const riskDistribution = [
    { name: 'Critical', value: mockStudents.filter((s) => s.riskLevel === 'critical').length, color: '#dc2626' },
    { name: 'High', value: mockStudents.filter((s) => s.riskLevel === 'high').length, color: '#ea580c' },
    { name: 'Medium', value: mockStudents.filter((s) => s.riskLevel === 'medium').length, color: '#eab308' },
    { name: 'Low', value: mockStudents.filter((s) => s.riskLevel === 'low').length, color: '#16a34a' },
  ].filter((item) => item.value > 0);

  const programDistribution = mockStudents.reduce((acc: any[], student) => {
    const existing = acc.find((item) => item.program === student.program);
    if (existing) {
      existing.count++;
      existing.avgGPA = (existing.avgGPA * (existing.count - 1) + student.gpa) / existing.count;
    } else {
      acc.push({ program: student.program, count: 1, avgGPA: student.gpa });
    }
    return acc;
  }, []);

  const interventionStats = {
    total: mockInterventions.length,
    pending: mockInterventions.filter((i) => i.status === 'pending').length,
    inProgress: mockInterventions.filter((i) => i.status === 'in-progress').length,
    completed: mockInterventions.filter((i) => i.status === 'completed').length,
    cancelled: mockInterventions.filter((i) => i.status === 'cancelled').length,
  };

  const interventionData = [
    { status: 'Pending', count: interventionStats.pending },
    { status: 'In Progress', count: interventionStats.inProgress },
    { status: 'Completed', count: interventionStats.completed },
    { status: 'Cancelled', count: interventionStats.cancelled },
  ];

  const retentionData = [
    { year: 'Year 1', rate: 92 },
    { year: 'Year 2', rate: 88 },
    { year: 'Year 3', rate: 85 },
    { year: 'Year 4', rate: 82 },
  ];

  const handleExportReport = () => {
    let csvContent = '';
    let filename = '';
    const timestamp = new Date().toISOString().split('T')[0];

    if (reportType === 'risk-summary') {
      filename = `risk-summary-${timeframe}-${timestamp}.csv`;
      csvContent = 'Risk Level,Student Count,Percentage\n';
      const total = mockStudents.length;
      riskDistribution.forEach((item) => {
        const percentage = ((item.value / total) * 100).toFixed(1);
        csvContent += `${item.name},${item.value},${percentage}%\n`;
      });
      csvContent += '\n\nStudents by Program\n';
      csvContent += 'Program,Student Count,Average GPA\n';
      programDistribution.forEach((item) => {
        csvContent += `${item.program},${item.count},${item.avgGPA.toFixed(2)}\n`;
      });
    } else if (reportType === 'intervention') {
      filename = `intervention-effectiveness-${timeframe}-${timestamp}.csv`;
      csvContent = 'Status,Count\n';
      interventionData.forEach((item) => {
        csvContent += `${item.status},${item.count}\n`;
      });
      csvContent += `\nTotal Interventions,${interventionStats.total}\n`;
      csvContent += `Completion Rate,${Math.round((interventionStats.completed / interventionStats.total) * 100)}%\n`;
    } else if (reportType === 'retention') {
      filename = `retention-analysis-${timeframe}-${timestamp}.csv`;
      csvContent = 'Academic Year,Retention Rate\n';
      retentionData.forEach((item) => {
        csvContent += `${item.year},${item.rate}%\n`;
      });
    } else if (reportType === 'performance') {
      filename = `academic-performance-${timeframe}-${timestamp}.csv`;
      const avgGPA = (mockStudents.reduce((sum, s) => sum + s.gpa, 0) / mockStudents.length).toFixed(2);
      const above3 = mockStudents.filter((s) => s.gpa >= 3.0).length;
      const below25 = mockStudents.filter((s) => s.gpa < 2.5).length;
      const below2 = mockStudents.filter((s) => s.gpa < 2.0).length;
      csvContent = 'Metric,Value\n';
      csvContent += `Average GPA,${avgGPA}\n`;
      csvContent += `Students with GPA >= 3.0,${above3}\n`;
      csvContent += `Students with GPA < 2.5,${below25}\n`;
      csvContent += `Students with GPA < 2.0,${below2}\n`;
    } else if (reportType === 'attendance') {
      filename = `attendance-report-${timeframe}-${timestamp}.csv`;
      csvContent = 'Metric,Value\n';
      csvContent += 'Average Attendance,85%\n';
      csvContent += 'Above 80%,67%\n';
      csvContent += 'Below 80%,33%\n';
    }

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground">Generate comprehensive reports on student performance and interventions</p>
      </div>

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
          <CardDescription>Select report type and parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="report-type">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="report-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="risk-summary">Risk Assessment Summary</SelectItem>
                  <SelectItem value="intervention">Intervention Effectiveness</SelectItem>
                  <SelectItem value="retention">Retention Analysis</SelectItem>
                  <SelectItem value="performance">Academic Performance</SelectItem>
                  <SelectItem value="attendance">Attendance Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger id="timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="semester">This Semester</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleExportReport} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment Summary */}
      {reportType === 'risk-summary' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Risk Level Distribution</CardTitle>
              <CardDescription>Current student risk assessment breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Students by Program</CardTitle>
              <CardDescription>Student count and average GPA by program</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={programDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="program" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#3b82f6" name="Students" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Intervention Effectiveness */}
      {reportType === 'intervention' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Intervention Status</CardTitle>
              <CardDescription>Current status of all interventions</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={interventionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Intervention Summary</CardTitle>
              <CardDescription>Key metrics for intervention effectiveness</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="text-muted-foreground">Total Interventions</span>
                  <span className="text-2xl font-bold">{interventionStats.total}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="text-muted-foreground">Completion Rate</span>
                  <span className="text-2xl font-bold text-green-600">
                    {Math.round((interventionStats.completed / interventionStats.total) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="text-muted-foreground">Currently Active</span>
                  <span className="text-2xl font-bold text-blue-600">{interventionStats.inProgress}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pending Assignment</span>
                  <span className="text-2xl font-bold text-orange-600">{interventionStats.pending}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Retention Analysis */}
      {reportType === 'retention' && (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Retention Rates</CardTitle>
              <CardDescription>Retention rates by academic year</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={retentionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} name="Retention Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retention Insights</CardTitle>
              <CardDescription>Key findings and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium">Strong First-Year Retention</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    92% retention rate for first-year students indicates effective onboarding and early support systems.
                  </p>
                </div>
                <div className="border-l-4 border-yellow-500 pl-4">
                  <h4 className="font-medium">Gradual Decline Over Years</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    10-point decline from Year 1 to Year 4 suggests need for enhanced support in later academic years.
                  </p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium">Recommendation</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Increase mentorship programs and career counseling for junior and senior students to improve retention.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Report */}
      {reportType === 'performance' && (
        <Card>
          <CardHeader>
            <CardTitle>Academic Performance Summary</CardTitle>
            <CardDescription>Overall student performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {(mockStudents.reduce((sum, s) => sum + s.gpa, 0) / mockStudents.length).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Average GPA</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {mockStudents.filter((s) => s.gpa >= 3.0).length}
                </div>
                <div className="text-sm text-muted-foreground mt-1">GPA ≥ 3.0</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {mockStudents.filter((s) => s.gpa < 2.5).length}
                </div>
                <div className="text-sm text-muted-foreground mt-1">GPA &lt; 2.5</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600">
                  {mockStudents.filter((s) => s.gpa < 2.0).length}
                </div>
                <div className="text-sm text-muted-foreground mt-1">GPA &lt; 2.0</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Report */}
      {reportType === 'attendance' && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance Analysis</CardTitle>
            <CardDescription>Student attendance patterns and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">85%</div>
                  <div className="text-sm text-muted-foreground mt-1">Average Attendance</div>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">67%</div>
                  <div className="text-sm text-muted-foreground mt-1">Above 80%</div>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">33%</div>
                  <div className="text-sm text-muted-foreground mt-1">Below 80%</div>
                </div>
              </div>
              <div className="border-l-4 border-orange-500 pl-4 mt-4">
                <h4 className="font-medium">Attendance Correlation</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Strong correlation observed between attendance rates and academic performance. Students with attendance
                  below 75% are 3x more likely to be classified as high or critical risk.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Generated Reports</CardTitle>
          <CardDescription>Access previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { title: 'Risk Assessment Summary - February 2026', date: '2026-02-23', type: 'PDF' },
              { title: 'Intervention Effectiveness Q1 2026', date: '2026-02-20', type: 'Excel' },
              { title: 'Student Performance Report - Spring Semester', date: '2026-02-18', type: 'PDF' },
              { title: 'Attendance Analysis - Week 6', date: '2026-02-15', type: 'PDF' },
            ].map((report, index) => (
              <div key={index} className="flex items-center justify-between border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium">{report.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      <Calendar className="inline h-3 w-3 mr-1" />
                      Generated on {report.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{report.type}</Badge>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}