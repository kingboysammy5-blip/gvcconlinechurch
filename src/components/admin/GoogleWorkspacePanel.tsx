import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  FolderOpen,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clearWorkspaceAccessToken } from '../../lib/firebase';
import {
  addQuestionToGoogleForm,
  appendTextToGoogleDoc,
  createGoogleDoc,
  createGoogleForm,
  deleteGoogleChatMessage,
  DriveFileItem,
  DriveFilterType,
  getGoogleDoc,
  getGoogleForm,
  GOOGLE_CHAT_CONSOLE_URL,
  GoogleChatMessage,
  GoogleChatSpace,
  GoogleDocDetail,
  GoogleFormDetail,
  GoogleFormResponseSummary,
  listDriveFiles,
  listGoogleChatMessages,
  listGoogleChatSpaces,
  listGoogleFormResponses,
  sendGoogleChatMessage,
  trashDriveFile,
  uploadFileToDrive,
  WorkspaceApiError,
} from '../../lib/workspaceApi';

type WorkspaceSection = 'drive' | 'docs' | 'forms' | 'chat';

interface PendingMutation {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  execute: () => Promise<void>;
}

interface GoogleWorkspacePanelProps {
  onNotify: (msg: string) => void;
}

const MIME_LABELS: Record<string, string> = {
  'application/vnd.google-apps.document': 'Google Doc',
  'application/vnd.google-apps.form': 'Google Form',
  'application/vnd.google-apps.spreadsheet': 'Google Sheet',
  'application/vnd.google-apps.presentation': 'Google Slides',
  'application/vnd.google-apps.folder': 'Folder',
  'application/pdf': 'PDF Document',
};

export const GoogleWorkspacePanel: React.FC<GoogleWorkspacePanelProps> = ({ onNotify }) => {
  const { firebaseUser, workspaceAccessToken, signInWithWorkspace } = useAuth();

  const [section, setSection] = useState<WorkspaceSection>('drive');
  const [signingIn, setSigningIn] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<{
    message: string;
    isChatAppNotFound?: boolean;
  } | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);
  const [executingMutation, setExecutingMutation] = useState(false);

  // Google Drive State
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [driveFilter, setDriveFilter] = useState<DriveFilterType>('all');
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [uploadDraft, setUploadDraft] = useState({
    fileName: 'GVCC-Ministry-Notes.txt',
    content: '',
  });

  // Google Docs State
  const [docLookupInput, setDocLookupInput] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<GoogleDocDetail | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [newDocDraft, setNewDocDraft] = useState({ title: '', initialBody: '' });
  const [appendDocText, setAppendDocText] = useState('');

  // Google Forms State
  const [formLookupInput, setFormLookupInput] = useState('');
  const [selectedForm, setSelectedForm] = useState<GoogleFormDetail | null>(null);
  const [formResponses, setFormResponses] = useState<GoogleFormResponseSummary[]>([]);
  const [loadingForm, setLoadingForm] = useState(false);
  const [newFormDraft, setNewFormDraft] = useState({ title: '', description: '' });
  const [newQuestionDraft, setNewQuestionDraft] = useState({
    title: '',
    isParagraph: false,
    required: false,
  });

  // Google Chat State
  const [chatSpaces, setChatSpaces] = useState<GoogleChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<GoogleChatSpace | null>(null);
  const [chatMessages, setChatMessages] = useState<GoogleChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [newChatText, setNewChatText] = useState('');

  const handleWorkspaceError = useCallback((err: unknown) => {
    if (err instanceof WorkspaceApiError) {
      if (err.isAuthError) {
        clearWorkspaceAccessToken();
        setAuthMessage('Your Google Workspace session expired. Please sign in with Google again.');
      }
      setApiError({
        message: err.message,
        isChatAppNotFound: err.isChatAppNotFound,
      });
      return;
    }
    setApiError({
      message: err instanceof Error ? err.message : 'Google Workspace request failed.',
    });
  }, []);

  const handleGoogleSignIn = async (includeChat = true) => {
    setSigningIn(true);
    setAuthMessage(null);
    setApiError(null);
    try {
      await signInWithWorkspace(includeChat);
      onNotify('Connected to Google Workspace.');
    } catch (err: any) {
      setAuthMessage(err?.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const loadDriveFiles = useCallback(
    async (overrideFilter?: DriveFilterType) => {
      if (!workspaceAccessToken) return;
      setLoadingDrive(true);
      setApiError(null);
      try {
        const files = await listDriveFiles(
          workspaceAccessToken,
          driveSearch,
          overrideFilter ?? driveFilter
        );
        setDriveFiles(files);
      } catch (err) {
        handleWorkspaceError(err);
      } finally {
        setLoadingDrive(false);
      }
    },
    [workspaceAccessToken, driveSearch, driveFilter, handleWorkspaceError]
  );

  const loadChatSpaces = useCallback(async () => {
    if (!workspaceAccessToken) return;
    setLoadingChat(true);
    setApiError(null);
    try {
      const spaces = await listGoogleChatSpaces(workspaceAccessToken);
      setChatSpaces(spaces);
      if (spaces.length > 0 && !selectedSpace) {
        setSelectedSpace(spaces[0]);
      }
    } catch (err) {
      handleWorkspaceError(err);
    } finally {
      setLoadingChat(false);
    }
  }, [workspaceAccessToken, selectedSpace, handleWorkspaceError]);

  const loadSpaceMessages = useCallback(
    async (space: GoogleChatSpace) => {
      if (!workspaceAccessToken) return;
      setLoadingChat(true);
      setApiError(null);
      try {
        const msgs = await listGoogleChatMessages(workspaceAccessToken, space.name);
        setChatMessages(msgs);
      } catch (err) {
        handleWorkspaceError(err);
      } finally {
        setLoadingChat(false);
      }
    },
    [workspaceAccessToken, handleWorkspaceError]
  );

  useEffect(() => {
    if (!workspaceAccessToken) return;
    if (section === 'drive') {
      loadDriveFiles();
    } else if (section === 'docs') {
      loadDriveFiles('docs');
    } else if (section === 'forms') {
      loadDriveFiles('forms');
    } else if (section === 'chat') {
      loadChatSpaces();
    }
  }, [workspaceAccessToken, section, loadDriveFiles, loadChatSpaces]);

  useEffect(() => {
    if (workspaceAccessToken && section === 'chat' && selectedSpace) {
      loadSpaceMessages(selectedSpace);
    }
  }, [workspaceAccessToken, section, selectedSpace, loadSpaceMessages]);

  const handleOpenDoc = async (docIdOrUrl: string) => {
    if (!workspaceAccessToken || !docIdOrUrl.trim()) return;
    setLoadingDoc(true);
    setApiError(null);
    try {
      const detail = await getGoogleDoc(workspaceAccessToken, docIdOrUrl);
      setSelectedDoc(detail);
      setDocLookupInput(detail.documentId);
      setSection('docs');
    } catch (err) {
      handleWorkspaceError(err);
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleOpenForm = async (formIdOrUrl: string) => {
    if (!workspaceAccessToken || !formIdOrUrl.trim()) return;
    setLoadingForm(true);
    setApiError(null);
    try {
      const form = await getGoogleForm(workspaceAccessToken, formIdOrUrl);
      setSelectedForm(form);
      setFormLookupInput(form.formId);
      const responses = await listGoogleFormResponses(workspaceAccessToken, form);
      setFormResponses(responses);
      setSection('forms');
    } catch (err) {
      handleWorkspaceError(err);
    } finally {
      setLoadingForm(false);
    }
  };

  const runConfirmedMutation = async () => {
    if (!pendingMutation) return;
    setExecutingMutation(true);
    setApiError(null);
    try {
      await pendingMutation.execute();
      setPendingMutation(null);
    } catch (err) {
      handleWorkspaceError(err);
      setPendingMutation(null);
    } finally {
      setExecutingMutation(false);
    }
  };

  // Unauthenticated View (Required Sign in with Google button)
  if (!workspaceAccessToken) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Google Workspace Integration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Connect Google Drive, Google Docs, Google Forms, and Google Chat for GVCC church administration.
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-8 max-w-2xl space-y-5">
          <div className="space-y-2">
            <h2 className="font-serif text-2xl font-medium text-[#1C1917]">
              Sign in with Google Workspace
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Authorize access to browse church files in Google Drive, draft and update ministry notes in Google Docs, manage surveys and responses in Google Forms, and collaborate in Google Chat spaces. Access tokens remain strictly in browser memory for your active session.
            </p>
          </div>

          {authMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p>{authMessage}</p>
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={() => handleGoogleSignIn(false)}
                  className="mt-2 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-semibold cursor-pointer"
                >
                  Authorize Google Docs, Drive & Forms Only
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={signingIn}
              onClick={() => handleGoogleSignIn(true)}
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

            <button
              type="button"
              disabled={signingIn}
              onClick={() => handleGoogleSignIn(false)}
              className="px-4 py-2.5 border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Connect Docs, Drive & Forms Only
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-500 space-y-1">
            <p>
              <strong>Google Chat Note:</strong> Calling the Google Chat API requires a Business or Enterprise Google Workspace account (consumer <code className="font-mono">@gmail.com</code> accounts are not supported by Chat) and configuring the Chat App in Google Cloud Console.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Session Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Google Workspace Hub</h1>
          <p className="text-xs text-slate-500 mt-1">
            Connected as <strong className="font-mono text-slate-700">{firebaseUser?.email || 'Google User'}</strong> · Manage church Drive files, Docs, Forms, and Chat spaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleGoogleSignIn(true)}
            className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
          >
            Re-authorize Google
          </button>
          <button
            type="button"
            onClick={() => {
              clearWorkspaceAccessToken();
              onNotify('Workspace session disconnected from memory.');
            }}
            className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium cursor-pointer"
          >
            Disconnect Workspace
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'drive', label: 'Google Drive', icon: <FolderOpen className="w-3.5 h-3.5" /> },
            { id: 'docs', label: 'Google Docs', icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'forms', label: 'Google Forms', icon: <ClipboardList className="w-3.5 h-3.5" /> },
            { id: 'chat', label: 'Google Chat', icon: <MessageSquare className="w-3.5 h-3.5" /> },
          ] as Array<{ id: WorkspaceSection; label: string; icon: React.ReactNode }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setApiError(null);
              setSection(tab.id);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold border cursor-pointer transition-colors ${
              section === tab.id
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* API Error Display */}
      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-900 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
            <div className="space-y-1.5">
              <p className="font-semibold">Google Workspace API Notice</p>
              <p>{apiError.message}</p>
              {apiError.isChatAppNotFound && (
                <p>
                  Configure the Google Chat App (App name, Avatar URL, and Description) in Google Cloud Console:{' '}
                  <a
                    href={GOOGLE_CHAT_CONSOLE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-semibold inline-flex items-center gap-1"
                  >
                    Open Google Chat API Configuration
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. GOOGLE DRIVE SECTION */}
      {section === 'drive' && (
        <div className="space-y-5">
          {/* Upload to Drive */}
          <div className="bg-white border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Upload Ministry Note or File to Google Drive</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                placeholder="File name (e.g. Sunday-Announcements.txt)"
                value={uploadDraft.fileName}
                onChange={(e) => setUploadDraft({ ...uploadDraft, fileName: e.target.value })}
                className="px-3 py-2 border border-slate-300 text-xs"
              />
              <input
                placeholder="Text content to upload..."
                value={uploadDraft.content}
                onChange={(e) => setUploadDraft({ ...uploadDraft, content: e.target.value })}
                className="px-3 py-2 border border-slate-300 text-xs sm:col-span-2"
              />
            </div>
            <button
              type="button"
              disabled={!uploadDraft.content.trim()}
              onClick={() =>
                setPendingMutation({
                  title: 'Upload File to Google Drive?',
                  description: `Create "${uploadDraft.fileName || 'GVCC-Document.txt'}" in your Google Drive?`,
                  confirmLabel: 'Confirm Upload',
                  execute: async () => {
                    await uploadFileToDrive(
                      workspaceAccessToken,
                      uploadDraft.fileName,
                      uploadDraft.content
                    );
                    setUploadDraft({ fileName: 'GVCC-Ministry-Notes.txt', content: '' });
                    onNotify('File uploaded to Google Drive.');
                    await loadDriveFiles();
                  },
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload to Drive
            </button>
          </div>

          {/* Search & File List */}
          <div className="bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    placeholder="Search Drive files..."
                    value={driveSearch}
                    onChange={(e) => setDriveSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadDriveFiles();
                    }}
                    className="pl-8 pr-3 py-1.5 border border-slate-300 text-xs w-56"
                  />
                </div>
                <select
                  value={driveFilter}
                  onChange={(e) => setDriveFilter(e.target.value as DriveFilterType)}
                  className="px-3 py-1.5 border border-slate-300 text-xs"
                >
                  <option value="all">All Drive Files</option>
                  <option value="docs">Google Docs</option>
                  <option value="forms">Google Forms</option>
                  <option value="sheets">Google Sheets</option>
                  <option value="pdfs">PDF Documents</option>
                </select>
                <button
                  type="button"
                  onClick={() => loadDriveFiles()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              <span className="text-xs font-mono text-slate-500">{driveFiles.length} file(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2">File Name</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Modified</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {driveFiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        {loadingDrive ? 'Loading Drive files...' : 'No Drive files found.'}
                      </td>
                    </tr>
                  ) : (
                    driveFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-slate-50">
                        <td className="py-2.5 font-medium text-slate-900">
                          {file.name}
                          <span className="block font-mono text-[11px] text-slate-400">
                            {file.id}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600">
                          {MIME_LABELS[file.mimeType] || file.mimeType.split('.').pop()}
                        </td>
                        <td className="py-2.5 font-mono text-[11px] text-slate-500">
                          {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                          {file.mimeType === 'application/vnd.google-apps.document' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDoc(file.id)}
                              className="px-2.5 py-1 border border-slate-300 text-[11px] font-medium hover:bg-slate-50 cursor-pointer"
                            >
                              Open Doc
                            </button>
                          )}
                          {file.mimeType === 'application/vnd.google-apps.form' && (
                            <button
                              type="button"
                              onClick={() => handleOpenForm(file.id)}
                              className="px-2.5 py-1 border border-slate-300 text-[11px] font-medium hover:bg-slate-50 cursor-pointer"
                            >
                              Open Form
                            </button>
                          )}
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-300 text-[11px] font-medium hover:bg-slate-50"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setPendingMutation({
                                title: 'Move Drive File to Trash?',
                                description: `Move "${file.name}" (${file.id}) to Google Drive Trash? You can restore it from Google Drive Trash if needed.`,
                                confirmLabel: 'Move to Trash',
                                destructive: true,
                                execute: async () => {
                                  await trashDriveFile(workspaceAccessToken, file.id);
                                  onNotify(`Moved "${file.name}" to Drive Trash.`);
                                  await loadDriveFiles();
                                },
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 text-red-700 hover:bg-red-50 text-[11px] cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Trash
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. GOOGLE DOCS SECTION */}
      {section === 'docs' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Create Google Doc */}
            <div className="bg-white border border-slate-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Create New Google Doc</h2>
              <input
                placeholder="Document title (e.g. GVCC Board Minutes - Nov 2026)"
                value={newDocDraft.title}
                onChange={(e) => setNewDocDraft({ ...newDocDraft, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 text-xs"
              />
              <textarea
                rows={3}
                placeholder="Initial document body text (optional)..."
                value={newDocDraft.initialBody}
                onChange={(e) => setNewDocDraft({ ...newDocDraft, initialBody: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 text-xs"
              />
              <button
                type="button"
                disabled={!newDocDraft.title.trim()}
                onClick={() =>
                  setPendingMutation({
                    title: 'Create New Google Doc?',
                    description: `Create Google Doc "${newDocDraft.title.trim()}" in your Drive?`,
                    confirmLabel: 'Create Google Doc',
                    execute: async () => {
                      const doc = await createGoogleDoc(
                        workspaceAccessToken,
                        newDocDraft.title,
                        newDocDraft.initialBody
                      );
                      setSelectedDoc(doc);
                      setDocLookupInput(doc.documentId);
                      setNewDocDraft({ title: '', initialBody: '' });
                      onNotify(`Created Google Doc "${doc.title}".`);
                      await loadDriveFiles('docs');
                    },
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F172A] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Google Doc
              </button>
            </div>

            {/* Open Existing Doc */}
            <div className="bg-white border border-slate-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Open Existing Google Doc</h2>
              <div className="flex gap-2">
                <input
                  placeholder="Paste Google Doc ID or Docs URL..."
                  value={docLookupInput}
                  onChange={(e) => setDocLookupInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  disabled={!docLookupInput.trim() || loadingDoc}
                  onClick={() => handleOpenDoc(docLookupInput)}
                  className="px-4 py-2 bg-[#B4823E] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {loadingDoc ? 'Loading...' : 'Load Doc'}
                </button>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto border-t border-slate-100 pt-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Recent Google Docs</p>
                {driveFiles
                  .filter((f) => f.mimeType === 'application/vnd.google-apps.document')
                  .slice(0, 6)
                  .map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleOpenDoc(f.id)}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-50 flex items-center justify-between border border-slate-100 cursor-pointer"
                    >
                      <span className="truncate font-medium">{f.name}</span>
                      <span className="text-[11px] text-[#9A6B2F] shrink-0 ml-2">Open</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Loaded Doc Reader & Append */}
          {selectedDoc && (
            <div className="bg-white border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-serif text-lg font-medium text-slate-900">{selectedDoc.title}</h3>
                  <p className="font-mono text-[11px] text-slate-500">ID: {selectedDoc.documentId}</p>
                </div>
                <a
                  href={`https://docs.google.com/document/d/${encodeURIComponent(selectedDoc.documentId)}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-xs font-medium hover:bg-slate-50"
                >
                  Open in Google Docs <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-slate-50 border border-slate-200 p-4 max-h-72 overflow-y-auto">
                {selectedDoc.bodyText || '(Document is currently empty)'}
              </pre>

              <div className="space-y-2 border-t border-slate-200 pt-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Append Notes to Document
                </label>
                <div className="flex flex-wrap gap-2">
                  <textarea
                    rows={2}
                    placeholder="Enter paragraph text to append to this Google Doc..."
                    value={appendDocText}
                    onChange={(e) => setAppendDocText(e.target.value)}
                    className="flex-1 min-w-[240px] px-3 py-2 border border-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    disabled={!appendDocText.trim()}
                    onClick={() =>
                      setPendingMutation({
                        title: 'Update Google Doc Content?',
                        description: `Append the following text to "${selectedDoc.title}":\n\n"${appendDocText.trim().slice(0, 140)}${appendDocText.trim().length > 140 ? '...' : ''}"`,
                        confirmLabel: 'Confirm Update',
                        execute: async () => {
                          await appendTextToGoogleDoc(
                            workspaceAccessToken,
                            selectedDoc.documentId,
                            appendDocText.trim()
                          );
                          setAppendDocText('');
                          onNotify('Google Doc updated.');
                          await handleOpenDoc(selectedDoc.documentId);
                        },
                      })
                    }
                    className="px-4 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer self-start"
                  >
                    Append Text
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. GOOGLE FORMS SECTION */}
      {section === 'forms' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Create Google Form */}
            <div className="bg-white border border-slate-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Create New Google Form</h2>
              <input
                placeholder="Form title (e.g. GVCC Youth Camp Registration)"
                value={newFormDraft.title}
                onChange={(e) => setNewFormDraft({ ...newFormDraft, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 text-xs"
              />
              <input
                placeholder="Form description (optional)"
                value={newFormDraft.description}
                onChange={(e) => setNewFormDraft({ ...newFormDraft, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 text-xs"
              />
              <button
                type="button"
                disabled={!newFormDraft.title.trim()}
                onClick={() =>
                  setPendingMutation({
                    title: 'Create New Google Form?',
                    description: `Create Google Form "${newFormDraft.title.trim()}" in your Drive?`,
                    confirmLabel: 'Create Google Form',
                    execute: async () => {
                      const form = await createGoogleForm(
                        workspaceAccessToken,
                        newFormDraft.title,
                        newFormDraft.description
                      );
                      setSelectedForm(form);
                      setFormLookupInput(form.formId);
                      setFormResponses([]);
                      setNewFormDraft({ title: '', description: '' });
                      onNotify(`Created Google Form "${form.title}".`);
                      await loadDriveFiles('forms');
                    },
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F172A] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Google Form
              </button>
            </div>

            {/* Load Existing Google Form */}
            <div className="bg-white border border-slate-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Open Form & Read Responses</h2>
              <div className="flex gap-2">
                <input
                  placeholder="Paste Google Form ID or Forms URL..."
                  value={formLookupInput}
                  onChange={(e) => setFormLookupInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  disabled={!formLookupInput.trim() || loadingForm}
                  onClick={() => handleOpenForm(formLookupInput)}
                  className="px-4 py-2 bg-[#B4823E] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {loadingForm ? 'Loading...' : 'Load Form'}
                </button>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto border-t border-slate-100 pt-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Recent Google Forms</p>
                {driveFiles
                  .filter((f) => f.mimeType === 'application/vnd.google-apps.form')
                  .slice(0, 6)
                  .map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleOpenForm(f.id)}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-50 flex items-center justify-between border border-slate-100 cursor-pointer"
                    >
                      <span className="truncate font-medium">{f.name}</span>
                      <span className="text-[11px] text-[#9A6B2F] shrink-0 ml-2">Inspect</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {selectedForm && (
            <div className="bg-white border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-serif text-lg font-medium text-slate-900">{selectedForm.title}</h3>
                  {selectedForm.description && (
                    <p className="text-xs text-slate-600 mt-0.5">{selectedForm.description}</p>
                  )}
                  <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                    Form ID: {selectedForm.formId}
                  </p>
                </div>
                {selectedForm.responderUri && (
                  <a
                    href={selectedForm.responderUri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-xs font-medium hover:bg-slate-50"
                  >
                    Open Live Form <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Add Question */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-slate-800">Add Question to Form</p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    placeholder="Question text (e.g. Full Name or Prayer Request)"
                    value={newQuestionDraft.title}
                    onChange={(e) =>
                      setNewQuestionDraft({ ...newQuestionDraft, title: e.target.value })
                    }
                    className="flex-1 min-w-[220px] px-3 py-1.5 border border-slate-300 bg-white text-xs"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={newQuestionDraft.isParagraph}
                      onChange={(e) =>
                        setNewQuestionDraft({ ...newQuestionDraft, isParagraph: e.target.checked })
                      }
                    />
                    Paragraph
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={newQuestionDraft.required}
                      onChange={(e) =>
                        setNewQuestionDraft({ ...newQuestionDraft, required: e.target.checked })
                      }
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    disabled={!newQuestionDraft.title.trim()}
                    onClick={() =>
                      setPendingMutation({
                        title: 'Add Question to Google Form?',
                        description: `Modify form "${selectedForm.title}" by adding question "${newQuestionDraft.title.trim()}"?`,
                        confirmLabel: 'Add Question',
                        execute: async () => {
                          const updated = await addQuestionToGoogleForm(
                            workspaceAccessToken,
                            selectedForm.formId,
                            newQuestionDraft.title,
                            newQuestionDraft.isParagraph,
                            newQuestionDraft.required
                          );
                          setSelectedForm(updated);
                          setNewQuestionDraft({ title: '', isParagraph: false, required: false });
                          onNotify('Question added to Google Form.');
                        },
                      })
                    }
                    className="px-3 py-1.5 bg-[#0F172A] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                  >
                    Add Question
                  </button>
                </div>
              </div>

              {/* Questions & Responses */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Form Questions ({selectedForm.items.length})
                  </h4>
                  {selectedForm.items.length === 0 ? (
                    <p className="text-xs text-slate-500">No questions added to this form yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 text-xs">
                      {selectedForm.items.map((item, idx) => (
                        <li key={item.itemId || idx} className="py-2">
                          <span className="font-mono text-slate-400 mr-2">Q{idx + 1}.</span>
                          <span className="font-medium text-slate-800">{item.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border border-slate-200 p-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Submitted Responses ({formResponses.length})
                  </h4>
                  {formResponses.length === 0 ? (
                    <p className="text-xs text-slate-500">No responses recorded yet.</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {formResponses.map((resp) => (
                        <div key={resp.responseId} className="p-2.5 bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                            <span>{resp.respondentEmail || 'Anonymous'}</span>
                            <span>
                              {resp.lastSubmittedTime
                                ? new Date(resp.lastSubmittedTime).toLocaleDateString()
                                : ''}
                            </span>
                          </div>
                          {resp.answers.map((ans, idx) => (
                            <p key={idx} className="text-slate-700">
                              <strong>{ans.questionTitle}:</strong> {ans.value}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. GOOGLE CHAT SECTION */}
      {section === 'chat' && (
        <div className="space-y-5">
          {/* Prerequisites Notice per references/chat.md */}
          <div className="bg-amber-50 border border-amber-200 p-4 text-xs text-amber-950 space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              Google Chat API Prerequisites
            </p>
            <ul className="list-disc pl-5 space-y-1 text-amber-900">
              <li>
                Requires a <strong>Business or Enterprise Google Workspace account</strong> with access to Google Chat (consumer <code className="font-mono">@gmail.com</code> accounts are not supported).
              </li>
              <li>
                Requires one-time Google Chat App configuration (App name, Avatar URL, and Description) in Google Cloud Console:{' '}
                <a
                  href={GOOGLE_CHAT_CONSOLE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-semibold inline-flex items-center gap-1"
                >
                  Google Chat API Configuration
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Spaces List */}
            <div className="bg-white border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Chat Spaces</h2>
                <button
                  type="button"
                  onClick={loadChatSpaces}
                  className="p-1.5 border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  title="Refresh Spaces"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingChat ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {chatSpaces.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {loadingChat ? 'Loading spaces...' : 'No Google Chat spaces available.'}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {chatSpaces.map((sp) => (
                    <li key={sp.name}>
                      <button
                        type="button"
                        onClick={() => setSelectedSpace(sp)}
                        className={`w-full text-left px-3 py-2 text-xs border cursor-pointer ${
                          selectedSpace?.name === sp.name
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-medium block truncate">
                          {sp.displayName || sp.name}
                        </span>
                        <span className="font-mono text-[10px] opacity-75">
                          {sp.spaceType || sp.type || 'SPACE'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Space Messages */}
            <div className="lg:col-span-2 bg-white border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  {selectedSpace
                    ? `Messages · ${selectedSpace.displayName || selectedSpace.name}`
                    : 'Select a Google Chat Space'}
                </h2>
                {selectedSpace && (
                  <button
                    type="button"
                    onClick={() => loadSpaceMessages(selectedSpace)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Reload
                  </button>
                )}
              </div>

              {selectedSpace ? (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {chatMessages.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4">
                        No recent messages in this space.
                      </p>
                    ) : (
                      chatMessages.map((msg) => (
                        <div
                          key={msg.name}
                          className="p-3 bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">
                              {msg.sender?.displayName || msg.sender?.name || 'Member'}{' '}
                              <span className="font-mono font-normal text-[10px] text-slate-400">
                                {msg.createTime ? new Date(msg.createTime).toLocaleString() : ''}
                              </span>
                            </p>
                            <p className="text-slate-700 whitespace-pre-wrap">{msg.text || '—'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingMutation({
                                title: 'Delete Google Chat Message?',
                                description: `Delete this message from "${selectedSpace.displayName || selectedSpace.name}"?\n\n"${(msg.text || '').slice(0, 100)}"`,
                                confirmLabel: 'Delete Message',
                                destructive: true,
                                execute: async () => {
                                  await deleteGoogleChatMessage(workspaceAccessToken, msg.name);
                                  onNotify('Chat message deleted.');
                                  await loadSpaceMessages(selectedSpace);
                                },
                              })
                            }
                            className="p-1.5 border border-red-200 text-red-700 hover:bg-red-50 shrink-0 cursor-pointer"
                            title="Delete message"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2 border-t border-slate-200 pt-3">
                    <input
                      placeholder="Write a message to post in this Google Chat space..."
                      value={newChatText}
                      onChange={(e) => setNewChatText(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      disabled={!newChatText.trim()}
                      onClick={() =>
                        setPendingMutation({
                          title: 'Send Google Chat Message?',
                          description: `Send the following message to "${selectedSpace.displayName || selectedSpace.name}" on your behalf?\n\n"${newChatText.trim()}"`,
                          confirmLabel: 'Send Message',
                          execute: async () => {
                            await sendGoogleChatMessage(
                              workspaceAccessToken,
                              selectedSpace.name,
                              newChatText
                            );
                            setNewChatText('');
                            onNotify('Message posted to Google Chat.');
                            await loadSpaceMessages(selectedSpace);
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 py-4">
                  Choose a space on the left to inspect or send messages.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Dialog for All Destructive / Mutating Workspace Actions */}
      {pendingMutation && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-confirm-title"
        >
          <div className="bg-white border border-slate-300 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 flex items-center justify-center shrink-0 ${
                  pendingMutation.destructive
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-[#9A6B2F]'
                }`}
              >
                {pendingMutation.destructive ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1">
                <h3 id="workspace-confirm-title" className="text-base font-semibold text-slate-900">
                  {pendingMutation.title}
                </h3>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {pendingMutation.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={executingMutation}
                onClick={() => setPendingMutation(null)}
                className="px-4 py-2 border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={executingMutation}
                onClick={runConfirmedMutation}
                className={`px-4 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-60 ${
                  pendingMutation.destructive
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-[#0F172A] hover:bg-slate-800'
                }`}
              >
                {executingMutation ? 'Processing...' : pendingMutation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
