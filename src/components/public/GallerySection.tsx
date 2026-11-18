import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Tv,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MediaAsset } from '../../types/church';

interface GallerySectionProps {
  photos: MediaAsset[];
  onOpenMediaPortal?: () => void;
}

const ORDERED_CATEGORIES = [
  'All',
  'Baptisms',
  'Church services',
  'Worship',
  'Preaching',
  'Congregation',
  'Fellowship',
  'Church activities',
];

export const GallerySection: React.FC<GallerySectionProps> = ({
  photos,
  onOpenMediaPortal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [visibleCount, setVisibleCount] = useState(16);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const dynamicCategories = Array.from(new Set(photos.map((p) => p.category)));
  const categories = [
    ...ORDERED_CATEGORIES.filter(
      (cat) => cat === 'All' || cat === 'Baptisms' || dynamicCategories.includes(cat)
    ),
    ...dynamicCategories.filter((cat) => !ORDERED_CATEGORIES.includes(cat)),
  ];

  const categoryCounts = photos.reduce<Record<string, number>>((acc, photo) => {
    acc[photo.category] = (acc[photo.category] || 0) + 1;
    return acc;
  }, {});

  const filtered =
    selectedCategory === 'All'
      ? photos
      : photos.filter((p) => p.category === selectedCategory);

  const visiblePhotos = filtered.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(16);
  }, [selectedCategory]);

  useEffect(() => {
    if (lightboxIndex === null) {
      setSlideshowPlaying(false);
      setZoomed(false);
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((i) => (i === null ? null : (i + 1) % filtered.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((i) =>
          i === null ? null : (i - 1 + filtered.length) % filtered.length
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, filtered.length]);

  useEffect(() => {
    if (!slideshowPlaying || lightboxIndex === null || filtered.length <= 1) return;
    const timer = window.setInterval(() => {
      setLightboxIndex((i) => (i === null ? null : (i + 1) % filtered.length));
    }, 4500);
    return () => window.clearInterval(timer);
  }, [slideshowPlaying, lightboxIndex, filtered.length]);

  const activePhoto = lightboxIndex !== null ? filtered[lightboxIndex] : null;

  return (
    <section id="gallery" className="py-20 lg:py-28 bg-[#F3EFE7] border-t border-stone-200">
      <div className="max-w-6xl mx-auto px-6 sm:px-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold mb-3">
              Events &amp; Media · {photos.length} Photographs
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1917]">
              Events &amp; Media Gallery
            </h2>
          </div>
          <div className="flex flex-col sm:items-end gap-3">
            <p className="text-sm sm:text-base text-stone-600 max-w-md leading-relaxed">
              Moments from past church services, water baptisms, choir worship, preaching, and fellowship gatherings at GVCC Ogembo.
            </p>
            {onOpenMediaPortal && (
              <button
                type="button"
                onClick={onOpenMediaPortal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C1917] text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer self-start sm:self-end"
              >
                <Tv className="w-3.5 h-3.5 text-[#E2C28B]" />
                <span>Open CHURCH MEDIA Portal</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-4 border-b border-stone-200">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            const count = cat === 'All' ? photos.length : categoryCounts[cat] || 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                  active
                    ? 'bg-[#1C1917] text-white'
                    : 'bg-white/80 text-stone-700 hover:bg-white border border-stone-200'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    active ? 'text-[#E2C28B]' : 'text-stone-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* True Responsive CSS Multi-Column Masonry Grid */}
        {visiblePhotos.length === 0 ? (
          <div className="bg-white border border-stone-200 p-10 text-center max-w-2xl mx-auto space-y-4">
            <Camera className="w-8 h-8 text-[#9A6B2F] mx-auto" />
            <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
              No {selectedCategory} Photographs Tagged Yet
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              {selectedCategory === 'Baptisms'
                ? 'Photographs from water baptism services will appear automatically in this masonry gallery as soon as the GVCC Media team uploads or tags baptism photos in the Admin Gallery & Media library.'
                : 'No photographs are currently published in this category.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('All')}
                className="px-5 py-2.5 bg-[#1C1917] text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                Browse All Church Services &amp; Events ({photos.length})
              </button>
            </div>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 sm:gap-5">
            {visiblePhotos.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className="break-inside-avoid mb-4 sm:mb-5 w-full block group relative overflow-hidden bg-stone-200 border border-stone-200 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A6B2F]"
              >
                <img
                  src={photo.storagePath}
                  alt={photo.altText || photo.caption || 'GVCC church photo'}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto block object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="bg-white border-t border-stone-200 px-3.5 py-2.5 flex items-center justify-between gap-2 sm:hidden">
                  <span className="text-[11px] uppercase tracking-wider text-[#9A6B2F] font-semibold">
                    {photo.category}
                  </span>
                  <span className="text-xs text-stone-600 truncate">
                    {photo.caption || 'GVCC Ogembo'}
                  </span>
                </div>
                <div className="hidden sm:flex absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-col justify-end p-4">
                  <span className="text-[11px] uppercase tracking-wider text-[#E2C28B]">
                    {photo.category}
                  </span>
                  <p className="text-xs sm:text-sm text-white line-clamp-2 mt-0.5">
                    {photo.caption || 'Gracious Voice Celebration Centre, Ogembo'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Load More / Show All */}
        {visibleCount < filtered.length && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 16)}
              className="px-6 py-3 text-sm font-medium border border-[#1C1917] text-[#1C1917] hover:bg-[#1C1917] hover:text-white transition-colors cursor-pointer"
            >
              Load More Photos ({filtered.length - visibleCount} remaining)
            </button>
            <button
              type="button"
              onClick={() => setVisibleCount(filtered.length)}
              className="px-6 py-3 text-sm font-medium text-stone-700 hover:text-[#1C1917] underline underline-offset-4 cursor-pointer"
            >
              View All {filtered.length} Photos
            </button>
          </div>
        )}
      </div>

      {/* Interactive Lightbox Modal */}
      {activePhoto && lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Church photograph viewer"
          className="fixed inset-0 z-50 bg-black/92 flex flex-col justify-between p-4 sm:p-6"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const delta =
              (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
            if (Math.abs(delta) > 45) {
              setLightboxIndex((i) =>
                i === null
                  ? null
                  : delta > 0
                  ? (i - 1 + filtered.length) % filtered.length
                  : (i + 1) % filtered.length
              );
            }
            touchStartX.current = null;
          }}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between text-white gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs sm:text-sm font-mono tabular-nums text-stone-300">
              {lightboxIndex + 1} of {filtered.length}
              <span className="mx-2 text-white/30">·</span>
              <span className="font-sans text-stone-200">{activePhoto.category}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
                className="h-10 px-3 flex items-center gap-1.5 border border-white/25 text-xs text-white hover:bg-white/10 cursor-pointer"
              >
                {zoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                <span className="hidden sm:inline">{zoomed ? 'Reset Zoom' : 'Zoom'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSlideshowPlaying((p) => !p)}
                aria-label={slideshowPlaying ? 'Pause slideshow' : 'Play slideshow'}
                className="h-10 px-3 flex items-center gap-1.5 border border-white/25 text-xs text-white hover:bg-white/10 cursor-pointer"
              >
                {slideshowPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {slideshowPlaying ? 'Pause' : 'Slideshow'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Close lightbox"
                className="h-10 w-10 flex items-center justify-center border border-white/25 text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Photo */}
          <div
            className="relative flex-1 flex items-center justify-center overflow-auto my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((i) =>
                  i === null ? null : (i - 1 + filtered.length) % filtered.length
                )
              }
              aria-label="Previous photo"
              className="hidden sm:flex absolute left-2 z-10 h-11 w-11 items-center justify-center bg-black/60 border border-white/25 text-white hover:bg-black/90 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <img
              src={activePhoto.storagePath}
              alt={activePhoto.altText || activePhoto.caption || 'GVCC photo'}
              referrerPolicy="no-referrer"
              onClick={() => setZoomed((z) => !z)}
              className={`max-h-[75vh] object-contain transition-transform duration-300 cursor-zoom-in ${
                zoomed ? 'scale-150 cursor-zoom-out' : 'scale-100'
              }`}
            />

            <button
              type="button"
              onClick={() =>
                setLightboxIndex((i) => (i === null ? null : (i + 1) % filtered.length))
              }
              aria-label="Next photo"
              className="hidden sm:flex absolute right-2 z-10 h-11 w-11 items-center justify-center bg-black/60 border border-white/25 text-white hover:bg-black/90 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Caption & Mobile Controls */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left border-t border-white/15 pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-stone-200 max-w-2xl">
              {activePhoto.caption || 'Gracious Voice Celebration Centre — Ogembo, Kenya'}
            </p>
            <div className="flex sm:hidden items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((i) =>
                    i === null ? null : (i - 1 + filtered.length) % filtered.length
                  )
                }
                className="px-4 py-2 border border-white/25 text-white text-xs"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((i) => (i === null ? null : (i + 1) % filtered.length))
                }
                className="px-4 py-2 border border-white/25 text-white text-xs"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
