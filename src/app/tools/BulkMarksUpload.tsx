import { useState } from 'react';
import {
  collection, getDocs, query, where, addDoc, updateDoc, doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Upload, Download, CheckCircle, XCircle, Loader2,
  AlertTriangle, RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CsvRow {
  studentId:         string;
  moduleCode:        string;
  academicYear:      string;
  semester:          string;
  assessmentComponent: string;
  mark:              number;
  weight:            number;
  valid:             boolean;
  error?:            string;
  rowNum:            number;
}

interface RowResult {
  rowNum:      number;
  studentId:   string;
  moduleCode:  string;
  assessmentComponent: string;
  mark:        number;
  action:      'created' | 'updated' | 'error';
  error?:      string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateGrade(mark: number): string {
  if (mark >= 70) return 'A';
  if (mark >= 60) return 'B';
  if (mark >= 50) return 'C';
  if (mark >= 40) return 'D';
  return 'F';
}

function gradeToPoints(grade: string): number {
  switch (grade) {
    case 'A': return 4.0;
    case 'B': return 3.0;
    case 'C': return 2.0;
    case 'D': return 1.0;
    default:  return 0.0;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function semesterSortKey(academicYear: string, semester: string): number {
  const m = academicYear.match(/(\d{4})/);
  const year = m ? parseInt(m[1], 10) : 0;
  const sem  = semester.includes('Semester 2') ? 2 : semester.includes('1 & 2') ? 1.5 : 1;
  return year * 10 + sem;
}

// ─── GPA recalculation (same logic as SyncGPASemesters) ───────────────────────

async function recalcStudentGPA(studentDocId: string, studentId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'results'), where('studentId', '==', studentId))
  );

  type Comp = { mark: number; weight: number };
  const byModule   = new Map<string, Comp[]>();
  const bySemester = new Map<string, Map<string, Comp[]>>();

  snap.docs.forEach((d) => {
    const rd = d.data();
    const mark:   number = rd.mark   ?? 0;
    const weight: number = rd.weight ?? 0;

    const modKey = `${rd.moduleId ?? rd.moduleCode ?? 'unknown'}__${rd.academicYear ?? ''}`;
    if (!byModule.has(modKey)) byModule.set(modKey, []);
    byModule.get(modKey)!.push({ mark, weight });

    const semKey = `${rd.academicYear ?? 'Unknown'}__${rd.semester ?? 'Unknown'}`;
    const semModKey = `${rd.moduleId ?? rd.moduleCode ?? 'unknown'}`;
    if (!bySemester.has(semKey)) bySemester.set(semKey, new Map());
    const modMap = bySemester.get(semKey)!;
    if (!modMap.has(semModKey)) modMap.set(semModKey, []);
    modMap.get(semModKey)!.push({ mark, weight });
  });

  const moduleAvg = (comps: Comp[]): number => {
    const w = comps.filter((c) => c.weight > 0);
    if (w.length > 0) {
      const tw = w.reduce((s, c) => s + c.weight, 0);
      const wm = w.reduce((s, c) => s + (c.mark * c.weight) / 100, 0);
      return tw === 100 ? wm : (wm / tw) * 100;
    }
    return comps.reduce((s, c) => s + c.mark, 0) / comps.length;
  };

  // Overall GPA
  const modulePoints: number[] = [];
  byModule.forEach((comps) => {
    modulePoints.push(gradeToPoints(calculateGrade(moduleAvg(comps))));
  });
  const gpa = modulePoints.length > 0
    ? round2(modulePoints.reduce((s, p) => s + p, 0) / modulePoints.length)
    : 0;

  // Per-semester GPA array (chronological)
  const semKeys = [...bySemester.keys()].sort((a, b) => {
    const [yearA, semA] = a.split('__');
    const [yearB, semB] = b.split('__');
    return semesterSortKey(yearA, semA) - semesterSortKey(yearB, semB);
  });
  const gpaBySemester: number[] = semKeys.map((semKey) => {
    const modMap = bySemester.get(semKey)!;
    const pts: number[] = [];
    modMap.forEach((comps) => {
      pts.push(gradeToPoints(calculateGrade(moduleAvg(comps))));
    });
    return round2(pts.reduce((s, p) => s + p, 0) / pts.length);
  });

  await updateDoc(doc(db, 'students', studentDocId), {
    gpa, gpa_by_semester: gpaBySemester,
  });
}

// ─── CSV template ─────────────────────────────────────────────────────────────

const TEMPLATE_HEADER = 'studentId,moduleCode,academicYear,semester,assessmentComponent,mark,weight';
const TEMPLATE_ROWS = [
  'STD001,CS101,2024/2025,Semester 1,Coursework 1,65,40',
  'STD001,CS101,2024/2025,Semester 1,Coursework 2,70,30',
  'STD001,CS101,2024/2025,Semester 1,Final Exam,72,30',
  'STD002,CS102,2024/2025,Semester 2,Assignment 1,55,50',
  'STD002,CS102,2024/2025,Semester 2,Final Exam,60,50',
  'STD003,CS103,2023/2024,Semester 1,Coursework 1,45,40',
  'STD003,CS103,2023/2024,Semester 1,Coursework 2,42,30',
  'STD003,CS103,2023/2024,Semester 1,Final Exam,38,30',
];

function downloadTemplate() {
  const csv = [TEMPLATE_HEADER, ...TEMPLATE_ROWS].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'bulk_marks_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkMarksUpload() {
  const [csvRows,      setCsvRows]      = useState<CsvRow[]>([]);
  const [showPreview,  setShowPreview]  = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [progress,     setProgress]     = useState({ current: 0, total: 0 });
  const [rowResults,   setRowResults]   = useState<RowResult[]>([]);
  const [done,         setDone]         = useState(false);
  const [gpaStatus,    setGpaStatus]    = useState<'idle' | 'running' | 'done'>('idle');

  // ── Parse CSV ───────────────────────────────────────────────────────────────

  const handleFile = async (file: File) => {
    const Papa = (await import('papaparse')).default;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const raw = res.data as Record<string, string>[];
        const parsed: CsvRow[] = raw.map((row, i) => {
          const studentId         = (row['studentId']          ?? '').trim();
          const moduleCode        = (row['moduleCode']         ?? '').trim();
          const academicYear      = (row['academicYear']       ?? '').trim();
          const semester          = (row['semester']           ?? '').trim();
          const assessmentComponent = (row['assessmentComponent'] ?? '').trim();
          const markRaw           = (row['mark']               ?? '').trim();
          const weightRaw         = (row['weight']             ?? '').trim();

          const mark   = parseFloat(markRaw);
          const weight = parseFloat(weightRaw);

          let error: string | undefined;
          if (!studentId)         error = 'Missing studentId';
          else if (!moduleCode)   error = 'Missing moduleCode';
          else if (!academicYear) error = 'Missing academicYear';
          else if (!semester)     error = 'Missing semester';
          else if (!assessmentComponent) error = 'Missing assessmentComponent';
          else if (isNaN(mark) || mark < 0 || mark > 100) error = `Invalid mark: "${markRaw}"`;
          else if (weightRaw !== '' && (isNaN(weight) || weight < 0 || weight > 100))
            error = `Invalid weight: "${weightRaw}"`;

          return {
            rowNum: i + 2, // 1-based + header row
            studentId, moduleCode, academicYear, semester,
            assessmentComponent,
            mark:   isNaN(mark)   ? 0 : mark,
            weight: isNaN(weight) ? 0 : weight,
            valid:  !error,
            error,
          };
        });
        setCsvRows(parsed);
        setShowPreview(true);
        setRowResults([]);
        setDone(false);
        setGpaStatus('idle');
      },
      error: () => alert('Failed to parse CSV. Check the file format.'),
    });
  };

  // ── Upload ───────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    const validRows = csvRows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setUploading(true);
    setDone(false);
    setRowResults([]);
    setProgress({ current: 0, total: validRows.length });

    // Load modules once for moduleId lookup
    const modulesSnap = await getDocs(collection(db, 'modules'));
    const moduleMap = new Map<string, { id: string; moduleName: string }>();
    modulesSnap.docs.forEach((d) => {
      const code = (d.data().moduleCode ?? '').trim();
      if (code) moduleMap.set(code, { id: d.id, moduleName: d.data().moduleName ?? '' });
    });

    // Load students once for docId lookup
    const studentsSnap = await getDocs(collection(db, 'students'));
    const studentDocMap = new Map<string, string>(); // studentId → docId
    studentsSnap.docs.forEach((d) => {
      const sid = (d.data().studentId ?? '').trim();
      if (sid) studentDocMap.set(sid, d.id);
    });

    const results: RowResult[] = [];
    const affectedStudents = new Map<string, string>(); // studentId → docId

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setProgress({ current: i + 1, total: validRows.length });

      try {
        const grade  = calculateGrade(row.mark);
        const status = row.mark >= 40 ? 'pass' : 'fail';
        const modInfo = moduleMap.get(row.moduleCode);

        // Find existing result doc: query by studentId + moduleCode, filter client-side
        const existingSnap = await getDocs(
          query(
            collection(db, 'results'),
            where('studentId',  '==', row.studentId),
            where('moduleCode', '==', row.moduleCode),
          )
        );
        const existingDoc = existingSnap.docs.find((d) => {
          const rd = d.data();
          return (
            rd.assessmentComponent === row.assessmentComponent &&
            rd.academicYear        === row.academicYear &&
            rd.semester            === row.semester
          );
        });

        if (existingDoc) {
          await updateDoc(doc(db, 'results', existingDoc.id), {
            mark: row.mark, grade, status, weight: row.weight,
            uploadedBy: 'Bulk Upload',
          });
          results.push({ rowNum: row.rowNum, studentId: row.studentId, moduleCode: row.moduleCode, assessmentComponent: row.assessmentComponent, mark: row.mark, action: 'updated' });
        } else {
          await addDoc(collection(db, 'results'), {
            studentId:          row.studentId,
            moduleCode:         row.moduleCode,
            moduleName:         modInfo?.moduleName ?? '',
            moduleId:           modInfo?.id ?? row.moduleCode,
            assessmentComponent: row.assessmentComponent,
            academicYear:       row.academicYear,
            semester:           row.semester,
            mark:               row.mark,
            grade,
            status,
            weight:             row.weight,
            uploadedBy:        'Bulk Upload',
            createdAt:          serverTimestamp(),
          });
          results.push({ rowNum: row.rowNum, studentId: row.studentId, moduleCode: row.moduleCode, assessmentComponent: row.assessmentComponent, mark: row.mark, action: 'created' });
        }

        const docId = studentDocMap.get(row.studentId);
        if (docId) affectedStudents.set(row.studentId, docId);

      } catch (err) {
        results.push({
          rowNum: row.rowNum, studentId: row.studentId, moduleCode: row.moduleCode,
          assessmentComponent: row.assessmentComponent, mark: row.mark,
          action: 'error', error: (err as Error).message,
        });
      }

      setRowResults([...results]);
    }

    // ── Recalculate GPA for all affected students ──────────────────────────
    setGpaStatus('running');
    for (const [studentId, docId] of affectedStudents) {
      try {
        await recalcStudentGPA(docId, studentId);
      } catch {
        // non-fatal; mark upload already succeeded
      }
    }
    setGpaStatus('done');
    setUploading(false);
    setDone(true);
  };

  // ── Derived stats ────────────────────────────────────────────────────────────

  const validCount   = csvRows.filter((r) => r.valid).length;
  const invalidCount = csvRows.filter((r) => !r.valid).length;
  const created  = rowResults.filter((r) => r.action === 'created').length;
  const updated  = rowResults.filter((r) => r.action === 'updated').length;
  const errored  = rowResults.filter((r) => r.action === 'error').length;

  const gradeBadgeClass = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-blue-100  text-blue-800  border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'D': return 'bg-orange-100 text-orange-800 border-orange-200';
      default:  return 'bg-red-100   text-red-800   border-red-200';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Upload className="h-6 w-6 text-emerald-600" />
            Bulk Marks Upload
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload a CSV file to create or update assessment component marks for
            multiple students at once. GPA and semester history are recalculated
            automatically after upload.
          </p>
        </div>

        {/* Warning */}
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-semibold">Before uploading</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                  <li>Existing result docs matched by <code>studentId + moduleCode + academicYear + semester + assessmentComponent</code> will be <strong>overwritten</strong>.</li>
                  <li>Leave <code>weight</code> as <code>0</code> for equal weighting across all components of a module.</li>
                  <li>Marks must be 0–100. Weights must be 0–100 (percentages summing to 100 per module, or all 0).</li>
                  <li>GPA is recalculated for every student whose results were changed.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template + Upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step 1 — Download Template &amp; Upload CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Download CSV Template
              </Button>
              <p className="text-sm text-muted-foreground">
                Fill in your marks, then upload the file below.
              </p>
            </div>

            {/* Column reference */}
            <div className="rounded-lg border bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">CSV columns</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs text-gray-700">
                {[
                  ['studentId',          'e.g. STD001'],
                  ['moduleCode',         'e.g. CS101'],
                  ['academicYear',       'e.g. 2024/2025'],
                  ['semester',           'e.g. Semester 1'],
                  ['assessmentComponent','e.g. Final Exam'],
                  ['mark',               '0–100'],
                  ['weight',             '0–100 (0 = equal weight)'],
                ].map(([col, hint]) => (
                  <div key={col}>
                    <code className="font-semibold">{col}</code>
                    <span className="text-muted-foreground ml-1">— {hint}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                id="bulk-marks-csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <label htmlFor="bulk-marks-csv" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium text-sm">Click to upload CSV</p>
                  <p className="text-xs text-muted-foreground">
                    {csvRows.length > 0
                      ? `${csvRows.length} rows loaded — upload a new file to replace`
                      : 'Accepts .csv files'}
                  </p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {showPreview && csvRows.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base">
                  Step 2 — Preview ({csvRows.length} rows)
                </CardTitle>
                <div className="flex gap-3 text-sm">
                  <span className="text-green-700 font-medium">{validCount} valid</span>
                  {invalidCount > 0 && (
                    <span className="text-red-600 font-medium">{invalidCount} invalid (will be skipped)</span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-gray-50 text-xs">
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">#</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Student ID</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Module</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Year</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Semester</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Component</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Mark</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Wt%</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Grade</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Valid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row) => {
                      const grade = calculateGrade(row.mark);
                      return (
                        <tr
                          key={row.rowNum}
                          className={`border-b last:border-0 ${row.valid ? 'hover:bg-gray-50' : 'bg-red-50/60'}`}
                        >
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">{row.rowNum}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.studentId || '—'}</td>
                          <td className="px-3 py-2 font-mono text-xs text-blue-700">{row.moduleCode || '—'}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{row.academicYear || '—'}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{row.semester || '—'}</td>
                          <td className="px-3 py-2 text-xs">{row.assessmentComponent || '—'}</td>
                          <td className="px-3 py-2 text-center font-semibold">{row.valid ? row.mark : '—'}</td>
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                            {row.valid ? (row.weight > 0 ? `${row.weight}%` : '—') : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.valid ? (
                              <Badge className={`text-xs ${gradeBadgeClass(grade)}`}>{grade}</Badge>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.valid ? (
                              <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <span title={row.error}>
                                <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Invalid row errors */}
              {invalidCount > 0 && (
                <div className="px-4 py-3 border-t bg-red-50 space-y-1">
                  <p className="text-xs font-semibold text-red-700">Validation errors (rows will be skipped):</p>
                  {csvRows.filter((r) => !r.valid).map((r) => (
                    <p key={r.rowNum} className="text-xs text-red-600">
                      Row {r.rowNum}: {r.error}
                    </p>
                  ))}
                </div>
              )}

              <div className="px-4 py-3 border-t">
                <Button
                  onClick={handleUpload}
                  disabled={uploading || validCount === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading… ({progress.current} / {progress.total})
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload {validCount} row{validCount !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress bar */}
        {(uploading || done) && progress.total > 0 && (
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            {gpaStatus !== 'idle' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {gpaStatus === 'running' ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Recalculating GPA for affected students…</>
                ) : (
                  <><CheckCircle className="h-3 w-3 text-green-600" /> GPA recalculation complete</>
                )}
              </p>
            )}
          </div>
        )}

        {/* Upload results */}
        {rowResults.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Upload Results
                </CardTitle>
                {done && (
                  <div className="flex gap-3 text-sm">
                    {created > 0 && <span className="text-green-700 font-medium">{created} created</span>}
                    {updated > 0 && <span className="text-blue-700 font-medium">{updated} updated</span>}
                    {errored > 0 && <span className="text-red-600 font-medium">{errored} errors</span>}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-gray-50 text-xs">
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">#</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Student ID</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Module</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Component</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Mark</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowResults.map((r) => (
                      <tr key={r.rowNum} className={`border-b last:border-0 ${r.action === 'error' ? 'bg-red-50/60' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">{r.rowNum}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.studentId}</td>
                        <td className="px-3 py-2 font-mono text-xs text-blue-700">{r.moduleCode}</td>
                        <td className="px-3 py-2 text-xs">{r.assessmentComponent}</td>
                        <td className="px-3 py-2 text-center font-semibold">{r.mark}</td>
                        <td className="px-3 py-2 text-center">
                          {r.action === 'created' && (
                            <Badge className="bg-green-100 text-green-800 border-green-200 gap-1 text-xs">
                              <CheckCircle className="h-3 w-3" /> Created
                            </Badge>
                          )}
                          {r.action === 'updated' && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1 text-xs">
                              <RefreshCw className="h-3 w-3" /> Updated
                            </Badge>
                          )}
                          {r.action === 'error' && (
                            <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-xs" title={r.error}>
                              <XCircle className="h-3 w-3" /> Error
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Error details */}
              {errored > 0 && (
                <div className="px-4 py-3 border-t bg-red-50 space-y-1">
                  <p className="text-xs font-semibold text-red-700">Errors:</p>
                  {rowResults.filter((r) => r.action === 'error').map((r) => (
                    <p key={r.rowNum} className="text-xs text-red-600">
                      Row {r.rowNum} ({r.studentId} / {r.moduleCode}): {r.error}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
