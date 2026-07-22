import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useGetStoryStatus, getGetStoryStatusQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Sparkles } from 'lucide-react';

export default function Generating() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get('storyId') || '';
  
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
      setLocation(`/read?storyId=${storyId}`);
    }
  }, [status, storyId, setLocation]);

  if (isError) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10 flex items-center justify-center p-4">
        <div className="bg-card rounded-3xl shadow-xl border border-card-border p-12 max-w-lg text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-4">Something Went Wrong</h2>
          <p className="text-muted-foreground mb-6">
            {status?.errorMessage || 'Unable to load story status. Please try again.'}
          </p>
          <button
            onClick={() => setLocation('/library')}
            className="text-primary font-medium hover:underline"
            data-testid="button-goto-library"
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
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  const progress = status.generationProgress || 0;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-card rounded-3xl shadow-xl border border-card-border p-12">
          {/* Animated Book Icon */}
          <div className="relative mb-12">
            <div className="w-32 h-32 mx-auto relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-accent to-secondary rounded-3xl animate-pulse" />
              <div className="absolute inset-2 bg-card rounded-3xl flex items-center justify-center">
                <BookOpen className="w-16 h-16 text-primary animate-float" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-accent animate-pulse" />
              <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-secondary animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-4xl font-bold text-center mb-4">
            Creating Your Story
          </h1>

          {/* Status Message */}
          <p className="text-center text-lg text-muted-foreground mb-8" data-testid="text-status-message">
            {status.generationStatusMessage || 'Preparing your magical adventure...'}
          </p>

          {/* Progress Bar */}
          <div className="space-y-3 mb-8">
            <Progress value={progress} className="h-3" data-testid="progress-bar" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span className="font-medium" data-testid="text-progress-value">{progress}%</span>
            </div>
          </div>

          {/* Fun Messages */}
          <div className="bg-muted/50 rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {progress < 20 && "Summoning magical characters..."}
              {progress >= 20 && progress < 40 && "Crafting an enchanting tale..."}
              {progress >= 40 && progress < 60 && "Painting beautiful illustrations..."}
              {progress >= 60 && progress < 80 && "Adding finishing touches..."}
              {progress >= 80 && "Almost ready to read..."}
            </p>
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              This usually takes 2-3 minutes. Feel free to grab a snack!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
