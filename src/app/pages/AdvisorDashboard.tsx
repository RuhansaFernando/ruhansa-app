import { useState } from 'react';
import { Link } from 'react-router';
import { mockStudents, mockAlerts } from '../mockData';
import { Student, RiskLevel } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingDown, TrendingUp, Users, Search, Filter, FileText, Calendar, Bell } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

const COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#eab308',
  low: '#16a34a',
};

export default function AdvisorDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterProgram, setFilterProgram] = useState<string>('all');

  // Filter students by advisor (hardcoded for demo)
  const advisorStudents = mockStudents.filter((s) => s.advisorId === 'adv1');

  // Apply filters
  const filteredStudents = advisorStudents.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = filterRisk === 'all' || student.riskLevel === filterRisk;
    const matchesProgram = filterProgram === 'all' || student.program === filterProgram;
    return matchesSearch && matchesRisk && matchesProgram;
  });

  // Calculate statistics
  const totalStudents = advisorStudents.length;
  const criticalCount = advisorStudents.filter((s) => s.riskLevel === 'critical').length;
  const highCount = advisorStudents.filter((s) => s.riskLevel === 'high').length;
  const mediumCount = advisorStudents.filter((s) => s.riskLevel === 'medium').length;
  const lowCount = advisorStudents.filter((s) => s.riskLevel === 'low').length;

  // Risk distribution data for pie chart
  const riskDistribution = [
    { name: 'Critical', value: criticalCount, color: COLORS.critical },
    { name: 'High', value: highCount, color: COLORS.high },
    { name: 'Medium', value: mediumCount, color: COLORS.medium },
    { name: 'Low', value: lowCount, color: COLORS.low },
  ].filter((item) => item.value > 0);

  // GPA distribution data
  const gpaDistribution = [
    { range: '< 2.0', count: advisorStudents.filter((s) => s.gpa < 2.0).length },
    { range: '2.0-2.5', count: advisorStudents.filter((s) => s.gpa >= 2.0 && s.gpa < 2.5).length },
    { range: '2.5-3.0', count: advisorStudents.filter((s) => s.gpa >= 2.5 && s.gpa < 3.0).length },
    { range: '3.0-3.5', count: advisorStudents.filter((s) => s.gpa >= 3.0 && s.gpa < 3.5).length },
    { range: '> 3.5', count: advisorStudents.filter((s) => s.gpa >= 3.5).length },
  ];

  // Get unacknowledged alerts
  const unacknowledgedAlerts = mockAlerts.filter((alert) => !alert.acknowledged);

  const getRiskBadgeVariant = (risk: RiskLevel) => {
    switch (risk) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
    }
  };

  const programs = [...new Set(advisorStudents.map((s) => s.program))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Academic Advisor Dashboard</h1>
        <p className="text-muted-foreground">Monitor and support at-risk students</p>
      </div>

      {/* Alerts Section */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="space-y-3">
          {unacknowledgedAlerts.slice(0, 2).map((alert) => (
            <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
              <Bell className="h-4 w-4" />
              <AlertTitle>{alert.type}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">Under your advisement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-muted-foreground">Immediate attention required</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{highCount}</div>
            <p className="text-xs text-muted-foreground">Monitor closely</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Risk</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{mediumCount}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Risk</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{lowCount}</div>
            <p className="text-xs text-muted-foreground">On track</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Risk Level Distribution</CardTitle>
            <CardDescription>Current risk assessment breakdown</CardDescription>
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
            <CardTitle>GPA Distribution</CardTitle>
            <CardDescription>Student performance by GPA range</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gpaDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/advisor/reports">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Generate Reports
          </Button>
        </Link>
        <Link to="/advisor/appointments">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            View Appointments
          </Button>
        </Link>
      </div>

      {/* Student List */}
      <Card>
        <CardHeader>
          <CardTitle>At-Risk Students</CardTitle>
          <CardDescription>Filter and search students by risk level and program</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterProgram} onValueChange={setFilterProgram}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {programs.map((program) => (
                  <SelectItem key={program} value={program}>
                    {program}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Student</th>
                  <th className="text-left py-3 px-4">Program</th>
                  <th className="text-left py-3 px-4">Year</th>
                  <th className="text-left py-3 px-4">GPA</th>
                  <th className="text-left py-3 px-4">Risk Level</th>
                  <th className="text-left py-3 px-4">Risk Score</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium">{student.name}</div>
                        <div className="text-sm text-muted-foreground">{student.email}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{student.program}</td>
                    <td className="py-3 px-4">Year {student.year}</td>
                    <td className="py-3 px-4">
                      <span className={student.gpa < 2.5 ? 'text-red-600 font-medium' : ''}>
                        {student.gpa.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={getRiskBadgeVariant(student.riskLevel)}>
                        {student.riskLevel.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${student.riskScore}%`,
                              backgroundColor: COLORS[student.riskLevel],
                            }}
                          />
                        </div>
                        <span className="text-sm">{student.riskScore}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/advisor/student/${student.id}`}>
                        <Button size="sm" variant="outline">
                          View Profile
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No students found matching the filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}