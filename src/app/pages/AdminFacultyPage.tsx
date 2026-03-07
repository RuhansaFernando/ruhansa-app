import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, UserCog, Mail, Phone, Plus, Edit, Trash2, Download } from 'lucide-react';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  department: string;
  phone: string;
  status: 'active' | 'inactive';
  studentsAssigned: number;
  courses: string[];
  joinedDate: string;
}

const mockFaculty: FacultyMember[] = [
  {
    id: '1',
    name: 'Dr. Michael Chen',
    email: 'michael.chen@university.edu',
    department: 'Computer Science',
    phone: '+1 (555) 123-4567',
    status: 'active',
    studentsAssigned: 45,
    courses: ['CS101', 'CS301', 'CS450'],
    joinedDate: '2020-01-15',
  },
  {
    id: '2',
    name: 'Prof. Emily Rodriguez',
    email: 'emily.rodriguez@university.edu',
    department: 'Mathematics',
    phone: '+1 (555) 234-5678',
    status: 'active',
    studentsAssigned: 52,
    courses: ['MATH201', 'MATH301'],
    joinedDate: '2019-05-20',
  },
  {
    id: '3',
    name: 'Dr. James Wilson',
    email: 'james.wilson@university.edu',
    department: 'Engineering',
    phone: '+1 (555) 345-6789',
    status: 'active',
    studentsAssigned: 38,
    courses: ['ENG101', 'ENG205', 'ENG401'],
    joinedDate: '2021-03-10',
  },
  {
    id: '4',
    name: 'Prof. Sarah Thompson',
    email: 'sarah.thompson@university.edu',
    department: 'Business Administration',
    phone: '+1 (555) 456-7890',
    status: 'active',
    studentsAssigned: 60,
    courses: ['BUS101', 'BUS301'],
    joinedDate: '2018-08-25',
  },
  {
    id: '5',
    name: 'Dr. David Park',
    email: 'david.park@university.edu',
    department: 'Biology',
    phone: '+1 (555) 567-8901',
    status: 'active',
    studentsAssigned: 42,
    courses: ['BIO101', 'BIO202', 'BIO305'],
    joinedDate: '2022-06-05',
  },
  {
    id: '6',
    name: 'Prof. Linda Martinez',
    email: 'linda.martinez@university.edu',
    department: 'Psychology',
    phone: '+1 (555) 678-9012',
    status: 'active',
    studentsAssigned: 48,
    courses: ['PSY101', 'PSY301'],
    joinedDate: '2017-11-30',
  },
];

export default function AdminFacultyPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [facultyList, setFacultyList] = useState<FacultyMember[]>(mockFaculty);
  const [editingFaculty, setEditingFaculty] = useState<FacultyMember | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingFaculty, setViewingFaculty] = useState<FacultyMember | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [deletingFaculty, setDeletingFaculty] = useState<FacultyMember | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editCourses, setEditCourses] = useState('');
  const [editJoinedDate, setEditJoinedDate] = useState('');

  // Add form state
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addDepartment, setAddDepartment] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addStatus, setAddStatus] = useState<'active' | 'inactive'>('active');
  const [addCourses, setAddCourses] = useState('');
  const [addJoinedDate, setAddJoinedDate] = useState('');

  // Additional add form fields
  const [addEmployeeId, setAddEmployeeId] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addDesignation, setAddDesignation] = useState('');
  const [addOfficeRoom, setAddOfficeRoom] = useState('');
  const [addModulesTeaching, setAddModulesTeaching] = useState<string[]>([]);

  // Get unique departments
  const departments = Array.from(new Set(facultyList.map((f) => f.department)));

  // All available departments for dropdown
  const allDepartments = [
    'Computer Science',
    'Mathematics',
    'Engineering',
    'Business Administration',
    'Biology',
    'Psychology',
    'Chemistry',
    'Physics',
    'English Literature',
    'History',
    'Economics',
    'Sociology',
  ];

  const filteredFaculty = facultyList.filter((faculty) => {
    const matchesSearch =
      faculty.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faculty.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faculty.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDepartment = departmentFilter === 'all' || faculty.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || faculty.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const stats = {
    total: facultyList.length,
    active: facultyList.filter((f) => f.status === 'active').length,
    totalStudents: facultyList.reduce((sum, f) => sum + f.studentsAssigned, 0),
    avgStudentsPerFaculty: Math.round(
      facultyList.reduce((sum, f) => sum + f.studentsAssigned, 0) / facultyList.length
    ),
  };

  const handleEditClick = (faculty: FacultyMember) => {
    setEditingFaculty(faculty);
    setEditName(faculty.name);
    setEditEmail(faculty.email);
    setEditDepartment(faculty.department);
    setEditPhone(faculty.phone);
    setEditStatus(faculty.status);
    setEditCourses(faculty.courses.join(', '));
    setEditJoinedDate(faculty.joinedDate);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editName || !editEmail || !editDepartment || !editPhone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!editingFaculty) return;

    const coursesArray = editCourses
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const updatedFaculty = {
      ...editingFaculty,
      name: editName,
      email: editEmail,
      department: editDepartment,
      phone: editPhone,
      status: editStatus,
      courses: coursesArray,
      joinedDate: editJoinedDate,
    };

    setFacultyList((prev) =>
      prev.map((f) => (f.id === editingFaculty.id ? updatedFaculty : f))
    );

    toast.success('Faculty member updated successfully');
    setIsEditDialogOpen(false);
    setEditingFaculty(null);
  };

  const handleViewClick = (faculty: FacultyMember) => {
    setViewingFaculty(faculty);
    setIsViewDialogOpen(true);
  };

  const handleAddFaculty = () => {
    if (!addName || !addEmail || !addDepartment || !addPhone) {
      toast.error('Please fill in all required fields');
      return;
    }

    const coursesArray = addCourses
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const newFaculty: FacultyMember = {
      id: (facultyList.length + 1).toString(),
      name: addName,
      email: addEmail,
      department: addDepartment,
      phone: addPhone,
      status: addStatus,
      studentsAssigned: 0,
      courses: coursesArray,
      joinedDate: addJoinedDate,
    };

    setFacultyList((prev) => [...prev, newFaculty]);

    toast.success('Faculty member added successfully');
    setIsAddDialogOpen(false);
  };

  const handleDeleteClick = (faculty: FacultyMember) => {
    setDeletingFaculty(faculty);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteFaculty = () => {
    if (!deletingFaculty) return;

    setFacultyList((prev) =>
      prev.filter((f) => f.id !== deletingFaculty.id)
    );

    toast.success('Faculty member deleted successfully');
    setIsDeleteDialogOpen(false);
    setDeletingFaculty(null);
  };

  const handleExport = () => {
    // Convert faculty data to CSV
    const headers = ['Name', 'Email', 'Department', 'Phone', 'Status', 'Students Assigned', 'Courses', 'Joined Date'];
    const csvData = filteredFaculty.map(f => [
      f.name,
      f.email,
      f.department,
      f.phone,
      f.status,
      f.studentsAssigned,
      f.courses.join('; '),
      f.joinedDate
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `faculty_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Faculty data exported successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Faculty Management</h1>
          <p className="text-muted-foreground">Manage faculty members and their assignments</p>
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
            <CardDescription>Total Faculty</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All departments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Faculty</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Currently teaching</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Students Assigned</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.totalStudents}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Total across all faculty</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg per Faculty</CardDescription>
            <CardTitle className="text-3xl">{stats.avgStudentsPerFaculty}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Students assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Faculty List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Faculty Directory</CardTitle>
            <CardDescription>All faculty members in the system</CardDescription>
          </div>
          <Button 
            className="gap-2"
            onClick={() => {
              setAddName('');
              setAddEmail('');
              setAddDepartment('');
              setAddPhone('');
              setAddStatus('active');
              setAddCourses('');
              setAddJoinedDate('');
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Faculty
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
            {filteredFaculty.map((faculty) => (
              <div
                key={faculty.id}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <UserCog className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{faculty.name}</h3>
                        <Badge
                          className={
                            faculty.status === 'active'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-gray-100 text-gray-800 border-gray-200'
                          }
                        >
                          {faculty.status}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>{faculty.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{faculty.phone}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="font-medium">Department:</span>{' '}
                          <span className="text-muted-foreground">{faculty.department}</span>
                        </div>
                        <div>
                          <span className="font-medium">Students:</span>{' '}
                          <span className="text-muted-foreground">{faculty.studentsAssigned}</span>
                        </div>
                        <div>
                          <span className="font-medium">Courses:</span>{' '}
                          <span className="text-muted-foreground">
                            {faculty.courses.join(', ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Joined {new Date(faculty.joinedDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => handleEditClick(faculty)}>
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleViewClick(faculty)}>View Details</Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => handleDeleteClick(faculty)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredFaculty.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No faculty members found matching your search</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Faculty Member</DialogTitle>
            <DialogDescription>Update the details of the faculty member</DialogDescription>
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
              <Label>Courses</Label>
              <Input
                value={editCourses}
                onChange={(e) => setEditCourses(e.target.value)}
                placeholder="Enter courses separated by commas"
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
            <DialogTitle>Faculty Member Details</DialogTitle>
            <DialogDescription>View the details of the faculty member</DialogDescription>
          </DialogHeader>
          {viewingFaculty && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={viewingFaculty.name}
                  readOnly
                  placeholder="Enter name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={viewingFaculty.email}
                  readOnly
                  placeholder="Enter email"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={viewingFaculty.department}
                  readOnly
                  placeholder="Enter department"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={viewingFaculty.phone}
                  readOnly
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={viewingFaculty.status} readOnly>
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
                <Label>Courses</Label>
                <Input
                  value={viewingFaculty.courses.join(', ')}
                  readOnly
                  placeholder="Enter courses separated by commas"
                />
              </div>
              <div className="space-y-2">
                <Label>Joined Date</Label>
                <Input
                  type="date"
                  value={viewingFaculty.joinedDate}
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
            <DialogTitle>Add Faculty</DialogTitle>
            <DialogDescription>Add a new faculty member to the system</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="e.g. Dr. Michael Chen"
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
                placeholder="e.g. EMP2022010"
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

            {/* Designation */}
            <div className="space-y-2">
              <Label htmlFor="designation">
                Designation <span className="text-red-500">*</span>
              </Label>
              <Select value={addDesignation} onValueChange={setAddDesignation}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professor">Professor</SelectItem>
                  <SelectItem value="associate-professor">Associate Professor</SelectItem>
                  <SelectItem value="assistant-professor">Assistant Professor</SelectItem>
                  <SelectItem value="lecturer">Lecturer</SelectItem>
                  <SelectItem value="senior-lecturer">Senior Lecturer</SelectItem>
                  <SelectItem value="instructor">Instructor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Office / Room No. */}
            <div className="space-y-2">
              <Label htmlFor="officeRoom">Office / Room No.</Label>
              <Input
                id="officeRoom"
                placeholder="e.g. Room B204"
                value={addOfficeRoom}
                onChange={(e) => setAddOfficeRoom(e.target.value)}
              />
            </div>

            {/* Modules Teaching */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="modulesTeaching">Modules Teaching</Label>
              <div className="space-y-2">
                <Input
                  id="modulesTeaching"
                  placeholder="Type and press Enter to add modules"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const value = input.value.trim();
                      if (value && !addModulesTeaching.includes(value)) {
                        setAddModulesTeaching([...addModulesTeaching, value]);
                        input.value = '';
                      }
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {addModulesTeaching.map((module, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="px-3 py-1 text-sm cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => {
                        setAddModulesTeaching(addModulesTeaching.filter((_, i) => i !== index));
                      }}
                    >
                      {module} ×
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Examples: BIS3041 – Business Intelligence, BIS2031 – Systems Analysis
                </p>
              </div>
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
                if (!addName || !addEmployeeId || !addEmail || !addPassword || !addPhone || !addDepartment || !addDesignation) {
                  toast.error('Please fill in all required fields');
                  return;
                }

                const newFaculty: FacultyMember = {
                  id: (facultyList.length + 1).toString(),
                  name: addName,
                  email: addEmail,
                  department: addDepartment,
                  phone: addPhone,
                  status: addStatus,
                  studentsAssigned: 0,
                  courses: addModulesTeaching,
                  joinedDate: new Date().toISOString().split('T')[0],
                };

                setFacultyList((prev) => [...prev, newFaculty]);

                toast.success('Faculty member added successfully');
                setIsAddDialogOpen(false);

                // Reset form
                setAddName('');
                setAddEmployeeId('');
                setAddEmail('');
                setAddPassword('');
                setAddPhone('');
                setAddDepartment('');
                setAddDesignation('');
                setAddOfficeRoom('');
                setAddModulesTeaching([]);
                setAddStatus('active');
              }}
            >
              Add Faculty
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Faculty Member</DialogTitle>
            <DialogDescription>Are you sure you want to delete this faculty member?</DialogDescription>
          </DialogHeader>
          {deletingFaculty && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={deletingFaculty.name}
                  readOnly
                  placeholder="Enter name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={deletingFaculty.email}
                  readOnly
                  placeholder="Enter email"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input
                  value={deletingFaculty.department}
                  readOnly
                  placeholder="Enter department"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={deletingFaculty.phone}
                  readOnly
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={deletingFaculty.status} readOnly>
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
                <Label>Courses</Label>
                <Input
                  value={deletingFaculty.courses.join(', ')}
                  readOnly
                  placeholder="Enter courses separated by commas"
                />
              </div>
              <div className="space-y-2">
                <Label>Joined Date</Label>
                <Input
                  type="date"
                  value={deletingFaculty.joinedDate}
                  readOnly
                  placeholder="Enter joined date"
                />
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDeleteFaculty}>
              Delete Faculty
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}