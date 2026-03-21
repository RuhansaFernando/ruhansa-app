import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Search, Plus, Edit, Trash2, GraduationCap, Loader2, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { CsvDataImportModal } from '../components/CsvDataImportModal';

interface Programme {
  id: string;
  programmeName: string;
  faculty: string;
  durationYears: number;
  status: 'active' | 'inactive';
}

interface Faculty {
  id: string;
  facultyName: string;
}

const CSV_FIELDS = [
  { key: 'programmeName', label: 'Programme Name', required: true, sampleValue: 'BSc (Hons) Computer Science' },
  { key: 'faculty', label: 'Faculty', required: true, sampleValue: 'School of Computing' },
  { key: 'durationYears', label: 'Duration (Years)', required: false, sampleValue: '3' },
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
  a.download = 'programmes_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export default function AdminProgrammesPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('all');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgramme, setEditingProgramme] = useState<Programme | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingProgramme, setDeletingProgramme] = useState<Programme | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formName, setFormName] = useState('');
  const [formFaculty, setFormFaculty] = useState('');
  const [formDuration, setFormDuration] = useState('4');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

  useEffect(() => {
    const unsubP = onSnapshot(
      query(collection(db, 'programmes'), orderBy('programmeName')),
      (snap) => {
        setProgrammes(
          snap.docs.map((d) => ({
            id: d.id,
            programmeName: d.data().programmeName ?? '',
            faculty: d.data().faculty ?? '',
            durationYears: d.data().durationYears ?? d.data().duration ?? 3,
            status: d.data().status ?? 'active',
          }))
        );
        setLoading(false);
      }
    );
    const unsubF = onSnapshot(
      query(collection(db, 'faculties'), orderBy('facultyName')),
      (snap) => {
        setFaculties(snap.docs.map((d) => ({ id: d.id, facultyName: d.data().facultyName ?? '' })));
      }
    );
    return () => { unsubP(); unsubF(); };
  }, []);

  const filtered = programmes.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = p.programmeName.toLowerCase().includes(q) || p.faculty.toLowerCase().includes(q);
    const matchesFaculty = facultyFilter === 'all' || p.faculty === facultyFilter;
    return matchesSearch && matchesFaculty;
  });

  const activeCount = programmes.filter((p) => p.status === 'active').length;
  const facultyCount = [...new Set(programmes.map((p) => p.faculty).filter(Boolean))].length;

  const resetForm = () => {
    setFormName('');
    setFormFaculty('');
    setFormDuration('4');
    setFormStatus('active');
  };

  const openAdd = () => { setEditingProgramme(null); resetForm(); setIsDialogOpen(true); };

  const openEdit = (p: Programme) => {
    setEditingProgramme(p);
    setFormName(p.programmeName);
    setFormFaculty(p.faculty);
    setFormDuration(String(p.durationYears));
    setFormStatus(p.status);
    setIsDialogOpen(true);
  };

  const openDelete = (p: Programme) => { setDeletingProgramme(p); setIsDeleteOpen(true); };

  const handleSave = async () => {
    if (!formName.trim() || !formFaculty) {
      toast.error('Programme Name and Faculty are required');
      return;
    }
    const duplicate = programmes.find(
      (p) => p.programmeName.toLowerCase() === formName.trim().toLowerCase() && p.id !== editingProgramme?.id
    );
    if (duplicate) {
      toast.error('This programme already exists.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        programmeName: formName.trim(),
        faculty: formFaculty,
        durationYears: Number(formDuration),
        status: formStatus,
      };
      if (editingProgramme) {
        await updateDoc(doc(db, 'programmes', editingProgramme.id), payload);
        toast.success('Programme updated successfully');
      } else {
        await addDoc(collection(db, 'programmes'), { ...payload, createdAt: serverTimestamp() });
        toast.success('Programme added successfully');
      }
      setIsDialogOpen(false);
    } catch {
      toast.error('Failed to save programme. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProgramme) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'programmes', deletingProgramme.id));
      toast.success('Programme deleted');
      setIsDeleteOpen(false);
    } catch {
      toast.error('Failed to delete programme.');
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
        if (!row.programmeName?.trim() || !row.faculty?.trim()) {
          errors.push(`Skipped — missing Name or Faculty: "${row.programmeName || ''}"`);
          failed++;
          continue;
        }
        await addDoc(collection(db, 'programmes'), {
          programmeName: row.programmeName.trim(),
          faculty: row.faculty.trim(),
          durationYears: row.durationYears ? Number(row.durationYears) : 3,
          status: row.status === 'inactive' ? 'inactive' : 'active',
          createdAt: serverTimestamp(),
        });
        success++;
      } catch (err: any) {
        errors.push(`${row.programmeName || 'Unknown'} — ${err.message}`);
        failed++;
      }
    }
    return { success, failed, errors };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Programmes</h1>
          <p className="text-muted-foreground">Manage academic programmes</p>
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
            Add Programme
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Programmes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{programmes.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered programmes</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently active</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">By Faculty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">{facultyCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Faculties represented</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Programme Directory</CardTitle>
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={facultyFilter} onValueChange={setFacultyFilter}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="All Faculties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Faculties</SelectItem>
                {faculties.map((f) => (
                  <SelectItem key={f.id} value={f.facultyName}>{f.facultyName}</SelectItem>
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
              <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No programmes found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Faculty</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Duration</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{p.programmeName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.faculty || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.durationYears} year{p.durationYears !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            p.status === 'active'
                              ? 'bg-green-100 text-green-800 border-green-200 text-xs'
                              : 'bg-gray-100 text-gray-600 border-gray-200 text-xs'
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(p)}>
                            <Edit className="h-3.5 w-3.5" />Edit
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="gap-1 text-red-600 hover:text-red-600 hover:bg-red-50"
                            onClick={() => openDelete(p)}
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
        title="Programmes"
        fields={CSV_FIELDS}
        onImport={handleBulkImport}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProgramme ? 'Edit Programme' : 'Add Programme'}</DialogTitle>
            <DialogDescription>
              {editingProgramme ? 'Update programme details' : 'Add a new academic programme'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prog-name">Programme Name <span className="text-red-500">*</span></Label>
              <Input
                id="prog-name"
                placeholder="e.g. BSc (Hons) Computer Science"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prog-faculty">Faculty <span className="text-red-500">*</span></Label>
              <Select value={formFaculty} onValueChange={setFormFaculty}>
                <SelectTrigger id="prog-faculty">
                  <SelectValue placeholder="— Select Faculty —" />
                </SelectTrigger>
                <SelectContent>
                  {faculties.length > 0 ? (
                    faculties.map((f) => (
                      <SelectItem key={f.id} value={f.facultyName}>{f.facultyName}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled>No faculties — add in Faculties page first</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prog-duration">Duration (Years)</Label>
              <Select value={formDuration} onValueChange={setFormDuration}>
                <SelectTrigger id="prog-duration"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['1', '2', '3', '4', '5'].map((y) => (
                    <SelectItem key={y} value={y}>{y} year{y !== '1' ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prog-status">Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as 'active' | 'inactive')}>
                <SelectTrigger id="prog-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isSaving} onClick={handleSave}>
              {isSaving ? 'Saving…' : editingProgramme ? 'Save Changes' : 'Add Programme'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Programme</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingProgramme?.programmeName}</strong>? This cannot be undone.
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
