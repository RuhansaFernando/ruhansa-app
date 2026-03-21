import { useState, useEffect } from "react";
import emailjs from '@emailjs/browser';
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
import { Search, Edit, UserPlus, UserCheck, UserX, Users, Upload } from "lucide-react";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { db, secondaryAuth } from "../../firebase";
import { BulkImportModal } from "../components/BulkImportModal";

interface FacultyMember {
  id: string;
  name: string;
  email: string;
  department: string;
  status: "active" | "inactive";
  phone: string;
  designation: string;
}



export default function AdminFacultyPage() {
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  // Add dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addStaffId, setAddStaffId] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addDepartment, setAddDepartment] = useState("");
  const [addStatus, setAddStatus] = useState<"active" | "inactive">("active");
  const [isSaving, setIsSaving] = useState(false);

  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<FacultyMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isEditSaving, setIsEditSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "faculty"), (snapshot) => {
      setFacultyList(
        snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? "",
          email: d.data().email ?? "",
          department: d.data().department ?? "",
          status: d.data().status ?? "active",
          phone: d.data().phone ?? "",
          designation: d.data().designation ?? "",
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(collection(db, 'faculties')).then((snap) => {
      setDepartments(snap.docs.map((d) => d.data().facultyName ?? '').filter(Boolean).sort());
    });
  }, []);

  const stats = {
    total: facultyList.length,
    active: facultyList.filter((f) => f.status === "active").length,
    inactive: facultyList.filter((f) => f.status === "inactive").length,
  };

  const filtered = facultyList.filter((f) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      f.name.toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q) ||
      f.department.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openAddDialog = () => {
    setAddName(""); setAddStaffId(""); setAddEmail("");
    setAddDepartment(""); setAddStatus("active");
    setIsAddOpen(true);
  };

  const handleAddFaculty = async () => {
    if (!addName.trim() || !addStaffId.trim() || !addEmail.trim() || !addDepartment) {
      toast.error("Please fill in all required fields");
      return;
    }
    const tempPassword = `${addStaffId.trim()}@DropGuard`;
    setIsSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, addEmail.trim(), tempPassword);
      await secondaryAuth.signOut();
      await setDoc(doc(db, "faculty", addStaffId.trim()), {
        name: addName.trim(),
        email: addEmail.trim(),
        department: addDepartment,
        status: addStatus,
        role: "faculty",
        uid: cred.user.uid,
        studentsAssigned: 0,
        courses: [],
        joinedDate: new Date().toISOString().split("T")[0],
        createdAt: serverTimestamp(),
      });
      try {
        await emailjs.send('service_y8aewpn', 'template_welcome', {
          to_name: addName.trim(),
          to_email: addEmail.trim(),
          user_id: addStaffId.trim(),
          temp_password: tempPassword,
          login_url: 'http://localhost:5173',
        }, 'pqfkLZ1zbahk5O2Vi');
      } catch (emailErr) {
        console.warn('Welcome email failed:', emailErr);
      }
      toast.success("Faculty account created successfully");
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

  const openEditDialog = (faculty: FacultyMember) => {
    setEditingFaculty(faculty);
    setEditName(faculty.name);
    setEditEmail(faculty.email);
    setEditDepartment(faculty.department);
    setEditPhone(faculty.phone);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFaculty || !editName.trim() || !editEmail.trim() || !editDepartment) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsEditSaving(true);
    try {
      await updateDoc(doc(db, "faculty", editingFaculty.id), {
        name: editName.trim(),
        email: editEmail.trim(),
        department: editDepartment,
        phone: editPhone.trim(),
      });
      toast.success("Faculty member updated successfully");
      setIsEditOpen(false);
      setEditingFaculty(null);
    } catch {
      toast.error("Failed to update faculty member. Please try again.");
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleToggleStatus = async (faculty: FacultyMember) => {
    const newStatus = faculty.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "faculty", faculty.id), { status: newStatus });
      toast.success(newStatus === "active" ? "Faculty member activated" : "Faculty member deactivated");
    } catch {
      toast.error("Failed to update status. Please try again.");
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
        await setDoc(doc(db, "faculty", row.StaffID.trim()), {
          staffId: row.StaffID?.trim() ?? "",
          name: row.FullName.trim(),
          email: row.Email.trim(),
          department: row.Department?.trim() ?? "",
          status: "active",
          role: "faculty",
          uid: cred.user.uid,
          studentsAssigned: 0,
          courses: [],
          joinedDate: new Date().toISOString().split("T")[0],
          mustChangePassword: true,
          createdAt: serverTimestamp(),
        });
        try {
          await emailjs.send('service_y8aewpn', 'template_welcome', {
            to_name: row.FullName.trim(),
            to_email: row.Email.trim(),
            user_id: row.StaffID.trim(),
            temp_password: tempPassword,
            login_url: 'http://localhost:5173',
          }, 'pqfkLZ1zbahk5O2Vi');
        } catch (emailErr) {
          console.warn('Welcome email failed:', emailErr);
        }
        success++;
      } catch (err: any) {
        if (err.code === "auth/email-already-in-use") {
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
          <h1 className="text-3xl font-bold">Faculty Management</h1>
          <p className="text-muted-foreground">Manage faculty member accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setBulkImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Import CSV
          </Button>
          <Button className="gap-2" onClick={openAddDialog}>
            <UserPlus className="h-4 w-4" />
            Add Faculty
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Faculty</CardTitle>
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

      {/* Faculty Directory */}
      <Card>
        <CardHeader>
          <CardTitle>Faculty Directory</CardTitle>
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
              Loading faculty…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No faculty members found matching your criteria</p>
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
                  {filtered.map((faculty) => (
                    <tr
                      key={faculty.id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{faculty.id}</td>
                      <td className="px-4 py-3 font-medium">{faculty.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{faculty.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{faculty.department || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            faculty.status === "active"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }
                        >
                          {faculty.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openEditDialog(faculty)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {faculty.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-600 hover:bg-red-50 border-red-200"
                              onClick={() => handleToggleStatus(faculty)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-600 hover:bg-green-50 border-green-200"
                              onClick={() => handleToggleStatus(faculty)}
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
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) { setAddName(""); setAddStaffId(""); setAddEmail(""); setAddDepartment(""); setAddStatus("active"); } setIsAddOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Faculty</DialogTitle>
            <DialogDescription>Create a new faculty account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff ID <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. FAC001" value={addStaffId} onChange={(e) => setAddStaffId(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input placeholder="Enter full name" value={addName} onChange={(e) => setAddName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" placeholder="Enter email address" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Department <span className="text-red-500">*</span></Label>
              <Select value={addDepartment} onValueChange={setAddDepartment}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={addStatus} onValueChange={(v) => setAddStatus(v as "active" | "inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isSaving} onClick={handleAddFaculty}>
              {isSaving ? "Creating…" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) { setEditName(""); setEditEmail(""); setEditDepartment(""); setEditPhone(""); setEditingFaculty(null); } setIsEditOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Faculty</DialogTitle>
            <DialogDescription>Update the faculty member's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isEditSaving} onClick={handleSaveEdit}>
              {isEditSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import */}
      <BulkImportModal
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        role="faculty"
        onImport={handleBulkImport}
      />
    </div>
  );
}
