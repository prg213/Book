import { useState, useEffect, useCallback, useRef } from 'react';
import { useGetStoryForReading, getGetStoryForReadingQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Link } from 'wouter';

export default function Read() {
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get('storyId') || '';

  const { data: storyData, isLoading, isError } = useGetStoryForReading(storyId, {
    query: {
      enabled: !!storyId,
      queryKey: getGetStoryForReadingQueryKey(storyId),
    },
  });

  const [currentPage, setCurrentPage] = useState(-1); // -1 = cover
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

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, handlePrev]);

  // Swipe handling
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only count horizontal swipes (dx > dy in magnitude, and > 40px threshold)
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

      {/* Book stage — fills remaining height */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-3 py-3">
        {isCover ? (
          /* ── COVER ── */
          /* Aurora generates square (1:1) images. Show full image without cropping. */
          <div
            className="h-full max-h-full flex items-center justify-center"
            style={{ filter: 'drop-shadow(-6px 8px 28px rgba(0,0,0,0.85))' }}
          >
            <div className="flex h-full max-h-full" style={{ maxWidth: 'min(90vw, calc(100dvh - 9rem))' }}>
              {/* Spine */}
              <div
                className="flex-shrink-0 rounded-l-sm"
                style={{
                  width: '18px',
                  background: 'linear-gradient(to right, #0f0703, #3d1f0c, #221008)',
                  boxShadow: 'inset -3px 0 8px rgba(0,0,0,0.6)',
                }}
              />
              {/* Cover face — square image shown in full with object-contain */}
              <div className="relative overflow-hidden rounded-r-lg flex-1" style={{ aspectRatio: '1/1' }}>
                {story.coverImageUrl ? (
                  <img
                    src={story.coverImageUrl}
                    alt={story.title}
                    className="w-full h-full object-contain bg-black"
                    data-testid="img-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center">
                    <div className="text-center text-amber-200 p-8">
                      <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="font-display text-2xl font-bold">{story.title}</p>
                    </div>
                  </div>
                )}
                {/* Right-edge page sheen */}
                <div className="absolute inset-y-0 right-0 w-4 pointer-events-none"
                  style={{ background: 'linear-gradient(to left, rgba(255,240,200,0.18), transparent)' }} />
              </div>
            </div>
          </div>
        ) : (
          /* ── OPEN BOOK (inner pages) ── */
          <div
            className="w-full h-full max-h-full flex"
            style={{
              filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.75))',
              maxWidth: 'min(98vw, calc((100dvh - 9rem) * 2))',
            }}
          >
            {/* Left page — illustration */}
            <div
              className="flex-1 relative flex items-center justify-center overflow-hidden rounded-l-lg"
              style={{
                background: 'linear-gradient(to right, #e8d8b0, #f0e3c8)',
                boxShadow: 'inset -2px 0 8px rgba(0,0,0,0.10)',
              }}
            >
              {/* Left spine shadow */}
              <div className="absolute inset-y-0 left-0 w-5 pointer-events-none z-10"
                style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.18), transparent)' }} />
              {currentPageData?.imageUrl ? (
                <img
                  src={currentPageData.imageUrl}
                  alt={`Page ${currentPageData.pageNumber}`}
                  className="w-full h-full object-contain"
                  style={{ padding: '4%' }}
                  data-testid={`img-page-${currentPageData.pageNumber}`}
                  draggable={false}
                />
              ) : (
                <div className="text-amber-800/30 text-center p-8">
                  <BookOpen className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-xs">Illustration</p>
                </div>
              )}
              {/* Page number */}
              <div className="absolute bottom-3 left-6 text-amber-800/40 text-xs italic font-serif z-10">
                {currentPageData?.pageNumber}
              </div>
            </div>

            {/* Centre spine */}
            <div
              className="flex-shrink-0 self-stretch"
              style={{
                width: '16px',
                background: 'linear-gradient(to right, #b8933e, #e8d08a, #c4a050, #e8d08a, #b8933e)',
                boxShadow: '0 0 8px rgba(0,0,0,0.35)',
              }}
            />

            {/* Right page — text */}
            <div
              className="flex-1 relative flex flex-col justify-center overflow-y-auto rounded-r-lg"
              style={{
                background: 'linear-gradient(to left, #e8d8b0, #f0e3c8)',
                fontFamily: '"Georgia", "Times New Roman", serif',
              }}
            >
              {/* Right spine shadow */}
              <div className="absolute inset-y-0 right-0 w-5 pointer-events-none z-10"
                style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.12), transparent)' }} />
              <div className="px-[8%] py-[6%]">
                <p className="text-amber-900/50 text-xs italic mb-4 font-sans tracking-wide">{story.title}</p>
                <div
                  className="leading-relaxed text-[#3a1f06]"
                  style={{ fontSize: 'clamp(0.85rem, 2.2vw, 1.15rem)' }}
                  data-testid={`text-page-${currentPageData?.pageNumber}`}
                >
                  {currentPageData?.text?.split('\n').map((para, i) => (
                    <p
                      key={i}
                      className="mb-3"
                      style={i === 0 ? {
                        // Drop-cap on first paragraph
                        paddingLeft: 0,
                      } : {}}
                    >
                      {i === 0 && para[0] ? (
                        <>
                          <span style={{
                            float: 'left',
                            fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
                            lineHeight: '0.75',
                            fontWeight: 'bold',
                            marginRight: '0.1em',
                            marginTop: '0.1em',
                            color: '#8b4513',
                          }}>
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
              <div className="absolute bottom-3 right-6 text-amber-800/40 text-xs italic font-serif z-10">
                {currentPageData && currentPageData.pageNumber + 1}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation bar */}
      <div className="flex-shrink-0 px-4 pb-3 pt-1">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          {/* Prev */}
          <button
            onClick={handlePrev}
            disabled={isCover}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-25"
            style={{
              background: 'rgba(245,201,122,0.12)',
              color: '#f5c97a',
              border: '1px solid rgba(245,201,122,0.2)',
              minWidth: '90px',
            }}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{isCover ? 'Cover' : currentPage === 0 ? 'Cover' : `Pg ${currentPage}`}</span>
          </button>

          {/* Page dots */}
          <div className="flex items-center gap-1.5 flex-1 justify-center overflow-hidden">
            <button onClick={() => setCurrentPage(-1)}
              className="rounded-full flex-shrink-0 transition-all"
              style={{ width: isCover ? '18px' : '7px', height: '7px', background: isCover ? '#f5c97a' : 'rgba(245,201,122,0.3)' }}
              data-testid="button-dot-cover"
            />
            {pages.map((_, i) => (
              <button key={i} onClick={() => setCurrentPage(i)}
                className="rounded-full flex-shrink-0 transition-all"
                style={{ width: i === currentPage ? '18px' : '7px', height: '7px', background: i === currentPage ? '#f5c97a' : 'rgba(245,201,122,0.3)' }}
                data-testid={`button-dot-${i}`}
              />
            ))}
          </div>

          {/* Next */}
          {isCover ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm"
              style={{ background: '#f5c97a', color: '#1a0e08', minWidth: '90px' }}
              data-testid="button-start-reading"
            >
              <span>Start Reading</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={isLastPage}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-25"
              style={{
                background: isLastPage ? 'rgba(245,201,122,0.08)' : 'rgba(245,201,122,0.12)',
                color: '#f5c97a',
                border: '1px solid rgba(245,201,122,0.2)',
                minWidth: '90px',
              }}
              data-testid="button-next-page"
            >
              <span className="truncate">{isLastPage ? 'The End' : `Pg ${currentPage + 2}`}</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
