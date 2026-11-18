import React, { useState } from 'react';
import { Calendar, CheckCircle2, Share2, X } from 'lucide-react';
import { EventItem, Fellowship, NewsPost, Sermon } from '../../types/church';

export const FellowshipJoinModal: React.FC<{
  fellowship: Fellowship | null;
  onClose: () => void;
}> = ({ fellowship, onClose }) => {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    memberOrVisitor: 'Visitor' as 'Church member' | 'Visitor',
    preferredCommunication: 'Phone',
    availability: '',
    prayerRequest: '',
    consent: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [refNumber, setRefNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!fellowship) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/public/fellowships/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, fellowshipId: fellowship.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setRefNumber(data.referenceNumber);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#FBF9F5] border border-stone-200 max-w-lg w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#9A6B2F] font-semibold">
              Fellowship Registration
            </p>
            <h3 className="font-serif text-2xl font-medium text-[#1C1917] mt-1">{fellowship.name}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-stone-500 hover:text-[#1C1917] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {refNumber ? (
          <div className="bg-white border border-stone-200 p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
            <h4 className="font-serif text-xl font-medium">Thank You for Connecting</h4>
            <p className="text-sm text-stone-600">
              Your request to join <strong>{fellowship.name}</strong> has been saved for pastoral follow-up.
            </p>
            <p className="font-mono text-sm text-[#1C1917] bg-[#F3EFE7] py-2 px-3 inline-block">
              Ref: {refNumber}
            </p>
            <div className="pt-3">
              <button type="button" onClick={onClose} className="px-6 py-2.5 bg-[#1C1917] text-white text-sm font-medium cursor-pointer">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-3">{error}</p>}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Full name *</label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#9A6B2F]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Phone number *</label>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#9A6B2F]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#9A6B2F]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Member or visitor *</label>
                <select
                  value={form.memberOrVisitor}
                  onChange={(e) => setForm({ ...form, memberOrVisitor: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 text-sm"
                >
                  <option value="Visitor">Visitor</option>
                  <option value="Church member">Church member</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Preferred contact</label>
                <select
                  value={form.preferredCommunication}
                  onChange={(e) => setForm({ ...form, preferredCommunication: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 text-sm"
                >
                  <option value="Phone">Phone call</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Availability / Preferred days (optional)</label>
              <input
                value={form.availability}
                onChange={(e) => setForm({ ...form, availability: e.target.value })}
                placeholder="e.g., Sundays after service"
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Prayer or support note (optional)</label>
              <textarea
                rows={3}
                value={form.prayerRequest}
                onChange={(e) => setForm({ ...form, prayerRequest: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 text-sm"
              />
            </div>
            <label className="flex items-start gap-2.5 text-xs text-stone-600">
              <input
                type="checkbox"
                required
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                className="mt-0.5 accent-[#9A6B2F]"
              />
              <span>I consent to GVCC leadership contacting me for fellowship follow-up.</span>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#9A6B2F] hover:bg-[#825824] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Fellowship Interest'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const EventDetailModal: React.FC<{
  event: EventItem | null;
  onClose: () => void;
}> = ({ event, onClose }) => {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', guestsCount: 1 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  const downloadIcs = () => {
    const start = event.startDatetime.replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const end = (event.endDatetime || event.startDatetime).replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:${event.title}`,
      `LOCATION:${event.location}`,
      `DESCRIPTION:${event.description.replace(/\n/g, ' ')}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.slug}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/public/events/${event.id}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Could not register');
    else setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#FBF9F5] border border-stone-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {event.posterUrl && (
          <img src={event.posterUrl} alt={event.title} referrerPolicy="no-referrer" className="w-full h-56 object-cover" />
        )}
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#9A6B2F] font-semibold">
                {event.eventCategory} · {event.status}
              </p>
              <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C1917] mt-1">{event.title}</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-stone-500 hover:text-[#1C1917] cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-sm text-stone-700 space-y-1 border-y border-stone-200 py-4">
            <p><strong>Date & Time:</strong> {new Date(event.startDatetime).toLocaleString()}</p>
            <p><strong>Location:</strong> {event.location}</p>
            {event.contactPerson && <p><strong>Contact:</strong> {event.contactPerson}</p>}
          </div>

          <p className="text-sm sm:text-base text-stone-700 leading-relaxed whitespace-pre-line">{event.description}</p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadIcs}
              className="inline-flex items-center gap-2 px-4 py-2 border border-stone-300 bg-white text-xs font-medium text-[#1C1917] hover:bg-stone-100 cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              Add to Calendar
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-stone-300 bg-white text-xs font-medium text-[#1C1917] hover:bg-stone-100 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              {copied ? 'Link Copied' : 'Share Event'}
            </button>
          </div>

          {event.registrationOpen && (
            <div className="bg-white border border-stone-200 p-5">
              <h4 className="font-serif text-lg font-medium mb-3">Register Attendance</h4>
              {done ? (
                <p className="text-sm text-emerald-700 font-medium">You are registered! We look forward to welcoming you.</p>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  {error && <p className="text-xs text-red-700">{error}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      required
                      placeholder="Full name *"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="px-3 py-2 border border-stone-300 text-sm"
                    />
                    <input
                      required
                      placeholder="Phone number *"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="px-3 py-2 border border-stone-300 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="email"
                      placeholder="Email (optional)"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="px-3 py-2 border border-stone-300 text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={form.guestsCount}
                      onChange={(e) => setForm({ ...form, guestsCount: Number(e.target.value) })}
                      className="px-3 py-2 border border-stone-300 text-sm"
                      placeholder="Number of attendees"
                    />
                  </div>
                  <button type="submit" className="px-5 py-2.5 bg-[#9A6B2F] text-white text-sm font-medium cursor-pointer">
                    Confirm Registration
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const NewsArticleModal: React.FC<{
  post: NewsPost | null;
  onClose: () => void;
}> = ({ post, onClose }) => {
  if (!post) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4" onClick={onClose}>
      <article
        className="bg-[#FBF9F5] border border-stone-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {post.featuredImage && (
          <img src={post.featuredImage} alt={post.title} referrerPolicy="no-referrer" className="w-full h-64 object-cover" />
        )}
        <div className="p-6 sm:p-10 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#9A6B2F] font-semibold">
                {post.category} · {new Date(post.publishedAt).toLocaleDateString()} · {post.authorName}
              </p>
              <h2 className="font-serif text-3xl font-medium text-[#1C1917] mt-2">{post.title}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-stone-500 hover:text-[#1C1917] cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-base text-stone-600 italic border-b border-stone-200 pb-4">{post.summary}</p>
          <div className="text-base text-stone-800 leading-relaxed whitespace-pre-line">{post.body}</div>
        </div>
      </article>
    </div>
  );
};

export const SermonPlayerModal: React.FC<{
  sermon: Sermon | null;
  onClose: () => void;
}> = ({ sermon, onClose }) => {
  if (!sermon) return null;

  const getYoutubeEmbed = (url: string) => {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}?rel=0` : null;
  };

  const ytEmbed = sermon.videoUrl ? getYoutubeEmbed(sermon.videoUrl) : null;
  const isDirectVideo = Boolean(
    sermon.videoUrl && /\.(mp4|webm|ogg)(\?.*)?$/i.test(sermon.videoUrl.trim())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1C1917] text-white border border-stone-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#E2C28B]">
              {sermon.category} · {sermon.sermonDate} {sermon.scriptureReference ? `· ${sermon.scriptureReference}` : ''}
            </p>
            <h3 className="font-serif text-2xl sm:text-3xl font-medium mt-1">{sermon.title}</h3>
            <p className="text-sm text-stone-300 mt-1">Speaker: {sermon.speaker}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-stone-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {ytEmbed ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={ytEmbed}
              title={sermon.title}
              className="w-full h-full"
              allowFullScreen
            />
          </div>
        ) : isDirectVideo && sermon.videoUrl ? (
          <div className="aspect-video w-full bg-black">
            <video controls playsInline className="w-full h-full object-contain" src={sermon.videoUrl} />
          </div>
        ) : sermon.videoUrl ? (
          <div className="bg-black/40 border border-stone-700 p-4 space-y-2">
            <p className="text-xs text-stone-300">External Sermon Video Link:</p>
            <a
              href={sermon.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#E2C28B] underline break-all"
            >
              {sermon.videoUrl}
            </a>
          </div>
        ) : null}

        {sermon.audioUrl && (
          <div className="bg-stone-900 border border-stone-700 p-4">
            <p className="text-xs text-stone-300 mb-2">Audio Sermon</p>
            <audio controls className="w-full" src={sermon.audioUrl} />
          </div>
        )}

        <p className="text-sm sm:text-base text-stone-300 leading-relaxed">{sermon.description}</p>
      </div>
    </div>
  );
};
