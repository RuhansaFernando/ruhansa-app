import { mockStudents } from '../mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';

export default function CounselorAnalyticsPage() {
  // Risk distribution
  const riskDistribution = [
    { name: 'Critical', value: mockStudents.filter((s) => s.riskLevel === 'critical').length, color: '#dc2626' },
    { name: 'High', value: mockStudents.filter((s) => s.riskLevel === 'high').length, color: '#ea580c' },
    { name: 'Medium', value: mockStudents.filter((s) => s.riskLevel === 'medium').length, color: '#eab308' },
    { name: 'Low', value: mockStudents.filter((s) => s.riskLevel === 'low').length, color: '#16a34a' },
  ];

  // Intervention effectiveness
  const interventionData = [
    { month: 'Jan', success: 12, ongoing: 8, failed: 2 },
    { month: 'Feb', success: 15, ongoing: 10, failed: 1 },
    { month: 'Mar', success: 18, ongoing: 7, failed: 3 },
    { month: 'Apr', success: 20, ongoing: 12, failed: 2 },
    { month: 'May', success: 22, ongoing: 9, failed: 1 },
    { month: 'Jun', success: 25, ongoing: 11, failed: 2 },
  ];

  // Student progress over time
  const progressData = [
    { month: 'Jan', avgGPA: 2.8, improved: 5, declined: 8 },
    { month: 'Feb', avgGPA: 2.9, improved: 7, declined: 6 },
    { month: 'Mar', avgGPA: 3.0, improved: 9, declined: 5 },
    { month: 'Apr', avgGPA: 3.1, improved: 11, declined: 4 },
    { month: 'May', avgGPA: 3.2, improved: 13, declined: 3 },
    { month: 'Jun', avgGPA: 3.3, improved: 15, declined: 2 },
  ];

  // Issue categories
  const issueCategories = [
    { category: 'Academic', count: 18 },
    { category: 'Attendance', count: 15 },
    { category: 'Mental Health', count: 12 },
    { category: 'Financial', count: 8 },
    { category: 'Social', count: 6 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Counseling effectiveness and student progress insights
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="text-3xl text-green-600">82%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span>+5% from last month</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Sessions</CardDescription>
            <CardTitle className="text-3xl">4.5</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Per student per semester</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Improved Students</CardDescription>
            <CardTitle className="text-3xl text-blue-600">28</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <TrendingUp className="h-4 w-4" />
              <span>This semester</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>At-Risk Cases</CardDescription>
            <CardTitle className="text-3xl text-orange-600">12</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-orange-600">
              <AlertTriangle className="h-4 w-4" />
              <span>Needs attention</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Level Distribution</CardTitle>
            <CardDescription>Current caseload by risk category</CardDescription>
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

        {/* Issue Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Common Issues</CardTitle>
            <CardDescription>Primary concerns by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={issueCategories}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Intervention Effectiveness */}
        <Card>
          <CardHeader>
            <CardTitle>Intervention Outcomes</CardTitle>
            <CardDescription>Monthly intervention results</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={interventionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" fill="#16a34a" name="Successful" />
                <Bar dataKey="ongoing" fill="#3b82f6" name="Ongoing" />
                <Bar dataKey="failed" fill="#dc2626" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Student Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Student Progress Trends</CardTitle>
            <CardDescription>Academic improvement over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgGPA"
                  stroke="#3b82f6"
                  name="Average GPA"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="improved"
                  stroke="#16a34a"
                  name="Improved"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="declined"
                  stroke="#dc2626"
                  name="Declined"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
