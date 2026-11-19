import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Database,
  Download,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  bulkImportChurchMembersToFirestore,
  ChurchMemberFirestoreRecord,
  CsvMemberImportRow,
  deleteImportedChurchMember,
  normalizeChurchMemberStatus,
  normalizeChurchMemberType,
  subscribeImportedChurchMembers,
} from '../../lib/firestoreStore';
import { Fellowship } from '../../types/church';

interface ParsedPreviewRow extends CsvMemberImportRow {
  rowIndex: number;
  normalizedType: string;
  normalizedStatus: string;
  errors: string[];
  isValid: boolean;
}

interface ImportMembersUtilityProps {
  fellowships: Fellowship[];
  canCreateMembers: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSqlSynced: () => void | Promise<void>;
  onNotify: (msg: string) => void;
  onClose?: () => void;
}

const SAMPLE_CSV_CONTENT = [
  'fullName,phone,email,location,fellowshipGroup,membershipType,membershipStatus,registrationDate,notes',
  '"Grace Kemunto Nyakundi","0722418902","grace.kemunto@example.com","Ogembo Town","Ogembo Central Fellowship","Existing member","Active member","2026-03-01","Choir & Women fellowship member"',
  '"David Mokua Ombongi","0713905411","","Tendere Market","Tendere Home Fellowship","New member","Orientation","2026-03-05","Joined during Sunday service"',
].join('\n');

function parseCsvRows(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeHeaderKey(header: string): keyof CsvMemberImportRow | null {
  const key = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key) return null;
  if (['membernumber', 'memberid', 'gvccid', 'regno', 'registrationnumber', 'id'].includes(key)) {
    return 'memberNumber';
  }
  if (['fullname', 'name', 'membername', 'names', 'fullnames'].includes(key)) {
    return 'fullName';
  }
  if (['phone', 'phonenumber', 'mobile', 'mobilenumber', 'tel', 'telephone', 'contact'].includes(key)) {
    return 'phone';
  }
  if (['email', 'emailaddress', 'mail'].includes(key)) {
    return 'email';
  }
  if (['location', 'residence', 'area', 'village', 'estate', 'address', 'ward'].includes(key)) {
    return 'location';
  }
  if (['fellowshipgroup', 'fellowship', 'cell', 'cellgroup', 'homecell', 'group'].includes(key)) {
    return 'fellowshipGroup';
  }
  if (['membershiptype', 'type', 'category'].includes(key)) {
    return 'membershipType';
  }
  if (['membershipstatus', 'status', 'state'].includes(key)) {
    return 'membershipStatus';
  }
  if (['registrationdate', 'joineddate', 'datejoined', 'date', 'joined'].includes(key)) {
    return 'registrationDate';
  }
  if (['notes', 'note', 'remarks', 'comment', 'comments'].includes(key)) {
    return 'notes';
  }
  return null;
}

function formatFirestoreErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      if (parsed.error.toLowerCase().includes('permission') || parsed.error.toLowerCase().includes('insufficient')) {
        return 'Firestore permission denied. Please sign in with the authorized GVCC admin Google account.';
      }
      return parsed.error;
    }
  } catch {
    // Plain error string
  }
  if (raw.toLowerCase().includes('permission')) {
    return 'Firestore permission denied. Please verify your admin Google account.';
  }
  return raw || 'Operation failed.';
}

export const ImportMembersUtility: React.FC<ImportMembersUtilityProps> = ({
  fellowships,
  canCreateMembers,
  authFetch,
  onSqlSynced,
  onNotify,
  onClose,
}) => {
  const { firebaseUser, signInWithGoogle, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedPreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mirrorToSql, setMirrorToSql] = useState<boolean>(true);
  const [importing, setImporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importSummary, setImportSummary] = useState<{
    firestoreCount: number;
    sqlCount: number;
    fileName: string;
  } | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState<boolean>(false);

  // Live Firestore church_members list
  const [firestoreMembers, setFirestoreMembers] = useState<ChurchMemberFirestoreRecord[]>([]);
  const [firestoreSearch, setFirestoreSearch] = useState<string>('');
  const [listenerError, setListenerError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setFirestoreMembers([]);
      setListenerError(null);
      return;
    }
    setListenerError(null);
    const unsub = subscribeImportedChurchMembers(
      firebaseUser,
      (items) => {
        setFirestoreMembers(items);
        setListenerError(null);
      },
      (err) => {
        setListenerError(formatFirestoreErrorMessage(err));
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  const validPreviewRows = useMemo(
    () => parsedRows.filter((r) => r.isValid),
    [parsedRows]
  );

  const invalidPreviewRows = useMemo(
    () => parsedRows.filter((r) => !r.isValid),
    [parsedRows]
  );

  const filteredFirestoreMembers = useMemo(() => {
    const q = firestoreSearch.trim().toLowerCase();
    if (!q) return firestoreMembers;
    return firestoreMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.location.toLowerCase().includes(q) ||
        m.fellowshipGroup.toLowerCase().includes(q)
    );
  }, [firestoreMembers, firestoreSearch]);

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gvcc-members-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFirestoreError(null);
    setImportSummary(null);
    setSelectedFileName(file.name);

    try {
      const text = await file.text();
      const matrix = parseCsvRows(text);
      if (matrix.length < 2) {
        setParsedRows([]);
        setParseError('CSV file must contain a header row and at least one member row.');
        return;
      }

      const rawHeaders = matrix[0];
      const headerMapping = rawHeaders.map((h) => normalizeHeaderKey(h));
      if (!headerMapping.includes('fullName') || !headerMapping.includes('phone')) {
        setParsedRows([]);
        setParseError(
          'CSV header must include at least "fullName" (or Name) and "phone" (or Phone Number) columns.'
        );
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const preview: ParsedPreviewRow[] = matrix.slice(1).map((cells, idx) => {
        const draft: CsvMemberImportRow = {
          fullName: '',
          phone: '',
        };
        headerMapping.forEach((fieldKey, colIdx) => {
          if (!fieldKey) return;
          const val = (cells[colIdx] || '').trim();
          if (val) {
            draft[fieldKey] = val;
          }
        });

        const errors: string[] = [];
        if ((draft.fullName || '').trim().length < 2) {
          errors.push('Full name must be at least 2 characters');
        }
        if ((draft.phone || '').trim().length < 4) {
          errors.push('Phone number must be at least 4 characters');
        }

        const normalizedType = normalizeChurchMemberType(draft.membershipType);
        const normalizedStatus = normalizeChurchMemberStatus(draft.membershipStatus);

        return {
          ...draft,
          registrationDate: draft.registrationDate || today,
          rowIndex: idx + 2,
          normalizedType,
          normalizedStatus,
          errors,
          isValid: errors.length === 0,
        };
      });

      setParsedRows(preview);
    } catch {
      setParsedRows([]);
      setParseError('Unable to read the selected CSV file. Please ensure it is UTF-8 encoded.');
    }
  };

  const handleConnectGoogleAdmin = async () => {
    setConnectingGoogle(true);
    setFirestoreError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setFirestoreError(formatFirestoreErrorMessage(err));
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleClearCsv = () => {
    setSelectedFileName('');
    setParsedRows([]);
    setParseError(null);
    setImportSummary(null);
    setFirestoreError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRunImport = async () => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setFirestoreError('Connect a verified Google Admin account before importing into Firestore.');
      return;
    }
    if (!validPreviewRows.length) {
      setFirestoreError('No valid rows found in the uploaded CSV.');
      return;
    }

    setImporting(true);
    setFirestoreError(null);
    setImportSummary(null);
    setProgress({ done: 0, total: validPreviewRows.length });

    try {
      const result = await bulkImportChurchMembersToFirestore(
        firebaseUser,
        validPreviewRows,
        (done, total) => setProgress({ done, total })
      );

      let sqlCount = 0;
      if (mirrorToSql && canCreateMembers) {
        for (const row of validPreviewRows) {
          const matchedFellowship = fellowships.find(
            (f) => f.name.toLowerCase() === (row.fellowshipGroup || '').trim().toLowerCase()
          );
          try {
            const res = await authFetch('/api/admin/members', {
              method: 'POST',
              body: JSON.stringify({
                fullName: row.fullName,
                phone: row.phone,
                email: row.email || '',
                location: row.location || '',
                fellowshipId: matchedFellowship ? String(matchedFellowship.id) : '',
                membershipType: row.normalizedType,
                membershipStatus: row.normalizedStatus,
                registrationDate: row.registrationDate,
                notes: row.notes || '',
              }),
            });
            if (res.ok) {
              sqlCount += 1;
            }
          } catch {
            // Non-blocking SQL mirror fallback
          }
        }
        if (sqlCount > 0) {
          await onSqlSynced();
        }
      }

      setImportSummary({
        firestoreCount: result.importedCount,
        sqlCount,
        fileName: selectedFileName || 'members.csv',
      });
      setParsedRows([]);
      setSelectedFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onNotify(`Imported ${result.importedCount} member(s) into Firestore.`);
    } catch (err) {
      setFirestoreError(formatFirestoreErrorMessage(err));
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  const handleDeleteFirestoreMember = async (memberId: string) => {
    if (!firebaseUser) return;
    try {
      await deleteImportedChurchMember(firebaseUser, memberId);
      setConfirmDeleteId(null);
      onNotify('Member removed from Firestore church_members collection.');
    } catch (err) {
      setFirestoreError(formatFirestoreErrorMessage(err));
    }
  };

  const isFirebaseVerified = Boolean(firebaseUser && firebaseUser.emailVerified);

  return (
    <div className="bg-white border border-slate-300 shadow-sm p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#0F172A] text-[#E2C28B] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Bulk Import Church Members (CSV to Cloud Firestore)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a CSV roster to validate rows, assign GVCC membership numbers, and batch-write directly to the{' '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 text-[11px]">church_members</code> Firestore collection.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV Template
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Import Members Utility"
              className="p-2 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Firestore Admin Auth Banner */}
      <div
        className={`p-3.5 border flex flex-wrap items-center justify-between gap-3 ${
          isFirebaseVerified
            ? 'bg-emerald-50/60 border-emerald-200'
            : 'bg-amber-50 border-amber-300'
        }`}
      >
        <div className="flex items-center gap-2.5 text-xs">
          <ShieldCheck
            className={`w-4 h-4 shrink-0 ${
              isFirebaseVerified ? 'text-emerald-700' : 'text-amber-700'
            }`}
          />
          {isFirebaseVerified ? (
            <span className="text-slate-800">
              Firestore connected as verified admin{' '}
              <strong className="font-mono">{firebaseUser?.email}</strong>
            </span>
          ) : (
            <span className="text-amber-900">
              Firestore security rules require a verified Google Admin sign-in to write or view{' '}
              <code className="font-mono">church_members</code> records.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isFirebaseVerified ? (
            <button
              type="button"
              disabled={connectingGoogle}
              onClick={handleConnectGoogleAdmin}
              className="px-3.5 py-1.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
            >
              {connectingGoogle ? 'Connecting...' : 'Connect Google Admin Account'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signOut()}
              className="px-2.5 py-1 border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Switch Google Account
            </button>
          )}
        </div>
      </div>

      {/* Error / Success Alerts */}
      {parseError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{parseError}</span>
        </div>
      )}

      {firestoreError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{firestoreError}</span>
        </div>
      )}

      {importSummary && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Successfully imported <strong>{importSummary.firestoreCount}</strong> member(s) from{' '}
              <span className="font-mono">{importSummary.fileName}</span> into Firestore{' '}
              <code className="font-mono">church_members</code>
              {importSummary.sqlCount > 0
                ? ` and synced ${importSummary.sqlCount} record(s) to the SQL Directory.`
                : '.'}
            </span>
          </div>
        </div>
      )}

      {/* Upload Dropzone & Options */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2 border border-dashed border-slate-300 bg-slate-50/70 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-900">
              {selectedFileName ? `Selected file: ${selectedFileName}` : 'Choose a CSV file of church members'}
            </p>
            <p className="text-[11px] text-slate-500">
              Required columns: <span className="font-mono">fullName</span>,{' '}
              <span className="font-mono">phone</span>. Optional:{' '}
              <span className="font-mono">email, location, fellowshipGroup, membershipType, membershipStatus, registrationDate, notes</span>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
              id="gvcc-csv-member-upload"
            />
            <label
              htmlFor="gvcc-csv-member-upload"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {selectedFileName ? 'Replace CSV File' : 'Select CSV File'}
            </label>
            {selectedFileName && (
              <button
                type="button"
                onClick={handleClearCsv}
                className="px-3 py-2 border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="border border-slate-200 bg-slate-50/40 p-4 flex flex-col justify-between gap-3">
          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={mirrorToSql}
              disabled={!canCreateMembers}
              onChange={(e) => setMirrorToSql(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Also mirror valid rows to the local SQL Membership Directory
            </span>
          </label>

          <button
            type="button"
            disabled={importing || !validPreviewRows.length || !isFirebaseVerified}
            onClick={handleRunImport}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            <CloudUpload className="w-4 h-4" />
            {importing
              ? `Importing (${progress?.done ?? 0}/${progress?.total ?? validPreviewRows.length})...`
              : `Import ${validPreviewRows.length} Valid Member(s) to Firestore`}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {importing && progress && (
        <div className="space-y-1">
          <div className="w-full h-2 bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-[#B4823E] transition-all"
              style={{
                width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[11px] font-mono text-slate-500">
            Batching into Cloud Firestore: {progress.done} / {progress.total} records committed
          </p>
        </div>
      )}

      {/* CSV Validation Preview Table */}
      {parsedRows.length > 0 && (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              CSV Validation Preview
            </h3>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-600">Total: {parsedRows.length}</span>
              <span className="text-emerald-700 font-semibold">Valid: {validPreviewRows.length}</span>
              {invalidPreviewRows.length > 0 && (
                <span className="text-red-700 font-semibold">
                  Invalid (skipped): {invalidPreviewRows.length}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-64 border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0">
                <tr>
                  <th className="py-2 px-3">Row</th>
                  <th className="py-2 px-3">Full Name</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3">Location / Fellowship</th>
                  <th className="py-2 px-3">Type / Status</th>
                  <th className="py-2 px-3">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.slice(0, 100).map((row) => (
                  <tr
                    key={`${row.rowIndex}-${row.fullName}`}
                    className={row.isValid ? 'bg-white' : 'bg-red-50/60'}
                  >
                    <td className="py-2 px-3 font-mono text-slate-500">#{row.rowIndex}</td>
                    <td className="py-2 px-3">
                      <span className="font-medium text-slate-900">{row.fullName || '—'}</span>
                      {row.email && (
                        <span className="block text-[11px] text-slate-500">{row.email}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-700">{row.phone || '—'}</td>
                    <td className="py-2 px-3 text-slate-600">
                      <span>{row.location || '—'}</span>
                      {row.fellowshipGroup && (
                        <span className="block text-[11px] text-[#9A6B2F]">
                          {row.fellowshipGroup}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      <span>{row.normalizedType}</span>
                      <span className="block text-[11px] text-slate-500">
                        {row.normalizedStatus}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {row.isValid ? (
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                          Ready
                        </span>
                      ) : (
                        <span className="text-[11px] text-red-700 font-medium">
                          {row.errors.join('; ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 100 && (
            <p className="text-[11px] text-slate-500">
              Showing first 100 rows in preview. All {validPreviewRows.length} valid rows will be imported.
            </p>
          )}
        </div>
      )}

      {/* Live Firestore church_members Collection Registry */}
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#9A6B2F]" />
            <h3 className="text-sm font-semibold text-slate-900">
              Firestore <code className="font-mono text-xs">church_members</code> Collection ({firestoreMembers.length})
            </h3>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search Firestore members..."
              value={firestoreSearch}
              onChange={(e) => setFirestoreSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 text-xs w-64"
            />
          </div>
        </div>

        {listenerError && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900">
            {listenerError}
          </div>
        )}

        {!isFirebaseVerified ? (
          <p className="text-xs text-slate-500 py-3">
            Connect your verified Google Admin account above to view and manage imported Firestore member records.
          </p>
        ) : filteredFirestoreMembers.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            No member documents found in the Firestore <code className="font-mono">church_members</code> collection yet.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-80 border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0">
                <tr>
                  <th className="py-2 px-3">Member ID</th>
                  <th className="py-2 px-3">Name & Contact</th>
                  <th className="py-2 px-3">Location & Fellowship</th>
                  <th className="py-2 px-3">Type / Status</th>
                  <th className="py-2 px-3">Joined</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFirestoreMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                      {m.memberNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-900 block">{m.fullName}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {m.phone}
                        {m.email ? ` · ${m.email}` : ''}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <span className="block">{m.location || '—'}</span>
                      {m.fellowshipGroup && (
                        <span className="text-[11px] text-[#9A6B2F]">{m.fellowshipGroup}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="block text-slate-700">{m.membershipType}</span>
                      <span className="inline-block mt-0.5 px-2 py-0.5 border border-slate-200 bg-slate-50 text-[11px] text-slate-700">
                        {m.membershipStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {m.registrationDate}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {confirmDeleteId === m.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteFirestoreMember(m.id)}
                            className="px-2 py-1 bg-red-600 text-white text-[11px] font-medium cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 border border-slate-300 text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(m.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 text-[11px] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
