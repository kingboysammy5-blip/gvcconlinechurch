import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { ensureUserProfile, UserFirestoreProfile } from '../lib/firestoreStore';

const PORTAL_TOKEN_KEY = 'gvcc_portal_token';

export interface StaffProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
  effectivePermissions: string[];
  assignedFellowshipId: number | null;
  accountStatus: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  firestoreProfile: UserFirestoreProfile | null;
  staffProfile: StaffProfile | null;
  portalUnlocked: boolean;
  loading: boolean;
  authError: string | null;
  unlockWithPasscode: (password: string) => Promise<void>;
  lockPortal: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  refreshProfile: () => Promise<void>;
  refreshFirestoreProfile: () => Promise<void>;
  hasPerm: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firestoreProfile, setFirestoreProfile] = useState<UserFirestoreProfile | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [portalUnlocked, setPortalUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncPortalTokenSession = useCallback(async (token: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        sessionStorage.removeItem(PORTAL_TOKEN_KEY);
        setPortalUnlocked(false);
        return false;
      }
      const data = await res.json();
      setStaffProfile(data.user);
      setPortalUnlocked(true);
      setAuthError(null);
      return true;
    } catch {
      sessionStorage.removeItem(PORTAL_TOKEN_KEY);
      setPortalUnlocked(false);
      return false;
    }
  }, []);

  const syncFirestoreUser = useCallback(async (user: User | null) => {
    if (!user || !user.emailVerified) {
      setFirestoreProfile(null);
      return;
    }
    try {
      const profile = await ensureUserProfile(user);
      setFirestoreProfile(profile);
    } catch (err) {
      console.error('Firestore profile sync warning:', err);
    }
  }, []);

  const syncProfile = useCallback(async (user: User | null) => {
    await syncFirestoreUser(user);

    const existingPortalToken = sessionStorage.getItem(PORTAL_TOKEN_KEY);
    if (existingPortalToken) {
      const ok = await syncPortalTokenSession(existingPortalToken);
      if (ok) {
        setLoading(false);
        return;
      }
    }

    if (!user) {
      setStaffProfile(null);
      setPortalUnlocked(false);
      setLoading(false);
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Failed to verify staff session');
      }
      const data = await res.json();
      setStaffProfile(data.user);
      setAuthError(null);
    } catch (err: any) {
      console.error('Auth sync error:', err);
      setAuthError(err.message || 'Authentication sync failed');
      setStaffProfile(null);
    } finally {
      setLoading(false);
    }
  }, [syncFirestoreUser, syncPortalTokenSession]);

  useEffect(() => {
    let mounted = true;
    const portalToken = sessionStorage.getItem(PORTAL_TOKEN_KEY);
    if (portalToken) {
      syncPortalTokenSession(portalToken).finally(() => {
        if (mounted) setLoading(false);
      });
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!mounted) return;
      setFirebaseUser(user);
      syncFirestoreUser(user);
      if (sessionStorage.getItem(PORTAL_TOKEN_KEY)) {
        return;
      }
      syncProfile(user);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [syncPortalTokenSession, syncProfile, syncFirestoreUser]);

  const unlockWithPasscode = async (password: string) => {
    setAuthError(null);
    const res = await fetch('/api/admin/passcode-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token || !data.user) {
      const msg = data.error || 'Incorrect management password. Access denied.';
      setAuthError(msg);
      throw new Error(msg);
    }
    sessionStorage.setItem(PORTAL_TOKEN_KEY, data.token);
    setStaffProfile(data.user);
    setPortalUnlocked(true);
  };

  const lockPortal = () => {
    sessionStorage.removeItem(PORTAL_TOKEN_KEY);
    setPortalUnlocked(false);
    setAuthError(null);
    if (!firebaseUser) {
      setStaffProfile(null);
    }
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await syncProfile(cred.user);
    } catch (err: any) {
      setAuthError(err.message || 'Google Sign-In was cancelled or failed.');
      throw err;
    }
  };

  const signOut = async () => {
    sessionStorage.removeItem(PORTAL_TOKEN_KEY);
    setPortalUnlocked(false);
    setAuthError(null);
    await firebaseSignOut(auth);
    setStaffProfile(null);
    setFirestoreProfile(null);
  };

  const getToken = async () => {
    const portalToken = sessionStorage.getItem(PORTAL_TOKEN_KEY);
    if (portalToken) return portalToken;
    if (!firebaseUser) return null;
    return firebaseUser.getIdToken();
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...options, headers });
  };

  const refreshProfile = async () => {
    const portalToken = sessionStorage.getItem(PORTAL_TOKEN_KEY);
    if (portalToken) {
      await syncPortalTokenSession(portalToken);
      return;
    }
    await syncProfile(firebaseUser);
  };

  const refreshFirestoreProfile = async () => {
    await syncFirestoreUser(firebaseUser);
  };

  const hasPerm = (perm: string) => {
    if (!staffProfile) return false;
    if (staffProfile.role === 'super_admin') return true;
    return staffProfile.effectivePermissions?.includes(perm) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        firestoreProfile,
        staffProfile,
        portalUnlocked,
        loading,
        authError,
        unlockWithPasscode,
        lockPortal,
        signInWithGoogle,
        signOut,
        getToken,
        authFetch,
        refreshProfile,
        refreshFirestoreProfile,
        hasPerm,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
