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
import { toast } from "sonner";
import { Upload, Download, Users, Clock, CheckCircle, Search } from "lucide-react";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import Papa from "papaparse";

const CSV_TEMPLATE_HEADERS =
  "StudentID,FullName,Email,Gender,DateOfBirth,ContactNumber,Faculty,Programme,YearOfStudy,Intake,EnrollmentDate,StudentType,Address,EmergencyContactName,EmergencyContactNumber,EmergencyContactRelationship,Nationality,Religion";
const CSV_TEMPLATE_SAMPLE =
  "STD020,Amal Perera,amal.perera@university.lk,Male,2000-05-15,0771234567,Business School,BSc (Hons) Business Information Systems,Year 1,2025,2025-01-15,Full-time,123 Main Street Colombo,Nimal Perera,0779876543,Father,Sri Lankan,Buddhist";

interface EnrolledStudent {
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
  status: string;
  accountActivated: boolean;
}

export default function RegistryEnrollmentPage() {
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
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
          status: d.data().status ?? "pending",
          accountActivated: d.data().accountActivated ?? false,
        }))
      );
    });
    return () => unsub();
  }, []);

  const totalEnrolled = students.length;
  const pendingActivation = students.filter((s) => !s.accountActivated).length;
  const activeStudents = students.filter((s) => s.accountActivated).length;

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.studentId.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.programme.toLowerCase().includes(q)
    );
  });

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
        religion: row["Religion"]?.trim() ?? "",
        status: "pending",
        accountActivated: false,
        gpa: 0,
        attendancePercentage: 0,
        consecutiveAbsences: 0,
        riskLevel: "low",
        riskScore: 0,
        academicMentor: "",
        interventions: [],
        appointments: [],
        mentorAssignmentHistory: [],
        createdAt: serverTimestamp(),
      });
      created++;
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success(`${created} student${created !== 1 ? "s" : ""} enrolled, ${duplicates} duplicate${duplicates !== 1 ? "s" : ""} skipped`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Student Enrollment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and manage new student enrollment data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Enrolled</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalEnrolled}</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{activeStudents}</p>
          </CardContent>
        </Card>
      </div>

      {/* Student List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">Enrolled Students</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Full Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Programme</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Year</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Intake</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{student.studentId}</td>
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{student.email}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{student.programme}</td>
                      <td className="px-4 py-3 text-muted-foreground">{student.level}</td>
                      <td className="px-4 py-3 text-muted-foreground">{student.studentType}</td>
                      <td className="px-4 py-3 text-muted-foreground">{student.intake}</td>
                      <td className="px-4 py-3">
                        {student.accountActivated ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
