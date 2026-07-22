import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetStoryForReading, getGetStoryForReadingQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, X } from 'lucide-react';
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

  const [currentPage, setCurrentPage] = useState(-1); // -1 = cover page
  const [isFullscreen, setIsFullscreen] = useState(false);

  const story = storyData?.story;
  const pages = storyData?.pages || [];
  const totalPages = pages.length;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevPage();
      } else if (e.key === 'ArrowRight') {
        handleNextPage();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, isFullscreen]);

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage >= 0) {
      setCurrentPage(currentPage - 1);
    } else if (currentPage === -1) {
      // Already on cover, do nothing or go back to library
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your story...</p>
        </div>
      </div>
    );
  }

  if (isError || !story) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10 flex items-center justify-center p-4">
        <div className="bg-card rounded-3xl shadow-xl border border-card-border p-12 max-w-lg text-center">
          <BookOpen className="w-16 h-16 text-destructive mx-auto mb-6" />
          <h2 className="font-display text-2xl font-bold mb-4">Story Not Found</h2>
          <p className="text-muted-foreground mb-6">
            Unable to load this story. It may have been deleted.
          </p>
          <Link href="/library">
            <Button data-testid="button-back-library">Return to Library</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentPageData = currentPage >= 0 ? pages[currentPage] : null;

  return (
    <div
      className={`${
        isFullscreen ? 'fixed inset-0 z-50' : 'min-h-[100dvh]'
      } bg-gradient-to-br from-background via-secondary/10 to-accent/10`}
    >
      <div className="container mx-auto px-4 py-8 h-full flex flex-col">
        {/* Header */}
        {!isFullscreen && (
          <div className="mb-6 flex justify-between items-center">
            <Link href="/library">
              <Button variant="ghost" size="sm" data-testid="button-back-library">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Library
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              data-testid="button-toggle-fullscreen"
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
          </div>
        )}

        {/* Reader Container */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-6xl">
            {/* Cover Page */}
            {currentPage === -1 && (
              <div className="bg-card rounded-3xl shadow-2xl border border-card-border overflow-hidden">
                <div className="relative h-[70vh] bg-gradient-to-br from-primary/30 via-accent/30 to-secondary/30 flex flex-col items-center justify-center p-12">
                  {story.coverImageUrl ? (
                    <img
                      src={story.coverImageUrl}
                      alt={story.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-50"
                      data-testid="img-cover"
                    />
                  ) : null}
                  <div className="relative z-10 text-center max-w-2xl">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                      <BookOpen className="w-10 h-10 text-primary-foreground" />
                    </div>
                    <h1 className="font-display text-5xl md:text-6xl font-bold mb-6 text-foreground drop-shadow-lg" data-testid="text-story-title">
                      {story.title}
                    </h1>
                    <p className="text-xl text-muted-foreground mb-8">
                      Starring {story.characterName}
                      {story.characterName2 && ` and ${story.characterName2}`}
                    </p>
                    <Button
                      size="lg"
                      onClick={handleNextPage}
                      className="rounded-2xl font-display shadow-lg"
                      data-testid="button-start-reading"
                    >
                      Start Reading
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Story Pages */}
            {currentPage >= 0 && currentPageData && (
              <div className="bg-card rounded-3xl shadow-2xl border border-card-border overflow-hidden">
                <div className="grid md:grid-cols-2 min-h-[70vh]">
                  {/* Left: Illustration */}
                  <div className="relative bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center p-8">
                    {currentPageData.imageUrl ? (
                      <img
                        src={currentPageData.imageUrl}
                        alt={`Page ${currentPageData.pageNumber}`}
                        className="w-full h-full object-contain rounded-2xl shadow-lg"
                        data-testid={`img-page-${currentPageData.pageNumber}`}
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p>Illustration loading...</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Text */}
                  <div className="flex flex-col p-8 md:p-12">
                    <div className="flex-1 flex items-center">
                      <div className="w-full">
                        <div className="text-sm text-muted-foreground mb-4 font-medium">
                          Page {currentPageData.pageNumber} of {totalPages}
                        </div>
                        <div
                          className="prose prose-lg max-w-none leading-relaxed text-foreground"
                          data-testid={`text-page-${currentPageData.pageNumber}`}
                        >
                          {currentPageData.text?.split('\n').map((paragraph, i) => (
                            <p key={i} className="mb-4">
                              {paragraph}
                            </p>
                          )) || <p className="text-muted-foreground italic">Text loading...</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="mt-6 flex items-center justify-between max-w-6xl mx-auto w-full">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrevPage}
            disabled={currentPage === -1}
            className="rounded-xl"
            data-testid="button-prev-page"
          >
            <ChevronLeft className="mr-2 h-5 w-5" />
            Previous
          </Button>

          <div className="text-center">
            <div className="text-sm text-muted-foreground" data-testid="text-page-indicator">
              {currentPage === -1 ? 'Cover' : `Page ${currentPage + 1} of ${totalPages}`}
            </div>
            <div className="flex gap-1 mt-2">
              {Array.from({ length: totalPages + 1 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i - 1)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i - 1 === currentPage ? 'bg-primary w-6' : 'bg-muted hover:bg-muted-foreground/30'
                  }`}
                  data-testid={`button-page-dot-${i - 1}`}
                />
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="lg"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
            className="rounded-xl"
            data-testid="button-next-page"
          >
            Next
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Fullscreen Exit Button */}
        {isFullscreen && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(false)}
            className="fixed top-4 right-4 z-50 rounded-full"
            data-testid="button-exit-fullscreen"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
