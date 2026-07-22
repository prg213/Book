import { useState, useEffect, useCallback, useRef } from 'react';
import { useGetStoryForReading, getGetStoryForReadingQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'wouter';

function useIsLandscape() {
  const [landscape, setLandscape] = useState(() => window.innerWidth > window.innerHeight);
  useEffect(() => {
    const check = () => setLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return landscape;
}

export default function Read() {
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get('storyId') || '';
  const isLandscape = useIsLandscape();
  const [, setLocation] = useLocation();

  const { data: storyData, isLoading, isError } = useGetStoryForReading(storyId, {
    query: {
      enabled: !!storyId,
      queryKey: getGetStoryForReadingQueryKey(storyId),
    },
  });

  const [currentPage, setCurrentPage] = useState(-1);
  // Landscape overlay: shown briefly on tap, auto-hides after 3s
  const [overlayVisible, setOverlayVisible] = useState(false);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  const story = storyData?.story;
  const pages = storyData?.pages || [];
  const totalPages = pages.length;

  const handleNext = useCallback(() => {
    setCurrentPage(p => (p < totalPages - 1 ? p + 1 : p));
  }, [totalPages]);

  const handlePrev = useCallback(() => {
    setCurrentPage(p => (p >= 0 ? p - 1 : p));
  }, []);

  // Show the overlay briefly then auto-hide
  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setOverlayVisible(false), 3000);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, handlePrev]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const dt = Date.now() - touchStartTime.current;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 12 && dt < 300) {
      // TAP — in landscape toggle overlay; in portrait do nothing special
      if (isLandscape) showOverlay();
    } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      // SWIPE horizontal → turn page
      if (dx < 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#1a0e08] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-amber-200/70">Opening your book...</p>
        </div>
      </div>
    );
  }

  if (isError || !story) {
    return (
      <div className="min-h-[100dvh] bg-[#1a0e08] flex items-center justify-center p-4">
        <div className="bg-[#f5e6c8] rounded-2xl shadow-2xl p-10 max-w-sm text-center">
          <BookOpen className="w-14 h-14 text-amber-800/40 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold mb-3 text-amber-900">Story Not Found</h2>
          <p className="text-amber-800/70 text-sm mb-6">This story may have been deleted.</p>
          <Link href="/library"><Button>Return to Library</Button></Link>
        </div>
      </div>
    );
  }

  const currentPageData = currentPage >= 0 ? pages[currentPage] : null;
  const isCover = currentPage === -1;
  const isLastPage = currentPage >= totalPages - 1;

  // ── LANDSCAPE: book fills entire screen, no chrome ───────────────────────
  if (isLandscape) {
    return (
      <div
        className="fixed inset-0 bg-black overflow-hidden select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={showOverlay}
      >
        {/* Book fills 100% of screen */}
        {isCover ? (
          <LandscapeCover story={story} />
        ) : (
          <LandscapeBook story={story} page={currentPageData} pageNumber={currentPage + 1} totalPages={totalPages} />
        )}

        {/* Floating overlay — appears on tap, fades after 3s */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{ opacity: overlayVisible ? 1 : 0 }}
        >
          {/* Top-left: back button */}
          <button
            className="absolute top-3 left-3 pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#f5c97a', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,201,122,0.25)' }}
            onClick={(e) => { e.stopPropagation(); setLocation('/library'); }}
            data-testid="button-back-library"
          >
            <ArrowLeft className="w-4 h-4" />
            Library
          </button>

          {/* Top-right: page label */}
          <div
            className="absolute top-3 right-3 px-3 py-2 rounded-xl text-xs font-medium tracking-wider uppercase"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(245,201,122,0.7)', backdropFilter: 'blur(8px)' }}
          >
            {isCover ? story.title : `${currentPage + 1} / ${totalPages}`}
          </div>

          {/* Bottom centre: page dots + prev/next */}
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-2xl pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,201,122,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); showOverlay(); }}
              disabled={isCover}
              className="disabled:opacity-30 transition-opacity"
              style={{ color: '#f5c97a' }}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentPage(-1); showOverlay(); }}
                className="rounded-full transition-all"
                style={{ width: isCover ? '18px' : '7px', height: '7px', background: isCover ? '#f5c97a' : 'rgba(245,201,122,0.35)' }}
              />
              {pages.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrentPage(i); showOverlay(); }}
                  className="rounded-full transition-all"
                  style={{ width: i === currentPage ? '18px' : '7px', height: '7px', background: i === currentPage ? '#f5c97a' : 'rgba(245,201,122,0.35)' }}
                />
              ))}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); showOverlay(); }}
              disabled={isLastPage && !isCover}
              className="disabled:opacity-30 transition-opacity"
              style={{ color: '#f5c97a' }}
              data-testid="button-next-page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Left / right tap zones for page turning */}
          <button
            className="absolute left-0 top-0 w-1/4 h-full pointer-events-auto"
            style={{ background: 'transparent' }}
            onClick={(e) => { e.stopPropagation(); handlePrev(); showOverlay(); }}
            disabled={isCover}
          />
          <button
            className="absolute right-0 top-0 w-1/4 h-full pointer-events-auto"
            style={{ background: 'transparent' }}
            onClick={(e) => { e.stopPropagation(); handleNext(); showOverlay(); }}
            disabled={isLastPage && !isCover}
          />
        </div>

        {/* Hint: "Tap to show controls" — shown for 2s on load, then fades */}
        {!overlayVisible && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs pointer-events-none"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            Tap to show controls · Swipe to turn pages
          </div>
        )}
      </div>
    );
  }

  // ── PORTRAIT: standard layout with top bar + nav ─────────────────────────
  return (
    <div
      className="h-[100dvh] bg-[#1a0e08] flex flex-col overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#120a05]/90 border-b border-amber-900/30">
        <Link href="/library">
          <button className="flex items-center gap-1.5 text-amber-300/80 hover:text-amber-200 text-sm font-medium transition-colors" data-testid="button-back-library">
            <ArrowLeft className="w-4 h-4" />
            Library
          </button>
        </Link>
        <span className="text-amber-200/50 text-xs font-medium tracking-wider uppercase truncate mx-4">
          {isCover ? story.title : `Page ${currentPage + 1} of ${totalPages}`}
        </span>
        <div className="w-16" />
      </div>

      {/* Book stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-2">
        {isCover ? (
          <PortraitCover story={story} />
        ) : (
          <OpenBookPortrait story={story} page={currentPageData} pageNumber={currentPage + 1} totalPages={totalPages} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex-shrink-0 px-3 pb-3 pt-1">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <button
            onClick={handlePrev}
            disabled={isCover}
            className="flex items-center gap-1 px-3 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-25"
            style={{ background: 'rgba(245,201,122,0.12)', color: '#f5c97a', border: '1px solid rgba(245,201,122,0.2)', minWidth: '80px' }}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{isCover || currentPage === 0 ? 'Cover' : `Pg ${currentPage}`}</span>
          </button>

          <div className="flex items-center gap-1.5 flex-1 justify-center overflow-hidden">
            <button onClick={() => setCurrentPage(-1)}
              className="rounded-full flex-shrink-0 transition-all"
              style={{ width: isCover ? '18px' : '7px', height: '7px', background: isCover ? '#f5c97a' : 'rgba(245,201,122,0.3)' }}
            />
            {pages.map((_, i) => (
              <button key={i} onClick={() => setCurrentPage(i)}
                className="rounded-full flex-shrink-0 transition-all"
                style={{ width: i === currentPage ? '18px' : '7px', height: '7px', background: i === currentPage ? '#f5c97a' : 'rgba(245,201,122,0.3)' }}
              />
            ))}
          </div>

          {isCover ? (
            <button onClick={handleNext}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl font-medium text-sm"
              style={{ background: '#f5c97a', color: '#1a0e08', minWidth: '80px' }}
              data-testid="button-start-reading"
            >
              <span>Start</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            </button>
          ) : (
            <button onClick={handleNext} disabled={isLastPage}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-25"
              style={{ background: isLastPage ? 'rgba(245,201,122,0.08)' : 'rgba(245,201,122,0.12)', color: '#f5c97a', border: '1px solid rgba(245,201,122,0.2)', minWidth: '80px' }}
              data-testid="button-next-page"
            >
              <span className="truncate">{isLastPage ? 'End' : `Pg ${currentPage + 2}`}</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Portrait cover ────────────────────────────────────────────────────────────
function PortraitCover({ story }: { story: any }) {
  return (
    <div className="h-full flex items-center justify-center"
      style={{ filter: 'drop-shadow(-6px 10px 32px rgba(0,0,0,0.9))' }}>
      <div className="flex" style={{ height: '100%', maxHeight: '100%', aspectRatio: '9/10', maxWidth: '90vw' }}>
        {/* Spine */}
        <div className="flex-shrink-0 rounded-l-sm self-stretch"
          style={{ width: '5%', minWidth: '10px', maxWidth: '20px', background: 'linear-gradient(to right, #0f0703, #3d1f0c, #221008)', boxShadow: 'inset -3px 0 8px rgba(0,0,0,0.6)' }} />
        {/* Cover face */}
        <div className="relative flex-1 overflow-hidden rounded-r-lg">
          {story.coverImageUrl ? (
            <img src={story.coverImageUrl} alt={story.title}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'cover', objectPosition: 'top center' }}
              data-testid="img-cover" draggable={false} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center p-6">
              <div className="text-center text-amber-200">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-display text-lg font-bold">{story.title}</p>
              </div>
            </div>
          )}
          <div className="absolute inset-y-0 right-0 w-3 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(255,240,200,0.2), transparent)' }} />
          <div className="absolute inset-x-0 bottom-0 h-4 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.2), transparent)' }} />
        </div>
      </div>
    </div>
  );
}

// ── Landscape cover: image fills 100vw × 100dvh ───────────────────────────────
function LandscapeCover({ story }: { story: any }) {
  return (
    <div className="w-full h-full flex">
      {/* Spine — thin strip on far left */}
      <div className="flex-shrink-0 h-full"
        style={{ width: '20px', background: 'linear-gradient(to right, #0a0502, #3d1f0c, #1a0a04)', boxShadow: 'inset -4px 0 10px rgba(0,0,0,0.7)' }} />
      {/* Cover image fills the rest */}
      <div className="relative flex-1 h-full">
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title}
            className="w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'top center' }}
            data-testid="img-cover-ls" draggable={false} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center">
            <div className="text-center text-amber-200">
              <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="font-display text-2xl font-bold">{story.title}</p>
            </div>
          </div>
        )}
        {/* Right edge sheen */}
        <div className="absolute inset-y-0 right-0 w-4 pointer-events-none"
          style={{ background: 'linear-gradient(to left, rgba(255,240,200,0.15), transparent)' }} />
      </div>
    </div>
  );
}

// ── Landscape open book: fills 100vw × 100dvh, no rounding ───────────────────
function LandscapeBook({ story, page, pageNumber, totalPages }: any) {
  return (
    <div className="w-full h-full flex">
      {/* Left page — illustration, edge-to-edge */}
      <div className="flex-1 relative overflow-hidden" style={{ background: '#e0ceaa' }}>
        {/* Left-edge spine shadow */}
        <div className="absolute inset-y-0 left-0 w-6 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.25), transparent)' }} />
        {page?.imageUrl ? (
          <img src={page.imageUrl} alt={`Page ${pageNumber}`}
            className="w-full h-full" style={{ objectFit: 'cover' }}
            data-testid={`img-page-ls-${pageNumber}`} draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-800/30">
            <BookOpen className="w-16 h-16" />
          </div>
        )}
        {/* Page number */}
        <div className="absolute bottom-3 left-6 text-amber-900/35 text-sm italic font-serif z-10">
          {pageNumber}
        </div>
      </div>

      {/* Centre spine */}
      <div className="flex-shrink-0 h-full"
        style={{ width: '14px', background: 'linear-gradient(to right, #a07830, #edd990, #c4a050, #edd990, #a07830)', boxShadow: '0 0 8px rgba(0,0,0,0.4)' }} />

      {/* Right page — text, edge-to-edge */}
      <div className="flex-1 relative flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #f5e6c0 0%, #ecddb8 100%)', fontFamily: '"Georgia", "Times New Roman", serif' }}>
        {/* Right-edge shadow */}
        <div className="absolute inset-y-0 right-0 w-6 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.18), transparent)' }} />
        <div className="flex-1 overflow-y-auto" style={{ padding: '4dvh 7%' }}>
          <p className="text-amber-900/40 text-xs italic mb-3 font-sans tracking-wide">{story.title}</p>
          <div className="leading-relaxed text-[#3a1f06]"
            style={{ fontSize: 'clamp(0.8rem, 2dvh, 1.1rem)' }}
            data-testid={`text-page-ls-${pageNumber}`}>
            {page?.text?.split('\n').map((para: string, i: number) => (
              <p key={i} className="mb-3">
                {i === 0 && para[0] ? (
                  <>
                    <span style={{ float: 'left', fontSize: 'clamp(2.2rem, 5dvh, 3rem)', lineHeight: '0.8', fontWeight: 'bold', marginRight: '0.08em', marginTop: '0.06em', color: '#8b4513' }}>
                      {para[0]}
                    </span>
                    {para.slice(1)}
                  </>
                ) : para}
              </p>
            ))}
          </div>
        </div>
        {/* Page number */}
        <div className="flex-shrink-0 pb-3 pr-6 text-right text-amber-900/35 text-sm italic font-serif z-10">
          {pageNumber + 1}
        </div>
      </div>
    </div>
  );
}

// ── Portrait open book: stacked (illustration top, text bottom) ───────────────
function OpenBookPortrait({ story, page, pageNumber, totalPages }: any) {
  return (
    <div className="w-full h-full flex flex-col rounded-xl overflow-hidden"
      style={{ background: '#f0e3c8', filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.7))', maxWidth: '480px' }}>

      {/* Illustration — top 55% */}
      <div className="relative flex-shrink-0 overflow-hidden" style={{ height: '55%', background: '#e8d8b0' }}>
        <div className="absolute inset-x-0 top-0 h-4 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)' }} />
        {page?.imageUrl ? (
          <img src={page.imageUrl} alt={`Page ${pageNumber}`}
            className="w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'center top' }}
            data-testid={`img-page-${pageNumber}`} draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-800/30">
            <BookOpen className="w-10 h-10" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-[3px]"
          style={{ background: 'linear-gradient(to right, transparent, #c9a96e 15%, #c9a96e 85%, transparent)' }} />
        <div className="absolute bottom-1 left-4 text-amber-800/40 text-xs italic font-serif z-10">
          {pageNumber}
        </div>
      </div>

      {/* Text — bottom 45% */}
      <div className="flex-1 min-h-0 overflow-y-auto relative"
        style={{ background: 'linear-gradient(to bottom, #f0e3c8, #ece0c2)', fontFamily: '"Georgia", "Times New Roman", serif', padding: '5% 7%' }}>
        <p className="text-amber-900/40 text-xs italic mb-3 font-sans">{story.title}</p>
        <div className="leading-snug text-[#3a1f06]"
          style={{ fontSize: 'clamp(0.85rem, 3.5vw, 1.05rem)' }}
          data-testid={`text-page-${pageNumber}`}>
          {page?.text?.split('\n').map((para: string, i: number) => (
            <p key={i} className="mb-2">
              {i === 0 && para[0] ? (
                <>
                  <span style={{ float: 'left', fontSize: 'clamp(2rem, 8vw, 2.8rem)', lineHeight: '0.8', fontWeight: 'bold', marginRight: '0.08em', marginTop: '0.08em', color: '#8b4513' }}>
                    {para[0]}
                  </span>
                  {para.slice(1)}
                </>
              ) : para}
            </p>
          ))}
        </div>
        <div className="absolute bottom-2 right-4 text-amber-800/40 text-xs italic font-serif">
          {pageNumber + 1}
        </div>
      </div>
    </div>
  );
}
