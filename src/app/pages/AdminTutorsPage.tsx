import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
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
import { UserPlus, Upload, Search, Edit, UserCheck, UserX, Users } from "lucide-react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db, secondaryAuth } from "../../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { BulkImportModal } from "../components/BulkImportModal";

interface Tutor {
  id: string;
  tutorId: string;
  name: string;
  email: string;
  department: string;
  status: "active" | "inactive";
  createdAt?: string;
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Add / Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formTutorId, setFormTutorId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formPassword, setFormPassword] = useState("");
  const [formConfirmPassword, setFormConfirmPassword] = useState("");

  useEffect(() => {
    const q = query(collection(db, "academic_mentors"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      setTutors(
        snapshot.docs.map((d) => ({
          id: d.id,
          tutorId: d.data().tutorId ?? "",
          name: d.data().name ?? "",
          email: d.data().email ?? "",
          department: d.data().department ?? "",
          status: d.data().status ?? "active",
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? undefined,
        })),
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openAddDialog = () => {
    setEditingTutor(null);
    setFormTutorId("");
    setFormName("");
    setFormEmail("");
    setFormDepartment("");
    setFormStatus("active");
    setFormPassword("");
    setFormConfirmPassword("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (tutor: Tutor) => {
    setEditingTutor(tutor);
    setFormTutorId(tutor.tutorId);
    setFormName(tutor.name);
    setFormEmail(tutor.email);
    setFormDepartment(tutor.department);
    setFormStatus(tutor.status);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTutorId.trim() || !formName.trim() || !formEmail.trim() || !formDepartment) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!editingTutor) {
      if (!formPassword.trim()) {
        toast.error("Please enter a password");
        return;
      }
      if (formPassword.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingTutor) {
        await updateDoc(doc(db, "academic_mentors", editingTutor.id), {
          tutorId: formTutorId.trim(),
          name: formName.trim(),
          email: formEmail.trim(),
          department: formDepartment,
          status: formStatus,
        });
        toast.success("Academic Mentor updated successfully");
      } else {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, formEmail.trim(), formPassword.trim());
        await secondaryAuth.signOut();
        await addDoc(collection(db, "academic_mentors"), {
          uid: cred.user.uid,
          tutorId: formTutorId.trim(),
          name: formName.trim(),
          email: formEmail.trim(),
          department: formDepartment,
          status: formStatus,
          role: "academic_mentor",
          createdAt: serverTimestamp(),
        });
        toast.success("Academic Mentor account created successfully");
      }
      setIsDialogOpen(false);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/email-already-in-use") {
          toast.error("An account with this email already exists.");
        } else {
          toast.error(`Failed to create account: ${err.message}`);
        }
      } else {
        toast.error("Failed to save academic mentor. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetInactive = async (tutor: Tutor) => {
    try {
      await updateDoc(doc(db, "academic_mentors", tutor.id), { status: "inactive" });
      toast.success(`${tutor.name} set to inactive`);
    } catch {
      toast.error("Failed to update tutor status.");
    }
  };

  const handleSetActive = async (tutor: Tutor) => {
    try {
      await updateDoc(doc(db, "academic_mentors", tutor.id), { status: "active" });
      toast.success(`${tutor.name} set to active`);
    } catch {
      toast.error("Failed to update tutor status.");
    }
  };

  const filtered = tutors.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tutorId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept =
      departmentFilter === "all" || t.department === departmentFilter;
    const matchesStatus =
      statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const activeTutors = tutors.filter((t) => t.status === "active").length;
  const inactiveTutors = tutors.filter((t) => t.status === "inactive").length;

  const handleBulkImport = async (rows: any[]) => {
    let success = 0; let failed = 0; const errors: string[] = [];
    for (const row of rows) {
      try {
        if (!row.StaffID || !row.FullName || !row.Email) {
          errors.push(`Row skipped — missing fields: ${row.FullName || row.Email || 'unknown'}`);
          failed++; continue;
        }
        const tempPassword = `${row.StaffID.trim()}@DropGuard`;
        const cred = await createUserWithEmailAndPassword(secondaryAuth, row.Email.trim(), tempPassword);
        await addDoc(collection(db, "academic_mentors"), {
          uid: cred.user.uid,
          tutorId: row.StaffID.trim(),
          name: row.FullName.trim(),
          email: row.Email.trim(),
          department: row.Department?.trim() ?? '',
          role: 'academic_mentor',
          status: 'active',
          mustChangePassword: true,
          createdAt: serverTimestamp(),
        });
        await secondaryAuth.signOut();
        success++;
      } catch (err: any) {
        errors.push(`${row.FullName || row.Email} — ${err.message}`);
        failed++;
      }
    }
    return { success, failed, errors };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Academic Mentors</h1>
          <p className="text-muted-foreground">
            Manage academic mentors assigned to students
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Import CSV
          </Button>
          <Button className="gap-2" onClick={openAddDialog}>
            <UserPlus className="h-4 w-4" />
            Add Academic Mentor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Academic Mentors</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{tutors.length}</div>
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
            <div className="text-4xl font-bold text-green-600">{activeTutors}</div>
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
            <div className="text-4xl font-bold text-red-600">{inactiveTutors}</div>
            <p className="text-xs text-muted-foreground mt-1">Inactive accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Academic Mentor Directory</CardTitle>
          <CardDescription>All registered academic mentors</CardDescription>
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
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Business School">Business School</SelectItem>
                <SelectItem value="School of Computing">
                  School of Computing
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
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
              Loading tutors…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tutors found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Staff ID
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Name
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Email
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Department
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Status
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tutor) => (
                    <tr
                      key={tutor.id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{tutor.tutorId || '—'}</td>
                      <td className="px-4 py-3 font-medium">{tutor.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tutor.email}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tutor.department}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            tutor.status === "active"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }
                        >
                          {tutor.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openEditDialog(tutor)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {tutor.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-orange-600 hover:text-orange-600 hover:bg-orange-50"
                              onClick={() => handleSetInactive(tutor)}
                            >
                              <UserX className="h-3.5 w-3.5" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-green-600 hover:text-green-600 hover:bg-green-50"
                              onClick={() => handleSetActive(tutor)}
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

      <BulkImportModal
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        role="mentor"
        onImport={handleBulkImport}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setEditingTutor(null); setFormTutorId(''); setFormName(''); setFormEmail(''); setFormDepartment(''); setFormStatus('active'); setFormPassword(''); setFormConfirmPassword(''); } setIsDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTutor ? "Edit Academic Mentor" : "Add Academic Mentor"}
            </DialogTitle>
            <DialogDescription>
              {editingTutor
                ? "Update the academic mentor's information"
                : "Add a new academic mentor to the system"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4" autoComplete="off">
            <input type="text" style={{display:'none'}} autoComplete="username" readOnly />
            <input type="password" style={{display:'none'}} autoComplete="current-password" readOnly />
            <div className="space-y-2">
              <Label htmlFor="tutorStaffId">
                Staff ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tutorStaffId"
                autoComplete="off"
                placeholder="Enter ID"
                value={formTutorId}
                onChange={(e) => setFormTutorId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tutorName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tutorName"
                autoComplete="off"
                placeholder="Enter full name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tutorEmail">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tutorEmail"
                type="email"
                autoComplete="off"
                placeholder="Enter email address"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>

            {!editingTutor && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tutorPassword">
                    Temporary Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tutorPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Enter temporary password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="tutorDepartment">
                Department <span className="text-red-500">*</span>
              </Label>
              <Select value={formDepartment} onValueChange={setFormDepartment}>
                <SelectTrigger id="tutorDepartment">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Business School">Business School</SelectItem>
                  <SelectItem value="School of Computing">
                    School of Computing
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tutorStatus">Status</Label>
              <Select
                value={formStatus}
                onValueChange={(v) =>
                  setFormStatus(v as "active" | "inactive")
                }
              >
                <SelectTrigger id="tutorStatus">
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Creating…" : editingTutor ? "Save Changes" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
