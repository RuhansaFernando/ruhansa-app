import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Download,
  Loader2,
  Clock,
} from 'lucide-react';
import { useAuth } from '../AuthContext';

// ─── Risk calculation (same as RegistryGradesPage) ─────────────────────────
function calculateRisk(gpa: number, attendance: number, absences: number) {
  let score = 0;
  if (gpa < 1.5) score += 40;
  else if (gpa < 2.0) score += 30;
  else if (gpa < 2.5) score += 20;
  else if (gpa < 3.0) score += 10;

  if (attendance < 60) score += 40;
  else if (attendance < 70) score += 30;
  else if (attendance < 80) score += 20;
  else if (attendance < 85) score += 10;

  if (absences >= 7) score += 20;
  else if (absences >= 5) score += 15;
  else if (absences >= 3) score += 10;
  else if (absences >= 2) score += 5;

  const riskLevel = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { riskLevel, riskScore: score };
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface ParsedRow {
  student_id: string;
  attendance_percentage: number;
  consecutive_absences: number;
  academic_year: string;
  semester: string;
}

interface UploadResult {
  total: number;
  processed: number;
  failed: string[];
  flagged: number;
}

interface UploadHistory {
  id: string;
  uploadedBy: string;
  fileName: string;
  total: number;
  processed: number;
  failed: number;
  flagged: number;
  createdAt: string;
}

const EXPECTED_HEADERS = ['student_id', 'attendance_percentage', 'consecutive_absences', 'academic_year', 'semester'];

const TEMPLATE_CSV =
  'student_id,attendance_percentage,consecutive_absences,academic_year,semester\n' +
  'STU001,85,1,2024/2025,Semester 1\n' +
  'STU002,72,3,2024/2025,Semester 1\n';

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'attendance_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    }) + ' ' + new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

export default function AcademicUploadPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [history, setHistory] = useState<UploadHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'attendance_uploads'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setHistory(
        snap.docs.map((d) => ({
          id: d.id,
          uploadedBy: d.data().uploadedBy ?? 'Unknown',
          fileName: d.data().fileName ?? '—',
          total: d.data().total ?? 0,
          processed: d.data().processed ?? 0,
          failed: d.data().failed ?? 0,
          flagged: d.data().flagged ?? 0,
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? d.data().createdAt ?? '',
        })),
      );
      setLoadingHistory(false);
    });
    return () => unsub();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
      toast.error('Only .csv and .xlsx files are accepted');
      return;
    }
    setSelectedFile(file);
    setResult(null);
  };

  const parseFile = async (file: File): Promise<ParsedRow[]> => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const Papa = (await import('papaparse')).default;
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const rows = res.data as Record<string, string>[];
            const parsed: ParsedRow[] = rows.map((r) => ({
              student_id: (r['student_id'] ?? '').trim(),
              attendance_percentage: parseFloat(r['attendance_percentage'] ?? '0'),
              consecutive_absences: parseInt(r['consecutive_absences'] ?? '0', 10),
              academic_year: (r['academic_year'] ?? '').trim(),
              semester: (r['semester'] ?? '').trim(),
            }));
            resolve(parsed);
          },
          error: reject,
        });
      });
    } else {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      return rows.map((r) => ({
        student_id: String(r['student_id'] ?? '').trim(),
        attendance_percentage: parseFloat(String(r['attendance_percentage'] ?? '0')),
        consecutive_absences: parseInt(String(r['consecutive_absences'] ?? '0'), 10),
        academic_year: String(r['academic_year'] ?? '').trim(),
        semester: String(r['semester'] ?? '').trim(),
      }));
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setResult(null);

    try {
      const rows = await parseFile(selectedFile);

      // Load all students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentMap = new Map<string, { id: string; gpa: number }>();
      studentsSnap.forEach((d) => {
        const sid = (d.data().studentId ?? '').toString().trim();
        if (sid) studentMap.set(sid.toUpperCase(), { id: d.id, gpa: d.data().gpa ?? 0 });
      });

      let processed = 0;
      let flagged = 0;
      const failed: string[] = [];

      for (const row of rows) {
        if (!row.student_id || isNaN(row.attendance_percentage) || isNaN(row.consecutive_absences)) {
          failed.push(row.student_id || '(empty)');
          continue;
        }

        const key = row.student_id.toUpperCase();
        const studentEntry = studentMap.get(key);
        if (!studentEntry) {
          failed.push(row.student_id);
          continue;
        }

        const { id: docId, gpa } = studentEntry;
        const { riskLevel, riskScore } = calculateRisk(
          gpa,
          row.attendance_percentage,
          row.consecutive_absences,
        );

        const isAtRisk = row.attendance_percentage < 80 || row.consecutive_absences >= 3;
        if (isAtRisk) flagged++;

        await updateDoc(doc(db, 'students', docId), {
          attendancePercentage: row.attendance_percentage,
          consecutiveAbsences: row.consecutive_absences,
          riskLevel,
          riskScore,
          attendanceYear: row.academic_year,
          attendanceSemester: row.semester,
        });

        processed++;
      }

      const uploadResult: UploadResult = { total: rows.length, processed, failed, flagged };
      setResult(uploadResult);

      await addDoc(collection(db, 'attendance_uploads'), {
        uploadedBy: user?.name ?? 'Faculty Administrator',
        fileName: selectedFile.name,
        total: rows.length,
        processed,
        failed: failed.length,
        flagged,
        failedIds: failed,
        createdAt: serverTimestamp(),
      });

      if (failed.length > 0) {
        toast.warning(`Upload complete. ${processed} processed, ${failed.length} failed.`);
      } else {
        toast.success(`Upload complete. ${processed} students updated.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to process file. Please check the format and try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Attendance</h1>
        <p className="text-muted-foreground">Upload a CSV or Excel file to update student attendance records and recalculate risk.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Section */}
        <div className="space-y-4">
          {/* Expected Format */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Expected File Format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The file must contain the following columns (CSV or XLSX):
              </p>
              <div className="bg-gray-50 rounded-md p-3 font-mono text-xs space-y-1">
                {EXPECTED_HEADERS.map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-blue-600 font-semibold">{h}</span>
                    {h === 'student_id' && <span className="text-muted-foreground">— e.g. STU001</span>}
                    {h === 'attendance_percentage' && <span className="text-muted-foreground">— numeric, 0–100</span>}
                    {h === 'consecutive_absences' && <span className="text-muted-foreground">— integer</span>}
                    {h === 'academic_year' && <span className="text-muted-foreground">— e.g. 2024/2025</span>}
                    {h === 'semester' && <span className="text-muted-foreground">— e.g. Semester 1</span>}
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="gap-2 w-full" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Download Template CSV
              </Button>
            </CardContent>
          </Card>

          {/* Drop Zone */}
          <Card>
            <CardContent className="pt-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : selectedFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) validateAndSetFile(f);
                  }}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="h-10 w-10 text-green-500" />
                    <p className="font-medium text-green-700">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB — Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Drag & drop your file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">Accepts .csv and .xlsx</p>
                  </div>
                )}
              </div>

              <Button
                className="w-full mt-4 gap-2"
                disabled={!selectedFile || processing}
                onClick={handleProcess}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Process File
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {result ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Upload Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{result.total}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total Rows</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{result.processed}</div>
                    <p className="text-xs text-muted-foreground mt-1">Updated</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">{result.flagged}</div>
                    <p className="text-xs text-muted-foreground mt-1">Flagged At-Risk</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{result.failed.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Failed</p>
                  </div>
                </div>

                {result.failed.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      Failed Student IDs
                    </p>
                    <div className="bg-red-50 rounded-md p-3 max-h-40 overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {result.failed.map((id, i) => (
                          <Badge key={i} className="bg-red-100 text-red-800 border-red-200 text-xs">
                            {id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      These student IDs were not found in the system or had invalid data.
                    </p>
                  </div>
                )}

                {result.flagged > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                    <strong>{result.flagged} students</strong> were flagged as at-risk
                    (attendance &lt; 80% or consecutive absences ≥ 3). Their risk levels have been recalculated.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center min-h-[200px] border-dashed">
              <CardContent className="text-center pt-8">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground text-sm">Upload results will appear here</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Upload History */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Upload History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No uploads yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Date & Time</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">File Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Uploaded By</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Total</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Updated</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Flagged</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(h.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{h.fileName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{h.uploadedBy}</td>
                      <td className="px-4 py-3 text-center">{h.total}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-green-600 font-semibold">{h.processed}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-amber-600 font-semibold">{h.flagged}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {h.failed > 0 ? (
                          <span className="text-red-600 font-semibold">{h.failed}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
