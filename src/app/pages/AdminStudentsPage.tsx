import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  Edit,
  UserPlus,
  UserCheck,
  UserX,
  Users,
  Loader2,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  query,
  getDocs,
  where,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import emailjs from '@emailjs/browser';
import { db, secondaryAuth } from "../../firebase";
import { FirebaseError } from "firebase/app";

interface StudentRecord {
  id: string;
  studentId: string;
  name: string;
  email: string;
  faculty: string;
  programme: string;
  level: string;
  status: string;
  accountActivated: boolean;
}

const LEVEL_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const STATUS_OPTIONS = ['active', 'inactive', 'pending', 'withdrawn', 'deferred', 'suspended', 'graduated'];
const STUDENTS_PER_PAGE = 20;


export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterFaculty, setFilterFaculty] = useState('all');
  const [filterProgramme, setFilterProgramme] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Add dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formStudentId, setFormStudentId] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formFaculty, setFormFaculty] = useState('');
  const [formProgramme, setFormProgramme] = useState('');
  const [formLevel, setFormLevel] = useState('');
  const [formStatus, setFormStatus] = useState<string>('active');
  const [autoFilled, setAutoFilled] = useState(false);
  const [studentNotFound, setStudentNotFound] = useState(false);
  const [foundStudentDocId, setFoundStudentDocId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editLevel, setEditLevel] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Bulk activate pending accounts
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateProgress, setActivateProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? d.id,
          name: d.data().name ?? '',
          email: d.data().email ?? '',
          faculty: d.data().faculty ?? '',
          programme: d.data().programme ?? '',
          level: d.data().level ?? '',
          status: d.data().status ?? 'active',
          accountActivated: d.data().accountActivated ?? false,
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Auto-fill from studentId lookup
  useEffect(() => {
    if (!formStudentId || formStudentId.length < 3) {
      setAutoFilled(false);
      setStudentNotFound(false);
      return;
    }
    const timer = setTimeout(async () => {
      const snap = await getDocs(query(collection(db, 'students'), where('studentId', '==', formStudentId.trim())));
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setFoundStudentDocId(snap.docs[0].id);
        setFormName(data.name ?? '');
        setFormEmail(data.email ?? '');
        setFormFaculty(data.faculty ?? '');
        setFormProgramme(data.programme ?? '');
        setFormLevel(data.level ?? '');
        setAutoFilled(true);
        setStudentNotFound(false);
      } else {
        setAutoFilled(false);
        setStudentNotFound(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formStudentId]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, filterFaculty, filterProgramme, filterLevel]);

  // Unique faculty options
  const facultyOptions = useMemo(() => {
    const vals = Array.from(new Set(students.map((s) => s.faculty).filter(Boolean))).sort();
    return vals;
  }, [students]);

  // Programme options — filtered by selected faculty
  const programmeOptions = useMemo(() => {
    const base = filterFaculty && filterFaculty !== 'all'
      ? students.filter((s) => s.faculty === filterFaculty)
      : students;
    return Array.from(new Set(base.map((s) => s.programme).filter(Boolean))).sort();
  }, [students, filterFaculty]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchesFaculty = filterFaculty === 'all' || s.faculty === filterFaculty;
      const matchesProgramme = filterProgramme === 'all' || s.programme === filterProgramme;
      const matchesLevel = filterLevel === 'all' || s.level === filterLevel;
      return matchesSearch && matchesStatus && matchesFaculty && matchesProgramme && matchesLevel;
    });
  }, [students, searchQuery, statusFilter, filterFaculty, filterProgramme, filterLevel]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE));
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * STUDENTS_PER_PAGE,
    currentPage * STUDENTS_PER_PAGE
  );

  const stats = {
    total: students.length,
    active: students.filter((s) => s.status === 'active').length,
    inactive: students.filter((s) => s.status === 'inactive').length,
  };

  const resetAddDialog = () => {
    setFormStudentId(''); setFormName(''); setFormEmail('');
    setFormFaculty(''); setFormProgramme(''); setFormLevel('');
    setFormStatus('active');
    setAutoFilled(false); setStudentNotFound(false); setFoundStudentDocId('');
  };

  const openAddDialog = () => {
    resetAddDialog();
    setIsAddOpen(true);
  };

  const handleAddStudent = async () => {
    if (!autoFilled || !foundStudentDocId) {
      toast.error('Search for a valid Student ID first');
      return;
    }
    const tempPassword = `${formStudentId.trim()}@DropGuard`;
    setIsSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, formEmail, tempPassword);
      await secondaryAuth.signOut();
      await updateDoc(doc(db, 'students', foundStudentDocId), {
        uid: cred.user.uid,
        status: formStatus,
        mustChangePassword: true,
      });
      await emailjs.send(
        'service_y8aewpn',
        'template_welcome',
        {
          to_name: formName,
          to_email: formEmail,
          user_id: formStudentId.trim(),
          temp_password: tempPassword,
          login_url: 'http://localhost:5173',
        },
        'pqfkLZ1zbahk5O2Vi'
      );
      toast.success(`Account created for ${formName}. Login details sent to ${formEmail}`);
      setIsAddOpen(false);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/email-already-in-use') {
          toast.error('A login account for this email already exists.');
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

  const openEditDialog = (student: StudentRecord) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditStudentId(student.studentId);
    setEditEmail(student.email);
    setEditStatus(student.status || 'active');
    setEditLevel(student.level || '');
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent || !editName.trim() || !editStudentId.trim() || !editEmail.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsEditSaving(true);
    try {
      await updateDoc(doc(db, 'students', editingStudent.id), {
        name: editName.trim(),
        studentId: editStudentId.trim(),
        email: editEmail.trim(),
        status: editStatus,
        level: editLevel,
      });
      toast.success('Student account updated successfully');
      setIsEditOpen(false);
      setEditingStudent(null);
    } catch {
      toast.error('Failed to update student. Please try again.');
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleToggleStatus = async (student: StudentRecord) => {
    const newStatus = student.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'students', student.id), { status: newStatus });
      if (newStatus === 'active') {
        try {
          await emailjs.send('service_y8aewpn', 'template_welcome', {
            to_name: student.name,
            to_email: student.email,
            student_id: student.studentId,
            password: `${student.studentId}@DropGuard`,
          }, 'pqfkLZ1zbahk5O2Vi');
        } catch (emailErr) {
          console.warn('Welcome email could not be sent');
        }
        toast.success('Student account activated and welcome email sent.');
      } else {
        toast.success('Student account deactivated.');
      }
    } catch {
      toast.error('Failed to update status. Please try again.');
    }
  };

  const handleActivatePending = async () => {
    const pending = students.filter((s) => !s.accountActivated || s.status !== 'active');
    if (pending.length === 0) {
      toast.info('No pending students to activate.');
      setActivateConfirmOpen(false);
      return;
    }
    setActivating(true);
    setActivateConfirmOpen(false);
    setActivateProgress({ current: 0, total: pending.length });
    let succeeded = 0;

    for (let i = 0; i < pending.length; i++) {
      const student = pending[i];
      setActivateProgress({ current: i + 1, total: pending.length });
      const tempPassword = `${student.studentId}@DropGuard`;
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, student.email, tempPassword);
        await secondaryAuth.signOut();
        await updateDoc(doc(db, 'students', student.id), {
          uid: cred.user.uid,
          status: 'active',
          accountActivated: true,
          mustChangePassword: true,
        });
        try {
          await emailjs.send('service_y8aewpn', 'template_welcome', {
            to_name: student.name,
            to_email: student.email,
            student_id: student.studentId,
            password: tempPassword,
          }, 'pqfkLZ1zbahk5O2Vi');
        } catch (emailErr) {
          console.warn('Welcome email could not be sent');
        }
        succeeded++;
      } catch (err) {
        if (err instanceof FirebaseError && err.code === 'auth/email-already-in-use') {
          await updateDoc(doc(db, 'students', student.id), {
            status: 'active',
            accountActivated: true,
          });
          succeeded++;
        } else {
          console.warn('Failed to activate student account');
        }
      }
    }

    setActivating(false);
    setActivateProgress(null);
    toast.success(`${succeeded} account${succeeded !== 1 ? 's' : ''} activated successfully.`);
  };

  const pendingCount = students.filter((s) => !s.accountActivated || s.status !== 'active').length;
  const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * STUDENTS_PER_PAGE, filteredStudents.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground">Manage student accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setActivateConfirmOpen(true)}
            disabled={activating || pendingCount === 0}
          >
            {activating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {activateProgress
                  ? `Activating ${activateProgress.current} of ${activateProgress.total}…`
                  : 'Activating…'}
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Activate Pending
                {pendingCount > 0 && (
                  <span className="ml-1 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </>
            )}
          </Button>
          <Button className="gap-2" onClick={openAddDialog}>
            <UserPlus className="h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
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

      {/* Student Directory */}
      <Card>
        <CardHeader>
          <CardTitle>Student Directory</CardTitle>
          <CardDescription>Manage all students and their accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterFaculty} onValueChange={(v) => { setFilterFaculty(v); setFilterProgramme('all'); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Faculties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Faculties</SelectItem>
                {facultyOptions.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterProgramme} onValueChange={setFilterProgramme}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Programmes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programmes</SelectItem>
                {programmeOptions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {LEVEL_OPTIONS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading students…
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No students found matching your criteria</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Full Name</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Email</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Faculty</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Level</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => (
                      <tr key={student.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{student.studentId}</td>
                        <td className="px-4 py-3 font-medium">{student.name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{student.email}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">{student.faculty || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate">{student.programme || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{student.level || '—'}</td>
                        <td className="px-4 py-3">
                          {student.status === 'active' && student.accountActivated ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Active</Badge>
                          ) : student.status === 'active' && !student.accountActivated ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Pending Activation</Badge>
                          ) : student.status === 'inactive' ? (
                            <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">Inactive</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs capitalize">
                              {student.status || '—'}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => openEditDialog(student)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            {student.status === 'active' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-600 hover:bg-red-50 border-red-200"
                                onClick={() => handleToggleStatus(student)}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-600 hover:bg-green-50 border-green-200"
                                onClick={() => handleToggleStatus(student)}
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

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm text-muted-foreground">
                <span>
                  Showing {filteredStudents.length === 0 ? 0 : startIndex}–{endIndex} of {filteredStudents.length} students
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Activate Pending Confirmation Dialog */}
      <Dialog open={activateConfirmOpen} onOpenChange={setActivateConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Activate Pending Accounts</DialogTitle>
            <DialogDescription>
              {pendingCount} student{pendingCount !== 1 ? 's are' : ' is'} pending activation. Create Firebase Auth accounts and send welcome emails to all of them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setActivateConfirmOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleActivatePending}>
              Confirm &amp; Activate All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) resetAddDialog(); setIsAddOpen(open); }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Activate Student Account</DialogTitle>
            <DialogDescription>Enter a Student ID to look up their details.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="space-y-2">
              <Label htmlFor="form-studentId">Student ID <span className="text-red-500">*</span></Label>
              <Input
                id="form-studentId"
                autoComplete="off"
                placeholder="e.g. STU2024001"
                value={formStudentId}
                onChange={(e) => {
                  setFormStudentId(e.target.value);
                  setAutoFilled(false);
                  setStudentNotFound(false);
                }}
              />
            </div>

            {studentNotFound && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                ✗ Student ID not found in the system
              </div>
            )}

            {autoFilled && (
              <>
                <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700 font-medium">
                  ✓ Student found — details auto-filled
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Full Name', value: formName, id: 'form-name' },
                    { label: 'Email', value: formEmail, id: 'form-email' },
                    { label: 'Faculty', value: formFaculty, id: 'form-faculty' },
                    { label: 'Programme', value: formProgramme, id: 'form-programme' },
                    { label: 'Level / Year', value: formLevel, id: 'form-level' },
                  ].map(({ label, value, id }) => (
                    <div key={id} className="space-y-1">
                      <Label htmlFor={id} className="text-sm">{label}</Label>
                      <Input
                        id={id}
                        value={value}
                        readOnly
                        placeholder="—"
                        className="bg-gray-50 text-muted-foreground cursor-default"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form-status">Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger id="form-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button size="sm" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            {autoFilled && (
              <Button size="sm" disabled={isSaving} onClick={handleAddStudent}>
                {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create Account & Send Email'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditName(''); setEditStudentId(''); setEditEmail('');
            setEditStatus('active'); setEditLevel(''); setEditingStudent(null);
          }
          setIsEditOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update the student's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input type="text" style={{ display: 'none' }} autoComplete="username" readOnly />
            <input type="password" style={{ display: 'none' }} autoComplete="current-password" readOnly />
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name <span className="text-red-500">*</span></Label>
              <Input id="edit-name" autoComplete="off" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-studentId">Student ID <span className="text-red-500">*</span></Label>
              <Input id="edit-studentId" autoComplete="off" value={editStudentId} onChange={(e) => setEditStudentId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
              <Input id="edit-email" type="email" autoComplete="off" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-level">Level / Year</Label>
              <Select value={editLevel} onValueChange={setEditLevel}>
                <SelectTrigger id="edit-level"><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isEditSaving} onClick={handleSaveEdit}>
              {isEditSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
