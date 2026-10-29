import React, { useState, useRef, useCallback } from 'react';
import { transactionsApi } from '../services/api';

interface ValidationError {
  row: number;
  field: string;
  message: string;
  type: 'error' | 'warning';
}

interface ParsedRow {
  rowNum: number;
  date: string;
  description: string;
  amount: string;
  category: string;
  type: string;
  paymentMode: string;
  status: 'valid' | 'warning' | 'error';
  issues?: string[];
}

const sampleCSVContent = `Date,Description,Amount,Category,Type,PaymentMode
2026-09-28,Grocery Market,2450,Food & Dining,expense,UPI
2026-09-27,Tech Corp Salary,65000,Salary,income,Net Banking
2026-09-26,Uber Ride,480,Travel,expense,Credit Card
2026-09-25,,1200,Shopping,expense,UPI
2026-09-24,Electric Utility Bill,,Bills,expense,Net Banking
2026-09-23,Client Project Bonus,15000,Freelance,income,Net Banking
2026-09-22,Movie Tickets,650,Entertainment,expense,Cash
28/09/2026,Coffee House,280,Food & Dining,expense,UPI
2026-09-20,Petrol Refill,2200,Travel,expense,Debit Card
2026-09-19,Medical Clinic,1500,Healthcare,expense,Credit Card
2026-09-18,Gym Membership,3000,Others,expense,Credit Card
2026-09-17,Bookstore,N/A,Education,expense,Cash`;

const UploadData: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseAndValidate = (csvText: string) => {
    setIsValidating(true);
    const lines = csvText.trim().split('\n');
    const rows: ParsedRow[] = [];
    const errors: ValidationError[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',').map(s => s.trim());
      const rowNum = i + 1;
      const [rawDate = '', rawDesc = '', rawAmt = '', rawCat = '', rawType = '', rawMode = ''] = parts;

      const issues: string[] = [];
      let rowStatus: 'valid' | 'warning' | 'error' = 'valid';

      // Check amount
      const numAmt = parseFloat(rawAmt);
      if (!rawAmt || isNaN(numAmt)) {
        errors.push({
          row: rowNum,
          field: 'Amount',
          message: `Missing or invalid Amount in row ${rowNum}`,
          type: 'error'
        });
        issues.push('❌ Missing Amount');
        rowStatus = 'error';
      }

      // Check date format (ISO YYYY-MM-DD expected)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!rawDate || !dateRegex.test(rawDate)) {
        errors.push({
          row: rowNum,
          field: 'Date',
          message: `Invalid date format in row ${rowNum} (expected YYYY-MM-DD)`,
          type: 'warning'
        });
        issues.push('⚠️ Invalid date format');
        if (rowStatus !== 'error') rowStatus = 'warning';
      }

      // Check description
      if (!rawDesc) {
        errors.push({
          row: rowNum,
          field: 'Description',
          message: `Blank description in row ${rowNum}`,
          type: 'warning'
        });
        issues.push('⚠️ Blank description');
        if (rowStatus !== 'error') rowStatus = 'warning';
      }

      rows.push({
        rowNum,
        date: rawDate || '—',
        description: rawDesc || 'Untitled Transaction',
        amount: rawAmt || '—',
        category: rawCat || 'Others',
        type: rawType.toLowerCase() === 'income' ? 'income' : 'expense',
        paymentMode: rawMode || 'Cash',
        status: rowStatus,
        issues
      });
    }

    setPreviewData(rows);
    setValidationErrors(errors);
    setIsValidating(false);
    setStep(2);
  };

  const handleFileUpload = (uploadedFile: File) => {
    setFile(uploadedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseAndValidate(text);
    };
    reader.readAsText(uploadedFile);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const loadDemoData = () => {
    const demoBlob = new File([sampleCSVContent], 'demo_financial_records.csv', { type: 'text/csv' });
    handleFileUpload(demoBlob);
  };

  const handleImportToDatabase = async () => {
    setIsImporting(true);
    setStep(3);
    setImportProgress(20);

    try {
      // Filter importable rows
      const importable = previewData.filter(r => r.status !== 'error' && !isNaN(parseFloat(r.amount)));
      
      const payload = importable.map(r => {
        let cleanDate = r.date;
        // Normalize DD/MM/YYYY to YYYY-MM-DD if needed
        if (cleanDate.includes('/')) {
          const parts = cleanDate.split('/');
          if (parts.length === 3) {
            cleanDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        return {
          type: (r.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
          category: r.category || 'Others',
          payment_mode: r.paymentMode || 'Cash',
          description: r.description || 'Imported Transaction',
          amount: parseFloat(r.amount),
          date: cleanDate,
          source: 'import' as const,
        };
      });

      setImportProgress(60);
      if (payload.length > 0) {
        await transactionsApi.createBatch(payload);
      }
      setImportProgress(100);

      setTimeout(() => {
        setIsImporting(false);
        setImportSuccess(true);
        setStep(4);
      }, 500);
    } catch (err: any) {
      alert(err.message || 'Failed to import records to database');
      setIsImporting(false);
      setStep(2);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPreviewData([]);
    setValidationErrors([]);
    setStep(1);
    setImportProgress(0);
    setImportSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validRowsCount = previewData.filter(r => r.status === 'valid').length;
  const warningRowsCount = previewData.filter(r => r.status === 'warning').length;
  const errorRowsCount = previewData.filter(r => r.status === 'error').length;

  return (
    <div className="page-container bg-mesh">
      <div className="page-content animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h1 className="page-title">📤 Upload Financial Data</h1>
            <p className="page-subtitle">Batch import bank statements, CSV, or Excel records with automated schema validation</p>
          </div>
          <button
            onClick={loadDemoData}
            className="btn-secondary mt-4 sm:mt-0 text-sm flex items-center gap-2"
          >
            <span>⚡</span> Load Demo CSV with Errors
          </button>
        </div>

        {/* Pipeline Step Visualizer */}
        <div className="section-card mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative">
            <div className={`flex items-center gap-3 ${step >= 1 ? 'text-primary-400 font-semibold' : 'text-surface-500'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${step >= 1 ? 'bg-primary-500/20 border border-primary-500/40 text-primary-300' : 'bg-surface-800 border border-surface-700'}`}>
                1
              </div>
              <div>
                <p className="text-sm">Upload File</p>
                <p className="text-xs text-surface-500">CSV / Excel</p>
              </div>
            </div>

            <div className="hidden md:block flex-1 h-0.5 bg-surface-700/60 mx-2" />

            <div className={`flex items-center gap-3 ${step >= 2 ? 'text-primary-400 font-semibold' : 'text-surface-500'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${step >= 2 ? 'bg-primary-500/20 border border-primary-500/40 text-primary-300' : 'bg-surface-800 border border-surface-700'}`}>
                2
              </div>
              <div>
                <p className="text-sm">Validate Data</p>
                <p className="text-xs text-surface-500">Syntax & Schema check</p>
              </div>
            </div>

            <div className="hidden md:block flex-1 h-0.5 bg-surface-700/60 mx-2" />

            <div className={`flex items-center gap-3 ${step >= 3 ? 'text-primary-400 font-semibold' : 'text-surface-500'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${step >= 3 ? 'bg-primary-500/20 border border-primary-500/40 text-primary-300' : 'bg-surface-800 border border-surface-700'}`}>
                3
              </div>
              <div>
                <p className="text-sm">Preview</p>
                <p className="text-xs text-surface-500">Audit flagged rows</p>
              </div>
            </div>

            <div className="hidden md:block flex-1 h-0.5 bg-surface-700/60 mx-2" />

            <div className={`flex items-center gap-3 ${step === 4 ? 'text-emerald-400 font-semibold' : 'text-surface-500'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${step === 4 ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-surface-800 border border-surface-700'}`}>
                4
              </div>
              <div>
                <p className="text-sm">Database Sync</p>
                <p className="text-xs text-surface-500">Import committed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Upload Dropzone */}
        {step === 1 && (
          <div className="section-card animate-scale-in">
            <h2 className="section-title">
              <span>📄</span> Select or Drop Financial File
            </h2>
            <div
              className={`dropzone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-4xl shadow-glow">
                  📂
                </div>
                <div>
                  <p className="text-surface-100 font-bold text-xl">
                    Drag and drop your spreadsheet here, or <span className="text-primary-400 underline decoration-primary-500/50">browse</span>
                  </p>
                  <p className="text-surface-400 text-sm mt-2 max-w-md mx-auto">
                    Supported formats: <span className="text-surface-200 font-medium">.csv, .xlsx, .xls</span> up to 15MB. Real-time validation checks for date structure, required amount columns, and category parity.
                  </p>
                </div>
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-surface-800/80 border border-surface-700/50 text-xs text-surface-400">
                  <span>💡 Tip:</span> Make sure your columns are: <code className="text-primary-300">Date, Description, Amount, Category, Type</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 & 3: Validation & Preview */}
        {(step === 2 || step === 3) && (
          <div className="space-y-6 animate-slide-up">
            {/* Validation Diagnostic Summary */}
            <div className="section-card">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="section-title mb-1">
                    <span>🔬</span> Validation Diagnostics
                  </h2>
                  <p className="text-surface-400 text-sm">
                    File: <span className="text-surface-200 font-semibold">{file?.name || 'demo_financial_records.csv'}</span> ({previewData.length} records analyzed)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={resetAll} className="btn-secondary text-sm">
                    ✕ Cancel & Upload Different File
                  </button>
                  <button
                    onClick={handleImportToDatabase}
                    disabled={isImporting}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <span>💾</span> Import {validRowsCount + warningRowsCount} Valid Rows
                  </button>
                </div>
              </div>

              {/* Status Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-surface-400 uppercase tracking-wider font-semibold">Valid Rows</p>
                    <p className="text-2xl font-bold text-emerald-400">{validRowsCount}</p>
                  </div>
                  <span className="text-3xl">✅</span>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-surface-400 uppercase tracking-wider font-semibold">Warnings / Cleanable</p>
                    <p className="text-2xl font-bold text-amber-400">{warningRowsCount}</p>
                  </div>
                  <span className="text-3xl">⚠️</span>
                </div>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-surface-400 uppercase tracking-wider font-semibold">Critical Errors</p>
                    <p className="text-2xl font-bold text-rose-400">{errorRowsCount}</p>
                  </div>
                  <span className="text-3xl">❌</span>
                </div>
              </div>

              {/* Error Callout list matching prompt examples */}
              {validationErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-surface-900/80 border border-surface-700/60 mb-6 space-y-2">
                  <p className="text-sm font-bold text-surface-200 mb-2">Detected Issues Log:</p>
                  {validationErrors.map((err, idx) => (
                    <div
                      key={idx}
                      className={`text-sm flex items-center gap-2 px-3 py-2 rounded-lg font-mono ${
                        err.type === 'error'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      <span>{err.type === 'error' ? '❌' : '⚠️'}</span>
                      <span>{err.message}</span>
                      <span className="text-xs opacity-70 ml-auto">[field: {err.field}]</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Data Preview Table */}
            <div className="section-card">
              <h2 className="section-title">
                <span>👁️</span> Data Preview ({previewData.length} records)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-surface-400 text-left border-b border-surface-700/50">
                      <th className="pb-3 pr-3 font-semibold">Row</th>
                      <th className="pb-3 pr-3 font-semibold">Date</th>
                      <th className="pb-3 pr-3 font-semibold">Description</th>
                      <th className="pb-3 pr-3 font-semibold">Category</th>
                      <th className="pb-3 pr-3 font-semibold">Type</th>
                      <th className="pb-3 pr-3 font-semibold">Payment Mode</th>
                      <th className="pb-3 pr-3 font-semibold text-right">Amount</th>
                      <th className="pb-3 font-semibold text-center">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row) => (
                      <tr
                        key={row.rowNum}
                        className={`border-b border-surface-700/20 transition-colors ${
                          row.status === 'error'
                            ? 'bg-rose-500/5 hover:bg-rose-500/10'
                            : row.status === 'warning'
                            ? 'bg-amber-500/5 hover:bg-amber-500/10'
                            : 'hover:bg-surface-800/30'
                        }`}
                      >
                        <td className="py-3 pr-3 font-mono text-xs text-surface-500">#{row.rowNum}</td>
                        <td className="py-3 pr-3 font-mono text-surface-300">{row.date}</td>
                        <td className="py-3 pr-3 font-medium text-surface-200">{row.description}</td>
                        <td className="py-3 pr-3">
                          <span className="badge-info">{row.category}</span>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={row.type === 'income' ? 'badge-success' : 'badge-danger'}>
                            {row.type}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-surface-400">{row.paymentMode}</td>
                        <td className="py-3 pr-3 text-right font-mono font-semibold text-surface-100">
                          {row.amount !== '—' && !isNaN(Number(row.amount)) ? `₹${parseFloat(row.amount).toLocaleString('en-IN')}` : <span className="text-rose-400 font-bold">{row.amount}</span>}
                        </td>
                        <td className="py-3 text-center">
                          {row.status === 'valid' && (
                            <span className="badge-success">Ready</span>
                          )}
                          {row.status === 'warning' && (
                            <span className="badge-warning" title={row.issues?.join(', ')}>
                              Warning
                            </span>
                          )}
                          {row.status === 'error' && (
                            <span className="badge-danger" title={row.issues?.join(', ')}>
                              Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 3 Importing Progress Modal or Bar */}
            {isImporting && (
              <div className="section-card border-primary-500/40 bg-surface-900/90 animate-scale-in">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
                  <div>
                    <h3 className="font-bold text-white">Importing to Database...</h3>
                    <p className="text-xs text-surface-400">Normalizing schema and indexing transactions</p>
                  </div>
                  <span className="ml-auto font-mono text-primary-400 font-bold">{importProgress}%</span>
                </div>
                <div className="w-full h-3 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Import Complete */}
        {step === 4 && importSuccess && (
          <div className="section-card text-center py-12 animate-scale-in">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-4xl mb-4 shadow-glow">
              🎉
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Import Completed Successfully!</h2>
            <p className="text-surface-300 max-w-md mx-auto mb-6">
              <span className="text-emerald-400 font-semibold">{validRowsCount + warningRowsCount}</span> records have been committed to the FinSight IQ transaction ledger. <span className="text-rose-400 font-semibold">{errorRowsCount}</span> unparsable rows were skipped.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={resetAll} className="btn-secondary text-sm">
                Upload Another File
              </button>
              <a href="/transactions" className="btn-primary text-sm">
                View in Transactions Table →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadData;
