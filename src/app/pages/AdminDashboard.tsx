import { useState } from 'react';
import { mockAlerts } from '../mockData';
import { useData } from '../DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Users, Shield, Activity, AlertTriangle, UserPlus, Database, BarChart } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [permissions, setPermissions] = useState({
    advisor: {
      viewDashboard: true,
      viewReports: true,
      createInterventions: true,
      scheduleAppointments: true,
      manageUsers: false,
      systemConfiguration: false,
      viewStudents: true,
      editStudents: true,
    },
    faculty: {
      viewDashboard: true,
      viewReports: true,
      createInterventions: false,
      scheduleAppointments: false,
      manageUsers: false,
      systemConfiguration: false,
      viewStudents: true,
      editStudents: false,
    },
    counselor: {
      viewDashboard: true,
      viewReports: true,
      createInterventions: false,
      scheduleAppointments: true,
      manageUsers: false,
      systemConfiguration: false,
      viewStudents: true,
      editStudents: false,
    },
    student: {
      viewDashboard: true,
      viewReports: false,
      createInterventions: false,
      scheduleAppointments: false,
      manageUsers: false,
      systemConfiguration: false,
      viewStudents: false,
      editStudents: false,
    },
    admin: {
      viewDashboard: true,
      viewReports: true,
      createInterventions: true,
      scheduleAppointments: true,
      manageUsers: true,
      systemConfiguration: true,
      viewStudents: true,
      editStudents: true,
    },
  });

  // Calculate system statistics
  const { users, students } = useData();
  const totalUsers = users.length;
  const totalStudents = users.filter((u) => u.role === 'student').length;
  const totalFaculty = users.filter((u) => u.role === 'faculty').length;
  const totalAdvisors = users.filter((u) => u.role === 'advisor').length;
  const totalCounselors = users.filter((u) => u.role === 'counselor').length;
  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const activeAlerts = mockAlerts.filter((a) => !a.acknowledged).length;
  const criticalStudents = students.filter((s) => s.riskLevel === 'critical').length;

  // User role distribution
  const roleDistribution = [
    { role: 'Students', count: users.filter((u) => u.role === 'student').length, color: '#3b82f6' },
    { role: 'Advisors', count: users.filter((u) => u.role === 'advisor').length, color: '#10b981' },
    { role: 'Faculty', count: users.filter((u) => u.role === 'faculty').length, color: '#f59e0b' },
    { role: 'Counselors', count: users.filter((u) => u.role === 'counselor').length, color: '#8b5cf6' },
    { role: 'Admins', count: users.filter((u) => u.role === 'admin').length, color: '#ef4444' },
  ];

  // Risk distribution
  const riskDistribution = [
    { level: 'Critical', count: students.filter((s) => s.riskLevel === 'critical').length },
    { level: 'High', count: students.filter((s) => s.riskLevel === 'high').length },
    { level: 'Medium', count: students.filter((s) => s.riskLevel === 'medium').length },
    { level: 'Low', count: students.filter((s) => s.riskLevel === 'low').length },
  ];

  // System activity (mock data)
  const systemActivity = [
    { metric: 'Daily Logins', value: 324 },
    { metric: 'Reports Generated', value: 45 },
    { metric: 'Interventions Created', value: 18 },
    { metric: 'Appointments Scheduled', value: 67 },
  ];

  const handlePermissionChange = (role: string, permission: string, value: boolean) => {
    setPermissions((prevPermissions) => ({
      ...prevPermissions,
      [role]: {
        ...prevPermissions[role],
        [permission]: value,
      },
    }));
  };

  const handleConfigurePermissions = (role: string) => {
    setSelectedRole(role);
    setIsPermissionDialogOpen(true);
  };

  const handleSavePermissions = () => {
    setIsPermissionDialogOpen(false);
    toast.success('Permissions updated', {
      description: `Permissions for ${selectedRole} role have been saved successfully.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
        <p className="text-muted-foreground">Manage users, monitor system performance, and configure settings</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">All system users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Database className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">Enrolled students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Faculty</CardTitle>
            <UserPlus className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFaculty}</div>
            <p className="text-xs text-muted-foreground">Faculty members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Advisors</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAdvisors}</div>
            <p className="text-xs text-muted-foreground">Academic advisors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Counselors</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCounselors}</div>
            <p className="text-xs text-muted-foreground">Counselors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAdmins}</div>
            <p className="text-xs text-muted-foreground">Administrators</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Role Distribution</CardTitle>
            <CardDescription>System users by role</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ role, count }) => `${role}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {roleDistribution.map((entry, index) => (
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
            <CardTitle>Student Risk Levels</CardTitle>
            <CardDescription>Current risk assessment distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsBarChart data={riskDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* System Activity */}
      <Card>
        <CardHeader>
          <CardTitle>System Activity (Last 24 Hours)</CardTitle>
          <CardDescription>Key performance metrics and usage statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {systemActivity.map((item) => (
              <div key={item.metric} className="border rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{item.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{item.metric}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Management */}
      <Tabs defaultValue="permissions" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="permissions">Access Control</TabsTrigger>
        </TabsList>

        {/* Access Control Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
              <CardDescription>Configure access control for different user roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['advisor', 'faculty', 'counselor', 'student', 'admin'].map((role) => (
                  <div key={role} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium capitalize">{role}</h4>
                      <Button size="sm" variant="outline" onClick={() => handleConfigurePermissions(role)}>Configure</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>✓ View Dashboard</div>
                      <div>✓ View Reports</div>
                      {(role === 'advisor' || role === 'admin') && <div>✓ Create Interventions</div>}
                      {(role === 'advisor' || role === 'counselor' || role === 'admin') && <div>✓ Schedule Appointments</div>}
                      {role === 'admin' && <div>✓ Manage Users</div>}
                      {role === 'admin' && <div>✓ System Configuration</div>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Permission Configuration Dialog */}
          <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
            <DialogContent className="max-h-[600px] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configure Permissions for {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</DialogTitle>
                <DialogDescription>Set permissions for the selected role</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="viewDashboard"
                    checked={permissions[selectedRole]?.viewDashboard}
                    onCheckedChange={(checked) => handlePermissionChange(selectedRole, 'viewDashboard', !!checked)}
                  />
                  <Label htmlFor="viewDashboard" className="cursor-pointer">View Dashboard</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="viewReports"
                    checked={permissions[selectedRole]?.viewReports}
                    onCheckedChange={(checked) => handlePermissionChange(selectedRole, 'viewReports', !!checked)}
                  />
                  <Label htmlFor="viewReports" className="cursor-pointer">View Reports</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createInterventions"
                    checked={permissions[selectedRole]?.createInterventions}
                    onCheckedChange={(checked) => handlePermissionChange(selectedRole, 'createInterventions', !!checked)}
                  />
                  <Label htmlFor="createInterventions" className="cursor-pointer">Create Interventions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scheduleAppointments"
                    checked={permissions[selectedRole]?.scheduleAppointments}
                    onCheckedChange={(checked) => handlePermissionChange(selectedRole, 'scheduleAppointments', !!checked)}
                  />
                  <Label htmlFor="scheduleAppointments" className="cursor-pointer">Schedule Appointments</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="manageUsers"
                    checked={permissions[selectedRole]?.manageUsers}
                    onCheckedChange={(checked) => handlePermissionChange(selectedRole, 'manageUsers', !!checked)}
                  />
                  <Label htmlFor="manageUsers" className="cursor-pointer">Manage Users</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="systemConfiguration"
                    checked={permissions[selectedRole]?.systemConfiguration}
                    onCheckedChange={(checked) => handlePermissionChange(selectedRole, 'systemConfiguration', !!checked)}
                  />
                  <Label htmlFor="systemConfiguration" className="cursor-pointer">System Configuration</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="viewStudents"
                    checked={permissions[selectedRole]?.viewStudents}
                    onCheckedChange={(checked) => handlePermissionChange(selectedRole, 'viewStudents', !!checked)}
                  />
                  <Label htmlFor="viewStudents" className="cursor-pointer">View Students</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="editStudents"
                    checked={permissions[selectedRole]?.editStudents}
                    onCheckedChange={(checked) => handlePermissionChange(selectedRole, 'editStudents', !!checked)}
                  />
                  <Label htmlFor="editStudents" className="cursor-pointer">Edit Students</Label>
                </div>
                <Button onClick={handleSavePermissions} className="w-full">
                  Save Permissions
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}