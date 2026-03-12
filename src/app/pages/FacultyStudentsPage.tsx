import { useData } from '../DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Link } from 'react-router';
import { Search, AlertTriangle, TrendingDown, Calendar, GraduationCap } from 'lucide-react';
import { useState } from 'react';

export default function FacultyStudentsPage() {
  const { students } = useData();
  const [searchQuery, setSearchQuery] = useState('');

  // Get students that might be in faculty's courses
  const myStudents = students.slice(0, 10);

  const filteredStudents = myStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.programme.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const riskStats = {
    critical: myStudents.filter((s) => s.riskLevel === 'critical').length,
    high: myStudents.filter((s) => s.riskLevel === 'high').length,
    medium: myStudents.filter((s) => s.riskLevel === 'medium').length,
    low: myStudents.filter((s) => s.riskLevel === 'low').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Students</h1>
        <p className="text-muted-foreground">
          Monitor and track students in your courses
        </p>
      </div>

      {/* Risk Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Critical Risk</CardDescription>
            <CardTitle className="text-3xl text-red-600">{riskStats.critical}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Needs immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>High Risk</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{riskStats.high}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Requires monitoring</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Medium Risk</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{riskStats.medium}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Watch closely</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Low Risk</CardDescription>
            <CardTitle className="text-3xl text-green-600">{riskStats.low}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">On track</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>All students enrolled in your courses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, student ID, or program..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{student.name}</h3>
                      <Badge className={getRiskColor(student.riskLevel)}>
                        {student.riskLevel}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{student.id}</span>
                      <span>•</span>
                      <span>{student.programme}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {student.riskLevel === 'critical' || student.riskLevel === 'high' ? (
                    <div className="flex items-center gap-1 text-orange-600 text-sm mr-4">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Alert</span>
                    </div>
                  ) : null}
                  <Link to={`/faculty/student/${student.id}`}>
                    <Button size="sm" variant="outline">View Profile</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No students found matching your search</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}