import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Search, Plus, Edit, Trash2, BookOpen, Loader2, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, where, getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { CsvDataImportModal } from '../components/CsvDataImportModal';


interface Module {
  id: string;
  moduleCode: string;
  moduleName: string;
  programme: string;
  faculty: string;
  yearOfStudy: string;
  semester: string;
  credits: number;
  status: 'active' | 'inactive';
  components: { name: string; weight: number }[];
}

interface Programme {
  id: string;
  programmeName: string;
  faculty: string;
}

const YEARS_OF_STUDY = ['Year 1', 'Year 2', 'Year 3', 'Year 4'];
const YEAR_DISPLAY: Record<string, string> = {
  'Year 1': '1st Year',
  'Year 2': '2nd Year',
  'Year 3': '3rd Year',
  'Year 4': '4th Year',
};
const SEMESTERS = ['Semester 1', 'Semester 2', 'Semester 1 & 2'];
const CREDITS_OPTIONS = ['10', '15', '20', '30', '40', '60'];

const CSV_FIELDS = [
  { label: 'Module Code', key: 'moduleCode', example: 'BIS101' },
  { label: 'Module Name', key: 'moduleName', example: 'Introduction to Business Information Systems' },
  { label: 'Programme', key: 'programme', example: 'BSc (Hons) Business Information Systems' },
  { label: 'Faculty', key: 'faculty', example: 'Business School' },
  { label: 'Year of Study', key: 'yearOfStudy', example: 'Year 1' },
  { label: 'Credits', key: 'credits', example: '20' },
  { label: 'Status', key: 'status', example: 'active' },
  { label: 'Semester', key: 'semester', example: 'Semester 1' },
  { label: 'Assessment Component 1 Name', key: 'assessmentComponent1Name', example: 'Coursework' },
  { label: 'Assessment Component 1 Weight', key: 'assessmentComponent1Weight', example: '40' },
  { label: 'Assessment Component 2 Name', key: 'assessmentComponent2Name', example: 'Final Exam' },
  { label: 'Assessment Component 2 Weight', key: 'assessmentComponent2Weight', example: '60' },
];

const downloadTemplate = (faculty: string) => {
  const csv =
    CSV_FIELDS.map((f) => f.key).join(',') +
    '\n' +
    CSV_FIELDS.map((f) => f.example ?? '').join(',');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modules_template_${faculty.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const deptCacheKey = (email: string) => `fa_dept_${email}`;

export default function FacultyAdminModulesPage() {
  const { user } = useAuth();
  const [myFaculty, setMyFaculty] = useState(() =>
    user?.email ? (sessionStorage.getItem(deptCacheKey(user.email)) ?? '') : ''
  );
  const [loadingFaculty, setLoadingFaculty] = useState(() =>
    user?.email ? !sessionStorage.getItem(deptCacheKey(user.email)) : true
  );

  const [modules, setModules] = useState<Module[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingModule, setDeletingModule] = useState<Module | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formProgramme, setFormProgramme] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formSemester, setFormSemester] = useState('');
  const [formCredits, setFormCredits] = useState('20');
  const [formComp1Name, setFormComp1Name] = useState('');
  const [formComp1Weight, setFormComp1Weight] = useState('');
  const [formComp2Name, setFormComp2Name] = useState('');
  const [formComp2Weight, setFormComp2Weight] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

  // Fetch the faculty admin's department — skipped if already cached in sessionStorage
  useEffect(() => {
    if (!user?.email || myFaculty) return;
    const fetchFaculty = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'faculty_administrators'), where('email', '==', user.email))
        );
        if (!snap.empty) {
          const dept = snap.docs[0].data().faculty ?? snap.docs[0].data().department ?? '';
          sessionStorage.setItem(deptCacheKey(user.email), dept);
          setMyFaculty(dept);
        }
      } catch {
        toast.error('Failed to load faculty information.');
      } finally {
        setLoadingFaculty(false);
      }
    };
    fetchFaculty();
  }, [user?.email]);

  // Once faculty is known, subscribe to modules and programmes for this faculty
  useEffect(() => {
    if (!myFaculty) return;

    setLoading(true);

    const unsubM = onSnapshot(
      query(collection(db, 'modules'), where('faculty', '==', myFaculty)),
      (snap) => {
        setModules(
          snap.docs.map((d) => ({
            id: d.id,
            moduleCode: d.data().moduleCode ?? '',
            moduleName: d.data().moduleName ?? '',
            programme: d.data().programme ?? '',
            faculty: d.data().faculty ?? '',
            yearOfStudy: d.data().yearOfStudy ?? '',
            semester: d.data().semester ?? '',
            credits: d.data().credits ?? 0,
            status: d.data().status ?? 'active',
            components: d.data().components ?? [],
          })).sort((a, b) => a.moduleCode.localeCompare(b.moduleCode))
        );
        setLoading(false);
      },
      (err) => {
        console.error('Modules query failed:', err);
        toast.error('Failed to load modules. A Firestore index may be required.');
        setLoading(false);
      }
    );

    const unsubP = onSnapshot(
      query(collection(db, 'programmes'), where('faculty', '==', myFaculty)),
      (snap) => {
        setProgrammes(
          snap.docs.map((d) => ({
            id: d.id,
            programmeName: d.data().programmeName ?? '',
            faculty: d.data().faculty ?? '',
          })).sort((a, b) => a.programmeName.localeCompare(b.programmeName))
        );
      }
    );

    return () => { unsubM(); unsubP(); };
  }, [myFaculty]);

  const programmeOptions = [...new Set(modules.map((m) => m.programme).filter(Boolean))].sort();

  const filtered = modules.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || m.moduleCode.toLowerCase().includes(q) || m.moduleName.toLowerCase().includes(q);
    const matchProgramme = !filterProgramme || filterProgramme === 'all' || m.programme === filterProgramme;
    const matchYear = !filterYear || filterYear === 'all' || m.yearOfStudy === filterYear;
    return matchSearch && matchProgramme && matchYear;
  });

  const activeCount = modules.filter((m) => m.status === 'active').length;

  const resetForm = () => {
    setFormCode('');
    setFormName('');
    setFormProgramme('');
    setFormYear('');
    setFormSemester('');
    setFormCredits('20');
    setFormComp1Name('');
    setFormComp1Weight('');
    setFormComp2Name('');
    setFormComp2Weight('');
    setFormStatus('active');
  };

  const openAdd = () => { setEditingModule(null); resetForm(); setIsDialogOpen(true); };

  const openEdit = (m: Module) => {
    setEditingModule(m);
    setFormCode(m.moduleCode);
    setFormName(m.moduleName);
    setFormProgramme(m.programme);
    setFormYear(m.yearOfStudy);
    setFormSemester(m.semester ?? '');
    setFormCredits(String(m.credits));
    const c1 = m.components?.[0];
    const c2 = m.components?.[1];
    setFormComp1Name(c1?.name ?? '');
    setFormComp1Weight(c1?.weight != null ? String(c1.weight) : '');
    setFormComp2Name(c2?.name ?? '');
    setFormComp2Weight(c2?.weight != null ? String(c2.weight) : '');
    setFormStatus(m.status);
    setIsDialogOpen(true);
  };

  const openDelete = (m: Module) => { setDeletingModule(m); setIsDeleteOpen(true); };

  const buildComponents = () => {
    const comps: { name: string; weight: number }[] = [];
    if (formComp1Name.trim() && formComp1Weight !== '') {
      comps.push({ name: formComp1Name.trim(), weight: Number(formComp1Weight) });
    }
    if (formComp2Name.trim() && formComp2Weight !== '') {
      const n2 = formComp2Name.trim();
      if (comps.length > 0 && n2 === comps[0].name) {
        comps[0] = { ...comps[0], name: `${comps[0].name} 1` };
        comps.push({ name: `${n2} 2`, weight: Number(formComp2Weight) });
      } else {
        comps.push({ name: n2, weight: Number(formComp2Weight) });
      }
    }
    return comps;
  };

  const validateComponents = () => {
    const w1 = formComp1Weight !== '' ? Number(formComp1Weight) : null;
    const w2 = formComp2Weight !== '' ? Number(formComp2Weight) : null;
    const hasComp1 = formComp1Name.trim() !== '' || w1 !== null;
    const hasComp2 = formComp2Name.trim() !== '' || w2 !== null;

    if (hasComp1 && (!formComp1Name.trim() || w1 === null)) {
      toast.error('Component 1: both name and weight are required.');
      return false;
    }
    if (hasComp2 && (!formComp2Name.trim() || w2 === null)) {
      toast.error('Component 2: both name and weight are required.');
      return false;
    }
    if (hasComp1 || hasComp2) {
      const total = (w1 ?? 0) + (w2 ?? 0);
      if (total !== 100) {
        toast.error(`Component weights must add up to 100% (currently ${total}%).`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!formCode.trim() || !formName.trim() || !formProgramme || !formSemester) {
      toast.error('Module Code, Name, Programme, and Semester are required.');
      return;
    }
    if (!validateComponents()) return;

    const codeUpper = formCode.trim().toUpperCase();
    const duplicate = modules.find(
      (m) => m.moduleCode.toUpperCase() === codeUpper && m.id !== editingModule?.id
    );
    if (duplicate) {
      toast.error('A module with this code already exists in your faculty.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        moduleCode: codeUpper,
        moduleName: formName.trim(),
        programme: formProgramme,
        faculty: myFaculty,
        yearOfStudy: formYear,
        semester: formSemester,
        credits: Number(formCredits),
        status: formStatus,
        components: buildComponents(),
      };
      if (editingModule) {
        await updateDoc(doc(db, 'modules', editingModule.id), payload);
        toast.success('Module updated successfully');
      } else {
        await addDoc(collection(db, 'modules'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success('Module added successfully');
      }
      setIsDialogOpen(false);
    } catch {
      toast.error('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingModule) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'modules', deletingModule.id));
      toast.success('Module deleted');
      setIsDeleteOpen(false);
    } catch {
      toast.error('Failed to delete module.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkImport = async (rows: Record<string, string>[]) => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        if (!row.moduleCode?.trim() || !row.moduleName?.trim() || !row.programme?.trim() || !row.semester?.trim()) {
          errors.push(`Skipped — missing Code, Name, Programme, or Semester: "${row.moduleCode || ''}"`);
          failed++;
          continue;
        }
        const comps: { name: string; weight: number }[] = [];
        if (row.assessmentComponent1Name?.trim() && row.assessmentComponent1Weight?.trim()) {
          comps.push({ name: row.assessmentComponent1Name.trim(), weight: Number(row.assessmentComponent1Weight) });
        }
        if (row.assessmentComponent2Name?.trim() && row.assessmentComponent2Weight?.trim()) {
          comps.push({ name: row.assessmentComponent2Name.trim(), weight: Number(row.assessmentComponent2Weight) });
        }
        if (comps.length > 0) {
          const total = comps.reduce((sum, c) => sum + c.weight, 0);
          if (total !== 100) {
            errors.push(`${row.moduleCode || 'Unknown'} — component weights must add up to 100% (got ${total}%)`);
            failed++;
            continue;
          }
        }
        await addDoc(collection(db, 'modules'), {
          moduleCode: row.moduleCode.trim().toUpperCase(),
          moduleName: row.moduleName.trim(),
          programme: row.programme.trim(),
          faculty: myFaculty,
          yearOfStudy: row.yearOfStudy?.trim() ?? '',
          semester: row.semester.trim(),
          credits: row.credits ? Number(row.credits) : 20,
          status: row.status === 'inactive' ? 'inactive' : 'active',
          components: comps,
          createdAt: serverTimestamp(),
        });
        success++;
      } catch (err: any) {
        errors.push(`${row.moduleCode || 'Unknown'} — ${err.message}`);
        failed++;
      }
    }
    return { success, failed, errors };
  };

  if (loadingFaculty) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (!myFaculty) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-4">
        <p className="text-sm font-medium text-gray-700">No faculty/department assigned to your account.</p>
        <p className="text-xs text-muted-foreground">Please contact your System Administrator to assign a department to your Faculty Administrator profile.</p>
      </div>
    );
  }

  const weightTotal =
    (formComp1Weight !== '' ? Number(formComp1Weight) : 0) +
    (formComp2Weight !== '' ? Number(formComp2Weight) : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modules</h1>
          <p className="text-muted-foreground">{myFaculty}</p>
        </div>
        <div className="flex gap-2">
<Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadTemplate(myFaculty)}>
            <Download className="h-4 w-4" />
            CSV Template
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Import CSV
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Module
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{modules.length}</div>
            <p className="text-xs text-muted-foreground mt-1">In your faculty</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently active</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Programmes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">
              {[...new Set(modules.map((m) => m.programme).filter(Boolean))].length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">With modules</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Module Directory</CardTitle>
          <div className="mt-3 flex flex-wrap gap-3">
            <Select value={filterProgramme} onValueChange={setFilterProgramme}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All Programmes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programmes</SelectItem>
                {programmeOptions.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {YEARS_OF_STUDY.map((y) => (
                  <SelectItem key={y} value={y}>{YEAR_DISPLAY[y] ?? y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative max-w-sm flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No modules found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Code</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Year</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Semester</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Credits</th>
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
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{m.programme || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.yearOfStudy ? (YEAR_DISPLAY[m.yearOfStudy] ?? m.yearOfStudy) : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.semester || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.credits}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {m.components.length > 0
                          ? m.components.map((c) => `${c.name} ${c.weight}%`).join(' / ')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            m.status === 'active'
                              ? 'bg-green-100 text-green-800 border-green-200 text-xs'
                              : 'bg-gray-100 text-gray-600 border-gray-200 text-xs'
                          }
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(m)}>
                            <Edit className="h-3.5 w-3.5" />Edit
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="gap-1 text-red-600 hover:text-red-600 hover:bg-red-50"
                            onClick={() => openDelete(m)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />Delete
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

      {/* Bulk Import */}
      <CsvDataImportModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Modules"
        fields={CSV_FIELDS}
        onImport={handleBulkImport}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Edit Module' : 'Add Module'}</DialogTitle>
            <DialogDescription>
              {editingModule ? 'Update module details' : 'Add a new academic module'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mod-code">Module Code <span className="text-red-500">*</span></Label>
                <Input
                  id="mod-code"
                  placeholder="e.g. CS401"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mod-credits">Credits</Label>
                <Select value={formCredits} onValueChange={setFormCredits}>
                  <SelectTrigger id="mod-credits"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CREDITS_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mod-name">Module Name <span className="text-red-500">*</span></Label>
              <Input
                id="mod-name"
                placeholder="e.g. Software Engineering"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mod-programme">Programme <span className="text-red-500">*</span></Label>
              <Select value={formProgramme} onValueChange={setFormProgramme}>
                <SelectTrigger id="mod-programme">
                  <SelectValue placeholder="— Select Programme —" />
                </SelectTrigger>
                <SelectContent>
                  {programmes.length > 0 ? (
                    programmes.map((p) => (
                      <SelectItem key={p.id} value={p.programmeName}>{p.programmeName}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled>No programmes in your faculty</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mod-year">Year of Study</Label>
                <Select value={formYear} onValueChange={setFormYear}>
                  <SelectTrigger id="mod-year">
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS_OF_STUDY.map((y) => (
                      <SelectItem key={y} value={y}>{YEAR_DISPLAY[y] ?? y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mod-semester">Semester <span className="text-red-500">*</span></Label>
                <Select value={formSemester} onValueChange={setFormSemester}>
                  <SelectTrigger id="mod-semester">
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assessment Components */}
            <div className="rounded-md border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Assessment Components</Label>
                {(formComp1Weight !== '' || formComp2Weight !== '') && (
                  <span className={`text-xs font-medium ${weightTotal === 100 ? 'text-green-600' : 'text-orange-500'}`}>
                    Total: {weightTotal}% {weightTotal === 100 ? '✓' : '(must be 100%)'}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_100px] gap-4">
                  <Label className="text-xs text-muted-foreground">Component 1 Name</Label>
                  <Label className="text-xs text-muted-foreground">Weight %</Label>
                </div>
                <div className="grid grid-cols-[1fr_100px] gap-4">
                  <Input
                    placeholder="Name (e.g. Coursework)"
                    value={formComp1Name}
                    onChange={(e) => setFormComp1Name(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="e.g. 40"
                    min={0}
                    max={100}
                    value={formComp1Weight}
                    onChange={(e) => setFormComp1Weight(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_100px] gap-4">
                  <Label className="text-xs text-muted-foreground">Component 2 Name</Label>
                  <Label className="text-xs text-muted-foreground">Weight %</Label>
                </div>
                <div className="grid grid-cols-[1fr_100px] gap-4">
                  <Input
                    placeholder="Name (e.g. Exam)"
                    value={formComp2Name}
                    onChange={(e) => setFormComp2Name(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="e.g. 60"
                    min={0}
                    max={100}
                    value={formComp2Weight}
                    onChange={(e) => setFormComp2Weight(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mod-status">Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as 'active' | 'inactive')}>
                <SelectTrigger id="mod-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button size="sm" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isSaving} onClick={handleSave}>
              {isSaving ? 'Saving…' : editingModule ? 'Save Changes' : 'Add Module'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Module</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deletingModule?.moduleCode} — {deletingModule?.moduleName}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
