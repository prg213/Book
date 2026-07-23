import { useState, useEffect, useCallback, useRef } from 'react';
import { useGetStoryForReading, getGetStoryForReadingQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'wouter';

function useIsLandscape() {
  // innerWidth > innerHeight is the ground truth — it reflects the actual
  // rendered viewport regardless of screen.orientation (which headless/desktop
  // browsers report as 'landscape-primary' even for portrait viewports).
  const getOrientation = () => window.innerWidth > window.innerHeight;
  const [landscape, setLandscape] = useState(getOrientation);
  useEffect(() => {
    const update = () => setLandscape(getOrientation());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return landscape;
}

// ── Page-flip animation state ─────────────────────────────────────────────────
type FlipPhase = 'idle' | 'tracking' | 'completing' | 'reverting';

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
  const [overlayVisible, setOverlayVisible] = useState(false);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Swipe-flip animation ─────────────────────────────────────────────────
  const [flipPhase, setFlipPhase] = useState<FlipPhase>('idle');
  const [flipDir, setFlipDir] = useState<'next' | 'prev'>('next');
  // live drag in px (negative = left/next, positive = right/prev)
  const [swipeDx, setSwipeDx] = useState(0);
  // Stage 2 of cover-open: book expands from centred to full-screen after the fold
  const [coverExpanding, setCoverExpanding] = useState(false);
  const [coverExpandReady, setCoverExpandReady] = useState(false);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const horizontalLocked = useRef(false);

  const story = storyData?.story;
  const pages = storyData?.pages || [];
  const totalPages = pages.length;

  const handleNext = useCallback(() => {
    setCurrentPage(p => (p < totalPages ? p + 1 : p));
  }, [totalPages]);

  const handlePrev = useCallback(() => {
    setCurrentPage(p => (p >= 0 ? p - 1 : p));
  }, []);

  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setOverlayVisible(false), 3000);
  }, []);

  // Reset all flip state back to idle
  const resetFlip = useCallback(() => {
    if (flipTimer.current) clearTimeout(flipTimer.current);
    setFlipPhase('idle');
    setSwipeDx(0);
    horizontalLocked.current = false;
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
    if (flipPhase !== 'idle' || coverExpanding) return; // ignore during animation
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    horizontalLocked.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isLandscape || touchStartX.current === null || touchStartY.current === null) return;
    if (flipPhase === 'completing' || flipPhase === 'reverting') return;

    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Lock to horizontal if movement is clearly horizontal
    if (!horizontalLocked.current) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) return; // vertical — ignore
      horizontalLocked.current = true;
    }

    const dir = dx < 0 ? 'next' : 'prev';
    setFlipDir(dir);
    setFlipPhase('tracking');
    setSwipeDx(dx);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    // ── Landscape: animated flip ──────────────────────────────────────────
    if (isLandscape && flipPhase === 'tracking') {
      const isCoverLocal = currentPage === -1;
      const isLastLocal = currentPage >= totalPages;
      const canGo = flipDir === 'next' ? !isLastLocal : !isCoverLocal;

      if (Math.abs(swipeDx) > 55 && canGo) {
        if (isCoverLocal && flipDir === 'next') {
          // Stage 1: fold cover face to 90° while book stays centred
          setFlipPhase('completing');
          flipTimer.current = setTimeout(() => {
            // Stage 2: change page then expand book to fill screen
            handleNext();
            resetFlip();
            setCoverExpanding(true);
            requestAnimationFrame(() => requestAnimationFrame(() => setCoverExpandReady(true)));
            setTimeout(() => {
              setCoverExpanding(false);
              setCoverExpandReady(false);
            }, 440);
          }, 340);
        } else {
          // Regular page flip
          setFlipPhase('completing');
          flipTimer.current = setTimeout(() => {
            if (flipDir === 'next') handleNext(); else handlePrev();
            resetFlip();
          }, 340);
        }
      } else {
        // Not enough — snap back to 0°
        setFlipPhase('reverting');
        flipTimer.current = setTimeout(resetFlip, 280);
      }
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    // ── No flip in progress: tap or portrait swipe ────────────────────────
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const dt = Date.now() - touchStartTime.current;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 12 && dt < 300) {
      if (isLandscape) showOverlay();
    } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (!isLandscape) {
        if (dx < 0) handleNext();
        else handlePrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    resetFlip();
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

  const currentPageData = currentPage >= 0 && currentPage < totalPages ? pages[currentPage] : null;
  const isCover = currentPage === -1;
  const isEndPage = currentPage === totalPages;
  const isLastPage = currentPage >= totalPages;

  // peekPage: adjacent page used for the flip card back face + peek background
  const flipActive = flipPhase !== 'idle';
  const peekIdx = flipActive ? currentPage + (flipDir === 'next' ? 1 : -1) : -1;
  const peekPage = peekIdx >= 0 && peekIdx < totalPages ? pages[peekIdx] : null;

  // ── LANDSCAPE: book fills entire screen, no chrome ───────────────────────
  if (isLandscape) {
    return (
      <div
        className="fixed inset-0 bg-black overflow-hidden select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={showOverlay}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Book content — four states */}
        {isCover ? (
          /* Stage 0: cover at rest, or Stage 1: cover face folding (centred) */
          (flipPhase !== 'idle' && flipDir === 'next')
            ? <LandscapeCoverFolding story={story} firstPage={pages[0] ?? null} flipPhase={flipPhase} swipeDx={swipeDx} />
            : <LandscapeCover story={story} />
        ) : isEndPage ? (
          <LandscapeEndPage story={story} />
        ) : coverExpanding ? (
          /* Stage 2: book scales from centred size to full screen */
          <div style={{
            position: 'absolute', inset: 0,
            transform: coverExpandReady
              ? 'scale(1)'
              : `scale(${Math.min(0.95, window.innerHeight / window.innerWidth)})`,
            transition: coverExpandReady
              ? 'transform 0.44s cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
            transformOrigin: 'center center',
          }}>
            <LandscapeBook
              story={story}
              page={currentPageData}
              peekPage={null}
              pageNumber={1}
              totalPages={totalPages}
              flipPhase="idle"
              flipDir="next"
              swipeDx={0}
            />
          </div>
        ) : (
          /* Normal open book */
          <LandscapeBook
            story={story}
            page={currentPageData}
            peekPage={peekPage}
            pageNumber={currentPage + 1}
            totalPages={totalPages}
            flipPhase={flipPhase}
            flipDir={flipDir}
            swipeDx={swipeDx}
          />
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
            {isCover ? story.title : isEndPage ? 'The End' : `${currentPage + 1} / ${totalPages}`}
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
              {/* End page dot */}
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentPage(totalPages); showOverlay(); }}
                className="rounded-full transition-all"
                style={{ width: isEndPage ? '18px' : '7px', height: '7px', background: isEndPage ? '#f5c97a' : 'rgba(245,201,122,0.35)' }}
              />
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); showOverlay(); }}
              disabled={isLastPage}
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
            disabled={isLastPage}
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
          {isCover ? story.title : isEndPage ? 'The End' : `Page ${currentPage + 1} of ${totalPages}`}
        </span>
        <div className="w-16" />
      </div>

      {/* Book stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-2">
        {isCover ? (
          <PortraitCover story={story} />
        ) : isEndPage ? (
          <PortraitEndPage story={story} />
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
            {/* End page dot */}
            <button onClick={() => setCurrentPage(totalPages)}
              className="rounded-full flex-shrink-0 transition-all"
              style={{ width: isEndPage ? '18px' : '7px', height: '7px', background: isEndPage ? '#f5c97a' : 'rgba(245,201,122,0.3)' }}
            />
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
              <span className="truncate">{isEndPage ? 'The End' : isLastPage ? 'The End' : `Pg ${currentPage + 2}`}</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Portrait cover ────────────────────────────────────────────────────────────
// 1:1 square, spine as overlay — mirrors the landscape treatment exactly.
// Width is the limiting dimension in portrait: cover fills 100% of stage width,
// maintains 1:1 ratio, and is capped by max-height so it never overflows the
// stage vertically on short screens.
function PortraitCover({ story }: { story: any }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        maxHeight: '100%',
        borderRadius: '0 14px 14px 0',
        filter: 'drop-shadow(-4px 10px 28px rgba(0,0,0,0.85))',
      }}
    >
      {story.coverImageUrl ? (
        <img
          src={story.coverImageUrl}
          alt={story.title}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', objectPosition: 'top center' }}
          data-testid="img-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center p-6">
          <div className="text-center text-amber-200">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-display text-lg font-bold">{story.title}</p>
          </div>
        </div>
      )}
      {/* Spine overlay on left edge — no structural width added */}
      <div className="absolute inset-y-0 left-0 pointer-events-none"
        style={{ width: '22px', background: 'linear-gradient(to right, rgba(5,2,0,0.92) 0%, rgba(40,18,6,0.65) 55%, transparent 100%)' }} />
      {/* Subtle bottom shadow */}
      <div className="absolute inset-x-0 bottom-0 h-4 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.2), transparent)' }} />
    </div>
  );
}

// ── Portrait "The End" page ────────────────────────────────────────────────────
function PortraitEndPage({ story }: { story: any }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center rounded-xl overflow-hidden"
      style={{
        maxWidth: '480px',
        background: 'linear-gradient(160deg, #f5e6c0 0%, #ece0c2 60%, #e0ceaa 100%)',
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.85))',
        fontFamily: '"Georgia", "Times New Roman", serif',
      }}
    >
      {/* Decorative top rule */}
      <div style={{ width: '60%', height: '2px', background: 'linear-gradient(to right, transparent, #c9a96e, transparent)', marginBottom: '2rem' }} />
      <p style={{ color: '#8b4513', fontSize: 'clamp(0.7rem, 3vw, 0.9rem)', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '1.2rem', opacity: 0.6 }}>
        {story.title}
      </p>
      <p style={{ color: '#3a1f06', fontSize: 'clamp(2.4rem, 10vw, 3.6rem)', fontWeight: 'bold', fontStyle: 'italic', lineHeight: 1.1, textAlign: 'center' }}>
        The End
      </p>
      {/* Decorative bottom rule */}
      <div style={{ width: '60%', height: '2px', background: 'linear-gradient(to right, transparent, #c9a96e, transparent)', marginTop: '2rem' }} />
    </div>
  );
}

// ── Landscape "The End" spread ─────────────────────────────────────────────────
function LandscapeEndPage({ story }: { story: any }) {
  return (
    <div className="w-full h-full flex" style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}>
      {/* Outer left page-stack */}
      <div className="flex-shrink-0 self-stretch"
        style={{
          width: '10px',
          background: 'repeating-linear-gradient(to bottom, #b8966a 0px, #b8966a 1px, #e8d5a8 1px, #e8d5a8 4px)',
          boxShadow: 'inset 3px 0 6px rgba(0,0,0,0.3)',
        }} />

      {/* Left half */}
      <div className="flex-1 flex items-center justify-center relative"
        style={{ background: 'linear-gradient(135deg, #f5e6c0 0%, #ecddb8 100%)' }}>
        <div className="absolute inset-y-0 left-0 w-4 pointer-events-none"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.22), transparent)' }} />
        <div className="absolute inset-y-0 right-0 w-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.28), transparent)' }} />
        <p className="text-amber-900/25 text-sm italic select-none" style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap', letterSpacing: '0.1em' }}>
          {story.title}
        </p>
      </div>

      {/* Centre fold */}
      <div className="flex-shrink-0 h-full"
        style={{
          width: '6px',
          background: 'linear-gradient(to right, rgba(0,0,0,0.40) 0%, rgba(140,100,50,0.3) 40%, rgba(255,240,200,0.4) 55%, rgba(140,100,50,0.2) 70%, rgba(0,0,0,0.25) 100%)',
          zIndex: 15,
        }} />

      {/* Right half — "The End" centered */}
      <div className="flex-1 flex flex-col items-center justify-center relative"
        style={{ background: 'linear-gradient(135deg, #f5e6c0 0%, #ecddb8 100%)' }}>
        <div className="absolute inset-y-0 left-0 w-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.20), transparent)' }} />
        <div className="absolute inset-y-0 right-0 w-4 pointer-events-none"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.18), transparent)' }} />
        {/* Decorative top rule */}
        <div style={{ width: '55%', height: '1px', background: 'linear-gradient(to right, transparent, #c9a96e, transparent)', marginBottom: '1.8rem' }} />
        <p style={{ color: '#3a1f06', fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 'bold', fontStyle: 'italic', lineHeight: 1.1, textAlign: 'center' }}>
          The End
        </p>
        {/* Decorative bottom rule */}
        <div style={{ width: '55%', height: '1px', background: 'linear-gradient(to right, transparent, #c9a96e, transparent)', marginTop: '1.8rem' }} />
      </div>

      {/* Outer right page-stack */}
      <div className="flex-shrink-0 self-stretch"
        style={{
          width: '10px',
          background: 'repeating-linear-gradient(to bottom, #b8966a 0px, #b8966a 1px, #e8d5a8 1px, #e8d5a8 4px)',
          boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.3)',
        }} />
    </div>
  );
}

// ── Landscape cover: 1:1 square, spine as overlay — exact match to AI image ──
// No separate spine div so the book shape IS the AI image shape (1:1).
function LandscapeCover({ story }: { story: any }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative h-full overflow-hidden"
        style={{
          aspectRatio: '1 / 1',
          borderRadius: '0 14px 14px 0',
          filter: 'drop-shadow(-6px 12px 28px rgba(0,0,0,0.95))',
        }}>
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'top center' }}
            data-testid="img-cover-ls" draggable={false} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center">
            <div className="text-center text-amber-200">
              <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="font-display text-2xl font-bold">{story.title}</p>
            </div>
          </div>
        )}
        {/* Spine — overlay on left edge, no structural width added */}
        <div className="absolute inset-y-0 left-0 pointer-events-none"
          style={{ width: '22px', background: 'linear-gradient(to right, rgba(5,2,0,0.92) 0%, rgba(40,18,6,0.65) 55%, transparent 100%)' }} />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function PageIllustration({ imgPage, pageNumber, testId }: { imgPage: any; pageNumber: number; testId: string }) {
  return imgPage?.imageUrl ? (
    <img src={imgPage.imageUrl} alt={`Page ${pageNumber}`}
      className="w-full h-full"
      style={{ objectFit: 'cover', objectPosition: 'center' }}
      data-testid={testId} draggable={false} />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-amber-800/30">
      <BookOpen className="w-16 h-16" />
    </div>
  );
}

function PageText({ story, textPage, pageNumber }: { story: any; textPage: any; pageNumber: number }) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center"
      style={{ padding: '3dvh 10%', textAlign: 'center' }}>
      <p className="text-amber-900/40 text-xs italic mb-4 font-sans tracking-wide">{story.title}</p>
      <div className="leading-relaxed text-[#3a1f06]"
        style={{ fontSize: 'clamp(1.05rem, 3dvh, 1.5rem)' }}
        data-testid={`text-page-ls-${pageNumber}`}>
        {textPage?.text?.split('\n').map((para: string, i: number) => (
          <p key={i} className="mb-3">{para}</p>
        ))}
      </div>
    </div>
  );
}

// ── Cover with fold animation ─────────────────────────────────────────────────
// 1:1 square matches LandscapeCover exactly. The ENTIRE square (spine overlay
// included) rotates as one piece around its left edge — no separate spine div.
// perspective on the container lets the 3D fold project naturally.
// NO overflow-hidden on the rotating div (would flatten 3D to 2D).
function LandscapeCoverFolding({ story, firstPage, flipPhase, swipeDx }: any) {
  const halfWidth = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
  const rawAngle  = flipPhase === 'completing' ? 90
    : flipPhase === 'reverting' ? 0
    : Math.min(89, (Math.abs(swipeDx) / halfWidth) * 90);
  const animated = flipPhase === 'completing' || flipPhase === 'reverting';

  return (
    <div className="w-full h-full flex items-center justify-center">
      {/* 1:1 perspective container — same dimensions as LandscapeCover */}
      <div className="relative h-full"
        style={{
          aspectRatio: '1 / 1',
          perspective: '900px',
          perspectiveOrigin: 'left center',
          filter: 'drop-shadow(-6px 12px 28px rgba(0,0,0,0.95))',
        }}>

        {/* Back layer: page 1 illustration, visible as cover opens */}
        <div className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: '0 14px 14px 0', background: '#e0ceaa' }}>
          <PageIllustration imgPage={firstPage} pageNumber={1} testId="img-cover-peek" />
        </div>

        {/* Entire cover square rotates around its left edge — NO overflow-hidden */}
        <div className="absolute inset-0"
          style={{
            transformOrigin: 'left center',
            transform: `rotateY(-${rawAngle}deg)`,
            transition: animated ? 'transform 0.34s ease-in-out' : 'none',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}>
          {/* Inner clip: border-radius + image clipping, doesn't affect 3D parent */}
          <div className="absolute inset-0 overflow-hidden"
            style={{ borderRadius: '0 14px 14px 0' }}>
            {story.coverImageUrl ? (
              <img src={story.coverImageUrl} alt={story.title}
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: 'cover', objectPosition: 'top center' }}
                draggable={false} />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center">
                <div className="text-center text-amber-200">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="font-display text-2xl font-bold">{story.title}</p>
                </div>
              </div>
            )}
            {/* Spine overlay — rotates with the cover as part of the 1:1 unit */}
            <div className="absolute inset-y-0 left-0 pointer-events-none"
              style={{ width: '22px', background: 'linear-gradient(to right, rgba(5,2,0,0.92) 0%, rgba(40,18,6,0.65) 55%, transparent 100%)' }} />
            {/* Darkens as cover folds away from light */}
            <div className="absolute inset-0 pointer-events-none"
              style={{
                background: `rgba(0,0,0,${Math.min(0.55, rawAngle / 150)})`,
                transition: animated ? 'background 0.34s ease-in-out' : 'none',
              }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Landscape open book — full 180° page flip ─────────────────────────────────
// • Swipe left  (next) → right (text) panel flips 0→180° around spine (left edge)
//     Front face: current text   Back face: next illustration
// • Swipe right (prev) → left (illus) panel flips 0→180° around spine (right edge)
//     Front face: current illus  Back face: prev text
// An absolutely-positioned 3D card sits on top of the book; at 180° its back face
// crosses into the opposite panel area revealing the correct new content.
function LandscapeBook({ story, page, peekPage, pageNumber, totalPages, flipPhase, flipDir, swipeDx }: any) {
  const halfWidth = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;

  // Full 180° sweep: 0° = flat, 180° = fully turned
  const rawAngle = flipPhase === 'completing'
    ? 180
    : flipPhase === 'reverting'
      ? 0
      : Math.min(179, (Math.abs(swipeDx) / halfWidth) * 180);

  const animated = flipPhase === 'completing' || flipPhase === 'reverting';
  const tx = animated ? 'transform 0.32s ease-in-out' : 'none';

  const active       = flipPhase !== 'idle';
  const rightFolding = active && flipDir === 'next'; // right text page flips left
  const leftFolding  = active && flipDir === 'prev'; // left illus page flips right

  // Shadow on the static half deepens as flip progresses (0→90°) then fades back (90→180°)
  const shadowProgress = rawAngle <= 90 ? rawAngle / 90 : (180 - rawAngle) / 90;
  const shadowOpacity  = shadowProgress * 0.30;

  // ── Background panels (always flat, behind everything) ─────────────────
  //   'next' flip: left bg = current illustration, right bg = next text (peek)
  //   'prev' flip: left bg = prev illustration (peek), right bg = current text
  const leftBg  = rightFolding ? page          : (leftFolding ? peekPage : page);
  const rightBg = rightFolding ? peekPage      : page;

  return (
    <div className="w-full h-full flex" style={{ overflow: 'hidden', position: 'relative' }}>

      {/* ── Outer left page-stack ── */}
      <div className="flex-shrink-0 self-stretch"
        style={{
          width: '10px',
          background: 'repeating-linear-gradient(to bottom, #b8966a 0px, #b8966a 1px, #e8d5a8 1px, #e8d5a8 4px)',
          boxShadow: 'inset 3px 0 6px rgba(0,0,0,0.3)',
        }} />

      {/* ── Left page: illustration (static background) ── */}
      <div className="flex-1 relative" style={{ background: '#e0ceaa' }}>
        <div className="absolute inset-0">
          <PageIllustration imgPage={leftBg} pageNumber={pageNumber} testId={`img-page-ls-${pageNumber}`} />
        </div>
        <div className="absolute inset-y-0 left-0 w-4 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.22), transparent)' }} />
        <div className="absolute inset-y-0 right-0 w-10 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.28), transparent)' }} />
        <div className="absolute bottom-3 left-5 text-amber-900/35 text-sm italic font-serif z-10">{pageNumber}</div>
        {/* Shadow from flipping right page */}
        {rightFolding && (
          <div className="absolute inset-0 pointer-events-none z-20"
            style={{ background: `rgba(0,0,0,${shadowOpacity})` }} />
        )}
      </div>

      {/* ── Centre fold/crease ── */}
      <div className="flex-shrink-0 h-full"
        style={{
          width: '6px',
          background: 'linear-gradient(to right, rgba(0,0,0,0.40) 0%, rgba(140,100,50,0.3) 40%, rgba(255,240,200,0.4) 55%, rgba(140,100,50,0.2) 70%, rgba(0,0,0,0.25) 100%)',
          zIndex: 15,
          position: 'relative',
        }} />

      {/* ── Right page: text (static background) ── */}
      <div className="flex-1 relative"
        style={{ background: 'linear-gradient(135deg, #f5e6c0 0%, #ecddb8 100%)', fontFamily: '"Georgia", "Times New Roman", serif' }}>
        <div className="absolute inset-0 flex flex-col">
          <PageText story={story} textPage={rightBg} pageNumber={rightFolding ? pageNumber + 1 : pageNumber} />
          <div className="flex-shrink-0 pb-3 pr-5 text-right text-amber-900/35 text-sm italic font-serif">
            {rightFolding ? pageNumber + 2 : pageNumber + 1}
          </div>
        </div>
        <div className="absolute inset-y-0 left-0 w-10 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.20), transparent)' }} />
        <div className="absolute inset-y-0 right-0 w-4 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.18), transparent)' }} />
        {/* Shadow from flipping left page */}
        {leftFolding && (
          <div className="absolute inset-0 pointer-events-none z-20"
            style={{ background: `rgba(0,0,0,${shadowOpacity})` }} />
        )}
      </div>

      {/* ── Outer right page-stack ── */}
      <div className="flex-shrink-0 self-stretch"
        style={{
          width: '10px',
          background: 'repeating-linear-gradient(to bottom, #b8966a 0px, #b8966a 1px, #e8d5a8 1px, #e8d5a8 4px)',
          boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.3)',
        }} />

      {/* ── 3D flip card — absolutely positioned, crosses panels during flip ── */}
      {active && (
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          // 'next': card starts at right panel left edge (after spine)
          // 'prev': card starts at left panel left edge (after left stack)
          left: rightFolding
            ? 'calc(10px + (100% - 26px) / 2 + 6px)'
            : '10px',
          width: 'calc((100% - 26px) / 2)',
          transformStyle: 'preserve-3d',
          transformOrigin: rightFolding ? '0% 50%' : '100% 50%',
          transform: rightFolding
            ? `perspective(1600px) rotateY(-${rawAngle}deg)`
            : `perspective(1600px) rotateY(${rawAngle}deg)`,
          transition: tx,
          zIndex: 30,
        }}>
          {/* Front face — current page content */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            background: rightFolding
              ? 'linear-gradient(135deg, #f5e6c0 0%, #ecddb8 100%)'
              : '#e0ceaa',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Georgia", "Times New Roman", serif',
          }}>
            {rightFolding ? (
              <>
                <div className="absolute inset-y-0 left-0 w-10 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.20), transparent)' }} />
                <div className="absolute inset-y-0 right-0 w-4 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.18), transparent)' }} />
                <PageText story={story} textPage={page} pageNumber={pageNumber} />
                <div style={{ flexShrink: 0, paddingBottom: '12px', paddingRight: '20px', textAlign: 'right' }}
                  className="text-amber-900/35 text-sm italic font-serif z-10">{pageNumber + 1}</div>
              </>
            ) : (
              <>
                <PageIllustration imgPage={page} pageNumber={pageNumber} testId={`img-flip-front-${pageNumber}`} />
                <div className="absolute inset-y-0 left-0 w-4 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.22), transparent)' }} />
                <div className="absolute inset-y-0 right-0 w-10 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.28), transparent)' }} />
                <div className="absolute bottom-3 left-5 text-amber-900/35 text-sm italic font-serif z-10">{pageNumber}</div>
              </>
            )}
          </div>

          {/* Back face — next/prev page content, pre-rotated 180° so it reads correctly */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: rightFolding ? '#e0ceaa' : 'linear-gradient(135deg, #f5e6c0 0%, #ecddb8 100%)',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Georgia", "Times New Roman", serif',
          }}>
            {rightFolding ? (
              // Back of the right page = next spread's left page (illustration N+1)
              <>
                <PageIllustration imgPage={peekPage} pageNumber={pageNumber + 1} testId={`img-flip-back-${pageNumber}`} />
                <div className="absolute inset-y-0 right-0 w-4 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.22), transparent)' }} />
                <div className="absolute inset-y-0 left-0 w-10 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.28), transparent)' }} />
                <div className="absolute bottom-3 right-5 text-amber-900/35 text-sm italic font-serif z-10">{pageNumber + 1}</div>
              </>
            ) : (
              // Back of the left page = prev spread's right page (text N-1)
              <>
                <div className="absolute inset-y-0 right-0 w-10 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.20), transparent)' }} />
                <div className="absolute inset-y-0 left-0 w-4 pointer-events-none z-10"
                  style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.18), transparent)' }} />
                <PageText story={story} textPage={peekPage} pageNumber={pageNumber - 1} />
                <div style={{ flexShrink: 0, paddingBottom: '12px', paddingLeft: '20px', textAlign: 'left' }}
                  className="text-amber-900/35 text-sm italic font-serif z-10">{pageNumber}</div>
              </>
            )}
          </div>
        </div>
      )}
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
