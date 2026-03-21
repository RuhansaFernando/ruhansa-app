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
import { UserPlus, Search, Edit, UserCheck, UserX, Users, Upload } from "lucide-react";
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
import { CsvDataImportModal } from '../components/CsvDataImportModal';

interface Counsellor {
  id: string;
  name: string;
  specialisation: string;
  status: "active" | "inactive";
  contactEmail?: string;
  contactPhone?: string;
  qualification?: string;
  certificationBody?: string;
  registrationNumber?: string;
}

const CSV_FIELDS = [
  { key: 'name', label: 'Full Name', required: true, sampleValue: 'Dr. Jane Smith' },
  { key: 'specialisation', label: 'Specialisation', required: true, sampleValue: 'Mental Health & Wellbeing' },
  { key: 'contactEmail', label: 'Contact Email', required: true, sampleValue: 'counsellor@example.com' },
  { key: 'contactPhone', label: 'Contact Phone', required: false, sampleValue: '+44 7700 900000' },
  { key: 'qualification', label: 'Qualification', required: true, sampleValue: 'MSc Clinical Psychology' },
  { key: 'certificationBody', label: 'Certification Body', required: true, sampleValue: 'BACP' },
  { key: 'registrationNumber', label: 'Registration Number', required: true, sampleValue: 'BACP-12345' },
  { key: 'status', label: 'Status', required: false, sampleValue: 'active' },
];

export default function AdminCounsellorsPage() {
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bulkOpen, setBulkOpen] = useState(false);

  // Add / Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCounsellor, setEditingCounsellor] = useState<Counsellor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSpecialisation, setFormSpecialisation] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [qualification, setQualification] = useState("");
  const [certificationBody, setCertificationBody] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");

  useEffect(() => {
    const q = query(collection(db, "student_counsellors"), orderBy("name"));
    const unsub = onSnapshot(q, (snapshot) => {
      setCounsellors(
        snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? "",
          specialisation: d.data().specialisation ?? "",
          status: d.data().status ?? "active",
          contactEmail: d.data().contactEmail ?? "",
          contactPhone: d.data().contactPhone ?? "",
          qualification: d.data().qualification ?? "",
          certificationBody: d.data().certificationBody ?? "",
          registrationNumber: d.data().registrationNumber ?? "",
        })),
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormSpecialisation("");
    setFormStatus("active");
    setContactEmail("");
    setContactPhone("");
    setQualification("");
    setCertificationBody("");
    setRegistrationNumber("");
  };

  const openAddDialog = () => {
    setEditingCounsellor(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (counsellor: Counsellor) => {
    setEditingCounsellor(counsellor);
    setFormName(counsellor.name);
    setFormSpecialisation(counsellor.specialisation);
    setFormStatus(counsellor.status);
    setContactEmail(counsellor.contactEmail ?? "");
    setContactPhone(counsellor.contactPhone ?? "");
    setQualification(counsellor.qualification ?? "");
    setCertificationBody(counsellor.certificationBody ?? "");
    setRegistrationNumber(counsellor.registrationNumber ?? "");
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
    if (!formName.trim() || !formSpecialisation || !contactEmail.trim() || !qualification.trim() || !certificationBody.trim() || !registrationNumber.trim()) {
      toast.error("Please fill in all required fields including verification details");
      return;
    }

    setIsSaving(true);
    try {
      if (editingCounsellor) {
        await updateDoc(doc(db, "student_counsellors", editingCounsellor.id), {
          name: formName.trim(),
          specialisation: formSpecialisation,
          status: formStatus,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          qualification: qualification.trim(),
          certificationBody: certificationBody.trim(),
          registrationNumber: registrationNumber.trim(),
        });
        toast.success("Counsellor updated successfully");
      } else {
        await addDoc(collection(db, "student_counsellors"), {
          name: formName.trim(),
          specialisation: formSpecialisation,
          status: formStatus,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          qualification: qualification.trim(),
          certificationBody: certificationBody.trim(),
          registrationNumber: registrationNumber.trim(),
          verified: true,
          createdAt: serverTimestamp(),
        });
        toast.success("External counsellor added successfully");
      }
      setIsDialogOpen(false);
    } catch {
      toast.error("Failed to save counsellor. Please try again.");
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

  const handleBulkImport = async (rows: Record<string, string>[]) => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        if (!row.name?.trim() || !row.specialisation?.trim() || !row.contactEmail?.trim() || !row.qualification?.trim() || !row.certificationBody?.trim() || !row.registrationNumber?.trim()) {
          errors.push(`Skipped — missing required fields: "${row.name || ''}"`);
          failed++;
          continue;
        }
        await addDoc(collection(db, 'student_counsellors'), {
          name: row.name.trim(),
          specialisation: row.specialisation.trim(),
          contactEmail: row.contactEmail.trim(),
          contactPhone: row.contactPhone?.trim() ?? '',
          qualification: row.qualification.trim(),
          certificationBody: row.certificationBody.trim(),
          registrationNumber: row.registrationNumber.trim(),
          status: row.status === 'inactive' ? 'inactive' : 'active',
          verified: true,
          createdAt: serverTimestamp(),
        });
        success++;
      } catch (err: any) {
        errors.push(`${row.name || 'Unknown'} — ${err.message}`);
        failed++;
      }
    }
    return { success, failed, errors };
  };

  const filtered = counsellors.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.contactEmail ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCounsellors = counsellors.filter((c) => c.status === "active").length;
  const inactiveCounsellors = counsellors.filter((c) => c.status === "inactive").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">External Counsellors</h1>
          <p className="text-muted-foreground">
            Manage external counsellor contacts. SSAs refer students to these professionals when mental health support is needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Import CSV
          </Button>
          <Button className="gap-2" onClick={openAddDialog}>
            <UserPlus className="h-4 w-4" />
            Add External Counsellor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Counsellors</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{counsellors.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered contacts</p>
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
            <div className="text-4xl font-bold text-green-600">{activeCounsellors}</div>
            <p className="text-xs text-muted-foreground mt-1">Active counsellors</p>
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
            <div className="text-4xl font-bold text-red-600">{inactiveCounsellors}</div>
            <p className="text-xs text-muted-foreground mt-1">Inactive counsellors</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Counsellor Directory</CardTitle>
          <CardDescription>All registered external counsellors</CardDescription>
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
              <p>No counsellors found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Specialisation</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Email</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Phone</th>
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
                      <td className="px-4 py-3">
                        <p className="font-medium">{counsellor.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            ✅ Verified
                          </span>
                          {counsellor.certificationBody && (
                            <span className="text-xs text-muted-foreground">
                              {counsellor.certificationBody}
                            </span>
                          )}
                        </div>
                        {counsellor.registrationNumber && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Reg: {counsellor.registrationNumber}
                          </p>
                        )}
                        {counsellor.qualification && (
                          <p className="text-xs text-muted-foreground">
                            {counsellor.qualification}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {counsellor.specialisation ? (
                          <Badge className={getSpecialisationBadgeClass(counsellor.specialisation)}>
                            {counsellor.specialisation}
                          </Badge>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{counsellor.contactEmail || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{counsellor.contactPhone || '—'}</td>
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
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCounsellor ? "Edit External Counsellor" : "Add External Counsellor"}
            </DialogTitle>
            <DialogDescription>
              {editingCounsellor
                ? "Update the counsellor's contact information"
                : "Add a new external counsellor contact"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
              <Label htmlFor="counsellorSpecialisation">
                Specialisation <span className="text-red-500">*</span>
              </Label>
              <Select value={formSpecialisation} onValueChange={setFormSpecialisation}>
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
              <Label htmlFor="contactEmail">
                Contact Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="e.g. counsellor@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                placeholder="e.g. +44 7700 900000"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualification">
                Qualification <span className="text-red-500">*</span>
              </Label>
              <Input
                id="qualification"
                placeholder="e.g. MSc Clinical Psychology, Diploma in Counselling"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificationBody">
                Certification Body <span className="text-red-500">*</span>
              </Label>
              <Input
                id="certificationBody"
                placeholder="e.g. Sri Lanka Counsellors Association, BACP"
                value={certificationBody}
                onChange={(e) => setCertificationBody(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="registrationNumber">
                Registration Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="registrationNumber"
                placeholder="e.g. SLCA-2021-0234"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Enter the counsellor's professional registration or license number to verify their credentials.
              </p>
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
            <Button size="sm" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Saving…" : editingCounsellor ? "Save Changes" : "Add Counsellor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvDataImportModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Counsellors"
        fields={CSV_FIELDS}
        onImport={handleBulkImport}
      />
    </div>
  );
}
