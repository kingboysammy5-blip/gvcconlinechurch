import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { HomepageSlide } from '../../types/church';

interface HeroSlideshowProps {
  slides: HomepageSlide[];
  churchLocation: string;
}

export const HeroSlideshow: React.FC<HeroSlideshowProps> = ({ slides, churchLocation }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const activeSlides = slides.length > 0 ? slides : [
    {
      id: 0,
      imageUrl: '/images/church/photo_00.jpg',
      eyebrow: 'Gracious Voice Celebration Centre',
      heading: 'A Place Where Faith Comes Alive',
      subtitle: 'Discover hope, experience God’s presence, and grow in faith with a community committed to the Word.',
      scriptureReference: 'Psalm 122:1',
      buttonLabel: 'Plan Your Visit',
      buttonUrl: '#connect',
      objectPosition: '50% 22%',
      displayOrder: 1,
      durationSeconds: 7,
      active: true,
    },
  ];

  const safeIndex = index % activeSlides.length;
  const current = activeSlides[safeIndex];

  useEffect(() => {
    if (paused || activeSlides.length <= 1) return;
    const duration = Math.max(5, current.durationSeconds || 7) * 1000;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % activeSlides.length);
    }, duration);
    return () => window.clearInterval(timer);
  }, [paused, activeSlides.length, current.durationSeconds]);

  const goPrev = () => setIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  const goNext = () => setIndex((prev) => (prev + 1) % activeSlides.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) > 45) {
      if (delta > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  return (
    <section
      id="home"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-[88vh] lg:min-h-[96vh] w-full overflow-hidden bg-[#141210] text-white flex items-end"
    >
      {/* Background Photographic Slides with Ken Burns + Crossfade */}
      <div className="absolute inset-0">
        {activeSlides.map((slide, i) => {
          const isCurrent = i === safeIndex;
          return (
            <div
              key={slide.id ?? i}
              aria-hidden={!isCurrent}
              className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
                isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                src={slide.imageUrl}
                alt={slide.heading}
                referrerPolicy="no-referrer"
                style={{ objectPosition: slide.objectPosition || '50% 25%' }}
                className={`h-full w-full object-cover ${
                  isCurrent && !paused ? 'animate-ken-burns' : ''
                }`}
              />
            </div>
          );
        })}
        {/* Measured Contrast Scrim */}
        <div
          className="absolute inset-0 z-20 bg-gradient-to-t from-[#12100E]/95 via-[#12100E]/55 to-[#12100E]/45"
          aria-hidden="true"
        />
      </div>

      {/* Foreground Reflective Content */}
      <div className="relative z-30 w-full max-w-6xl mx-auto px-6 sm:px-10 pt-36 pb-20 lg:pb-24">
        <div className="max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id ?? safeIndex}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-xs sm:text-sm tracking-[0.18em] uppercase text-[#E2C28B] font-medium mb-4">
                {current.eyebrow}
                {current.scriptureReference ? (
                  <>
                    <span className="mx-2 text-white/40" aria-hidden="true">·</span>
                    <span className="text-white/80">{current.scriptureReference}</span>
                  </>
                ) : null}
              </p>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-white leading-[1.08] mb-5">
                {current.heading}
              </h1>

              <p className="text-base sm:text-lg text-stone-200 leading-relaxed max-w-xl mb-8">
                {current.subtitle}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={current.buttonUrl || '#connect'}
                  className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-[#B4823E] hover:bg-[#9A6B2F] text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {current.buttonLabel || 'Plan Your Visit'}
                </a>
                <a
                  href="#prayer"
                  className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium border border-white/40 hover:border-white text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Request Prayer
                </a>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Controls Strip */}
        <div className="mt-12 pt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-stone-300 tracking-wide">
            Gracious Voice Celebration Centre <span className="mx-2 text-white/30">·</span> {churchLocation}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className="h-10 w-10 flex items-center justify-center border border-white/25 text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5" role="tablist" aria-label="Slide selector">
              {activeSlides.map((s, i) => (
                <button
                  key={s.id ?? i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-selected={i === safeIndex}
                  className={`h-1.5 transition-all cursor-pointer ${
                    i === safeIndex ? 'w-7 bg-[#E2C28B]' : 'w-2 bg-white/35 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="h-10 w-10 flex items-center justify-center border border-white/25 text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'}
              className="h-10 w-10 flex items-center justify-center border border-white/25 text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            <span className="font-mono tabular-nums text-xs text-stone-300 ml-1">
              {String(safeIndex + 1).padStart(2, '0')} / {String(activeSlides.length).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
