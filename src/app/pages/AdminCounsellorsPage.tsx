import { useState, useEffect } from "react";
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
import { UserPlus, Search, Edit, UserX, Users } from "lucide-react";
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

interface Counsellor {
  id: string;
  counsellorId: string;
  name: string;
  email: string;
  specialisation: string;
  status: "active" | "inactive";
  createdAt?: string;
}

export default function AdminCounsellorsPage() {
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add / Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCounsellor, setEditingCounsellor] = useState<Counsellor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formCounsellorId, setFormCounsellorId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSpecialisation, setFormSpecialisation] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formPassword, setFormPassword] = useState("");
  const [formConfirmPassword, setFormConfirmPassword] = useState("");

  useEffect(() => {
    const q = query(collection(db, "student_counsellors"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      setCounsellors(
        snapshot.docs.map((d) => ({
          id: d.id,
          counsellorId: d.data().counsellorId ?? "",
          name: d.data().name ?? "",
          email: d.data().email ?? "",
          specialisation: d.data().specialisation ?? "",
          status: d.data().status ?? "active",
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? undefined,
        })),
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openAddDialog = () => {
    setEditingCounsellor(null);
    setFormCounsellorId("");
    setFormName("");
    setFormEmail("");
    setFormSpecialisation("");
    setFormStatus("active");
    setFormPassword("");
    setFormConfirmPassword("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (counsellor: Counsellor) => {
    setEditingCounsellor(counsellor);
    setFormCounsellorId(counsellor.counsellorId);
    setFormName(counsellor.name);
    setFormEmail(counsellor.email);
    setFormSpecialisation(counsellor.specialisation);
    setFormStatus(counsellor.status);
    setIsDialogOpen(true);
  };

  const SPECIALISATIONS = [
    "Academic Support",
    "Mental Health & Wellbeing",
    "Career Guidance",
    "Financial Advice",
    "Personal Development",
    "Social Integration",
  ];

  const getSpecialisationBadgeClass = (spec: string) => {
    switch (spec) {
      case "Academic Support": return "bg-blue-100 text-blue-800 border-blue-200";
      case "Mental Health & Wellbeing": return "bg-purple-100 text-purple-800 border-purple-200";
      case "Career Guidance": return "bg-green-100 text-green-800 border-green-200";
      case "Financial Advice": return "bg-amber-100 text-amber-800 border-amber-200";
      case "Personal Development": return "bg-teal-100 text-teal-800 border-teal-200";
      case "Social Integration": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const handleSave = async () => {
    if (!formCounsellorId.trim() || !formName.trim() || !formEmail.trim() || !formSpecialisation) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!editingCounsellor) {
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
      if (editingCounsellor) {
        await updateDoc(doc(db, "student_counsellors", editingCounsellor.id), {
          counsellorId: formCounsellorId.trim(),
          name: formName.trim(),
          email: formEmail.trim(),
          specialisation: formSpecialisation.trim(),
          status: formStatus,
        });
        toast.success("Student Counsellor updated successfully");
      } else {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, formEmail.trim(), formPassword.trim());
        await secondaryAuth.signOut();
        await addDoc(collection(db, "student_counsellors"), {
          uid: cred.user.uid,
          counsellorId: formCounsellorId.trim(),
          name: formName.trim(),
          email: formEmail.trim(),
          specialisation: formSpecialisation.trim(),
          status: formStatus,
          role: "student_counsellor",
          createdAt: serverTimestamp(),
        });
        toast.success("Student Counsellor account created successfully");
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
        toast.error("Failed to save student counsellor. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetInactive = async (counsellor: Counsellor) => {
    try {
      await updateDoc(doc(db, "student_counsellors", counsellor.id), { status: "inactive" });
      toast.success(`${counsellor.name} set to inactive`);
    } catch {
      toast.error("Failed to update counsellor status.");
    }
  };

  const handleSetActive = async (counsellor: Counsellor) => {
    try {
      await updateDoc(doc(db, "student_counsellors", counsellor.id), { status: "active" });
      toast.success(`${counsellor.name} set to active`);
    } catch {
      toast.error("Failed to update counsellor status.");
    }
  };

  const filtered = counsellors.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.counsellorId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCounsellors = counsellors.filter((c) => c.status === "active").length;
  const inactiveCounsellors = counsellors.filter((c) => c.status === "inactive").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Counsellors</h1>
          <p className="text-muted-foreground">
            Manage student counsellors available for student appointments
          </p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <UserPlus className="h-4 w-4" />
          Add Student Counsellor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardDescription>Total Student Counsellors</CardDescription>
            <CardTitle className="text-3xl">{counsellors.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {activeCounsellors}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Active accounts</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardDescription>Inactive</CardDescription>
            <CardTitle className="text-3xl text-gray-500">
              {inactiveCounsellors}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Inactive accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Counsellor Directory</CardTitle>
          <CardDescription>All registered student counsellors</CardDescription>
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
              Loading counsellors…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No student counsellors found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Staff ID</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Email</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Specialisation</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((counsellor) => (
                    <tr
                      key={counsellor.id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{counsellor.counsellorId || '—'}</td>
                      <td className="px-4 py-3 font-medium">{counsellor.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{counsellor.email}</td>
                      <td className="px-4 py-3">
                        {counsellor.specialisation ? (
                          <Badge className={getSpecialisationBadgeClass(counsellor.specialisation)}>
                            {counsellor.specialisation}
                          </Badge>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            counsellor.status === "active"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }
                        >
                          {counsellor.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openEditDialog(counsellor)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {counsellor.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-orange-600 hover:text-orange-600 hover:bg-orange-50"
                              onClick={() => handleSetInactive(counsellor)}
                            >
                              <UserX className="h-3.5 w-3.5" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-green-600 hover:text-green-600 hover:bg-green-50"
                              onClick={() => handleSetActive(counsellor)}
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

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setEditingCounsellor(null); setFormCounsellorId(''); setFormName(''); setFormEmail(''); setFormSpecialisation(''); setFormStatus('active'); setFormPassword(''); setFormConfirmPassword(''); } setIsDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCounsellor ? "Edit Student Counsellor" : "Add Student Counsellor"}
            </DialogTitle>
            <DialogDescription>
              {editingCounsellor
                ? "Update the student counsellor's information"
                : "Add a new student counsellor to the system"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4" autoComplete="off">
            <input type="text" style={{display:'none'}} autoComplete="username" readOnly />
            <input type="password" style={{display:'none'}} autoComplete="current-password" readOnly />
            <div className="space-y-2">
              <Label htmlFor="counsellorStaffId">
                Staff ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="counsellorStaffId"
                autoComplete="off"
                placeholder="Enter ID"
                value={formCounsellorId}
                onChange={(e) => setFormCounsellorId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="counsellorName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="counsellorName"
                autoComplete="off"
                placeholder="Enter full name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="counsellorEmail">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="counsellorEmail"
                type="email"
                autoComplete="off"
                placeholder="Enter email address"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>

            {!editingCounsellor && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="counsellorPassword">
                    Temporary Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="counsellorPassword"
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
              <Label htmlFor="counsellorSpecialisation">
                Specialisation <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formSpecialisation}
                onValueChange={setFormSpecialisation}
              >
                <SelectTrigger id="counsellorSpecialisation">
                  <SelectValue placeholder="Select specialisation" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALISATIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="counsellorStatus">Status</Label>
              <Select
                value={formStatus}
                onValueChange={(v) => setFormStatus(v as "active" | "inactive")}
              >
                <SelectTrigger id="counsellorStatus">
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
              {isSaving ? "Creating…" : editingCounsellor ? "Save Changes" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
