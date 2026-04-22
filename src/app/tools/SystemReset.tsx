import { useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { AlertTriangle, Trash2, CheckCircle, Loader2, ShieldOff } from 'lucide-react';

// Collections to wipe
const RESET_COLLECTIONS = [
  'students',
  'results',
  'attendanceRecords',
  'interventions',
  'alerts',
  'appointments',
  'wellbeingCheckIns',
  'notifications',
  'referrals',
] as const;

type CollectionName = typeof RESET_COLLECTIONS[number];

interface CollectionStatus {
  name:    CollectionName;
  state:   'pending' | 'deleting' | 'done' | 'error';
  total:   number;
  deleted: number;
  error?:  string;
}

const KEPT_COLLECTIONS = ['users', 'faculties', 'programmes', 'modules'];

export default function SystemReset() {
  const [confirmText, setConfirmText]     = useState('');
  const [running, setRunning]             = useState(false);
  const [done, setDone]                   = useState(false);
  const [statuses, setStatuses]           = useState<CollectionStatus[]>([]);

  const confirmed = confirmText.trim() === 'RESET';

  const totalDeleted = statuses.reduce((s, c) => s + c.deleted, 0);
  const currentCollection = statuses.find((s) => s.state === 'deleting');
  const overallProgress = statuses.length > 0
    ? statuses.filter((s) => s.state === 'done' || s.state === 'error').length / statuses.length
    : 0;

  const updateStatus = (name: CollectionName, patch: Partial<CollectionStatus>) => {
    setStatuses((prev) =>
      prev.map((s) => (s.name === name ? { ...s, ...patch } : s))
    );
  };

  const handleReset = async () => {
    if (!confirmed || running) return;

    setRunning(true);
    setDone(false);

    const initial: CollectionStatus[] = RESET_COLLECTIONS.map((name) => ({
      name, state: 'pending', total: 0, deleted: 0,
    }));
    setStatuses(initial);

    for (const col of RESET_COLLECTIONS) {
      updateStatus(col, { state: 'deleting' });
      try {
        const snap = await getDocs(collection(db, col));
        const total = snap.size;
        updateStatus(col, { total });

        let deleted = 0;
        for (const d of snap.docs) {
          await deleteDoc(doc(db, col, d.id));
          deleted++;
          updateStatus(col, { deleted });
        }
        updateStatus(col, { state: 'done', deleted });
      } catch (err) {
        updateStatus(col, { state: 'error', error: (err as Error).message });
      }
    }

    setRunning(false);
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldOff className="h-7 w-7 text-red-600" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-red-700">System Reset</h1>
          <p className="text-sm text-muted-foreground">One-time data wipe — removes all student and activity data</p>
        </div>
      </div>

      {/* Warning card */}
      <Card className="border-red-300 bg-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            This action is IRREVERSIBLE
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5">Will be DELETED</p>
              <div className="space-y-1">
                {RESET_COLLECTIONS.map((col) => (
                  <div key={col} className="flex items-center gap-1.5 text-sm text-red-800">
                    <Trash2 className="h-3 w-3 shrink-0" />
                    <span className="font-mono text-xs">{col}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Will be KEPT</p>
              <div className="space-y-1">
                {KEPT_COLLECTIONS.map((col) => (
                  <div key={col} className="flex items-center gap-1.5 text-sm text-green-800">
                    <CheckCircle className="h-3 w-3 shrink-0" />
                    <span className="font-mono text-xs">{col}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-sm text-red-700 border-t border-red-200 pt-3">
            All student records, marks, attendance, interventions, alerts, appointments,
            wellbeing check-ins, notifications, and referrals will be permanently deleted.
            Staff accounts, faculties, programmes, and modules will not be affected.
          </p>
        </CardContent>
      </Card>

      {/* Confirmation input */}
      {!done && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <Label htmlFor="confirm-input" className="text-sm font-medium">
              Type <span className="font-mono font-bold text-red-600">RESET</span> to enable the button
            </Label>
            <Input
              id="confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET here"
              disabled={running}
              className={confirmed ? 'border-red-400 focus-visible:ring-red-400' : ''}
              autoComplete="off"
            />
            <Button
              variant="destructive"
              className="w-full gap-2"
              disabled={!confirmed || running}
              onClick={handleReset}
            >
              {running ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Resetting…</>
              ) : (
                <><Trash2 className="h-4 w-4" />Reset System Data</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {statuses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{done ? 'Reset Complete' : 'Resetting…'}</span>
              {done && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  {totalDeleted} documents deleted
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall progress bar */}
            <div className="space-y-1.5">
              {currentCollection && (
                <p className="text-xs text-muted-foreground">
                  Clearing <span className="font-mono font-medium">{currentCollection.name}</span>…
                  {currentCollection.total > 0 && ` (${currentCollection.deleted}/${currentCollection.total})`}
                </p>
              )}
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-red-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${overallProgress * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {statuses.filter((s) => s.state === 'done' || s.state === 'error').length}/{statuses.length} collections
              </p>
            </div>

            {/* Per-collection status table */}
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Collection</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Deleted</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((s) => (
                    <tr key={s.name} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{s.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.state === 'pending' ? '—' : s.deleted}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {s.state === 'pending' ? '—' : s.total}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.state === 'pending'  && <span className="text-xs text-muted-foreground">Waiting</span>}
                        {s.state === 'deleting' && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500 ml-auto" />}
                        {s.state === 'done'     && <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-auto" />}
                        {s.state === 'error'    && (
                          <span className="text-xs text-red-600" title={s.error}>Error</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Success message */}
            {done && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">System reset complete</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {totalDeleted} document{totalDeleted !== 1 ? 's' : ''} deleted across {statuses.filter(s => s.state === 'done').length} collection{statuses.filter(s => s.state === 'done').length !== 1 ? 's' : ''}.
                    Staff accounts, faculties, programmes, and modules are intact.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
