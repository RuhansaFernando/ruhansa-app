import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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
import { Users, UserCog, Search } from "lucide-react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

const IIT_PROGRAMMES = [
  "BSc (Hons) Computer Science",
  "BSc (Hons) Software Engineering",
  "BSc (Hons) Information Technology",
  "BSc (Hons) Cyber Security",
  "BSc (Hons) Data Science",
  "BSc (Hons) Artificial Intelligence",
  "BSc (Hons) Business Information Systems",
  "BSc (Hons) Business Computing",
];

const BUSINESS_PROGRAMMES = [
  "BSc (Hons) Business Information Systems",
  "BSc (Hons) Business Computing",
];

function getFacultyForProgramme(programme: string): string {
  return BUSINESS_PROGRAMMES.includes(programme)
    ? "Business School"
    : "School of Computing";
}

interface StudentRecord {
  id: string;
  studentId: string;
  name: string;
  email: string;
  programme: string;
  level: string;
  faculty: string;
  intake: string;
  enrollmentDate: string;
  gender: string;
  dateOfBirth: string;
  contactNumber: string;
  academicMentor: string;
}

interface TutorRecord {
  id: string;
  name: string;
}

export default function RegistryStudentDetailsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [tutors, setTutors] = useState<TutorRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [tutorFilter, setTutorFilter] = useState("all");

  // Edit Details modal
  const [isEditDetailsOpen, setIsEditDetailsOpen] = useState(false);
  const [editDetailsStudent, setEditDetailsStudent] = useState<StudentRecord | null>(null);
  const [edProgramme, setEdProgramme] = useState("");
  const [edFaculty, setEdFaculty] = useState("");
  const [edLevel, setEdLevel] = useState("");
  const [edIntake, setEdIntake] = useState("");
  const [edEnrollmentDate, setEdEnrollmentDate] = useState("");
  const [edGender, setEdGender] = useState("");
  const [edDateOfBirth, setEdDateOfBirth] = useState("");
  const [edContactNumber, setEdContactNumber] = useState("");
  const [edPersonalTutor, setEdPersonalTutor] = useState("none");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  useEffect(() => {
    const unsubStudents = onSnapshot(
      query(collection(db, "students"), orderBy("name")),
      (snap) => {
        setStudents(
          snap.docs.map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? d.id,
            name: d.data().name ?? "",
            email: d.data().email ?? "",
            programme: d.data().programme ?? "",
            level: d.data().level ?? "",
            faculty: d.data().faculty ?? "",
            intake: d.data().intake ?? "",
            enrollmentDate: d.data().enrollmentDate ?? "",
            gender: d.data().gender ?? "",
            dateOfBirth: d.data().dateOfBirth ?? "",
            contactNumber: d.data().contactNumber ?? "",
            academicMentor: d.data().academicMentor ?? "",
          }))
        );
        setLoading(false);
      }
    );

    const unsubTutors = onSnapshot(
      query(collection(db, "academic_mentors"), where("status", "==", "active"), orderBy("name")),
      (snap) => {
        setTutors(snap.docs.map((d) => ({ id: d.id, name: d.data().name ?? "" })));
      }
    );

    return () => {
      unsubStudents();
      unsubTutors();
    };
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.studentId.toLowerCase().includes(search.toLowerCase());
      const matchesProgramme =
        programmeFilter === "all" || s.programme === programmeFilter;
      const matchesLevel =
        levelFilter === "all" || s.level === levelFilter;
      const matchesTutor =
        tutorFilter === "all" ||
        (tutorFilter === "assigned" && s.academicMentor !== "") ||
        (tutorFilter === "not_assigned" && s.academicMentor === "");
      return matchesSearch && matchesProgramme && matchesLevel && matchesTutor;
    });
  }, [students, search, programmeFilter, levelFilter, tutorFilter]);

  const openEditDetails = (student: StudentRecord) => {
    setEditDetailsStudent(student);
    setEdProgramme(student.programme);
    setEdFaculty(
      student.faculty ||
        (student.programme ? getFacultyForProgramme(student.programme) : "")
    );
    setEdLevel(student.level);
    setEdIntake(student.intake);
    setEdEnrollmentDate(student.enrollmentDate);
    setEdGender(student.gender);
    setEdDateOfBirth(student.dateOfBirth);
    setEdContactNumber(student.contactNumber);
    setEdPersonalTutor(student.academicMentor || "none");
    setIsEditDetailsOpen(true);
  };

  const handleSaveDetails = async () => {
    if (!editDetailsStudent || !edProgramme || !edLevel || !edIntake) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSavingDetails(true);
    try {
      await updateDoc(doc(db, "students", editDetailsStudent.id), {
        programme: edProgramme,
        faculty: edFaculty,
        level: edLevel,
        intake: edIntake,
        enrollmentDate: edEnrollmentDate,
        gender: edGender,
        dateOfBirth: edDateOfBirth,
        contactNumber: edContactNumber,
        academicMentor: edPersonalTutor === "none" ? "" : edPersonalTutor,
      });
      toast.success("Student details updated successfully");
      setIsEditDetailsOpen(false);
    } catch {
      toast.error("Failed to update student details. Please try again.");
    } finally {
      setIsSavingDetails(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Student Details</h1>
        <p className="text-muted-foreground">Manage student academic information</p>
      </div>

      {/* Summary Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardDescription>Total Students</CardDescription>
            <CardTitle className="text-3xl">{students.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Registered students</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardDescription>Tutor Assigned</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {students.filter((s) => s.academicMentor !== "").length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Students with an academic mentor</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-3">
            <CardDescription>No Tutor</CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {students.filter((s) => s.academicMentor === "").length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Students without an academic mentor</p>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          <CardDescription>All registered students and their academic details</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or student ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="All Programmes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programmes</SelectItem>
                {IIT_PROGRAMMES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="Level 4">Level 4</SelectItem>
                <SelectItem value="Level 5">Level 5</SelectItem>
                <SelectItem value="Level 6">Level 6</SelectItem>
                <SelectItem value="Industrial Placement">Industrial Placement</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tutorFilter} onValueChange={setTutorFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Tutor Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="assigned">Tutor Assigned</SelectItem>
                <SelectItem value="not_assigned">No Tutor</SelectItem>
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
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No students found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Student ID
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Name
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Email
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Programme
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Level
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Intake
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Academic Mentor
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">
                      Actions
                    </th>
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
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {student.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[160px] truncate">
                        {student.programme ? (
                          student.programme
                        ) : (
                          <span className="text-muted-foreground/50 italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {student.level || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {student.intake || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {student.academicMentor ? (
                          student.academicMentor
                        ) : (
                          <span className="text-muted-foreground/50 italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openEditDetails(student)}
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            Edit Details
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

      {/* Edit Details Modal */}
      <Dialog open={isEditDetailsOpen} onOpenChange={setIsEditDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Details</DialogTitle>
            <DialogDescription>
              Update details for {editDetailsStudent?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Read-only info */}
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 bg-gray-50">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Student Name</Label>
                <p className="text-sm font-medium">{editDetailsStudent?.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Student ID</Label>
                <p className="text-sm font-medium font-mono">{editDetailsStudent?.studentId}</p>
              </div>
            </div>

            {/* Programme */}
            <div className="space-y-2">
              <Label htmlFor="ed-programme">
                Programme <span className="text-red-500">*</span>
              </Label>
              <Select
                value={edProgramme}
                onValueChange={(v) => {
                  setEdProgramme(v);
                  setEdFaculty(getFacultyForProgramme(v));
                }}
              >
                <SelectTrigger id="ed-programme">
                  <SelectValue placeholder="— Select Programme —" />
                </SelectTrigger>
                <SelectContent>
                  {IIT_PROGRAMMES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Faculty (auto-filled) */}
            <div className="space-y-2">
              <Label htmlFor="ed-faculty">Faculty</Label>
              <Input
                id="ed-faculty"
                value={edFaculty}
                readOnly
                className="bg-gray-50 text-muted-foreground"
              />
            </div>

            {/* Level */}
            <div className="space-y-2">
              <Label htmlFor="ed-level">
                Level <span className="text-red-500">*</span>
              </Label>
              <Select value={edLevel} onValueChange={setEdLevel}>
                <SelectTrigger id="ed-level">
                  <SelectValue placeholder="— Select Level —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Level 4">Level 4</SelectItem>
                  <SelectItem value="Level 5">Level 5</SelectItem>
                  <SelectItem value="Level 6">Level 6</SelectItem>
                  <SelectItem value="Industrial Placement">Industrial Placement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Intake */}
            <div className="space-y-2">
              <Label htmlFor="ed-intake">
                Intake <span className="text-red-500">*</span>
              </Label>
              <Select value={edIntake} onValueChange={setEdIntake}>
                <SelectTrigger id="ed-intake">
                  <SelectValue placeholder="— Select Intake —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2022 Spring">2022 Spring</SelectItem>
                  <SelectItem value="2022 Fall">2022 Fall</SelectItem>
                  <SelectItem value="2023 Spring">2023 Spring</SelectItem>
                  <SelectItem value="2023 Fall">2023 Fall</SelectItem>
                  <SelectItem value="2024 Spring">2024 Spring</SelectItem>
                  <SelectItem value="2024 Fall">2024 Fall</SelectItem>
                  <SelectItem value="2025 Fall">2025 Fall</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Enrollment Date */}
            <div className="space-y-2">
              <Label htmlFor="ed-enrollment">Enrollment Date</Label>
              <Input
                id="ed-enrollment"
                type="date"
                value={edEnrollmentDate}
                onChange={(e) => setEdEnrollmentDate(e.target.value)}
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="ed-gender">Gender</Label>
              <Select value={edGender} onValueChange={setEdGender}>
                <SelectTrigger id="ed-gender">
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="ed-dob">Date of Birth</Label>
              <Input
                id="ed-dob"
                type="date"
                value={edDateOfBirth}
                onChange={(e) => setEdDateOfBirth(e.target.value)}
              />
            </div>

            {/* Contact Number */}
            <div className="space-y-2">
              <Label htmlFor="ed-contact">Contact Number</Label>
              <Input
                id="ed-contact"
                type="tel"
                placeholder="+94 77 000 0000"
                value={edContactNumber}
                onChange={(e) => setEdContactNumber(e.target.value)}
              />
            </div>

            {/* Personal Tutor */}
            <div className="space-y-2">
              <Label htmlFor="ed-tutor">Academic Mentor</Label>
              <Select value={edPersonalTutor} onValueChange={setEdPersonalTutor}>
                <SelectTrigger id="ed-tutor">
                  <SelectValue placeholder="— Select Tutor —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tutors.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsEditDetailsOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={isSavingDetails} onClick={handleSaveDetails}>
              {isSavingDetails ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
