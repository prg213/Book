import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCreateStory, useGenerateStory } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Upload, Sparkles, Loader2 } from 'lucide-react';
import { Link } from 'wouter';

export default function Create() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  
  // Step 1: Photos
  const [photo1, setPhoto1] = useState<File | null>(null);
  const [photo1Preview, setPhoto1Preview] = useState<string>('');
  const [photo1Path, setPhoto1Path] = useState<string>('');
  const [photo2, setPhoto2] = useState<File | null>(null);
  const [photo2Preview, setPhoto2Preview] = useState<string>('');
  const [photo2Path, setPhoto2Path] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Step 2: Configuration
  const [characterName, setCharacterName] = useState('');
  const [characterName2, setCharacterName2] = useState('');
  const [relationship, setRelationship] = useState('');
  const [relationship2, setRelationship2] = useState('');
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [age, setAge] = useState('');
  const [emotion, setEmotion] = useState('');
  const [outfit, setOutfit] = useState('');
  const [occasion, setOccasion] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  
  // Step 3: Final details
  const [title, setTitle] = useState('');
  const [pageCount, setPageCount] = useState(6);
  
  const createStory = useCreateStory();
  const generateStory = useGenerateStory();

  const handlePhotoUpload = async (file: File, isSecond: boolean) => {
    if (!file) return;
    
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      
      const res = await fetch(`${import.meta.env.BASE_URL}api/upload-photo`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      const { photoPath } = await res.json();
      
      if (isSecond) {
        setPhoto2Path(photoPath);
        const reader = new FileReader();
        reader.onloadend = () => setPhoto2Preview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setPhoto1Path(photoPath);
        const reader = new FileReader();
        reader.onloadend = () => setPhoto1Preview(reader.result as string);
        reader.readAsDataURL(file);
      }
      
      toast({
        title: 'Photo uploaded!',
        description: 'Your photo is ready.',
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    if (!photo1Path || !characterName || !relationship || !theme || !age || !emotion || !title) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const story = await createStory.mutateAsync({
        data: {
          title,
          characterName,
          characterName2: characterName2 || null,
          relationship,
          relationship2: relationship2 || null,
          theme,
          customTheme: theme === 'custom' ? customTheme : null,
          age,
          emotion,
          outfit: outfit || null,
          occasion: occasion || null,
          pageCount,
          userPrompt: userPrompt || null,
          originalPhotoPath: photo1Path,
          originalPhotoPath2: photo2Path || null,
        },
      });

      await generateStory.mutateAsync({ id: story.id });
      
      setLocation(`/generating?storyId=${story.id}`);
    } catch (error) {
      toast({
        title: 'Creation failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const canProceedStep1 = photo1Path && characterName;
  const canProceedStep2 = relationship && theme && age && emotion;
  const canSubmit = title;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="bg-card rounded-3xl shadow-xl border border-card-border p-8 md:p-12">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-12">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-bold transition-all ${
                    s <= step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  data-testid={`step-indicator-${s}`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded transition-all ${
                      s < step ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Photos */}
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="font-display text-3xl font-bold mb-2">Upload Your Hero</h2>
                <p className="text-muted-foreground">
                  Upload a photo of the person who will star in this story.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="characterName" className="text-base font-medium">
                    Character Name *
                  </Label>
                  <Input
                    id="characterName"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="Enter their name"
                    className="mt-2"
                    data-testid="input-character-name"
                  />
                </div>

                <div>
                  <Label htmlFor="photo1" className="text-base font-medium">
                    Upload Photo *
                  </Label>
                  <div className="mt-2">
                    {photo1Preview ? (
                      <div className="relative">
                        <img
                          src={photo1Preview}
                          alt="Character preview"
                          className="w-full h-64 object-cover rounded-2xl"
                          data-testid="img-photo1-preview"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute top-4 right-4"
                          onClick={() => {
                            setPhoto1(null);
                            setPhoto1Preview('');
                            setPhoto1Path('');
                          }}
                          data-testid="button-remove-photo1"
                        >
                          Change Photo
                        </Button>
                      </div>
                    ) : (
                      <label
                        htmlFor="photo1"
                        className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:border-primary transition-colors bg-muted/30"
                      >
                        <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground font-medium">
                          {uploadingPhoto ? 'Uploading...' : 'Click to upload'}
                        </p>
                        <input
                          id="photo1"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setPhoto1(file);
                              handlePhotoUpload(file, false);
                            }
                          }}
                          data-testid="input-photo1"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <h3 className="font-display text-xl font-bold mb-4">
                    Add a Second Character? (Optional)
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="characterName2" className="text-base font-medium">
                        Second Character Name
                      </Label>
                      <Input
                        id="characterName2"
                        value={characterName2}
                        onChange={(e) => setCharacterName2(e.target.value)}
                        placeholder="Enter second character name"
                        className="mt-2"
                        data-testid="input-character-name2"
                      />
                    </div>

                    {characterName2 && (
                      <div>
                        <Label htmlFor="photo2" className="text-base font-medium">
                          Upload Second Photo
                        </Label>
                        <div className="mt-2">
                          {photo2Preview ? (
                            <div className="relative">
                              <img
                                src={photo2Preview}
                                alt="Second character preview"
                                className="w-full h-64 object-cover rounded-2xl"
                                data-testid="img-photo2-preview"
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                className="absolute top-4 right-4"
                                onClick={() => {
                                  setPhoto2(null);
                                  setPhoto2Preview('');
                                  setPhoto2Path('');
                                }}
                                data-testid="button-remove-photo2"
                              >
                                Change Photo
                              </Button>
                            </div>
                          ) : (
                            <label
                              htmlFor="photo2"
                              className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:border-primary transition-colors bg-muted/30"
                            >
                              <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                              <p className="text-muted-foreground font-medium">
                                Click to upload
                              </p>
                              <input
                                id="photo2"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setPhoto2(file);
                                    handlePhotoUpload(file, true);
                                  }
                                }}
                                data-testid="input-photo2"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1 || uploadingPhoto}
                  size="lg"
                  className="rounded-xl"
                  data-testid="button-next-step2"
                >
                  Next: Configure Story
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="font-display text-3xl font-bold mb-2">Shape Your Story</h2>
                <p className="text-muted-foreground">
                  Choose the theme, mood, and details for your adventure.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="relationship" className="text-base font-medium">
                    Relationship *
                  </Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger className="mt-2" data-testid="select-relationship">
                      <SelectValue placeholder="Choose relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friend">Friend</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="pet">Pet</SelectItem>
                      <SelectItem value="grandparent">Grandparent</SelectItem>
                      <SelectItem value="cousin">Cousin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {characterName2 && (
                  <div>
                    <Label htmlFor="relationship2" className="text-base font-medium">
                      Second Character Relationship
                    </Label>
                    <Select value={relationship2} onValueChange={setRelationship2}>
                      <SelectTrigger className="mt-2" data-testid="select-relationship2">
                        <SelectValue placeholder="Choose relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friend">Friend</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="pet">Pet</SelectItem>
                        <SelectItem value="grandparent">Grandparent</SelectItem>
                        <SelectItem value="cousin">Cousin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="theme" className="text-base font-medium">
                    Story Theme *
                  </Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="mt-2" data-testid="select-theme">
                      <SelectValue placeholder="Choose theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adventure">Adventure</SelectItem>
                      <SelectItem value="space">Space Exploration</SelectItem>
                      <SelectItem value="ocean">Ocean Voyage</SelectItem>
                      <SelectItem value="jungle">Jungle Quest</SelectItem>
                      <SelectItem value="magic">Magic & Wizards</SelectItem>
                      <SelectItem value="fairy tale">Fairy Tale</SelectItem>
                      <SelectItem value="sports">Sports Hero</SelectItem>
                      <SelectItem value="cooking">Cooking Adventure</SelectItem>
                      <SelectItem value="custom">Custom Theme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {theme === 'custom' && (
                  <div>
                    <Label htmlFor="customTheme" className="text-base font-medium">
                      Custom Theme
                    </Label>
                    <Input
                      id="customTheme"
                      value={customTheme}
                      onChange={(e) => setCustomTheme(e.target.value)}
                      placeholder="Describe your theme"
                      className="mt-2"
                      data-testid="input-custom-theme"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="age" className="text-base font-medium">
                    Age Group *
                  </Label>
                  <Select value={age} onValueChange={setAge}>
                    <SelectTrigger className="mt-2" data-testid="select-age">
                      <SelectValue placeholder="Choose age group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2-3">2-3 years</SelectItem>
                      <SelectItem value="4-5">4-5 years</SelectItem>
                      <SelectItem value="6-7">6-7 years</SelectItem>
                      <SelectItem value="8-10">8-10 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="emotion" className="text-base font-medium">
                    Character Personality *
                  </Label>
                  <Select value={emotion} onValueChange={setEmotion}>
                    <SelectTrigger className="mt-2" data-testid="select-emotion">
                      <SelectValue placeholder="Choose personality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="happy">Happy & Joyful</SelectItem>
                      <SelectItem value="brave">Brave & Courageous</SelectItem>
                      <SelectItem value="curious">Curious & Inquisitive</SelectItem>
                      <SelectItem value="kind">Kind & Caring</SelectItem>
                      <SelectItem value="funny">Funny & Playful</SelectItem>
                      <SelectItem value="adventurous">Adventurous & Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="outfit" className="text-base font-medium">
                    Special Outfit (Optional)
                  </Label>
                  <Input
                    id="outfit"
                    value={outfit}
                    onChange={(e) => setOutfit(e.target.value)}
                    placeholder="e.g., superhero cape, princess dress"
                    className="mt-2"
                    data-testid="input-outfit"
                  />
                </div>

                <div>
                  <Label htmlFor="occasion" className="text-base font-medium">
                    Special Occasion (Optional)
                  </Label>
                  <Select value={occasion} onValueChange={setOccasion}>
                    <SelectTrigger className="mt-2" data-testid="select-occasion">
                      <SelectValue placeholder="Choose occasion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="christmas">Christmas</SelectItem>
                      <SelectItem value="halloween">Halloween</SelectItem>
                      <SelectItem value="easter">Easter</SelectItem>
                      <SelectItem value="graduation">Graduation</SelectItem>
                      <SelectItem value="none">No Occasion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="userPrompt" className="text-base font-medium">
                  Additional Story Ideas (Optional)
                </Label>
                <Textarea
                  id="userPrompt"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Any specific details you'd like in the story?"
                  className="mt-2 min-h-24"
                  data-testid="textarea-user-prompt"
                />
              </div>

              <div className="flex justify-between">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  size="lg"
                  className="rounded-xl"
                  data-testid="button-back-step1"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  size="lg"
                  className="rounded-xl"
                  data-testid="button-next-step3"
                >
                  Next: Finalize
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Final Details */}
          {step === 3 && (
            <div className="space-y-8">
              <div>
                <h2 className="font-display text-3xl font-bold mb-2">Final Touches</h2>
                <p className="text-muted-foreground">
                  Give your story a title and choose the length.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="title" className="text-base font-medium">
                    Story Title *
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., The Adventures of..."
                    className="mt-2"
                    data-testid="input-title"
                  />
                </div>

                <div>
                  <Label className="text-base font-medium">Number of Pages *</Label>
                  <div className="grid grid-cols-4 gap-4 mt-2">
                    {[4, 6, 8, 10].map((count) => (
                      <button
                        key={count}
                        onClick={() => setPageCount(count)}
                        className={`p-4 rounded-xl border-2 font-display font-bold text-xl transition-all ${
                          pageCount === count
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-muted hover:border-primary'
                        }`}
                        data-testid={`button-pagecount-${count}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-muted rounded-2xl p-6 space-y-2">
                  <h3 className="font-display font-bold text-lg">Story Preview</h3>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Character:</span>{' '}
                      <span className="font-medium">{characterName}</span>
                    </p>
                    {characterName2 && (
                      <p>
                        <span className="text-muted-foreground">Second Character:</span>{' '}
                        <span className="font-medium">{characterName2}</span>
                      </p>
                    )}
                    <p>
                      <span className="text-muted-foreground">Theme:</span>{' '}
                      <span className="font-medium">
                        {theme === 'custom' ? customTheme : theme}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Age:</span>{' '}
                      <span className="font-medium">{age}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Personality:</span>{' '}
                      <span className="font-medium">{emotion}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  size="lg"
                  className="rounded-xl"
                  data-testid="button-back-step2"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || createStory.isPending || generateStory.isPending}
                  size="lg"
                  className="rounded-xl"
                  data-testid="button-create-submit"
                >
                  {createStory.isPending || generateStory.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Create Story
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
