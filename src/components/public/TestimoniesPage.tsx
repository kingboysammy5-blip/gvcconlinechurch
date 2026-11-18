import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Heart,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { ChurchSettings, Fellowship, PublicTestimonyItem } from '../../types/church';

interface TestimoniesPageProps {
  testimonies: PublicTestimonyItem[];
  fellowships: Fellowship[];
  settings: ChurchSettings | null;
  onBackToSite: () => void;
  onOpenAdmin: () => void;
}

const TESTIMONY_CATEGORIES = [
  'All',
  'Answered Prayer',
  'Healing & Restoration',
  'Provision & Breakthrough',
  'Family & Peace',
  'Faith & Salvation',
  'Deliverance & Guidance',
  'Thanksgiving',
];

export const TestimoniesPage: React.FC<TestimoniesPageProps> = ({
  testimonies: initialTestimonies,
  fellowships,
  settings,
  onBackToSite,
  onOpenAdmin,
}) => {
  const [stories, setStories] = useState<PublicTestimonyItem[]>(initialTestimonies || []);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStory, setActiveStory] = useState<PublicTestimonyItem | null>(null);
  const [amenedIds, setAmenedIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('gvcc_amened_testimonies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [amenBusyId, setAmenBusyId] = useState<number | null>(null);

  // Submission Form State
  const [form, setForm] = useState({
    authorName: '',
    displayAnonymous: false,
    phone: '',
    email: '',
    fellowshipGroup: '',
    category: 'Answered Prayer',
    title: '',
    scriptureReference: '',
    story: '',
    consent: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{
    referenceNumber: string;
    message: string;
  } | null>(null);

  const churchName = settings?.churchName || 'Gracious Voice Celebration Centre';
  const shortName = settings?.shortName || 'GVCC';
  const location = settings?.location || 'Ogembo, Kenya';

  const filteredStories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stories.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.story.toLowerCase().includes(q) ||
        item.authorName.toLowerCase().includes(q) ||
        (item.scriptureReference || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [stories, selectedCategory, searchQuery]);

  const featuredStory = useMemo(
    () => filteredStories.find((s) => s.featured) || null,
    [filteredStories]
  );

  const regularStories = useMemo(
    () =>
      featuredStory
        ? filteredStories.filter((s) => s.id !== featuredStory.id)
        : filteredStories,
    [filteredStories, featuredStory]
  );

  const handleAmen = async (storyId: number) => {
    if (amenedIds.includes(storyId) || amenBusyId === storyId) return;
    setAmenBusyId(storyId);
    try {
      const res = await fetch(`/api/public/testimonies/${storyId}/amen`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated = await res.json();
        setStories((prev) =>
          prev.map((item) =>
            item.id === storyId ? { ...item, amenCount: updated.amenCount } : item
          )
        );
        if (activeStory?.id === storyId) {
          setActiveStory((prev) =>
            prev ? { ...prev, amenCount: updated.amenCount } : null
          );
        }
        const nextIds = [...amenedIds, storyId];
        setAmenedIds(nextIds);
        try {
          localStorage.setItem('gvcc_amened_testimonies', JSON.stringify(nextIds));
        } catch {
          // ignore storage quota errors
        }
      }
    } finally {
      setAmenBusyId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/testimonies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Could not submit testimony.');
      } else {
        setSubmitSuccess({
          referenceNumber: json.referenceNumber,
          message: json.message,
        });
        setForm({
          authorName: '',
          displayAnonymous: false,
          phone: '',
          email: '',
          fellowshipGroup: '',
          category: 'Answered Prayer',
          title: '',
          scriptureReference: '',
          story: '',
          consent: true,
        });
      }
    } catch {
      setSubmitError('Network error while submitting your faith story.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1C1917] flex flex-col">
      {/* Top Editorial Navigation */}
      <header className="sticky top-0 z-40 bg-[#141210] text-white border-b border-stone-800">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#E2C28B] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to {shortName} Home</span>
            </button>
            <span className="hidden sm:inline text-white/25">|</span>
            <span className="hidden sm:inline font-serif text-base text-white truncate">
              {churchName} · Testimonies
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#read-testimonies"
              className="hidden sm:inline text-xs text-stone-300 hover:text-white underline-offset-4 hover:underline"
            >
              Read Stories ({stories.length})
            </a>
            <a
              href="#submit-testimony"
              className="px-4 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Share Faith Story
            </a>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-[#141210] text-white border-b border-stone-800 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-8 space-y-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[#E2C28B] font-semibold">
              Moderated Faith Stories · {churchName}, {location}
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl font-medium text-white leading-[1.12]">
              Testimonies of God’s Faithfulness
            </h1>
            <p className="text-base text-stone-300 leading-relaxed max-w-2xl">
              Discover how the Lord is answering prayers, healing, providing, and transforming lives across our Ogembo congregation—and share your own story to encourage fellow believers.
            </p>
            <blockquote className="border-t border-white/15 pt-4 max-w-xl">
              <p className="font-serif italic text-stone-200 text-base">
                “Let the redeemed of the Lord tell their story — those he redeemed from the hand of the foe.”
              </p>
              <footer className="font-mono text-xs text-[#E2C28B] mt-1">
                — Psalm 107:2
              </footer>
            </blockquote>
          </div>

          <div className="lg:col-span-4 bg-[#1B1917] border border-stone-800 p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#E2C28B]">
              <ShieldCheck className="w-4 h-4" />
              <span>Pastoral Moderation Policy</span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Every submitted testimony enters our pastoral review queue before appearing publicly. Phone numbers and emails provided during submission remain strictly confidential.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <a
                href="#submit-testimony"
                className="px-4 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold transition-colors"
              >
                Submit a Testimony
              </a>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="px-4 py-2 border border-stone-700 text-stone-300 hover:text-white text-xs cursor-pointer"
              >
                Moderator Review
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 sm:px-10 py-14 space-y-16">
        {/* Reading Archive Section */}
        <section id="read-testimonies" className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 pb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-2">
                Approved Stories · {stories.length} Published
              </p>
              <h2 className="font-serif text-3xl font-medium text-[#1C1917]">
                Stories From the Church Family
              </h2>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search testimonies or scripture..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 text-xs focus:outline-none focus:border-[#9A6B2F]"
              />
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            {TESTIMONY_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1C1917] text-white'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Featured Story Spotlight */}
          {featuredStory && (
            <article className="bg-[#1C1917] text-white border border-stone-800 p-7 sm:p-10 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#B4823E] text-white text-[11px] uppercase tracking-wider font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Featured Testimony · {featuredStory.category}
                </span>
                <span className="font-mono text-xs text-stone-400">
                  {new Date(featuredStory.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl font-medium text-white">
                {featuredStory.title}
              </h3>
              <p className="text-sm sm:text-base text-stone-200 leading-relaxed whitespace-pre-line max-w-4xl">
                {featuredStory.story}
              </p>
              <div className="pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-stone-300 space-y-0.5">
                  <p className="font-semibold text-white">
                    Shared by {featuredStory.authorName}
                    {featuredStory.fellowshipGroup ? ` · ${featuredStory.fellowshipGroup}` : ''}
                  </p>
                  {featuredStory.scriptureReference && (
                    <p className="font-mono text-[#E2C28B]">
                      Scripture Anchor: {featuredStory.scriptureReference}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={amenedIds.includes(featuredStory.id) || amenBusyId === featuredStory.id}
                  onClick={() => handleAmen(featuredStory.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    amenedIds.includes(featuredStory.id)
                      ? 'bg-emerald-800 text-white'
                      : 'bg-white text-[#1C1917] hover:bg-stone-200'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>
                    {amenedIds.includes(featuredStory.id) ? 'Amen Said' : 'Praise God · Amen'} (
                    {featuredStory.amenCount})
                  </span>
                </button>
              </div>
            </article>
          )}

          {/* Grid of Approved Testimonies or Honest Empty State */}
          {regularStories.length === 0 && !featuredStory ? (
            <div className="bg-white border border-stone-200 p-10 text-center max-w-2xl mx-auto space-y-4">
              <BookOpen className="w-8 h-8 text-[#9A6B2F] mx-auto" />
              <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                {stories.length === 0
                  ? 'Awaiting First Approved Testimonies'
                  : 'No Matching Testimonies Found'}
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                {stories.length === 0
                  ? 'Faith stories shared by members appear here once reviewed and approved by GVCC pastors or moderators. Be the first to share what God has done in your life using the form below.'
                  : 'Try selecting another category or clearing your search filter.'}
              </p>
              <a
                href="#submit-testimony"
                className="inline-block px-5 py-2.5 bg-[#1C1917] text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
              >
                Share Your Testimony Below →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {regularStories.map((item) => {
                const hasAmened = amenedIds.includes(item.id);
                return (
                  <article
                    key={item.id}
                    className="bg-white border border-stone-200 p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="uppercase tracking-wider text-[#9A6B2F] font-semibold">
                          {item.category}
                        </span>
                        <span className="font-mono text-stone-400">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-serif text-2xl font-medium text-[#1C1917] leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-sm text-stone-700 leading-relaxed line-clamp-5 whitespace-pre-line">
                        {item.story}
                      </p>
                      {item.scriptureReference && (
                        <p className="text-xs font-mono text-[#9A6B2F]">
                          Scripture: {item.scriptureReference}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-stone-100 pt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-stone-500">
                        <strong className="text-[#1C1917] block">{item.authorName}</strong>
                        {item.fellowshipGroup && <span>{item.fellowshipGroup}</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        {item.story.length > 260 && (
                          <button
                            type="button"
                            onClick={() => setActiveStory(item)}
                            className="px-3 py-1.5 border border-stone-300 text-xs font-medium text-[#1C1917] hover:bg-stone-50 cursor-pointer"
                          >
                            Read Full Story
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={hasAmened || amenBusyId === item.id}
                          onClick={() => handleAmen(item.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                            hasAmened
                              ? 'bg-emerald-800 text-white'
                              : 'bg-[#1C1917] hover:bg-stone-800 text-white'
                          }`}
                        >
                          <Heart className="w-3.5 h-3.5" />
                          <span>
                            {hasAmened ? 'Amen' : 'Amen'} · {item.amenCount}
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Submission Form Section */}
        <section
          id="submit-testimony"
          className="bg-[#F3EFE7] border border-stone-200 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start"
        >
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold">
              Share What God Has Done
            </p>
            <h2 className="font-serif text-3xl font-medium text-[#1C1917] leading-tight">
              Submit Your Faith Story
            </h2>
            <p className="text-sm text-stone-700 leading-relaxed">
              Has God healed you, answered a prayer, restored your family, or guided your steps? Share your testimony to strengthen the faith of the {shortName} congregation.
            </p>
            <div className="bg-white border border-stone-200 p-4 text-xs text-stone-600 space-y-2 leading-relaxed">
              <p className="font-semibold text-[#1C1917] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#9A6B2F]" />
                <span>How Moderation Works</span>
              </p>
              <p>
                1. Your submission is saved securely as <strong>Pending Review</strong>.
              </p>
              <p>
                2. Pastoral leadership or church moderators verify and approve testimonies before publishing publicly.
              </p>
              <p>
                3. You may choose to publish your name anonymously while keeping your contact details private for pastoral follow-up only.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-stone-200 p-6 sm:p-8">
            {submitSuccess ? (
              <div className="py-8 text-center space-y-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                  Testimony Submitted for Moderation
                </h3>
                <p className="text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
                  {submitSuccess.message}
                </p>
                <p className="font-mono text-sm bg-[#F3EFE7] px-4 py-2 inline-block">
                  Reference ID: {submitSuccess.referenceNumber}
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => setSubmitSuccess(null)}
                    className="px-5 py-2.5 bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"
                  >
                    Submit Another Testimony
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-3">
                    {submitError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Your Name *
                    </label>
                    <input
                      required
                      value={form.authorName}
                      onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                      placeholder="Full name"
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Fellowship / Ministry (optional)
                    </label>
                    <select
                      value={form.fellowshipGroup}
                      onChange={(e) => setForm({ ...form, fellowshipGroup: e.target.value })}
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm bg-white"
                    >
                      <option value="">General Congregation</option>
                      {fellowships.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={form.displayAnonymous}
                    onChange={(e) =>
                      setForm({ ...form, displayAnonymous: e.target.checked })
                    }
                    className="accent-[#9A6B2F]"
                  />
                  <span>
                    Display publicly as <strong>“Anonymous Believer”</strong> (only church pastors see your name)
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Phone (private, for pastoral confirmation)
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Email (private)
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Testimony Category *
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm bg-white"
                    >
                      {TESTIMONY_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Anchor Scripture (optional)
                    </label>
                    <input
                      value={form.scriptureReference}
                      onChange={(e) =>
                        setForm({ ...form, scriptureReference: e.target.value })
                      }
                      placeholder="e.g. Psalm 23:1 or Isaiah 41:10"
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Testimony Headline *
                  </label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. God Restored Peace in My Family"
                    className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Your Faith Story *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={form.story}
                    onChange={(e) => setForm({ ...form, story: e.target.value })}
                    placeholder="Share how God has worked in your life..."
                    className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                  />
                </div>

                <label className="flex items-start gap-2 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    required
                    checked={form.consent}
                    onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                    className="mt-0.5 accent-[#9A6B2F]"
                  />
                  <span>
                    I grant permission for {churchName} leadership to review and publish this testimony to encourage the congregation.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#1C1917] hover:bg-stone-800 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Submitting for Review...' : 'Submit Testimony for Moderation'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer Credit Preserved */}
      <footer className="bg-[#141210] text-stone-400 border-t border-stone-800 py-6 px-6 text-center text-xs space-y-1.5">
        <p>
          © {new Date().getFullYear()} {churchName} · {location}
        </p>
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-300 font-medium">
          DEVELOPED AND MAINTAINED BY MOSOMI CHACHA of NAYO TV AFRICA
        </p>
      </footer>

      {/* Full Story Reading Modal */}
      {activeStory && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setActiveStory(null)}
        >
          <article
            className="bg-[#FBF9F5] border border-stone-300 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-9 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#9A6B2F] font-semibold">
                  {activeStory.category} · {new Date(activeStory.createdAt).toLocaleDateString()}
                </p>
                <h2 className="font-serif text-3xl font-medium text-[#1C1917] mt-1">
                  {activeStory.title}
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Shared by <strong>{activeStory.authorName}</strong>
                  {activeStory.fellowshipGroup ? ` · ${activeStory.fellowshipGroup}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveStory(null)}
                aria-label="Close story"
                className="p-2 text-stone-500 hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeStory.scriptureReference && (
              <p className="font-mono text-xs bg-[#F3EFE7] px-3 py-2 text-[#9A6B2F] inline-block">
                Scripture Anchor: {activeStory.scriptureReference}
              </p>
            )}

            <p className="text-base text-stone-800 leading-relaxed whitespace-pre-line">
              {activeStory.story}
            </p>

            <div className="border-t border-stone-200 pt-4 flex justify-end">
              <button
                type="button"
                disabled={amenedIds.includes(activeStory.id)}
                onClick={() => handleAmen(activeStory.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold cursor-pointer ${
                  amenedIds.includes(activeStory.id)
                    ? 'bg-emerald-800 text-white'
                    : 'bg-[#1C1917] text-white hover:bg-stone-800'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Praise God · Amen ({activeStory.amenCount})</span>
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
};
