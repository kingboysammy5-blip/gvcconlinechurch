export const GOOGLE_CHAT_CONSOLE_URL =
  'https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=silent-style-97cvm';

export class WorkspaceApiError extends Error {
  status: number;
  isAuthError: boolean;
  isChatAppNotFound: boolean;

  constructor(message: string, status = 500, isChatAppNotFound = false) {
    super(message);
    this.name = 'WorkspaceApiError';
    this.status = status;
    this.isAuthError = status === 401;
    this.isChatAppNotFound = isChatAppNotFound;
  }
}

async function parseGoogleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  let message = `Google Workspace API error (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error?.message) {
      message = String(body.error.message);
    }
  } catch {
    const text = await res.text().catch(() => '');
    if (text) message = text;
  }

  const isChatNotFound =
    res.status === 404 &&
    (message.toLowerCase().includes('google chat app not found') ||
      message.toLowerCase().includes('configure the app in the google cloud console'));

  throw new WorkspaceApiError(message, res.status, isChatNotFound);
}

// ---------------------------------------------------------------------------
// Google Drive API
// ---------------------------------------------------------------------------
export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  shared?: boolean;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
}

export type DriveFilterType = 'all' | 'docs' | 'forms' | 'sheets' | 'folders' | 'pdfs';

export async function listDriveFiles(
  accessToken: string,
  searchQuery = '',
  filterType: DriveFilterType = 'all',
  sharedOnly = false
): Promise<DriveFileItem[]> {
  const clauses: string[] = ['trashed = false'];

  if (sharedOnly) {
    clauses.push('sharedWithMe = true');
  }

  if (filterType === 'docs') {
    clauses.push("mimeType = 'application/vnd.google-apps.document'");
  } else if (filterType === 'forms') {
    clauses.push("mimeType = 'application/vnd.google-apps.form'");
  } else if (filterType === 'sheets') {
    clauses.push("mimeType = 'application/vnd.google-apps.spreadsheet'");
  } else if (filterType === 'folders') {
    clauses.push("mimeType = 'application/vnd.google-apps.folder'");
  } else if (filterType === 'pdfs') {
    clauses.push("mimeType = 'application/pdf'");
  }

  const cleanSearch = searchQuery.trim().replace(/'/g, "\\'");
  if (cleanSearch) {
    clauses.push(`name contains '${cleanSearch}'`);
  }

  const params = new URLSearchParams({
    pageSize: '30',
    orderBy: 'modifiedTime desc',
    q: clauses.join(' and '),
    fields:
      'files(id,name,mimeType,modifiedTime,size,webViewLink,shared,owners(displayName,emailAddress))',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await parseGoogleResponse<{ files?: DriveFileItem[] }>(res);
  return data.files || [];
}

export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType = 'text/plain'
): Promise<DriveFileItem> {
  const metadata = {
    name: fileName.trim() || 'GVCC-Document.txt',
    mimeType,
  };

  const boundary = `gvcc_boundary_${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  return parseGoogleResponse<DriveFileItem>(res);
}

export async function trashDriveFile(accessToken: string, fileId: string): Promise<void> {
  const safeId = encodeURIComponent(fileId.trim());
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${safeId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });
  await parseGoogleResponse(res);
}

// ---------------------------------------------------------------------------
// Google Docs API
// ---------------------------------------------------------------------------
export interface GoogleDocDetail {
  documentId: string;
  title: string;
  revisionId?: string;
  bodyText: string;
}

function extractTextFromStructuralElements(elements: any[] = []): string {
  const parts: string[] = [];
  for (const el of elements) {
    if (el.paragraph?.elements) {
      const line = el.paragraph.elements
        .map((pe: any) => pe.textRun?.content || '')
        .join('');
      parts.push(line);
    } else if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        const rowTexts: string[] = [];
        for (const cell of row.tableCells || []) {
          rowTexts.push(extractTextFromStructuralElements(cell.content || []).trim());
        }
        parts.push(`${rowTexts.join(' | ')}\n`);
      }
    }
  }
  return parts.join('');
}

export function extractGoogleResourceId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  return trimmed;
}

export async function getGoogleDoc(
  accessToken: string,
  documentIdOrUrl: string
): Promise<GoogleDocDetail> {
  const safeId = encodeURIComponent(extractGoogleResourceId(documentIdOrUrl));
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${safeId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const doc = await parseGoogleResponse<any>(res);
  return {
    documentId: String(doc.documentId || ''),
    title: String(doc.title || 'Untitled Document'),
    revisionId: doc.revisionId,
    bodyText: extractTextFromStructuralElements(doc.body?.content || []).trim(),
  };
}

export async function createGoogleDoc(
  accessToken: string,
  title: string,
  initialBody?: string
): Promise<GoogleDocDetail> {
  const res = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: title.trim() || 'GVCC Ministry Document' }),
  });
  const created = await parseGoogleResponse<any>(res);
  const documentId = String(created.documentId || '');

  if (initialBody && initialBody.trim() && documentId) {
    await appendTextToGoogleDoc(accessToken, documentId, initialBody.trim());
  }

  return getGoogleDoc(accessToken, documentId);
}

export async function appendTextToGoogleDoc(
  accessToken: string,
  documentIdOrUrl: string,
  textToAppend: string
): Promise<void> {
  const safeId = encodeURIComponent(extractGoogleResourceId(documentIdOrUrl));
  const formattedText = textToAppend.endsWith('\n') ? textToAppend : `\n${textToAppend}\n`;

  const res = await fetch(`https://docs.googleapis.com/v1/documents/${safeId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            endOfSegmentLocation: { segmentId: '' },
            text: formattedText,
          },
        },
      ],
    }),
  });
  await parseGoogleResponse(res);
}

// ---------------------------------------------------------------------------
// Google Forms API
// ---------------------------------------------------------------------------
export interface GoogleFormItemSummary {
  itemId: string;
  title: string;
  questionId?: string;
}

export interface GoogleFormDetail {
  formId: string;
  title: string;
  description: string;
  responderUri?: string;
  items: GoogleFormItemSummary[];
}

export interface GoogleFormResponseSummary {
  responseId: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  answers: Array<{ questionTitle: string; value: string }>;
}

export async function getGoogleForm(
  accessToken: string,
  formIdOrUrl: string
): Promise<GoogleFormDetail> {
  const safeFormId = encodeURIComponent(extractGoogleResourceId(formIdOrUrl));
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const form = await parseGoogleResponse<any>(res);

  const items: GoogleFormItemSummary[] = (form.items || []).map((item: any) => ({
    itemId: String(item.itemId || ''),
    title: String(item.title || 'Untitled Question'),
    questionId: item.questionItem?.question?.questionId
      ? String(item.questionItem.question.questionId)
      : undefined,
  }));

  return {
    formId: String(form.formId || ''),
    title: String(form.info?.title || form.info?.documentTitle || 'Untitled Form'),
    description: String(form.info?.description || ''),
    responderUri: form.responderUri,
    items,
  };
}

export async function listGoogleFormResponses(
  accessToken: string,
  formDetail: GoogleFormDetail
): Promise<GoogleFormResponseSummary[]> {
  const safeFormId = encodeURIComponent(formDetail.formId.trim());
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}/responses`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await parseGoogleResponse<{ responses?: any[] }>(res);
  const questionTitleById = new Map<string, string>();
  for (const item of formDetail.items) {
    if (item.questionId) {
      questionTitleById.set(item.questionId, item.title);
    }
  }

  return (data.responses || []).map((r: any) => {
    const answersObj = r.answers || {};
    const answers = Object.entries(answersObj).map(([qId, ans]: [string, any]) => {
      const values = (ans?.textAnswers?.answers || [])
        .map((a: any) => String(a.value || ''))
        .filter(Boolean);
      return {
        questionTitle: questionTitleById.get(qId) || `Question ${qId}`,
        value: values.join(', ') || '—',
      };
    });

    return {
      responseId: String(r.responseId || ''),
      lastSubmittedTime: r.lastSubmittedTime,
      respondentEmail: r.respondentEmail,
      answers,
    };
  });
}

export async function createGoogleForm(
  accessToken: string,
  title: string,
  description?: string
): Promise<GoogleFormDetail> {
  const res = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: title.trim() || 'GVCC Ministry Form',
        documentTitle: title.trim() || 'GVCC Ministry Form',
      },
    }),
  });
  const created = await parseGoogleResponse<any>(res);
  const formId = String(created.formId || '');

  if (description && description.trim() && formId) {
    const safeId = encodeURIComponent(formId);
    await fetch(`https://forms.googleapis.com/v1/forms/${safeId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            updateFormInfo: {
              info: { description: description.trim() },
              updateMask: 'description',
            },
          },
        ],
      }),
    });
  }

  return getGoogleForm(accessToken, formId);
}

export async function addQuestionToGoogleForm(
  accessToken: string,
  formId: string,
  questionTitle: string,
  isParagraph = false,
  required = false
): Promise<GoogleFormDetail> {
  const safeFormId = encodeURIComponent(extractGoogleResourceId(formId));
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          createItem: {
            item: {
              title: questionTitle.trim(),
              questionItem: {
                question: {
                  required,
                  textQuestion: { paragraph: isParagraph },
                },
              },
            },
            location: { index: 0 },
          },
        },
      ],
    }),
  });
  await parseGoogleResponse(res);
  return getGoogleForm(accessToken, formId);
}

// ---------------------------------------------------------------------------
// Google Chat API
// ---------------------------------------------------------------------------
export interface GoogleChatSpace {
  name: string;
  displayName?: string;
  spaceType?: string;
  type?: string;
}

export interface GoogleChatMessage {
  name: string;
  text?: string;
  createTime?: string;
  sender?: {
    name?: string;
    displayName?: string;
    type?: string;
  };
}

function extractChatSpaceId(spaceName: string): string {
  return spaceName.trim().replace(/^spaces\//, '');
}

export async function listGoogleChatSpaces(accessToken: string): Promise<GoogleChatSpace[]> {
  const res = await fetch('https://chat.googleapis.com/v1/spaces?pageSize=25', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await parseGoogleResponse<{ spaces?: GoogleChatSpace[] }>(res);
  return data.spaces || [];
}

export async function listGoogleChatMessages(
  accessToken: string,
  spaceName: string
): Promise<GoogleChatMessage[]> {
  const safeSpaceId = encodeURIComponent(extractChatSpaceId(spaceName));
  const res = await fetch(
    `https://chat.googleapis.com/v1/spaces/${safeSpaceId}/messages?pageSize=25&orderBy=createTime desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const data = await parseGoogleResponse<{ messages?: GoogleChatMessage[] }>(res);
  return data.messages || [];
}

export async function sendGoogleChatMessage(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<GoogleChatMessage> {
  const safeSpaceId = encodeURIComponent(extractChatSpaceId(spaceName));
  const res = await fetch(`https://chat.googleapis.com/v1/spaces/${safeSpaceId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.trim() }),
  });
  return parseGoogleResponse<GoogleChatMessage>(res);
}

export async function deleteGoogleChatMessage(
  accessToken: string,
  messageResourceName: string
): Promise<void> {
  const match = messageResourceName.trim().match(/^spaces\/([^/]+)\/messages\/([^/]+)$/);
  if (!match) {
    throw new WorkspaceApiError('Invalid Google Chat message resource name.', 400);
  }
  const safeSpaceId = encodeURIComponent(match[1]);
  const safeMsgId = encodeURIComponent(match[2]);
  const res = await fetch(
    `https://chat.googleapis.com/v1/spaces/${safeSpaceId}/messages/${safeMsgId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await parseGoogleResponse(res);
}
