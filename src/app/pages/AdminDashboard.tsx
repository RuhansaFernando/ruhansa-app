import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Users, AlertTriangle, UserPlus, Database, Loader2, Heart, UserCog } from 'lucide-react';
import {
  BarChart as RechartsBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';

interface StudentDoc {
  id: string;
  riskLevel: string;
  status: string;
  program: string;
}

interface StaffDoc {
  id: string;
  status: string;
}

export default function AdminDashboard() {
  // ── Firestore state ──────────────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [advisors, setAdvisors] = useState<StaffDoc[]>([]);
  const [counselors, setCounselors] = useState<StaffDoc[]>([]);
  const [faculty, setFaculty] = useState<StaffDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let s = false, a = false, c = false, f = false;
    const done = () => { if (s && a && c && f) setLoading(false); };

    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map((d) => ({
        id: d.id,
        riskLevel: d.data().riskLevel ?? 'low',
        status: d.data().status ?? 'active',
        program: d.data().program ?? 'Unknown',
      })));
      s = true; done();
    });

    const unsubAdvisors = onSnapshot(collection(db, 'advisors'), (snap) => {
      setAdvisors(snap.docs.map((d) => ({ id: d.id, status: d.data().status ?? 'active' })));
      a = true; done();
    });

    const unsubCounselors = onSnapshot(collection(db, 'counselors'), (snap) => {
      setCounselors(snap.docs.map((d) => ({ id: d.id, status: d.data().status ?? 'active' })));
      c = true; done();
    });

    const unsubFaculty = onSnapshot(collection(db, 'faculty'), (snap) => {
      setFaculty(snap.docs.map((d) => ({ id: d.id, status: d.data().status ?? 'active' })));
      f = true; done();
    });

    return () => { unsubStudents(); unsubAdvisors(); unsubCounselors(); unsubFaculty(); };
  }, []);

  // ── Derived statistics ───────────────────────────────────────────────────────
  const totalStudents   = students.length;
  const totalAdvisors   = advisors.length;
  const totalCounselors = counselors.length;
  const totalFaculty    = faculty.length;
  const totalUsers      = totalStudents + totalAdvisors + totalCounselors + totalFaculty + 1; // +1 admin

  const criticalStudents = students.filter((s) => s.riskLevel === 'critical').length;
  const highStudents     = students.filter((s) => s.riskLevel === 'high').length;
  const activeAdvisors   = advisors.filter((a) => a.status === 'active').length;
  const activeCounselors = counselors.filter((c) => c.status === 'active').length;

  // Role distribution pie chart
  const roleDistribution = [
    { role: 'Students',   count: totalStudents,   color: '#3b82f6' },
    { role: 'Advisors',   count: totalAdvisors,   color: '#10b981' },
    { role: 'Faculty',    count: totalFaculty,    color: '#f59e0b' },
    { role: 'Counselors', count: totalCounselors, color: '#8b5cf6' },
  ].filter((r) => r.count > 0);

  // Risk distribution bar chart
  const riskDistribution = [
    { level: 'Critical', count: students.filter((s) => s.riskLevel === 'critical').length, fill: '#dc2626' },
    { level: 'High',     count: students.filter((s) => s.riskLevel === 'high').length,     fill: '#ea580c' },
    { level: 'Medium',   count: students.filter((s) => s.riskLevel === 'medium').length,   fill: '#eab308' },
    { level: 'Low',      count: students.filter((s) => s.riskLevel === 'low').length,      fill: '#16a34a' },
  ];

  // Live system summary stats
  const systemSummary = [
    { metric: 'Total Students',       value: totalStudents,   color: 'text-blue-600' },
    { metric: 'Critical Risk',        value: criticalStudents, color: 'text-red-600' },
    { metric: 'Active Advisors',      value: activeAdvisors,  color: 'text-green-600' },
    { metric: 'Active Counselors',    value: activeCounselors, color: 'text-purple-600' },
  ];

  // ── Permissions (local UI only) ──────────────────────────────────────────────
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [permissions, setPermissions] = useState({
    advisor:   { viewDashboard: true, viewReports: true, createInterventions: true,  scheduleAppointments: true,  manageUsers: false, systemConfiguration: false, viewStudents: true,  editStudents: true  },
    faculty:   { viewDashboard: true, viewReports: true, createInterventions: false, scheduleAppointments: false, manageUsers: false, systemConfiguration: false, viewStudents: true,  editStudents: false },
    counselor: { viewDashboard: true, viewReports: true, createInterventions: false, scheduleAppointments: true,  manageUsers: false, systemConfiguration: false, viewStudents: true,  editStudents: false },
    student:   { viewDashboard: true, viewReports: false, createInterventions: false, scheduleAppointments: false, manageUsers: false, systemConfiguration: false, viewStudents: false, editStudents: false },
    admin:     { viewDashboard: true, viewReports: true, createInterventions: true,  scheduleAppointments: true,  manageUsers: true,  systemConfiguration: true,  viewStudents: true,  editStudents: true  },
  });

  const handlePermissionChange = (role: string, permission: string, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [role]: { ...prev[role as keyof typeof prev], [permission]: value } }));
  };

  const handleSavePermissions = () => {
    setIsPermissionDialogOpen(false);
    toast.success('Permissions updated', {
      description: `Permissions for ${selectedRole} role have been saved successfully.`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            <UserCog className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAdvisors}</div>
            <p className="text-xs text-muted-foreground">
              {activeAdvisors} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Counselors</CardTitle>
            <Heart className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCounselors}</div>
            <p className="text-xs text-muted-foreground">
              {activeCounselors} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalStudents}</div>
            <p className="text-xs text-muted-foreground">Students at critical risk</p>
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
            {roleDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No user data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={roleDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ role, count }) => `${role}: ${count}`}
                    outerRadius={80}
                    dataKey="count"
                  >
                    {roleDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student Risk Levels</CardTitle>
            <CardDescription>Current risk assessment distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {totalStudents === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No student data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={riskDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live System Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Live System Summary</CardTitle>
          <CardDescription>Real-time counts pulled directly from the database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {systemSummary.map((item) => (
              <div key={item.metric} className="border rounded-lg p-4 text-center">
                <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{item.metric}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Staff Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Advisor Status</CardTitle>
            <CardDescription>Active vs inactive advisors</CardDescription>
          </CardHeader>
          <CardContent>
            {totalAdvisors === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No advisors in the system yet</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-green-500 rounded-full" style={{ width: `${(activeAdvisors / totalAdvisors) * 120}px` }} />
                    <Badge className="bg-green-100 text-green-800">{activeAdvisors}</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Inactive</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-gray-300 rounded-full" style={{ width: `${((totalAdvisors - activeAdvisors) / totalAdvisors) * 120}px` }} />
                    <Badge variant="secondary">{totalAdvisors - activeAdvisors}</Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Counselor Status</CardTitle>
            <CardDescription>Active vs inactive counselors</CardDescription>
          </CardHeader>
          <CardContent>
            {totalCounselors === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No counselors in the system yet</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-purple-500 rounded-full" style={{ width: `${(activeCounselors / totalCounselors) * 120}px` }} />
                    <Badge className="bg-purple-100 text-purple-800">{activeCounselors}</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Inactive</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-gray-300 rounded-full" style={{ width: `${((totalCounselors - activeCounselors) / totalCounselors) * 120}px` }} />
                    <Badge variant="secondary">{totalCounselors - activeCounselors}</Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Access Control */}
      <Tabs defaultValue="permissions" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="permissions">Access Control</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
              <CardDescription>Configure access control for different user roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(['advisor', 'faculty', 'counselor', 'student', 'admin'] as const).map((role) => (
                  <div key={role} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium capitalize">{role}</h4>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedRole(role); setIsPermissionDialogOpen(true); }}>
                        Configure
                      </Button>
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

          {/* Permission Dialog */}
          <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
            <DialogContent className="max-h-[600px] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configure Permissions for {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</DialogTitle>
                <DialogDescription>Set permissions for the selected role</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {([
                  ['viewDashboard',       'View Dashboard'],
                  ['viewReports',         'View Reports'],
                  ['createInterventions', 'Create Interventions'],
                  ['scheduleAppointments','Schedule Appointments'],
                  ['manageUsers',         'Manage Users'],
                  ['systemConfiguration', 'System Configuration'],
                  ['viewStudents',        'View Students'],
                  ['editStudents',        'Edit Students'],
                ] as [string, string][]).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={permissions[selectedRole as keyof typeof permissions]?.[key as keyof (typeof permissions)['admin']] ?? false}
                      onCheckedChange={(checked) => handlePermissionChange(selectedRole, key, !!checked)}
                    />
                    <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                  </div>
                ))}
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
