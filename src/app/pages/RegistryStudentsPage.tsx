import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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
  Upload,
  Download,
  Users,
  Clock,
  CheckCircle,
  Search,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  addDoc,
  getDocs,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import Papa from "papaparse";

// ── Constants ────────────────────────────────────────────────────────────────

const LEVEL_TO_YEAR: Record<string, string> = {
  'Level 4': 'Year 1', 'Level 5': 'Year 2', 'Level 6': 'Year 3', 'Level 7': 'Year 4',
  '1st Year': 'Year 1', '2nd Year': 'Year 2', '3rd Year': 'Year 3', '4th Year': 'Year 4',
  'Year 1': 'Year 1', 'Year 2': 'Year 2', 'Year 3': 'Year 3', 'Year 4': 'Year 4',
};


const CSV_TEMPLATE_HEADERS =
  "StudentID,FullName,Email,Gender,DateOfBirth,ContactNumber,Faculty,Programme,YearOfStudy,Intake,EnrollmentDate,StudentType,Address,EmergencyContactName,EmergencyContactNumber,EmergencyContactRelationship,Nationality,Religion";
const CSV_TEMPLATE_SAMPLE =
  "STD020,Amal Perera,amal.perera@university.lk,Male,2000-05-15,0771234567,Business School,BSc (Hons) Business Information Systems,Year 1,2025,2025-01-15,Full-time,123 Main Street Colombo,Nimal Perera,0779876543,Father,Sri Lankan,Buddhist";

// ── Interface ─────────────────────────────────────────────────────────────────

interface StudentRecord {
  id: string;
  studentId: string;
  name: string;
  email: string;
  programme: string;
  faculty: string;
  level: string;
  intake: string;
  gender: string;
  dateOfBirth: string;
  contactNumber: string;
  enrollmentDate: string;
  studentType: string;
  address: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  emergencyContactRelationship: string;
  nationality: string;
  religion: string;
  status: string;
  accountActivated: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RegistryStudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View modal
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<StudentRecord | null>(null);

  // Edit modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentRecord | null>(null);
  const [edProgramme, setEdProgramme] = useState("");
  const [edFaculty, setEdFaculty] = useState("");
  const [edLevel, setEdLevel] = useState("");
  const [edIntake, setEdIntake] = useState("");
  const [edEnrollmentDate, setEdEnrollmentDate] = useState("");
  const [edGender, setEdGender] = useState("");
  const [edDateOfBirth, setEdDateOfBirth] = useState("");
  const [edContactNumber, setEdContactNumber] = useState("");
  const [edStudentType, setEdStudentType] = useState("");
  const [edEmergencyContactName, setEdEmergencyContactName] = useState("");
  const [edEmergencyContactNumber, setEdEmergencyContactNumber] = useState("");
  const [edStatus, setEdStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteStudent, setDeleteStudent] = useState<StudentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "students"), orderBy("createdAt", "desc")),
      (snap) => {
        setStudents(
          snap.docs.map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? "",
            name: d.data().name ?? "",
            email: d.data().email ?? "",
            programme: d.data().programme ?? "",
            faculty: d.data().faculty ?? "",
            level: d.data().level ?? "",
            intake: d.data().intake ?? "",
            gender: d.data().gender ?? "",
            dateOfBirth: d.data().dateOfBirth ?? "",
            contactNumber: d.data().contactNumber ?? "",
            enrollmentDate: d.data().enrollmentDate ?? "",
            studentType: d.data().studentType ?? "",
            address: d.data().address ?? "",
            emergencyContactName: d.data().emergencyContactName ?? "",
            emergencyContactNumber: d.data().emergencyContactNumber ?? "",
            emergencyContactRelationship: d.data().emergencyContactRelationship ?? "",
            nationality: d.data().nationality ?? "",
            religion: d.data().religion ?? "",
            status: d.data().status ?? "pending",
            accountActivated: d.data().accountActivated ?? false,
          }))
        );
        setLoading(false);
      },
      () => {
        setLoadError(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalEnrolled = students.length;
  const activeStudents = students.filter((s) => s.status === 'active' || (s.accountActivated && !s.status)).length;
  const pendingActivation = students.filter((s) => s.status === 'pending' || (!s.status && !s.accountActivated)).length;
  const otherStatusCount = students.filter((s) => ['withdrawn', 'deferred', 'suspended', 'graduated'].includes(s.status)).length;

  // Programme options loaded from Firestore
  const [programmeOptions, setProgrammeOptions] = useState<string[]>([]);
  const [programmeFacultyMap, setProgrammeFacultyMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    getDocs(collection(db, 'programmes')).then((snap) => {
      const names: string[] = [];
      const map = new Map<string, string>();
      snap.docs.forEach((d) => {
        const name = d.data().programmeName ?? '';
        const faculty = d.data().faculty ?? '';
        if (name) { names.push(name); map.set(name, faculty); }
      });
      setProgrammeOptions(names.sort());
      setProgrammeFacultyMap(map);
    });
  }, []);

  // ── Table filters ─────────────────────────────────────────────────────────
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const facultyOptions = Array.from(new Set(students.map((s) => programmeFacultyMap.get(s.programme) ?? s.faculty).filter(Boolean))).sort();
  const programmeFilterOptions = filterFaculty
    ? programmeOptions.filter((p) => programmeFacultyMap.get(p) === filterFaculty)
    : programmeOptions;


  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    if (q && !s.studentId.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !s.programme.toLowerCase().includes(q)) return false;
    if (filterFaculty && (programmeFacultyMap.get(s.programme) ?? s.faculty) !== filterFaculty) return false;
    if (filterProgramme && s.programme !== filterProgramme) return false;
    if (filterYear && (LEVEL_TO_YEAR[s.level] ?? s.level) !== filterYear) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  // ── CSV ───────────────────────────────────────────────────────────────────

  const handleDownloadTemplate = () => {
    const csvContent = CSV_TEMPLATE_HEADERS + "\n" + CSV_TEMPLATE_SAMPLE;
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "enrollment_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const results = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: resolve,
      });
    });
    const rows = results.data;
    let created = 0;
    let duplicates = 0;
    for (const row of rows) {
      const studentId = row["StudentID"]?.trim();
      if (!studentId) { duplicates++; continue; }
      const existing = await getDocs(
        query(collection(db, "students"), where("studentId", "==", studentId))
      );
      if (!existing.empty) { duplicates++; continue; }
      await addDoc(collection(db, "students"), {
        studentId,
        name: row["FullName"]?.trim() ?? "",
        email: row["Email"]?.trim() ?? "",
        gender: row["Gender"]?.trim() ?? "",
        dateOfBirth: row["DateOfBirth"]?.trim() ?? "",
        contactNumber: row["ContactNumber"]?.trim() ?? "",
        faculty: row["Faculty"]?.trim() ?? "",
        programme: row["Programme"]?.trim() ?? "",
        level: row["YearOfStudy"]?.trim() ?? "",
        intake: row["Intake"]?.trim() ?? "",
        enrollmentDate: row["EnrollmentDate"]?.trim() ?? "",
        studentType: row["StudentType"]?.trim() ?? "",
        address: row["Address"]?.trim() ?? "",
        emergencyContactName: row["EmergencyContactName"]?.trim() ?? "",
        emergencyContactNumber: row["EmergencyContactNumber"]?.trim() ?? "",
        emergencyContactRelationship: row["EmergencyContactRelationship"]?.trim() ?? "",
        nationality: row["Nationality"]?.trim() ?? "",
        ethnicity: row["Ethnicity"]?.trim() ?? "",
        religion: row["Religion"]?.trim() ?? "",
        financial_aid: (row["FinancialAid"]?.trim() ?? "").toLowerCase() === "yes",
        deferral_months: parseInt(row["DeferralMonths"]?.trim() ?? "0", 10) || 0,
        status: "pending",
        accountActivated: false,
        gpa: 0,
        attendancePercentage: 0,
        consecutiveAbsences: 0,
        riskLevel: "low",
        riskScore: 0,
        interventions: [],
        appointments: [],
        gpa_by_semester: [0],
        attendance_by_semester: [0],
        gpa_history: 0,
        createdAt: serverTimestamp(),
      });
      created++;
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success(`${created} student${created !== 1 ? "s" : ""} enrolled, ${duplicates} duplicate${duplicates !== 1 ? "s" : ""} skipped`);
  };

  // ── View ──────────────────────────────────────────────────────────────────

  const openView = (student: StudentRecord) => {
    setViewStudent(student);
    setIsViewOpen(true);
  };

  // ── Edit ──────────────────────────────────────────────────────────────────

  const openEdit = (student: StudentRecord) => {
    setEditStudent(student);
    setEdProgramme(student.programme);
    setEdFaculty(student.faculty || (programmeFacultyMap.get(student.programme) ?? ''));
    setEdLevel(LEVEL_TO_YEAR[student.level] ?? student.level);
    setEdIntake(student.intake);
    setEdEnrollmentDate(student.enrollmentDate);
    setEdGender(student.gender);
    setEdDateOfBirth(student.dateOfBirth);
    setEdContactNumber(student.contactNumber);
    setEdStudentType(student.studentType);
    setEdEmergencyContactName(student.emergencyContactName ?? "");
    setEdEmergencyContactNumber(student.emergencyContactNumber ?? "");
    setEdStatus(student.status || (student.accountActivated ? 'active' : 'pending'));
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!editStudent || !edProgramme || !edLevel || !edIntake) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "students", editStudent.id), {
        programme: edProgramme,
        faculty: edFaculty,
        level: edLevel,
        intake: edIntake,
        enrollmentDate: edEnrollmentDate,
        gender: edGender,
        dateOfBirth: edDateOfBirth,
        contactNumber: edContactNumber,
        studentType: edStudentType,
        emergencyContactName: edEmergencyContactName,
        emergencyContactNumber: edEmergencyContactNumber,
        status: edStatus,
      });
      toast.success("Student details updated");
      setIsEditOpen(false);
    } catch {
      toast.error("Failed to update student details.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const openDelete = (student: StudentRecord) => {
    setDeleteStudent(student);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteStudent) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "students", deleteStudent.id));
      toast.success(`${deleteStudent.name} removed from records`);
      setIsDeleteOpen(false);
    } catch {
      toast.error("Failed to delete student record.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Status badge helper ───────────────────────────────────────────────────

  const getStatusBadge = (student: StudentRecord) => {
    const effectiveStatus = student.accountActivated && (!student.status || student.status === 'pending')
      ? 'active'
      : student.status || 'pending';
    switch (effectiveStatus) {
      case 'active':    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case 'pending':   return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
      case 'withdrawn': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Withdrawn</Badge>;
      case 'deferred':  return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Deferred</Badge>;
      case 'suspended': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Suspended</Badge>;
      case 'graduated': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Graduated</Badge>;
      default:          return <Badge variant="outline">{effectiveStatus}</Badge>;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Records</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage student enrollment and academic records
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload Enrollment CSV"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-900 font-medium">
            Failed to load students. Please refresh the page.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalEnrolled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{activeStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Activation</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">{pendingActivation}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Other Status</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-muted-foreground">{otherStatusCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Withdrawn / Deferred / Suspended</p>
          </CardContent>
        </Card>
      </div>

      {/* Student Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Enrolled Students</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filtered.length} of {students.length} students
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, name, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <Select value={filterFaculty || '_all'} onValueChange={(v) => { setFilterFaculty(v === '_all' ? '' : v); setFilterProgramme(''); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Faculties" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Faculties</SelectItem>
                {facultyOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterProgramme || '_all'} onValueChange={(v) => setFilterProgramme(v === '_all' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Programmes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Programmes</SelectItem>
                {programmeFilterOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterYear || '_all'} onValueChange={(v) => setFilterYear(v === '_all' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Years" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Years</SelectItem>
                {['Year 1', 'Year 2', 'Year 3', 'Year 4'].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus || '_all'} onValueChange={(v) => setFilterStatus(v === '_all' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
                <SelectItem value="deferred">Deferred</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading students…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">
                {students.length === 0
                  ? "No students enrolled yet. Upload a CSV to get started."
                  : "No students match your search."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Programme</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Year</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <tr key={student.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{student.studentId}</td>
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{student.programme || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{(LEVEL_TO_YEAR[student.level] ?? student.level) || '—'}</td>
                      <td className="px-4 py-3">
                        {getStatusBadge(student)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="View"
                            onClick={() => openView(student)}
                          >
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Edit"
                            onClick={() => openEdit(student)}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Delete"
                            onClick={() => openDelete(student)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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

      {/* ── View Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>{viewStudent?.studentId}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {viewStudent && (
              <>
                <Section label="Personal Information">
                  <Row label="Full Name" value={viewStudent.name} />
                  <Row label="Student ID" value={viewStudent.studentId} mono />
                  <Row label="Email" value={viewStudent.email} />
                  <Row label="Gender" value={viewStudent.gender} />
                  <Row label="Date of Birth" value={viewStudent.dateOfBirth} />
                  <Row label="Contact Number" value={viewStudent.contactNumber} />
                  <Row label="Nationality" value={viewStudent.nationality} />
                  <Row label="Religion" value={viewStudent.religion} />
                  <Row label="Address" value={viewStudent.address} />
                </Section>
                <Section label="Academic Information">
                  <Row label="Programme" value={viewStudent.programme} />
                  <Row label="Faculty" value={viewStudent.faculty} />
                  <Row label="Level" value={viewStudent.level} />
                  <Row label="Student Type" value={viewStudent.studentType} />
                  <Row label="Intake" value={viewStudent.intake} />
                  <Row label="Enrollment Date" value={viewStudent.enrollmentDate} />
                  <Row label="Status">
                    {getStatusBadge(viewStudent)}
                  </Row>
                </Section>
                <Section label="Emergency Contact">
                  <Row label="Name" value={viewStudent.emergencyContactName} />
                  <Row label="Number" value={viewStudent.emergencyContactNumber} />
                  <Row label="Relationship" value={viewStudent.emergencyContactRelationship} />
                </Section>
              </>
            )}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button size="sm" variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Student Details</DialogTitle>
            <DialogDescription>Update details for {editStudent?.name}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 bg-gray-50">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Student Name</Label>
                <p className="text-sm font-medium">{editStudent?.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Student ID</Label>
                <p className="text-sm font-medium font-mono">{editStudent?.studentId}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-email">Email</Label>
              <Input id="ed-email" value={editStudent?.email ?? ""} readOnly className="bg-gray-50 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-programme">Programme <span className="text-red-500">*</span></Label>
              <Select value={edProgramme} onValueChange={(v) => {
                setEdProgramme(v);
                setEdFaculty(programmeFacultyMap.get(v) ?? '');
              }}>
                <SelectTrigger id="ed-programme"><SelectValue placeholder="— Select Programme —" /></SelectTrigger>
                <SelectContent>
                  {programmeOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-faculty">Faculty</Label>
              <Input id="ed-faculty" value={edFaculty} readOnly className="bg-gray-50 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-level">Level <span className="text-red-500">*</span></Label>
              <Select value={edLevel} onValueChange={setEdLevel}>
                <SelectTrigger id="ed-level"><SelectValue placeholder="— Select Level —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Year 1">Year 1</SelectItem>
                  <SelectItem value="Year 2">Year 2</SelectItem>
                  <SelectItem value="Year 3">Year 3</SelectItem>
                  <SelectItem value="Year 4">Year 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-studenttype">Student Type</Label>
              <Select value={edStudentType} onValueChange={setEdStudentType}>
                <SelectTrigger id="ed-studenttype"><SelectValue placeholder="— Select —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-intake">Intake <span className="text-red-500">*</span></Label>
              <Select value={edIntake} onValueChange={setEdIntake}>
                <SelectTrigger id="ed-intake"><SelectValue placeholder="— Select Intake —" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 13 }, (_, i) => String(2018 + i)).map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-enrollment">Enrollment Date</Label>
              <Input id="ed-enrollment" type="date" value={edEnrollmentDate} onChange={(e) => setEdEnrollmentDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-gender">Gender</Label>
              <Select value={edGender} onValueChange={setEdGender}>
                <SelectTrigger id="ed-gender"><SelectValue placeholder="— Select —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-dob">Date of Birth</Label>
              <Input id="ed-dob" type="date" value={edDateOfBirth} onChange={(e) => setEdDateOfBirth(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-contact">Contact Number</Label>
              <Input id="ed-contact" type="tel" placeholder="+94 77 000 0000" value={edContactNumber} onChange={(e) => setEdContactNumber(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-ec-name">Emergency Contact Name</Label>
              <Input id="ed-ec-name" placeholder="Full name" value={edEmergencyContactName} onChange={(e) => setEdEmergencyContactName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-ec-number">Emergency Contact Number</Label>
              <Input id="ed-ec-number" type="tel" placeholder="+94 77 000 0000" value={edEmergencyContactNumber} onChange={(e) => setEdEmergencyContactNumber(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-status">Student Status</Label>
              <Select value={edStatus} onValueChange={setEdStatus}>
                <SelectTrigger id="ed-status"><SelectValue placeholder="— Select Status —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  <SelectItem value="deferred">Deferred</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button size="sm" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Student Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-gray-900">{deleteStudent?.name}</span>{" "}
              ({deleteStudent?.studentId})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Small helpers for View modal ──────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="rounded-lg border divide-y">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="text-muted-foreground w-40 shrink-0">{label}</span>
      {children ?? (
        <span className={`text-right ${mono ? "font-mono text-xs" : ""}`}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}
