import { Link } from 'wouter';
import { useListStories, useDeleteStory, getListStoriesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Plus, Trash2, Eye, Clock, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';
import { downloadStoryPdf } from '@/lib/download-pdf';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

export default function Library() {
  const { data: stories, isLoading } = useListStories();
  const deleteStory = useDeleteStory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDownload = async (story: any) => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL || '/'}api/stories/${story.id}/reading`);
      if (!res.ok) throw new Error('Failed to fetch story');
      const data = await res.json();
      await downloadStoryPdf(data.story, data.pages);
    } catch {
      toast({ title: 'Download failed', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStory.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListStoriesQueryKey() });
      toast({
        title: 'Story deleted',
        description: 'The story has been removed from your library.',
      });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Unable to delete the story. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return (
          <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
            <CheckCircle className="w-3 h-3" />
            Ready
          </div>
        );
      case 'generating':
      case 'pending':
        return (
          <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-accent/10 text-accent">
            <Clock className="w-3 h-3" />
            Creating
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="w-3 h-3" />
            Error
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="font-display text-5xl font-bold mb-2">Your Story Library</h1>
            <p className="text-muted-foreground text-lg">
              All your magical adventures in one place
            </p>
          </div>
          <Link href="/create">
            <Button size="lg" className="rounded-xl font-display" data-testid="button-create-new">
              <Plus className="mr-2 h-5 w-5" />
              Create New Story
            </Button>
          </Link>
        </div>

        {/* Loading State */}
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

        {/* Empty State */}
        {!isLoading && (!stories || stories.length === 0) && (
          <div className="bg-card rounded-3xl shadow-xl border border-card-border p-16 text-center max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center mx-auto mb-8">
              <BookOpen className="w-12 h-12 text-primary-foreground" />
            </div>
            <h2 className="font-display text-3xl font-bold mb-4">No Stories Yet</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Start creating magical adventures for your loved ones!
            </p>
            <Link href="/create">
              <Button size="lg" className="rounded-xl font-display" data-testid="button-create-first">
                <Plus className="mr-2 h-5 w-5" />
                Create Your First Story
              </Button>
            </Link>
          </div>
        )}

        {/* Stories Grid */}
        {!isLoading && stories && stories.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((story) => (
              <div
                key={story.id}
                className="bg-card rounded-3xl shadow-lg border border-card-border overflow-hidden hover:shadow-xl transition-all group"
                data-testid={`card-story-${story.id}`}
              >
                {/* Cover Image */}
                <div className="relative h-48 bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 overflow-hidden">
                  {story.coverImageUrl ? (
                    <img
                      src={story.coverImageUrl}
                      alt={story.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      data-testid={`img-cover-${story.id}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-primary/40" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    {getStatusBadge(story.status)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="font-display text-xl font-bold mb-2 line-clamp-2" data-testid={`text-title-${story.id}`}>
                    {story.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Created {format(new Date(story.createdAt), 'MMM d, yyyy')}
                  </p>

                  {/* Progress for generating stories */}
                  {(story.status === 'generating' || story.status === 'pending') && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>Progress</span>
                        <span data-testid={`text-progress-${story.id}`}>{story.generationProgress || 0}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                          style={{ width: `${story.generationProgress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {story.status === 'error' && story.errorMessage && (
                    <p className="text-xs text-destructive mb-4" data-testid={`text-error-${story.id}`}>
                      {story.errorMessage}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {story.status === 'complete' && (
                      <>
                        <Link href={`/read?storyId=${story.id}`} className="flex-1">
                          <Button className="w-full rounded-xl" data-testid={`button-read-${story.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Read
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-xl flex-shrink-0"
                          title={`Download A5 PDF${(story as any).style === 'colouring' ? ' — Colouring Book' : ''}`}
                          onClick={() => handleDownload(story)}
                          data-testid={`button-download-${story.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}

                    {(story.status === 'generating' || story.status === 'pending') && (
                      <Link href={`/generating?storyId=${story.id}`} className="flex-1">
                        <Button variant="outline" className="w-full rounded-xl" data-testid={`button-view-progress-${story.id}`}>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          View Progress
                        </Button>
                      </Link>
                    )}

                    {story.status === 'error' && (
                      <Button variant="outline" className="flex-1 rounded-xl" disabled data-testid={`button-retry-${story.id}`}>
                        Try Again
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-xl"
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
                            onClick={() => handleDelete(story.id)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
