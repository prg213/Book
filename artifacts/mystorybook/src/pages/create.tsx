import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useCreateStory, useGenerateStory } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Upload, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';

// ── Title suggestions keyed by theme ────────────────────────────────────────
const TITLE_SUGGESTIONS: Record<string, (name: string) => string[]> = {
  adventure:          (n) => [`${n}'s Adventure`, `${n} Explores`, `${n}'s Big Quest`],
  space:              (n) => [`${n} in Space`, `${n}'s Star Quest`, `${n} & the Stars`],
  ocean:              (n) => [`${n}'s Ocean Trip`, `${n} & the Sea`, `${n}'s Big Voyage`],
  jungle:             (n) => [`${n}'s Jungle Quest`, `${n} in the Jungle`, `${n} & the Vines`],
  magic:              (n) => [`${n}'s Magic Day`, `${n} the Wizard`, `${n}'s Spell`],
  'fairy tale':       (n) => [`${n}'s Fairy Tale`, `Once Upon ${n}`, `${n} & the Castle`],
  sports:             (n) => [`${n}'s Big Game`, `${n} the Champion`, `Go ${n}!`],
  cooking:            (n) => [`${n}'s Kitchen Fun`, `${n} Bakes a Cake`, `Chef ${n}`],
  pirates:            (n) => [`${n}'s Pirate Quest`, `Captain ${n}`, `${n} & the Map`],
  dinosaurs:          (n) => [`${n} & the Dinos`, `${n}'s Dino Day`, `${n} Meets a Dino`],
  superheroes:        (n) => [`${n} Saves the Day`, `${n}'s Super Power`, `Super ${n}`],
  'enchanted forest': (n) => [`${n}'s Forest Quest`, `${n} & the Fairies`, `${n} in the Woods`],
  'time travel':      (n) => [`${n}'s Time Trip`, `${n} Through Time`, `${n} & the Clock`],
  circus:             (n) => [`${n}'s Big Show`, `${n} at the Circus`, `Amazing ${n}`],
  'farm animals':     (n) => [`${n} on the Farm`, `${n}'s Farm Day`, `${n} & the Animals`],
  'winter wonderland':(n) => [`${n}'s Snow Day`, `${n} & the Snowman`, `${n} in the Snow`],
  'desert safari':    (n) => [`${n}'s Safari`, `${n} in the Desert`, `${n} & the Camel`],
  'robot city':       (n) => [`${n} & the Robots`, `${n}'s Robot Day`, `${n} in Robot City`],
  custom:             (n) => [`${n}'s Adventure`, `${n}'s Big Day`, `${n} Explores`],
};

function pickTitle(theme: string, name: string, suggestionIndex: number): string {
  const fn = TITLE_SUGGESTIONS[theme] ?? TITLE_SUGGESTIONS['custom'];
  const list = fn(name || 'My Hero');
  return list[suggestionIndex % list.length];
}

// ── Outfit options keyed by story theme ─────────────────────────────────────
const OUTFIT_OPTIONS: Record<string, Array<{ emoji: string; label: string; value: string }>> = {
  adventure: [
    { emoji: '🎒', label: 'Explorer Gear', value: 'explorer outfit with backpack, wide-brim hat, and utility belt' },
    { emoji: '🦺', label: 'Safari Vest', value: 'khaki safari outfit with utility vest and pith helmet' },
    { emoji: '🧗', label: 'Climber', value: 'bright mountain climber outfit with harness and climbing helmet' },
    { emoji: '🗺️', label: 'Treasure Hunter', value: 'treasure hunter outfit with satchel bag and rolled map' },
    { emoji: '🌿', label: 'Jungle Explorer', value: 'jungle explorer outfit with leaf accessories and binoculars' },
    { emoji: '⛺', label: 'Ranger Vest', value: 'forest ranger vest with badges, cargo trousers, and boots' },
  ],
  space: [
    { emoji: '🚀', label: 'Astronaut Suit', value: 'white NASA-style astronaut space suit with clear helmet visor' },
    { emoji: '🌌', label: 'Galaxy Jumpsuit', value: 'shimmering midnight-blue galaxy-print jumpsuit with star accessories' },
    { emoji: '✈️', label: 'Rocket Pilot', value: 'sleek silver rocket pilot uniform with wings badge and flight gloves' },
    { emoji: '⭐', label: 'Star Commander', value: 'navy star commander uniform with gold epaulettes and star emblem' },
    { emoji: '🛸', label: 'Cosmic Explorer', value: 'futuristic teal cosmic explorer suit with glowing trim and jetpack' },
    { emoji: '🌙', label: 'Moon Walker', value: 'pearlescent silver moon-walker suit with crescent moon emblem' },
  ],
  ocean: [
    { emoji: '⚓', label: 'Sailor Outfit', value: 'classic navy sailor outfit with white stripes, anchor badge, and captain hat' },
    { emoji: '🧜', label: 'Mermaid Tail', value: 'shimmering teal and purple mermaid tail with shell crown and accessories' },
    { emoji: '🤿', label: 'Diving Suit', value: 'bright orange diving suit with flippers, mask, and oxygen tank' },
    { emoji: '👒', label: 'Captain Uniform', value: 'white ship captain uniform with gold buttons and captain hat' },
    { emoji: '🐠', label: 'Sea Explorer', value: 'aqua sea explorer outfit with waterproof vest and tide chart satchel' },
    { emoji: '🌊', label: 'Surf Gear', value: 'colourful wetsuit with surf badge and waterproof accessories' },
  ],
  jungle: [
    { emoji: '🦺', label: 'Safari Vest', value: 'olive green safari vest with cargo shorts and expedition boots' },
    { emoji: '🌿', label: 'Vine-Swinger', value: 'vine-swinger outfit with rope belt and jungle camouflage' },
    { emoji: '🦁', label: 'Nature Explorer', value: 'tan nature explorer outfit with animal-tracker badge' },
    { emoji: '🌴', label: 'Jungle Ranger', value: 'jungle ranger uniform with leaf insignia and machete holster' },
    { emoji: '🐯', label: 'Tiger Costume', value: 'orange and black tiger-stripe costume with furry ear headband' },
    { emoji: '🍃', label: 'Leaf Cloak', value: 'magical leaf cloak woven from giant tropical leaves with vine belt' },
  ],
  magic: [
    { emoji: '🧙', label: 'Wizard Robe', value: 'flowing midnight-blue wizard robe with silver stars and pointed hat' },
    { emoji: '🧹', label: 'Witch Cloak', value: 'purple witch cloak with crescent moon embroidery and tall pointy hat' },
    { emoji: '👗', label: 'Enchanted Gown', value: 'sparkling enchanted gown with iridescent fabric and glowing trim' },
    { emoji: '🪄', label: 'Sorcerer Cape', value: 'deep crimson sorcerer cape with magic wand holster and arcane symbols' },
    { emoji: '🧚', label: 'Fairy Wings', value: 'pastel fairy outfit with translucent wings, flower crown, and wand' },
    { emoji: '🎩', label: 'Apprentice', value: 'magic apprentice uniform with oversized hat and enchanted satchel' },
  ],
  'fairy tale': [
    { emoji: '👸', label: 'Princess Gown', value: 'magnificent princess ball gown with tiara and royal sash' },
    { emoji: '⚔️', label: 'Knight Armour', value: 'shining silver knight armour with royal crest shield and sword' },
    { emoji: '👑', label: 'Royal Cape', value: 'velvet royal cape with crown and jewelled brooch' },
    { emoji: '🐉', label: 'Dragon Rider', value: 'dragon rider outfit with scaled armour, goggles, and flame-proof gloves' },
    { emoji: '🌈', label: 'Magic Cloak', value: 'rainbow enchanted cloak that shifts colour with magical boots' },
    { emoji: '🧝', label: 'Elf Tunic', value: 'forest elf tunic with pointy ears, leaf belt, and enchanted bow' },
  ],
  sports: [
    { emoji: '⚽', label: 'Football Kit', value: 'bright football kit with number on back, shin guards, and cleats' },
    { emoji: '🏅', label: 'Tracksuit', value: 'sleek Olympic tracksuit with country flag badge and gold medal' },
    { emoji: '👕', label: 'Team Jersey', value: 'personalised team jersey with name and number, shorts, and trainers' },
    { emoji: '🏎️', label: 'Racing Suit', value: 'colourful racing driver suit with helmet, gloves, and sponsor patches' },
    { emoji: '🤸', label: 'Gymnastics', value: 'sparkly gymnastics leotard with ribbon accessories and ballet shoes' },
    { emoji: '🏆', label: 'Champion Cape', value: 'champion outfit with trophy-print cape and gold championship belt' },
  ],
  cooking: [
    { emoji: '👨‍🍳', label: "Chef's Whites", value: "tall white chef's hat and double-breasted chef jacket with apron" },
    { emoji: '🧁', label: 'Baker Outfit', value: 'pink baker outfit with cupcake-print apron and flour-dusted mitts' },
    { emoji: '🍰', label: 'Pastry Chef', value: 'elegant pastry chef whites with piping bag holster and sugar decorations' },
    { emoji: '⭐', label: 'Master Chef', value: 'black master chef uniform with gold star badge and signature apron' },
    { emoji: '🥄', label: 'Kitchen Helper', value: 'colourful kitchen assistant outfit with utensil pockets and chef clogs' },
    { emoji: '🍬', label: 'Candy Maker', value: 'candy-striped candy maker outfit with swirly lollipop accessories' },
  ],
  pirates: [
    { emoji: '🏴‍☠️', label: 'Pirate Captain', value: 'grand pirate captain coat with tricorn hat, gold buttons, and boots' },
    { emoji: '⚔️', label: 'Swashbuckler', value: 'swashbuckler outfit with bandana, cutlass belt, and striped shirt' },
    { emoji: '🗺️', label: 'Sea Rogue', value: 'sea rogue outfit with treasure map satchel and weathered coat' },
    { emoji: '🦜', label: 'Buccaneer', value: 'colourful buccaneer outfit with parrot shoulder companion and coin purse' },
    { emoji: '🚢', label: 'First Mate', value: "first mate's uniform with spyglass, navy coat, and anchor-print scarf" },
    { emoji: '💎', label: 'Treasure Diver', value: 'treasure diver outfit with pearl necklace, diving mask, and net bag' },
  ],
  dinosaurs: [
    { emoji: '🦕', label: 'Dino Tamer', value: 'brave dino tamer outfit with dino-scale armour and taming lasso' },
    { emoji: '🏕️', label: 'Fossil Hunter', value: 'prehistoric explorer outfit with fossil-finder kit and dino-claw cap' },
    { emoji: '🦖', label: 'Raptor Rider', value: 'raptor rider outfit with protective vest, goggles, and riding boots' },
    { emoji: '🔍', label: 'Bone Digger', value: 'fossil hunter outfit with magnifying glass, brush kit, and khaki vest' },
    { emoji: '🌿', label: 'Dino Ranger', value: 'dino ranger uniform with dinosaur patches, tracker badge, and field cap' },
    { emoji: '🪖', label: 'Jungle Suit', value: 'camouflage jungle suit with dino-bone accessories and expedition pack' },
  ],
  superheroes: [
    { emoji: '🦸', label: 'Cape & Mask', value: 'bright superhero costume with swirling cape and matching eye mask' },
    { emoji: '⚡', label: 'Power Suit', value: 'sleek armoured power suit with glowing chest emblem and power gauntlets' },
    { emoji: '🛡️', label: 'Guardian Armour', value: 'guardian armour with personalised shield, utility belt, and emblem' },
    { emoji: '💥', label: 'Lightning Hero', value: 'electric-yellow lightning hero suit with bolt emblem and speed boots' },
    { emoji: '🥷', label: 'Stealth Suit', value: 'midnight stealth suit with utility pouches, grapple hook, and goggles' },
    { emoji: '🌟', label: 'Star Hero', value: 'star-print hero costume with sparkle trail cape and star badge' },
  ],
  'enchanted forest': [
    { emoji: '🧚', label: 'Fairy Outfit', value: 'pastel fairy outfit with shimmering wings, flower crown, and glow wand' },
    { emoji: '🌳', label: 'Forest Sprite', value: 'forest sprite outfit woven from leaves and moss with acorn accessories' },
    { emoji: '🧝', label: 'Woodland Elf', value: 'woodland elf tunic with pointed ears headband, leaf cloak, and bow' },
    { emoji: '🌿', label: 'Nature Guardian', value: 'nature guardian robe with vine belt, crystal staff, and flower wreath' },
    { emoji: '🌲', label: 'Tree Keeper', value: 'tree keeper outfit with bark-texture vest, pinecone belt, and root boots' },
    { emoji: '🍄', label: 'Mushroom Suit', value: 'whimsical mushroom costume with spotted cap, white tunic, and toadstool bag' },
  ],
  'time travel': [
    { emoji: '⚙️', label: 'Steampunk Gear', value: 'steampunk outfit with brass goggles, gear-print coat, and pocket watch' },
    { emoji: '✈️', label: 'Time Pilot', value: 'time pilot jumpsuit with chronometer watch, navigator goggles, and scarf' },
    { emoji: '🎩', label: 'Victorian Explorer', value: 'Victorian explorer outfit with top hat, brass compass, and tail coat' },
    { emoji: '🚀', label: 'Future Suit', value: 'sleek future suit with holographic display visor and neon trim' },
    { emoji: '🏰', label: 'Medieval Knight', value: 'medieval knight armour with visor helmet and royal crest shield' },
    { emoji: '🎭', label: '1920s Adventurer', value: '1920s adventurer outfit with driving goggles, leather jacket, and boots' },
  ],
  circus: [
    { emoji: '🎪', label: 'Ringmaster', value: 'grand ringmaster outfit with tall top hat, red tail coat, and whip prop' },
    { emoji: '🤸', label: 'Acrobat Suit', value: 'sparkly acrobat leotard with sequins, tutu skirt, and ankle ribbons' },
    { emoji: '🤡', label: 'Clown Costume', value: 'colourful clown costume with giant bow tie, polka dots, and red nose' },
    { emoji: '🎯', label: 'Tightrope Walker', value: 'elegant tightrope walker outfit with parasol, sequined bodysuit, and slippers' },
    { emoji: '🎩', label: 'Magician', value: "magician's tuxedo with top hat, white gloves, and magic wand" },
    { emoji: '🎡', label: 'Trapeze Artist', value: 'trapeze artist costume with wings, glitter bodysuit, and arm bands' },
  ],
  'farm animals': [
    { emoji: '👨‍🌾', label: 'Farmer Overalls', value: 'classic denim farmer overalls with straw hat, boots, and pitchfork' },
    { emoji: '🤠', label: 'Cowboy', value: 'cowboy outfit with wide-brim hat, boots, bandana, and lasso' },
    { emoji: '🌾', label: 'Scarecrow', value: 'fun scarecrow costume with patched clothing, straw hat, and hay details' },
    { emoji: '🐄', label: 'Ranch Rider', value: 'ranch rider outfit with riding boots, saddle vest, and rope coil' },
    { emoji: '🚜', label: 'Barn Keeper', value: 'barn keeper outfit with plaid shirt, tool belt, and muddy gumboots' },
    { emoji: '🌻', label: 'Haymaker', value: 'cheerful haymaker outfit with sunflower hat, apron, and garden gloves' },
  ],
  'winter wonderland': [
    { emoji: '❄️', label: 'Snow Explorer', value: 'thick padded snow explorer suit with fur-trim hood and snowshoes' },
    { emoji: '👸', label: 'Ice Princess', value: 'crystalline ice princess gown with snowflake crown and frost-white cape' },
    { emoji: '🧙', label: 'Winter Wizard', value: 'silver-blue winter wizard robe with snowflake staff and icy crown' },
    { emoji: '🐧', label: 'Polar Adventurer', value: 'polar adventurer parka with fur trim, goggles, and penguin companion' },
    { emoji: '🧚', label: 'Frost Fairy', value: 'frost fairy outfit with icicle wings, silver dress, and ice wand' },
    { emoji: '⛄', label: 'Snowflake Knight', value: 'snowflake knight armour with ice-crystal shield and frost-blue plume' },
  ],
  'desert safari': [
    { emoji: '🏜️', label: 'Desert Explorer', value: 'desert explorer outfit with sand-dune hat, UV scarf, and canteen' },
    { emoji: '👘', label: 'Bedouin Robe', value: 'flowing white bedouin robe with golden headscarf and silver jewellery' },
    { emoji: '🐪', label: 'Camel Rider', value: 'camel rider outfit with riding boots, loose linen trousers, and goggles' },
    { emoji: '🏄', label: 'Dune Surfer', value: 'cool dune surfer outfit with board shorts, sunglasses, and sand glider' },
    { emoji: '🌴', label: 'Oasis Keeper', value: 'oasis keeper outfit with palm-leaf accessories and water jug satchel' },
    { emoji: '🔭', label: 'Desert Ranger', value: 'desert ranger uniform with star map, compass, and cactus badge' },
  ],
  'robot city': [
    { emoji: '🤖', label: 'Robot Suit', value: 'metallic silver robot suit with light-up chest panel and antenna headgear' },
    { emoji: '✈️', label: 'Tech Pilot', value: 'tech pilot jumpsuit with heads-up display visor and jet-boot thrusters' },
    { emoji: '🔭', label: 'Cyber Explorer', value: 'cyber explorer outfit with holographic map visor and magnetic tool belt' },
    { emoji: '🛡️', label: 'AI Guardian', value: 'AI guardian armour with energy shield projector and circuit patterns' },
    { emoji: '🔧', label: 'Gadget Gear', value: 'inventor gadget gear overalls with multitool belt and spark-proof gloves' },
    { emoji: '⚡', label: 'Circuit Costume', value: 'glowing circuit-pattern costume with LED accents and power core badge' },
  ],
  custom: [
    { emoji: '🦸', label: 'Hero Outfit', value: 'custom hero outfit with personalised cape and unique emblem' },
    { emoji: '👑', label: 'Royal Gown', value: 'magnificent royal gown with crown, jewelled accessories, and royal sash' },
    { emoji: '🎒', label: 'Adventure Gear', value: 'adventure gear with explorer backpack, utility belt, and map satchel' },
    { emoji: '✨', label: 'Fantasy Costume', value: 'enchanted fantasy costume with magical accessories and sparkling details' },
    { emoji: '🌍', label: 'Explorer Outfit', value: 'world explorer outfit with travel satchel, compass, and field jacket' },
    { emoji: '🪄', label: 'Magical Attire', value: 'magical attire with shimmering fabric, arcane accessories, and enchanted boots' },
  ],
};

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
  const [outfit, setOutfit] = useState('');
  const [age, setAge] = useState('');
  const [emotion, setEmotion] = useState('');
  const [title, setTitle] = useState('');
  const [pageCount, setPageCount] = useState(6);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const titleManuallyEdited = useRef(false);

  // Auto-generate title whenever theme or characterName changes (unless user typed their own)
  const autoTitle = useCallback((t: string, n: string, idx: number) => {
    if (!t) return;
    titleManuallyEdited.current = false;
    setTitle(pickTitle(t, n, idx));
  }, []);

  useEffect(() => {
    if (!titleManuallyEdited.current) {
      autoTitle(theme, characterName, suggestionIndex);
    }
  }, [theme, characterName, suggestionIndex, autoTitle]);

  const handleRefreshTitle = () => {
    titleManuallyEdited.current = false;
    setSuggestionIndex((i) => i + 1);
  };

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
          pageCount,
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
                  <Select value={theme} onValueChange={(v) => { setTheme(v); setOutfit(''); }}>
                    <SelectTrigger className="mt-1.5" data-testid="select-theme">
                      <SelectValue placeholder="Choose a theme" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      {[
                        ['adventure','🗺️ Adventure'],
                        ['space','🚀 Space Exploration'],
                        ['ocean','🌊 Ocean Voyage'],
                        ['jungle','🌴 Jungle Quest'],
                        ['magic','🪄 Magic & Wizards'],
                        ['fairy tale','🧚 Fairy Tale'],
                        ['sports','⚽ Sports Hero'],
                        ['cooking','👨‍🍳 Cooking Adventure'],
                        ['pirates','🏴‍☠️ Pirates'],
                        ['dinosaurs','🦕 Dinosaurs'],
                        ['superheroes','🦸 Superheroes'],
                        ['enchanted forest','🌲 Enchanted Forest'],
                        ['time travel','⏰ Time Travel'],
                        ['circus','🎪 Circus'],
                        ['farm animals','🐄 Farm Animals'],
                        ['winter wonderland','❄️ Winter Wonderland'],
                        ['desert safari','🏜️ Desert Safari'],
                        ['robot city','🤖 Robot City'],
                        ['custom','✏️ Custom Theme'],
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

                {theme && (
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-semibold">
                      Outfit <span className="font-normal text-muted-foreground">— choose what your character wears in every illustration</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-2 mt-2" data-testid="outfit-grid">
                      {(OUTFIT_OPTIONS[theme] ?? OUTFIT_OPTIONS['custom']).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setOutfit(outfit === opt.value ? '' : opt.value)}
                          data-testid={`outfit-opt-${opt.label.toLowerCase().replace(/\s+/g, '-')}`}
                          className={[
                            'flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-center transition-all',
                            outfit === opt.value
                              ? 'border-primary bg-primary/10 text-primary font-semibold'
                              : 'border-border bg-muted/30 hover:border-primary/50 text-foreground',
                          ].join(' ')}
                        >
                          <span className="text-2xl leading-none">{opt.emoji}</span>
                          <span className="text-[11px] leading-tight">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                    {outfit && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        ✓ Your character will wear this outfit throughout the whole story.
                      </p>
                    )}
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
                <div className="flex gap-2 mt-1.5">
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => {
                      titleManuallyEdited.current = true;
                      setTitle(e.target.value.slice(0, 30));
                    }}
                    placeholder={theme ? pickTitle(theme, characterName, 0) : "Choose a theme first"}
                    className="flex-1"
                    maxLength={30}
                    data-testid="input-title"
                  />
                  {theme && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleRefreshTitle}
                      title="Suggest another title"
                      className="shrink-0"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className={`text-xs mt-1 ${title.length >= 28 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  {title.length >= 28
                    ? `Almost full — ${30 - title.length} characters left`
                    : 'Auto-suggested from your theme — edit freely or tap ↺ for another idea'}
                </p>
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
