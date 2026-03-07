import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, UserCog, Mail, Phone, Plus, Edit, Trash2, Download } from 'lucide-react';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

interface Advisor {
  id: string;
  name: string;
  email: string;
  department: string;
  phone: string;
  status: 'active' | 'inactive';
  studentsAssigned: number;
  specialization: string[];
  joinedDate: string;
}

const mockAdvisors: Advisor[] = [
  {
    id: '1',
    name: 'Dr. Sarah Johnson',
    email: 'sarah.johnson@university.edu',
    department: 'Academic Services',
    phone: '+1 (555) 111-2222',
    status: 'active',
    studentsAssigned: 35,
    specialization: ['First-Year Students', 'Career Planning'],
    joinedDate: '2019-08-15',
  },
  {
    id: '2',
    name: 'Michael Anderson',
    email: 'michael.anderson@university.edu',
    department: 'Student Services',
    phone: '+1 (555) 222-3333',
    status: 'active',
    studentsAssigned: 42,
    specialization: ['Academic Support', 'Study Skills'],
    joinedDate: '2020-01-10',
  },
  {
    id: '3',
    name: 'Dr. Lisa Chen',
    email: 'lisa.chen@university.edu',
    department: 'Academic Services',
    phone: '+1 (555) 333-4444',
    status: 'active',
    studentsAssigned: 38,
    specialization: ['STEM Programs', 'Graduate Planning'],
    joinedDate: '2018-09-01',
  },
  {
    id: '4',
    name: 'Robert Martinez',
    email: 'robert.martinez@university.edu',
    department: 'Student Services',
    phone: '+1 (555) 444-5555',
    status: 'active',
    studentsAssigned: 45,
    specialization: ['Transfer Students', 'International Students'],
    joinedDate: '2021-03-20',
  },
];

export default function AdminAdvisorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [advisorList, setAdvisorList] = useState<Advisor[]>(mockAdvisors);
  const [editingAdvisor, setEditingAdvisor] = useState<Advisor | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingAdvisor, setViewingAdvisor] = useState<Advisor | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [deletingAdvisor, setDeletingAdvisor] = useState<Advisor | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editSpecialization, setEditSpecialization] = useState('');
  const [editJoinedDate, setEditJoinedDate] = useState('');

  // Add form state
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addDepartment, setAddDepartment] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addStatus, setAddStatus] = useState<'active' | 'inactive'>('active');
  const [addSpecialization, setAddSpecialization] = useState('');
  const [addJoinedDate, setAddJoinedDate] = useState('');

  // Additional add form fields
  const [addEmployeeId, setAddEmployeeId] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addMaxStudentCapacity, setAddMaxStudentCapacity] = useState('');

  // All available departments for dropdown
  const allDepartments = [
    'Academic Services',
    'Student Services',
    'Computer Science',
    'Mathematics',
    'Engineering',
    'Business Administration',
    'Liberal Arts',
    'Natural Sciences',
  ];

  const filteredAdvisors = advisorList.filter((advisor) => {
    const matchesSearch =
      advisor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      advisor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      advisor.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDepartment = departmentFilter === 'all' || advisor.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || advisor.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const stats = {
    total: advisorList.length,
    active: advisorList.filter((a) => a.status === 'active').length,
    totalStudents: advisorList.reduce((sum, a) => sum + a.studentsAssigned, 0),
    avgStudentsPerAdvisor: Math.round(
      advisorList.reduce((sum, a) => sum + a.studentsAssigned, 0) / advisorList.length
    ),
  };

  const handleEditClick = (advisor: Advisor) => {
    setEditingAdvisor(advisor);
    setEditName(advisor.name);
    setEditEmail(advisor.email);
    setEditDepartment(advisor.department);
    setEditPhone(advisor.phone);
    setEditStatus(advisor.status);
    setEditSpecialization(advisor.specialization.join(', '));
    setEditJoinedDate(advisor.joinedDate);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editName || !editEmail || !editDepartment || !editPhone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!editingAdvisor) return;

    const specializationArray = editSpecialization
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const updatedAdvisor = {
      ...editingAdvisor,
      name: editName,
      email: editEmail,
      department: editDepartment,
      phone: editPhone,
      status: editStatus,
      specialization: specializationArray,
      joinedDate: editJoinedDate,
    };

    setAdvisorList((prev) =>
      prev.map((a) => (a.id === editingAdvisor.id ? updatedAdvisor : a))
    );

    toast.success('Advisor updated successfully');
    setIsEditDialogOpen(false);
    setEditingAdvisor(null);
  };

  const handleViewClick = (advisor: Advisor) => {
    setViewingAdvisor(advisor);
    setIsViewDialogOpen(true);
  };

  const handleAddAdvisor = () => {
    if (!addName || !addEmail || !addDepartment || !addPhone) {
      toast.error('Please fill in all required fields');
      return;
    }

    const specializationArray = addSpecialization
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newAdvisor: Advisor = {
      id: (advisorList.length + 1).toString(),
      name: addName,
      email: addEmail,
      department: addDepartment,
      phone: addPhone,
      status: addStatus,
      studentsAssigned: 0,
      specialization: specializationArray,
      joinedDate: addJoinedDate,
    };

    setAdvisorList((prev) => [...prev, newAdvisor]);

    toast.success('Advisor added successfully');
    setIsAddDialogOpen(false);
  };

  const handleDeleteClick = (advisor: Advisor) => {
    setDeletingAdvisor(advisor);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteAdvisor = () => {
    if (!deletingAdvisor) return;

    setAdvisorList((prev) =>
      prev.filter((a) => a.id !== deletingAdvisor.id)
    );

    toast.success('Advisor deleted successfully');
    setIsDeleteDialogOpen(false);
    setDeletingAdvisor(null);
  };

  const handleExport = () => {
    // Convert advisor data to CSV
    const headers = ['Name', 'Email', 'Department', 'Phone', 'Status', 'Students Assigned', 'Specialization', 'Joined Date'];
    const csvData = filteredAdvisors.map(a => [
      a.name,
      a.email,
      a.department,
      a.phone,
      a.status,
      a.studentsAssigned,
      a.specialization.join('; '),
      a.joinedDate
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `advisors_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Advisor data exported successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advisor Management</h1>
          <p className="text-muted-foreground">Manage academic advisors and their assignments</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Advisors</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All departments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Advisors</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Currently advising</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Students Assigned</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.totalStudents}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Total across all advisors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg per Advisor</CardDescription>
            <CardTitle className="text-3xl">{stats.avgStudentsPerAdvisor}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Students assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Advisor List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Advisor Directory</CardTitle>
            <CardDescription>All academic advisors in the system</CardDescription>
          </div>
          <Button 
            className="gap-2"
            onClick={() => {
              setAddName('');
              setAddEmail('');
              setAddDepartment('');
              setAddPhone('');
              setAddStatus('active');
              setAddSpecialization('');
              setAddJoinedDate('');
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Advisor
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Select
                value={departmentFilter}
                onValueChange={(value) => setDepartmentFilter(value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by department">
                    {departmentFilter === 'all' ? 'All Departments' : departmentFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {allDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status">
                    {statusFilter === 'all' ? 'All Statuses' : statusFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredAdvisors.map((advisor) => (
              <div
                key={advisor.id}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <UserCog className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{advisor.name}</h3>
                        <Badge
                          className={
                            advisor.status === 'active'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-gray-100 text-gray-800 border-gray-200'
                          }
                        >
                          {advisor.status}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>{advisor.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{advisor.phone}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="font-medium">Department:</span>{' '}
                          <span className="text-muted-foreground">{advisor.department}</span>
                        </div>
                        <div>
                          <span className="font-medium">Students:</span>{' '}
                          <span className="text-muted-foreground">{advisor.studentsAssigned}</span>
                        </div>
                        <div>
                          <span className="font-medium">Specialization:</span>{' '}
                          <span className="text-muted-foreground">
                            {advisor.specialization.join(', ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Joined {new Date(advisor.joinedDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => handleEditClick(advisor)}>
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleViewClick(advisor)}>View Details</Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => handleDeleteClick(advisor)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAdvisors.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No advisors found matching your search</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Advisor</DialogTitle>
            <DialogDescription>Update the details of the advisor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Enter email"
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={editDepartment} onValueChange={(value) => setEditDepartment(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {allDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(value: 'active' | 'inactive') => setEditStatus(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input
                value={editSpecialization}
                onChange={(e) => setEditSpecialization(e.target.value)}
                placeholder="Enter specializations separated by commas"
              />
            </div>
            <div className="space-y-2">
              <Label>Joined Date</Label>
              <Input
                type="date"
                value={editJoinedDate}
                onChange={(e) => setEditJoinedDate(e.target.value)}
                placeholder="Enter joined date"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advisor Details</DialogTitle>
            <DialogDescription>View the details of the advisor</DialogDescription>
          </DialogHeader>
          {viewingAdvisor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={viewingAdvisor.name}
                  readOnly
                  placeholder="Enter name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={viewingAdvisor.email}
                  readOnly
                  placeholder="Enter email"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={viewingAdvisor.department}
                  readOnly
                  placeholder="Enter department"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={viewingAdvisor.phone}
                  readOnly
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input
                  value={viewingAdvisor.status}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <Label>Specialization</Label>
                <Input
                  value={viewingAdvisor.specialization.join(', ')}
                  readOnly
                  placeholder="Enter specializations separated by commas"
                />
              </div>
              <div className="space-y-2">
                <Label>Joined Date</Label>
                <Input
                  type="date"
                  value={viewingAdvisor.joinedDate}
                  readOnly
                  placeholder="Enter joined date"
                />
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Academic Advisor</DialogTitle>
            <DialogDescription>Add a new academic advisor to the system</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="e.g. Dr. Sarah Johnson"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>

            {/* Employee ID */}
            <div className="space-y-2">
              <Label htmlFor="employeeId">
                Employee ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="employeeId"
                placeholder="e.g. EMP2023045"
                value={addEmployeeId}
                onChange={(e) => setAddEmployeeId(e.target.value)}
              />
            </div>

            {/* Email Address */}
            <div className="space-y-2">
              <Label htmlFor="emailAddress">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="emailAddress"
                type="email"
                placeholder="name@university.edu"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Set password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
              />
            </div>

            {/* Contact Number */}
            <div className="space-y-2">
              <Label htmlFor="contactNumber">
                Contact Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactNumber"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">
                Department <span className="text-red-500">*</span>
              </Label>
              <Select value={addDepartment} onValueChange={setAddDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {allDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Specialisation */}
            <div className="space-y-2">
              <Label htmlFor="specialisation">
                Specialisation <span className="text-red-500">*</span>
              </Label>
              <Select value={addSpecialization} onValueChange={setAddSpecialization}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="First-Year Students">First-Year Students</SelectItem>
                  <SelectItem value="Career Planning">Career Planning</SelectItem>
                  <SelectItem value="Academic Support">Academic Support</SelectItem>
                  <SelectItem value="Study Skills">Study Skills</SelectItem>
                  <SelectItem value="STEM Programs">STEM Programs</SelectItem>
                  <SelectItem value="Graduate Planning">Graduate Planning</SelectItem>
                  <SelectItem value="Transfer Students">Transfer Students</SelectItem>
                  <SelectItem value="International Students">International Students</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max Student Capacity */}
            <div className="space-y-2">
              <Label htmlFor="maxCapacity">
                Max Student Capacity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="maxCapacity"
                type="number"
                placeholder="e.g. 40"
                value={addMaxStudentCapacity}
                onChange={(e) => setAddMaxStudentCapacity(e.target.value)}
              />
            </div>

            {/* Status */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="status">Status</Label>
              <Select value={addStatus} onValueChange={(value: 'active' | 'inactive') => setAddStatus(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                // Validation
                if (!addName || !addEmployeeId || !addEmail || !addPassword || !addPhone || !addDepartment || !addSpecialization || !addMaxStudentCapacity) {
                  toast.error('Please fill in all required fields');
                  return;
                }

                const newAdvisor: Advisor = {
                  id: (advisorList.length + 1).toString(),
                  name: addName,
                  email: addEmail,
                  department: addDepartment,
                  phone: addPhone,
                  status: addStatus,
                  studentsAssigned: 0,
                  specialization: [addSpecialization],
                  joinedDate: new Date().toISOString().split('T')[0],
                };

                setAdvisorList((prev) => [...prev, newAdvisor]);

                toast.success('Academic Advisor added successfully');
                setIsAddDialogOpen(false);

                // Reset form
                setAddName('');
                setAddEmployeeId('');
                setAddEmail('');
                setAddPassword('');
                setAddPhone('');
                setAddDepartment('');
                setAddSpecialization('');
                setAddMaxStudentCapacity('');
                setAddStatus('active');
              }}
            >
              Add Advisor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Advisor</DialogTitle>
            <DialogDescription>Are you sure you want to delete this advisor?</DialogDescription>
          </DialogHeader>
          {deletingAdvisor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={deletingAdvisor.name}
                  readOnly
                  placeholder="Enter name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={deletingAdvisor.email}
                  readOnly
                  placeholder="Enter email"
                />
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDeleteAdvisor}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}