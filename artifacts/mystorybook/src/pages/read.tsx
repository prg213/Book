import { useState, useEffect, useCallback, useRef } from 'react';
import { useGetStoryForReading, getGetStoryForReadingQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Link } from 'wouter';

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

  const { data: storyData, isLoading, isError } = useGetStoryForReading(storyId, {
    query: {
      enabled: !!storyId,
      queryKey: getGetStoryForReadingQueryKey(storyId),
    },
  });

  const [currentPage, setCurrentPage] = useState(-1);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const story = storyData?.story;
  const pages = storyData?.pages || [];
  const totalPages = pages.length;

  const handleNext = useCallback(() => {
    setCurrentPage(p => (p < totalPages - 1 ? p + 1 : p));
  }, [totalPages]);

  const handlePrev = useCallback(() => {
    setCurrentPage(p => (p >= 0 ? p - 1 : p));
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
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
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
          <Cover story={story} isLandscape={isLandscape} />
        ) : (
          <OpenBook
            story={story}
            page={currentPageData}
            isLandscape={isLandscape}
            pageNumber={currentPage + 1}
            totalPages={totalPages}
          />
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

// ── Cover component ──────────────────────────────────────────────────────────
function Cover({ story, isLandscape }: { story: any; isLandscape: boolean }) {
  // Book is portrait-shaped (2:3). Aurora images are square (1:1).
  // We use object-cover + object-position:top so the title (top of image) is
  // always shown and the book fills its frame with no letterboxing.
  return (
    <div
      className="h-full flex items-center justify-center"
      style={{ filter: 'drop-shadow(-6px 10px 32px rgba(0,0,0,0.9))' }}
    >
      <div
        className="flex"
        style={{
          // Aurora generates square images. Using a near-square book ratio (9:10)
          // means only ~5% is cropped from each side — title stays fully visible.
          // Children's picture books are often square or near-square format.
          height: '100%',
          maxHeight: '100%',
          aspectRatio: '9/10',
          maxWidth: '90vw',
        }}
      >
        {/* Spine */}
        <div
          className="flex-shrink-0 rounded-l-sm self-stretch"
          style={{
            width: '5%',
            minWidth: '10px',
            maxWidth: '20px',
            background: 'linear-gradient(to right, #0f0703, #3d1f0c, #221008)',
            boxShadow: 'inset -3px 0 8px rgba(0,0,0,0.6)',
          }}
        />
        {/* Cover face: full-bleed portrait book cover */}
        <div className="relative flex-1 overflow-hidden rounded-r-lg">
          {story.coverImageUrl ? (
            <img
              src={story.coverImageUrl}
              alt={story.title}
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: 'cover',
                // Position top-center so the title (at top of square image) is always visible
                objectPosition: 'top center',
              }}
              data-testid="img-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center p-6">
              <div className="text-center text-amber-200">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-display text-lg font-bold">{story.title}</p>
              </div>
            </div>
          )}
          {/* Right page-edge sheen */}
          <div className="absolute inset-y-0 right-0 w-3 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(255,240,200,0.2), transparent)' }} />
          {/* Bottom page-edge sheen */}
          <div className="absolute inset-x-0 bottom-0 h-4 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.2), transparent)' }} />
        </div>
      </div>
    </div>
  );
}

// ── OpenBook component ───────────────────────────────────────────────────────
function OpenBook({
  story, page, isLandscape, pageNumber, totalPages,
}: {
  story: any;
  page: any;
  isLandscape: boolean;
  pageNumber: number;
  totalPages: number;
}) {
  if (isLandscape) {
    return <OpenBookLandscape story={story} page={page} pageNumber={pageNumber} totalPages={totalPages} />;
  }
  return <OpenBookPortrait story={story} page={page} pageNumber={pageNumber} totalPages={totalPages} />;
}

// Portrait: illustration top, text bottom, stacked
function OpenBookPortrait({ story, page, pageNumber, totalPages }: any) {
  return (
    <div
      className="w-full h-full flex flex-col rounded-xl overflow-hidden"
      style={{
        background: '#f0e3c8',
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.7))',
        maxWidth: '480px',
      }}
    >
      {/* Illustration — top 55% */}
      <div
        className="relative flex-shrink-0 overflow-hidden"
        style={{ height: '55%', background: '#e8d8b0' }}
      >
        {/* Top spine shadow */}
        <div className="absolute inset-x-0 top-0 h-4 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)' }} />
        {page?.imageUrl ? (
          <img
            src={page.imageUrl}
            alt={`Page ${pageNumber}`}
            className="w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'center top' }}
            data-testid={`img-page-${pageNumber}`}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-800/30">
            <BookOpen className="w-10 h-10" />
          </div>
        )}
        {/* Horizontal gold rule separating illustration from text */}
        <div className="absolute inset-x-0 bottom-0 h-[3px]"
          style={{ background: 'linear-gradient(to right, transparent, #c9a96e 15%, #c9a96e 85%, transparent)' }} />
        {/* Page number left */}
        <div className="absolute bottom-1 left-4 text-amber-800/40 text-xs italic font-serif z-10">
          {pageNumber}
        </div>
      </div>

      {/* Text — bottom 45% */}
      <div
        className="flex-1 min-h-0 overflow-y-auto relative"
        style={{
          background: 'linear-gradient(to bottom, #f0e3c8, #ece0c2)',
          fontFamily: '"Georgia", "Times New Roman", serif',
          padding: '5% 7%',
        }}
      >
        <p className="text-amber-900/40 text-xs italic mb-3 font-sans">{story.title}</p>
        <div
          className="leading-snug text-[#3a1f06]"
          style={{ fontSize: 'clamp(0.85rem, 3.5vw, 1.05rem)' }}
          data-testid={`text-page-${pageNumber}`}
        >
          {page?.text?.split('\n').map((para: string, i: number) => (
            <p key={i} className="mb-2">
              {i === 0 && para[0] ? (
                <>
                  <span style={{
                    float: 'left', fontSize: 'clamp(2rem, 8vw, 2.8rem)',
                    lineHeight: '0.8', fontWeight: 'bold',
                    marginRight: '0.08em', marginTop: '0.08em', color: '#8b4513',
                  }}>{para[0]}</span>
                  {para.slice(1)}
                </>
              ) : para}
            </p>
          ))}
        </div>
        {/* Right page number */}
        <div className="absolute bottom-2 right-4 text-amber-800/40 text-xs italic font-serif">
          {pageNumber + 1}
        </div>
      </div>
    </div>
  );
}

// Landscape: side-by-side open book, fills full available height
function OpenBookLandscape({ story, page, pageNumber, totalPages }: any) {
  return (
    <div
      className="flex h-full rounded-xl overflow-hidden"
      style={{
        // Book width = 2× height (two square-ish pages side by side)
        // Height fills available space; width is capped to maintain proportion
        width: '100%',
        maxWidth: 'calc(100dvh * 2.2)',
        filter: 'drop-shadow(0 10px 36px rgba(0,0,0,0.75))',
      }}
    >
      {/* Left page — illustration fills the whole page */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        style={{
          background: '#e8d8b0',
          boxShadow: 'inset -2px 0 6px rgba(0,0,0,0.08)',
        }}
      >
        <div className="absolute inset-y-0 left-0 w-4 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.15), transparent)' }} />
        {page?.imageUrl ? (
          <img
            src={page.imageUrl}
            alt={`Page ${pageNumber}`}
            className="w-full h-full"
            style={{ objectFit: 'cover' }}
            data-testid={`img-page-ls-${pageNumber}`}
            draggable={false}
          />
        ) : (
          <div className="text-amber-800/30 text-center">
            <BookOpen className="w-10 h-10 mx-auto" />
          </div>
        )}
        <div className="absolute bottom-2 left-5 text-amber-800/40 text-xs italic font-serif z-10">
          {pageNumber}
        </div>
      </div>

      {/* Spine */}
      <div className="flex-shrink-0 self-stretch"
        style={{ width: '12px', background: 'linear-gradient(to right, #b8933e, #edd990, #c4a050, #edd990, #b8933e)', boxShadow: '0 0 6px rgba(0,0,0,0.3)' }} />

      {/* Right page — text, scrollable */}
      <div
        className="flex-1 relative overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(to left, #e8d8b0, #f0e3c8)', fontFamily: '"Georgia", "Times New Roman", serif' }}
      >
        <div className="absolute inset-y-0 right-0 w-4 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.10), transparent)' }} />
        <div className="flex-1 overflow-y-auto px-[7%] py-[5%]">
          <p className="text-amber-900/40 text-xs italic mb-2 font-sans">{story.title}</p>
          <div
            className="leading-snug text-[#3a1f06]"
            style={{ fontSize: 'clamp(0.7rem, 1.6vw, 0.95rem)' }}
            data-testid={`text-page-ls-${pageNumber}`}
          >
            {page?.text?.split('\n').map((para: string, i: number) => (
              <p key={i} className="mb-2">
                {i === 0 && para[0] ? (
                  <>
                    <span style={{
                      float: 'left', fontSize: 'clamp(1.8rem, 4.5vw, 2.5rem)',
                      lineHeight: '0.8', fontWeight: 'bold',
                      marginRight: '0.07em', marginTop: '0.07em', color: '#8b4513',
                    }}>{para[0]}</span>
                    {para.slice(1)}
                  </>
                ) : para}
              </p>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 pb-2 pr-5 text-right text-amber-800/40 text-xs italic font-serif">
          {pageNumber + 1}
        </div>
      </div>
    </div>
  );
}
