import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Search, Edit, UserPlus, UserCheck, UserX, Users, Upload } from 'lucide-react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { db, secondaryAuth } from '../../firebase';
import { BulkImportModal } from '../components/BulkImportModal';

interface Advisor {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  specialization: string;
  status: 'active' | 'inactive';
}

const DEPARTMENTS = [
  'Academic Services',
  'Student Services',
  'Computer Science',
  'Mathematics',
  'Engineering',
  'Business Administration',
  'Liberal Arts',
  'Natural Sciences',
];

const SPECIALISATIONS = [
  'First-Year Students',
  'Career Planning',
  'Academic Support',
  'Study Skills',
  'STEM Programs',
  'Graduate Planning',
  'Transfer Students',
  'International Students',
];

export default function AdminAdvisorsPage() {
  const [advisorList, setAdvisorList] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Add dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmployeeId, setAddEmployeeId] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addDepartment, setAddDepartment] = useState('');
  const [addSpecialisation, setAddSpecialisation] = useState('');
  const [addStatus, setAddStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAdvisor, setEditingAdvisor] = useState<Advisor | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editSpecialisation, setEditSpecialisation] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'advisors'), (snapshot) => {
      setAdvisorList(
        snapshot.docs.map((d) => ({
          id: d.id,
          employeeId: d.data().employeeId ?? '',
          name: d.data().name ?? '',
          email: d.data().email ?? '',
          department: d.data().department ?? '',
          specialization: Array.isArray(d.data().specialization)
            ? d.data().specialization[0] ?? ''
            : d.data().specialization ?? '',
          status: d.data().status ?? 'active',
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const stats = {
    total: advisorList.length,
    active: advisorList.filter((a) => a.status === 'active').length,
    inactive: advisorList.filter((a) => a.status === 'inactive').length,
  };

  const filtered = advisorList.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.employeeId.toLowerCase().includes(q) ||
      a.department.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openAddDialog = () => {
    setAddName(''); setAddEmployeeId(''); setAddEmail(''); setAddPassword('');
    setAddDepartment(''); setAddSpecialisation(''); setAddStatus('active');
    setIsAddOpen(true);
  };

  const handleAddAdvisor = async () => {
    if (!addName.trim() || !addEmployeeId.trim() || !addEmail.trim() || !addPassword.trim() || !addDepartment) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (addPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setIsSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, addEmail.trim(), addPassword.trim());
      await secondaryAuth.signOut();
      await addDoc(collection(db, 'advisors'), {
        employeeId: addEmployeeId.trim(),
        name: addName.trim(),
        email: addEmail.trim(),
        department: addDepartment,
        specialization: addSpecialisation ? [addSpecialisation] : [],
        status: addStatus,
        role: 'advisor',
        uid: cred.user.uid,
        studentsAssigned: 0,
        maxStudentCapacity: 40,
        joinedDate: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
      });
      toast.success('Advisor account created successfully');
      setIsAddOpen(false);
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

  const openEditDialog = (advisor: Advisor) => {
    setEditingAdvisor(advisor);
    setEditName(advisor.name);
    setEditEmail(advisor.email);
    setEditDepartment(advisor.department);
    setEditSpecialisation(advisor.specialization);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAdvisor || !editName.trim() || !editEmail.trim() || !editDepartment) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsEditSaving(true);
    try {
      await updateDoc(doc(db, 'advisors', editingAdvisor.id), {
        name: editName.trim(),
        email: editEmail.trim(),
        department: editDepartment,
        specialization: editSpecialisation ? [editSpecialisation] : [],
      });
      toast.success('Advisor updated successfully');
      setIsEditOpen(false);
      setEditingAdvisor(null);
    } catch {
      toast.error('Failed to update advisor. Please try again.');
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleToggleStatus = async (advisor: Advisor) => {
    const newStatus = advisor.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'advisors', advisor.id), { status: newStatus });
      toast.success(newStatus === 'active' ? 'Advisor activated' : 'Advisor deactivated');
    } catch {
      toast.error('Failed to update status. Please try again.');
    }
  };

  const handleBulkImport = async (rows: any[]) => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const row of rows) {
      if (!row.StaffID?.trim() || !row.FullName?.trim() || !row.Email?.trim()) {
        failed++;
        errors.push(`Row skipped — missing required fields (StaffID, FullName, or Email)`);
        continue;
      }
      const tempPassword = `${row.StaffID.trim()}@DropGuard`;
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, row.Email.trim(), tempPassword);
        await secondaryAuth.signOut();
        await addDoc(collection(db, 'advisors'), {
          employeeId: row.StaffID.trim(),
          name: row.FullName.trim(),
          email: row.Email.trim(),
          department: row.Department?.trim() ?? '',
          specialization: row.Specialisation?.trim() ? [row.Specialisation.trim()] : [],
          status: 'active',
          role: 'advisor',
          uid: cred.user.uid,
          studentsAssigned: 0,
          maxStudentCapacity: 40,
          joinedDate: new Date().toISOString().split('T')[0],
          mustChangePassword: true,
          createdAt: serverTimestamp(),
        });
        success++;
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          errors.push(`${row.Email.trim()} — email already in use`);
        } else {
          errors.push(`${row.StaffID} — ${err.message}`);
        }
        failed++;
      }
    }
    return { success, failed, errors };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advisor Management</h1>
          <p className="text-muted-foreground">Manage academic advisors and their assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setBulkImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Import CSV
          </Button>
          <Button className="gap-2" onClick={openAddDialog}>
            <UserPlus className="h-4 w-4" />
            Add Advisor
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Advisors</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{stats.total}</div>
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
            <div className="text-4xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive</CardTitle>
            <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
              <UserX className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground mt-1">Inactive accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Advisor Directory */}
      <Card>
        <CardHeader>
          <CardTitle>Advisor Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading advisors…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No advisors found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Employee ID</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Full Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Email</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Department</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((advisor) => (
                    <tr
                      key={advisor.id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{advisor.employeeId || '—'}</td>
                      <td className="px-4 py-3 font-medium">{advisor.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{advisor.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{advisor.department || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            advisor.status === 'active'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }
                        >
                          {advisor.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openEditDialog(advisor)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {advisor.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-600 hover:bg-red-50 border-red-200"
                              onClick={() => handleToggleStatus(advisor)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-600 hover:bg-green-50 border-green-200"
                              onClick={() => handleToggleStatus(advisor)}
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
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) { setAddName(''); setAddEmployeeId(''); setAddEmail(''); setAddPassword(''); setAddDepartment(''); setAddSpecialisation(''); setAddStatus('active'); } setIsAddOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Advisor</DialogTitle>
            <DialogDescription>Create a new academic advisor account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4" autoComplete="off">
            <input type="text" style={{ display: 'none' }} autoComplete="username" readOnly />
            <input type="password" style={{ display: 'none' }} autoComplete="current-password" readOnly />
            <div className="space-y-2">
              <Label htmlFor="add-empid">Employee ID <span className="text-red-500">*</span></Label>
              <Input id="add-empid" placeholder="e.g. EMP2024001" value={addEmployeeId} onChange={(e) => setAddEmployeeId(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-name">Full Name <span className="text-red-500">*</span></Label>
              <Input id="add-name" placeholder="Enter full name" value={addName} onChange={(e) => setAddName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email <span className="text-red-500">*</span></Label>
              <Input id="add-email" type="email" placeholder="Enter email address" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Temporary Password <span className="text-red-500">*</span></Label>
              <Input id="add-password" type="password" placeholder="Min. 6 characters" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-department">Department <span className="text-red-500">*</span></Label>
              <Select value={addDepartment} onValueChange={setAddDepartment}>
                <SelectTrigger id="add-department"><SelectValue placeholder="— Select —" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-spec">Specialisation</Label>
              <Select value={addSpecialisation} onValueChange={setAddSpecialisation}>
                <SelectTrigger id="add-spec"><SelectValue placeholder="— Select —" /></SelectTrigger>
                <SelectContent>
                  {SPECIALISATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <Button size="sm" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isSaving} onClick={handleAddAdvisor}>
              {isSaving ? 'Creating…' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) { setEditName(''); setEditEmail(''); setEditDepartment(''); setEditSpecialisation(''); setEditingAdvisor(null); } setIsEditOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Advisor</DialogTitle>
            <DialogDescription>Update the advisor's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name <span className="text-red-500">*</span></Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
              <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department <span className="text-red-500">*</span></Label>
              <Select value={editDepartment} onValueChange={setEditDepartment}>
                <SelectTrigger id="edit-department"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-spec">Specialisation</Label>
              <Select value={editSpecialisation} onValueChange={setEditSpecialisation}>
                <SelectTrigger id="edit-spec"><SelectValue placeholder="— Select —" /></SelectTrigger>
                <SelectContent>
                  {SPECIALISATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isEditSaving} onClick={handleSaveEdit}>
              {isEditSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import */}
      <BulkImportModal
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        role="advisor"
        onImport={handleBulkImport}
      />
    </div>
  );
}
