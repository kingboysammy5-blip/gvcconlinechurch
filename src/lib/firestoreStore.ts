import { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface UserFirestoreProfile {
  uid: string;
  displayName: string;
  email: string;
  bestScore: number;
  gamesPlayed: number;
}

export interface SearchSourceItem {
  title: string;
  uri: string;
}

export interface SavedResearchBookmark {
  id: string;
  uid: string;
  query: string;
  answer: string;
  sourceTitles: string[];
  sourceUrls: string[];
  createdAtMs: number;
}

export interface SanctuaryLeaderboardEntry {
  id: string;
  uid: string;
  displayName: string;
  bestScore: number;
  bestWave: number;
  totalLambsSaved: number;
}

function clampString(value: string | null | undefined, maxLen: number, fallback = ''): string {
  const clean = (value || fallback).trim();
  if (!clean) return fallback.slice(0, maxLen);
  return clean.slice(0, maxLen);
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(Number(value) || 0);
  return Math.max(min, Math.min(max, n));
}

export async function ensureUserProfile(user: User): Promise<UserFirestoreProfile> {
  if (!user.emailVerified) {
    throw new Error('Verified Google email is required to sync Firestore profile.');
  }
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = clampString(user.displayName || user.email?.split('@')[0], 80, 'GVCC Member');
    const email = clampString(user.email, 160, 'member@gvcc.ogembo');

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        bestScore: 0,
        gamesPlayed: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        uid: user.uid,
        displayName,
        email,
        bestScore: 0,
        gamesPlayed: 0,
      };
    }

    const data = snap.data();
    return {
      uid: user.uid,
      displayName: String(data.displayName || displayName),
      email: String(data.email || email),
      bestScore: clampInt(data.bestScore, 0, 1000000),
      gamesPlayed: clampInt(data.gamesPlayed, 0, 1000000),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function saveResearchBookmark(
  user: User,
  promptQuery: string,
  answer: string,
  sources: SearchSourceItem[]
): Promise<void> {
  await ensureUserProfile(user);
  const collectionPath = `users/${user.uid}/bookmarks`;
  const boundedSources = sources.slice(0, 10);
  const sourceTitles = boundedSources.map((s) => clampString(s.title, 200, 'Web Source'));
  const sourceUrls = boundedSources.map((s) => clampString(s.uri, 500, 'https://www.google.com'));

  try {
    await addDoc(collection(db, 'users', user.uid, 'bookmarks'), {
      uid: user.uid,
      query: clampString(promptQuery, 500, 'Ministry Research'),
      answer: clampString(answer, 12000, 'No response content'),
      sourceTitles,
      sourceUrls,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionPath);
  }
}

export async function deleteResearchBookmark(user: User, bookmarkId: string): Promise<void> {
  const path = `users/${user.uid}/bookmarks/${bookmarkId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', bookmarkId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserBookmarks(
  user: User,
  onData: (items: SavedResearchBookmark[]) => void,
  onError?: (err: Error) => void
): () => void {
  const collectionPath = `users/${user.uid}/bookmarks`;
  const q = query(
    collection(db, 'users', user.uid, 'bookmarks'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedResearchBookmark[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: String(data.uid || user.uid),
          query: String(data.query || ''),
          answer: String(data.answer || ''),
          sourceTitles: Array.isArray(data.sourceTitles) ? data.sourceTitles.map(String) : [],
          sourceUrls: Array.isArray(data.sourceUrls) ? data.sourceUrls.map(String) : [],
          createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function recordGameRunAndSyncLeaderboard(
  user: User,
  stats: {
    score: number;
    wave: number;
    lambsSaved: number;
    durationSeconds: number;
  }
): Promise<UserFirestoreProfile> {
  const profile = await ensureUserProfile(user);
  const safeScore = clampInt(stats.score, 0, 1000000);
  const safeWave = clampInt(stats.wave, 1, 999);
  const safeLambs = clampInt(stats.lambsSaved, 0, 10000);
  const safeDuration = clampInt(stats.durationSeconds, 0, 86400);

  const runsPath = `users/${user.uid}/gameRuns`;
  try {
    await addDoc(collection(db, 'users', user.uid, 'gameRuns'), {
      uid: user.uid,
      score: safeScore,
      wave: safeWave,
      lambsSaved: safeLambs,
      durationSeconds: safeDuration,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, runsPath);
  }

  const nextBestScore = Math.max(profile.bestScore, safeScore);
  const nextGamesPlayed = clampInt(profile.gamesPlayed + 1, 1, 1000000);

  const userPath = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      displayName: clampString(profile.displayName, 80, 'GVCC Shepherd'),
      bestScore: nextBestScore,
      gamesPlayed: nextGamesPlayed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  const lbPath = `leaderboard/${user.uid}`;
  const lbRef = doc(db, 'leaderboard', user.uid);
  try {
    const existingLb = await getDoc(lbRef);
    const displayName = clampString(profile.displayName, 80, 'GVCC Shepherd');
    if (!existingLb.exists()) {
      await setDoc(lbRef, {
        uid: user.uid,
        displayName,
        bestScore: safeScore,
        bestWave: safeWave,
        totalLambsSaved: safeLambs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const prev = existingLb.data();
      await updateDoc(lbRef, {
        displayName,
        bestScore: Math.max(clampInt(prev.bestScore, 0, 1000000), safeScore),
        bestWave: Math.max(clampInt(prev.bestWave, 1, 999), safeWave),
        totalLambsSaved: clampInt((Number(prev.totalLambsSaved) || 0) + safeLambs, 0, 100000),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, lbPath);
  }

  return {
    ...profile,
    bestScore: nextBestScore,
    gamesPlayed: nextGamesPlayed,
  };
}

export function subscribeSanctuaryLeaderboard(
  onData: (entries: SanctuaryLeaderboardEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  const lbPath = 'leaderboard';
  const q = query(
    collection(db, 'leaderboard'),
    where('bestScore', '>=', 0),
    orderBy('bestScore', 'desc'),
    limit(10)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const entries: SanctuaryLeaderboardEntry[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'GVCC Shepherd'),
          bestScore: clampInt(data.bestScore, 0, 1000000),
          bestWave: clampInt(data.bestWave, 1, 999),
          totalLambsSaved: clampInt(data.totalLambsSaved, 0, 100000),
        };
      });
      onData(entries);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, lbPath);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export const PRAYER_CATEGORIES = [
  'Personal prayer',
  'Family',
  'Health',
  'Spiritual growth',
  'Employment',
  'Financial needs',
  'Marriage',
  'Children',
  'Thanksgiving',
  'Other',
] as const;

export type PrayerPrivacyLevel =
  | 'confidential'
  | 'prayer_team'
  | 'public_board'
  | 'public_testimony';

export interface PrayerRequestInput {
  requesterName?: string;
  phone?: string;
  email?: string;
  category: string;
  requestContent: string;
  privacyLevel: PrayerPrivacyLevel;
  followupRequested: boolean;
  consent: boolean;
}

export interface FirestorePrayerRequest {
  id: string;
  uid: string;
  referenceNumber: string;
  requesterName: string;
  phone: string;
  email: string;
  category: string;
  requestContent: string;
  privacyLevel: PrayerPrivacyLevel;
  followupRequested: boolean;
  consent: boolean;
  status: 'New' | 'In Prayer' | 'Answered' | 'Archived';
  createdAtMs: number;
}

function clampOptionalString(value: string | null | undefined, maxLen: number): string {
  return (value || '').trim().slice(0, maxLen);
}

function generateFirestorePrayerRef(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');
  return `PRY-${year}-${suffix}`;
}

export async function submitPrayerRequest(
  user: User,
  input: PrayerRequestInput
): Promise<{ id: string; referenceNumber: string }> {
  if (!user.emailVerified) {
    throw new Error('Verified Google email is required to submit to Cloud Firestore.');
  }
  const content = clampString(input.requestContent, 4000, '');
  if (content.length < 5) {
    throw new Error('Please share your prayer request (at least 5 characters).');
  }
  if (!input.consent) {
    throw new Error('Consent is required to submit a prayer request.');
  }

  const safeCategory = (PRAYER_CATEGORIES as readonly string[]).includes(input.category)
    ? input.category
    : 'Personal prayer';
  const safePrivacy: PrayerPrivacyLevel = (
    ['confidential', 'prayer_team', 'public_board', 'public_testimony'] as const
  ).includes(input.privacyLevel)
    ? input.privacyLevel
    : 'confidential';

  const referenceNumber = generateFirestorePrayerRef();
  const collectionPath = 'prayer_requests';

  try {
    const docRef = await addDoc(collection(db, collectionPath), {
      uid: user.uid,
      referenceNumber,
      requesterName: clampString(input.requesterName, 120, 'Anonymous'),
      phone: clampOptionalString(input.phone, 40),
      email: clampOptionalString(input.email, 160),
      category: safeCategory,
      requestContent: content,
      privacyLevel: safePrivacy,
      followupRequested: Boolean(input.followupRequested),
      consent: true,
      status: 'New',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, referenceNumber };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionPath);
  }
}

export function subscribeUserPrayerRequests(
  user: User,
  onData: (items: FirestorePrayerRequest[]) => void,
  onError?: (err: Error) => void
): () => void {
  const collectionPath = 'prayer_requests';
  const q = query(
    collection(db, collectionPath),
    where('uid', '==', user.uid),
    limit(20)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestorePrayerRequest[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid || user.uid),
            referenceNumber: String(data.referenceNumber || ''),
            requesterName: String(data.requesterName || 'Anonymous'),
            phone: String(data.phone || ''),
            email: String(data.email || ''),
            category: String(data.category || 'Personal prayer'),
            requestContent: String(data.requestContent || ''),
            privacyLevel: (data.privacyLevel || 'confidential') as PrayerPrivacyLevel,
            followupRequested: Boolean(data.followupRequested),
            consent: Boolean(data.consent),
            status: (data.status || 'New') as FirestorePrayerRequest['status'],
            createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function deleteUserPrayerRequest(user: User, requestId: string): Promise<void> {
  if (!user.emailVerified) {
    throw new Error('Verified Google account is required.');
  }
  const path = `prayer_requests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'prayer_requests', requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
