import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCreateStory, useGenerateStory } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Upload, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';

interface CharacterData {
  characterImagePath: string;
  characterImageUrl: string;
  characterDescription: string;
}

export default function Create() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Photo state
  const [photo1, setPhoto1] = useState<File | null>(null);
  const [photo1Preview, setPhoto1Preview] = useState<string>('');
  const [photo1Path, setPhoto1Path] = useState<string>('');
  const [photo2, setPhoto2] = useState<File | null>(null);
  const [photo2Preview, setPhoto2Preview] = useState<string>('');
  const [photo2Path, setPhoto2Path] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Character generation state
  const [generatingCharacter, setGeneratingCharacter] = useState(false);
  const [character1, setCharacter1] = useState<CharacterData | null>(null);

  // Second character
  const [showSecondChar, setShowSecondChar] = useState(false);
  const [characterName2, setCharacterName2] = useState('');

  // Story form
  const [characterName, setCharacterName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [relationship2, setRelationship2] = useState('');
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [age, setAge] = useState('');
  const [emotion, setEmotion] = useState('');
  const [outfit, setOutfit] = useState('');
  const [occasion, setOccasion] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [pageCount, setPageCount] = useState(6);

  const createStory = useCreateStory();
  const generateStory = useGenerateStory();

  const handlePhotoUpload = async (file: File, isSecond: boolean) => {
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
        // Reset character when photo changes
        setCharacter1(null);
        const reader = new FileReader();
        reader.onloadend = () => setPhoto1Preview(reader.result as string);
        reader.readAsDataURL(file);
      }
    } catch {
      toast({ title: 'Upload failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleGenerateCharacter = async () => {
    if (!photo1Path || !characterName.trim()) return;
    setGeneratingCharacter(true);
    setCharacter1(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/generate-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPath: photo1Path }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Character generation failed');
      }
      const data: CharacterData = await res.json();
      setCharacter1(data);
    } catch (err) {
      toast({
        title: 'Character generation failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingCharacter(false);
    }
  };

  const handleSubmit = async () => {
    if (!photo1Path || !characterName || !relationship || !theme || !age || !emotion || !title) {
      toast({ title: 'Missing information', description: 'Please fill in all required fields.', variant: 'destructive' });
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
          // Pass pre-generated character so story generation skips that step
          ...(character1 ? {
            characterImagePath: character1.characterImagePath,
            characterDescription: character1.characterDescription,
          } : {}),
        } as any,
      });
      await generateStory.mutateAsync({ id: story.id });
      setLocation(`/generating?storyId=${story.id}`);
    } catch {
      toast({ title: 'Creation failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
  };

  const canGenerateCharacter = photo1Path && characterName.trim() && !uploadingPhoto;
  const canProceedStep1 = !!character1; // must have generated character to proceed
  const canProceedStep2 = relationship && theme && age && emotion;
  const canSubmit = title;

  const stepLabels = ['Photo & Character', 'Story Details', 'Finalise'];

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-background via-secondary/10 to-accent/10 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="bg-card rounded-3xl shadow-xl border border-card-border p-8">
          {/* Step indicators */}
          <div className="flex items-center mb-10">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                      s < step ? 'bg-primary text-primary-foreground' :
                      s === step ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                      'bg-muted text-muted-foreground'
                    }`}
                  >
                    {s < step ? '✓' : s}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${s === step ? 'text-primary' : 'text-muted-foreground'}`}>
                    {stepLabels[s - 1]}
                  </span>
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-0.5 mx-3 mb-4 rounded transition-all ${s < step ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>

          {/* ── STEP 1: Upload Photo + Generate Character ── */}
          {step === 1 && (
            <div className="space-y-7">
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">Upload Your Hero</h2>
                <p className="text-muted-foreground text-sm">
                  Upload a photo, enter their name, then generate your character.
                </p>
              </div>

              {/* Character name first */}
              <div>
                <Label htmlFor="characterName" className="text-sm font-semibold">Character Name *</Label>
                <Input
                  id="characterName"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Enter their name"
                  className="mt-1.5"
                  data-testid="input-character-name"
                />
              </div>

              {/* Photo upload */}
              <div>
                <Label className="text-sm font-semibold">Photo *</Label>
                <div className="mt-1.5">
                  {photo1Preview ? (
                    <div className="relative rounded-2xl overflow-hidden">
                      <img
                        src={photo1Preview}
                        alt="Character"
                        className="w-full object-contain"
                        data-testid="img-photo1-preview"
                      />
                      <button
                        className="absolute top-3 right-3 bg-card/90 backdrop-blur text-xs font-medium px-3 py-1.5 rounded-lg border border-card-border hover:bg-card transition-colors"
                        onClick={() => {
                          setPhoto1(null); setPhoto1Preview(''); setPhoto1Path(''); setCharacter1(null);
                        }}
                        data-testid="button-remove-photo1"
                      >
                        Change Photo
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="photo1"
                      className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:border-primary transition-colors bg-muted/30"
                    >
                      <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground font-medium text-sm">
                        {uploadingPhoto ? 'Uploading...' : 'Click to upload a photo'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP up to 10MB</p>
                      <input
                        id="photo1"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) { setPhoto1(file); handlePhotoUpload(file, false); }
                        }}
                        data-testid="input-photo1"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Generate Character button */}
              <Button
                onClick={handleGenerateCharacter}
                disabled={!canGenerateCharacter || generatingCharacter}
                size="lg"
                className="w-full rounded-xl text-base"
                data-testid="button-generate-character"
              >
                {generatingCharacter ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating character... (30–60 seconds)
                  </>
                ) : character1 ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Regenerate Character
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Character
                  </>
                )}
              </Button>

              {/* Character preview — appears after generation */}
              {character1 && (
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
                  <div className="px-5 py-3 border-b border-primary/20 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm text-primary">Your character is ready!</span>
                  </div>
                  <div className="p-5 flex gap-5 items-center">
                    <div className="w-36 h-36 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-primary/20 shadow-md bg-white">
                      <img
                        src={character1.characterImageUrl}
                        alt={characterName}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-bold text-lg">{characterName}</p>
                      <p className="text-muted-foreground text-xs mt-1 leading-relaxed line-clamp-4">
                        {character1.characterDescription.slice(0, 200)}
                        {character1.characterDescription.length > 200 ? '…' : ''}
                      </p>
                      <p className="text-xs text-primary font-medium mt-2">
                        This character will appear on the cover and every page.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!character1 && photo1Path && characterName && !generatingCharacter && (
                <p className="text-center text-sm text-muted-foreground">
                  Click "Generate Character" to create your 3D character before continuing.
                </p>
              )}

              {/* Optional second character */}
              <div className="border-t border-border pt-5">
                {!showSecondChar ? (
                  <button
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors"
                    onClick={() => setShowSecondChar(true)}
                  >
                    <span className="text-lg">+</span> Add a second character (optional)
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Second Character</h3>
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => { setShowSecondChar(false); setCharacterName2(''); setPhoto2(null); setPhoto2Preview(''); setPhoto2Path(''); }}
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <Label htmlFor="characterName2" className="text-sm font-semibold">Name</Label>
                      <Input
                        id="characterName2"
                        value={characterName2}
                        onChange={(e) => setCharacterName2(e.target.value)}
                        placeholder="Second character name"
                        className="mt-1.5"
                        data-testid="input-character-name2"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Photo (optional)</Label>
                      <div className="mt-1.5">
                        {photo2Preview ? (
                          <div className="relative rounded-xl overflow-hidden">
                            <img src={photo2Preview} alt="Second character" className="w-full object-contain" />
                            <button
                              className="absolute top-2 right-2 bg-card/90 text-xs px-2 py-1 rounded-lg border"
                              onClick={() => { setPhoto2(null); setPhoto2Preview(''); setPhoto2Path(''); }}
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <label
                            htmlFor="photo2"
                            className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary transition-colors bg-muted/20"
                          >
                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">Click to upload</p>
                            <input
                              id="photo2"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhoto2(f); handlePhotoUpload(f, true); } }}
                              data-testid="input-photo2"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  size="lg"
                  className="rounded-xl"
                  data-testid="button-next-step2"
                >
                  Next: Story Details
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Story Details ── */}
          {step === 2 && (
            <div className="space-y-7">
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">Story Details</h2>
                <p className="text-muted-foreground text-sm">Choose the theme, mood, and details for the adventure.</p>
              </div>

              {/* Character reminder */}
              {character1 && (
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50 border border-border">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white ring-2 ring-primary/20">
                    <img src={character1.characterImageUrl} alt={characterName} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="font-semibold">{characterName}</p>
                    <p className="text-xs text-muted-foreground">Your generated character</p>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <Label className="text-sm font-semibold">Relationship *</Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger className="mt-1.5" data-testid="select-relationship">
                      <SelectValue placeholder="Who is this for?" />
                    </SelectTrigger>
                    <SelectContent>
                      {['friend','sibling','parent','child','pet','grandparent','cousin'].map(r => (
                        <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showSecondChar && characterName2 && (
                  <div>
                    <Label className="text-sm font-semibold">Second character relationship</Label>
                    <Select value={relationship2} onValueChange={setRelationship2}>
                      <SelectTrigger className="mt-1.5" data-testid="select-relationship2">
                        <SelectValue placeholder="Their relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {['friend','sibling','parent','child','pet','grandparent','cousin'].map(r => (
                          <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold">Story Theme *</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="mt-1.5" data-testid="select-theme">
                      <SelectValue placeholder="Choose a theme" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        ['adventure','Adventure'],['space','Space Exploration'],['ocean','Ocean Voyage'],
                        ['jungle','Jungle Quest'],['magic','Magic & Wizards'],['fairy tale','Fairy Tale'],
                        ['sports','Sports Hero'],['cooking','Cooking Adventure'],['custom','Custom Theme'],
                      ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {theme === 'custom' && (
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-semibold">Describe your custom theme</Label>
                    <Input value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} placeholder="e.g., dinosaur rescue mission" className="mt-1.5" data-testid="input-custom-theme" />
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold">Age Group *</Label>
                  <Select value={age} onValueChange={setAge}>
                    <SelectTrigger className="mt-1.5" data-testid="select-age">
                      <SelectValue placeholder="Choose age" />
                    </SelectTrigger>
                    <SelectContent>
                      {[['2-3','2–3 years'],['4-5','4–5 years'],['6-7','6–7 years'],['8-10','8–10 years']].map(([v,l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Character Personality *</Label>
                  <Select value={emotion} onValueChange={setEmotion}>
                    <SelectTrigger className="mt-1.5" data-testid="select-emotion">
                      <SelectValue placeholder="Choose personality" />
                    </SelectTrigger>
                    <SelectContent>
                      {[['happy','Happy & Joyful'],['brave','Brave & Courageous'],['curious','Curious & Inquisitive'],
                        ['kind','Kind & Caring'],['funny','Funny & Playful'],['adventurous','Adventurous & Bold']].map(([v,l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Special Outfit (optional)</Label>
                  <Input value={outfit} onChange={(e) => setOutfit(e.target.value)} placeholder="e.g. superhero cape, princess dress" className="mt-1.5" data-testid="input-outfit" />
                </div>

                <div>
                  <Label className="text-sm font-semibold">Special Occasion (optional)</Label>
                  <Select value={occasion} onValueChange={setOccasion}>
                    <SelectTrigger className="mt-1.5" data-testid="select-occasion">
                      <SelectValue placeholder="Any occasion?" />
                    </SelectTrigger>
                    <SelectContent>
                      {[['birthday','Birthday'],['christmas','Christmas'],['halloween','Halloween'],
                        ['easter','Easter'],['graduation','Graduation'],['none','None']].map(([v,l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Additional story ideas (optional)</Label>
                <Textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Any specific details, moments, or places you'd like in the story?" className="mt-1.5 min-h-20" data-testid="textarea-user-prompt" />
              </div>

              <div className="flex justify-between pt-2">
                <Button onClick={() => setStep(1)} variant="outline" size="lg" className="rounded-xl" data-testid="button-back-step1">
                  <ArrowLeft className="mr-2 h-5 w-5" /> Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2} size="lg" className="rounded-xl" data-testid="button-next-step3">
                  Next: Finalise <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Final Details ── */}
          {step === 3 && (
            <div className="space-y-7">
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">Final Touches</h2>
                <p className="text-muted-foreground text-sm">Give your story a title and choose how many pages.</p>
              </div>

              {/* Character reminder */}
              {character1 && (
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50 border border-border">
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white">
                    <img src={character1.characterImageUrl} alt={characterName} className="w-full h-full object-contain" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold">{characterName}</p>
                    <p className="text-xs text-muted-foreground">{theme === 'custom' ? customTheme : theme} · {age} · {emotion}</p>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="title" className="text-sm font-semibold">Story Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g. ${characterName}'s Great Adventure`}
                  className="mt-1.5"
                  data-testid="input-title"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold">Number of Pages *</Label>
                <div className="grid grid-cols-4 gap-3 mt-1.5">
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

              <div className="flex justify-between pt-2">
                <Button onClick={() => setStep(2)} variant="outline" size="lg" className="rounded-xl" data-testid="button-back-step2">
                  <ArrowLeft className="mr-2 h-5 w-5" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || createStory.isPending || generateStory.isPending}
                  size="lg"
                  className="rounded-xl"
                  data-testid="button-create-submit"
                >
                  {createStory.isPending || generateStory.isPending ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating...</>
                  ) : (
                    <><Sparkles className="mr-2 h-5 w-5" /> Create Story</>
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
