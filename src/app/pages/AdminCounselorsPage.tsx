import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, Heart, Mail, Phone, Plus, Edit, Trash2, Download, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Checkbox } from '../components/ui/checkbox';
import { db, secondaryAuth } from '../../firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

interface Counselor {
  id: string;
  name: string;
  email: string;
  password: string;
  employeeId: string;
  department: string;
  phone: string;
  status: 'active' | 'inactive';
  casesAssigned: number;
  specialization: string[];
  maxCaseLoad: number;
  availabilityDays: string[];
  joinedDate: string;
}

const allDepartments = [
  'Student Services',
  'Health Services',
  'Counseling Center',
  'Wellness Center',
  'Mental Health Services',
];

export default function AdminCounselorsPage() {
  const [counselorList, setCounselorList] = useState<Counselor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit dialog
  const [editingCounselor, setEditingCounselor] = useState<Counselor | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editSpecialization, setEditSpecialization] = useState('');
  const [editJoinedDate, setEditJoinedDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Add dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addEmployeeId, setAddEmployeeId] = useState('');
  const [addDepartment, setAddDepartment] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addStatus, setAddStatus] = useState<'active' | 'inactive'>('active');
  const [addSpecialization, setAddSpecialization] = useState('');
  const [addMaxCaseLoad, setAddMaxCaseLoad] = useState('');
  const [addAvailabilityDays, setAddAvailabilityDays] = useState<string[]>([]);
  const [addConfidentialityAgreement, setAddConfidentialityAgreement] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  // View dialog
  const [viewingCounselor, setViewingCounselor] = useState<Counselor | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Delete dialog
  const [deletingCounselor, setDeletingCounselor] = useState<Counselor | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Real-time listener for counselors from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'counselors'), (snapshot) => {
      const counselors: Counselor[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name ?? '',
          email: d.email ?? '',
          password: d.password ?? '',
          employeeId: d.employeeId ?? '',
          department: d.department ?? '',
          phone: d.phone ?? '',
          status: d.status ?? 'active',
          casesAssigned: d.casesAssigned ?? 0,
          specialization: d.specialization ?? [],
          maxCaseLoad: d.maxCaseLoad ?? 0,
          availabilityDays: d.availabilityDays ?? [],
          joinedDate: d.joinedDate ?? '',
        };
      });
      setCounselorList(counselors);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredCounselors = counselorList.filter((counselor) => {
    const matchesSearch =
      counselor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      counselor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      counselor.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || counselor.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || counselor.status === statusFilter;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const stats = {
    total: counselorList.length,
    active: counselorList.filter((c) => c.status === 'active').length,
    totalCases: counselorList.reduce((sum, c) => sum + c.casesAssigned, 0),
    avgCasesPerCounselor:
      counselorList.length > 0
        ? Math.round(counselorList.reduce((sum, c) => sum + c.casesAssigned, 0) / counselorList.length)
        : 0,
  };

  // ── Add Counselor ─────────────────────────────────────────────────────────────
  const handleAddCounselor = async () => {
    if (!addName || !addEmployeeId || !addEmail || !addPassword || !addPhone || !addDepartment || !addSpecialization || !addMaxCaseLoad) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (addAvailabilityDays.length === 0) {
      toast.error('Please select at least one availability day');
      return;
    }
    if (!addConfidentialityAgreement) {
      toast.error('Please acknowledge the confidentiality agreement');
      return;
    }
    if (addPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setAddSaving(true);
    try {
      // 1. Create Firebase Auth account (secondaryAuth keeps admin signed in)
      await createUserWithEmailAndPassword(secondaryAuth, addEmail, addPassword);

      // 2. Save to Firestore counselors collection
      await addDoc(collection(db, 'counselors'), {
        name: addName,
        email: addEmail,
        password: addPassword,
        employeeId: addEmployeeId,
        department: addDepartment,
        phone: addPhone,
        status: addStatus,
        casesAssigned: 0,
        specialization: [addSpecialization],
        maxCaseLoad: parseInt(addMaxCaseLoad),
        availabilityDays: addAvailabilityDays,
        joinedDate: new Date().toISOString().split('T')[0],
        role: 'counselor',
        createdAt: serverTimestamp(),
      });

      toast.success('Counselor added successfully');
      setIsAddDialogOpen(false);
      resetAddForm();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists');
      } else {
        toast.error(err.message ?? 'Failed to add counselor');
      }
    } finally {
      setAddSaving(false);
    }
  };

  const resetAddForm = () => {
    setAddName('');
    setAddEmployeeId('');
    setAddEmail('');
    setAddPassword('');
    setAddPhone('');
    setAddDepartment('');
    setAddSpecialization('');
    setAddMaxCaseLoad('');
    setAddAvailabilityDays([]);
    setAddConfidentialityAgreement(false);
    setAddStatus('active');
  };

  // ── Edit Counselor ────────────────────────────────────────────────────────────
  const handleEditClick = (counselor: Counselor) => {
    setEditingCounselor(counselor);
    setEditName(counselor.name);
    setEditEmail(counselor.email);
    setEditDepartment(counselor.department);
    setEditPhone(counselor.phone);
    setEditStatus(counselor.status);
    setEditSpecialization(counselor.specialization.join(', '));
    setEditJoinedDate(counselor.joinedDate);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName || !editEmail || !editDepartment || !editPhone) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!editingCounselor) return;

    setEditSaving(true);
    try {
      const specializationArray = editSpecialization
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await updateDoc(doc(db, 'counselors', editingCounselor.id), {
        name: editName,
        email: editEmail,
        department: editDepartment,
        phone: editPhone,
        status: editStatus,
        specialization: specializationArray,
        joinedDate: editJoinedDate,
      });

      toast.success('Counselor updated successfully');
      setIsEditDialogOpen(false);
      setEditingCounselor(null);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message ?? 'Failed to update counselor');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete Counselor ──────────────────────────────────────────────────────────
  const handleDeleteClick = (counselor: Counselor) => {
    setDeletingCounselor(counselor);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCounselor = async () => {
    if (!deletingCounselor) return;

    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'counselors', deletingCounselor.id));
      toast.success('Counselor deleted successfully');
      setIsDeleteDialogOpen(false);
      setDeletingCounselor(null);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message ?? 'Failed to delete counselor');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = ['Name', 'Email', 'Employee ID', 'Department', 'Phone', 'Status', 'Cases Assigned', 'Max Case Load', 'Specialization', 'Availability Days', 'Joined Date'];
    const csvData = filteredCounselors.map((c) => [
      c.name, c.email, c.employeeId, c.department, c.phone, c.status,
      c.casesAssigned, c.maxCaseLoad, c.specialization.join('; '),
      c.availabilityDays.join('; '), c.joinedDate,
    ]);
    const csvContent = [
      headers.join(','),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `counselors_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Counselor data exported successfully');
  };

  const toggleAvailabilityDay = (day: string) => {
    setAddAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Counselor Management</h1>
          <p className="text-muted-foreground">Manage counselors and their case assignments</p>
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
            <CardDescription>Total Counselors</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All departments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Counselors</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Currently available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Cases Assigned</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{stats.totalCases}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Total across all counselors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg per Counselor</CardDescription>
            <CardTitle className="text-3xl">{stats.avgCasesPerCounselor}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Cases assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Counselor List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Counselor Directory</CardTitle>
            <CardDescription>All counselors in the system</CardDescription>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              resetAddForm();
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Counselor
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
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by department">
                  {departmentFilter === 'all' ? 'All Departments' : departmentFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {allDepartments.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCounselors.map((counselor) => (
                <div
                  key={counselor.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                        <Heart className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{counselor.name}</h3>
                          <Badge
                            className={
                              counselor.status === 'active'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-gray-100 text-gray-800 border-gray-200'
                            }
                          >
                            {counselor.status}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>{counselor.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{counselor.phone}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="font-medium">Department:</span>{' '}
                            <span className="text-muted-foreground">{counselor.department}</span>
                          </div>
                          <div>
                            <span className="font-medium">Cases:</span>{' '}
                            <span className="text-muted-foreground">{counselor.casesAssigned}</span>
                          </div>
                          <div>
                            <span className="font-medium">Max Load:</span>{' '}
                            <span className="text-muted-foreground">{counselor.maxCaseLoad}</span>
                          </div>
                          <div>
                            <span className="font-medium">Specialization:</span>{' '}
                            <span className="text-muted-foreground">{counselor.specialization.join(', ')}</span>
                          </div>
                        </div>
                        {counselor.availabilityDays.length > 0 && (
                          <div className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">Available:</span>{' '}
                            {counselor.availabilityDays.join(', ')}
                          </div>
                        )}
                        {counselor.joinedDate && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Joined {new Date(counselor.joinedDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => handleEditClick(counselor)}>
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setViewingCounselor(counselor); setIsViewDialogOpen(true); }}>
                        View Details
                      </Button>
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => handleDeleteClick(counselor)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredCounselors.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No counselors found matching your search</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Counselor</DialogTitle>
            <DialogDescription>Add a new counselor to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
                <Input id="fullName" placeholder="e.g. Dr. Emily Watson" value={addName} onChange={(e) => setAddName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID <span className="text-red-500">*</span></Label>
                <Input id="employeeId" placeholder="e.g. EMP2022088" value={addEmployeeId} onChange={(e) => setAddEmployeeId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailAddress">Email Address <span className="text-red-500">*</span></Label>
                <Input id="emailAddress" type="email" placeholder="name@university.edu" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                <Input id="password" type="password" placeholder="Min. 6 characters" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number <span className="text-red-500">*</span></Label>
                <Input id="contactNumber" type="tel" placeholder="+1 (555) 000-0000" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department <span className="text-red-500">*</span></Label>
                <Select value={addDepartment} onValueChange={setAddDepartment}>
                  <SelectTrigger><SelectValue placeholder="— Select —" /></SelectTrigger>
                  <SelectContent>
                    {allDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialisation">Counselling Specialisation <span className="text-red-500">*</span></Label>
                <Select value={addSpecialization} onValueChange={setAddSpecialization}>
                  <SelectTrigger><SelectValue placeholder="— Select —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mental Health">Mental Health</SelectItem>
                    <SelectItem value="Stress Management">Stress Management</SelectItem>
                    <SelectItem value="Crisis Intervention">Crisis Intervention</SelectItem>
                    <SelectItem value="Grief Counseling">Grief Counseling</SelectItem>
                    <SelectItem value="Anxiety & Depression">Anxiety & Depression</SelectItem>
                    <SelectItem value="Relationship Issues">Relationship Issues</SelectItem>
                    <SelectItem value="Academic Stress">Academic Stress</SelectItem>
                    <SelectItem value="Career Counseling">Career Counseling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxCaseLoad">Max Case Load <span className="text-red-500">*</span></Label>
                <Input id="maxCaseLoad" type="number" placeholder="e.g. 20" value={addMaxCaseLoad} onChange={(e) => setAddMaxCaseLoad(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="status">Status</Label>
                <Select value={addStatus} onValueChange={(value: 'active' | 'inactive') => setAddStatus(value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Availability Days */}
            <div className="space-y-2">
              <Label>Availability Days <span className="text-red-500">*</span></Label>
              <div className="flex flex-wrap gap-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={addAvailabilityDays.includes(day) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleAvailabilityDay(day)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>

            {/* Confidentiality Agreement */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="confidentiality"
                checked={addConfidentialityAgreement}
                onCheckedChange={(checked) => setAddConfidentialityAgreement(checked as boolean)}
              />
              <label
                htmlFor="confidentiality"
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I acknowledge the confidentiality agreement for handling student mental health data.{' '}
                <span className="text-red-500">*</span>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={addSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddCounselor} disabled={addSaving}>
              {addSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : 'Add Counselor'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Counselor</DialogTitle>
            <DialogDescription>Update the details of the counselor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Enter name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Enter email" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={editDepartment} onValueChange={setEditDepartment}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {allDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Enter phone number" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(value: 'active' | 'inactive') => setEditStatus(value)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input value={editSpecialization} onChange={(e) => setEditSpecialization(e.target.value)} placeholder="Comma-separated specializations" />
            </div>
            <div className="space-y-2">
              <Label>Joined Date</Label>
              <Input type="date" value={editJoinedDate} onChange={(e) => setEditJoinedDate(e.target.value)} />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Counselor Details</DialogTitle>
            <DialogDescription>View the details of the counselor</DialogDescription>
          </DialogHeader>
          {viewingCounselor && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={viewingCounselor.name} readOnly /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={viewingCounselor.email} readOnly /></div>
              <div className="space-y-2"><Label>Employee ID</Label><Input value={viewingCounselor.employeeId} readOnly /></div>
              <div className="space-y-2"><Label>Department</Label><Input value={viewingCounselor.department} readOnly /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={viewingCounselor.phone} readOnly /></div>
              <div className="space-y-2"><Label>Status</Label><Input value={viewingCounselor.status} readOnly /></div>
              <div className="space-y-2"><Label>Specialization</Label><Input value={viewingCounselor.specialization.join(', ')} readOnly /></div>
              <div className="space-y-2"><Label>Max Case Load</Label><Input value={viewingCounselor.maxCaseLoad} readOnly /></div>
              <div className="space-y-2"><Label>Cases Assigned</Label><Input value={viewingCounselor.casesAssigned} readOnly /></div>
              <div className="space-y-2"><Label>Availability Days</Label><Input value={viewingCounselor.availabilityDays.join(', ')} readOnly /></div>
              <div className="space-y-2"><Label>Joined Date</Label><Input type="date" value={viewingCounselor.joinedDate} readOnly /></div>
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Counselor</DialogTitle>
            <DialogDescription>Are you sure you want to delete this counselor? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {deletingCounselor && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={deletingCounselor.name} readOnly /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={deletingCounselor.email} readOnly /></div>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDeleteCounselor} disabled={deleteLoading}>
              {deleteLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</> : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
