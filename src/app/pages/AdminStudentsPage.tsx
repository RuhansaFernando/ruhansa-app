import { useData } from "../DataContext";
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
import { Link } from "react-router";
import {
  Search,
  GraduationCap,
  Filter,
  Download,
  AlertTriangle,
  Edit,
  UserPlus,
  Trash2,
  Mail,
  Users,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Student, User as UserType } from "../types";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { db, secondaryAuth } from "../../firebase";

const departments = [
  "Academic Services",
  "Student Services",
  "Computer Science",
  "Mathematics",
  "Engineering",
  "Business Administration",
  "Liberal Arts",
  "Natural Sciences",
  "Social Sciences",
  "Health Sciences",
];

const IIT_PROGRAMMES = [
  "BSc (Hons) Business Computing",
  "BSc (Hons) Business Data Analytics",
  "BA (Hons) Business Management",
  "BEng (Hons) Software Engineering",
  "BSc (Hons) Computer Science",
  "BSc (Hons) Artificial Intelligence And Data Science",
];

export default function AdminStudentsPage() {
  const { students, updateStudent, users, addUser, updateUser, deleteUser } =
    useData();
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editProgram, setEditProgram] = useState("");
  const [editStudyLevel, setEditStudyLevel] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive" | "none">(
    "none",
  );

  // Additional fields for comprehensive student form
  const [editStudentId, setEditStudentId] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editContactNumber, setEditContactNumber] = useState("");
  const [editIntake, setEditIntake] = useState("");
  const [editEnrollmentDate, setEditEnrollmentDate] = useState("");
  const [editFaculty, setEditFaculty] = useState("");
  const [editPersonalTutor, setEditPersonalTutor] = useState("");
  const [advisorsList, setAdvisorsList] = useState<{id: string; name: string}[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch active tutors from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'tutors'),
      where('status', '==', 'active'),
      orderBy('name'),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setAdvisorsList(snapshot.docs.map((d) => ({ id: d.id, name: d.data().name ?? d.id })));
    });
    return () => unsub();
  }, []);

  // Add user form state
  const [addUserFormData, setAddUserFormData] = useState({
    name: "",
    email: "",
    status: "active" as "active" | "inactive",
    department: "",
  });

  // Edit user form state
  const [editUserFormData, setEditUserFormData] = useState({
    name: "",
    email: "",
    status: "active" as "active" | "inactive",
    department: "",
  });


  // Get student users from the users list
  const studentUsers = users.filter((u) => u.role === "student");

  // Create a map of user emails to user objects for quick lookup
  const userMap = new Map(studentUsers.map((u) => [u.email.toLowerCase(), u]));

  // Helper function to get display status (real or pseudo-random)
  const getDisplayStatus = (student: Student): "active" | "inactive" => {
    // Prefer status stored directly on the student (from Firestore)
    if (student.status) return student.status;
    const userAccount = userMap.get(student.email.toLowerCase());
    if (userAccount) {
      return (userAccount.status || "active") as "active" | "inactive";
    }
    // Generate pseudo-random but consistent status based on student ID
    const hash = student.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 2 === 0 ? "active" : "inactive";
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRisk =
      riskFilter === "all" || student.riskLevel === riskFilter;
    const matchesProgram =
      programFilter === "all" || student.programme === programFilter;

    // Use the display status for filtering
    const displayStatus = getDisplayStatus(student);
    const matchesStatus =
      statusFilter === "all" || displayStatus === statusFilter;

    return matchesSearch && matchesRisk && matchesProgram && matchesStatus;
  });

  const handleExport = () => {
    // Create CSV headers
    const headers = [
      "ID",
      "Name",
      "Email",
      "Program",
      "Study Level",
      "GPA",
      "Risk Level",
      "Risk Score",
    ];

    // Create CSV rows
    const rows = filteredStudents.map((student) => [
      student.id,
      student.name,
      student.email,
      student.programme,
      student.studyLevel ?? "",
      student.gpa.toFixed(2),
      student.riskLevel,
      student.riskScore,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `students_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Export successful", {
      description: `Exported ${filteredStudents.length} students to CSV`,
    });
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const stats = {
    total: students.length,
    low: students.filter((s) => s.riskLevel === "low").length,
    high: students.filter((s) => s.riskLevel === "high").length,
    avgGPA: students.length
      ? (students.reduce((sum, s) => sum + s.gpa, 0) / students.length).toFixed(
          2,
        )
      : "—",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground">
            Manage and monitor all students in the system
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Enrolled students</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Students</CardTitle>
            <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">{stats.high}</div>
            <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk Students</CardTitle>
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{stats.low}</div>
            <p className="text-xs text-muted-foreground mt-1">Performing well</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average GPA</CardTitle>
            <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
              <Filter className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">{stats.avgGPA}</div>
            <p className="text-xs text-muted-foreground mt-1">Institution-wide</p>
          </CardContent>
        </Card>
      </div>

      {/* Unified Student Directory */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Student Directory</CardTitle>
            <CardDescription>
              Manage all students and their user accounts
            </CardDescription>
          </div>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingStudent(null);
              setEditName("");
              setEditEmail("");
              setEditProgram("");
              setEditStudyLevel("");
              setEditStatus("active");
              setEditStudentId("");
              setEditDateOfBirth("");
              setEditGender("");
              setEditContactNumber("");
              setEditIntake("");
              setEditEnrollmentDate("");
              setEditFaculty("");
              setEditPersonalTutor("");
              setIsEditDialogOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Add Student
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
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
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {IIT_PROGRAMMES.map((programme) => (
                  <SelectItem key={programme} value={programme}>
                    {programme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filteredStudents.map((student) => {
              // Get corresponding user account if it exists
              const userAccount = userMap.get(student.email.toLowerCase());

              // Use the display status for rendering
              const displayStatus = getDisplayStatus(student);

              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{student.name}</h3>
                        <Badge className={getRiskColor(student.riskLevel)}>
                          {student.riskLevel}
                        </Badge>
                        {(student.riskLevel === "critical" ||
                          student.riskLevel === "high") && (
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        )}
                        <Badge
                          variant={
                            displayStatus === "active" ? "default" : "secondary"
                          }
                          className={
                            displayStatus === "active"
                              ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs"
                              : "bg-gray-100 text-gray-800 border-gray-200 text-xs"
                          }
                        >
                          {displayStatus}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-1">
                        <span>{student.id}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{student.email}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-1">
                        <span>{student.programme}</span>
                        <span>•</span>
                        <span>{student.studyLevel ?? '—'}</span>
                        <span>•</span>
                        <span>GPA: {student.gpa.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/admin/student/${student.id}`}>
                      <Button size="sm" variant="outline">
                        View Profile
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setEditingStudent(student);
                        setEditName(student.name);
                        setEditEmail(student.email);
                        setEditProgram(student.programme);
                        setEditStudyLevel(student.studyLevel ?? "");
                        setEditStatus(
                          userAccount
                            ? (userAccount.status as "active" | "inactive")
                            : (displayStatus as "active" | "inactive"),
                        );
                        setEditFaculty("");
                        setEditPersonalTutor("");
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    {userAccount && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-red-600 hover:text-red-600"
                        onClick={() => {
                          setSelectedUser(userAccount);
                          setIsDeleteUserDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No students found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Add a new user to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={addUserFormData.name}
                onChange={(e) =>
                  setAddUserFormData({
                    ...addUserFormData,
                    name: e.target.value,
                  })
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={addUserFormData.email}
                onChange={(e) =>
                  setAddUserFormData({
                    ...addUserFormData,
                    email: e.target.value,
                  })
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={addUserFormData.status}
                onValueChange={(value) =>
                  setAddUserFormData({
                    ...addUserFormData,
                    status: value as "active" | "inactive",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={addUserFormData.department}
                onValueChange={(value) =>
                  setAddUserFormData({ ...addUserFormData, department: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddUserDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (
                  !addUserFormData.name ||
                  !addUserFormData.email ||
                  !addUserFormData.department
                ) {
                  toast.error("Please fill in all fields");
                  return;
                }

                addUser({
                  name: addUserFormData.name,
                  email: addUserFormData.email,
                  status: addUserFormData.status,
                  department: addUserFormData.department,
                  role: "student",
                });
                toast.success("User added successfully");
                setIsAddUserDialogOpen(false);
                setAddUserFormData({
                  name: "",
                  email: "",
                  status: "active" as "active" | "inactive",
                  department: "",
                });
              }}
            >
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog
        open={isDeleteUserDialogOpen}
        onOpenChange={setIsDeleteUserDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={selectedUser?.name || ""}
                readOnly
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={selectedUser?.email || ""}
                readOnly
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsDeleteUserDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (selectedUser) {
                  deleteUser(selectedUser.id);
                  toast.success("User deleted successfully");
                  setIsDeleteUserDialogOpen(false);
                  setSelectedUser(null);
                }
              }}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={isEditUserDialogOpen}
        onOpenChange={setIsEditUserDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update the user's information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editUserFormData.name}
                onChange={(e) =>
                  setEditUserFormData({
                    ...editUserFormData,
                    name: e.target.value,
                  })
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={editUserFormData.email}
                onChange={(e) =>
                  setEditUserFormData({
                    ...editUserFormData,
                    email: e.target.value,
                  })
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={editUserFormData.status}
                onValueChange={(value) =>
                  setEditUserFormData({
                    ...editUserFormData,
                    status: value as "active" | "inactive",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={editUserFormData.department}
                onValueChange={(value) =>
                  setEditUserFormData({
                    ...editUserFormData,
                    department: value,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditUserDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (
                  !editUserFormData.name ||
                  !editUserFormData.email ||
                  !editUserFormData.department
                ) {
                  toast.error("Please fill in all fields");
                  return;
                }

                if (selectedUser) {
                  updateUser(selectedUser.id, {
                    name: editUserFormData.name,
                    email: editUserFormData.email,
                    status: editUserFormData.status,
                    department: editUserFormData.department,
                    role: "student",
                  });
                  toast.success("User updated successfully");
                  setIsEditUserDialogOpen(false);
                  setSelectedUser(null);
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStudent ? "Edit Student" : "Add Student"}
            </DialogTitle>
            <DialogDescription>
              {editingStudent
                ? "Update the student's information"
                : "Add a new student to the system"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="e.g. John Smith"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            {/* Student ID */}
            <div className="space-y-2">
              <Label htmlFor="studentId">
                Student ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="studentId"
                placeholder="e.g. STU2024001"
                value={editStudentId}
                onChange={(e) => setEditStudentId(e.target.value)}
                disabled={!!editingStudent}
              />
            </div>

            {/* Email Address */}
            <div className="space-y-2">
              <Label htmlFor="emailAddress">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="emailAddress"
                type="email"
                placeholder="name@student.edu"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">
                Date of Birth <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={editDateOfBirth}
                onChange={(e) => setEditDateOfBirth(e.target.value)}
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="gender">
                Gender <span className="text-red-500">*</span>
              </Label>
              <Select value={editGender} onValueChange={setEditGender}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer-not-to-say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contact Number */}
            <div className="space-y-2">
              <Label htmlFor="contactNumber">
                Contact Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactNumber"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={editContactNumber}
                onChange={(e) => setEditContactNumber(e.target.value)}
              />
            </div>

            {/* Programme */}
            <div className="space-y-2">
              <Label htmlFor="program">
                Programme <span className="text-red-500">*</span>
              </Label>
              <Select value={editProgram} onValueChange={setEditProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {IIT_PROGRAMMES.map((programme) => (
                    <SelectItem key={programme} value={programme}>
                      {programme}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Faculty / School */}
            <div className="space-y-2">
              <Label htmlFor="faculty">Faculty / School <span className="text-red-500">*</span></Label>
              <Select value={editFaculty} onValueChange={setEditFaculty}>
                <SelectTrigger><SelectValue placeholder="— Select —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Business School">Business School</SelectItem>
                  <SelectItem value="School of Computing">School of Computing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Study Level */}
            <div className="space-y-2">
              <Label htmlFor="studyLevel">
                Level <span className="text-red-500">*</span>
              </Label>
              <Select value={editStudyLevel} onValueChange={setEditStudyLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Level 4">Level 4</SelectItem>
                  <SelectItem value="Level 5">Level 5</SelectItem>
                  <SelectItem value="Industrial Placement">Industrial Placement</SelectItem>
                  <SelectItem value="Level 6">Level 6</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Intake / Batch */}
            <div className="space-y-2">
              <Label htmlFor="intake">
                Intake / Batch <span className="text-red-500">*</span>
              </Label>
              <Select value={editIntake} onValueChange={setEditIntake}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024-spring">2024 Spring</SelectItem>
                  <SelectItem value="2024-fall">2024 Fall</SelectItem>
                  <SelectItem value="2025-spring">2025 Spring</SelectItem>
                  <SelectItem value="2025-fall">2025 Fall</SelectItem>
                  <SelectItem value="2026-spring">2026 Spring</SelectItem>
                  <SelectItem value="2026-fall">2026 Fall</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Enrollment Date */}
            <div className="space-y-2">
              <Label htmlFor="enrollmentDate">
                Enrollment Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="enrollmentDate"
                type="date"
                value={editEnrollmentDate}
                onChange={(e) => setEditEnrollmentDate(e.target.value)}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={editStatus === "none" ? "active" : editStatus}
                onValueChange={setEditStatus}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Personal Tutor */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="personalTutor">Assign Personal Tutor</Label>
              <Select value={editPersonalTutor} onValueChange={setEditPersonalTutor}>
                <SelectTrigger><SelectValue placeholder="— Select Tutor —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {advisorsList.map((adv) => (
                    <SelectItem key={adv.id} value={adv.id}>{adv.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={async () => {
                if (
                  !editName ||
                  !editEmail ||
                  !editStudentId ||
                  !editDateOfBirth ||
                  !editGender ||
                  !editContactNumber ||
                  !editProgram ||
                  !editStudyLevel ||
                  !editIntake ||
                  !editEnrollmentDate ||
                  !editFaculty
                ) {
                  toast.error("Please fill in all required fields");
                  return;
                }

                setIsSaving(true);
                try {
                  if (editingStudent) {
                    // Update existing student
                    updateStudent(editingStudent.id, {
                      name: editName,
                      email: editEmail,
                      programme: editProgram,
                      studyLevel: editStudyLevel,
                      gpa: editingStudent.gpa,
                      riskLevel: editingStudent.riskLevel,
                      status:
                        editStatus !== "none"
                          ? (editStatus as "active" | "inactive")
                          : undefined,
                    });
                    const userAccount = userMap.get(
                      editingStudent.email.toLowerCase(),
                    );
                    if (userAccount && editStatus !== "none") {
                      updateUser(userAccount.id, {
                        name: editName,
                        email: editEmail,
                        status: editStatus as "active" | "inactive",
                        department: editProgram,
                        role: "student",
                      });
                    }
                    toast.success("Student updated successfully");
                  } else {
                    // Write full student record to Firestore
                    await setDoc(doc(db, "students", editStudentId), {
                      name: editName,
                      email: editEmail,
                      studentId: editStudentId,
                      programme: editProgram,
                      studyLevel: editStudyLevel,
                      faculty: editFaculty,
                      dateOfBirth: editDateOfBirth,
                      gender: editGender,
                      contactNumber: editContactNumber,
                      intake: editIntake,
                      enrollmentDate: editEnrollmentDate,
                      gpa: 0,
                      attendancePercentage: 0,
                      consecutiveAbsences: 0,
                      riskLevel: "low",
                      riskScore: 0,
                      personalTutor: editPersonalTutor && editPersonalTutor !== "none"
                        ? (advisorsList.find((t) => t.id === editPersonalTutor)?.name ?? editPersonalTutor)
                        : null,
                      status: editStatus !== "none" ? editStatus : "active",
                      role: "student",
                      createdAt: new Date().toISOString(),
                    });

                    toast.success("Student added successfully");
                  }

                  setIsEditDialogOpen(false);
                  setEditingStudent(null);
                } catch (err) {
                  if (err instanceof FirebaseError) {
                    if (err.code === "auth/email-already-in-use") {
                      toast.error(
                        "A student account with this email already exists.",
                      );
                    } else {
                      toast.error(`Failed to save student: ${err.message}`);
                    }
                  } else {
                    toast.error(
                      "An unexpected error occurred. Please try again.",
                    );
                  }
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving
                ? "Saving…"
                : editingStudent
                  ? "Save Changes"
                  : "Add Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
