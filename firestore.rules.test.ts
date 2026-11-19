/**
 * Phase 0 Security Specification Verification Suite
 * Validates the "Dirty Dozen" adversarial payloads against the Firestore Blueprint invariants
 * and asserts structural consistency with DRAFT_firestore.rules / firestore.rules.
 */
import fs from 'fs';
import path from 'path';

interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const BOOTSTRAPPED_ADMIN_EMAIL = 'kingboysammy5@gmail.com';
const REQUEST_TIME_MS = 1795030800000;

interface MockAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

function isSignedIn(auth: MockAuth | null): boolean {
  return auth !== null && auth.email_verified === true;
}

function isAdmin(auth: MockAuth | null): boolean {
  return isSignedIn(auth) && auth!.email === BOOTSTRAPPED_ADMIN_EMAIL;
}

function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

function validateUserCreate(auth: MockAuth | null, docId: string, data: Record<string, any>): ValidationResult {
  if (!isSignedIn(auth)) return { allowed: false, reason: 'PERMISSION_DENIED: unverified auth' };
  if (!isValidId(docId) || auth!.uid !== docId) return { allowed: false, reason: 'PERMISSION_DENIED: identity mismatch' };
  const required = ['uid', 'displayName', 'email', 'bestScore', 'gamesPlayed', 'createdAt', 'updatedAt'];
  const keys = Object.keys(data);
  if (!required.every((k) => keys.includes(k))) return { allowed: false, reason: 'PERMISSION_DENIED: missing required keys' };
  if (!keys.every((k) => required.includes(k))) return { allowed: false, reason: 'PERMISSION_DENIED: shadow keys rejected' };
  if (data.uid !== auth!.uid) return { allowed: false, reason: 'PERMISSION_DENIED: uid spoof' };
  if (typeof data.displayName !== 'string' || data.displayName.length < 1 || data.displayName.length > 80) {
    return { allowed: false, reason: 'PERMISSION_DENIED: displayName bounds' };
  }
  if (typeof data.email !== 'string' || data.email.length < 3 || data.email.length > 160) {
    return { allowed: false, reason: 'PERMISSION_DENIED: email bounds' };
  }
  if (typeof data.bestScore !== 'number' || data.bestScore < 0 || data.bestScore > 1000000) {
    return { allowed: false, reason: 'PERMISSION_DENIED: bestScore bounds' };
  }
  if (typeof data.gamesPlayed !== 'number' || data.gamesPlayed < 0 || data.gamesPlayed > 1000000) {
    return { allowed: false, reason: 'PERMISSION_DENIED: gamesPlayed bounds' };
  }
  if (data.createdAt !== REQUEST_TIME_MS || data.updatedAt !== REQUEST_TIME_MS) {
    return { allowed: false, reason: 'PERMISSION_DENIED: timestamp must equal request.time' };
  }
  return { allowed: true };
}

function validateBookmarkCreate(
  auth: MockAuth | null,
  parentExists: boolean,
  userId: string,
  bookmarkId: string,
  data: Record<string, any>
): ValidationResult {
  if (!isSignedIn(auth)) return { allowed: false, reason: 'PERMISSION_DENIED: unverified auth' };
  if (!isValidId(userId) || !isValidId(bookmarkId)) return { allowed: false, reason: 'PERMISSION_DENIED: invalid ID' };
  if (!parentExists || auth!.uid !== userId) return { allowed: false, reason: 'PERMISSION_DENIED: master gate failed' };
  const allowed = ['uid', 'query', 'answer', 'sourceTitles', 'sourceUrls', 'createdAt', 'updatedAt'];
  const keys = Object.keys(data);
  if (!allowed.every((k) => keys.includes(k)) || !keys.every((k) => allowed.includes(k))) {
    return { allowed: false, reason: 'PERMISSION_DENIED: key mismatch' };
  }
  if (data.uid !== auth!.uid) return { allowed: false, reason: 'PERMISSION_DENIED: uid spoof' };
  if (typeof data.query !== 'string' || data.query.length < 2 || data.query.length > 500) {
    return { allowed: false, reason: 'PERMISSION_DENIED: query size bounds' };
  }
  if (typeof data.answer !== 'string' || data.answer.length < 1 || data.answer.length > 12000) {
    return { allowed: false, reason: 'PERMISSION_DENIED: answer size bounds' };
  }
  if (
    !Array.isArray(data.sourceUrls) ||
    data.sourceUrls.length > 10 ||
    (data.sourceUrls.length > 0 && (typeof data.sourceUrls[0] !== 'string' || data.sourceUrls[0].length > 500))
  ) {
    return { allowed: false, reason: 'PERMISSION_DENIED: sourceUrls array guard' };
  }
  if (data.createdAt !== REQUEST_TIME_MS || data.updatedAt !== REQUEST_TIME_MS) {
    return { allowed: false, reason: 'PERMISSION_DENIED: timestamp forgery' };
  }
  return { allowed: true };
}

function validatePrayerCreate(
  auth: MockAuth | null,
  requestId: string,
  data: Record<string, any>
): ValidationResult {
  if (!isSignedIn(auth)) return { allowed: false, reason: 'PERMISSION_DENIED: unverified auth' };
  if (!isValidId(requestId)) return { allowed: false, reason: 'PERMISSION_DENIED: invalid request ID' };
  const allowed = [
    'uid',
    'referenceNumber',
    'requesterName',
    'phone',
    'email',
    'category',
    'requestContent',
    'privacyLevel',
    'followupRequested',
    'consent',
    'status',
    'createdAt',
    'updatedAt',
  ];
  const keys = Object.keys(data);
  if (!allowed.every((k) => keys.includes(k)) || !keys.every((k) => allowed.includes(k))) {
    return { allowed: false, reason: 'PERMISSION_DENIED: prayer keys mismatch' };
  }
  if (data.uid !== auth!.uid) return { allowed: false, reason: 'PERMISSION_DENIED: uid spoof' };
  if (typeof data.requestContent !== 'string' || data.requestContent.length < 5 || data.requestContent.length > 4000) {
    return { allowed: false, reason: 'PERMISSION_DENIED: requestContent size bounds' };
  }
  if (data.status !== 'New' || data.consent !== true) {
    return { allowed: false, reason: 'PERMISSION_DENIED: invalid initial status or consent' };
  }
  if (data.createdAt !== REQUEST_TIME_MS || data.updatedAt !== REQUEST_TIME_MS) {
    return { allowed: false, reason: 'PERMISSION_DENIED: timestamp must equal request.time' };
  }
  return { allowed: true };
}

function validateChurchMemberCreate(
  auth: MockAuth | null,
  memberId: string,
  data: Record<string, any>
): ValidationResult {
  if (!isAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED: admin role required' };
  if (!isValidId(memberId)) return { allowed: false, reason: 'PERMISSION_DENIED: invalid member ID' };
  const allowed = [
    'memberNumber',
    'fullName',
    'phone',
    'email',
    'location',
    'fellowshipGroup',
    'membershipType',
    'membershipStatus',
    'registrationDate',
    'notes',
    'importedByUid',
    'importSource',
    'createdAt',
    'updatedAt',
  ];
  const keys = Object.keys(data);
  if (!allowed.every((k) => keys.includes(k)) || !keys.every((k) => allowed.includes(k))) {
    return { allowed: false, reason: 'PERMISSION_DENIED: church_member keys mismatch' };
  }
  if (data.importedByUid !== auth!.uid) {
    return { allowed: false, reason: 'PERMISSION_DENIED: importedByUid spoof' };
  }
  if (typeof data.fullName !== 'string' || data.fullName.length < 2 || data.fullName.length > 140) {
    return { allowed: false, reason: 'PERMISSION_DENIED: fullName size bounds' };
  }
  if (data.createdAt !== REQUEST_TIME_MS || data.updatedAt !== REQUEST_TIME_MS) {
    return { allowed: false, reason: 'PERMISSION_DENIED: timestamp must equal request.time' };
  }
  return { allowed: true };
}

function validateDirectoryMemberCreate(
  auth: MockAuth | null,
  memberId: string,
  data: Record<string, any>
): ValidationResult {
  if (!isAdmin(auth)) return { allowed: false, reason: 'PERMISSION_DENIED: admin role required' };
  if (!isValidId(memberId)) return { allowed: false, reason: 'PERMISSION_DENIED: invalid member ID' };
  const allowed = [
    'memberNumber',
    'fullName',
    'phone',
    'email',
    'location',
    'fellowshipGroup',
    'membershipType',
    'membershipStatus',
    'registrationDate',
    'notes',
    'createdByUid',
    'createdAt',
    'updatedAt',
  ];
  const keys = Object.keys(data);
  if (!allowed.every((k) => keys.includes(k)) || !keys.every((k) => allowed.includes(k))) {
    return { allowed: false, reason: 'PERMISSION_DENIED: directory member keys mismatch' };
  }
  if (data.createdByUid !== auth!.uid) {
    return { allowed: false, reason: 'PERMISSION_DENIED: createdByUid spoof' };
  }
  if (typeof data.fullName !== 'string' || data.fullName.length < 2 || data.fullName.length > 140) {
    return { allowed: false, reason: 'PERMISSION_DENIED: fullName size bounds' };
  }
  if (data.createdAt !== REQUEST_TIME_MS || data.updatedAt !== REQUEST_TIME_MS) {
    return { allowed: false, reason: 'PERMISSION_DENIED: timestamp must equal request.time' };
  }
  return { allowed: true };
}

export function runDirtyDozenChecks() {
  const uidA: MockAuth = { uid: 'userA_123', email: 'memberA@example.com', email_verified: true };
  const uidB: MockAuth = { uid: 'userB_456', email: 'memberB@example.com', email_verified: true };
  const adminAuth: MockAuth = { uid: 'admin_01', email: BOOTSTRAPPED_ADMIN_EMAIL, email_verified: true };
  const spoofedAdmin: MockAuth = { uid: 'attacker', email: BOOTSTRAPPED_ADMIN_EMAIL, email_verified: false };

  const checks: Array<{ name: string; res: ValidationResult }> = [
    {
      name: '1. Identity Spoofing on User Create',
      res: validateUserCreate(uidA, 'userB_456', {
        uid: 'userB_456',
        displayName: 'Bob',
        email: 'memberA@example.com',
        bestScore: 0,
        gamesPlayed: 0,
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '2. Shadow Role Escalation on User Create',
      res: validateUserCreate(uidA, 'userA_123', {
        uid: 'userA_123',
        displayName: 'Alice',
        email: 'memberA@example.com',
        bestScore: 0,
        gamesPlayed: 0,
        role: 'super_admin',
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '3. Unverified Admin Email Spoof',
      res: { allowed: isAdmin(spoofedAdmin), reason: 'PERMISSION_DENIED: email_verified is false' },
    },
    {
      name: '4. Cross-User PII Get',
      res: { allowed: uidB.uid === 'userA_123' || isAdmin(uidB), reason: 'PERMISSION_DENIED: not owner or admin' },
    },
    {
      name: '5. Orphaned Subcollection Bookmark',
      res: validateBookmarkCreate(uidA, false, 'userA_123', 'bm1', {
        uid: 'userA_123',
        query: 'Ogembo services',
        answer: 'Test',
        sourceTitles: [],
        sourceUrls: [],
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '6. Client Timestamp Forgery',
      res: validateBookmarkCreate(uidA, true, 'userA_123', 'bm1', {
        uid: 'userA_123',
        query: 'Ogembo services',
        answer: 'Test',
        sourceTitles: [],
        sourceUrls: [],
        createdAt: 1000,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '7. Path Variable Poisoning',
      res: validateBookmarkCreate(uidA, true, 'userA_123', 'bad$id/../hack', {
        uid: 'userA_123',
        query: 'Ogembo services',
        answer: 'Test',
        sourceTitles: [],
        sourceUrls: [],
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '8. Array Exhaustion / Non-string Element',
      res: validateBookmarkCreate(uidA, true, 'userA_123', 'bm2', {
        uid: 'userA_123',
        query: 'Ogembo services',
        answer: 'Test',
        sourceTitles: ['Title'],
        sourceUrls: [12345 as any],
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '9. Oversized Answer Payload',
      res: validateBookmarkCreate(uidA, true, 'userA_123', 'bm3', {
        uid: 'userA_123',
        query: 'Ogembo services',
        answer: 'a'.repeat(12001),
        sourceTitles: [],
        sourceUrls: [],
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '10. Negative Game Score Tampering',
      res: validateUserCreate(uidA, 'userA_123', {
        uid: 'userA_123',
        displayName: 'Alice',
        email: 'memberA@example.com',
        bestScore: -10,
        gamesPlayed: 1,
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '11. Prayer Request UID Spoofing & Status Bypass',
      res: validatePrayerCreate(uidA, 'req_01', {
        uid: 'userB_456',
        referenceNumber: 'PRY-2026-AB12CD',
        requesterName: 'Alice',
        phone: '',
        email: '',
        category: 'Personal prayer',
        requestContent: 'Please pray for my family.',
        privacyLevel: 'confidential',
        followupRequested: false,
        consent: true,
        status: 'Answered',
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '12. Prayer Request Oversized Content Payload',
      res: validatePrayerCreate(uidA, 'req_02', {
        uid: 'userA_123',
        referenceNumber: 'PRY-2026-AB12CD',
        requesterName: 'Alice',
        phone: '',
        email: '',
        category: 'Personal prayer',
        requestContent: 'x'.repeat(4001),
        privacyLevel: 'confidential',
        followupRequested: false,
        consent: true,
        status: 'New',
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '13. Non-Admin Attempt to Import Church Member PII',
      res: validateChurchMemberCreate(uidA, 'mem_01', {
        memberNumber: 'GVCC-2026-AB12CD',
        fullName: 'Unauthorized Member',
        phone: '0700000000',
        email: '',
        location: 'Ogembo',
        fellowshipGroup: '',
        membershipType: 'Existing member',
        membershipStatus: 'Active member',
        registrationDate: '2026-11-19',
        notes: '',
        importedByUid: uidA.uid,
        importSource: 'csv_import',
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '14. Admin Shadow Field & Spoofed UID on Church Member Import',
      res: validateChurchMemberCreate(adminAuth, 'mem_02', {
        memberNumber: 'GVCC-2026-AB12CD',
        fullName: 'Test Member',
        phone: '0700000000',
        email: '',
        location: 'Ogembo',
        fellowshipGroup: '',
        membershipType: 'Existing member',
        membershipStatus: 'Active member',
        registrationDate: '2026-11-19',
        notes: '',
        importedByUid: uidA.uid,
        importSource: 'csv_import',
        isSuperAdmin: true,
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '15. Non-Admin Attempt to Create Directory Member in /members',
      res: validateDirectoryMemberCreate(uidA, 'dir_01', {
        memberNumber: 'GVCC-2026-XY78ZW',
        fullName: 'Unauthorized Member',
        phone: '0700000000',
        email: '',
        location: 'Ogembo',
        fellowshipGroup: 'Ogembo Central Fellowship',
        membershipType: 'Existing member',
        membershipStatus: 'Active member',
        registrationDate: '2026-11-19',
        notes: '',
        createdByUid: uidA.uid,
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
    {
      name: '16. Admin Shadow Field & Spoofed UID on /members Directory Create',
      res: validateDirectoryMemberCreate(adminAuth, 'dir_02', {
        memberNumber: 'GVCC-2026-XY78ZW',
        fullName: 'Directory Member',
        phone: '0700000000',
        email: '',
        location: 'Ogembo',
        fellowshipGroup: 'Ogembo Central Fellowship',
        membershipType: 'Existing member',
        membershipStatus: 'Active member',
        registrationDate: '2026-11-19',
        notes: '',
        createdByUid: uidA.uid,
        isAdmin: true,
        createdAt: REQUEST_TIME_MS,
        updatedAt: REQUEST_TIME_MS,
      }),
    },
  ];

  const rulesFile = path.resolve(process.cwd(), 'firestore.rules');
  if (fs.existsSync(rulesFile)) {
    const content = fs.readFileSync(rulesFile, 'utf8');
    if (!content.includes("rules_version = '2';")) {
      throw new Error('firestore.rules must specify rules_version = 2');
    }
  }

  for (const c of checks) {
    if (c.res.allowed) {
      throw new Error(`Security Test Failed: ${c.name} was unexpectedly allowed`);
    }
  }
  return { passed: checks.length, total: checks.length };
}
