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

interface StudentRow {
  docId:            string;
  studentId:        string;
  uid:              string;
  name:             string;
  oldGpa:           number;
  newGpa:           number | null;
  modules:          number;
  resultDocs:       number;
  avgRawMark:       number | null;
  markScale:        '0-100' | '0-4' | 'unknown';
  queryMethod:      string;
  status:           'pending' | 'updated' | 'skipped' | 'error';
  error?:           string;
  // debug
  uniqueModuleIds:  number;
  groupingKeys:     string[];
  modulePoints:     number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert a percentage mark (0-100) to 4.0-scale grade points. */
function pctToPoints(mark: number): number {
  if (mark >= 70) return 4.0;
  if (mark >= 60) return 3.0;
  if (mark >= 50) return 2.0;
  if (mark >= 40) return 1.0;
  return 0.0;
}

/**
 * Detect whether the marks in a set of result docs are on a 0-100 percentage
 * scale or a 0-4 grade-point scale.
 * Heuristic: if the max value across all raw marks is > 10, assume 0-100.
 */
function detectScale(rawMarks: number[]): '0-100' | '0-4' | 'unknown' {
  if (rawMarks.length === 0) return 'unknown';
  const max = Math.max(...rawMarks);
  if (max > 10) return '0-100';
  if (max <= 4) return '0-4';
  return 'unknown'; // 4 < max <= 10, ambiguous
}

/**
 * Extract the best mark value from a result document.
 * Priority: mark → overall → overallMark → finalMark → 0
 */
function extractMark(rd: Record<string, any>): number {
  for (const field of ['mark', 'overall', 'overallMark', 'finalMark']) {
    const v = rd[field];
    if (typeof v === 'number' && !isNaN(v)) return v;
  }
  return 0;
}

/**
 * Fetch all result docs for a student, trying multiple field strategies and
 * falling back to a `results` subcollection. Returns deduplicated docs and the
 * name of the strategy that found results.
 */
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

  // Strategy 1: studentId field == the formatted studentId (e.g. "STD013")
  const byStudentId = await getDocs(
    query(collection(db, 'results'), where('studentId', '==', studentId))
  );
  merge(byStudentId);

  // Strategy 2: studentId field == the Firestore doc ID
  if (docId !== studentId) {
    const byDocId = await getDocs(
      query(collection(db, 'results'), where('studentId', '==', docId))
    );
    merge(byDocId);
  }

  // Strategy 3: uid field (Firebase Auth UID)
  if (uid) {
    const byUid = await getDocs(
      query(collection(db, 'results'), where('uid', '==', uid))
    );
    merge(byUid);
  }

  // Strategy 4: subcollection results/{studentDocId}/results
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

export default function RecalculateGPA() {
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [rows, setRows]         = useState<StudentRow[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const run = async () => {
    setRunning(true);
    setDone(false);
    setRows([]);

    try {
      // 1. Load all students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const students = studentsSnap.docs.map((d) => ({
        docId:     d.id,
        studentId: (d.data().studentId ?? d.id) as string,
        uid:       (d.data().uid ?? '') as string,
        name:      (d.data().name ?? '—') as string,
        oldGpa:    (d.data().gpa ?? 0) as number,
      }));

      setProgress({ current: 0, total: students.length });
      const results: StudentRow[] = [];

      for (let i = 0; i < students.length; i++) {
        const s = students[i];
        setProgress({ current: i + 1, total: students.length });

        try {
          // 2. Fetch results via all available strategies
          const { docs: resultDocs, method } = await fetchResultDocs(
            s.docId, s.studentId, s.uid
          );

          if (resultDocs.length === 0) {
            results.push({
              ...s, newGpa: null, modules: 0, resultDocs: 0,
              avgRawMark: null, markScale: 'unknown',
              queryMethod: 'none', status: 'skipped',
              uniqueModuleIds: 0, groupingKeys: [], modulePoints: [],
            });
            setRows([...results]);
            continue;
          }

          // 3. Extract raw marks and detect scale
          const allRawMarks = resultDocs.map(extractMark);
          const scale = detectScale(allRawMarks);
          const avgRawMark = round2(
            allRawMarks.reduce((a, b) => a + b, 0) / allRawMarks.length
          );

          // 4. Group by module + year (semester intentionally excluded — a module's
          //    components can be labelled with different semester strings, e.g.
          //    "Semester 1" vs "Semester 1 & 2", which would split one module into
          //    multiple pseudo-modules and produce wrong GPA values).
          type Comp = { mark: number; weight: number };
          const byModule   = new Map<string, Comp[]>();
          const bySemester = new Map<string, number[]>();

          resultDocs.forEach((rd) => {
            let mark = extractMark(rd);

            // If marks are on 0-4 scale, convert back to 0-100 so that the
            // grade-band conversion (≥70 → A, etc.) works correctly.
            if (scale === '0-4') mark = Math.min(100, mark * 25);

            const weight: number = rd.weight ?? 0;

            // Use moduleId (stable Firestore doc ID) if available, fall back to
            // moduleCode. Drop semester from the key so components of the same
            // module are always grouped together regardless of semester label.
            const moduleKey =
              `${rd.moduleId ?? rd.moduleCode ?? 'unknown'}` +
              `__${rd.academicYear ?? ''}`;
            if (!byModule.has(moduleKey)) byModule.set(moduleKey, []);
            byModule.get(moduleKey)!.push({ mark, weight });

            const semKey =
              `${rd.academicYear ?? 'Unknown'}__${rd.semester ?? 'Unknown'}`;
            if (!bySemester.has(semKey)) bySemester.set(semKey, []);
            bySemester.get(semKey)!.push(mark);
          });

          // 5. Per-module: weighted average mark → grade points
          const modulePoints: number[] = [];
          const moduleKeys = [...byModule.keys()];
          byModule.forEach((comps, key) => {
            const withWeight = comps.filter((c) => c.weight > 0);
            let moduleMark: number;
            if (withWeight.length > 0) {
              // Only average the components that have a defined weight
              const totalWeight = withWeight.reduce((s, c) => s + c.weight, 0);
              const weighted = withWeight.reduce((s, c) => s + (c.mark * c.weight) / 100, 0);
              moduleMark = totalWeight === 100
                ? weighted
                : (weighted / totalWeight) * 100;
            } else {
              // All weights zero — equal weighting across all components
              moduleMark = comps.reduce((s, c) => s + c.mark, 0) / comps.length;
            }
            const gp = pctToPoints(moduleMark);
            modulePoints.push(gp);
            console.log(`  [${s.studentId}] key="${key}" comps=${comps.length} marks=[${comps.map(c=>c.mark.toFixed(1)).join(',')}] avg=${moduleMark.toFixed(2)} → ${gp}`);
          });

          // debug: unique moduleId values across all result docs
          const uniqueModuleIds = new Set(resultDocs.map(rd => rd.moduleId ?? '(none)')).size;

          // debug: log first 3 raw result docs
          console.group(`[GPA DEBUG] ${s.name} (${s.studentId}) — ${resultDocs.length} docs, ${moduleKeys.length} groups`);
          console.log('First 3 result docs:', resultDocs.slice(0, 3).map(rd => ({
            _id: rd._id,
            moduleId: rd.moduleId,
            moduleCode: rd.moduleCode,
            assessmentComponent: rd.assessmentComponent,
            academicYear: rd.academicYear,
            semester: rd.semester,
            mark: rd.mark,
            grade: rd.grade,
          })));
          console.log('All grouping keys:', moduleKeys);
          console.log('Module grade points:', modulePoints);
          console.groupEnd();

          // 6. Overall GPA = unweighted average of module grade points
          const newGpa = round2(
            modulePoints.reduce((s, p) => s + p, 0) / modulePoints.length
          );

          // 7. gpa_by_semester: per-semester % average → grade points
          const gpaBySemester: number[] = [];
          bySemester.forEach((marks) => {
            const avg = marks.reduce((s, m) => s + m, 0) / marks.length;
            gpaBySemester.push(pctToPoints(avg));
          });

          // 8. Persist
          await updateDoc(doc(db, 'students', s.docId), {
            gpa:             newGpa,
            gpa_by_semester: gpaBySemester,
          });

          results.push({
            ...s, newGpa, modules: modulePoints.length,
            resultDocs: resultDocs.length, avgRawMark,
            markScale: scale, queryMethod: method, status: 'updated',
            uniqueModuleIds, groupingKeys: moduleKeys, modulePoints: [...modulePoints],
          });

        } catch (err) {
          results.push({
            ...s, newGpa: null, modules: 0, resultDocs: 0,
            avgRawMark: null, markScale: 'unknown',
            queryMethod: '—', status: 'error',
            error: (err as Error).message,
            uniqueModuleIds: 0, groupingKeys: [], modulePoints: [],
          });
        }

        setRows([...results]);
      }
    } finally {
      setRunning(false);
      setDone(true);
    }
  };

  const updated  = rows.filter((r) => r.status === 'updated');
  const skipped  = rows.filter((r) => r.status === 'skipped');
  const errored  = rows.filter((r) => r.status === 'error');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            GPA Recalculation Tool
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Recomputes every student's GPA from their <code>results</code> records,
            grouped per module with weighted component averaging.
            Tries four lookup strategies to find results for every student.
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
                  <li>Overwrites <code>gpa</code> and <code>gpa_by_semester</code> on every student doc.</li>
                  <li>Students with no results in any lookup are skipped (GPA unchanged).</li>
                  <li>The <em>Avg Mark (raw)</em> column shows the mean of all raw mark values found — use this to verify the scale detection is correct.</li>
                  <li>Safe to re-run; subsequent runs are idempotent.</li>
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
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running… ({progress.current} / {progress.total})
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {done ? 'Run Again' : 'Run Recalculation'}
              </>
            )}
          </Button>

          {done && (
            <div className="flex gap-3 text-sm">
              <span className="text-green-700 font-medium">{updated.length} updated</span>
              {skipped.length > 0 && (
                <span className="text-muted-foreground">{skipped.length} skipped (no results found)</span>
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
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
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
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Modules</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Avg Mark (raw)</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Scale</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Old GPA</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">New GPA</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2 bg-yellow-50">Module Groups (debug)</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Found via</th>
                      <th className="text-center font-medium text-muted-foreground px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.docId} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.studentId}</td>

                        {/* Result doc count */}
                        <td className="px-3 py-2 text-center text-muted-foreground text-xs">
                          {r.resultDocs > 0 ? r.resultDocs : '—'}
                        </td>

                        {/* Modules */}
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {r.modules > 0 ? r.modules : '—'}
                        </td>

                        {/* Debug: raw average mark */}
                        <td className="px-3 py-2 text-center">
                          {r.avgRawMark !== null ? (
                            <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              {r.avgRawMark}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Scale detected */}
                        <td className="px-3 py-2 text-center">
                          {r.markScale !== 'unknown' ? (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              r.markScale === '0-100'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}>
                              {r.markScale}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Old GPA */}
                        <td className="px-3 py-2 text-center text-muted-foreground text-xs">
                          {r.oldGpa > 0 ? r.oldGpa.toFixed(2) : '—'}
                        </td>

                        {/* New GPA */}
                        <td className="px-3 py-2 text-center">
                          {r.newGpa !== null ? (
                            <span className={`font-semibold ${
                              r.newGpa >= 2.5 ? 'text-green-600'
                              : r.newGpa >= 1.5 ? 'text-amber-600'
                              : r.newGpa > 0 ? 'text-red-600'
                              : 'text-red-700'
                            }`}>
                              {r.newGpa.toFixed(2)}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Debug: module grouping detail */}
                        <td className="px-3 py-2 bg-yellow-50 max-w-xs">
                          {r.groupingKeys.length > 0 ? (
                            <div className="space-y-0.5">
                              <div className="text-xs text-yellow-800 font-medium">
                                {r.uniqueModuleIds} unique moduleId(s), {r.groupingKeys.length} group(s)
                              </div>
                              {r.groupingKeys.map((k, i) => (
                                <div key={k} className="font-mono text-[10px] text-yellow-700 truncate" title={k}>
                                  [{r.modulePoints[i]?.toFixed(1) ?? '?'}] {k}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Query method */}
                        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                          {r.queryMethod}
                        </td>

                        {/* Status badge */}
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
