import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  ExternalLink,
  Film,
  HeartHandshake,
  Image as ImageIcon,
  Landmark,
  Maximize2,
  Phone,
  PlayCircle,
  Radio,
  Tv,
  X,
} from 'lucide-react';
import {
  ChurchSettings,
  MediaAsset,
  Sermon,
  TvLiveConfig,
} from '../../types/church';

interface ChurchMediaPortalProps {
  tvLiveConfig?: TvLiveConfig;
  sermons: Sermon[];
  photos: MediaAsset[];
  settings: ChurchSettings;
  onSelectSermon: (sermon: Sermon) => void;
  portalOpen: boolean;
  onSetPortalOpen: (open: boolean) => void;
}

type PortalTab = 'live' | 'sermons' | 'gallery';

interface ResolvedBroadcast {
  type: 'iframe' | 'video' | 'external' | 'none';
  src?: string;
}

function resolveBroadcastStream(rawUrl?: string): ResolvedBroadcast {
  const url = (rawUrl || '').trim();
  if (!url) return { type: 'none' };

  // Direct HTML5 media files
  if (/\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(url)) {
    return { type: 'video', src: url };
  }

  // YouTube watch / live / shorts / youtu.be / embed
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch?.[1]) {
    return {
      type: 'iframe',
      src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`,
    };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch?.[1]) {
    return {
      type: 'iframe',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  // Facebook video/live
  if (url.includes('facebook.com/')) {
    return {
      type: 'iframe',
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
    };
  }

  return { type: 'external', src: url };
}

export const ChurchMediaPortal: React.FC<ChurchMediaPortalProps> = ({
  tvLiveConfig,
  sermons,
  photos,
  settings,
  onSelectSermon,
  portalOpen,
  onSetPortalOpen,
}) => {
  const [activeTab, setActiveTab] = useState<PortalTab>('live');
  const [sermonTopicFilter, setSermonTopicFilter] = useState<string>('All');

  const config: TvLiveConfig = {
    isLive: false,
    channelName: 'GVCC TV LIVE',
    streamTitle: 'Sunday Celebration & Word Service — GVCC Ogembo',
    streamSpeaker: settings.leadPastor || 'Bishop Joseph Ondari Gichana',
    streamUrl: '',
    scheduleNote:
      'Live sanctuary broadcasts stream on GVCC TV LIVE when activated by the Church Media team in Website Settings.',
    description:
      'Watch live services, worship gatherings, and special broadcasts from Gracious Voice Celebration Centre in Ogembo through the official Church Media Portal.',
    ...(tvLiveConfig || {}),
  };

  const resolvedStream = useMemo(
    () => resolveBroadcastStream(config.streamUrl),
    [config.streamUrl]
  );

  const isStreamReady = resolvedStream.type !== 'none';
  const isBroadcastActive = Boolean(config.isLive && isStreamReady);

  const sermonTopics = useMemo(
    () => ['All', ...Array.from(new Set(sermons.map((s) => s.category)))],
    [sermons]
  );

  const filteredSermons = useMemo(
    () =>
      sermonTopicFilter === 'All'
        ? sermons
        : sermons.filter((s) => s.category === sermonTopicFilter),
    [sermons, sermonTopicFilter]
  );

  const highlightPhotos = useMemo(() => {
    const baptismPhotos = photos.filter((p) => p.category === 'Baptisms');
    const featured = photos.filter((p) => p.featured);
    const merged = [...baptismPhotos, ...featured, ...photos];
    const seen = new Set<number>();
    return merged
      .filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .slice(0, 8);
  }, [photos]);

  const renderBroadcastStage = (isFullscreenPortal: boolean) => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left: Video / Live Broadcast Stage */}
      <div className="lg:col-span-8 bg-[#0A0908] border border-stone-800 overflow-hidden">
        {/* Top Broadcast Control Strip */}
        <div className="px-4 py-3 border-b border-stone-800 bg-[#141210] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.16em] font-semibold ${
                isBroadcastActive
                  ? 'bg-[#B91C1C] text-white'
                  : 'bg-stone-800 text-[#E2C28B] border border-stone-700'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isBroadcastActive ? 'ON AIR' : 'STANDBY'}</span>
            </span>
            <span className="text-xs font-semibold tracking-wide text-stone-200 uppercase">
              {config.channelName || 'GVCC TV LIVE'}
            </span>
          </div>
          <span className="text-xs text-stone-400">
            {settings.churchName} · {settings.location}
          </span>
        </div>

        {/* 16:9 Stage Viewport */}
        {isStreamReady && (config.isLive || resolvedStream.type !== 'none') && config.isLive ? (
          resolvedStream.type === 'iframe' ? (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={resolvedStream.src}
                title={config.streamTitle || 'GVCC TV LIVE Broadcast'}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : resolvedStream.type === 'video' ? (
            <div className="aspect-video w-full bg-black">
              <video
                src={resolvedStream.src}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="aspect-video w-full relative bg-[#11100E] flex flex-col items-center justify-center p-8 text-center">
              <img
                src="/images/church/photo_24.jpg"
                alt="GVCC TV LIVE Sanctuary Broadcast"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-top opacity-35"
              />
              <div className="relative z-10 max-w-lg space-y-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#B91C1C] text-white text-xs font-mono uppercase tracking-wider">
                  <Radio className="w-3.5 h-3.5" />
                  Live Stream Active
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl text-white">
                  {config.streamTitle}
                </h3>
                <a
                  href={resolvedStream.src}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold transition-colors"
                >
                  <span>Watch GVCC TV LIVE Stream</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )
        ) : (
          <div className="aspect-video w-full relative bg-[#11100E] flex items-end overflow-hidden">
            <img
              src="/images/church/photo_24.jpg"
              alt="Bishop Joseph Ondari Gichana ministering at GVCC Ogembo"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover object-top opacity-45"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0908] via-[#0A0908]/65 to-black/30" />

            <div className="relative z-10 w-full p-6 sm:p-8 space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#E2C28B] uppercase tracking-[0.16em] font-semibold">
                <Tv className="w-4 h-4" />
                <span>GVCC TV LIVE · Broadcast Ready</span>
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl text-white leading-tight max-w-2xl">
                {config.streamTitle}
              </h3>
              <p className="text-sm text-stone-300 max-w-2xl leading-relaxed">
                {config.scheduleNote ||
                  'Live sanctuary broadcasts stream here automatically when activated by the GVCC Church Media team.'}
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('sermons')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Browse Past Sermons ({sermons.length})</span>
                </button>
                <a
                  href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/25 bg-black/40 hover:bg-white/10 text-white text-xs font-semibold transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Church Office: {settings.phone}</span>
                </a>
                {!isFullscreenPortal && (
                  <button
                    type="button"
                    onClick={() => onSetPortalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-stone-600 text-stone-200 hover:text-white hover:border-stone-400 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Expand CHURCH MEDIA Portal</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Broadcast Metadata Bar */}
        <div className="p-5 sm:p-6 bg-[#141210] border-t border-stone-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-serif text-xl text-white">{config.streamTitle}</h4>
              <p className="text-xs text-stone-400 mt-0.5">
                Ministering: {config.streamSpeaker || settings.leadPastor}
              </p>
            </div>
            {isStreamReady && config.isLive && config.streamUrl && (
              <a
                href={config.streamUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-700 text-xs text-stone-200 hover:bg-stone-800"
              >
                <span>Open Direct Stream</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          {config.description && (
            <p className="text-sm text-stone-300 leading-relaxed pt-1">{config.description}</p>
          )}
        </div>
      </div>

      {/* Right: Live Service Companion & Portal Directory */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-[#1B1917] border border-stone-800 p-6 space-y-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[#E2C28B] font-semibold">
            CHURCH MEDIA Companion
          </p>
          <h3 className="font-serif text-xl text-white">
            Worship With Us From Anywhere
          </h3>
          <p className="text-xs text-stone-300 leading-relaxed">
            Whether joining sanctuary worship in Ogembo or tuning in online via GVCC TV LIVE, submit prayer requests or record your stewardship securely.
          </p>

          <div className="space-y-2.5 pt-1">
            <a
              href="#prayer"
              onClick={() => isFullscreenPortal && onSetPortalOpen(false)}
              className="flex items-center justify-between p-3 bg-[#141210] border border-stone-800 hover:border-[#9A6B2F] text-xs text-stone-100 transition-colors"
            >
              <span className="flex items-center gap-2.5 font-medium">
                <HeartHandshake className="w-4 h-4 text-[#E2C28B]" />
                <span>Send Live Service Prayer Need</span>
              </span>
              <span className="text-[#E2C28B]">→</span>
            </a>
            <a
              href="#giving"
              onClick={() => isFullscreenPortal && onSetPortalOpen(false)}
              className="flex items-center justify-between p-3 bg-[#141210] border border-stone-800 hover:border-[#9A6B2F] text-xs text-stone-100 transition-colors"
            >
              <span className="flex items-center gap-2.5 font-medium">
                <Landmark className="w-4 h-4 text-[#E2C28B]" />
                <span>Tithes &amp; Offerings Guide</span>
              </span>
              <span className="text-[#E2C28B]">→</span>
            </a>
            <a
              href="#events"
              onClick={() => isFullscreenPortal && onSetPortalOpen(false)}
              className="flex items-center justify-between p-3 bg-[#141210] border border-stone-800 hover:border-[#9A6B2F] text-xs text-stone-100 transition-colors"
            >
              <span className="flex items-center gap-2.5 font-medium">
                <Calendar className="w-4 h-4 text-[#E2C28B]" />
                <span>Church Events Calendar</span>
              </span>
              <span className="text-[#E2C28B]">→</span>
            </a>
          </div>
        </div>

        {/* Service Schedule Box inside Church Media Portal */}
        <div className="bg-[#1B1917] border border-stone-800 p-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[#E2C28B] font-semibold">
            Sanctuary Schedule
          </p>
          {settings.serviceScheduleVerified && settings.serviceTimes.length > 0 ? (
            <ul className="space-y-2 text-xs text-stone-300">
              {settings.serviceTimes.map((item, idx) => (
                <li
                  key={idx}
                  className="flex justify-between gap-3 border-b border-stone-800 pb-2 last:border-b-0 last:pb-0"
                >
                  <span>
                    <strong className="text-white block">{item.title}</strong>
                    <span className="text-stone-400">{item.day}</span>
                  </span>
                  <span className="font-mono text-[#E2C28B] shrink-0">{item.time}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-300 leading-relaxed">
              {settings.serviceScheduleNotice}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderSermonsLibrary = (isFullscreenPortal: boolean) => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div>
          <h3 className="font-serif text-2xl text-white">
            Sermons &amp; Teaching Topics
          </h3>
          <p className="text-xs text-stone-400 mt-1">
            Browse recorded sermons and Word studies published by GVCC Ogembo.
          </p>
        </div>
        {sermonTopics.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {sermonTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setSermonTopicFilter(topic)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  sermonTopicFilter === topic
                    ? 'bg-[#B4823E] text-white'
                    : 'bg-[#1B1917] text-stone-300 border border-stone-700 hover:text-white'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredSermons.length === 0 ? (
        <div className="bg-[#1B1917] border border-stone-800 p-8 text-center space-y-4">
          <BookOpen className="w-8 h-8 text-[#E2C28B] mx-auto" />
          <h4 className="font-serif text-xl text-white">
            Sermon Archive Ready for Publishing
          </h4>
          <p className="text-sm text-stone-300 max-w-lg mx-auto leading-relaxed">
            Past Sunday sermons, midweek Bible teachings, and video/audio messages published by the GVCC Media team in Admin Sermons &amp; Media appear directly in this portal.
          </p>
          {isFullscreenPortal && (
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className="px-4 py-2 bg-[#B4823E] text-white text-xs font-semibold cursor-pointer"
            >
              Return to GVCC TV LIVE
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSermons.map((sermon) => (
            <article
              key={sermon.id}
              className="bg-[#1B1917] border border-stone-800 flex flex-col justify-between overflow-hidden"
            >
              <div>
                <div className="relative h-44 bg-black overflow-hidden">
                  <img
                    src={sermon.thumbnailUrl || '/images/church/photo_22.jpg'}
                    alt={sermon.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 border border-white/15 text-[11px] text-[#E2C28B] uppercase tracking-wider">
                    {sermon.category}
                  </span>
                </div>
                <div className="p-5 space-y-2">
                  <p className="text-xs font-mono text-stone-400">
                    {sermon.sermonDate}
                    {sermon.scriptureReference ? ` · ${sermon.scriptureReference}` : ''}
                    {sermon.duration ? ` · ${sermon.duration}` : ''}
                  </p>
                  <h4 className="font-serif text-xl text-white leading-snug">
                    {sermon.title}
                  </h4>
                  <p className="text-xs text-[#E2C28B] font-medium">{sermon.speaker}</p>
                  <p className="text-xs text-stone-300 line-clamp-3 leading-relaxed">
                    {sermon.description}
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectSermon(sermon)}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Watch / Listen Now</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );

  const renderGalleryHighlights = (isFullscreenPortal: boolean) => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div>
          <h3 className="font-serif text-2xl text-white">
            Services &amp; Baptism Photo Highlights
          </h3>
          <p className="text-xs text-stone-400 mt-1">
            Preview highlights from GVCC church services, baptisms, and worship. Explore all {photos.length} photos in the Events &amp; Media masonry gallery.
          </p>
        </div>
        <a
          href="#gallery"
          onClick={() => isFullscreenPortal && onSetPortalOpen(false)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Open Full Masonry Gallery ({photos.length})</span>
        </a>
      </div>

      <div className="columns-2 sm:columns-3 lg:columns-4 gap-4">
        {highlightPhotos.map((photo) => (
          <a
            key={photo.id}
            href="#gallery"
            onClick={() => isFullscreenPortal && onSetPortalOpen(false)}
            className="break-inside-avoid mb-4 block group relative overflow-hidden border border-stone-800 bg-black"
          >
            <img
              src={photo.storagePath}
              alt={photo.altText || photo.caption || 'GVCC photo highlight'}
              referrerPolicy="no-referrer"
              className="w-full h-auto block object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <div className="p-2.5 bg-[#1B1917] border-t border-stone-800">
              <p className="text-[11px] uppercase tracking-wider text-[#E2C28B]">
                {photo.category}
              </p>
              <p className="text-xs text-stone-200 line-clamp-1 mt-0.5">
                {photo.caption || 'GVCC Ogembo'}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <section
        id="media"
        className="py-20 lg:py-28 bg-[#141210] text-stone-100 border-t border-stone-800"
      >
        <div id="gvcc-tv" className="max-w-6xl mx-auto px-6 sm:px-10 space-y-10">
          {/* Header Row */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-stone-800 pb-8">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#E2C28B] font-semibold">
                  CHURCH MEDIA PORTAL · {settings.location}
                </p>
                <span
                  className={`px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider ${
                    isBroadcastActive
                      ? 'bg-[#B91C1C] text-white'
                      : 'bg-stone-800 text-stone-300 border border-stone-700'
                  }`}
                >
                  {isBroadcastActive ? 'GVCC TV LIVE · ON AIR' : 'GVCC TV LIVE · READY'}
                </span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium text-white">
                GVCC TV LIVE &amp; Church Media
              </h2>
              <p className="text-sm sm:text-base text-stone-300 max-w-2xl leading-relaxed">
                Your central digital sanctuary for live church broadcasts, recorded sermons by teaching topic, and Events &amp; Media photography.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onSetPortalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Tv className="w-4 h-4" />
                <span>Launch CHURCH MEDIA Portal</span>
              </button>
            </div>
          </div>

          {/* CHURCH MEDIA Portal Tab Switcher */}
          <div
            className="flex flex-wrap items-center gap-2 bg-[#1B1917] border border-stone-800 p-1.5"
            role="tablist"
            aria-label="CHURCH MEDIA Portal sections"
          >
            {[
              { id: 'live' as PortalTab, label: 'GVCC TV LIVE', icon: <Radio className="w-4 h-4" /> },
              {
                id: 'sermons' as PortalTab,
                label: `Sermon Archive (${sermons.length})`,
                icon: <Film className="w-4 h-4" />,
              },
              {
                id: 'gallery' as PortalTab,
                label: `Media Highlights (${photos.length})`,
                icon: <ImageIcon className="w-4 h-4" />,
              },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#B4823E] text-white'
                      : 'text-stone-300 hover:text-white hover:bg-stone-800/70'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Portal Tab Panels */}
          <div>
            {activeTab === 'live' && renderBroadcastStage(false)}
            {activeTab === 'sermons' && renderSermonsLibrary(false)}
            {activeTab === 'gallery' && renderGalleryHighlights(false)}
          </div>
        </div>
      </section>

      {/* Expanded Full-Screen CHURCH MEDIA Portal Workspace Modal */}
      {portalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="GVCC CHURCH MEDIA Portal"
          className="fixed inset-0 z-50 bg-[#0B0A09]/98 text-stone-100 flex flex-col overflow-hidden"
        >
          {/* Portal Top Bar */}
          <div className="border-b border-stone-800 bg-[#141210] px-6 sm:px-10 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-white font-serif text-xl font-semibold">
                <Tv className="w-5 h-5 text-[#E2C28B]" />
                <span>CHURCH MEDIA Portal</span>
              </div>
              <span
                className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider ${
                  isBroadcastActive
                    ? 'bg-[#B91C1C] text-white'
                    : 'bg-stone-800 text-[#E2C28B] border border-stone-700'
                }`}
              >
                {isBroadcastActive ? 'GVCC TV LIVE · ON AIR' : 'GVCC TV LIVE · STANDBY'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {[
                { id: 'live' as PortalTab, label: 'GVCC TV LIVE' },
                { id: 'sermons' as PortalTab, label: `Sermons (${sermons.length})` },
                { id: 'gallery' as PortalTab, label: `Events & Media (${photos.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#B4823E] text-white'
                      : 'border border-stone-700 text-stone-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onSetPortalOpen(false)}
                aria-label="Close CHURCH MEDIA Portal"
                className="ml-2 h-9 w-9 flex items-center justify-center border border-stone-700 text-stone-300 hover:text-white hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Portal Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-8">
            <div className="max-w-6xl mx-auto">
              {activeTab === 'live' && renderBroadcastStage(true)}
              {activeTab === 'sermons' && renderSermonsLibrary(true)}
              {activeTab === 'gallery' && renderGalleryHighlights(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
