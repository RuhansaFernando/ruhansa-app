import { useState } from 'react';
import {
  collection, getDocs, query, where, updateDoc, doc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SemesterEntry {
  label: string;   // e.g. "2023/2024 Semester 1"
  gp:    number;   // grade point 0.0–4.0
}

interface StudentRow {
  docId:          string;
  studentId:      string;
  uid:            string;
  name:           string;
  oldGpa:         number;
  newGpa:         number | null;
  oldSemesters:   number[];
  newSemesters:   SemesterEntry[];
  resultDocs:     number;
  queryMethod:    string;
  status:         'pending' | 'updated' | 'skipped' | 'error';
  error?:         string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pctToPoints(mark: number): number {
  if (mark >= 70) return 4.0;
  if (mark >= 60) return 3.0;
  if (mark >= 50) return 2.0;
  if (mark >= 40) return 1.0;
  return 0.0;
}

function extractMark(rd: Record<string, any>): number {
  for (const field of ['mark', 'overall', 'overallMark', 'finalMark']) {
    const v = rd[field];
    if (typeof v === 'number' && !isNaN(v)) return v;
  }
  return 0;
}

/** Sort key for a semester label like "2023/2024 Semester 2". */
function semesterSortKey(label: string): number {
  const yearMatch = label.match(/(\d{4})\/\d{4}/);
  const startYear = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  const semNum = label.includes('Semester 2') ? 2 : label.includes('Semester 1 & 2') ? 1.5 : 1;
  return startYear * 10 + semNum;
}

async function fetchResultDocs(
  docId: string,
  studentId: string,
  uid: string,
): Promise<{ docs: Record<string, any>[]; method: string }> {
  const seen = new Set<string>();
  const merged: Record<string, any>[] = [];

  const merge = (snap: Awaited<ReturnType<typeof getDocs>>) => {
    snap.docs.forEach((d) => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        merged.push({ _id: d.id, ...d.data() });
      }
    });
  };

  const byStudentId = await getDocs(
    query(collection(db, 'results'), where('studentId', '==', studentId))
  );
  merge(byStudentId);

  if (docId !== studentId) {
    const byDocId = await getDocs(
      query(collection(db, 'results'), where('studentId', '==', docId))
    );
    merge(byDocId);
  }

  if (uid) {
    const byUid = await getDocs(
      query(collection(db, 'results'), where('uid', '==', uid))
    );
    merge(byUid);
  }

  const subSnap = await getDocs(collection(db, 'students', docId, 'results'));
  merge(subSnap);

  const method =
    byStudentId.size > 0 ? 'studentId field' :
    (docId !== studentId && merged.length > 0) ? 'docId field' :
    uid && merged.length > 0 ? 'uid field' :
    merged.length > 0 ? 'subcollection' : 'none';

  return { docs: merged, method };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SyncGPASemesters() {
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [rows, setRows]         = useState<StudentRow[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const run = async () => {
    setRunning(true);
    setDone(false);
    setRows([]);

    try {
      const studentsSnap = await getDocs(collection(db, 'students'));
      const students = studentsSnap.docs.map((d) => ({
        docId:       d.id,
        studentId:   (d.data().studentId ?? d.id) as string,
        uid:         (d.data().uid ?? '') as string,
        name:        (d.data().name ?? '—') as string,
        oldGpa:      (d.data().gpa ?? 0) as number,
        oldSemesters: (d.data().gpa_by_semester ?? []) as number[],
      }));

      setProgress({ current: 0, total: students.length });
      const results: StudentRow[] = [];

      for (let i = 0; i < students.length; i++) {
        const s = students[i];
        setProgress({ current: i + 1, total: students.length });

        try {
          const { docs: resultDocs, method } = await fetchResultDocs(
            s.docId, s.studentId, s.uid
          );

          if (resultDocs.length === 0) {
            results.push({
              ...s, newGpa: null, newSemesters: [], resultDocs: 0,
              queryMethod: 'none', status: 'skipped',
            });
            setRows([...results]);
            continue;
          }

          // Detect scale (same heuristic as RecalculateGPA)
          const allRawMarks = resultDocs.map(extractMark);
          const maxMark = Math.max(...allRawMarks);
          const scale: '0-100' | '0-4' | 'unknown' =
            maxMark > 10 ? '0-100' : maxMark <= 4 ? '0-4' : 'unknown';

          // ── Step A: per-semester GPA ─────────────────────────────────────
          // Group result docs by (academicYear, semester), then within each
          // semester group by module, compute per-module grade point, then
          // average the module grade points for the semester GPA.

          // Outer key: "academicYear__semester"
          // Inner key (within semester): moduleId ?? moduleCode
          type CompMark = { mark: number; weight: number };
          const bySemester = new Map<string, Map<string, CompMark[]>>();

          resultDocs.forEach((rd) => {
            let mark = extractMark(rd);
            if (scale === '0-4') mark = Math.min(100, mark * 25);
            const weight: number = rd.weight ?? 0;

            const semKey =
              `${rd.academicYear ?? 'Unknown'}__${rd.semester ?? 'Unknown'}`;
            const modKey =
              `${rd.moduleId ?? rd.moduleCode ?? 'unknown'}`;

            if (!bySemester.has(semKey)) bySemester.set(semKey, new Map());
            const modMap = bySemester.get(semKey)!;
            if (!modMap.has(modKey)) modMap.set(modKey, []);
            modMap.get(modKey)!.push({ mark, weight });
          });

          // Sort semester keys chronologically
          const sortedSemKeys = [...bySemester.keys()].sort((a, b) => {
            const labelA = a.replace('__', ' ');
            const labelB = b.replace('__', ' ');
            return semesterSortKey(labelA) - semesterSortKey(labelB);
          });

          const newSemesters: SemesterEntry[] = sortedSemKeys.map((semKey) => {
            const modMap = bySemester.get(semKey)!;
            const modPoints: number[] = [];
            modMap.forEach((comps) => {
              const withWeight = comps.filter((c) => c.weight > 0);
              let avg: number;
              if (withWeight.length > 0) {
                const tw = withWeight.reduce((s, c) => s + c.weight, 0);
                const wm = withWeight.reduce((s, c) => s + (c.mark * c.weight) / 100, 0);
                avg = tw === 100 ? wm : (wm / tw) * 100;
              } else {
                avg = comps.reduce((s, c) => s + c.mark, 0) / comps.length;
              }
              modPoints.push(pctToPoints(avg));
            });
            const semGP = round2(
              modPoints.reduce((s, p) => s + p, 0) / modPoints.length
            );
            return {
              label: semKey.replace('__', ' '),
              gp: semGP,
            };
          });

          // ── Step B: overall GPA ──────────────────────────────────────────
          // Group all docs by moduleId+academicYear (semester excluded to
          // avoid splitting same-module components across different labels).
          const byModule = new Map<string, CompMark[]>();
          resultDocs.forEach((rd) => {
            let mark = extractMark(rd);
            if (scale === '0-4') mark = Math.min(100, mark * 25);
            const weight: number = rd.weight ?? 0;
            const modKey = `${rd.moduleId ?? rd.moduleCode ?? 'unknown'}__${rd.academicYear ?? ''}`;
            if (!byModule.has(modKey)) byModule.set(modKey, []);
            byModule.get(modKey)!.push({ mark, weight });
          });

          const allModulePoints: number[] = [];
          byModule.forEach((comps) => {
            const withWeight = comps.filter((c) => c.weight > 0);
            let avg: number;
            if (withWeight.length > 0) {
              const tw = withWeight.reduce((s, c) => s + c.weight, 0);
              const wm = withWeight.reduce((s, c) => s + (c.mark * c.weight) / 100, 0);
              avg = tw === 100 ? wm : (wm / tw) * 100;
            } else {
              avg = comps.reduce((s, c) => s + c.mark, 0) / comps.length;
            }
            allModulePoints.push(pctToPoints(avg));
          });

          const newGpa = allModulePoints.length > 0
            ? round2(allModulePoints.reduce((s, p) => s + p, 0) / allModulePoints.length)
            : 0;

          // ── Step C: persist ───────────────────────────────────────────────
          await updateDoc(doc(db, 'students', s.docId), {
            gpa:             newGpa,
            gpa_by_semester: newSemesters.map((e) => e.gp),
          });

          results.push({
            ...s, newGpa, newSemesters, resultDocs: resultDocs.length,
            queryMethod: method, status: 'updated',
          });

        } catch (err) {
          results.push({
            ...s, newGpa: null, newSemesters: [], resultDocs: 0,
            queryMethod: '—', status: 'error',
            error: (err as Error).message,
          });
        }

        setRows([...results]);
      }
    } finally {
      setRunning(false);
      setDone(true);
    }
  };

  const updated = rows.filter((r) => r.status === 'updated');
  const skipped = rows.filter((r) => r.status === 'skipped');
  const errored = rows.filter((r) => r.status === 'error');

  const gpColor = (gp: number) =>
    gp >= 3.5 ? 'text-green-700' :
    gp >= 2.5 ? 'text-blue-700' :
    gp >= 1.5 ? 'text-amber-700' :
    gp > 0    ? 'text-red-600'  :
                'text-red-800';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-indigo-600" />
            Sync GPA &amp; Semester History
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Rebuilds <code>gpa_by_semester</code> from actual result records grouped by
            academic year &amp; semester, then recalculates the overall <code>gpa</code>.
          </p>
        </div>

        {/* Warning */}
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-semibold">Before running</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                  <li>Overwrites <code>gpa</code> and <code>gpa_by_semester</code> on every student with results.</li>
                  <li>Students with no result docs in any lookup strategy are skipped.</li>
                  <li>Semester GPA = average of per-module grade points within that semester.</li>
                  <li>Overall GPA = average of all per-module grade points across all semesters.</li>
                  <li>Safe to re-run; subsequent runs produce the same result.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            onClick={run}
            disabled={running}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running… ({progress.current} / {progress.total})
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {done ? 'Run Again' : 'Run Sync'}
              </>
            )}
          </Button>

          {done && (
            <div className="flex gap-3 text-sm">
              <span className="text-green-700 font-medium">{updated.length} updated</span>
              {skipped.length > 0 && (
                <span className="text-muted-foreground">{skipped.length} skipped</span>
              )}
              {errored.length > 0 && (
                <span className="text-red-600 font-medium">{errored.length} errors</span>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {(running || done) && progress.total > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        )}

        {/* Results table */}
        {rows.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs">
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Student</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">ID</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Docs</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Old GPA</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">New GPA</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Old gpa_by_semester</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">New gpa_by_semester</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.docId} className="border-b last:border-0 hover:bg-gray-50 align-top">

                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.studentId}</td>

                        {/* Docs */}
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {r.resultDocs > 0 ? r.resultDocs : '—'}
                        </td>

                        {/* Old GPA */}
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {r.oldGpa > 0 ? r.oldGpa.toFixed(2) : '—'}
                        </td>

                        {/* New GPA */}
                        <td className="px-3 py-2 text-center">
                          {r.newGpa !== null ? (
                            <span className={`font-semibold ${gpColor(r.newGpa)}`}>
                              {r.newGpa.toFixed(2)}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Old gpa_by_semester */}
                        <td className="px-3 py-2">
                          {r.oldSemesters.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.oldSemesters.map((gp, idx) => (
                                <span key={idx} className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                  {gp.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* New gpa_by_semester */}
                        <td className="px-3 py-2">
                          {r.newSemesters.length > 0 ? (
                            <div className="space-y-0.5">
                              {r.newSemesters.map((e) => (
                                <div key={e.label} className="flex items-center gap-2">
                                  <span className={`font-mono text-xs font-semibold w-8 ${gpColor(e.gp)}`}>
                                    {e.gp.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{e.label}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2 text-center">
                          {r.status === 'updated' && (
                            <Badge className="bg-green-100 text-green-800 border-green-200 gap-1 text-xs">
                              <CheckCircle className="h-3 w-3" /> Updated
                            </Badge>
                          )}
                          {r.status === 'skipped' && (
                            <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                              No results
                            </Badge>
                          )}
                          {r.status === 'error' && (
                            <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 text-xs">
                              <XCircle className="h-3 w-3" /> Error
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error details */}
        {errored.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-red-700">Errors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {errored.map((r) => (
                <div key={r.docId} className="text-sm">
                  <span className="font-medium">{r.name} ({r.studentId}):</span>{' '}
                  <span className="text-red-600">{r.error}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
