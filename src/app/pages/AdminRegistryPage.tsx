import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Search, UserPlus, Edit, Users, UserCheck, UserX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../../firebase';
import { FirebaseError } from 'firebase/app';

interface StaffUser {
  id: string;
  uid?: string;
  staffId: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  createdAt?: string;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function AdminRegistryPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addStaffId, setAddStaffId] = useState('');
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addStatus, setAddStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editStaffId, setEditStaffId] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [isEditSaving, setIsEditSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'registry'), (snap) => {
      setStaff(
        snap.docs.map((d) => ({
          id: d.id,
          uid: d.data().uid ?? undefined,
          staffId: d.data().staffId ?? '',
          name: d.data().name ?? '',
          email: d.data().email ?? '',
          status: d.data().status ?? 'active',
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? d.data().createdAt ?? undefined,
        })),
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const total = staff.length;
  const activeCount = staff.filter((u) => u.status === 'active').length;
  const inactiveCount = staff.filter((u) => u.status === 'inactive').length;

  const filtered = staff.filter((u) => {
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.staffId.toLowerCase().includes(q);
  });

  const openAddDialog = () => {
    setAddStaffId(''); setAddName(''); setAddEmail(''); setAddPassword(''); setAddStatus('active');
    setIsAddDialogOpen(true);
  };

  const handleAddStaff = async () => {
    if (!addStaffId.trim() || !addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, addEmail.trim(), addPassword.trim());
      await secondaryAuth.signOut();
      await addDoc(collection(db, 'registry'), {
        uid: cred.user.uid,
        staffId: addStaffId.trim(),
        name: addName.trim(),
        email: addEmail.trim(),
        role: 'registry',
        status: addStatus,
        createdAt: serverTimestamp(),
      });
      toast.success('Registry account created successfully');
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
    setEditStaffId(user.staffId);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditStatus(user.status);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !editStaffId.trim() || !editName.trim() || !editEmail.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsEditSaving(true);
    try {
      await updateDoc(doc(db, 'registry', editingUser.id), {
        staffId: editStaffId.trim(),
        name: editName.trim(),
        email: editEmail.trim(),
        status: editStatus,
      });
      toast.success('Account updated successfully');
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
      await updateDoc(doc(db, 'registry', user.id), { status: newStatus });
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
          <h1 className="text-3xl font-bold">Registry Management</h1>
          <p className="text-muted-foreground">Manage Registry department accounts</p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <UserPlus className="h-4 w-4" />
          Add Registry
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Registry Accounts</CardTitle>
            <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-gray-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive</CardTitle>
            <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
              <UserX className="h-5 w-5 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-gray-500">{inactiveCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Inactive accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registry Accounts</CardTitle>
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 max-w-sm"
                autoComplete="off"
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
              <p>No Registry accounts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Staff ID</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Email</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Created</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{user.staffId || '—'}</td>
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
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
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => openEditDialog(user)}>
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

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) { setAddStaffId(''); setAddName(''); setAddEmail(''); setAddPassword(''); setAddStatus('active'); } setIsAddDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Registry Account</DialogTitle>
            <DialogDescription>Create a new Registry account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4" autoComplete="off">
            <input type="text" style={{ display: 'none' }} autoComplete="username" readOnly />
            <input type="password" style={{ display: 'none' }} autoComplete="current-password" readOnly />
            <div className="space-y-2">
              <Label htmlFor="add-staffid">Staff ID <span className="text-red-500">*</span></Label>
              <Input id="add-staffid" placeholder="Enter ID" value={addStaffId} onChange={(e) => setAddStaffId(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-name">Full Name <span className="text-red-500">*</span></Label>
              <Input id="add-name" placeholder="Enter full name" value={addName} onChange={(e) => setAddName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email <span className="text-red-500">*</span></Label>
              <Input id="add-email" type="email" placeholder="Enter email address" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Temporary Password <span className="text-red-500">*</span></Label>
              <Input id="add-password" type="password" placeholder="Enter temporary password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-status">Status</Label>
              <Select value={addStatus} onValueChange={(v) => setAddStatus(v as 'active' | 'inactive')}>
                <SelectTrigger id="add-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isSaving} onClick={handleAddStaff}>
              {isSaving ? 'Creating…' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { if (!open) { setEditStaffId(''); setEditName(''); setEditEmail(''); setEditStatus('active'); setEditingUser(null); } setIsEditDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Registry Account</DialogTitle>
            <DialogDescription>Update this staff member's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4" autoComplete="off">
            <input type="text" style={{ display: 'none' }} autoComplete="username" readOnly />
            <input type="password" style={{ display: 'none' }} autoComplete="current-password" readOnly />
            <div className="space-y-2">
              <Label htmlFor="edit-staffid">Staff ID <span className="text-red-500">*</span></Label>
              <Input id="edit-staffid" placeholder="Enter ID" value={editStaffId} onChange={(e) => setEditStaffId(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name <span className="text-red-500">*</span></Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
              <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as 'active' | 'inactive')}>
                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isEditSaving} onClick={handleSaveEdit}>
              {isEditSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
