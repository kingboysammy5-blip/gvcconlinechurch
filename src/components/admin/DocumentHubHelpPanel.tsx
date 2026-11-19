import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderTree,
  Lock,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Table,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  DriveFileItem,
  DriveFilterType,
  listDriveFiles,
  WorkspaceApiError,
} from '../../lib/workspaceApi';
import { clearWorkspaceAccessToken } from '../../lib/firebase';

interface DocumentHubHelpPanelProps {
  onOpenWorkspaceTab: () => void;
  onOpenMembersTab: () => void;
  onExportCsv: (type: 'members' | 'visitors' | 'fellowships' | 'giving' | 'rosters' | 'assets') => void;
  canExportReports: boolean;
  onNotify: (msg: string) => void;
}

const MIME_DISPLAY: Record<string, { label: string; badgeClass: string }> = {
  'application/vnd.google-apps.document': {
    label: 'Google Doc',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  'application/vnd.google-apps.spreadsheet': {
    label: 'Google Sheet',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  'application/vnd.google-apps.folder': {
    label: 'Drive Folder',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  'application/vnd.google-apps.form': {
    label: 'Google Form',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  'application/pdf': {
    label: 'PDF',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
  },
};

const FOLDER_TAXONOMY = [
  {
    folder: '01_Leadership_and_Minutes',
    tool: 'Google Docs + Drive',
    access: 'Bishop, Senior Pastors, Church Secretary (Restricted)',
    contents: 'Elders council minutes, AGM agendas, church constitution & resolutions.',
  },
  {
    folder: '02_Membership_and_Pastoral',
    tool: 'Google Sheets + Docs',
    access: 'Administration & Fellowship Secretaries (Restricted)',
    contents: 'Master member roll backups, baptism registers, pastoral care notes.',
  },
  {
    folder: '03_Finance_Tithes_and_Assets',
    tool: 'Google Sheets',
    access: 'Church Treasurer & Finance Committee Only (Restricted)',
    contents: 'Monthly tithe & offering ledgers, bank reconciliations, asset inventory valuations.',
  },
  {
    folder: '04_Sunday_Services_and_Bulletins',
    tool: 'Google Docs + Drive',
    access: 'Pastoral Team, Worship & Media Desk (Editor / Commenter)',
    contents: 'Weekly order of service, sermon outlines, choir lyrics, duty rosters.',
  },
  {
    folder: '05_Events_and_Ministries',
    tool: 'Google Drive + Forms + Sheets',
    access: 'Ministry Coordinators (Departmental Shared Folders)',
    contents: 'Youth & women conference budgets, volunteer sign-up sheets, outreach plans.',
  },
];

export const DocumentHubHelpPanel: React.FC<DocumentHubHelpPanelProps> = ({
  onOpenWorkspaceTab,
  onOpenMembersTab,
  onExportCsv,
  canExportReports,
  onNotify,
}) => {
  const { firebaseUser, workspaceAccessToken, signInWithWorkspace } = useAuth();

  const [sharedFiles, setSharedFiles] = useState<DriveFileItem[]>([]);
  const [sharedOnly, setSharedOnly] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<DriveFilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const loadSharedFiles = useCallback(async () => {
    if (!workspaceAccessToken) return;
    setLoadingFiles(true);
    setDriveError(null);
    try {
      const files = await listDriveFiles(
        workspaceAccessToken,
        searchQuery,
        filterType,
        sharedOnly
      );
      setSharedFiles(files);
    } catch (err) {
      if (err instanceof WorkspaceApiError && err.isAuthError) {
        clearWorkspaceAccessToken();
        setDriveError('Your Google session expired. Please reconnect to refresh shared files.');
      } else {
        setDriveError(err instanceof Error ? err.message : 'Could not load Drive files.');
      }
    } finally {
      setLoadingFiles(false);
    }
  }, [workspaceAccessToken, searchQuery, filterType, sharedOnly]);

  useEffect(() => {
    if (workspaceAccessToken) {
      loadSharedFiles();
    } else {
      setSharedFiles([]);
    }
  }, [workspaceAccessToken, loadSharedFiles]);

  const handleConnectGoogle = async () => {
    setSigningIn(true);
    setDriveError(null);
    try {
      await signInWithWorkspace(false);
      onNotify('Connected to Google Drive for shared church documents.');
    } catch (err: any) {
      setDriveError(err?.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#9A6B2F] font-semibold">
            GVCC Document Management &amp; SOP Guide
          </p>
          <h1 className="text-xl font-semibold text-slate-900 mt-0.5">
            Church Document Hub &amp; Helper Documentation
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Centralized portal linking Google Docs, Google Drive, and Google Sheets with standard operating guidelines for managing confidential church records, minutes, rosters, and financial ledgers.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenWorkspaceTab}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Open In-App Google Workspace Hub
        </button>
      </div>

      {/* 1. Centralized Quick-Launch Cards (Google Drive, Google Docs, Google Sheets) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Google Drive */}
        <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 bg-amber-50 border border-amber-200 text-[#9A6B2F] flex items-center justify-center">
                <FolderOpen className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Central Repository
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-900">Google Drive</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Store, organize, and manage permissions for shared church folders, PDFs, scanned title deeds, and ministry media archives.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <a
              href="https://drive.google.com/drive/shared-with-me"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-between px-3 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <span>Open Shared With Me</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://drive.google.com/drive/my-drive"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800"
              >
                My Drive <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://drive.google.com/drive/shared-drives"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800"
              >
                Shared Drives <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Google Docs */}
        <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Minutes &amp; Bulletins
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-900">Google Docs</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Draft and collaborate on Elders Council minutes, Sunday bulletins, sermon manuscripts, and official GVCC pastoral letters.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <a
              href="https://docs.google.com/document/u/0/"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-between px-3 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold"
            >
              <span>Open Google Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://docs.google.com/document/create"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800"
              >
                + New Blank Doc <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={onOpenWorkspaceTab}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
              >
                Edit In-App
              </button>
            </div>
          </div>
        </div>

        {/* Google Sheets */}
        <div className="bg-white border border-slate-200 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Ledgers &amp; Registers
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-900">Google Sheets</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Manage church budgets, tithes &amp; offerings schedules, asset valuations, and prepare CSV rosters for bulk member imports.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <a
              href="https://docs.google.com/spreadsheets/u/0/"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-between px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold"
            >
              <span>Open Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://docs.google.com/spreadsheets/create"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800"
              >
                + New Blank Sheet <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={onOpenMembersTab}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
              >
                CSV Importer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Live Shared Church Files Browser */}
      <div className="bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#9A6B2F]" />
              Shared Church Files Directory (Google Drive)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quickly locate shared Google Docs, Google Sheets, and Drive folders from your connected Google account.
            </p>
          </div>
          {workspaceAccessToken && (
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1">
              Connected: {firebaseUser?.email}
            </span>
          )}
        </div>

        {!workspaceAccessToken ? (
          <div className="p-5 bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <p className="text-xs font-semibold text-slate-900">
                Sign in with Google to view your live shared Docs, Sheets, and Drive folders here
              </p>
              <p className="text-xs text-slate-600">
                You can still use all external Google Docs, Drive, and Sheets links above anytime, or connect below to browse shared files right inside this hub.
              </p>
            </div>

            <button
              type="button"
              disabled={signingIn}
              onClick={handleConnectGoogle}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    xmlnsXlink="http://www.w3.org/1999/xlink"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {signingIn ? 'Connecting...' : 'Sign in with Google'}
                </span>
                <span style={{ display: 'none' }}>Sign in with Google</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    placeholder="Search shared files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadSharedFiles();
                    }}
                    className="pl-8 pr-3 py-1.5 border border-slate-300 text-xs w-56"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as DriveFilterType)}
                  className="px-3 py-1.5 border border-slate-300 text-xs"
                >
                  <option value="all">All File Types</option>
                  <option value="docs">Google Docs</option>
                  <option value="sheets">Google Sheets</option>
                  <option value="folders">Drive Folders</option>
                  <option value="forms">Google Forms</option>
                  <option value="pdfs">PDFs</option>
                </select>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-slate-50 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sharedOnly}
                    onChange={(e) => setSharedOnly(e.target.checked)}
                  />
                  <span>Shared with me only</span>
                </label>
                <button
                  type="button"
                  onClick={loadSharedFiles}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {sharedFiles.length} item(s)
              </span>
            </div>

            {driveError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">
                {driveError}
              </div>
            )}

            <div className="overflow-x-auto max-h-72 border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">File / Folder Name</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Owner</th>
                    <th className="py-2 px-3">Last Modified</th>
                    <th className="py-2 px-3 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sharedFiles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        {loadingFiles
                          ? 'Loading shared files from Google Drive...'
                          : 'No files matched your filter. Try unchecking "Shared with me only" to browse your full Drive.'}
                      </td>
                    </tr>
                  ) : (
                    sharedFiles.map((file) => {
                      const badge = MIME_DISPLAY[file.mimeType];
                      return (
                        <tr key={file.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {file.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 border text-[11px] font-medium ${
                                badge?.badgeClass || 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {badge?.label || file.mimeType.split('.').pop()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {file.modifiedTime
                              ? new Date(file.modifiedTime).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {file.webViewLink ? (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-300 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                Open <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 3. GVCC Document Organization & Naming Standards */}
      <div className="bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <FolderTree className="w-4 h-4 text-[#9A6B2F]" />
          <h2 className="text-sm font-semibold text-slate-900">
            Recommended Church Folder Structure in Google Drive
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3">Folder Name</th>
                <th className="py-2 pr-3">Primary Tool</th>
                <th className="py-2 pr-3">Recommended Access</th>
                <th className="py-2">Document Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FOLDER_TAXONOMY.map((item) => (
                <tr key={item.folder} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-mono font-medium text-slate-900">
                    {item.folder}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700">{item.tool}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{item.access}</td>
                  <td className="py-2.5 text-slate-600">{item.contents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Helper Guides Grid: Naming, Security & Portal CSV Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Naming & Sharing Governance */}
        <div className="bg-white border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#9A6B2F]" />
            File Naming &amp; Confidentiality Guidelines
          </h2>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="p-3 bg-slate-50 border border-slate-200 space-y-1">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#9A6B2F]" />
                Standard Naming Format
              </p>
              <p className="font-mono text-[11px] text-slate-700">
                YYYY-MM-DD — [Department] — [Clear Document Title]
              </p>
              <p className="text-[11px] text-slate-500">
                Example: <span className="font-mono">2026-11-15 — Board — Elders Council Minutes</span>
              </p>
            </div>

            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Keep Confidential Records Restricted:</strong> Member registries, pastoral counseling notes, and tithe ledgers must always stay set to <em>Restricted (Only people with access)</em>—never <em>Anyone with the link</em>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Use Viewer vs. Editor Carefully:</strong> Grant <em>Viewer</em> or <em>Commenter</em> access to ministry leaders for approved policies, reserving <em>Editor</em> rights for the Church Secretary and Treasurer.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Users className="w-3.5 h-3.5 text-[#9A6B2F] shrink-0 mt-0.5" />
                <span>
                  <strong>Quarterly Access Review:</strong> Whenever a department officer rotates roles, review folder sharing in Google Drive under <em>Manage access</em>.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* GVCC Portal <-> Google Sheets & CSV Sync */}
        <div className="bg-white border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Table className="w-4 h-4 text-emerald-700" />
            Syncing Portal Records with Google Sheets
          </h2>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              Export live GVCC database tables directly to CSV and open them in <strong>Google Sheets</strong> (<code className="font-mono text-[11px]">File → Import → Upload</code>) for financial audits, printing, or annual archiving:
            </p>

            {canExportReports ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onExportCsv('members')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Members CSV
                </button>
                <button
                  type="button"
                  onClick={() => onExportCsv('assets')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Assets CSV
                </button>
                <button
                  type="button"
                  onClick={() => onExportCsv('rosters')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Duty Rosters CSV
                </button>
                <button
                  type="button"
                  onClick={() => onExportCsv('giving')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Giving Ledger CSV
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                CSV report exports require <code className="font-mono">reports.export</code> permission.
              </p>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 space-y-1">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-[#9A6B2F]" />
                Bulk Importing from Google Sheets Back to GVCC
              </p>
              <p className="text-[11px] text-slate-600">
                In Google Sheets, click <strong>File → Download → Comma Separated Values (.csv)</strong>, then upload the file in the{' '}
                <button
                  type="button"
                  onClick={onOpenMembersTab}
                  className="underline font-semibold text-[#9A6B2F] cursor-pointer"
                >
                  Memberships CSV Importer
                </button>{' '}
                to bulk-register members into Cloud Firestore.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
