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
import { useState } from "react";
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
import { doc, setDoc } from "firebase/firestore";
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

const availablePrograms = [
  "Computer Science",
  "Business Administration",
  "Engineering",
  "Psychology",
  "Biology",
  "Mathematics",
  "Physics",
  "Chemistry",
  "English Literature",
  "Economics",
  "History",
  "Law",
  "Medicine",
  "Nursing",
  "Art & Design",
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
  const [editYear, setEditYear] = useState("");
  const [editGpa, setEditGpa] = useState("");
  const [editRiskLevel, setEditRiskLevel] = useState<
    "low" | "medium" | "high" | "critical"
  >("low");
  const [editStatus, setEditStatus] = useState<"active" | "inactive" | "none">(
    "none",
  );

  // Additional fields for comprehensive student form
  const [editStudentId, setEditStudentId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editContactNumber, setEditContactNumber] = useState("");
  const [editIntake, setEditIntake] = useState("");
  const [editEnrollmentDate, setEditEnrollmentDate] = useState("");
  const [editAdvisor, setEditAdvisor] = useState("");
  const [editCounselor, setEditCounselor] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  const programs = Array.from(
    new Set([...availablePrograms, ...students.map((s) => s.program)]),
  );

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
      programFilter === "all" || student.program === programFilter;

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
      "Year",
      "GPA",
      "Risk Level",
      "Risk Score",
    ];

    // Create CSV rows
    const rows = filteredStudents.map((student) => [
      student.id,
      student.name,
      student.email,
      student.program,
      student.year,
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
    critical: students.filter((s) => s.riskLevel === "critical").length,
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
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Students</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Enrolled students</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Critical Risk</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {stats.critical}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Needs immediate attention
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>High Risk</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {stats.high}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Requires monitoring</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Average GPA</CardDescription>
            <CardTitle className="text-3xl">{stats.avgGPA}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Institution-wide</p>
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
              setEditYear("");
              setEditGpa("");
              setEditRiskLevel("low");
              setEditStatus("active");
              setEditStudentId("");
              setEditPassword("");
              setEditDateOfBirth("");
              setEditGender("");
              setEditContactNumber("");
              setEditIntake("");
              setEditEnrollmentDate("");
              setEditAdvisor("");
              setEditCounselor("");
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
                {programs.map((program) => (
                  <SelectItem key={program} value={program}>
                    {program}
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
                        <span>{student.program}</span>
                        <span>•</span>
                        <span>Year {student.year}</span>
                        <span>•</span>
                        <span>GPA: {student.gpa.toFixed(2)}</span>
                      </div>
                      {student.joinedDate && (
                        <div className="text-sm text-muted-foreground">
                          Joined{" "}
                          {new Date(student.joinedDate).toLocaleDateString()}
                        </div>
                      )}
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
                        setEditProgram(student.program);
                        setEditYear(student.year.toString());
                        setEditGpa(student.gpa.toString());
                        setEditRiskLevel(
                          student.riskLevel as
                            | "low"
                            | "medium"
                            | "high"
                            | "critical",
                        );
                        setEditStatus(
                          userAccount
                            ? (userAccount.status as "active" | "inactive")
                            : (displayStatus as "active" | "inactive"),
                        );
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    {userAccount ? (
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
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setAddUserFormData({
                            name: student.name,
                            email: student.email,
                            status: displayStatus as "active" | "inactive",
                            department: student.program,
                          });
                          setIsAddUserDialogOpen(true);
                        }}
                      >
                        <UserPlus className="h-4 w-4" />
                        Create Account
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

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Set password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
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

            {/* Program / Degree */}
            <div className="space-y-2">
              <Label htmlFor="program">
                Program / Degree <span className="text-red-500">*</span>
              </Label>
              <Select value={editProgram} onValueChange={setEditProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program} value={program}>
                      {program}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year of Study */}
            <div className="space-y-2">
              <Label htmlFor="yearOfStudy">
                Year of Study <span className="text-red-500">*</span>
              </Label>
              <Select value={editYear} onValueChange={setEditYear}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Year 1</SelectItem>
                  <SelectItem value="2">Year 2</SelectItem>
                  <SelectItem value="3">Year 3</SelectItem>
                  <SelectItem value="4">Year 4</SelectItem>
                  <SelectItem value="5">Year 5</SelectItem>
                  <SelectItem value="6">Year 6</SelectItem>
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

            {/* Assign Academic Advisor */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="advisor">
                Assign Academic Advisor <span className="text-red-500">*</span>
              </Label>
              <Select value={editAdvisor} onValueChange={setEditAdvisor}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select Advisor —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advisor1">Dr. Sarah Johnson</SelectItem>
                  <SelectItem value="advisor2">Michael Anderson</SelectItem>
                  <SelectItem value="advisor3">Dr. Lisa Chen</SelectItem>
                  <SelectItem value="advisor4">Robert Martinez</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assign Counsellor (optional) */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="counselor">Assign Counsellor (optional)</Label>
              <Select value={editCounselor} onValueChange={setEditCounselor}>
                <SelectTrigger>
                  <SelectValue placeholder="— None —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  <SelectItem value="counselor1">Dr. Emily Watson</SelectItem>
                  <SelectItem value="counselor2">Dr. James Thompson</SelectItem>
                  <SelectItem value="counselor3">
                    Dr. Maria Rodriguez
                  </SelectItem>
                  <SelectItem value="counselor4">Dr. Kevin Lee</SelectItem>
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
                  !editPassword ||
                  !editDateOfBirth ||
                  !editGender ||
                  !editContactNumber ||
                  !editProgram ||
                  !editYear ||
                  !editIntake ||
                  !editEnrollmentDate ||
                  !editAdvisor
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
                      program: editProgram,
                      year: parseInt(editYear),
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
                    // Create Firebase Auth account via secondary app (keeps admin signed in)
                    await createUserWithEmailAndPassword(
                      secondaryAuth,
                      editEmail,
                      editPassword,
                    );
                    await secondaryAuth.signOut();

                    // Write full student record to Firestore
                    await setDoc(doc(db, "students", editStudentId), {
                      name: editName,
                      email: editEmail,
                      password: editPassword,
                      program: editProgram,
                      year: parseInt(editYear),
                      gpa: 0.0,
                      riskLevel: "low",
                      riskScore: 0,
                      advisorId: editAdvisor,
                      counselorId:
                        editCounselor && editCounselor !== "none"
                          ? editCounselor
                          : null,
                      joinedDate: editEnrollmentDate,
                      dateOfBirth: editDateOfBirth,
                      gender: editGender,
                      contactNumber: editContactNumber,
                      intake: editIntake,
                      enrollmentDate: editEnrollmentDate,
                      status: editStatus !== "none" ? editStatus : "active",
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
