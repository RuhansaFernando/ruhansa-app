import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Search, UserPlus, Mail, Shield, Edit, Trash2, Users, GraduationCap, Briefcase, Heart, UserCog } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useData } from '../DataContext';
import { User as UserType } from '../types';
import { useSearchParams } from 'react-router';

const departments = [
  'Academic Services',
  'Student Services',
  'Computer Science',
  'Mathematics',
  'Engineering',
  'Business Administration',
  'Liberal Arts',
  'Natural Sciences',
  'Social Sciences',
  'Health Sciences',
];

export default function AdminUsersPage() {
  const { users, addUser, updateUser, deleteUser } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'student' as UserType['role'],
    status: 'active' as 'active' | 'inactive',
    department: '',
  });
  const [addFormData, setAddFormData] = useState({
    name: '',
    email: '',
    role: 'student' as UserType['role'],
    status: 'active' as 'active' | 'inactive',
    department: '',
  });

  useEffect(() => {
    const query = searchParams.get('query');
    if (query) {
      setSearchQuery(query);
    }
  }, [searchParams]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['all', 'admin', 'advisor', 'faculty', 'counselor', 'student'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleEditClick = (user: UserType) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || 'active',
      department: user.department || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (user: UserType) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;
    
    updateUser(selectedUser.id, {
      name: editFormData.name,
      email: editFormData.email,
      role: editFormData.role,
      status: editFormData.status,
      department: editFormData.department,
    });
    
    toast.success('User updated successfully', {
      description: `${editFormData.name}'s information has been updated.`,
    });
    setIsEditDialogOpen(false);
    setSelectedUser(null);
  };

  const handleConfirmDelete = () => {
    if (!selectedUser) return;
    
    const deletedUserName = selectedUser.name;
    
    deleteUser(selectedUser.id);
    
    toast.success('User deleted', {
      description: `${deletedUserName} has been removed from the system.`,
    });
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  const handleAddUser = () => {
    const newUser: UserType = {
      id: `user-${Date.now()}`,
      name: addFormData.name,
      email: addFormData.email,
      role: addFormData.role,
      password: 'password123', // Default password
      status: addFormData.status,
      department: addFormData.department,
      createdAt: new Date().toISOString().split('T')[0],
    };
    
    addUser(newUser);
    
    toast.success('User added successfully', {
      description: `${addFormData.name} has been added to the system.`,
    });
    setIsAddDialogOpen(false);
    setAddFormData({
      name: '',
      email: '',
      role: 'student',
      status: 'active',
      department: '',
    });
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.department && user.department.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = activeTab === 'all' || user.role === activeTab;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'advisor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'faculty':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'counselor':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'student':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'advisor':
        return 'Academic Advisor';
      case 'faculty':
        return 'Faculty Member';
      case 'counselor':
        return 'Counselor';
      case 'student':
        return 'Student';
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return Shield;
      case 'advisor':
        return UserCog;
      case 'faculty':
        return Briefcase;
      case 'counselor':
        return Heart;
      case 'student':
        return GraduationCap;
      default:
        return Shield;
    }
  };

  // Render user list component
  const renderUserList = (roleUsers: UserType[]) => {
    if (roleUsers.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No users found in this category</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {roleUsers.map((user) => {
          const IconComponent = getRoleIcon(user.role);
          return (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  user.role === 'admin' ? 'bg-purple-100' :
                  user.role === 'advisor' ? 'bg-blue-100' :
                  user.role === 'faculty' ? 'bg-green-100' :
                  user.role === 'counselor' ? 'bg-orange-100' :
                  'bg-gray-100'
                }`}>
                  <IconComponent className={`h-6 w-6 ${
                    user.role === 'admin' ? 'text-purple-600' :
                    user.role === 'advisor' ? 'text-blue-600' :
                    user.role === 'faculty' ? 'text-green-600' :
                    user.role === 'counselor' ? 'text-orange-600' :
                    'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{user.name}</h3>
                    <Badge className={getRoleBadgeColor(user.role)}>{getRoleLabel(user.role)}</Badge>
                    <Badge
                      className={
                        user.status === 'active'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-gray-100 text-gray-800 border-gray-200'
                      }
                    >
                      {user.status || 'active'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      <span>{user.email}</span>
                    </div>
                    {user.department && (
                      <>
                        <span>•</span>
                        <span>{user.department}</span>
                      </>
                    )}
                    {user.createdAt && (
                      <>
                        <span>•</span>
                        <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => handleEditClick(user)}>
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
                <Button size="sm" variant="outline" className="gap-2 text-red-600 hover:text-red-600" onClick={() => handleDeleteClick(user)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === 'active').length,
    admins: users.filter((u) => u.role === 'admin').length,
    staff: users.filter((u) => u.role === 'advisor' || u.role === 'faculty' || u.role === 'counselor').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage system users and permissions</p>
        </div>
        <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add New User
        </Button>
      </div>

      {/* User Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Currently enabled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Administrators</CardDescription>
            <CardTitle className="text-3xl text-purple-600">{stats.admins}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Admin access</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Staff Members</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.staff}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Faculty & advisors</p>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
          <CardDescription>All system users and their access levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or department..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchParams({ query: e.target.value });
                }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="all">All Roles</TabsTrigger>
              <TabsTrigger value="admin">Administrators</TabsTrigger>
              <TabsTrigger value="faculty">Faculty</TabsTrigger>
              <TabsTrigger value="advisor">Advisors</TabsTrigger>
              <TabsTrigger value="counselor">Counselors</TabsTrigger>
              <TabsTrigger value="student">Students</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              {renderUserList(filteredUsers)}
            </TabsContent>
            <TabsContent value="admin">
              {renderUserList(filteredUsers.filter((u) => u.role === 'admin'))}
            </TabsContent>
            <TabsContent value="faculty">
              {renderUserList(filteredUsers.filter((u) => u.role === 'faculty'))}
            </TabsContent>
            <TabsContent value="advisor">
              {renderUserList(filteredUsers.filter((u) => u.role === 'advisor'))}
            </TabsContent>
            <TabsContent value="counselor">
              {renderUserList(filteredUsers.filter((u) => u.role === 'counselor'))}
            </TabsContent>
            <TabsContent value="student">
              {renderUserList(filteredUsers.filter((u) => u.role === 'student'))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="Enter user name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="Enter user email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value) => setEditFormData({ ...editFormData, role: value as UserType['role'] })}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="advisor">Academic Advisor</SelectItem>
                  <SelectItem value="faculty">Faculty Member</SelectItem>
                  <SelectItem value="counselor">Counselor</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value as 'active' | 'inactive' })}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department (Optional)</Label>
              <Select
                value={editFormData.department}
                onValueChange={(value) => setEditFormData({ ...editFormData, department: value })}
              >
                <SelectTrigger id="edit-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Name:</span>
              <span className="font-medium">{selectedUser?.name}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Email:</span>
              <span className="font-medium">{selectedUser?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Role:</span>
              <span className="font-medium">{selectedUser ? getRoleLabel(selectedUser.role) : ''}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Enter user information and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Name</Label>
              <Input
                id="add-name"
                value={addFormData.name}
                onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                placeholder="Enter user name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={addFormData.email}
                onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                placeholder="Enter user email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-role">Role</Label>
              <Select
                value={addFormData.role}
                onValueChange={(value) => setAddFormData({ ...addFormData, role: value as UserType['role'] })}
              >
                <SelectTrigger id="add-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="advisor">Academic Advisor</SelectItem>
                  <SelectItem value="faculty">Faculty Member</SelectItem>
                  <SelectItem value="counselor">Counselor</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-status">Status</Label>
              <Select
                value={addFormData.status}
                onValueChange={(value) => setAddFormData({ ...addFormData, status: value as 'active' | 'inactive' })}
              >
                <SelectTrigger id="add-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-department">Department (Optional)</Label>
              <Select
                value={addFormData.department}
                onValueChange={(value) => setAddFormData({ ...addFormData, department: value })}
              >
                <SelectTrigger id="add-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}