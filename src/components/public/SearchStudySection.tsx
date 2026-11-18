import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  ExternalLink,
  Gamepad2,
  Globe,
  Loader2,
  LogIn,
  LogOut,
  Search,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  deleteResearchBookmark,
  SavedResearchBookmark,
  saveResearchBookmark,
  SearchSourceItem,
  subscribeUserBookmarks,
} from '../../lib/firestoreStore';

interface SearchStudySectionProps {
  onOpenGame: () => void;
}

const SAMPLE_QUERIES = [
  {
    label: '2 Timothy 4:2–5 Context',
    query: 'What is the historical context and meaning of Paul charging Timothy to preach the word in 2 Timothy 4:2-5?',
    focus: 'scripture' as const,
  },
  {
    label: 'Cheerful Giving (2 Cor 9:7)',
    query: 'What does Christian stewardship and cheerful giving mean in 2 Corinthians 9:6-11?',
    focus: 'scripture' as const,
  },
  {
    label: 'Ogembo & Kisii County',
    query: 'Overview of Ogembo town in Kisii County Kenya, its local economy and community hubs',
    focus: 'ogembo' as const,
  },
];

export const SearchStudySection: React.FC<SearchStudySectionProps> = ({ onOpenGame }) => {
  const { firebaseUser, firestoreProfile, signInWithGoogle, signOut, authError } = useAuth();

  const [queryInput, setQueryInput] = useState('');
  const [focusArea, setFocusArea] = useState<'scripture' | 'ogembo' | 'general'>('scripture');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    query: string;
    answer: string;
    sources: SearchSourceItem[];
  } | null>(null);

  const [bookmarks, setBookmarks] = useState<SavedResearchBookmark[]>([]);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);
  const [bookmarkMessage, setBookmarkMessage] = useState<string | null>(null);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setBookmarks([]);
      return;
    }
    const unsub = subscribeUserBookmarks(
      firebaseUser,
      (items) => {
        setBookmarks(items);
        setBookmarkError(null);
      },
      (err) => {
        setBookmarkError(err.message);
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  const runSearch = async (overrideQuery?: string, overrideFocus?: 'scripture' | 'ogembo' | 'general') => {
    const q = (overrideQuery ?? queryInput).trim();
    const f = overrideFocus ?? focusArea;
    if (q.length < 2) {
      setSearchError('Please enter a topic or question to research.');
      return;
    }

    if (overrideQuery) setQueryInput(overrideQuery);
    if (overrideFocus) setFocusArea(overrideFocus);

    setSearching(true);
    setSearchError(null);
    setBookmarkMessage(null);
    try {
      const res = await fetch('/api/ai/search-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, focusArea: f }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Could not complete search query.');
      }
      setResult({
        query: q,
        answer: json.answer,
        sources: Array.isArray(json.sources) ? json.sources : [],
      });
    } catch (err: any) {
      setSearchError(err.message || 'Unable to complete grounded search right now.');
    } finally {
      setSearching(false);
    }
  };

  const handleSaveBookmark = async () => {
    if (!firebaseUser || !result) return;
    setBookmarkSaving(true);
    setBookmarkError(null);
    setBookmarkMessage(null);
    try {
      await saveResearchBookmark(firebaseUser, result.query, result.answer, result.sources);
      setBookmarkMessage('Saved to your personal Firestore library.');
    } catch (err: any) {
      setBookmarkError(err.message || 'Could not save study bookmark.');
    } finally {
      setBookmarkSaving(false);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    if (!firebaseUser) return;
    try {
      await deleteResearchBookmark(firebaseUser, id);
    } catch (err: any) {
      setBookmarkError(err.message || 'Could not delete bookmark.');
    }
  };

  return (
    <section id="study" className="py-20 lg:py-28 bg-white border-t border-stone-200">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 space-y-12">
        {/* Section Header + Google Member Sync Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-stone-200 pb-8">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold">
              Bible Study · Web-Grounded Research · Member Cloud Sync
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917] leading-tight">
              Search-Grounded Study &amp; Member Fellowship Hub
            </h2>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Research biblical context, Christian teaching topics, or Ogembo community questions backed by live Google Search sources, save study notes with Google Sign-In, or launch the Sanctuary 2D game.
            </p>
          </div>

          {/* Google Account & Sanctuary Game Entry Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenGame}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F5132] hover:bg-[#0B3D25] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Play Shepherd&apos;s Light 2D</span>
            </button>

            {firebaseUser ? (
              <div className="flex items-center gap-3 border border-stone-200 bg-[#FBF9F5] px-3.5 py-2">
                <div className="text-left">
                  <p className="text-xs font-semibold text-[#1C1917] truncate max-w-[160px]">
                    {firestoreProfile?.displayName || firebaseUser.displayName || 'GVCC Member'}
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-stone-500">
                    Best: {firestoreProfile?.bestScore ?? 0} pts · {bookmarks.length} saved
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  aria-label="Sign out of Google account"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-100 whitespace-nowrap cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1C1917] hover:bg-stone-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>

        {authError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-3">{authError}</p>
        )}

        {/* Workspace Split: Left Search Grounding Desk | Right Saved Cloud Study Library */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Google Search Grounding Research Panel */}
          <div className="lg:col-span-7 bg-[#FBF9F5] border border-stone-200 p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#9A6B2F]">
                <Globe className="w-4 h-4" />
                <span>Live Google Search Grounding</span>
              </div>

              {/* Functional Focus Segmented Controls */}
              <div className="flex items-center gap-1 p-1 bg-[#EAE4D8]" role="tablist">
                {[
                  ['scripture', 'Scripture'],
                  ['ogembo', 'Ogembo'],
                  ['general', 'General'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={focusArea === key}
                    onClick={() => setFocusArea(key as 'scripture' | 'ogembo' | 'general')}
                    className={`px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      focusArea === key
                        ? 'bg-[#1C1917] text-white'
                        : 'text-stone-700 hover:text-[#1C1917]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch();
              }}
              className="space-y-3"
            >
              <label htmlFor="gvcc-search-input" className="sr-only">
                Research a Scripture, sermon theme, or community topic
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="gvcc-search-input"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  maxLength={500}
                  placeholder="Ask a Bible study, ministry, or Ogembo question..."
                  className="flex-1 px-4 py-3 bg-white border border-stone-300 text-sm text-[#1C1917] focus:outline-none focus:border-[#9A6B2F]"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Search &amp; Verify</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Example Prompts */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-stone-500 mr-1">Suggested topics:</span>
              {SAMPLE_QUERIES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => runSearch(item.query, item.focus)}
                  disabled={searching}
                  className="px-2.5 py-1 border border-stone-300 bg-white hover:border-[#9A6B2F] text-xs text-stone-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {searchError && (
              <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-800">
                {searchError}
              </div>
            )}

            {result ? (
              <div className="bg-white border border-stone-200 p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-4">
                  <div className="space-y-1">
                    <p className="text-xs text-stone-500">
                      Grounded Response · {result.sources.length} web sources cited
                    </p>
                    <h3 className="font-serif text-xl font-medium text-[#1C1917]">
                      {result.query}
                    </h3>
                  </div>

                  {firebaseUser ? (
                    <button
                      type="button"
                      onClick={handleSaveBookmark}
                      disabled={bookmarkSaving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1C1917] hover:bg-stone-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{bookmarkSaving ? 'Saving...' : 'Save Note'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => signInWithGoogle()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-stone-300 text-xs font-semibold text-[#1C1917] hover:bg-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign in to Save</span>
                    </button>
                  )}
                </div>

                {bookmarkMessage && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2">
                    {bookmarkMessage}
                  </p>
                )}
                {bookmarkError && (
                  <p className="text-xs text-red-800 bg-red-50 border border-red-200 px-3 py-2">
                    {bookmarkError}
                  </p>
                )}

                <div className="text-sm text-stone-800 leading-relaxed whitespace-pre-line max-h-[360px] overflow-y-auto pr-1">
                  {result.answer}
                </div>

                {result.sources.length > 0 && (
                  <div className="border-t border-stone-200 pt-4 space-y-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#9A6B2F] font-semibold">
                      Verified Google Search Sources
                    </p>
                    <ul className="space-y-1.5">
                      {result.sources.map((src, idx) => (
                        <li key={idx} className="text-xs">
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-stone-700 hover:text-[#9A6B2F] underline underline-offset-2"
                          >
                            <span>{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-stone-200 bg-white p-6 text-sm text-stone-600 leading-relaxed">
                Enter any biblical, theological, pastoral, or Ogembo community question above to fetch an answer grounded directly in live Google Search sources with clickable citations.
              </div>
            )}
          </div>

          {/* Right: Personal Firestore Study Bookmarks */}
          <aside className="lg:col-span-5 bg-[#F3EFE7] border border-stone-200 p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-[#9A6B2F] font-semibold">
                  Personal Cloud Notebook
                </p>
                <h3 className="font-serif text-xl font-medium text-[#1C1917] mt-0.5">
                  Saved Study Bookmarks
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-stone-500">
                {firebaseUser ? `${bookmarks.length} saved` : 'Guest'}
              </span>
            </div>

            {!firebaseUser ? (
              <div className="bg-white border border-stone-200 p-6 space-y-4">
                <p className="text-sm text-stone-700 leading-relaxed">
                  Sign in with your Google account to sync your saved Bible study research notes and your Shepherd&apos;s Light 2D game scores across devices.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#1C1917] hover:bg-stone-800 text-white text-xs font-semibold cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="bg-white border border-stone-200 p-6 text-sm text-stone-600 leading-relaxed">
                No study notes saved yet. Run a grounded search query on the left and select <strong>Save Note</strong> to store it in your personal Firestore notebook.
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {bookmarks.map((bm) => (
                  <article
                    key={bm.id}
                    className="bg-white border border-stone-200 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setResult({
                            query: bm.query,
                            answer: bm.answer,
                            sources: bm.sourceUrls.map((uri, i) => ({
                              uri,
                              title: bm.sourceTitles[i] || uri,
                            })),
                          })
                        }
                        className="text-left font-serif text-base font-medium text-[#1C1917] hover:text-[#9A6B2F] cursor-pointer"
                      >
                        {bm.query}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBookmark(bm.id)}
                        aria-label="Delete saved bookmark"
                        className="text-stone-400 hover:text-red-700 p-1 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                      {bm.answer}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-stone-400">
                      {bm.sourceUrls.length} cited sources · Click title to open
                    </p>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};
