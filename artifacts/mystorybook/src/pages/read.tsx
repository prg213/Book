import { useState, useEffect, useCallback } from 'react';
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

  const story = storyData?.story;
  const pages = storyData?.pages || [];
  const totalPages = pages.length;

  const handleNext = useCallback(() => {
    if (currentPage < totalPages - 1) setCurrentPage(p => p + 1);
  }, [currentPage, totalPages]);

  const handlePrev = useCallback(() => {
    if (currentPage >= 0) setCurrentPage(p => p - 1);
  }, [currentPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, handlePrev]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#2c1810] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-amber-200/70">Opening your book...</p>
        </div>
      </div>
    );
  }

  if (isError || !story) {
    return (
      <div className="min-h-[100dvh] bg-[#2c1810] flex items-center justify-center p-4">
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
    <div className="min-h-[100dvh] bg-[#1a0e08] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#120a05]/80 backdrop-blur border-b border-amber-900/30">
        <Link href="/library">
          <button className="flex items-center gap-2 text-amber-300/80 hover:text-amber-200 text-sm font-medium transition-colors" data-testid="button-back-library">
            <ArrowLeft className="w-4 h-4" />
            Library
          </button>
        </Link>
        <span className="text-amber-200/50 text-xs font-medium tracking-wider uppercase">
          {isCover ? story.title : `Page ${currentPage + 1} of ${totalPages}`}
        </span>
        <div className="w-16" />
      </div>

      {/* Book stage */}
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        {isCover ? (
          /* ── COVER ── */
          <div className="relative flex" style={{ filter: 'drop-shadow(-8px 8px 32px rgba(0,0,0,0.8))' }}>
            {/* Spine */}
            <div className="w-5 rounded-l-sm flex-shrink-0 self-stretch"
              style={{
                background: 'linear-gradient(to right, #1a0c06, #3d1f0c, #2a1408)',
                boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.5)',
              }}
            />
            {/* Cover face */}
            <div className="relative overflow-hidden rounded-r-lg"
              style={{ width: 'min(340px, 82vw)', aspectRatio: '3/4' }}>
              {story.coverImageUrl ? (
                <img
                  src={story.coverImageUrl}
                  alt={story.title}
                  className="w-full h-full object-cover"
                  data-testid="img-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center">
                  <div className="text-center text-amber-200 p-8">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="font-display text-2xl font-bold">{story.title}</p>
                  </div>
                </div>
              )}
              {/* Subtle page-edge sheen on right */}
              <div className="absolute inset-y-0 right-0 w-3 pointer-events-none"
                style={{ background: 'linear-gradient(to left, rgba(255,240,200,0.15), transparent)' }} />
            </div>
          </div>
        ) : (
          /* ── OPEN BOOK (inner pages) ── */
          <div className="w-full max-w-5xl relative"
            style={{ filter: 'drop-shadow(0 16px 48px rgba(0,0,0,0.7))' }}>

            {/* Desktop: side-by-side open book */}
            <div className="hidden md:flex rounded-lg overflow-hidden"
              style={{ minHeight: '70vh', background: '#f5e6c8' }}>

              {/* Left page — illustration */}
              <div className="flex-1 relative flex items-center justify-center p-6"
                style={{
                  background: 'linear-gradient(to right, #eddfc0, #f0e3c8)',
                  boxShadow: 'inset -4px 0 12px rgba(0,0,0,0.12)',
                }}>
                {/* Spine shadow on left */}
                <div className="absolute inset-y-0 left-0 w-6 pointer-events-none"
                  style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.15), transparent)' }} />
                {currentPageData?.imageUrl ? (
                  <img
                    src={currentPageData.imageUrl}
                    alt={`Page ${currentPageData.pageNumber}`}
                    className="w-full h-full object-contain rounded-xl shadow-md"
                    style={{ maxHeight: '65vh' }}
                    data-testid={`img-page-${currentPageData.pageNumber}`}
                  />
                ) : (
                  <div className="text-amber-800/30 text-center">
                    <BookOpen className="w-16 h-16 mx-auto mb-2" />
                    <p className="text-sm">Illustration</p>
                  </div>
                )}
                {/* Page number — bottom left */}
                <div className="absolute bottom-4 left-8 text-amber-800/40 text-xs italic font-serif">
                  {currentPageData?.pageNumber}
                </div>
              </div>

              {/* Centre spine */}
              <div className="w-8 flex-shrink-0 self-stretch flex flex-col items-center"
                style={{ background: 'linear-gradient(to right, #c9a96e, #e8d5a8, #c9a96e)' }}>
                <div className="w-[2px] h-full mx-auto"
                  style={{ background: 'linear-gradient(to bottom, transparent, rgba(120,70,20,0.3) 20%, rgba(120,70,20,0.3) 80%, transparent)' }} />
              </div>

              {/* Right page — text */}
              <div className="flex-1 flex flex-col justify-center p-10 relative"
                style={{
                  background: 'linear-gradient(to left, #eddfc0, #f0e3c8)',
                  fontFamily: '"Georgia", "Times New Roman", serif',
                }}>
                {/* Spine shadow on right */}
                <div className="absolute inset-y-0 right-0 w-6 pointer-events-none"
                  style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.12), transparent)' }} />
                <p className="text-amber-900/60 text-xs italic mb-6 font-sans tracking-wide">
                  {story.title}
                </p>
                <div className="leading-loose text-[#3d2008] text-lg md:text-xl"
                  data-testid={`text-page-${currentPageData?.pageNumber}`}>
                  {currentPageData?.text?.split('\n').map((para, i) => (
                    <p key={i} className="mb-4 first:first-letter:text-4xl first:first-letter:font-bold first:first-letter:float-left first:first-letter:mr-2 first:first-letter:leading-none">
                      {para}
                    </p>
                  ))}
                </div>
                <div className="absolute bottom-4 right-8 text-amber-800/40 text-xs italic font-serif">
                  {currentPageData && currentPageData.pageNumber + 1}
                </div>
              </div>
            </div>

            {/* Mobile: stacked layout */}
            <div className="flex flex-col md:hidden rounded-xl overflow-hidden"
              style={{ background: '#f5e6c8' }}>
              {/* Illustration */}
              <div className="relative w-full flex items-center justify-center p-4"
                style={{ background: '#eddfc0', minHeight: '52vw' }}>
                <div className="absolute inset-x-0 top-0 h-4 pointer-events-none"
                  style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.12), transparent)' }} />
                {currentPageData?.imageUrl ? (
                  <img
                    src={currentPageData.imageUrl}
                    alt={`Page ${currentPageData.pageNumber}`}
                    className="w-full object-contain rounded-lg shadow"
                    style={{ maxHeight: '55vw' }}
                    data-testid={`img-page-mob-${currentPageData.pageNumber}`}
                  />
                ) : (
                  <div className="text-amber-800/30 text-center py-8">
                    <BookOpen className="w-10 h-10 mx-auto" />
                  </div>
                )}
              </div>

              {/* Horizontal rule between sections */}
              <div className="h-[3px]"
                style={{ background: 'linear-gradient(to right, transparent, #c9a96e 20%, #c9a96e 80%, transparent)' }} />

              {/* Text */}
              <div className="p-6 pb-8"
                style={{ fontFamily: '"Georgia", "Times New Roman", serif', background: '#f0e3c8' }}>
                <p className="text-amber-900/50 text-xs italic mb-4 font-sans">
                  Page {currentPageData?.pageNumber} of {totalPages}
                </p>
                <div className="leading-loose text-[#3d2008] text-base"
                  data-testid={`text-page-mob-${currentPageData?.pageNumber}`}>
                  {currentPageData?.text?.split('\n').map((para, i) => (
                    <p key={i} className="mb-3">{para}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-4 pb-6 pt-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Prev */}
          <button
            onClick={handlePrev}
            disabled={isCover}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: isCover ? 'rgba(255,200,100,0.05)' : 'rgba(255,200,100,0.12)',
              color: '#f5c97a',
              border: '1px solid rgba(245,201,122,0.2)',
            }}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-5 h-5" />
            {isCover ? 'Cover' : currentPage === 0 ? 'Cover' : `Page ${currentPage}`}
          </button>

          {/* Page dots */}
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            {/* Cover dot */}
            <button
              onClick={() => setCurrentPage(-1)}
              className="rounded-full transition-all"
              style={{
                width: currentPage === -1 ? '20px' : '7px',
                height: '7px',
                background: currentPage === -1 ? '#f5c97a' : 'rgba(245,201,122,0.3)',
              }}
              data-testid="button-page-dot-cover"
            />
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === currentPage ? '20px' : '7px',
                  height: '7px',
                  background: i === currentPage ? '#f5c97a' : 'rgba(245,201,122,0.3)',
                }}
                data-testid={`button-page-dot-${i}`}
              />
            ))}
          </div>

          {/* Next */}
          {isCover ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all"
              style={{
                background: '#f5c97a',
                color: '#1a0e08',
              }}
              data-testid="button-start-reading"
            >
              Start Reading
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={isLastPage}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: isLastPage ? 'rgba(255,200,100,0.05)' : 'rgba(255,200,100,0.12)',
                color: '#f5c97a',
                border: '1px solid rgba(245,201,122,0.2)',
              }}
              data-testid="button-next-page"
            >
              {isLastPage ? 'The End' : `Page ${currentPage + 2}`}
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
