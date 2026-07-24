import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  useListStories, useDeleteStory, useGetStoryStatus,
  getListStoriesQueryKey, getGetStoryStatusQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useClerk, useUser } from '@clerk/react';
import {
  BookOpen, Plus, Trash2, Eye, Clock, CheckCircle,
  AlertCircle, Loader2, LayoutGrid, LogOut, LogIn,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

// ── User menu (sign-in / sign-out) ───────────────────────────────────────────
function UserMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  if (!isLoaded) return null;

  if (!user) {
    return (
      <Link href="/sign-in">
        <Button variant="outline" size="sm" className="rounded-xl gap-2">
          <LogIn className="h-4 w-4" /> Sign in
        </Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground hidden md:block">
        {user.firstName ?? user.emailAddresses[0]?.emailAddress}
      </span>
      <Button
        variant="outline" size="sm" className="rounded-xl gap-2"
        onClick={() => signOut(() => setLocation('/'))}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}

// Module-level set so "Story ready!" toast fires at most once per story per session,
// even if the StoryCard component unmounts and remounts during list refetches.
const notifiedStories = new Set<string>();

// ── Live watcher for a single in-progress story ───────────────────────────────
// Polls /api/stories/:id/status every 2.5 s while the story is pending or
// generating.  When it completes, it invalidates both the status cache and the
// library list so the card flips to "Ready" without any page refresh.
function useStoryLiveStatus(storyId: string, initialStatus: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const isActive = initialStatus === 'pending' || initialStatus === 'generating';

  const { data: liveStatus } = useGetStoryStatus(storyId, {
    query: {
      enabled: isActive,
      queryKey: getGetStoryStatusQueryKey(storyId),
      refetchInterval: 2500,
      // keep fetching even when the tab is in the background
      refetchIntervalInBackground: true,
    },
  });

  useEffect(() => {
    if (!liveStatus || notifiedStories.has(storyId)) return;
    if (liveStatus.status === 'complete') {
      notifiedStories.add(storyId);
      // Refresh the full story list so the card flips to "Ready"
      queryClient.invalidateQueries({ queryKey: getListStoriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: ['getStoryForReading', storyId] });
      toast({
        title: '✨ Story ready!',
        description: 'Your story has finished generating.',
        action: (
          <button
            onClick={() => setLocation(`/read?storyId=${storyId}`)}
            className="text-primary font-semibold text-sm underline"
          >
            Read now
          </button>
        ) as any,
      });
    }
  }, [liveStatus, storyId, queryClient, toast, setLocation]);

  return liveStatus;
}

// ── Story card component ──────────────────────────────────────────────────────
interface StoryCardProps {
  story: {
    id: string;
    title: string;
    status: string;
    coverImageUrl?: string | null;
    characterImageUrl?: string | null;
    generationProgress?: number | null;
    errorMessage?: string | null;
    createdAt: string;
  };
  onDelete: (id: string) => void;
}

function StoryCard({ story, onDelete }: StoryCardProps) {
  const isActive = story.status === 'pending' || story.status === 'generating';

  // Live-poll status for in-progress stories; returns undefined for complete/error
  const liveStatus = useStoryLiveStatus(story.id, story.status);

  // Merge live data over the static list data
  const status       = liveStatus?.status       ?? story.status;
  const progress     = liveStatus?.generationProgress ?? story.generationProgress ?? 0;
  const coverUrl     = (liveStatus as any)?.coverImageUrl ?? story.coverImageUrl;
  const charUrl      = (liveStatus as any)?.characterImageUrl ?? story.characterImageUrl;
  const stillActive  = status === 'pending' || status === 'generating';

  const statusBadge = () => {
    switch (status) {
      case 'complete':
        return (
          <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
            <CheckCircle className="w-3 h-3" /> Ready
          </div>
        );
      case 'generating':
      case 'pending':
        return (
          <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-accent/10 text-accent">
            <Clock className="w-3 h-3" /> Creating
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="w-3 h-3" /> Error
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="bg-card rounded-3xl shadow-lg border border-card-border overflow-hidden hover:shadow-xl transition-all group"
      data-testid={`card-story-${story.id}`}
    >
      {/* Cover image */}
      <div className="relative h-48 bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 overflow-visible">
        <div className="w-full h-full overflow-hidden rounded-t-3xl">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={story.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              data-testid={`img-cover-${story.id}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {stillActive
                ? <Loader2 className="w-12 h-12 text-primary/40 animate-spin" />
                : <BookOpen className="w-16 h-16 text-primary/40" />
              }
            </div>
          )}
        </div>
        <div className="absolute top-3 left-4">{statusBadge()}</div>
        {/* Waving character — peeks out of the card bottom-right */}
        {charUrl && status === 'complete' && (
          <div
            className="absolute pointer-events-none"
            style={{ bottom: '-28px', right: '12px', width: '88px', height: '110px', zIndex: 10 }}
          >
            <img
              src={charUrl}
              alt="character"
              className="character-waving"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'bottom',
                mixBlendMode: 'multiply',
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))',
              }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h3
          className="font-display text-xl font-bold mb-2 line-clamp-2"
          data-testid={`text-title-${story.id}`}
        >
          {story.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Created {format(new Date(story.createdAt), 'MMM d, yyyy')}
        </p>

        {/* Live progress bar */}
        {stillActive && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{liveStatus?.generationStatusMessage || 'Creating your story…'}</span>
              <span data-testid={`text-progress-${story.id}`}>{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {status === 'error' && story.errorMessage && (
          <p className="text-xs text-destructive mb-4" data-testid={`text-error-${story.id}`}>
            {story.errorMessage}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {status === 'complete' && (
            <>
              <Link href={`/read?storyId=${story.id}`} className="flex-1">
                <Button className="w-full rounded-xl" data-testid={`button-read-${story.id}`}>
                  <Eye className="mr-2 h-4 w-4" /> Read
                </Button>
              </Link>
              <Link href={`/story-view?storyId=${story.id}`}>
                <Button
                  variant="outline" size="icon"
                  className="rounded-xl flex-shrink-0"
                  title="View story contents"
                  data-testid={`button-view-${story.id}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </Link>
            </>
          )}

          {stillActive && (
            <Link href={`/generating?storyId=${story.id}`} className="flex-1">
              <Button
                variant="outline" className="w-full rounded-xl"
                data-testid={`button-view-progress-${story.id}`}
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> View Progress
              </Button>
            </Link>
          )}

          {status === 'error' && (
            <Button
              variant="outline" className="flex-1 rounded-xl" disabled
              data-testid={`button-retry-${story.id}`}
            >
              Try Again
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline" size="icon" className="rounded-xl"
                data-testid={`button-delete-${story.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Story?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{story.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid={`button-cancel-delete-${story.id}`}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(story.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid={`button-confirm-delete-${story.id}`}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ── Library page ──────────────────────────────────────────────────────────────
export default function Library() {
  const { data: stories, isLoading } = useListStories({
    query: {
      // Re-fetch the list whenever the tab regains focus or network reconnects,
      // so a story that finished while the app was closed appears immediately.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });
  const deleteStory = useDeleteStory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    try {
      await deleteStory.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListStoriesQueryKey() });
      toast({ title: 'Story deleted', description: 'The story has been removed from your library.' });
    } catch {
      toast({ title: 'Delete failed', description: 'Unable to delete the story. Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10">
      <div className="container mx-auto px-4 py-12">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="font-display text-5xl font-bold mb-2">Your Story Library</h1>
            <p className="text-muted-foreground text-lg">All your magical adventures in one place</p>
          </div>
          <div className="flex items-center gap-3">
            <UserMenu />
            <Link href="/create">
              <Button size="lg" className="rounded-xl font-display" data-testid="button-create-new">
                <Plus className="mr-2 h-5 w-5" /> Create New Story
              </Button>
            </Link>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-3xl border border-card-border overflow-hidden h-96 animate-pulse">
                <div className="h-48 bg-muted" />
                <div className="p-6 space-y-3">
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && (!stories || stories.length === 0) && (
          <div className="bg-card rounded-3xl shadow-xl border border-card-border p-16 text-center max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center mx-auto mb-8">
              <BookOpen className="w-12 h-12 text-primary-foreground" />
            </div>
            <h2 className="font-display text-3xl font-bold mb-4">No Stories Yet</h2>
            <p className="text-muted-foreground text-lg mb-8">Start creating magical adventures for your loved ones!</p>
            <Link href="/create">
              <Button size="lg" className="rounded-xl font-display" data-testid="button-create-first">
                <Plus className="mr-2 h-5 w-5" /> Create Your First Story
              </Button>
            </Link>
          </div>
        )}

        {/* Grid */}
        {!isLoading && stories && stories.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
