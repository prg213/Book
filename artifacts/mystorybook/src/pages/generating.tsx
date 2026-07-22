import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useGetStoryStatus, getGetStoryStatusQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Sparkles, Star } from 'lucide-react';

export default function Generating() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get('storyId') || '';
  const [characterRevealed, setCharacterRevealed] = useState(false);

  const { data: status, isError } = useGetStoryStatus(storyId, {
    query: {
      enabled: !!storyId,
      queryKey: getGetStoryStatusQueryKey(storyId),
      refetchInterval: 2500,
    },
  });

  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!status || hasRedirected.current) return;
    if (status.status === 'complete') {
      hasRedirected.current = true;
      queryClient.invalidateQueries({ queryKey: ['getStoryForReading'] });
      setLocation(`/read?storyId=${storyId}`);
    }
  }, [status, storyId, setLocation, queryClient]);

  // Reveal character card with animation when image first appears
  useEffect(() => {
    if ((status as any)?.characterImageUrl && !characterRevealed) {
      setCharacterRevealed(true);
    }
  }, [(status as any)?.characterImageUrl, characterRevealed]);

  if (isError) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10 flex items-center justify-center p-4">
        <div className="bg-card rounded-3xl shadow-xl border border-card-border p-12 max-w-lg text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-4">Something Went Wrong</h2>
          <p className="text-muted-foreground mb-6">
            {(status as any)?.errorMessage || 'Unable to load story status. Please try again.'}
          </p>
          <button
            onClick={() => setLocation('/library')}
            className="text-primary font-medium hover:underline"
          >
            Return to Library
          </button>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  const progress = status.generationProgress || 0;
  const characterImageUrl = (status as any).characterImageUrl as string | null;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">

        {/* Character Preview Card — appears once character is ready */}
        {characterImageUrl && (
          <div
            className="bg-card rounded-3xl shadow-xl border border-card-border overflow-hidden"
            style={{
              animation: characterRevealed ? 'fadeSlideIn 0.6s ease-out forwards' : 'none',
            }}
          >
            <div className="p-6 border-b border-card-border flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Star className="w-4 h-4 text-primary fill-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-sm text-primary uppercase tracking-wide">Character Ready</p>
                <p className="text-xs text-muted-foreground">Your character has been created</p>
              </div>
            </div>
            <div className="p-6 flex gap-6 items-center">
              <div className="relative flex-shrink-0">
                <div className="w-32 h-32 rounded-2xl overflow-hidden ring-4 ring-primary/20 shadow-lg">
                  <img
                    src={characterImageUrl}
                    alt="Your character"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -top-2 -right-2 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div>
                <p className="font-display text-xl font-bold mb-1">Looking great!</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  This character will appear on the cover and in every illustration of your story, keeping a consistent look throughout.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main progress card */}
        <div className="bg-card rounded-3xl shadow-xl border border-card-border p-10">
          {/* Animated book icon */}
          <div className="relative mb-10">
            <div className="w-28 h-28 mx-auto relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-accent to-secondary rounded-3xl animate-pulse" />
              <div className="absolute inset-2 bg-card rounded-3xl flex items-center justify-center">
                <BookOpen className="w-14 h-14 text-primary" style={{ animation: 'float 3s ease-in-out infinite' }} />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-7 h-7 text-accent animate-pulse" />
              <Sparkles className="absolute -bottom-2 -left-2 w-5 h-5 text-secondary animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold text-center mb-3">
            Creating Your Story
          </h1>

          <p className="text-center text-base text-muted-foreground mb-8">
            {status.generationStatusMessage || 'Preparing your magical adventure...'}
          </p>

          <div className="space-y-3 mb-8">
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {progress < 15 && "Analysing photo..."}
                {progress >= 15 && progress < 32 && "Creating character..."}
                {progress >= 32 && progress < 52 && "Writing story..."}
                {progress >= 52 && progress < 58 && "Painting cover..."}
                {progress >= 58 && progress < 98 && "Illustrating pages..."}
                {progress >= 98 && "Almost ready..."}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
          </div>

          {/* Step indicators */}
          <div className="grid grid-cols-4 gap-2 mb-8">
            {[
              { label: 'Character', threshold: 30 },
              { label: 'Story', threshold: 50 },
              { label: 'Cover', threshold: 55 },
              { label: 'Pages', threshold: 100 },
            ].map((step) => (
              <div
                key={step.label}
                className={`rounded-xl p-3 text-center text-xs font-medium transition-all duration-500 ${
                  progress >= step.threshold
                    ? 'bg-primary/10 text-primary'
                    : progress >= step.threshold - 25
                    ? 'bg-muted text-muted-foreground animate-pulse'
                    : 'bg-muted/40 text-muted-foreground/50'
                }`}
              >
                {step.label}
                {progress >= step.threshold && (
                  <div className="text-primary mt-0.5">✓</div>
                )}
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            This usually takes 2–3 minutes. Your character will appear above once it is ready.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
