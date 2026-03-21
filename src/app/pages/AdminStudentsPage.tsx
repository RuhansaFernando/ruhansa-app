import { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
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
  Upload,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, secondaryAuth } from "../../firebase";
import { FirebaseError } from "firebase/app";
import { BulkImportModal } from "../components/BulkImportModal";

interface StudentRecord {
  id: string;
  studentId: string;
  name: string;
  email: string;
  faculty: string;
  programme: string;
  level: string;
  status: "active" | "inactive";
  riskLevel: string;
  riskScore: number;
  gpa: number;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addStudentId, setAddStudentId] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addConfirmPassword, setAddConfirmPassword] = useState("");
  const [addStatus, setAddStatus] = useState<"active" | "inactive">("active");
  const [isSaving, setIsSaving] = useState(false);

  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editStudentId, setEditStudentId] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Bulk import
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Mentor assignment
  const [mentorAssignOpen, setMentorAssignOpen] = useState(false);
  const [mentorHeaders, setMentorHeaders] = useState<string[]>([]);
  const [mentorData, setMentorData] = useState<any[]>([]);
  const [mentorMapping, setMentorMapping] = useState<{ studentId: string; mentorName: string }>({ studentId: '', mentorName: '' });
  const [mentorSubmitting, setMentorSubmitting] = useState(false);
  const [mentorResult, setMentorResult] = useState<{ updated: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "students"), orderBy("name")),
      (snap) => {
        setStudents(
          snap.docs.map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? d.id,
            name: d.data().name ?? "",
            email: d.data().email ?? "",
            faculty: d.data().faculty ?? "",
            programme: d.data().programme ?? "",
            level: d.data().level ?? "",
            status: d.data().status ?? "active",
            riskLevel: d.data().riskLevel ?? "low",
            riskScore: d.data().riskScore ?? 0,
            gpa: d.data().gpa ?? 0,
          }))
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [students, searchQuery, statusFilter]);

  const stats = {
    total: students.length,
    active: students.filter((s) => s.status === "active").length,
    inactive: students.filter((s) => s.status === "inactive").length,
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-100 text-red-800 border-red-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const openAddDialog = () => {
    setAddName(""); setAddStudentId(""); setAddEmail("");
    setAddPassword(""); setAddConfirmPassword(""); setAddStatus("active");
    setIsAddOpen(true);
  };

  const handleAddStudent = async () => {
    if (!addName.trim() || !addStudentId.trim() || !addEmail.trim() || !addPassword) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (addPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setIsSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, addEmail.trim(), addPassword);
      await secondaryAuth.signOut();
      await setDoc(doc(db, "students", addStudentId.trim()), {
        name: addName.trim(),
        studentId: addStudentId.trim(),
        email: addEmail.trim(),
        uid: cred.user.uid,
        status: addStatus,
        role: "student",
        faculty: "",
        programme: "",
        level: "",
        intake: "",
        academicMentor: "",
        gpa: 0,
        attendancePercentage: 0,
        consecutiveAbsences: 0,
        riskLevel: "low",
        riskScore: 0,
        flagged: false,
        gender: "",
        dateOfBirth: "",
        contactNumber: "",
        enrollmentDate: "",
        createdAt: serverTimestamp(),
      });
      toast.success("Student account created successfully");
      setIsAddOpen(false);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/email-already-in-use") {
          toast.error("An account with this email already exists.");
        } else {
          toast.error(`Failed to create account: ${err.message}`);
        }
      } else {
        toast.error("An unexpected error occurred. Please try again.");
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
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent || !editName.trim() || !editStudentId.trim() || !editEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsEditSaving(true);
    try {
      await updateDoc(doc(db, "students", editingStudent.id), {
        name: editName.trim(),
        studentId: editStudentId.trim(),
        email: editEmail.trim(),
      });
      toast.success("Student account updated successfully");
      setIsEditOpen(false);
      setEditingStudent(null);
    } catch {
      toast.error("Failed to update student. Please try again.");
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleToggleStatus = async (student: StudentRecord) => {
    const newStatus = student.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "students", student.id), { status: newStatus });
      toast.success(newStatus === "active" ? "Student account activated" : "Student account deactivated");
    } catch {
      toast.error("Failed to update status. Please try again.");
    }
  };

  const handleBulkImport = async (rows: any[]) => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.StudentID?.trim() || !row.FullName?.trim() || !row.Email?.trim()) {
        failed++;
        errors.push(`Row skipped — missing required fields (StudentID, FullName, or Email)`);
        continue;
      }
      const studentId = row.StudentID.trim();
      const tempPassword = `${studentId}@DropGuard`;
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, row.Email.trim(), tempPassword);
        await secondaryAuth.signOut();
        await setDoc(doc(db, "students", studentId), {
          studentId,
          name: row.FullName.trim(),
          email: row.Email.trim(),
          uid: cred.user.uid,
          status: "active",
          role: "student",
          faculty: row.Faculty?.trim() ?? "",
          programme: row.Programme?.trim() ?? "",
          level: row.Level?.trim() ?? "",
          intake: row.Intake?.trim() ?? "",
          gender: row.Gender?.trim() ?? "",
          contactNumber: row.ContactNumber?.trim() ?? "",
          enrollmentDate: row.EnrollmentDate?.trim() ?? "",
          academicMentor: "",
          gpa: 0,
          attendancePercentage: 0,
          consecutiveAbsences: 0,
          riskLevel: "low",
          riskScore: 0,
          flagged: false,
          dateOfBirth: "",
          mustChangePassword: true,
          createdAt: serverTimestamp(),
        });
        success++;
      } catch (err) {
        failed++;
        if (err instanceof FirebaseError && err.code === "auth/email-already-in-use") {
          errors.push(`${row.Email.trim()} — email already in use`);
        } else {
          errors.push(`${row.StudentID} — ${err instanceof FirebaseError ? err.message : "Unknown error"}`);
        }
      }
    }

    return { success, failed, errors };
  };

  const handleMentorFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        setMentorHeaders(headers);
        setMentorData(results.data as any[]);
        // Auto-map columns
        const studentIdCol = headers.find((h) =>
          h.toLowerCase().replace(/[^a-z]/g, '').includes('studentid') ||
          h.toLowerCase().replace(/[^a-z]/g, '').includes('studentno')
        ) ?? '';
        const mentorCol = headers.find((h) =>
          h.toLowerCase().replace(/[^a-z]/g, '').includes('mentor') ||
          h.toLowerCase().replace(/[^a-z]/g, '').includes('advisor')
        ) ?? '';
        setMentorMapping({ studentId: studentIdCol, mentorName: mentorCol });
        setMentorResult(null);
      },
    });
  };

  const handleMentorAssign = async () => {
    if (!mentorMapping.studentId || !mentorMapping.mentorName) {
      toast.error("Please map both Student ID and Mentor Name columns");
      return;
    }
    setMentorSubmitting(true);
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of mentorData) {
      const studentId = row[mentorMapping.studentId]?.trim();
      const mentorName = row[mentorMapping.mentorName]?.trim();
      if (!studentId || !mentorName) { skipped++; continue; }
      try {
        await updateDoc(doc(db, "students", studentId), { academicMentor: mentorName });
        updated++;
      } catch {
        errors.push(`${studentId} — student not found`);
        skipped++;
      }
    }

    setMentorResult({ updated, skipped, errors });
    setMentorSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground">
            Manage student accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setBulkImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Import CSV
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

          {/* Table */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading students…
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No students found matching your criteria</p>
            </div>
          ) : (
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
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {student.studentId}
                      </td>
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{student.email}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate">
                        {student.faculty || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">
                        {student.programme || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {student.level || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            student.status === "active"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }
                        >
                          {student.status}
                        </Badge>
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
                          {student.status === "active" ? (
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
          )}
        </CardContent>
      </Card>

      {/* Add Student Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) { setAddStudentId(''); setAddName(''); setAddEmail(''); setAddPassword(''); setAddConfirmPassword(''); setAddStatus('active'); } setIsAddOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>Create a new student account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4" autoComplete="off">
            <input type="text" style={{display:'none'}} autoComplete="username" readOnly />
            <input type="password" style={{display:'none'}} autoComplete="current-password" readOnly />
            <div className="space-y-2">
              <Label htmlFor="add-studentId">Student ID <span className="text-red-500">*</span></Label>
              <Input
                id="add-studentId"
                autoComplete="off"
                placeholder="Enter ID"
                value={addStudentId}
                onChange={(e) => setAddStudentId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-name">Full Name <span className="text-red-500">*</span></Label>
              <Input
                id="add-name"
                autoComplete="off"
                placeholder="Enter full name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">Email <span className="text-red-500">*</span></Label>
              <Input
                id="add-email"
                type="email"
                autoComplete="off"
                placeholder="Enter email address"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Temporary Password <span className="text-red-500">*</span></Label>
              <Input
                id="add-password"
                type="password"
                autoComplete="new-password"
                placeholder="Enter temporary password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-status">Status</Label>
              <Select value={addStatus} onValueChange={(v) => setAddStatus(v as "active" | "inactive")}>
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
            <Button size="sm" disabled={isSaving} onClick={handleAddStudent}>
              {isSaving ? "Creating…" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) { setEditName(''); setEditStudentId(''); setEditEmail(''); setEditingStudent(null); } setIsEditOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update the student's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4" autoComplete="off">
            <input type="text" style={{display:'none'}} autoComplete="username" readOnly />
            <input type="password" style={{display:'none'}} autoComplete="current-password" readOnly />
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name <span className="text-red-500">*</span></Label>
              <Input
                id="edit-name"
                autoComplete="off"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-studentId">Student ID <span className="text-red-500">*</span></Label>
              <Input
                id="edit-studentId"
                autoComplete="off"
                value={editStudentId}
                onChange={(e) => setEditStudentId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
              <Input
                id="edit-email"
                type="email"
                autoComplete="off"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isEditSaving} onClick={handleSaveEdit}>
              {isEditSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Modal */}
      <BulkImportModal
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        role="student"
        onImport={handleBulkImport}
      />

      {/* Mentor Assignment Dialog */}
      <Dialog open={mentorAssignOpen} onOpenChange={(open) => { if (!open) { setMentorData([]); setMentorHeaders([]); setMentorMapping({ studentId: '', mentorName: '' }); setMentorResult(null); } setMentorAssignOpen(open); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Assign Academic Mentors</DialogTitle>
            <DialogDescription>
              Upload a CSV with Student IDs and Mentor Names to bulk-assign mentors.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {mentorData.length === 0 ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-7 w-7 text-gray-400" />
                  <p className="text-sm text-gray-600">Click to upload CSV</p>
                  <p className="text-xs text-gray-400">Must contain Student ID and Mentor Name columns</p>
                </div>
                <input type="file" accept=".csv" className="hidden" onChange={handleMentorFileChange} />
              </label>
            ) : mentorResult ? (
              <div className={`rounded-xl p-5 border text-center ${mentorResult.skipped === 0 && mentorResult.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className="font-medium text-base mb-1">
                  {mentorResult.updated} student{mentorResult.updated !== 1 ? 's' : ''} updated
                </p>
                {mentorResult.skipped > 0 && (
                  <p className="text-sm text-amber-700">{mentorResult.skipped} rows skipped</p>
                )}
                {mentorResult.errors.length > 0 && (
                  <div className="text-left mt-3 space-y-1 max-h-28 overflow-y-auto">
                    {mentorResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-700">• {e}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs text-blue-700">
                    CSV loaded: <strong>{mentorData.length} rows</strong>, {mentorHeaders.length} columns.
                    Map the columns below.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 border rounded-xl">
                    <div className="w-36 flex-shrink-0">
                      <p className="text-sm font-medium">Student ID</p>
                      <span className="text-[10px] text-red-500 font-medium">Required</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    <Select value={mentorMapping.studentId} onValueChange={(v) => setMentorMapping((p) => ({ ...p, studentId: v }))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {mentorHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-4 p-3 border rounded-xl">
                    <div className="w-36 flex-shrink-0">
                      <p className="text-sm font-medium">Mentor Name</p>
                      <span className="text-[10px] text-red-500 font-medium">Required</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    <Select value={mentorMapping.mentorName} onValueChange={(v) => setMentorMapping((p) => ({ ...p, mentorName: v }))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {mentorHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setMentorAssignOpen(false)}>
              {mentorResult ? 'Close' : 'Cancel'}
            </Button>
            {mentorData.length > 0 && !mentorResult && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 gap-1.5"
                disabled={mentorSubmitting || !mentorMapping.studentId || !mentorMapping.mentorName}
                onClick={handleMentorAssign}
              >
                {mentorSubmitting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating...</>
                ) : (
                  <>Assign {mentorData.length} Mentors</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
