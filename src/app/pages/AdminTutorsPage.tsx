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
import { db } from "../../firebase";

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

  // Add / Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");

  // Fetch tutors from Firestore
  useEffect(() => {
    const q = query(collection(db, "tutors"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      setTutors(
        snapshot.docs.map((d) => ({
          id: d.id,
          tutorId: d.data().tutorId ?? d.id,
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
    setFormName("");
    setFormEmail("");
    setFormDepartment("");
    setFormStatus("active");
    setIsDialogOpen(true);
  };

  const openEditDialog = (tutor: Tutor) => {
    setEditingTutor(tutor);
    setFormName(tutor.name);
    setFormEmail(tutor.email);
    setFormDepartment(tutor.department);
    setFormStatus(tutor.status);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim() || !formDepartment) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      if (editingTutor) {
        await updateDoc(doc(db, "tutors", editingTutor.id), {
          name: formName.trim(),
          email: formEmail.trim(),
          department: formDepartment,
          status: formStatus,
        });
        toast.success("Tutor updated successfully");
      } else {
        const docRef = await addDoc(collection(db, "tutors"), {
          name: formName.trim(),
          email: formEmail.trim(),
          department: formDepartment,
          status: formStatus,
          createdAt: serverTimestamp(),
        });
        // Write back the auto-generated tutorId
        await updateDoc(doc(db, "tutors", docRef.id), {
          tutorId: docRef.id,
        });
        toast.success("Tutor added successfully");
      }
      setIsDialogOpen(false);
    } catch {
      toast.error("Failed to save tutor. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetInactive = async (tutor: Tutor) => {
    try {
      await updateDoc(doc(db, "tutors", tutor.id), { status: "inactive" });
      toast.success(`${tutor.name} set to inactive`);
    } catch {
      toast.error("Failed to update tutor status.");
    }
  };

  const handleSetActive = async (tutor: Tutor) => {
    try {
      await updateDoc(doc(db, "tutors", tutor.id), { status: "active" });
      toast.success(`${tutor.name} set to active`);
    } catch {
      toast.error("Failed to update tutor status.");
    }
  };

  const filtered = tutors.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept =
      departmentFilter === "all" || t.department === departmentFilter;
    const matchesStatus =
      statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const activeTutors = tutors.filter((t) => t.status === "active").length;
  const inactiveTutors = tutors.filter((t) => t.status === "inactive").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Personal Tutors</h1>
          <p className="text-muted-foreground">
            Manage tutors assigned to students
          </p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <UserPlus className="h-4 w-4" />
          Add Tutor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Tutors</CardDescription>
            <CardTitle className="text-3xl">{tutors.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Registered tutors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {activeTutors}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Inactive</CardDescription>
            <CardTitle className="text-3xl text-gray-500">
              {inactiveTutors}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Deactivated tutors</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tutor Directory</CardTitle>
          <CardDescription>All registered personal tutors</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
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

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTutor ? "Edit Tutor" : "Add Tutor"}
            </DialogTitle>
            <DialogDescription>
              {editingTutor
                ? "Update the tutor's information"
                : "Add a new personal tutor to the system"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tutorName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tutorName"
                placeholder="e.g. Dr. John Smith"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tutorEmail">
                IIT Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tutorEmail"
                type="email"
                placeholder="j.smith@iit.ac.lk"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tutorDepartment">
                Department <span className="text-red-500">*</span>
              </Label>
              <Select value={formDepartment} onValueChange={setFormDepartment}>
                <SelectTrigger id="tutorDepartment">
                  <SelectValue placeholder="— Select Department —" />
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
              {isSaving ? "Saving…" : editingTutor ? "Save Changes" : "Add Tutor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
