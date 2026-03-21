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
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { CsvDataImportModal } from '../components/CsvDataImportModal';

interface Module {
  id: string;
  moduleCode: string;
  moduleName: string;
  programme: string;
  faculty: string;
  yearOfStudy: string;
  credits: number;
  status: 'active' | 'inactive';
  components: any[];
}

interface Programme {
  id: string;
  programmeName: string;
  faculty: string;
}

const YEARS_OF_STUDY = ['Year 1', 'Year 2', 'Year 3', 'Year 4'];
const CREDITS_OPTIONS = ['10', '15', '20', '30', '40', '60'];

const CSV_FIELDS = [
  { key: 'moduleCode', label: 'Module Code', required: true, sampleValue: 'CS401' },
  { key: 'moduleName', label: 'Module Name', required: true, sampleValue: 'Software Engineering' },
  { key: 'programme', label: 'Programme', required: true, sampleValue: 'BSc (Hons) Computer Science' },
  { key: 'faculty', label: 'Faculty', required: false, sampleValue: 'School of Computing' },
  { key: 'yearOfStudy', label: 'Year of Study', required: false, sampleValue: 'Year 1' },
  { key: 'credits', label: 'Credits', required: false, sampleValue: '20' },
  { key: 'status', label: 'Status', required: false, sampleValue: 'active' },
];

const downloadTemplate = () => {
  const csv =
    CSV_FIELDS.map((f) => f.key).join(',') +
    '\n' +
    CSV_FIELDS.map((f) => f.sampleValue ?? '').join(',');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modules_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export default function AdminModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('all');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingModule, setDeletingModule] = useState<Module | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formProgramme, setFormProgramme] = useState('');
  const [formFaculty, setFormFaculty] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formCredits, setFormCredits] = useState('20');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

  useEffect(() => {
    const unsubM = onSnapshot(
      query(collection(db, 'modules'), orderBy('moduleCode')),
      (snap) => {
        setModules(
          snap.docs.map((d) => ({
            id: d.id,
            moduleCode: d.data().moduleCode ?? '',
            moduleName: d.data().moduleName ?? '',
            programme: d.data().programme ?? '',
            faculty: d.data().faculty ?? '',
            yearOfStudy: d.data().yearOfStudy ?? '',
            credits: d.data().credits ?? 0,
            status: d.data().status ?? 'active',
            components: d.data().components ?? [],
          }))
        );
        setLoading(false);
      }
    );
    const unsubP = onSnapshot(
      query(collection(db, 'programmes'), orderBy('programmeName')),
      (snap) => {
        setProgrammes(
          snap.docs.map((d) => ({
            id: d.id,
            programmeName: d.data().programmeName ?? '',
            faculty: d.data().faculty ?? '',
          }))
        );
      }
    );
    return () => { unsubM(); unsubP(); };
  }, []);

  // When programme changes in form, auto-fill faculty
  const handleProgrammeChange = (value: string) => {
    setFormProgramme(value);
    const found = programmes.find((p) => p.programmeName === value);
    setFormFaculty(found?.faculty ?? '');
  };

  const filtered = modules.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      m.moduleCode.toLowerCase().includes(q) || m.moduleName.toLowerCase().includes(q);
    const matchesProg = programmeFilter === 'all' || m.programme === programmeFilter;
    return matchesSearch && matchesProg;
  });

  const activeCount = modules.filter((m) => m.status === 'active').length;
  const uniqueProgCount = [...new Set(modules.map((m) => m.programme).filter(Boolean))].length;

  const resetForm = () => {
    setFormCode('');
    setFormName('');
    setFormProgramme('');
    setFormFaculty('');
    setFormYear('');
    setFormCredits('20');
    setFormStatus('active');
  };

  const openAdd = () => { setEditingModule(null); resetForm(); setIsDialogOpen(true); };

  const openEdit = (m: Module) => {
    setEditingModule(m);
    setFormCode(m.moduleCode);
    setFormName(m.moduleName);
    setFormProgramme(m.programme);
    setFormFaculty(m.faculty);
    setFormYear(m.yearOfStudy);
    setFormCredits(String(m.credits));
    setFormStatus(m.status);
    setIsDialogOpen(true);
  };

  const openDelete = (m: Module) => { setDeletingModule(m); setIsDeleteOpen(true); };

  const handleSave = async () => {
    if (!formCode.trim() || !formName.trim() || !formProgramme) {
      toast.error('Module Code, Name, and Programme are required');
      return;
    }
    const codeUpper = formCode.trim().toUpperCase();
    const duplicate = modules.find(
      (m) => m.moduleCode.toUpperCase() === codeUpper && m.id !== editingModule?.id
    );
    if (duplicate) {
      toast.error('A module with this code already exists.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        moduleCode: codeUpper,
        moduleName: formName.trim(),
        programme: formProgramme,
        faculty: formFaculty,
        yearOfStudy: formYear,
        credits: Number(formCredits),
        status: formStatus,
      };
      if (editingModule) {
        await updateDoc(doc(db, 'modules', editingModule.id), {
          ...payload,
          components: editingModule.components ?? [],
        });
        toast.success('Module updated successfully');
      } else {
        await addDoc(collection(db, 'modules'), {
          ...payload,
          components: [],
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
        if (!row.moduleCode?.trim() || !row.moduleName?.trim() || !row.programme?.trim()) {
          errors.push(`Skipped — missing Code, Name, or Programme: "${row.moduleCode || ''}"`);
          failed++;
          continue;
        }
        await addDoc(collection(db, 'modules'), {
          moduleCode: row.moduleCode.trim().toUpperCase(),
          moduleName: row.moduleName.trim(),
          programme: row.programme.trim(),
          faculty: row.faculty?.trim() ?? '',
          yearOfStudy: row.yearOfStudy?.trim() ?? '',
          credits: row.credits ? Number(row.credits) : 20,
          status: row.status === 'inactive' ? 'inactive' : 'active',
          components: [],
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

  const uniqueProgrammes = [...new Set(modules.map((m) => m.programme).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modules</h1>
          <p className="text-muted-foreground">Manage academic modules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
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
            <p className="text-xs text-muted-foreground mt-1">Registered modules</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Programmes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">{uniqueProgCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Programmes with modules</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Module Directory</CardTitle>
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or name..."
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
                {uniqueProgrammes.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Credits</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-blue-700">{m.moduleCode}</td>
                      <td className="px-4 py-3 font-medium">{m.moduleName}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{m.programme || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.yearOfStudy || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.credits}</td>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Edit Module' : 'Add Module'}</DialogTitle>
            <DialogDescription>
              {editingModule ? 'Update module details' : 'Add a new academic module'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
              <Select value={formProgramme} onValueChange={handleProgrammeChange}>
                <SelectTrigger id="mod-programme">
                  <SelectValue placeholder="— Select Programme —" />
                </SelectTrigger>
                <SelectContent>
                  {programmes.length > 0 ? (
                    programmes.map((p) => (
                      <SelectItem key={p.id} value={p.programmeName}>{p.programmeName}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled>No programmes — add in Programmes page first</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mod-faculty">Faculty</Label>
              <Input
                id="mod-faculty"
                value={formFaculty}
                readOnly
                placeholder="Auto-filled from selected programme"
                className="bg-gray-50 text-muted-foreground"
              />
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
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          </div>
          <DialogFooter>
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
