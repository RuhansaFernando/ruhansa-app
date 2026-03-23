import { useState } from 'react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Upload, CheckCircle, XCircle, Loader2, ArrowRight, Download } from 'lucide-react';

export interface CsvField {
  key: string;
  label: string;
  required?: boolean;
  sampleValue?: string;
  example?: string;
}

interface CsvDataImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: CsvField[];
  onImport: (rows: Record<string, string>[]) => Promise<{ success: number; failed: number; errors: string[] }>;
}

type Step = 'upload' | 'mapping' | 'preview' | 'result';

export function CsvDataImportModal({ open, onOpenChange, title, fields, onImport }: CsvDataImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const requiredMapped = fields.filter((f) => f.required).every((f) => mapping[f.key] && mapping[f.key] !== '__ignore__');

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
          const match = headers.find(
            (h) =>
              h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(field.key.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
              field.key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(h.toLowerCase().replace(/[^a-z0-9]/g, ''))
          );
          if (match) autoMap[field.key] = match;
        });
        setMapping(autoMap);
        setStep('mapping');
      },
    });
  };

  const getMappedData = (): Record<string, string>[] =>
    csvData.map((row) => {
      const mapped: Record<string, string> = {};
      fields.forEach((field) => {
        const col = mapping[field.key];
        mapped[field.key] = col && col !== '__ignore__' ? row[col] ?? '' : '';
      });
      return mapped;
    });

  const handleImport = async () => {
    setImporting(true);
    const res = await onImport(getMappedData());
    setResult(res);
    setImporting(false);
    setStep('result');
  };

  const handleClose = () => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvData([]);
    setMapping({});
    setResult(null);
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const headers = fields.map((f) => f.key).join(',');
    const sample = fields.map((f) => f.sampleValue ?? f.example ?? '').join(',');
    const csv = `${headers}\n${sample}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const STEPS: Step[] = ['upload', 'mapping', 'preview', 'result'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import {title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file in any format. DropGuard will help you map the columns.
          </p>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 py-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
                  step === s
                    ? 'bg-blue-100 text-blue-700'
                    : STEPS.indexOf(step) > i
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                <span>{i + 1}</span>
                <span className="capitalize">{s}</span>
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-900 mb-1">Upload a CSV file</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Upload your CSV file in any column format. You will map the columns to DropGuard fields in the next step.
              </p>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" />
                Download CSV Template
              </Button>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-600">Click to upload CSV file</p>
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
              <p className="text-sm font-medium text-blue-900 mb-1">Map CSV columns to DropGuard fields</p>
              <p className="text-xs text-blue-700">
                Your CSV has {csvHeaders.length} columns and {csvData.length} rows. Match each field to the correct column.
              </p>
            </div>

            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-4 p-3 border rounded-xl">
                  <div className="w-40 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900">{field.label}</p>
                    {field.required ? (
                      <span className="text-[10px] text-red-500 font-medium">Required</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">Optional</span>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  <Select
                    value={mapping[field.key] ?? ''}
                    onValueChange={(val) => setMapping((prev) => ({ ...prev, [field.key]: val }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select CSV column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore__">— Ignore this field —</SelectItem>
                      {csvHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                          {csvData[0]?.[h] && (
                            <span className="text-gray-400 ml-2">(e.g. {String(csvData[0][h]).slice(0, 20)})</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping[field.key] && mapping[field.key] !== '__ignore__' ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : field.required ? (
                    <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  ) : (
                    <div className="w-4 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {!requiredMapped && (
              <p className="text-xs text-red-600 text-center">Please map all required fields before continuing</p>
            )}
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-sm font-medium text-green-900 mb-1">
                Preview — {getMappedData().length} records will be imported
              </p>
              <p className="text-xs text-green-700">Review the mapped data below, then click Import to save to Firestore.</p>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {getMappedData().length > 5 && (
              <p className="text-xs text-gray-400 text-center">Showing 5 of {getMappedData().length} rows</p>
            )}
          </div>
        )}

        {/* STEP 4: Result */}
        {step === 'result' && result && (
          <div
            className={`rounded-xl p-5 border text-center ${
              result.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
            }`}
          >
            {result.failed === 0 ? (
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
            ) : (
              <XCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            )}
            <p className="font-medium text-base mb-1">
              {result.success} record{result.success !== 1 ? 's' : ''} imported successfully
            </p>
            {result.failed > 0 && <p className="text-sm text-amber-700 mb-3">{result.failed} failed</p>}
            {result.errors.length > 0 && (
              <div className="text-left mt-3 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700">• {e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            {step === 'result' ? 'Close' : 'Cancel'}
          </Button>

          {step === 'mapping' && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 gap-1.5"
              disabled={!requiredMapped}
              onClick={() => setStep('preview')}
            >
              Preview Data →
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>
                ← Back
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 gap-1.5"
                disabled={importing}
                onClick={handleImport}
              >
                {importing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing...</>
                ) : (
                  <><Upload className="h-3.5 w-3.5" /> Import {getMappedData().length} Records</>
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
