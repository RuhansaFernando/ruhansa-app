import { useState } from 'react';
import Papa from 'papaparse';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from './ui/select';
import { Upload, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: 'ssa' | 'mentor' | 'registry' | 'faculty' | 'student' | 'course_leader' | 'advisor';
  onImport: (rows: any[]) => Promise<{ success: number; failed: number; errors: string[] }>;
}

const ROLE_LABELS: Record<string, string> = {
  ssa: 'Student Support Advisors',
  mentor: 'Academic Mentors',
  registry: 'Registry Staff',
  faculty: 'Faculty Administrators',
  student: 'Students',
  course_leader: 'Course Leaders',
  advisor: 'Academic Advisors',
};

const ROLE_ID_KEY: Record<string, string> = {
  ssa: 'StaffID',
  mentor: 'StaffID',
  registry: 'StaffID',
  faculty: 'StaffID',
  student: 'StudentID',
  course_leader: 'StaffID',
  advisor: 'StaffID',
};

const REQUIRED_FIELDS: Record<string, { key: string; label: string; required: boolean }[]> = {
  ssa: [
    { key: 'StaffID', label: 'Staff ID', required: true },
    { key: 'FullName', label: 'Full Name', required: true },
    { key: 'Email', label: 'Email', required: true },
  ],
  mentor: [
    { key: 'StaffID', label: 'Staff ID', required: true },
    { key: 'FullName', label: 'Full Name', required: true },
    { key: 'Email', label: 'Email', required: true },
    { key: 'Department', label: 'Department', required: false },
  ],
  registry: [
    { key: 'StaffID', label: 'Staff ID', required: true },
    { key: 'FullName', label: 'Full Name', required: true },
    { key: 'Email', label: 'Email', required: true },
  ],
  faculty: [
    { key: 'StaffID', label: 'Staff ID', required: true },
    { key: 'FullName', label: 'Full Name', required: true },
    { key: 'Email', label: 'Email', required: true },
    { key: 'Department', label: 'Department', required: false },
  ],
  course_leader: [
    { key: 'StaffID', label: 'Staff ID', required: true },
    { key: 'FullName', label: 'Full Name', required: true },
    { key: 'Email', label: 'Email', required: true },
    { key: 'Programme', label: 'Programme', required: false },
    { key: 'Level', label: 'Level', required: false },
  ],
  advisor: [
    { key: 'StaffID', label: 'Staff ID', required: true },
    { key: 'FullName', label: 'Full Name', required: true },
    { key: 'Email', label: 'Email', required: true },
    { key: 'Department', label: 'Department', required: false },
    { key: 'Specialisation', label: 'Specialisation', required: false },
  ],
  student: [
    { key: 'StudentID', label: 'Student ID', required: true },
    { key: 'FullName', label: 'Full Name', required: true },
    { key: 'Email', label: 'Email', required: true },
    { key: 'Programme', label: 'Programme', required: false },
    { key: 'Level', label: 'Level', required: false },
    { key: 'Faculty', label: 'Faculty', required: false },
    { key: 'Intake', label: 'Intake', required: false },
    { key: 'Gender', label: 'Gender', required: false },
    { key: 'ContactNumber', label: 'Contact Number', required: false },
    { key: 'EnrollmentDate', label: 'Enrollment Date', required: false },
  ],
};

type Step = 'upload' | 'mapping' | 'filter' | 'preview' | 'result';

const PASSWORD_MESSAGES: Record<string, { id: string; noun: string }> = {
  student: { id: 'StudentID', noun: 'Students' },
  registry: { id: 'StaffID', noun: 'Registry staff' },
  ssa: { id: 'StaffID', noun: 'Student Support Advisors' },
  mentor: { id: 'StaffID', noun: 'Academic Mentors' },
  faculty: { id: 'StaffID', noun: 'Faculty Administrators' },
  course_leader: { id: 'StaffID', noun: 'Course Leaders' },
  advisor: { id: 'StaffID', noun: 'Advisors' },
};

export function BulkImportModal({ open, onOpenChange, role, onImport }: BulkImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [roleColumn, setRoleColumn] = useState<string>('');
  const [roleValue, setRoleValue] = useState<string>('');
  const [skipRoleFilter, setSkipRoleFilter] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const fields = REQUIRED_FIELDS[role];
  const isStudent = role === 'student';
  const steps: Step[] = isStudent
    ? ['upload', 'mapping', 'filter', 'preview', 'result']
    : ['upload', 'mapping', 'preview', 'result'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        setCsvHeaders(headers);
        setCsvData(results.data as any[]);

        // Auto-map columns with similar names
        const autoMap: Record<string, string> = {};
        fields.forEach((field) => {
          const match = headers.find((h) =>
            h.toLowerCase().replace(/[^a-z]/g, '').includes(
              field.key.toLowerCase().replace(/[^a-z]/g, '')
            ) ||
            field.key.toLowerCase().replace(/[^a-z]/g, '').includes(
              h.toLowerCase().replace(/[^a-z]/g, '')
            )
          );
          if (match) autoMap[field.key] = match;
        });
        setMapping(autoMap);
        setStep('mapping');
      },
    });
  };

  const getMappedData = () => {
    let data = csvData;

    // Apply role filter if set
    if (!skipRoleFilter && roleColumn && roleValue) {
      data = csvData.filter((row) => row[roleColumn] === roleValue);
    }

    return data.map((row) => {
      const mapped: Record<string, string> = {};
      fields.forEach((field) => {
        const csvCol = mapping[field.key];
        mapped[field.key] = csvCol ? row[csvCol] ?? '' : '';
      });
      return mapped;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    const mappedData = getMappedData();
    const res = await onImport(mappedData);
    setResult(res);
    setImporting(false);
    setStep('result');
  };

  const handleClose = () => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvData([]);
    setMapping({});
    setRoleColumn('');
    setRoleValue('');
    setSkipRoleFilter(false);
    setResult(null);
    onOpenChange(false);
  };

  const requiredMapped = fields
    .filter((f) => f.required)
    .every((f) => mapping[f.key]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import {ROLE_LABELS[role]}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Upload HR's CSV file in any format. DropGuard will help you map the columns.
          </p>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex flex-wrap items-center gap-2 py-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                step === s ? 'bg-blue-100 text-blue-700' :
                steps.indexOf(step) > i
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                <span>{i + 1}</span>
                <span className="capitalize">{s === 'mapping' ? 'Map' : s}</span>
              </div>
              {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-900 mb-1">Upload HR's CSV file</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Ask HR to export staff data from their system as a CSV file and email it to you.
                Upload it here — any column names are accepted. You will map them to DropGuard fields in the next step.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-medium text-amber-900 mb-1">🔐 Temporary Password</p>
              {(() => {
                const pwMsg = PASSWORD_MESSAGES[role] ?? { id: 'StaffID', noun: 'Staff' };
                return (
                  <p className="text-sm text-amber-800">
                    Each account will be created with the temporary password:{' '}
                    <span className="font-bold">{pwMsg.id}@DropGuard</span>.{' '}
                    {pwMsg.noun} must change it on first login.
                  </p>
                );
              })()}
            </div>

            <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-600">Click to upload HR's CSV file</p>
                <p className="text-xs text-gray-400">Any CSV format accepted</p>
              </div>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-sm font-medium text-blue-900 mb-1">Map HR columns to DropGuard fields</p>
              <p className="text-xs text-blue-700">
                Your CSV has {csvHeaders.length} columns and {csvData.length} rows.
                Match each DropGuard field to the correct column from HR's file.
              </p>
            </div>

            <div>
              {fields.map((field) => (
                <div key={field.key} className="mb-3">
                  <label className="text-sm font-medium text-gray-900">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <p className="text-xs text-gray-400 mb-1">{field.required ? 'Required' : 'Optional'}</p>
                  <Select
                    value={mapping[field.key] ?? ''}
                    onValueChange={(val) => setMapping((prev) => ({ ...prev, [field.key]: val }))}
                  >
                    <SelectTrigger className="w-full h-9 text-sm">
                      <SelectValue placeholder="Select CSV column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore__">Skip this field</SelectItem>
                      {csvHeaders.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping[field.key] && mapping[field.key] !== '__ignore__' && csvData[0]?.[mapping[field.key]] && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Sample: {String(csvData[0][mapping[field.key]]).slice(0, 40)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {!requiredMapped && (
              <p className="text-xs text-red-600 text-center">
                Please map all required fields before continuing
              </p>
            )}
          </div>
        )}

        {/* STEP 3: Filter (students only) */}
        {step === 'filter' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-sm font-medium text-blue-900 mb-1">
                Filter by student (optional)
              </p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Your CSV should contain only student records. If your CSV contains mixed data, you can filter by a specific column value below. Otherwise click Skip.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">
                  Which column identifies students?
                </p>
                <Select value={roleColumn} onValueChange={setRoleColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                        {csvData[0]?.[h] && (
                          <span className="text-gray-400 ml-2">
                            (e.g. {String(csvData[0][h]).slice(0, 20)})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {roleColumn && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    What value identifies students?
                  </p>
                  <Select value={roleValue} onValueChange={setRoleValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role value..." />
                    </SelectTrigger>
                    <SelectContent>
                      {[...new Set(csvData.map((row) => row[roleColumn]).filter(Boolean))].map((val) => (
                        <SelectItem key={String(val)} value={String(val)}>
                          {String(val)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {roleValue && (
                    <p className="text-xs text-green-700 mt-1.5 font-medium">
                      ✅ {csvData.filter((row) => row[roleColumn] === roleValue).length} rows match this filter
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t pt-3">
              <button
                onClick={() => { setSkipRoleFilter(true); setStep('preview'); }}
                className="text-xs text-blue-600 hover:underline"
              >
                Skip — this CSV already contains only {ROLE_LABELS[role]}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-sm font-medium text-green-900 mb-1">
                Preview — {getMappedData().length} accounts will be created
              </p>
              <p className="text-xs text-green-700">
                Review the mapped data below. Click "Import Accounts" to create all accounts.
              </p>
            </div>

            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {fields.map((f) => (
                      <th key={f.key} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Temp Password</th>
                  </tr>
                </thead>
                <tbody>
                  {getMappedData().slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t">
                      {fields.map((f) => (
                        <td key={f.key} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {row[f.key] || <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-gray-400 font-mono text-[10px]">
                        {row[ROLE_ID_KEY[role]]}@DropGuard
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {getMappedData().length > 5 && (
              <p className="text-xs text-gray-400 text-center">
                Showing 5 of {getMappedData().length} rows
              </p>
            )}
          </div>
        )}

        {/* STEP 4: Result */}
        {step === 'result' && result && (
          <div className={`rounded-xl p-5 border text-center ${
            result.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
          }`}>
            {result.failed === 0 ? (
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
            ) : (
              <XCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            )}
            <p className="font-medium text-base mb-1">
              {result.success} account{result.success !== 1 ? 's' : ''} created successfully
            </p>
            {result.failed > 0 && (
              <p className="text-sm text-amber-700 mb-3">{result.failed} failed</p>
            )}
            {result.errors.length > 0 && (
              <div className="text-left mt-3 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700">• {e}</p>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-3">
              Temporary password: <strong>{ROLE_ID_KEY[role]}@DropGuard</strong> — please share credentials with each {role === 'student' ? 'student' : 'staff member'}.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>

          {step === 'mapping' && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 gap-1.5"
              disabled={!requiredMapped}
              onClick={() => {
                if (isStudent) {
                  setStep('filter');
                } else {
                  setSkipRoleFilter(true);
                  setStep('preview');
                }
              }}
            >
              {isStudent ? 'Next: Filter by Role →' : 'Preview Data →'}
            </Button>
          )}

          {step === 'filter' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>
                ← Back
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 gap-1.5"
                disabled={!skipRoleFilter && (!roleColumn || !roleValue)}
                onClick={() => setStep('preview')}
              >
                Preview Data →
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep(isStudent ? 'filter' : 'mapping')}>
                ← Back
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 gap-1.5"
                disabled={importing}
                onClick={handleImport}
              >
                {importing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating Accounts...</>
                ) : (
                  <><Upload className="h-3.5 w-3.5" /> Import {getMappedData().length} Accounts</>
                )}
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
