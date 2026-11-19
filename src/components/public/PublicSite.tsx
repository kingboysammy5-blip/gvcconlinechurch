import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  HeartHandshake,
  Landmark,
  Lock,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  PlayCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ChurchSettings,
  DevotionalItem,
  EventItem,
  Fellowship,
  NewsPost,
  PublicBootstrap,
  PublicPrayerItem,
  Sermon,
} from '../../types/church';
import { HeroSlideshow } from './HeroSlideshow';
import { ChurchEventsCalendar } from './ChurchEventsCalendar';
import { ChurchMediaPortal } from './ChurchMediaPortal';
import { GallerySection } from './GallerySection';
import { PrayerRequestForm } from './PrayerRequestForm';
import { SearchStudySection } from './SearchStudySection';
import {
  EventDetailModal,
  FellowshipJoinModal,
  NewsArticleModal,
  SermonPlayerModal,
} from './FormsModals';

interface PublicSiteProps {
  data: PublicBootstrap;
  onOpenAdmin: () => void;
  onOpenTestimonies: () => void;
  onOpenGame: () => void;
}

const DEFAULT_SETTINGS: ChurchSettings = {
  churchName: 'Gracious Voice Celebration Centre',
  shortName: 'GVCC',
  location: 'Ogembo, Kenya',
  leadPastor: 'Bishop Joseph Ondari Gichana',
  phone: '0727 543 663',
  whatsappNumber: '254727543663',
  email: '',
  welcomeHeading: 'Welcome to Gracious Voice Celebration Centre',
  welcomeBody:
    'We welcome you to Gracious Voice Celebration Centre in Ogembo — a community gathered in faith and united by the desire to seek God, grow spiritually, worship together, and share the hope of Christ.',
  missionStatement: 'Awaiting official confirmation from church leadership.',
  visionStatement: 'Awaiting official confirmation from church leadership.',
  missionVerified: false,
  serviceScheduleNotice:
    'Official weekly service times are being confirmed by church leadership. Please call 0727 543 663 or reach out on WhatsApp for this week’s gathering details.',
  serviceScheduleVerified: false,
  serviceTimes: [],
  coreValues: [],
  footerTagline: 'Growing in faith. Living in fellowship. Sharing the vision of Christ in Ogembo.',
  announcementBar: {
    enabled: true,
    text: 'WELCOME TO GRACIOUS VOICE CELEBRATION CENTRE, OGEMBO — A PLACE OF FAITH, HOPE & TRANSFORMATION.',
    linkLabel: 'Plan Your Visit',
    linkUrl: '#connect',
    bgColor: '#1C1917',
  },
  mapNotice: 'Centered on Ogembo, Kisii County, Kenya. Exact building pin awaiting confirmation.',
  guidingScriptureReference: '2 Timothy 4:2–5',
  guidingScriptureText:
    'Preach the word; be prepared in season and out of season; correct, rebuke and encourage—with great patience and careful instruction. For the time will come when people will not put up with sound doctrine. Instead, to suit their own desires, they will gather around them a great number of teachers to say what their itching ears want to hear. They will turn their ears away from the truth and turn aside to myths. But you, keep your head in all situations, endure hardship, do the work of an evangelist, discharge all the duties of your ministry.',
  givingConfig: {
    givingVerified: false,
    stewardshipScriptureRef: '2 Corinthians 9:7',
    stewardshipScriptureText:
      'Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.',
    givingNotice:
      'Official M-Pesa Paybill, Till, and Bank Account details are verified and published exclusively by church leadership. Please confirm directly with the church office on 0727 543 663 before sending electronic contributions.',
    mpesaPaybill: '',
    mpesaAccountFormat: 'GVCC Tithe / Offering',
    mpesaTill: '',
    bankName: '',
    bankAccountName: 'Gracious Voice Celebration Centre',
    bankAccountNumber: '',
    bankBranch: 'Ogembo',
    inPersonInstructions:
      'Tithes and offerings may also be presented in person during sanctuary services at Gracious Voice Celebration Centre, Ogembo.',
  },
  tvLiveConfig: {
    isLive: false,
    channelName: 'GVCC TV LIVE',
    streamTitle: 'Sunday Celebration & Word Service — GVCC Ogembo',
    streamSpeaker: 'Bishop Joseph Ondari Gichana',
    streamUrl: '',
    scheduleNote:
      'Live sanctuary broadcasts stream on GVCC TV LIVE when activated by the Church Media team in Website Settings.',
    description:
      'Watch live services, worship gatherings, and special broadcasts from Gracious Voice Celebration Centre in Ogembo through the official Church Media Portal.',
  },
};

export const PublicSite: React.FC<PublicSiteProps> = ({
  data,
  onOpenAdmin,
  onOpenTestimonies,
  onOpenGame,
}) => {
  const settings: ChurchSettings = {
    ...DEFAULT_SETTINGS,
    ...(data.settings || {}),
    announcementBar: {
      ...DEFAULT_SETTINGS.announcementBar,
      ...(data.settings?.announcementBar || {}),
    },
    tvLiveConfig: {
      ...DEFAULT_SETTINGS.tvLiveConfig!,
      ...(data.settings?.tvLiveConfig || {}),
    },
  };

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [mediaPortalOpen, setMediaPortalOpen] = useState(false);

  // Interactive modals
  const [activeFellowship, setActiveFellowship] = useState<Fellowship | null>(null);
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);
  const [activePost, setActivePost] = useState<NewsPost | null>(null);
  const [activeSermon, setActiveSermon] = useState<Sermon | null>(null);

  // Prayer Request Form & Public Prayer Board State
  const [boardPrayers, setBoardPrayers] = useState<PublicPrayerItem[]>(data.publicPrayers || []);
  const [selectedDevotionalId, setSelectedDevotionalId] = useState<number | null>(null);
  const [boardCategoryFilter, setBoardCategoryFilter] = useState<string>('All');
  const [prayingId, setPrayingId] = useState<number | null>(null);
  const [activeSupportId, setActiveSupportId] = useState<number | null>(null);
  const [supportDraft, setSupportDraft] = useState({ supporterName: '', encouragementNote: '' });
  const [boardError, setBoardError] = useState<string | null>(null);
  const [prayedIds, setPrayedIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('gvcc_prayed_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Connect Tabs: visitor vs member vs contact
  const [connectTab, setConnectTab] = useState<'visitor' | 'member' | 'contact'>('visitor');

  const [visitorForm, setVisitorForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    residence: '',
    firstTimeVisitor: true,
    preferredVisitDate: '',
    accompanyingCount: 0,
    visitSource: '',
    assistanceRequest: '',
    consent: true,
  });
  const [visitorResult, setVisitorResult] = useState<string | null>(null);
  const [visitorError, setVisitorError] = useState<string | null>(null);
  const [visitorLoading, setVisitorLoading] = useState(false);

  const [memberForm, setMemberForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    location: '',
    membershipType: 'New member',
    fellowshipId: '',
    ministryId: '',
    preferredContactMethod: 'Phone',
    testimony: '',
    consent: true,
  });
  const [memberResult, setMemberResult] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);

  const [contactForm, setContactForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    subject: '',
    message: '',
  });
  const [contactResult, setContactResult] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactLoading, setContactLoading] = useState(false);

  // Tithes & Offerings Giving Notification State
  const [givingForm, setGivingForm] = useState({
    giverName: '',
    phone: '',
    email: '',
    givingCategory: 'Tithe',
    givingMethod: 'M-Pesa',
    amountKes: '',
    transactionReference: '',
    notes: '',
    consent: true,
  });
  const [givingLoading, setGivingLoading] = useState(false);
  const [givingResult, setGivingResult] = useState<{ referenceNumber: string; message: string } | null>(null);
  const [givingError, setGivingError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setBoardPrayers(data.publicPrayers || []);
  }, [data.publicPrayers]);

  const refreshPrayerBoard = async () => {
    try {
      const res = await fetch('/api/public/prayers');
      if (res.ok) {
        const items: PublicPrayerItem[] = await res.json();
        setBoardPrayers(items);
      }
    } catch {
      // Keep current state if refresh fails transiently
    }
  };

  const handlePrayForRequest = async (prayerId: number, withNote: boolean) => {
    if (prayingId !== null) return;
    setPrayingId(prayerId);
    setBoardError(null);
    try {
      const payload = withNote
        ? {
            supporterName: supportDraft.supporterName,
            encouragementNote: supportDraft.encouragementNote,
          }
        : {};
      const res = await fetch(`/api/public/prayers/${prayerId}/pray`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not record prayer');

      setBoardPrayers((prev) =>
        prev.map((item) =>
          item.id === prayerId
            ? {
                ...item,
                prayerCount: json.prayerCount,
                supports: json.support ? [json.support, ...(item.supports || [])].slice(0, 5) : item.supports,
              }
            : item
        )
      );

      setPrayedIds((prev) => {
        const next = prev.includes(prayerId) ? prev : [...prev, prayerId];
        try {
          localStorage.setItem('gvcc_prayed_ids', JSON.stringify(next));
        } catch {
          // ignore storage quota
        }
        return next;
      });

      if (withNote) {
        setActiveSupportId(null);
        setSupportDraft({ supporterName: '', encouragementNote: '' });
      }
    } catch (err: any) {
      setBoardError(err.message || 'Unable to record your prayer right now.');
    } finally {
      setPrayingId(null);
    }
  };

  const submitVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setVisitorLoading(true);
    setVisitorError(null);
    try {
      const res = await fetch('/api/public/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...visitorForm,
          accompanyingCount: Number(visitorForm.accompanyingCount) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not submit');
      setVisitorResult(json.referenceNumber);
    } catch (err: any) {
      setVisitorError(err.message);
    } finally {
      setVisitorLoading(false);
    }
  };

  const submitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberLoading(true);
    setMemberError(null);
    try {
      const res = await fetch('/api/public/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...memberForm,
          fellowshipId: memberForm.fellowshipId ? Number(memberForm.fellowshipId) : null,
          ministryId: memberForm.ministryId ? Number(memberForm.ministryId) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed');
      setMemberResult(json.memberNumber);
    } catch (err: any) {
      setMemberError(err.message);
    } finally {
      setMemberLoading(false);
    }
  };

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    setContactError(null);
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Message failed');
      setContactResult(json.referenceNumber);
      setContactForm({ fullName: '', phone: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      setContactError(err.message);
    } finally {
      setContactLoading(false);
    }
  };

  const submitGiving = async (e: React.FormEvent) => {
    e.preventDefault();
    setGivingLoading(true);
    setGivingError(null);
    try {
      const res = await fetch('/api/public/giving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(givingForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not record giving notification');
      setGivingResult({ referenceNumber: json.referenceNumber, message: json.message });
      setGivingForm({
        giverName: '',
        phone: '',
        email: '',
        givingCategory: 'Tithe',
        givingMethod: 'M-Pesa',
        amountKes: '',
        transactionReference: '',
        notes: '',
        consent: true,
      });
    } catch (err: any) {
      setGivingError(err.message);
    } finally {
      setGivingLoading(false);
    }
  };

  const copyGivingValue = (key: string, value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
  };

  const whatsappText = encodeURIComponent(
    'Hello Gracious Voice Celebration Centre. I would like to know more about the church and upcoming services.'
  );
  const whatsappUrl = `https://wa.me/${settings.whatsappNumber || '254727543663'}?text=${whatsappText}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      {/* Fixed Top Navigation Wrapper (<= 15% mobile height) */}
      <div className="fixed top-0 inset-x-0 z-40">
        {settings.announcementBar?.enabled && !bannerDismissed && (
          <div
            style={{ backgroundColor: settings.announcementBar.bgColor || '#1C1917' }}
            className="text-stone-100 text-[11px] sm:text-xs px-4 py-2 flex items-center justify-between gap-4 border-b border-white/10"
          >
            <div className="mx-auto flex items-center gap-3 text-center truncate">
              <span className="truncate">{settings.announcementBar.text}</span>
              {settings.announcementBar.linkLabel && (
                <a
                  href={settings.announcementBar.linkUrl || '#connect'}
                  className="text-[#E2C28B] underline underline-offset-4 whitespace-nowrap shrink-0"
                >
                  {settings.announcementBar.linkLabel}
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss announcement"
              className="text-stone-400 hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Strict 3-Zone Top Bar Contract */}
        <header
          className={`transition-colors duration-200 ${
            scrolled
              ? 'bg-[#1C1917]/95 backdrop-blur-md text-white border-b border-white/10'
              : 'bg-gradient-to-b from-black/70 to-transparent text-white'
          }`}
        >
          <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between gap-8">
            {/* Zone 1: Single-line Brand Wordmark */}
            <a
              href="#home"
              className="font-serif text-xl font-semibold tracking-tight text-white whitespace-nowrap shrink-0"
            >
              {settings.shortName || 'GVCC'}
            </a>

            {/* Zone 2: 5 concise single-line text links */}
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-200">
              <a href="#about" className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0">
                About
              </a>
              <a href="#events" className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0">
                Events
              </a>
              <a href="#media" className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0">
                Church Media
              </a>
              <button
                type="button"
                onClick={onOpenTestimonies}
                className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Testimonies
              </button>
              <a href="#prayer" className="hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0">
                Prayer
              </a>
            </nav>

            {/* Zone 3: 1 Primary CTA + mobile toggle */}
            <div className="flex items-center gap-3 shrink-0">
              <a
                href="#connect"
                className="hidden md:inline-flex items-center px-4 py-2 text-xs font-semibold bg-[#B4823E] hover:bg-[#9A6B2F] text-white transition-colors whitespace-nowrap shrink-0"
              >
                Join Our Church
              </a>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label="Toggle navigation menu"
                className="md:hidden h-10 w-10 flex items-center justify-center text-white border border-white/25 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-[#1C1917] text-white border-t border-white/10 px-6 py-5 space-y-3">
              {[
                ['About GVCC', '#about'],
                ['Daily Devotional', '#devotional'],
                ['Leadership', '#leadership'],
                ['Fellowships', '#fellowships'],
                ['Church Events Calendar', '#events'],
                ['GVCC TV LIVE · Church Media', '#media'],
                ['Updates & Sermons', '#updates'],
                ['Events & Media Gallery', '#gallery'],
                ['Prayer Board', '#prayer'],
                ['Bible Study & Search', '#study'],
                ['Tithes & Offerings', '#giving'],
                ['Plan a Visit / Register', '#connect'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm text-stone-200 hover:text-white border-b border-white/10"
                >
                  {label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenTestimonies();
                }}
                className="block w-full text-left py-2 text-sm text-stone-200 hover:text-white border-b border-white/10 cursor-pointer"
              >
                Testimonies &amp; Faith Stories
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenGame();
                }}
                className="block w-full text-left py-2 text-sm text-emerald-300 hover:text-white border-b border-white/10 cursor-pointer"
              >
                Play Shepherd&apos;s Light 2D Game
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAdmin();
                }}
                className="block w-full text-left py-2 text-sm text-[#E2C28B]"
              >
                Church Admin Portal
              </button>
            </div>
          )}
        </header>
      </div>

      <main className="flex-1">
        {/* 1. Reflective Image Slideshow Hero */}
        <HeroSlideshow slides={data.slides} churchLocation={settings.location} />

        {/* 2. Welcome & Verified Church Identity */}
        <section id="about" className="py-20 lg:py-28 max-w-6xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-3">
                Verified Church Identity · {settings.location}
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917] leading-tight mb-6">
                {settings.welcomeHeading}
              </h2>
              <p className="text-base text-stone-700 leading-relaxed mb-5 max-w-prose">
                {settings.welcomeBody}
              </p>
              <p className="text-base text-stone-700 leading-relaxed mb-8 max-w-prose">
                Under the spiritual leadership of <strong className="text-[#1C1917]">{settings.leadPastor}</strong>,
                we gather in Ogembo to seek God in worship, grow in Scripture, and uphold one another in prayer.
              </p>

              <div className="flex flex-wrap gap-4">
                <a
                  href="#leadership"
                  className="px-5 py-2.5 bg-[#1C1917] text-white text-sm font-medium hover:bg-stone-800 transition-colors"
                >
                  Meet Leadership
                </a>
                <a
                  href="#connect"
                  className="px-5 py-2.5 border border-stone-300 text-sm font-medium text-[#1C1917] hover:bg-stone-100 transition-colors"
                >
                  Plan Your Visit
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[340px] border border-stone-200 overflow-hidden bg-stone-200">
                <img
                  src="/images/church/photo_00.jpg"
                  alt="Bishop Joseph Ondari Gichana and church leader at Gracious Voice Celebration Centre, Ogembo"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>

          {/* Structured About Blocks: Profile, Mission, Vision, Service Schedule */}
          <div className="mt-16 pt-14 border-t border-stone-200 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white border border-stone-200 p-7">
              <p className="text-xs uppercase tracking-[0.15em] text-[#9A6B2F] font-semibold mb-2">
                Verified Profile
              </p>
              <h3 className="font-serif text-xl font-medium mb-4">{settings.churchName}</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-stone-100 pb-2">
                  <dt className="text-stone-500">Location</dt>
                  <dd className="font-medium text-right">{settings.location}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-stone-100 pb-2">
                  <dt className="text-stone-500">Leadership</dt>
                  <dd className="font-medium text-right">{settings.leadPastor}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Church Office</dt>
                  <dd className="font-mono tabular-nums font-medium text-right">
                    <a href={`tel:${settings.phone.replace(/\s+/g, '')}`} className="underline">
                      {settings.phone}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white border border-stone-200 p-7">
              <p className="text-xs uppercase tracking-[0.15em] text-stone-500 font-semibold mb-2">
                {settings.missionVerified ? 'Official Mission & Vision' : 'Mission & Vision · Awaiting Confirmation'}
              </p>
              <h3 className="font-serif text-xl font-medium mb-3">Our Spiritual Calling</h3>
              <p className="text-sm text-stone-700 leading-relaxed mb-3">
                <strong className="text-[#1C1917]">Mission:</strong> {settings.missionStatement}
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                <strong className="text-[#1C1917]">Vision:</strong> {settings.visionStatement}
              </p>
            </div>

            <div className="bg-white border border-stone-200 p-7">
              <p className="text-xs uppercase tracking-[0.15em] text-stone-500 font-semibold mb-2">
                {settings.serviceScheduleVerified ? 'Confirmed Worship Hours' : 'Service Times · Pending Confirmation'}
              </p>
              <h3 className="font-serif text-xl font-medium mb-3">Gather With Us</h3>
              {settings.serviceScheduleVerified && settings.serviceTimes?.length > 0 ? (
                <ul className="space-y-2 text-sm text-stone-700">
                  {settings.serviceTimes.map((s, idx) => (
                    <li key={idx} className="flex justify-between border-b border-stone-100 pb-1.5">
                      <span>{s.title}</span>
                      <span className="font-mono text-xs text-stone-600">{s.day} · {s.time}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-600 leading-relaxed mb-4">
                  {settings.serviceScheduleNotice}
                </p>
              )}
              <a
                href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#9A6B2F] hover:underline mt-2"
              >
                <Phone className="w-3.5 h-3.5" />
                Call {settings.phone} to confirm service times
              </a>
            </div>
          </div>
        </section>

        {/* 2a. Guiding Scripture & Pastoral Charge */}
        {settings.guidingScriptureText && (
          <section aria-label="Guiding Scripture" className="py-16 sm:py-20 bg-[#1C1917] text-white border-y border-stone-800">
            <div className="max-w-4xl mx-auto px-6 sm:px-10 text-center space-y-6">
              <p className="text-xs uppercase tracking-[0.2em] text-[#E2C28B] font-semibold">
                Biblical Charge & Ministry Foundation
              </p>
              <blockquote className="font-serif italic text-xl sm:text-2xl text-stone-100 leading-relaxed">
                “{settings.guidingScriptureText}”
              </blockquote>
              <p className="font-mono text-xs sm:text-sm tracking-widest uppercase text-[#E2C28B]">
                — {settings.guidingScriptureReference || '2 Timothy 4:2–5'}
              </p>
            </div>
          </section>
        )}

        {/* 2b. Daily Devotional Section */}
        <section id="devotional" className="py-20 bg-white border-t border-stone-200">
          <div className="max-w-6xl mx-auto px-6 sm:px-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-2">
                  Daily Word & Encouragement
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917]">
                  Daily Devotional
                </h2>
              </div>
              <p className="text-sm text-stone-600 max-w-md leading-relaxed">
                Short Scripture meditations and encouraging words shared by GVCC pastors and church leaders to strengthen your daily walk with Christ.
              </p>
            </div>

            {data.devotionals && data.devotionals.length > 0 ? (() => {
              const activeDevotional: DevotionalItem =
                data.devotionals.find((d) => d.id === selectedDevotionalId) || data.devotionals[0];
              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <article className="lg:col-span-7 bg-[#FBF9F5] border border-stone-200 p-7 sm:p-10 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
                      <p className="text-xs font-mono tabular-nums text-stone-500">
                        {activeDevotional.devotionalDate} · {activeDevotional.scriptureReference}
                      </p>
                      <span className="text-xs font-semibold text-[#9A6B2F] uppercase tracking-wider">
                        {activeDevotional.featured ? "Featured Reflection" : "Church Devotional"}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#1C1917] leading-snug">
                        {activeDevotional.title}
                      </h3>
                      <p className="text-xs text-stone-600 mt-2">
                        Shared by <strong className="text-[#1C1917]">{activeDevotional.authorName}</strong>
                        {activeDevotional.authorTitle ? ` · ${activeDevotional.authorTitle}` : ''}
                      </p>
                    </div>

                    {activeDevotional.scriptureText && (
                      <blockquote className="bg-white border border-stone-200 p-5 font-serif italic text-base sm:text-lg text-[#1C1917] leading-relaxed">
                        “{activeDevotional.scriptureText}”
                        <footer className="not-italic font-mono text-xs text-[#9A6B2F] mt-2">
                          — {activeDevotional.scriptureReference}
                        </footer>
                      </blockquote>
                    )}

                    <p className="text-base text-stone-700 leading-relaxed whitespace-pre-line">
                      {activeDevotional.message}
                    </p>

                    {activeDevotional.prayerFocus && (
                      <div className="border-t border-stone-200 pt-4">
                        <p className="text-xs uppercase tracking-[0.15em] text-[#9A6B2F] font-semibold mb-1.5">
                          Prayer Focus
                        </p>
                        <p className="text-sm text-stone-700 leading-relaxed">
                          {activeDevotional.prayerFocus}
                        </p>
                      </div>
                    )}
                  </article>

                  <aside className="lg:col-span-5 bg-[#F3EFE7] border border-stone-200 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                      <h4 className="font-serif text-lg font-medium text-[#1C1917]">
                        Recent Devotionals
                      </h4>
                      <span className="text-xs font-mono tabular-nums text-stone-500">
                        {data.devotionals.length} posted
                      </span>
                    </div>
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {data.devotionals.map((dev) => {
                        const isSelected = dev.id === activeDevotional.id;
                        return (
                          <button
                            key={dev.id}
                            type="button"
                            onClick={() => setSelectedDevotionalId(dev.id)}
                            className={`w-full text-left p-4 border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#1C1917] text-white border-[#1C1917]'
                                : 'bg-white text-[#1C1917] border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            <p className={`text-[11px] font-mono tabular-nums ${isSelected ? 'text-[#E2C28B]' : 'text-stone-500'}`}>
                              {dev.devotionalDate} · {dev.scriptureReference}
                            </p>
                            <p className="font-serif text-base font-medium mt-1">{dev.title}</p>
                            <p className={`text-xs mt-1 ${isSelected ? 'text-stone-300' : 'text-stone-600'}`}>
                              {dev.authorName}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                      <a href="#prayer" className="font-semibold text-[#9A6B2F] hover:underline">
                        Visit Prayer Board →
                      </a>
                      <button
                        type="button"
                        onClick={onOpenAdmin}
                        className="text-stone-600 hover:text-[#1C1917] underline cursor-pointer"
                      >
                        Leader Portal
                      </button>
                    </div>
                  </aside>
                </div>
              );
            })() : (
              <div className="bg-[#FBF9F5] border border-stone-200 p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
                    <BookOpen className="w-4 h-4 text-[#9A6B2F]" />
                    <span>Daily Scripture & Encouragement</span>
                  </div>
                  <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                    No Daily Devotionals Published Yet
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Authorized GVCC pastors and fellowship leaders can post daily Scriptures, short encouraging messages, and prayer focuses from the Church Administration Portal.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="px-5 py-3 bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"
                  >
                    Post as Church Leader
                  </button>
                  <a
                    href="#prayer"
                    className="px-5 py-3 border border-stone-300 text-xs font-semibold text-[#1C1917] hover:bg-stone-100"
                  >
                    Prayer Board
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. Leadership Section */}
        <section id="leadership" className="py-20 bg-[#F3EFE7] border-y border-stone-200">
          <div className="max-w-6xl mx-auto px-6 sm:px-10">
            <div className="max-w-2xl mb-12">
              <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-3">
                Spiritual Oversight
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917]">
                Church Leadership
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {data.leaders.map((leader) => (
                <article key={leader.id} className="bg-white border border-stone-200 overflow-hidden flex flex-col">
                  <div className="aspect-[4/3] bg-stone-200 overflow-hidden">
                    <img
                      src={leader.photoUrl || '/images/church/photo_22.jpg'}
                      alt={leader.fullName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <p className="text-xs text-stone-500 mb-1">
                      {leader.officialTitle}
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{leader.isVerified ? 'Verified Leader' : 'Pending Verification'}</span>
                    </p>
                    <h3 className="font-serif text-2xl font-medium text-[#1C1917] mb-1">
                      {leader.fullName}
                    </h3>
                    <p className="text-xs font-semibold text-[#9A6B2F] mb-4">
                      {leader.ministryPosition}
                    </p>
                    <p className="text-sm text-stone-600 leading-relaxed mb-4 flex-1">
                      {leader.biography}
                    </p>
                    {leader.areasOfMinistry && (
                      <p className="text-xs text-stone-500 border-t border-stone-100 pt-3">
                        Ministry focus: {leader.areasOfMinistry}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Fellowships & Ministries */}
        <section id="fellowships" className="py-20 lg:py-28 max-w-6xl mx-auto px-6 sm:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-3">
                Grow Together
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917]">
                Fellowships & Ministries
              </h2>
            </div>
            <p className="text-sm text-stone-600 max-w-md leading-relaxed">
              Connect with a fellowship group or express interest in serving. Proposed groups awaiting official confirmation by church leadership are clearly labeled.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.fellowships.map((f, idx) => (
              <article key={f.id} className="bg-white border border-stone-200 flex flex-col">
                <div className="aspect-[16/10] bg-stone-200 overflow-hidden">
                  <img
                    src={f.imageUrl || '/images/church/photo_06.jpg'}
                    alt={f.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="text-xs text-stone-500 font-mono tabular-nums mb-1">
                    {String(idx + 1).padStart(2, '0')} · {f.isVerified ? 'Confirmed Fellowship' : 'Proposed Category'}
                  </p>
                  <h3 className="font-serif text-xl font-medium text-[#1C1917] mb-2">{f.name}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed flex-1 mb-4">{f.description}</p>
                  {(f.meetingDay || f.leaderName) && (
                    <p className="text-xs text-stone-500 border-t border-stone-100 pt-2.5 mb-4">
                      {[f.leaderName, f.meetingDay, f.meetingTime].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveFellowship(f)}
                    className="w-full py-2.5 border border-[#1C1917] text-xs font-semibold text-[#1C1917] hover:bg-[#1C1917] hover:text-white transition-colors cursor-pointer"
                  >
                    Join Fellowship
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Ministries Strip */}
          {data.ministries.length > 0 && (
            <div className="mt-14 pt-12 border-t border-stone-200">
              <h3 className="font-serif text-2xl font-medium text-[#1C1917] mb-6">Church Ministries</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {data.ministries.map((m) => (
                  <div key={m.id} className="bg-[#F3EFE7] border border-stone-200 p-5">
                    <p className="text-xs text-stone-500 mb-1">
                      {m.isVerified ? 'Verified Ministry' : 'Proposed Ministry'}
                    </p>
                    <h4 className="font-serif text-lg font-medium text-[#1C1917] mb-2">{m.name}</h4>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">{m.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 5. Church Events Calendar */}
        <section id="events" className="py-20 bg-white border-y border-stone-200">
          <div className="max-w-6xl mx-auto px-6 sm:px-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-3">
                  Church Calendar & Weekly Rhythm
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917]">
                  Church Events
                </h2>
              </div>
              <p className="text-sm text-stone-600 max-w-md">
                Browse upcoming church events, fellowship meetings, and worship service times published by GVCC leadership.
              </p>
            </div>

            <ChurchEventsCalendar
              events={data.events}
              fellowships={data.fellowships}
              settings={settings}
              onSelectEvent={(ev) => setActiveEvent(ev)}
              onSelectFellowship={(f) => setActiveFellowship(f)}
            />
          </div>
        </section>

        {/* 6. News & Updates + Sermons & Spiritual Media */}
        <section id="updates" className="py-20 max-w-6xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* News & Updates */}
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-2">
                Church Life
              </p>
              <h2 className="font-serif text-3xl font-medium text-[#1C1917] mb-6">
                News & Announcements
              </h2>
              {data.news.length === 0 ? (
                <div className="bg-white border border-stone-200 p-7">
                  <img
                    src="/images/church/photo_08.jpg"
                    alt="GVCC Congregation"
                    referrerPolicy="no-referrer"
                    className="w-full h-48 object-cover mb-5"
                  />
                  <h3 className="font-serif text-xl font-medium mb-2">
                    Stay Connected With Your Church Family
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed mb-4">
                    Church notices, pastoral letters, and community updates published by GVCC administrators appear here automatically. Register below to stay informed.
                  </p>
                  <a href="#connect" className="text-xs font-semibold text-[#9A6B2F] hover:underline">
                    Register for church updates →
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.news.map((post) => (
                    <article key={post.id} className="bg-white border border-stone-200 p-5 flex gap-4 items-start">
                      {post.featuredImage && (
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          referrerPolicy="no-referrer"
                          className="w-24 h-24 object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-xs text-stone-500">
                          {post.category} · {new Date(post.publishedAt).toLocaleDateString()}
                        </p>
                        <h3 className="font-serif text-lg font-medium text-[#1C1917] mt-1">{post.title}</h3>
                        <p className="text-sm text-stone-600 line-clamp-2 mt-1">{post.summary}</p>
                        <button
                          type="button"
                          onClick={() => setActivePost(post)}
                          className="text-xs font-semibold text-[#9A6B2F] hover:underline mt-2 cursor-pointer"
                        >
                          Read full update →
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Sermons & Spiritual Media */}
            <div id="sermons">
              <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-2">
                Word & Worship
              </p>
              <h2 className="font-serif text-3xl font-medium text-[#1C1917] mb-6">
                Sermons & Media
              </h2>
              {data.sermons.length === 0 ? (
                <div className="bg-[#1C1917] text-white border border-stone-800 p-7">
                  <img
                    src="/images/church/photo_24.jpg"
                    alt="Bishop Joseph Ondari Gichana preaching at GVCC"
                    referrerPolicy="no-referrer"
                    className="w-full h-48 object-cover object-top mb-5"
                  />
                  <h3 className="font-serif text-xl font-medium mb-2">
                    Sermon Archive Ready for Publishing
                  </h3>
                  <p className="text-sm text-stone-300 leading-relaxed mb-4">
                    Sunday messages, Bible teachings, and worship recordings uploaded by the GVCC Media team will stream directly here with Scripture references and audio/video playback.
                  </p>
                  <a href="#prayer" className="text-xs font-semibold text-[#E2C28B] hover:underline">
                    Share a prayer request →
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.sermons.map((sermon) => (
                    <article key={sermon.id} className="bg-white border border-stone-200 p-5 flex items-center gap-4">
                      <img
                        src={sermon.thumbnailUrl || '/images/church/photo_22.jpg'}
                        alt={sermon.title}
                        referrerPolicy="no-referrer"
                        className="w-24 h-20 object-cover object-top shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-stone-500 truncate">
                          {sermon.category} · {sermon.sermonDate} {sermon.duration ? `· ${sermon.duration}` : ''}
                        </p>
                        <h3 className="font-serif text-lg font-medium text-[#1C1917] truncate">{sermon.title}</h3>
                        <p className="text-xs text-stone-600">{sermon.speaker}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSermon(sermon)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1C1917] text-white text-xs font-medium shrink-0 cursor-pointer"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Listen
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 7. GVCC TV LIVE & CHURCH MEDIA Portal */}
        <ChurchMediaPortal
          tvLiveConfig={settings.tvLiveConfig}
          sermons={data.sermons}
          photos={data.gallery}
          settings={settings}
          onSelectSermon={setActiveSermon}
          portalOpen={mediaPortalOpen}
          onSetPortalOpen={setMediaPortalOpen}
        />

        {/* 7b. Events & Media Masonry Photo Gallery */}
        <GallerySection
          photos={data.gallery}
          onOpenMediaPortal={() => setMediaPortalOpen(true)}
        />

        {/* 8. Prayer Requests Board & Submission */}
        <section id="prayer" className="py-20 lg:py-28 bg-[#1C1917] text-white">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 space-y-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <div className="lg:col-span-5 space-y-5">
                <p className="text-xs uppercase tracking-[0.18em] text-[#E2C28B] font-semibold">
                  Pastoral Care & Intercession
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-medium text-white leading-tight">
                  We Would Love to Pray With You
                </h2>
                <p className="text-base text-stone-300 leading-relaxed">
                  Share your prayer need on the GVCC Community Prayer Board so church members can stand in faith with you, or mark it confidential for private care by Bishop Joseph Ondari Gichana and our prayer team.
                </p>
                <div className="border-t border-white/15 pt-5 space-y-2 text-xs text-stone-400">
                  <p className="flex items-center gap-2 text-stone-200">
                    <ShieldCheck className="w-4 h-4 text-[#E2C28B]" />
                    <span>Your Privacy Choice Is Strictly Respected</span>
                  </p>
                  <p>
                    Requests marked Confidential or Prayer Team Only are never displayed publicly. Public Prayer Board posts never show your phone number or email address.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-7">
                <PrayerRequestForm onPublicBoardSubmitted={refreshPrayerBoard} />
              </div>
            </div>

            {/* Public-Facing Community Prayer Requests Board */}
            <div className="border-t border-white/15 pt-14 space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#E2C28B] font-semibold mb-2">
                    Community Intercession
                  </p>
                  <h3 className="font-serif text-2xl sm:text-3xl font-medium text-white">
                    GVCC Prayer Requests Board
                  </h3>
                  <p className="text-sm text-stone-300 mt-2 max-w-2xl">
                    Stand in agreement with fellow members and friends. Click <strong className="text-white">I’m Praying</strong> to signify your prayer support or leave a brief word of encouragement.
                  </p>
                </div>
                <div className="flex items-center gap-6 text-xs text-stone-300 font-mono tabular-nums shrink-0">
                  <div>
                    <span className="text-stone-400 block uppercase text-[10px]">Active Requests</span>
                    <span className="text-lg text-white font-semibold">{boardPrayers.length}</span>
                  </div>
                  <div className="border-l border-white/15 pl-6">
                    <span className="text-stone-400 block uppercase text-[10px]">Prayers Offered</span>
                    <span className="text-lg text-[#E2C28B] font-semibold">
                      {boardPrayers.reduce((sum, item) => sum + (item.prayerCount || 0), 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-2">
                {[
                  'All',
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
                ].map((cat) => {
                  const active = boardCategoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setBoardCategoryFilter(cat)}
                      className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#B4823E] border-[#B4823E] text-white'
                          : 'border-white/20 text-stone-300 hover:border-white/50 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {boardError && (
                <p className="text-xs text-red-200 bg-red-950/60 border border-red-800 px-4 py-3">
                  {boardError}
                </p>
              )}

              {(() => {
                const visiblePrayers =
                  boardCategoryFilter === 'All'
                    ? boardPrayers
                    : boardPrayers.filter((p) => p.category === boardCategoryFilter);

                if (visiblePrayers.length === 0) {
                  return (
                    <div className="bg-[#25211E] border border-white/15 p-8 sm:p-10 text-center space-y-3">
                      <HeartHandshake className="w-8 h-8 text-[#E2C28B] mx-auto" />
                      <h4 className="font-serif text-xl font-medium text-white">
                        {boardPrayers.length === 0
                          ? 'No Public Prayer Requests Posted Yet'
                          : `No Active Requests in ${boardCategoryFilter}`}
                      </h4>
                      <p className="text-sm text-stone-300 max-w-lg mx-auto">
                        {boardPrayers.length === 0
                          ? 'Be the first to share a prayer need or thanksgiving with the GVCC family using the form above (select “Public Prayer Board”).'
                          : 'Choose another category above or post a new prayer need for the church family to uphold.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {visiblePrayers.map((item) => {
                      const hasPrayed = prayedIds.includes(item.id);
                      const isComposingNote = activeSupportId === item.id;
                      const isSubmitting = prayingId === item.id;

                      return (
                        <article
                          key={item.id}
                          className="bg-[#FBF9F5] text-[#1C1917] border border-stone-700 p-6 flex flex-col justify-between gap-5"
                        >
                          <div className="space-y-3">
                            <p className="text-xs text-stone-500 font-mono tabular-nums">
                              {item.category} · {new Date(item.createdAt).toLocaleDateString()} · {item.referenceNumber}
                              {item.status === 'Answered' ? ' · Answered' : ''}
                            </p>
                            <h4 className="font-serif text-xl font-medium text-[#1C1917]">
                              {item.requesterName || 'Anonymous'}
                            </h4>
                            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                              {item.requestContent}
                            </p>

                            {item.supports && item.supports.some((s) => s.encouragementNote) && (
                              <div className="border-t border-stone-200 pt-3 space-y-2">
                                <p className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                                  Words of Encouragement
                                </p>
                                {item.supports
                                  .filter((s) => s.encouragementNote)
                                  .slice(0, 3)
                                  .map((s) => (
                                    <p key={s.id} className="text-xs text-stone-600 leading-relaxed">
                                      <strong className="text-[#1C1917]">{s.supporterName}:</strong> “{s.encouragementNote}”
                                    </p>
                                  ))}
                              </div>
                            )}
                          </div>

                          <div className="border-t border-stone-200 pt-4 space-y-3">
                            {isComposingNote && !hasPrayed && (
                              <div className="bg-[#F3EFE7] border border-stone-200 p-3 space-y-2.5">
                                <input
                                  value={supportDraft.supporterName}
                                  onChange={(e) =>
                                    setSupportDraft({ ...supportDraft, supporterName: e.target.value })
                                  }
                                  placeholder="Your name (optional, defaults to GVCC Member)"
                                  className="w-full px-3 py-2 bg-white border border-stone-300 text-xs"
                                />
                                <textarea
                                  rows={2}
                                  value={supportDraft.encouragementNote}
                                  onChange={(e) =>
                                    setSupportDraft({ ...supportDraft, encouragementNote: e.target.value })
                                  }
                                  placeholder="Optional short prayer or word of encouragement..."
                                  className="w-full px-3 py-2 bg-white border border-stone-300 text-xs"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSupportId(null);
                                      setSupportDraft({ supporterName: '', encouragementNote: '' });
                                    }}
                                    className="px-3 py-1.5 text-xs text-stone-600 hover:text-[#1C1917] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => handlePrayForRequest(item.id, true)}
                                    className="px-4 py-1.5 bg-[#9A6B2F] hover:bg-[#825824] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                                  >
                                    {isSubmitting ? 'Recording...' : 'Send Prayer & Note'}
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span className="text-xs text-stone-600 font-mono tabular-nums flex items-center gap-1.5">
                                <HeartHandshake className="w-4 h-4 text-[#9A6B2F]" />
                                <span>
                                  {item.prayerCount} {item.prayerCount === 1 ? 'person praying' : 'people praying'}
                                </span>
                              </span>

                              <div className="flex items-center gap-2">
                                {!hasPrayed && !isComposingNote && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSupportId(item.id);
                                      setSupportDraft({ supporterName: '', encouragementNote: '' });
                                    }}
                                    className="px-3 py-2 border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-100 cursor-pointer"
                                  >
                                    Add Note
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={hasPrayed || isSubmitting}
                                  onClick={() => handlePrayForRequest(item.id, false)}
                                  className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-default ${
                                    hasPrayed
                                      ? 'bg-emerald-800 text-white'
                                      : 'bg-[#1C1917] hover:bg-stone-800 text-white'
                                  }`}
                                >
                                  {hasPrayed
                                    ? 'Praying ✓'
                                    : isSubmitting
                                    ? 'Recording...'
                                    : "I'm Praying"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* 8a. Moderated Testimonies & Faith Stories Spotlight */}
        <section id="testimonies-preview" className="py-20 bg-[#FBF9F5] border-b border-stone-200">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-2">
                  Psalm 107:2 · Moderated Faith Stories
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917]">
                  Testimonies of God’s Faithfulness
                </h2>
                <p className="text-sm sm:text-base text-stone-600 max-w-2xl mt-2 leading-relaxed">
                  Read verified stories of answered prayer, healing, provision, and transformation from members—or share how God has worked in your life.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onOpenTestimonies}
                  className="px-5 py-2.5 bg-[#1C1917] hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Open Testimonies Page ({data.testimonies?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenTestimonies();
                    setTimeout(() => {
                      document.getElementById('submit-testimony')?.scrollIntoView({ behavior: 'smooth' });
                    }, 120);
                  }}
                  className="px-5 py-2.5 border border-stone-300 bg-white hover:bg-stone-100 text-[#1C1917] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Share Your Story →
                </button>
              </div>
            </div>

            {data.testimonies && data.testimonies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {data.testimonies.slice(0, 3).map((story) => (
                  <article key={story.id} className="bg-white border border-stone-200 p-6 flex flex-col justify-between gap-4">
                    <div className="space-y-2.5">
                      <p className="text-xs uppercase tracking-wider text-[#9A6B2F] font-semibold">
                        {story.category}
                      </p>
                      <h3 className="font-serif text-xl font-medium text-[#1C1917]">
                        {story.title}
                      </h3>
                      <p className="text-sm text-stone-600 line-clamp-4 leading-relaxed">
                        {story.story}
                      </p>
                    </div>
                    <div className="border-t border-stone-100 pt-3 flex items-center justify-between text-xs text-stone-500">
                      <span className="font-medium text-[#1C1917]">{story.authorName}</span>
                      <button
                        type="button"
                        onClick={onOpenTestimonies}
                        className="font-semibold text-[#9A6B2F] hover:underline cursor-pointer"
                      >
                        Read more →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="bg-[#F3EFE7] border border-stone-200 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1.5 max-w-2xl">
                  <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                    Share How God Has Worked in Your Life
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Every submitted faith story is reviewed by GVCC pastoral leadership before appearing on our public Testimonies page. Be among the first to encourage the congregation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenTestimonies}
                  className="px-5 py-3 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                >
                  Go to Testimonies Page →
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 8a-2. Search-Grounded Study & Member Cloud Sync */}
        <SearchStudySection onOpenGame={onOpenGame} />

        {/* 8b. Secure Tithes & Offerings Stewardship Section */}
        <section id="giving" className="py-20 lg:py-28 bg-[#F3EFE7] border-b border-stone-200">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left: Giving Instructions & Verified Channels */}
              <div className="lg:col-span-6 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-2">
                    Stewardship & Worship Through Giving
                  </p>
                  <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917] leading-tight">
                    Tithes & Offerings
                  </h2>
                  <p className="text-base text-stone-700 leading-relaxed mt-3">
                    Your faithful tithes, offerings, and thanksgiving gifts support the ministry of the Word, pastoral care, fellowship outreach, and church operations at Gracious Voice Celebration Centre, Ogembo.
                  </p>
                </div>

                {/* Stewardship Scripture */}
                <blockquote className="bg-white border border-stone-200 p-5 space-y-2">
                  <p className="font-serif italic text-base text-[#1C1917] leading-relaxed">
                    “{settings.givingConfig?.stewardshipScriptureText || DEFAULT_SETTINGS.givingConfig!.stewardshipScriptureText}”
                  </p>
                  <footer className="font-mono text-xs text-[#9A6B2F]">
                    — {settings.givingConfig?.stewardshipScriptureRef || '2 Corinthians 9:7'}
                  </footer>
                </blockquote>

                {/* Security & Channel Instructions */}
                <div className="bg-white border border-stone-200 p-6 space-y-5">
                  <div className="flex items-start gap-3 border-b border-stone-200 pb-4">
                    <Lock className="w-4 h-4 text-[#9A6B2F] shrink-0 mt-0.5" />
                    <div className="text-xs text-stone-600 leading-relaxed">
                      <p className="font-semibold text-[#1C1917] uppercase tracking-wider mb-1">
                        Verified Giving Channels & Security Notice
                      </p>
                      <p>
                        {settings.givingConfig?.givingNotice || DEFAULT_SETTINGS.givingConfig!.givingNotice}
                      </p>
                    </div>
                  </div>

                  {settings.givingConfig?.givingVerified &&
                  (settings.givingConfig.mpesaPaybill ||
                    settings.givingConfig.mpesaTill ||
                    settings.givingConfig.bankAccountNumber) ? (
                    <div className="space-y-4">
                      {(settings.givingConfig.mpesaPaybill || settings.givingConfig.mpesaTill) && (
                        <div className="bg-[#FBF9F5] border border-stone-200 p-4 space-y-2.5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#9A6B2F]">
                            Mobile Money (M-Pesa)
                          </p>
                          {settings.givingConfig.mpesaPaybill && (
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div>
                                <span className="text-stone-500 text-xs block">Paybill Number</span>
                                <span className="font-mono tabular-nums font-semibold text-[#1C1917]">
                                  {settings.givingConfig.mpesaPaybill}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyGivingValue('paybill', settings.givingConfig!.mpesaPaybill!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 text-xs font-medium text-[#1C1917] hover:bg-stone-100 cursor-pointer"
                              >
                                {copiedKey === 'paybill' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedKey === 'paybill' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          )}
                          {settings.givingConfig.mpesaAccountFormat && (
                            <p className="text-xs text-stone-600">
                              <strong>Account Reference:</strong> {settings.givingConfig.mpesaAccountFormat} (e.g., Tithe, Offering, Thanksgiving)
                            </p>
                          )}
                          {settings.givingConfig.mpesaTill && (
                            <div className="flex items-center justify-between gap-3 text-sm pt-2 border-t border-stone-200">
                              <div>
                                <span className="text-stone-500 text-xs block">Buy Goods Till Number</span>
                                <span className="font-mono tabular-nums font-semibold text-[#1C1917]">
                                  {settings.givingConfig.mpesaTill}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => copyGivingValue('till', settings.givingConfig!.mpesaTill!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 text-xs font-medium text-[#1C1917] hover:bg-stone-100 cursor-pointer"
                              >
                                {copiedKey === 'till' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedKey === 'till' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {settings.givingConfig.bankAccountNumber && (
                        <div className="bg-[#FBF9F5] border border-stone-200 p-4 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#9A6B2F] flex items-center gap-1.5">
                            <Landmark className="w-3.5 h-3.5" />
                            <span>Direct Bank Deposit / Transfer</span>
                          </p>
                          <div className="text-xs text-stone-700 space-y-1">
                            {settings.givingConfig.bankName && (
                              <p><strong>Bank:</strong> {settings.givingConfig.bankName} {settings.givingConfig.bankBranch ? `(${settings.givingConfig.bankBranch})` : ''}</p>
                            )}
                            {settings.givingConfig.bankAccountName && (
                              <p><strong>Account Name:</strong> {settings.givingConfig.bankAccountName}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm pt-1">
                            <div>
                              <span className="text-stone-500 text-xs block">Account Number</span>
                              <span className="font-mono tabular-nums font-semibold text-[#1C1917]">
                                {settings.givingConfig.bankAccountNumber}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyGivingValue('bank', settings.givingConfig!.bankAccountNumber!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 text-xs font-medium text-[#1C1917] hover:bg-stone-100 cursor-pointer"
                            >
                              {copiedKey === 'bank' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedKey === 'bank' ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-[#FBF9F5] border border-stone-200 p-5 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#9A6B2F]">
                        Electronic Giving Channels · Awaiting Leadership Verification
                      </p>
                      <p className="text-sm text-stone-700 leading-relaxed">
                        To safeguard our members, electronic M-Pesa Paybill and Bank Account details are displayed here only once confirmed by church leadership in the Admin Settings panel.
                      </p>
                      <div className="flex flex-wrap gap-3 pt-1">
                        <a
                          href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C1917] text-white text-xs font-semibold"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Call {settings.phone} to Confirm Account
                        </a>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#14532D] text-white text-xs font-semibold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp Church Office
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-stone-600 leading-relaxed border-t border-stone-200 pt-4">
                    <strong className="text-[#1C1917] block mb-1">In-Person Sanctuary Giving</strong>
                    <p>
                      {settings.givingConfig?.inPersonInstructions || DEFAULT_SETTINGS.givingConfig!.inPersonInstructions}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Secure Giving Notification & Stewardship Pledge Form */}
              <div className="lg:col-span-6 bg-white border border-stone-200 p-6 sm:p-8">
                {givingResult ? (
                  <div className="py-8 text-center space-y-4">
                    <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                    <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                      Stewardship Record Received
                    </h3>
                    <p className="text-sm text-stone-600 max-w-md mx-auto">
                      {givingResult.message}
                    </p>
                    <p className="font-mono text-sm bg-[#F3EFE7] px-4 py-2 inline-block">
                      Stewardship Ref: {givingResult.referenceNumber}
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={() => setGivingResult(null)}
                        className="px-5 py-2.5 bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"
                      >
                        Record Another Contribution
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitGiving} className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#9A6B2F] font-semibold">
                        Confidential Stewardship Log
                      </p>
                      <h3 className="font-serif text-2xl font-medium text-[#1C1917] mt-1">
                        Confirm a Contribution or Pledge
                      </h3>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        Already sent a tithe or offering, or planning a pledge? Log your reference privately here for church treasury verification and acknowledgment.
                      </p>
                    </div>

                    {givingError && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-3">{givingError}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Full name (optional)</label>
                        <input
                          value={givingForm.giverName}
                          onChange={(e) => setGivingForm({ ...givingForm, giverName: e.target.value })}
                          placeholder="Anonymous if blank"
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Phone (private)</label>
                        <input
                          type="tel"
                          value={givingForm.phone}
                          onChange={(e) => setGivingForm({ ...givingForm, phone: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Email (private)</label>
                        <input
                          type="email"
                          value={givingForm.email}
                          onChange={(e) => setGivingForm({ ...givingForm, email: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Giving category *</label>
                        <select
                          value={givingForm.givingCategory}
                          onChange={(e) => setGivingForm({ ...givingForm, givingCategory: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm bg-white"
                        >
                          {['Tithe', 'Offering', 'Thanksgiving', 'Building & Development', 'Missions & Welfare', 'Other'].map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Channel / Method *</label>
                        <select
                          value={givingForm.givingMethod}
                          onChange={(e) => setGivingForm({ ...givingForm, givingMethod: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm bg-white"
                        >
                          {['M-Pesa', 'Bank Transfer', 'In-Person / Sanctuary', 'Pledge'].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Amount in KES (optional)</label>
                        <input
                          type="number"
                          min={1}
                          value={givingForm.amountKes}
                          onChange={(e) => setGivingForm({ ...givingForm, amountKes: e.target.value })}
                          placeholder="e.g. 1000"
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">M-Pesa / Bank Ref (optional)</label>
                        <input
                          value={givingForm.transactionReference}
                          onChange={(e) => setGivingForm({ ...givingForm, transactionReference: e.target.value })}
                          placeholder="Transaction confirmation code"
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm font-mono uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Dedication or prayer note (optional)</label>
                      <textarea
                        rows={2}
                        value={givingForm.notes}
                        onChange={(e) => setGivingForm({ ...givingForm, notes: e.target.value })}
                        placeholder="Optional thanksgiving or stewardship note for church leadership..."
                        className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        required
                        checked={givingForm.consent}
                        onChange={(e) => setGivingForm({ ...givingForm, consent: e.target.checked })}
                        className="accent-[#9A6B2F]"
                      />
                      <span>I consent to GVCC storing this stewardship record confidentially for church treasury verification.</span>
                    </label>

                    <button
                      type="submit"
                      disabled={givingLoading}
                      className="w-full py-3 bg-[#1C1917] hover:bg-stone-800 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {givingLoading ? 'Recording Securely...' : 'Submit Confidential Giving Notification'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 9. Connect: Visitor Registration, Member Registration, Contact & Ogembo Map */}
        <section id="connect" className="py-20 lg:py-28 max-w-6xl mx-auto px-6 sm:px-10">
          <div className="max-w-2xl mb-10">
            <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-3">
              Take Your Next Step
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917] mb-3">
              Connect With Gracious Voice Celebration Centre
            </h2>
            <p className="text-base text-stone-600">
              Whether you are planning your first visit to our Ogembo sanctuary, registering as a member, or reaching out to Bishop Joseph Ondari Gichana’s office.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left: Segmented Forms */}
            <div className="lg:col-span-7 bg-white border border-stone-200 p-6 sm:p-8">
              <div className="flex flex-wrap gap-1 p-1 bg-[#F3EFE7] mb-6" role="tablist">
                {[
                  ['visitor', 'Plan a Visit (Visitor)'],
                  ['member', 'Member Registration'],
                  ['contact', 'General Message'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setConnectTab(key as any)}
                    className={`flex-1 py-2 px-3 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      connectTab === key
                        ? 'bg-[#1C1917] text-white'
                        : 'text-stone-700 hover:text-[#1C1917]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Visitor Form */}
              {connectTab === 'visitor' && (
                visitorResult ? (
                  <div className="py-6 text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                    <h3 className="font-serif text-xl font-medium">We Look Forward to Welcoming You</h3>
                    <p className="text-sm text-stone-600">Your visit details have been recorded for our welcoming team.</p>
                    <p className="font-mono text-sm bg-[#F3EFE7] px-3 py-1.5 inline-block">
                      Visitor Ref: {visitorResult}
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={() => setVisitorResult(null)}
                        className="px-4 py-2 bg-[#1C1917] text-white text-xs cursor-pointer"
                      >
                        Register Another Visitor
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitVisitor} className="space-y-4">
                    {visitorError && <p className="text-xs text-red-700 bg-red-50 p-3">{visitorError}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Full name *</label>
                        <input
                          required
                          value={visitorForm.fullName}
                          onChange={(e) => setVisitorForm({ ...visitorForm, fullName: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Phone number *</label>
                        <input
                          required
                          type="tel"
                          value={visitorForm.phone}
                          onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Email (optional)</label>
                        <input
                          type="email"
                          value={visitorForm.email}
                          onChange={(e) => setVisitorForm({ ...visitorForm, email: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Area of residence</label>
                        <input
                          value={visitorForm.residence}
                          onChange={(e) => setVisitorForm({ ...visitorForm, residence: e.target.value })}
                          placeholder="e.g., Ogembo"
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Preferred visit date</label>
                        <input
                          type="date"
                          value={visitorForm.preferredVisitDate}
                          onChange={(e) => setVisitorForm({ ...visitorForm, preferredVisitDate: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Accompanying guests</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={visitorForm.accompanyingCount}
                          onChange={(e) => setVisitorForm({ ...visitorForm, accompanyingCount: Number(e.target.value) })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">How did you hear of us?</label>
                        <input
                          value={visitorForm.visitSource}
                          onChange={(e) => setVisitorForm({ ...visitorForm, visitSource: e.target.value })}
                          placeholder="Friend, family..."
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Any assistance needed?</label>
                      <textarea
                        rows={2}
                        value={visitorForm.assistanceRequest}
                        onChange={(e) => setVisitorForm({ ...visitorForm, assistanceRequest: e.target.value })}
                        placeholder="Directions, prayer, or pastoral welcome..."
                        className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        required
                        checked={visitorForm.consent}
                        onChange={(e) => setVisitorForm({ ...visitorForm, consent: e.target.checked })}
                        className="accent-[#9A6B2F]"
                      />
                      <span>I consent to the GVCC welcoming team contacting me regarding my visit.</span>
                    </label>
                    <button
                      type="submit"
                      disabled={visitorLoading}
                      className="w-full py-3 bg-[#9A6B2F] hover:bg-[#825824] text-white text-sm font-semibold cursor-pointer"
                    >
                      {visitorLoading ? 'Submitting...' : 'Plan My Visit'}
                    </button>
                  </form>
                )
              )}

              {/* Member Registration Form */}
              {connectTab === 'member' && (
                memberResult ? (
                  <div className="py-6 text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                    <h3 className="font-serif text-xl font-medium">Member Registration Complete</h3>
                    <p className="text-sm text-stone-600">Your unique GVCC Member Number has been generated:</p>
                    <p className="font-mono text-base font-medium bg-[#F3EFE7] px-4 py-2 inline-block">
                      {memberResult}
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={() => setMemberResult(null)}
                        className="px-4 py-2 bg-[#1C1917] text-white text-xs cursor-pointer"
                      >
                        Register Another Family Member
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitMember} className="space-y-4">
                    {memberError && <p className="text-xs text-red-700 bg-red-50 p-3">{memberError}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Full name *</label>
                        <input
                          required
                          value={memberForm.fullName}
                          onChange={(e) => setMemberForm({ ...memberForm, fullName: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Phone number *</label>
                        <input
                          required
                          type="tel"
                          value={memberForm.phone}
                          onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Email (optional)</label>
                        <input
                          type="email"
                          value={memberForm.email}
                          onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Town / Area</label>
                        <input
                          value={memberForm.location}
                          onChange={(e) => setMemberForm({ ...memberForm, location: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Membership type</label>
                        <select
                          value={memberForm.membershipType}
                          onChange={(e) => setMemberForm({ ...memberForm, membershipType: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        >
                          <option>New member</option>
                          <option>Existing member</option>
                          <option>Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Preferred fellowship</label>
                        <select
                          value={memberForm.fellowshipId}
                          onChange={(e) => setMemberForm({ ...memberForm, fellowshipId: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        >
                          <option value="">Not sure yet</option>
                          {data.fellowships.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Interested ministry</label>
                        <select
                          value={memberForm.ministryId}
                          onChange={(e) => setMemberForm({ ...memberForm, ministryId: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        >
                          <option value="">None selected</option>
                          {data.ministries.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Short introduction or testimony (optional)</label>
                      <textarea
                        rows={2}
                        value={memberForm.testimony}
                        onChange={(e) => setMemberForm({ ...memberForm, testimony: e.target.value })}
                        className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        required
                        checked={memberForm.consent}
                        onChange={(e) => setMemberForm({ ...memberForm, consent: e.target.checked })}
                        className="accent-[#9A6B2F]"
                      />
                      <span>I consent to GVCC maintaining my member record securely for church care and updates.</span>
                    </label>
                    <button
                      type="submit"
                      disabled={memberLoading}
                      className="w-full py-3 bg-[#1C1917] hover:bg-stone-800 text-white text-sm font-semibold cursor-pointer"
                    >
                      {memberLoading ? 'Registering...' : 'Complete Member Registration'}
                    </button>
                  </form>
                )
              )}

              {/* General Contact Form */}
              {connectTab === 'contact' && (
                contactResult ? (
                  <div className="py-6 text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                    <h3 className="font-serif text-xl font-medium">Message Sent to Church Office</h3>
                    <p className="font-mono text-sm bg-[#F3EFE7] px-3 py-1.5 inline-block">
                      Ref: {contactResult}
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={() => setContactResult(null)}
                        className="px-4 py-2 bg-[#1C1917] text-white text-xs cursor-pointer"
                      >
                        Send Another Message
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitContact} className="space-y-4">
                    {contactError && <p className="text-xs text-red-700 bg-red-50 p-3">{contactError}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Full name *</label>
                        <input
                          required
                          value={contactForm.fullName}
                          onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Subject *</label>
                      <input
                        required
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                        className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">Message *</label>
                      <textarea
                        required
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={contactLoading}
                      className="w-full py-3 bg-[#1C1917] text-white text-sm font-semibold cursor-pointer"
                    >
                      {contactLoading ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                )
              )}
            </div>

            {/* Right: Direct Contact, WhatsApp & Ogembo Map */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#F3EFE7] border border-stone-200 p-6 sm:p-7 space-y-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[#9A6B2F] font-semibold">
                  Verified Church Contact
                </p>
                <h3 className="font-serif text-2xl font-medium text-[#1C1917]">{settings.churchName}</h3>
                <div className="text-sm text-stone-700 space-y-2 border-y border-stone-200 py-4">
                  <p><strong>Location:</strong> {settings.location}</p>
                  <p><strong>Church Leadership:</strong> {settings.leadPastor}</p>
                  <p>
                    <strong>Phone:</strong>{' '}
                    <a href={`tel:${settings.phone.replace(/\s+/g, '')}`} className="font-mono underline">
                      {settings.phone}
                    </a>
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1C1917] text-white text-xs font-semibold"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call Church Office
                  </a>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#14532D] text-white text-xs font-semibold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp GVCC
                  </a>
                </div>
              </div>

              {/* Ogembo Location Map */}
              <div className="bg-white border border-stone-200 overflow-hidden">
                <div className="aspect-[16/10] w-full bg-stone-100">
                  <iframe
                    title="Ogembo, Kenya Map"
                    className="w-full h-full border-0"
                    loading="lazy"
                    src="https://www.openstreetmap.org/export/embed.html?bbox=34.710%2C-0.815%2C34.745%2C-0.785&layer=mapnik"
                  />
                </div>
                <div className="p-4 text-xs text-stone-600 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#9A6B2F] shrink-0 mt-0.5" />
                  <span>{settings.mapNotice}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#141210] text-stone-300 border-t border-stone-800">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <p className="font-serif text-xl font-medium text-white mb-2">
              {settings.shortName} · {settings.churchName}
            </p>
            <p className="text-sm text-stone-400 leading-relaxed">{settings.footerTagline}</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-white font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#about" className="hover:text-white">About Us</a></li>
              <li><a href="#devotional" className="hover:text-white">Daily Devotional</a></li>
              <li><a href="#leadership" className="hover:text-white">Leadership</a></li>
              <li><a href="#fellowships" className="hover:text-white">Fellowships</a></li>
              <li><a href="#events" className="hover:text-white">Church Events</a></li>
              <li><a href="#media" className="hover:text-white">GVCC TV LIVE · Church Media</a></li>
              <li><a href="#gallery" className="hover:text-white">Events &amp; Media Gallery</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-white font-semibold mb-3">Connect</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#prayer" className="hover:text-white">Prayer Request</a></li>
              <li>
                <button type="button" onClick={onOpenTestimonies} className="hover:text-white cursor-pointer">
                  Testimonies
                </button>
              </li>
              <li><a href="#study" className="hover:text-white">Bible Study &amp; Search</a></li>
              <li>
                <button type="button" onClick={onOpenGame} className="hover:text-white cursor-pointer">
                  Shepherd&apos;s Light 2D Game
                </button>
              </li>
              <li><a href="#giving" className="hover:text-white">Tithes &amp; Offerings</a></li>
              <li><a href="#connect" className="hover:text-white">Join Us / Plan a Visit</a></li>
              <li><a href={`tel:${settings.phone.replace(/\s+/g, '')}`} className="hover:text-white font-mono">{settings.phone}</a></li>
              <li><a href={whatsappUrl} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-white font-semibold mb-3">Church Office</h4>
            <p className="text-sm text-stone-400">{settings.location}</p>
            <p className="text-sm text-stone-400 mt-1">{settings.leadPastor}</p>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#E2C28B] hover:underline cursor-pointer"
            >
              Church Administration Portal →
            </button>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 px-6 text-center text-xs text-stone-500 space-y-1.5">
          <p>© {new Date().getFullYear()} {settings.churchName}. All rights reserved.</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400 font-medium">
            DEVELOPED AND MAINTAINED BY MOSOMI CHACHA of NAYO TV AFRICA
          </p>
        </div>
      </footer>

      {/* Interactive Modals */}
      <FellowshipJoinModal fellowship={activeFellowship} onClose={() => setActiveFellowship(null)} />
      <EventDetailModal event={activeEvent} onClose={() => setActiveEvent(null)} />
      <NewsArticleModal post={activePost} onClose={() => setActivePost(null)} />
      <SermonPlayerModal sermon={activeSermon} onClose={() => setActiveSermon(null)} />
    </div>
  );
};
