import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Search, Plus, Edit, Trash2, Building2, Loader2, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { CsvDataImportModal } from '../components/CsvDataImportModal';

interface Faculty {
  id: string;
  facultyName: string;
  facultyCode: string;
  deanName: string;
  status: 'active' | 'inactive';
}

const CSV_FIELDS = [
  { key: 'facultyName', label: 'Faculty Name', required: true, sampleValue: 'School of Computing' },
  { key: 'facultyCode', label: 'Faculty Code', required: true, sampleValue: 'SOC' },
  { key: 'dean', label: 'Dean Name', required: false, sampleValue: 'Dr. Jane Smith' },
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
  a.download = 'faculties_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export default function AdminFacultiesPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingFaculty, setDeletingFaculty] = useState<Faculty | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formFacultyName, setFormFacultyName] = useState('');
  const [formFacultyCode, setFormFacultyCode] = useState('');
  const [formDeanName, setFormDeanName] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'faculties'), orderBy('facultyName')),
      (snap) => {
        setFaculties(
          snap.docs.map((d) => ({
            id: d.id,
            facultyName: d.data().facultyName ?? '',
            facultyCode: d.data().facultyCode ?? '',
            deanName: d.data().deanName ?? '',
            status: d.data().status ?? 'active',
          }))
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = faculties.filter((f) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      f.facultyName.toLowerCase().includes(q) ||
      f.facultyCode.toLowerCase().includes(q) ||
      f.deanName.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = faculties.filter((f) => f.status === 'active').length;

  const resetForm = () => {
    setFormFacultyName('');
    setFormFacultyCode('');
    setFormDeanName('');
    setFormStatus('active');
  };

  const openAdd = () => {
    setEditingFaculty(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (f: Faculty) => {
    setEditingFaculty(f);
    setFormFacultyName(f.facultyName);
    setFormFacultyCode(f.facultyCode);
    setFormDeanName(f.deanName);
    setFormStatus(f.status);
    setIsDialogOpen(true);
  };

  const openDelete = (f: Faculty) => {
    setDeletingFaculty(f);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
    if (!formFacultyName.trim() || !formFacultyCode.trim()) {
      toast.error('Faculty Name and Code are required');
      return;
    }
    const codeUpper = formFacultyCode.trim().toUpperCase();
    const duplicate = faculties.find(
      (f) => f.facultyCode.toUpperCase() === codeUpper && f.id !== editingFaculty?.id
    );
    if (duplicate) {
      toast.error('A faculty with this code already exists.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        facultyName: formFacultyName.trim(),
        facultyCode: formFacultyCode.trim().toUpperCase(),
        deanName: formDeanName.trim(),
        status: formStatus,
      };
      if (editingFaculty) {
        await updateDoc(doc(db, 'faculties', editingFaculty.id), payload);
        toast.success('Faculty updated successfully');
      } else {
        await addDoc(collection(db, 'faculties'), { ...payload, createdAt: serverTimestamp() });
        toast.success('Faculty added successfully');
      }
      setIsDialogOpen(false);
    } catch {
      toast.error('Failed to save faculty. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingFaculty) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'faculties', deletingFaculty.id));
      toast.success('Faculty deleted');
      setIsDeleteOpen(false);
    } catch {
      toast.error('Failed to delete faculty.');
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
        if (!row.facultyName?.trim() || !row.facultyCode?.trim()) {
          errors.push(`Skipped — missing Name or Code: "${row.facultyName || ''}"`);
          failed++;
          continue;
        }
        await addDoc(collection(db, 'faculties'), {
          facultyName: row.facultyName.trim(),
          facultyCode: row.facultyCode.trim().toUpperCase(),
          deanName: row.dean?.trim() ?? '',
          status: row.status === 'inactive' ? 'inactive' : 'active',
          createdAt: serverTimestamp(),
        });
        success++;
      } catch (err: any) {
        errors.push(`${row.facultyName || 'Unknown'} — ${err.message}`);
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
          <h1 className="text-3xl font-bold">Faculties</h1>
          <p className="text-muted-foreground">Manage academic faculties</p>
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
            Add Faculty
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Faculties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{faculties.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered faculties</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Faculties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently active</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Faculty Directory</CardTitle>
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code or dean..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No faculties found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Faculty Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Faculty Code</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Dean</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{f.facultyName}</td>
                      <td className="px-4 py-3 font-mono text-blue-700">{f.facultyCode || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.deanName || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            f.status === 'active'
                              ? 'bg-green-100 text-green-800 border-green-200 text-xs'
                              : 'bg-gray-100 text-gray-600 border-gray-200 text-xs'
                          }
                        >
                          {f.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(f)}>
                            <Edit className="h-3.5 w-3.5" />Edit
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="gap-1 text-red-600 hover:text-red-600 hover:bg-red-50"
                            onClick={() => openDelete(f)}
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
        title="Faculties"
        fields={CSV_FIELDS}
        onImport={handleBulkImport}
      />

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFaculty ? 'Edit Faculty' : 'Add Faculty'}</DialogTitle>
            <DialogDescription>
              {editingFaculty ? 'Update faculty details' : 'Add a new academic faculty'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fac-name">Faculty Name <span className="text-red-500">*</span></Label>
              <Input
                id="fac-name"
                placeholder="e.g. School of Computing"
                value={formFacultyName}
                onChange={(e) => setFormFacultyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fac-code">Faculty Code <span className="text-red-500">*</span></Label>
              <Input
                id="fac-code"
                placeholder="e.g. SOC"
                value={formFacultyCode}
                onChange={(e) => setFormFacultyCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fac-dean">Dean Name</Label>
              <Input
                id="fac-dean"
                placeholder="e.g. Dr. Jane Smith"
                value={formDeanName}
                onChange={(e) => setFormDeanName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fac-status">Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as 'active' | 'inactive')}>
                <SelectTrigger id="fac-status"><SelectValue /></SelectTrigger>
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
              {isSaving ? 'Saving…' : editingFaculty ? 'Save Changes' : 'Add Faculty'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Faculty</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingFaculty?.facultyName}</strong>? This cannot be undone.
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
