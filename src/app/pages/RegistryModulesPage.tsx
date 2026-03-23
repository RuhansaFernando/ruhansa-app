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
import { BookOpen, Plus, Search, Edit, ToggleLeft, ToggleRight, Download } from "lucide-react";
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

interface AssessmentComponent {
  name: string;
  weight: number;
}

interface Module {
  id: string;
  moduleCode: string;
  moduleName: string;
  programme: string;
  credits: number;
  semester: string;
  status: "active" | "inactive";
  components: AssessmentComponent[];
  createdAt?: string;
}

const PROGRAMMES = [
  "BSc (Hons) Computer Science",
  "BSc (Hons) Software Engineering",
  "BSc (Hons) Cyber Security",
  "BSc (Hons) Business Information Systems",
  "BEng (Hons) Electronic Engineering",
];

const SEMESTERS = ["Semester 1", "Semester 2", "Semester 1 & 2"];

export default function RegistryModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");

  // Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formProgramme, setFormProgramme] = useState("");
  const [formCredits, setFormCredits] = useState("15");
  const [formSemester, setFormSemester] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [comp1Name, setComp1Name] = useState("");
  const [comp1Weight, setComp1Weight] = useState("50");
  const [comp2Name, setComp2Name] = useState("");
  const [comp2Weight, setComp2Weight] = useState("50");

  useEffect(() => {
    const q = query(collection(db, "modules"), orderBy("moduleCode"));
    const unsub = onSnapshot(q, (snapshot) => {
      setModules(
        snapshot.docs.map((d) => ({
          id: d.id,
          moduleCode: d.data().moduleCode ?? "",
          moduleName: d.data().moduleName ?? "",
          programme: d.data().programme ?? "",
          credits: d.data().credits ?? 0,
          semester: d.data().semester ?? "",
          status: d.data().status ?? "active",
          components: d.data().components ?? [],
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? undefined,
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return modules.filter((m) => {
      const matchesSearch =
        m.moduleCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.moduleName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProgramme =
        programmeFilter === "all" || m.programme === programmeFilter;
      const matchesStatus =
        statusFilter === "all" || m.status === statusFilter;
      const matchesSemester =
        semesterFilter === "all" || m.semester === semesterFilter;
      return matchesSearch && matchesProgramme && matchesStatus && matchesSemester;
    });
  }, [modules, searchQuery, programmeFilter, statusFilter, semesterFilter]);

  const activeCount = modules.filter((m) => m.status === "active").length;

  const resetForm = () => {
    setFormCode("");
    setFormName("");
    setFormProgramme("");
    setFormCredits("15");
    setFormSemester("");
    setFormStatus("active");
    setComp1Name("Coursework");
    setComp1Weight("40");
    setComp2Name("Examination");
    setComp2Weight("60");
  };

  const openAddDialog = () => {
    setEditingModule(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (m: Module) => {
    setEditingModule(m);
    setFormCode(m.moduleCode);
    setFormName(m.moduleName);
    setFormProgramme(m.programme);
    setFormCredits(String(m.credits));
    setFormSemester(m.semester);
    setFormStatus(m.status);
    const c1 = m.components[0] ?? { name: "", weight: 0 };
    const c2 = m.components[1] ?? { name: "", weight: 0 };
    setComp1Name(c1.name);
    setComp1Weight(String(c1.weight));
    setComp2Name(c2.name);
    setComp2Weight(String(c2.weight));
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formCode.trim() || !formName.trim() || !formProgramme || !formSemester) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!comp1Name.trim() || !comp2Name.trim()) {
      toast.error("Please enter names for both assessment components");
      return;
    }
    const w1 = Number(comp1Weight);
    const w2 = Number(comp2Weight);
    if (isNaN(w1) || isNaN(w2) || w1 < 0 || w2 < 0) {
      toast.error("Component weights must be valid positive numbers");
      return;
    }
    if (w1 + w2 !== 100) {
      toast.error(`Component weights must sum to 100% (currently ${w1 + w2}%)`);
      return;
    }

    const payload = {
      moduleCode: formCode.trim().toUpperCase(),
      moduleName: formName.trim(),
      programme: formProgramme,
      credits: Number(formCredits),
      semester: formSemester,
      status: formStatus,
      components: [
        { name: comp1Name.trim(), weight: w1 },
        { name: comp2Name.trim(), weight: w2 },
      ],
    };

    setIsSaving(true);
    try {
      if (editingModule) {
        await updateDoc(doc(db, "modules", editingModule.id), payload);
        toast.success("Module updated successfully");
      } else {
        await addDoc(collection(db, "modules"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Module added successfully");
      }
      setIsDialogOpen(false);
    } catch {
      toast.error("Failed to save module. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (m: Module) => {
    const next = m.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "modules", m.id), { status: next });
      toast.success(`${m.moduleName} set to ${next}`);
    } catch {
      toast.error("Failed to update module status.");
    }
  };

  const weightTotal = Number(comp1Weight) + Number(comp2Weight);
  const weightValid = weightTotal === 100;

  const downloadCsvTemplate = () => {
    const headers = [
      "Module Code",
      "Module Name",
      "Programme",
      "Credits",
      "Semester",
      "Status",
      "Component 1 Name",
      "Component 1 Weight",
      "Component 2 Name",
      "Component 2 Weight",
    ];
    const example = [
      "CS4001",
      "Advanced Algorithms",
      "BSc (Hons) Computer Science",
      "20",
      "Semester 1",
      "active",
      "Coursework",
      "40",
      "Examination",
      "60",
    ];
    const csv = [headers, example].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modules_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSeedModules = async () => {
    const sampleModules = [
      { moduleCode: 'BIS301', moduleName: 'Business Information Systems', programme: 'BSc (Hons) Business Information Systems', level: 'Level 3', credits: 20, status: 'active' as const, semester: 'Semester 1', components: [] },
      { moduleCode: 'BIS401', moduleName: 'Database Management', programme: 'BSc (Hons) Business Information Systems', level: 'Level 4', credits: 20, status: 'active' as const, semester: 'Semester 1', components: [] },
      { moduleCode: 'CS401', moduleName: 'Software Engineering', programme: 'BSc (Hons) Computer Science', level: 'Level 4', credits: 20, status: 'active' as const, semester: 'Semester 1', components: [] },
    ];
    try {
      for (const m of sampleModules) {
        await addDoc(collection(db, 'modules'), { ...m, createdAt: serverTimestamp() });
      }
      toast.success('3 sample modules added successfully');
    } catch {
      toast.error('Failed to seed modules.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modules</h1>
          <p className="text-muted-foreground">Manage academic modules and assessment components</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={downloadCsvTemplate}>
            <Download className="h-4 w-4" />
            CSV Template
          </Button>
          <Button className="gap-2" onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add Module
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardDescription>Total Modules</CardDescription>
            <CardTitle className="text-3xl">{modules.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Registered modules</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">{activeCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardDescription>Programmes</CardDescription>
            <CardTitle className="text-3xl text-purple-600">6</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">IIT programmes</p>
          </CardContent>
        </Card>
      </div>

      {/* Module Table */}
      <Card>
        <CardHeader>
          <CardTitle>Module Directory</CardTitle>
          <CardDescription>All registered academic modules</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by module code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="All Programmes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programmes</SelectItem>
                {PROGRAMMES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
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
            <Select value={semesterFilter} onValueChange={setSemesterFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Semesters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {SEMESTERS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading modules…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No modules found matching your criteria</p>
              {modules.length === 0 && (
                <Button variant="outline" size="sm" className="mt-4" onClick={handleSeedModules}>
                  Add Sample Modules
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Code</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Credits</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Semester</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Components</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-blue-700">{m.moduleCode}</td>
                      <td className="px-4 py-3 font-medium">{m.moduleName}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{m.programme}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.credits}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.semester}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {m.components.map((c, i) => (
                            <span key={i} className="text-xs text-muted-foreground">
                              {c.name}: <span className="font-medium text-foreground">{c.weight}%</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            m.status === "active"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openEditDialog(m)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={
                              m.status === "active"
                                ? "gap-1 text-orange-600 hover:text-orange-600 hover:bg-orange-50"
                                : "gap-1 text-green-600 hover:text-green-600 hover:bg-green-50"
                            }
                            onClick={() => toggleStatus(m)}
                          >
                            {m.status === "active" ? (
                              <><ToggleLeft className="h-3.5 w-3.5" />Deactivate</>
                            ) : (
                              <><ToggleRight className="h-3.5 w-3.5" />Activate</>
                            )}
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

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingModule ? "Edit Module" : "Add Module"}</DialogTitle>
            <DialogDescription>
              {editingModule
                ? "Update module details and assessment components"
                : "Add a new academic module with assessment components"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modCode">
                  Module Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="modCode"
                  placeholder="e.g. CS4001"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modCredits">Credits</Label>
                <Select value={formCredits} onValueChange={setFormCredits}>
                  <SelectTrigger id="modCredits">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="60">60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modName">
                Module Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modName"
                placeholder="e.g. Advanced Algorithms"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modProgramme">
                Programme <span className="text-red-500">*</span>
              </Label>
              <Select value={formProgramme} onValueChange={setFormProgramme}>
                <SelectTrigger id="modProgramme">
                  <SelectValue placeholder="— Select Programme —" />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAMMES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modSemester">
                  Semester <span className="text-red-500">*</span>
                </Label>
                <Select value={formSemester} onValueChange={setFormSemester}>
                  <SelectTrigger id="modSemester">
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modStatus">Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as "active" | "inactive")}>
                  <SelectTrigger id="modStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assessment Components */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Assessment Components</Label>
                <span className={`text-xs font-medium ${weightValid ? "text-green-600" : "text-red-500"}`}>
                  Total: {weightTotal}% {weightValid ? "(valid)" : "(must equal 100%)"}
                </span>
              </div>
              <div className="rounded-lg border p-3 space-y-3 bg-gray-50">
                <div className="grid grid-cols-[1fr_100px] gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Component 1 Name</Label>
                    <Input
                      placeholder="e.g. Coursework"
                      value={comp1Name}
                      onChange={(e) => setComp1Name(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Weight %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="40"
                      value={comp1Weight}
                      onChange={(e) => setComp1Weight(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_100px] gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Component 2 Name</Label>
                    <Input
                      placeholder="e.g. Examination"
                      value={comp2Name}
                      onChange={(e) => setComp2Name(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Weight %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="60"
                      value={comp2Weight}
                      onChange={(e) => setComp2Weight(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Saving…" : editingModule ? "Save Changes" : "Add Module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
