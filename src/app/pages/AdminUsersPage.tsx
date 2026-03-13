import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Search, UserPlus, Shield, Edit, Users, UserCog, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../../firebase';
import { FirebaseError } from 'firebase/app';

type StaffRole = 'admin' | 'sru' | 'registry';

interface StaffUser {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: StaffRole;
  status: 'active' | 'inactive';
  createdAt?: string;
}

const STAFF_ROLES: StaffRole[] = ['admin', 'sru', 'registry'];

const getRoleLabel = (role: StaffRole) => {
  switch (role) {
    case 'admin': return 'Admin';
    case 'sru': return 'SRU Staff';
    case 'registry': return 'Registry Staff';
  }
};

const getRoleBadge = (role: StaffRole) => {
  switch (role) {
    case 'admin':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">{getRoleLabel(role)}</Badge>;
    case 'sru':
      return <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs">{getRoleLabel(role)}</Badge>;
    case 'registry':
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">{getRoleLabel(role)}</Badge>;
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function AdminUsersPage() {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<StaffRole>('sru');
  const [addPassword, setAddPassword] = useState('');
  const [addStatus, setAddStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('sru');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Fetch staff-only users from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', 'in', STAFF_ROLES),
    );
    const unsub = onSnapshot(q, (snap) => {
      setStaffUsers(
        snap.docs.map((d) => ({
          id: d.id,
          uid: d.data().uid ?? undefined,
          name: d.data().name ?? '',
          email: d.data().email ?? '',
          role: (d.data().role as StaffRole) ?? 'sru',
          status: d.data().status ?? 'active',
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? d.data().createdAt ?? undefined,
        })),
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Summary counts
  const totalStaff = staffUsers.length;
  const sruCount = staffUsers.filter((u) => u.role === 'sru').length;
  const registryCount = staffUsers.filter((u) => u.role === 'registry').length;

  const filtered = staffUsers.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      getRoleLabel(u.role).toLowerCase().includes(q)
    );
  });

  const openAddDialog = () => {
    setAddName(''); setAddEmail(''); setAddRole('sru');
    setAddPassword(''); setAddStatus('active');
    setIsAddDialogOpen(true);
  };

  const handleAddStaff = async () => {
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, addEmail.trim(), addPassword.trim());
      await secondaryAuth.signOut();
      await addDoc(collection(db, 'users'), {
        uid: cred.user.uid,
        name: addName.trim(),
        email: addEmail.trim(),
        role: addRole,
        status: addStatus,
        createdAt: serverTimestamp(),
      });
      toast.success('Staff account created successfully');
      setIsAddDialogOpen(false);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/email-already-in-use') {
          toast.error('An account with this email already exists.');
        } else {
          toast.error(`Failed to create account: ${err.message}`);
        }
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (user: StaffUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !editName.trim() || !editEmail.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsEditSaving(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        status: editStatus,
      });
      toast.success('Staff account updated successfully');
      setIsEditDialogOpen(false);
      setEditingUser(null);
    } catch {
      toast.error('Failed to update account. Please try again.');
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleToggleStatus = async (user: StaffUser) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'users', user.id), { status: newStatus });
      toast.success(`${user.name} set to ${newStatus}`);
    } catch {
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage staff accounts — Admin, SRU, and Registry</p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <UserPlus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{totalStaff}</div>
            <p className="text-xs text-muted-foreground mt-1">All staff accounts</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SRU Staff</CardTitle>
            <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-teal-600">{sruCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Student Records Unit</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Registry Staff</CardTitle>
            <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">{registryCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Registry department</p>
          </CardContent>
        </Card>
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Accounts</CardTitle>
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 max-w-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No staff accounts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Email</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Role</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Created</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800 border-green-200 text-xs'
                              : 'bg-gray-100 text-gray-600 border-gray-200 text-xs'
                          }
                        >
                          {user.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {user.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-orange-600 hover:text-orange-600 hover:bg-orange-50"
                              onClick={() => handleToggleStatus(user)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-green-600 hover:text-green-600 hover:bg-green-50"
                              onClick={() => handleToggleStatus(user)}
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Account</DialogTitle>
            <DialogDescription>Create a new staff account in the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Full Name <span className="text-red-500">*</span></Label>
              <Input
                id="add-name"
                placeholder="e.g. Sarah Johnson"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">IIT Email <span className="text-red-500">*</span></Label>
              <Input
                id="add-email"
                type="email"
                placeholder="s.johnson@iit.ac.lk"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-role">Role <span className="text-red-500">*</span></Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as StaffRole)}>
                <SelectTrigger id="add-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sru">SRU Staff</SelectItem>
                  <SelectItem value="registry">Registry Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Temporary Password <span className="text-red-500">*</span></Label>
              <Input
                id="add-password"
                type="password"
                placeholder="Minimum 6 characters"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-status">Status</Label>
              <Select value={addStatus} onValueChange={(v) => setAddStatus(v as 'active' | 'inactive')}>
                <SelectTrigger id="add-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={isSaving} onClick={handleAddStaff}>
              {isSaving ? 'Creating…' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Staff Account</DialogTitle>
            <DialogDescription>Update this staff member's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name <span className="text-red-500">*</span></Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as StaffRole)}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sru">SRU Staff</SelectItem>
                  <SelectItem value="registry">Registry Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as 'active' | 'inactive')}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={isEditSaving} onClick={handleSaveEdit}>
              {isEditSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
