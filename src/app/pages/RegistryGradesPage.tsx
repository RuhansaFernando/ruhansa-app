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
import { Bell, CalendarClock, Check, X as XIcon, BookOpen, Plus } from "lucide-react";
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
  gpa: number;
  attendancePercentage: number;
  consecutiveAbsences: number;
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

const PROGRAMMES = [
  "BSc (Hons) Computer Science",
  "BSc (Hons) Software Engineering",
  "BSc (Hons) Cyber Security",
  "BSc (Hons) Business Information Systems",
  "BEng (Hons) Electronic Engineering",
];

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

function calculateRisk(
  gpa: number,
  attendancePercentage: number,
  consecutiveAbsences: number
): { riskScore: number; riskLevel: string } {
  let riskScore = 0;

  if (gpa < 1.5) riskScore += 40;
  else if (gpa < 2.0) riskScore += 30;
  else if (gpa < 2.5) riskScore += 20;
  else if (gpa < 3.0) riskScore += 10;

  if (attendancePercentage < 60) riskScore += 40;
  else if (attendancePercentage < 70) riskScore += 30;
  else if (attendancePercentage < 75) riskScore += 20;
  else if (attendancePercentage < 80) riskScore += 10;

  if (consecutiveAbsences >= 7) riskScore += 20;
  else if (consecutiveAbsences >= 5) riskScore += 15;
  else if (consecutiveAbsences >= 3) riskScore += 10;
  else if (consecutiveAbsences >= 2) riskScore += 5;

  const riskLevel = riskScore >= 50 ? "high" : riskScore >= 25 ? "medium" : "low";
  return { riskScore, riskLevel };
}

export default function RegistryGradesPage() {
  const { user } = useAuth();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [meetingsCount, setMeetingsCount] = useState(0);
  const [loading, setLoading] = useState(true);

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

  // Meeting modal
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [meetingResult, setMeetingResult] = useState<ResultRecord | null>(null);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? d.id,
          name: d.data().name ?? "",
          programme: d.data().programme ?? "",
          gpa: d.data().gpa ?? 0,
          attendancePercentage: d.data().attendancePercentage ?? 0,
          consecutiveAbsences: d.data().consecutiveAbsences ?? 0,
        }))
      );
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
        setLoading(false);
      }
    );

    const unsubMeetings = onSnapshot(collection(db, "meetings"), (snap) => {
      setMeetingsCount(snap.size);
    });

    return () => {
      unsubStudents();
      unsubModules();
      unsubResults();
      unsubMeetings();
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

      // Recalculate GPA and risk for the student
      await recalculateStudentRisk(
        student.id,
        student.attendancePercentage,
        student.consecutiveAbsences
      );

      toast.success("Marks saved successfully");
      setIsMarksOpen(false);
    } catch {
      toast.error("Failed to save marks. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const recalculateStudentRisk = async (
    studentId: string,
    attendance: number,
    absences: number
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
    const { riskScore, riskLevel } = calculateRisk(gpa, attendance, absences);
    await updateDoc(doc(db, "students", studentId), { gpa, riskScore, riskLevel });
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

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Results</CardTitle>
          <CardDescription>Module marks and assessment results</CardDescription>
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
                {PROGRAMMES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
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

            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {availableModulesForFilter.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.moduleCode} – {m.moduleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[190px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
                <SelectItem value="missing">Missing Submission</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading results…
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No results found matching your criteria</p>
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
                      Module
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Component 1
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Component 2
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Overall
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Status
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">
                      Submitted
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r) => {
                    const hasMissing =
                      !r.component1Submitted || !r.component2Submitted;
                    const hasFailed = r.moduleStatus === "fail";
                    const student = students.find((s) => s.id === r.studentId);
                    return (
                      <tr
                        key={r.id}
                        className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {student?.studentId ?? r.studentId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 font-medium">{r.studentName}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate">
                          {r.programme}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate">
                          {r.moduleName}
                        </td>

                        {/* Component 1 */}
                        <td className="px-4 py-3">
                          {r.component1Submitted ? (
                            <span
                              className={`flex items-center gap-1 text-sm font-medium ${
                                r.component1Status === "pass"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {r.component1Status === "pass" ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <XIcon className="h-3.5 w-3.5" />
                              )}
                              {r.component1Mark}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Component 2 */}
                        <td className="px-4 py-3">
                          {r.component2Submitted ? (
                            <span
                              className={`flex items-center gap-1 text-sm font-medium ${
                                r.component2Status === "pass"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {r.component2Status === "pass" ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <XIcon className="h-3.5 w-3.5" />
                              )}
                              {r.component2Mark}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-medium">{r.overallMark}%</td>

                        <td className="px-4 py-3">
                          <Badge
                            className={
                              r.moduleStatus === "pass"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-red-100 text-red-800 border-red-200"
                            }
                          >
                            {r.moduleStatus === "pass" ? "Pass" : "Fail"}
                          </Badge>
                        </td>

                        {/* Submitted column */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span
                              className={`flex items-center gap-1 ${
                                r.component1Submitted
                                  ? "text-green-600"
                                  : "text-red-500"
                              }`}
                            >
                              {r.component1Submitted ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <XIcon className="h-3 w-3" />
                              )}
                              C1
                            </span>
                            <span
                              className={`flex items-center gap-1 ${
                                r.component2Submitted
                                  ? "text-green-600"
                                  : "text-red-500"
                              }`}
                            >
                              {r.component2Submitted ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <XIcon className="h-3 w-3" />
                              )}
                              C2
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditMarks(r)}
                            >
                              Enter Marks
                            </Button>
                            {hasMissing && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-red-600 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleNotifySRU(r)}
                              >
                                <Bell className="h-3.5 w-3.5" />
                                Notify SRU
                              </Button>
                            )}
                            {hasFailed && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-orange-600 hover:text-orange-600 hover:bg-orange-50"
                                onClick={() => openScheduleMeeting(r)}
                              >
                                <CalendarClock className="h-3.5 w-3.5" />
                                Schedule Meeting
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
