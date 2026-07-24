import { Link } from 'wouter';
import { useGetLibraryStats } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { BookOpen, Sparkles, Image, Wand2 } from 'lucide-react';

export default function Home() {
  const { data: stats, isLoading } = useGetLibraryStats();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-block animate-float">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          
          <h1 className="font-display text-5xl md:text-7xl font-bold text-foreground leading-tight">
            Turn Your Loved Ones Into
            <span className="block text-primary">
              Storybook Heroes
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Upload a photo, choose your adventure, and watch as AI creates a beautifully illustrated children's story starring the people you love.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link href="/create">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6 rounded-2xl shadow-lg hover:shadow-xl transition-all font-display"
                data-testid="button-create-story"
              >
                <Wand2 className="mr-2 h-5 w-5" />
                Create My Story
              </Button>
            </Link>
            <Link href="/library">
              <Button 
                variant="outline" 
                size="lg"
                className="text-lg px-8 py-6 rounded-2xl border-2"
                data-testid="button-view-library"
              >
                <BookOpen className="mr-2 h-5 w-5" />
                View Library
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      {!isLoading && stats && stats.totalStories > 0 && (
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card rounded-3xl p-8 shadow-lg border border-card-border text-center">
                <div className="text-4xl font-display font-bold text-primary" data-testid="text-total-stories">
                  {stats.totalStories}
                </div>
                <div className="text-muted-foreground mt-2 font-medium">
                  Stories Created
                </div>
              </div>
              <div className="bg-card rounded-3xl p-8 shadow-lg border border-card-border text-center">
                <div className="text-4xl font-display font-bold text-accent" data-testid="text-completed-stories">
                  {stats.completedStories}
                </div>
                <div className="text-muted-foreground mt-2 font-medium">
                  Books Ready
                </div>
              </div>
              <div className="bg-card rounded-3xl p-8 shadow-lg border border-card-border text-center">
                <div className="text-4xl font-display font-bold text-secondary" data-testid="text-inprogress-stories">
                  {stats.inProgressStories}
                </div>
                <div className="text-muted-foreground mt-2 font-medium">
                  In Progress
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-center mb-16">
            Magic in Three Steps
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative group">
              <div className="bg-card rounded-3xl p-8 shadow-lg border-2 border-card-border hover:border-primary transition-all h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Image className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">Upload a Photo</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Choose a photo of your child, friend, pet, or anyone special. Our AI will transform them into the hero of their own adventure.
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="bg-card rounded-3xl p-8 shadow-lg border-2 border-card-border hover:border-accent transition-all h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-accent to-secondary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Wand2 className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">Choose Your Adventure</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Pick a theme, set the mood, customize details. Space exploration? Ocean voyage? Jungle quest? The story is yours to shape.
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="bg-card rounded-3xl p-8 shadow-lg border-2 border-card-border hover:border-secondary transition-all h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-secondary to-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">Watch the Magic</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Grok-3 writes an original story while Aurora creates stunning illustrations. In minutes, your personalized storybook is ready.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-primary via-accent to-secondary rounded-3xl p-12 text-center shadow-2xl">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Create Your Story?
          </h2>
          <p className="text-white/90 text-lg mb-8">
            Every child deserves to be the hero of their own tale.
          </p>
          <Link href="/create">
            <Button 
              size="lg" 
              variant="secondary"
              className="text-lg px-8 py-6 rounded-2xl font-display shadow-lg hover:shadow-xl"
              data-testid="button-cta-create"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Start Creating Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
