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
import { Checkbox } from "../components/ui/checkbox";
import { Textarea } from "../components/ui/textarea";
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
import { Bell, CalendarClock, Check, X as XIcon, BookOpen, Plus, UserCog } from "lucide-react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../AuthContext";

interface StudentRecord {
  id: string;
  studentId: string;
  name: string;
  programme: string;
  level: string;
  gpa: number;
  attendancePercentage: number;
  consecutiveAbsences: number;
  academicMentor: string;
  faculty: string;
  intake: string;
  enrollmentDate: string;
  gender: string;
  dateOfBirth: string;
  contactNumber: string;
}

interface TutorRecord {
  id: string;
  name: string;
}

interface ModuleRecord {
  id: string;
  moduleCode: string;
  moduleName: string;
  programme: string;
  semester: string;
  components: { name: string; weight: number }[];
}

interface ResultRecord {
  id: string;
  studentId: string;
  studentName: string;
  programme: string;
  moduleId: string;
  moduleName: string;
  component1Name: string;
  component1Mark: number;
  component1Status: "pass" | "fail";
  component1Submitted: boolean;
  component2Name: string;
  component2Mark: number;
  component2Status: "pass" | "fail";
  component2Submitted: boolean;
  overallMark: number;
  moduleStatus: "pass" | "fail";
  notes: string;
  academicYear: string;
  semester: string;
  recordedBy: string;
}

interface ProgrammeRecord {
  name: string;
  faculty: string;
}

const LEVEL_SEMESTERS: Record<string, string[]> = {
  "Level 4": ["Semester 1", "Semester 2"],
  "Level 5": ["Semester 3", "Semester 4"],
  "Level 6": ["Semester 5", "Semester 6"],
};

function getAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() + 1 >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export default function RegistryGradesPage() {
  const { user } = useAuth();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [meetingsCount, setMeetingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [programmes, setProgrammes] = useState<ProgrammeRecord[]>([]);

  const getFacultyForProgramme = (programme: string): string => {
    const found = programmes.find((p) => p.name === programme);
    return found?.faculty ?? "School of Computing";
  };

  // Filters
  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Marks modal
  const [isMarksOpen, setIsMarksOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<ResultRecord | null>(null);
  const [selStudentId, setSelStudentId] = useState("");
  const [selModuleId, setSelModuleId] = useState("");
  const [comp1Submitted, setComp1Submitted] = useState(false);
  const [comp1Mark, setComp1Mark] = useState("");
  const [comp2Submitted, setComp2Submitted] = useState(false);
  const [comp2Mark, setComp2Mark] = useState("");
  const [marksNotes, setMarksNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Tutor assignment modal
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorStudent, setTutorStudent] = useState<StudentRecord | null>(null);
  const [tutors, setTutors] = useState<TutorRecord[]>([]);
  const [selectedTutorName, setSelectedTutorName] = useState("");
  const [isSavingTutor, setIsSavingTutor] = useState(false);

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
  const [edPersonalTutor, setEdPersonalTutor] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Meeting modal
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [meetingResult, setMeetingResult] = useState<ResultRecord | null>(null);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, "programmes"), orderBy("programmeName"))).then((snap) => {
      setProgrammes(
        snap.docs
          .map((d) => ({ name: d.data().programmeName ?? "", faculty: d.data().faculty ?? "" }))
          .filter((p) => p.name)
      );
    });

    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? d.id,
          name: d.data().name ?? "",
          programme: d.data().programme ?? "",
          level: d.data().level ?? "",
          gpa: d.data().gpa ?? 0,
          attendancePercentage: d.data().attendancePercentage ?? 0,
          consecutiveAbsences: d.data().consecutiveAbsences ?? 0,
          academicMentor: d.data().academicMentor ?? "",
          faculty: d.data().faculty ?? "",
          intake: d.data().intake ?? "",
          enrollmentDate: d.data().enrollmentDate ?? "",
          gender: d.data().gender ?? "",
          dateOfBirth: d.data().dateOfBirth ?? "",
          contactNumber: d.data().contactNumber ?? "",
        }))
      );
      setLoading(false);
    });

    const unsubModules = onSnapshot(
      query(collection(db, "modules"), orderBy("moduleCode")),
      (snap) => {
        setModules(
          snap.docs.map((d) => ({
            id: d.id,
            moduleCode: d.data().moduleCode ?? "",
            moduleName: d.data().moduleName ?? "",
            programme: d.data().programme ?? "",
            semester: d.data().semester ?? "",
            components: d.data().components ?? [],
          }))
        );
      }
    );

    const unsubResults = onSnapshot(
      query(collection(db, "results"), orderBy("studentName")),
      (snap) => {
        setResults(
          snap.docs.map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? "",
            studentName: d.data().studentName ?? "",
            programme: d.data().programme ?? "",
            moduleId: d.data().moduleId ?? "",
            moduleName: d.data().moduleName ?? "",
            component1Name: d.data().component1Name ?? "",
            component1Mark: d.data().component1Mark ?? 0,
            component1Status: d.data().component1Status ?? "fail",
            component1Submitted: d.data().component1Submitted ?? false,
            component2Name: d.data().component2Name ?? "",
            component2Mark: d.data().component2Mark ?? 0,
            component2Status: d.data().component2Status ?? "fail",
            component2Submitted: d.data().component2Submitted ?? false,
            overallMark: d.data().overallMark ?? 0,
            moduleStatus: d.data().moduleStatus ?? "fail",
            notes: d.data().notes ?? "",
            academicYear: d.data().academicYear ?? "",
            semester: d.data().semester ?? "",
            recordedBy: d.data().recordedBy ?? "",
          }))
        );
      }
    );

    const unsubMeetings = onSnapshot(collection(db, "meetings"), (snap) => {
      setMeetingsCount(snap.size);
    });

    const unsubTutors = onSnapshot(
      query(collection(db, "academic_mentors"), where("status", "==", "active"), orderBy("name")),
      (snap) => {
        setTutors(snap.docs.map((d) => ({ id: d.id, name: d.data().name ?? "" })));
      }
    );

    return () => {
      unsubStudents();
      unsubModules();
      unsubResults();
      unsubMeetings();
      unsubTutors();
    };
  }, []);

  // Summary counts
  const failingStudentsCount = useMemo(() => {
    const ids = new Set(
      results.filter((r) => r.moduleStatus === "fail").map((r) => r.studentId)
    );
    return ids.size;
  }, [results]);

  const missingSubmissionsCount = useMemo(
    () => results.filter((r) => !r.component1Submitted || !r.component2Submitted).length,
    [results]
  );

  // Modules available in the filter (based on programme + level selection)
  const availableModulesForFilter = useMemo(() => {
    return modules.filter((m) => {
      const matchesProg = programmeFilter === "all" || m.programme === programmeFilter;
      const matchesLevel =
        levelFilter === "all" ||
        (LEVEL_SEMESTERS[levelFilter] ?? []).includes(m.semester);
      return matchesProg && matchesLevel;
    });
  }, [modules, programmeFilter, levelFilter]);

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const matchesProg = programmeFilter === "all" || r.programme === programmeFilter;
      const matchesLevel =
        levelFilter === "all" ||
        (LEVEL_SEMESTERS[levelFilter] ?? []).includes(r.semester);
      const matchesModule = moduleFilter === "all" || r.moduleId === moduleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pass" && r.moduleStatus === "pass") ||
        (statusFilter === "fail" && r.moduleStatus === "fail") ||
        (statusFilter === "missing" &&
          (!r.component1Submitted || !r.component2Submitted));
      return matchesProg && matchesLevel && matchesModule && matchesStatus;
    });
  }, [results, programmeFilter, levelFilter, moduleFilter, statusFilter]);

  // Filtered students for main table
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesProg = programmeFilter === "all" || s.programme === programmeFilter;
      const matchesLevel = levelFilter === "all" || s.level === levelFilter;
      return matchesProg && matchesLevel;
    });
  }, [students, programmeFilter, levelFilter]);

  // Module for the marks modal (editing or new selection)
  const marksModule = useMemo(() => {
    const id = editingResult ? editingResult.moduleId : selModuleId;
    return modules.find((m) => m.id === id) ?? null;
  }, [modules, editingResult, selModuleId]);

  // Modules available for new result (filtered by selected student's programme)
  const newResultModules = useMemo(() => {
    if (editingResult) return [];
    const student = students.find((s) => s.id === selStudentId);
    if (!student) return modules;
    return modules.filter((m) => m.programme === student.programme);
  }, [modules, students, selStudentId, editingResult]);

  const openAddMarks = () => {
    setEditingResult(null);
    setSelStudentId("");
    setSelModuleId("");
    setComp1Submitted(false);
    setComp1Mark("");
    setComp2Submitted(false);
    setComp2Mark("");
    setMarksNotes("");
    setIsMarksOpen(true);
  };

  const openAddMarksForStudent = (student: StudentRecord) => {
    setEditingResult(null);
    setSelStudentId(student.id);
    setSelModuleId("");
    setComp1Submitted(false);
    setComp1Mark("");
    setComp2Submitted(false);
    setComp2Mark("");
    setMarksNotes("");
    setIsMarksOpen(true);
  };

  const openEditMarks = (result: ResultRecord) => {
    setEditingResult(result);
    setSelStudentId("");
    setSelModuleId("");
    setComp1Submitted(result.component1Submitted);
    setComp1Mark(result.component1Submitted ? String(result.component1Mark) : "");
    setComp2Submitted(result.component2Submitted);
    setComp2Mark(result.component2Submitted ? String(result.component2Mark) : "");
    setMarksNotes(result.notes);
    setIsMarksOpen(true);
  };

  const handleSaveMarks = async () => {
    const student = editingResult
      ? students.find((s) => s.id === editingResult.studentId)
      : students.find((s) => s.id === selStudentId);

    if (!student || !marksModule) {
      toast.error("Please select a student and module");
      return;
    }

    const c1Mark = comp1Submitted ? Number(comp1Mark) : 0;
    const c2Mark = comp2Submitted ? Number(comp2Mark) : 0;

    if (comp1Submitted && (isNaN(c1Mark) || c1Mark < 0 || c1Mark > 100)) {
      toast.error("Component 1 mark must be between 0 and 100");
      return;
    }
    if (comp2Submitted && (isNaN(c2Mark) || c2Mark < 0 || c2Mark > 100)) {
      toast.error("Component 2 mark must be between 0 and 100");
      return;
    }

    const comp1 = marksModule.components[0] ?? { name: "Component 1", weight: 50 };
    const comp2 = marksModule.components[1] ?? { name: "Component 2", weight: 50 };

    const c1Status: "pass" | "fail" = comp1Submitted && c1Mark >= 30 ? "pass" : "fail";
    const c2Status: "pass" | "fail" = comp2Submitted && c2Mark >= 30 ? "pass" : "fail";

    const overallMark = Math.round(
      ((comp1Submitted ? c1Mark : 0) * comp1.weight +
        (comp2Submitted ? c2Mark : 0) * comp2.weight) /
        100
    );

    const moduleStatus: "pass" | "fail" =
      overallMark >= 40 && c1Status === "pass" && c2Status === "pass" ? "pass" : "fail";

    const payload = {
      studentId: student.id,
      studentName: student.name,
      programme: student.programme,
      moduleId: marksModule.id,
      moduleName: marksModule.moduleName,
      component1Name: comp1.name,
      component1Mark: c1Mark,
      component1Status: c1Status,
      component1Submitted: comp1Submitted,
      component2Name: comp2.name,
      component2Mark: c2Mark,
      component2Status: c2Status,
      component2Submitted: comp2Submitted,
      overallMark,
      moduleStatus,
      notes: marksNotes.trim(),
      academicYear: getAcademicYear(),
      semester: marksModule.semester,
      recordedBy: user?.name ?? "",
    };

    setIsSaving(true);
    try {
      if (editingResult) {
        await updateDoc(doc(db, "results", editingResult.id), payload);
      } else {
        const newDoc = await addDoc(collection(db, "results"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "results", newDoc.id), { resultId: newDoc.id });
      }

      // Recalculate GPA for the student
      await recalculateStudentRisk(student.id);

      toast.success("Marks saved successfully");
      setIsMarksOpen(false);
    } catch {
      toast.error("Failed to save marks. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const recalculateStudentRisk = async (
    studentId: string
  ) => {
    const snap = await getDocs(
      query(collection(db, "results"), where("studentId", "==", studentId))
    );
    const marks = snap.docs
      .map((d) => d.data().overallMark as number)
      .filter((m) => !isNaN(m));
    const avgMark =
      marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : 0;
    const gpa = Math.min(4.0, Math.round((avgMark / 25) * 100) / 100);
    await updateDoc(doc(db, "students", studentId), { gpa });
  };

  const openAssignTutor = (student: StudentRecord) => {
    setTutorStudent(student);
    setSelectedTutorName("");
    setIsTutorOpen(true);
  };

  const handleSaveTutor = async () => {
    if (!tutorStudent || !selectedTutorName) {
      toast.error("Please select a tutor");
      return;
    }
    setIsSavingTutor(true);
    try {
      await updateDoc(doc(db, "students", tutorStudent.id), {
        academicMentor: selectedTutorName,
      });
      toast.success("Academic Mentor assigned successfully");
      setIsTutorOpen(false);
    } catch {
      toast.error("Failed to assign tutor. Please try again.");
    } finally {
      setIsSavingTutor(false);
    }
  };

  const openEditDetails = (student: StudentRecord) => {
    setEditDetailsStudent(student);
    setEdProgramme(student.programme);
    setEdFaculty(student.faculty || (student.programme ? getFacultyForProgramme(student.programme) : ""));
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

  const handleNotifySRU = async (result: ResultRecord) => {
    const missing: string[] = [];
    if (!result.component1Submitted)
      missing.push(result.component1Name || "Component 1");
    if (!result.component2Submitted)
      missing.push(result.component2Name || "Component 2");
    try {
      await addDoc(collection(db, "notifications"), {
        type: "missing_submission",
        studentId: result.studentId,
        studentName: result.studentName,
        programme: result.programme,
        moduleName: result.moduleName,
        missingComponents: missing,
        notifiedBy: user?.name ?? "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      toast.success("SRU has been notified");
    } catch {
      toast.error("Failed to notify SRU");
    }
  };

  const openScheduleMeeting = (result: ResultRecord) => {
    setMeetingResult(result);
    setMeetingDate("");
    setMeetingTime("");
    setMeetingNotes("");
    setIsMeetingOpen(true);
  };

  const handleSaveMeeting = async () => {
    if (!meetingResult || !meetingDate || !meetingTime) {
      toast.error("Please select a date and time for the meeting");
      return;
    }
    setIsSavingMeeting(true);
    try {
      const newMeeting = await addDoc(collection(db, "meetings"), {
        studentId: meetingResult.studentId,
        studentName: meetingResult.studentName,
        moduleId: meetingResult.moduleId,
        moduleName: meetingResult.moduleName,
        meetingDate,
        meetingTime,
        notes: meetingNotes.trim(),
        scheduledBy: user?.name ?? "",
        status: "scheduled",
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "meetings", newMeeting.id), {
        meetingId: newMeeting.id,
      });
      toast.success("Meeting scheduled successfully");
      setIsMeetingOpen(false);
    } catch {
      toast.error("Failed to schedule meeting");
    } finally {
      setIsSavingMeeting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Academic Records</h1>
          <p className="text-muted-foreground">
            Enter and manage student module marks
          </p>
        </div>
        <Button className="gap-2" onClick={openAddMarks}>
          <Plus className="h-4 w-4" />
          Enter Marks
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardDescription>Total Students</CardDescription>
            <CardTitle className="text-3xl">{students.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Registered students</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardDescription>Failing Students</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {failingStudentsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              At least one failed module
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-3">
            <CardDescription>Missing Submissions</CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {missingSubmissionsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Unsubmitted components
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardDescription>Meetings Scheduled</CardDescription>
            <CardTitle className="text-3xl text-purple-600">
              {meetingsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Support meetings</p>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Records</CardTitle>
          <CardDescription>All registered students</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
            <Select
              value={programmeFilter}
              onValueChange={(v) => {
                setProgrammeFilter(v);
                setModuleFilter("all");
              }}
            >
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="All Programmes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programmes</SelectItem>
                {programmes.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={levelFilter}
              onValueChange={(v) => {
                setLevelFilter(v);
                setModuleFilter("all");
              }}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="Level 4">Level 4</SelectItem>
                <SelectItem value="Level 5">Level 5</SelectItem>
                <SelectItem value="Level 6">Level 6</SelectItem>
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
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                      Student Name
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Programme
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Level
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Academic Mentor
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      GPA
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
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">
                        {student.programme}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {student.level || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {student.academicMentor || <span className="text-muted-foreground/50 italic">Not assigned</span>}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {student.gpa.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openAddMarksForStudent(student)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Enter Marks
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

      {/* Enter Marks Modal */}
      <Dialog open={isMarksOpen} onOpenChange={setIsMarksOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingResult ? "Edit Marks" : "Enter Marks"}
            </DialogTitle>
            <DialogDescription>
              {editingResult
                ? `Update marks for ${editingResult.studentName}`
                : "Enter module marks for a student"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editingResult ? (
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 bg-gray-50">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Student</Label>
                  <p className="text-sm font-medium">{editingResult.studentName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Module</Label>
                  <p className="text-sm font-medium">{editingResult.moduleName}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="selStudent">
                    Student <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={selStudentId}
                    onValueChange={(v) => {
                      setSelStudentId(v);
                      setSelModuleId("");
                    }}
                  >
                    <SelectTrigger id="selStudent">
                      <SelectValue placeholder="— Select Student —" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.studentId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selModule">
                    Module <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={selModuleId}
                    onValueChange={setSelModuleId}
                    disabled={!selStudentId}
                  >
                    <SelectTrigger id="selModule">
                      <SelectValue placeholder="— Select Module —" />
                    </SelectTrigger>
                    <SelectContent>
                      {newResultModules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.moduleCode} – {m.moduleName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {marksModule && (
              <>
                {/* Component 1 */}
                <div className="rounded-lg border p-3 space-y-3 bg-gray-50">
                  <p className="text-sm font-semibold">
                    {marksModule.components[0]?.name ?? "Component 1"}
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({marksModule.components[0]?.weight ?? 0}% weight)
                    </span>
                  </p>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="c1sub"
                      checked={comp1Submitted}
                      onCheckedChange={(v) => setComp1Submitted(v as boolean)}
                    />
                    <label htmlFor="c1sub" className="text-sm cursor-pointer">
                      Submitted
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c1mark" className="text-xs text-muted-foreground">
                      Mark (0–100)
                    </Label>
                    <Input
                      id="c1mark"
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 65"
                      value={comp1Mark}
                      onChange={(e) => setComp1Mark(e.target.value)}
                      disabled={!comp1Submitted}
                    />
                  </div>
                </div>

                {/* Component 2 */}
                <div className="rounded-lg border p-3 space-y-3 bg-gray-50">
                  <p className="text-sm font-semibold">
                    {marksModule.components[1]?.name ?? "Component 2"}
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({marksModule.components[1]?.weight ?? 0}% weight)
                    </span>
                  </p>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="c2sub"
                      checked={comp2Submitted}
                      onCheckedChange={(v) => setComp2Submitted(v as boolean)}
                    />
                    <label htmlFor="c2sub" className="text-sm cursor-pointer">
                      Submitted
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c2mark" className="text-xs text-muted-foreground">
                      Mark (0–100)
                    </Label>
                    <Input
                      id="c2mark"
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 72"
                      value={comp2Mark}
                      onChange={(e) => setComp2Mark(e.target.value)}
                      disabled={!comp2Submitted}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="marksNotes">Notes</Label>
              <Textarea
                id="marksNotes"
                placeholder="Optional notes…"
                value={marksNotes}
                onChange={(e) => setMarksNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsMarksOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={isSaving} onClick={handleSaveMarks}>
              {isSaving ? "Saving…" : "Save Marks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tutor Modal */}
      <Dialog open={isTutorOpen} onOpenChange={setIsTutorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Academic Mentor</DialogTitle>
            <DialogDescription>
              Assign an academic mentor to this student
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 bg-gray-50">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Student</Label>
                <p className="text-sm font-medium">{tutorStudent?.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Current Tutor</Label>
                <p className="text-sm font-medium">
                  {tutorStudent?.academicMentor || <span className="text-muted-foreground">None assigned</span>}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="selTutor">
                Select Tutor <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedTutorName} onValueChange={setSelectedTutorName}>
                <SelectTrigger id="selTutor">
                  <SelectValue placeholder="— Select Tutor —" />
                </SelectTrigger>
                <SelectContent>
                  {tutors.map((t) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsTutorOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={isSavingTutor} onClick={handleSaveTutor}>
              {isSavingTutor ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Details Modal */}
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
                  {programmes.length > 0
                    ? programmes.map((p) => (
                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                      ))
                    : <SelectItem value="__none__" disabled>No programmes found</SelectItem>
                  }
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
                  {Array.from({ length: 13 }, (_, i) => String(2018 + i)).map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
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

      {/* Schedule Meeting Modal */}
      <Dialog open={isMeetingOpen} onOpenChange={setIsMeetingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Support Meeting</DialogTitle>
            <DialogDescription>
              {meetingResult &&
                `Schedule a meeting for ${meetingResult.studentName} — ${meetingResult.moduleName}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {meetingResult && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 bg-gray-50">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Student</Label>
                  <p className="text-sm font-medium">{meetingResult.studentName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Module</Label>
                  <p className="text-sm font-medium">{meetingResult.moduleName}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="meetDate">
                Meeting Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="meetDate"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meetTime">
                Meeting Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="meetTime"
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meetNotes">Notes</Label>
              <Textarea
                id="meetNotes"
                placeholder="Optional meeting notes…"
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsMeetingOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSavingMeeting}
              onClick={handleSaveMeeting}
            >
              {isSavingMeeting ? "Saving…" : "Schedule Meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
