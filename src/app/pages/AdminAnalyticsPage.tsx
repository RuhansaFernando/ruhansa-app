import { mockStudents, mockAlerts } from '../mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, AlertTriangle, GraduationCap, Activity } from 'lucide-react';

export default function AdminAnalyticsPage() {
  // Risk distribution
  const riskDistribution = [
    { name: 'Critical', value: mockStudents.filter((s) => s.riskLevel === 'critical').length, color: '#dc2626' },
    { name: 'High', value: mockStudents.filter((s) => s.riskLevel === 'high').length, color: '#ea580c' },
    { name: 'Medium', value: mockStudents.filter((s) => s.riskLevel === 'medium').length, color: '#eab308' },
    { name: 'Low', value: mockStudents.filter((s) => s.riskLevel === 'low').length, color: '#16a34a' },
  ];

  // Enrollment trends
  const enrollmentTrends = [
    { month: 'Jan', students: 1200, newEnrollments: 45, dropouts: 8 },
    { month: 'Feb', students: 1237, newEnrollments: 52, dropouts: 15 },
    { month: 'Mar', students: 1274, newEnrollments: 48, dropouts: 11 },
    { month: 'Apr', students: 1311, newEnrollments: 55, dropouts: 18 },
    { month: 'May', students: 1348, newEnrollments: 60, dropouts: 23 },
    { month: 'Jun', students: 1385, newEnrollments: 65, dropouts: 28 },
  ];

  // GPA trends
  const gpaTrends = [
    { semester: 'Fall 2024', avgGPA: 2.8, critical: 45, high: 120 },
    { semester: 'Spring 2025', avgGPA: 2.9, critical: 38, high: 105 },
    { semester: 'Summer 2025', avgGPA: 3.0, critical: 32, high: 95 },
    { semester: 'Fall 2025', avgGPA: 3.1, critical: 28, high: 85 },
  ];

  // Department performance
  const departmentData = [
    { department: 'Computer Science', avgGPA: 3.2, students: 320, atRisk: 45 },
    { department: 'Business Admin', avgGPA: 3.0, students: 280, atRisk: 52 },
    { department: 'Engineering', avgGPA: 2.9, students: 260, atRisk: 58 },
    { department: 'Mathematics', avgGPA: 3.1, students: 180, atRisk: 32 },
    { department: 'Biology', avgGPA: 3.3, students: 220, atRisk: 28 },
  ];

  // Alert trends
  const alertTrends = [
    { week: 'Week 1', critical: 5, high: 12, medium: 18 },
    { week: 'Week 2', critical: 8, high: 15, medium: 22 },
    { week: 'Week 3', critical: 6, high: 18, medium: 25 },
    { week: 'Week 4', critical: 10, high: 20, medium: 28 },
    { week: 'Week 5', critical: 7, high: 16, medium: 24 },
    { week: 'Week 6', critical: 9, high: 19, medium: 30 },
  ];

  // Intervention effectiveness
  const interventionData = [
    { type: 'Academic Advising', success: 85, total: 120 },
    { type: 'Tutoring', success: 92, total: 150 },
    { type: 'Counseling', success: 78, total: 95 },
    { type: 'Financial Aid', success: 88, total: 80 },
    { type: 'Mentoring', success: 82, total: 110 },
  ];

  const totalStudents = mockStudents.length;
  const criticalStudents = mockStudents.filter((s) => s.riskLevel === 'critical').length;
  const avgGPA = (mockStudents.reduce((sum, s) => sum + s.gpa, 0) / totalStudents).toFixed(2);
  const totalAlerts = mockAlerts.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive insights and performance metrics across the institution
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Students</CardDescription>
            <CardTitle className="text-3xl">{totalStudents}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span>+12% from last semester</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Critical Risk</CardDescription>
            <CardTitle className="text-3xl text-red-600">{criticalStudents}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-green-600">
              <TrendingDown className="h-4 w-4" />
              <span>-8% from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Average GPA</CardDescription>
            <CardTitle className="text-3xl">{avgGPA}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span>+0.2 from last semester</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Alerts</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{totalAlerts}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Student Risk Distribution</CardTitle>
            <CardDescription>Current breakdown by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={100}
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

        {/* Enrollment Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Trends</CardTitle>
            <CardDescription>Student population growth over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={enrollmentTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="students"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                  name="Total Students"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* GPA Trends */}
        <Card>
          <CardHeader>
            <CardTitle>GPA & Risk Trends</CardTitle>
            <CardDescription>Academic performance over semesters</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gpaTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="semester" />
                <YAxis yAxisId="left" domain={[0, 4]} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgGPA"
                  stroke="#16a34a"
                  strokeWidth={3}
                  name="Avg GPA"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="critical"
                  stroke="#dc2626"
                  strokeWidth={2}
                  name="Critical"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="high"
                  stroke="#ea580c"
                  strokeWidth={2}
                  name="High Risk"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Alert Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Trends</CardTitle>
            <CardDescription>Weekly alert volume by severity</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={alertTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="critical"
                  stackId="1"
                  stroke="#dc2626"
                  fill="#dc2626"
                  name="Critical"
                />
                <Area
                  type="monotone"
                  dataKey="high"
                  stackId="1"
                  stroke="#ea580c"
                  fill="#ea580c"
                  name="High"
                />
                <Area
                  type="monotone"
                  dataKey="medium"
                  stackId="1"
                  stroke="#eab308"
                  fill="#eab308"
                  name="Medium"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Performance */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
            <CardDescription>Comparative analysis across departments</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="students" fill="#3b82f6" name="Total Students" />
                <Bar yAxisId="left" dataKey="atRisk" fill="#dc2626" name="At Risk" />
                <Bar yAxisId="right" dataKey="avgGPA" fill="#16a34a" name="Avg GPA" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
