import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, LogIn, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  deleteUserPrayerRequest,
  FirestorePrayerRequest,
  PRAYER_CATEGORIES,
  PrayerPrivacyLevel,
  submitPrayerRequest,
  subscribeUserPrayerRequests,
} from '../../lib/firestoreStore';

interface PrayerRequestFormProps {
  onPublicBoardSubmitted?: () => Promise<void> | void;
}

export const PrayerRequestForm: React.FC<PrayerRequestFormProps> = ({
  onPublicBoardSubmitted,
}) => {
  const { firebaseUser, firestoreProfile, signInWithGoogle, authError } = useAuth();

  const [form, setForm] = useState<{
    requesterName: string;
    phone: string;
    email: string;
    category: string;
    requestContent: string;
    privacyLevel: PrayerPrivacyLevel;
    followupRequested: boolean;
    consent: boolean;
  }>({
    requesterName: '',
    phone: '',
    email: '',
    category: 'Personal prayer',
    requestContent: '',
    privacyLevel: 'public_board',
    followupRequested: false,
    consent: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    referenceNumber: string;
    message: string;
    isPublic: boolean;
  } | null>(null);

  const [myRequests, setMyRequests] = useState<FirestorePrayerRequest[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setMyRequests([]);
      return;
    }
    const unsub = subscribeUserPrayerRequests(
      firebaseUser,
      (items) => {
        setMyRequests(items);
        setListError(null);
      },
      (err) => {
        setListError(err.message);
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setSubmitError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setSubmitError(err?.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!firebaseUser || !firebaseUser.emailVerified) {
      setSubmitError('Please sign in with a verified Google account to submit your prayer request.');
      return;
    }

    const trimmedContent = form.requestContent.trim();
    if (trimmedContent.length < 5) {
      setSubmitError('Please share your prayer request (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const saved = await submitPrayerRequest(firebaseUser, {
        requesterName:
          form.requesterName.trim() ||
          firestoreProfile?.displayName ||
          firebaseUser.displayName ||
          'Anonymous',
        phone: form.phone.trim(),
        email: form.email.trim(),
        category: form.category,
        requestContent: trimmedContent,
        privacyLevel: form.privacyLevel,
        followupRequested: form.followupRequested,
        consent: form.consent,
      });

      const isPublic =
        form.privacyLevel === 'public_board' || form.privacyLevel === 'public_testimony';

      // Sync to the GVCC Administration & Prayer Board queue (confidential requests remain hidden publicly)
      try {
        const apiRes = await fetch('/api/public/prayers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterName:
              form.requesterName.trim() ||
              firestoreProfile?.displayName ||
              firebaseUser.displayName ||
              'Anonymous',
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            category: form.category,
            requestContent: trimmedContent,
            privacyLevel: form.privacyLevel,
            followupRequested: form.followupRequested,
            consent: true,
          }),
        });
        if (apiRes.ok && isPublic && onPublicBoardSubmitted) {
          await onPublicBoardSubmitted();
        }
      } catch {
        // Firestore record is already saved cleanly
      }

      setSubmitResult({
        referenceNumber: saved.referenceNumber,
        isPublic,
        message: isPublic
          ? 'Your prayer request has been saved securely and shared on the GVCC Community Prayer Board.'
          : 'Your confidential prayer request has been saved securely for Bishop Joseph Ondari Gichana and our prayer team.',
      });

      setForm({
        requesterName: '',
        phone: '',
        email: '',
        category: 'Personal prayer',
        requestContent: '',
        privacyLevel: 'public_board',
        followupRequested: false,
        consent: true,
      });
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to save prayer request right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!firebaseUser) return;
    try {
      await deleteUserPrayerRequest(firebaseUser, id);
    } catch (err: any) {
      setListError(err?.message || 'Could not remove prayer request.');
    }
  };

  return (
    <div className="bg-[#FBF9F5] text-[#1C1917] p-6 sm:p-8 border border-stone-700 space-y-6">
      {submitResult ? (
        <div className="py-6 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
          <h3 className="font-serif text-2xl font-medium">
            {submitResult.isPublic ? 'Posted to the Prayer Board' : 'Prayer Request Received'}
          </h3>
          <p className="text-sm text-stone-600 max-w-md mx-auto">{submitResult.message}</p>
          <p className="font-mono text-sm bg-[#F3EFE7] px-4 py-2 inline-block">
            Reference ID: {submitResult.referenceNumber}
          </p>
          <div>
            <button
              type="button"
              onClick={() => setSubmitResult(null)}
              className="px-5 py-2.5 bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-2xl font-medium">
                Post or Submit a Prayer Request
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Saved securely in Cloud Firestore (<span className="font-mono">prayer_requests</span>)
              </p>
            </div>
            {firebaseUser && (
              <span className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1">
                Signed in: {firestoreProfile?.displayName || firebaseUser.displayName || 'Member'}
              </span>
            )}
          </div>

          {!firebaseUser && (
            <div className="bg-[#F3EFE7] border border-stone-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-stone-700 leading-relaxed">
                Sign in with your Google account to save and manage your prayer requests securely in Cloud Firestore.
              </p>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1C1917] hover:bg-stone-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {signingIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In with Google</span>
                  </>
                )}
              </button>
            </div>
          )}

          {(submitError || authError) && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-3">
              {submitError || authError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Name (optional)
              </label>
              <input
                value={form.requesterName}
                onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                maxLength={120}
                placeholder="Anonymous if blank"
                className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Phone (kept private)
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                maxLength={40}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Email (kept private)
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={160}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Prayer category *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm"
              >
                {PRAYER_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Visibility &amp; privacy *
              </label>
              <select
                value={form.privacyLevel}
                onChange={(e) =>
                  setForm({ ...form, privacyLevel: e.target.value as PrayerPrivacyLevel })
                }
                className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm"
              >
                <option value="public_board">
                  Public Prayer Board (Members can pray with you)
                </option>
                <option value="confidential">
                  Confidential (Pastoral leadership only)
                </option>
                <option value="prayer_team">
                  Prayer team (Authorized intercessors only)
                </option>
                <option value="public_testimony">Public thanksgiving / testimony</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Your prayer request *
            </label>
            <textarea
              required
              rows={4}
              minLength={5}
              maxLength={4000}
              value={form.requestContent}
              onChange={(e) => setForm({ ...form, requestContent: e.target.value })}
              placeholder="Share how the church family or pastoral team can pray with you..."
              className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm"
            />
          </div>

          <div className="space-y-2 text-xs text-stone-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.followupRequested}
                onChange={(e) =>
                  setForm({ ...form, followupRequested: e.target.checked })
                }
                className="accent-[#9A6B2F]"
              />
              <span>I would appreciate a pastoral follow-up call or message</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                required
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                className="accent-[#9A6B2F]"
              />
              <span>
                I consent to GVCC storing this request securely{' '}
                {form.privacyLevel === 'public_board' ||
                form.privacyLevel === 'public_testimony'
                  ? 'and displaying my prayer need (without private phone/email) on the Public Prayer Board.'
                  : 'for confidential pastoral prayer support.'}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || !firebaseUser}
            className="w-full py-3 bg-[#9A6B2F] hover:bg-[#825824] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-55"
          >
            {submitting
              ? 'Saving Prayer Request...'
              : form.privacyLevel === 'public_board' ||
                form.privacyLevel === 'public_testimony'
              ? 'Save & Post to Prayer Board'
              : 'Save Confidential Prayer Request'}
          </button>
        </form>
      )}

      {/* Signed-In User's Personal Prayer Requests synced from Firestore */}
      {firebaseUser && (
        <div className="border-t border-stone-200 pt-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.14em] text-[#9A6B2F] font-semibold">
              Your Saved Prayer Requests
            </span>
            <span className="font-mono tabular-nums text-stone-500">
              {myRequests.length} saved
            </span>
          </div>

          {listError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-2.5">
              {listError}
            </p>
          )}

          {myRequests.length === 0 ? (
            <p className="text-xs text-stone-500">
              Prayer requests you submit while signed in appear here privately for your personal tracking.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {myRequests.map((reqItem) => (
                <div
                  key={reqItem.id}
                  className="bg-white border border-stone-200 p-3 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-[11px] font-mono text-stone-500">
                      {reqItem.referenceNumber} · {reqItem.category} · {reqItem.status}
                    </p>
                    <p className="text-xs text-stone-800 leading-relaxed break-words">
                      {reqItem.requestContent}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRequest(reqItem.id)}
                    aria-label="Delete your prayer request"
                    className="text-stone-400 hover:text-red-700 p-1 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
