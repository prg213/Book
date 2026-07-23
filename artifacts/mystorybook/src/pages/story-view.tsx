import { useState, useCallback } from 'react';
import { useGetStoryForReading, getGetStoryForReadingQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ArrowLeft, BookOpen, Image, AlignLeft, Palette, Loader2 } from 'lucide-react';

// A5 aspect ratio: 148mm × 210mm
const A5_RATIO = 210 / 148;

type ColouringState = 'idle' | 'loading' | 'done' | 'error';
interface ColouringEntry { status: ColouringState; url?: string }

async function fetchColouringPage(imageUrl: string): Promise<string> {
  const resp = await fetch(`${import.meta.env.BASE_URL}api/colouring-page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
  if (!resp.ok) throw new Error(`Server error ${resp.status}`);
  const { colouringUrl } = await resp.json() as { colouringUrl: string };
  return colouringUrl;
}

function A5ImageCard({
  src,
  alt,
  label,
  colouringEntry,
  colouringMode,
}: {
  src?: string | null;
  alt: string;
  label?: string;
  colouringEntry?: ColouringEntry;
  colouringMode: boolean;
}) {
  const showColouring = colouringMode && colouringEntry;
  const isLoading = showColouring && colouringEntry.status === 'loading';
  const displaySrc = showColouring && colouringEntry.status === 'done' ? colouringEntry.url : src;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="text-xs font-medium text-amber-400/70 tracking-wider uppercase">{label}</p>
      )}
      <div
        className="w-full bg-white rounded-xl overflow-hidden shadow-lg shadow-black/40 border border-white/10 relative"
        style={{ aspectRatio: `${148}/${210}` }}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={alt}
            className="w-full h-full object-cover transition-opacity duration-300"
            style={{ opacity: isLoading ? 0.3 : 1 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-amber-50">
            <Image className="w-12 h-12 text-amber-200" />
          </div>
        )}
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-2" />
            <p className="text-[10px] text-gray-500 font-medium tracking-wide">Drawing lines…</p>
          </div>
        )}
        {/* Error badge */}
        {showColouring && colouringEntry.status === 'error' && (
          <div className="absolute bottom-2 inset-x-2 bg-red-100 rounded text-red-600 text-[9px] text-center py-1 px-2">
            Couldn't transform — showing original
          </div>
        )}
      </div>
    </div>
  );
}

function A5TextCard({
  text,
  pageNumber,
  label,
  title,
}: {
  text?: string | null;
  pageNumber: number;
  label?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="text-xs font-medium text-amber-400/70 tracking-wider uppercase">{label}</p>
      )}
      <div
        className="w-full bg-[#fdf8f0] rounded-xl overflow-hidden shadow-lg shadow-black/40 border border-white/10 flex flex-col"
        style={{ aspectRatio: `${148}/${210}` }}
      >
        <div className="px-5 pt-5 pb-2 border-b border-amber-900/10">
          <p className="text-[10px] text-amber-900/40 tracking-widest uppercase text-center font-medium truncate">
            {title}
          </p>
        </div>
        <div className="flex-1 px-5 py-4 overflow-hidden flex items-start">
          {text ? (
            <p
              className="text-amber-950/80 leading-relaxed"
              style={{
                fontFamily: "'Georgia', 'Times New Roman', serif",
                fontSize: 'clamp(9px, 1.8vw, 13px)',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 14,
                overflow: 'hidden',
              }}
            >
              {text}
            </p>
          ) : (
            <div className="w-full flex items-center justify-center h-full">
              <AlignLeft className="w-8 h-8 text-amber-200" />
            </div>
          )}
        </div>
        <div className="px-5 pb-4 flex items-center justify-center">
          <span
            className="text-amber-900/30"
            style={{ fontFamily: "'Georgia', serif", fontSize: 'clamp(9px, 1.6vw, 11px)' }}
          >
            {pageNumber}
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-amber-400" />
      </div>
      <h2 className="font-display text-lg font-bold text-amber-100">{title}</h2>
      {count !== undefined && (
        <span className="text-xs text-amber-400/50 font-medium ml-auto">
          {count} {count === 1 ? 'page' : 'pages'}
        </span>
      )}
    </div>
  );
}

export default function StoryView() {
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get('storyId') || '';
  const [colouringMode, setColouringMode] = useState(false);
  // key = original imageUrl, value = { status, url? }
  const [colouringMap, setColouringMap] = useState<Map<string, ColouringEntry>>(new Map());

  const { data: storyData, isLoading, isError } = useGetStoryForReading(storyId, {
    query: {
      enabled: !!storyId,
      queryKey: getGetStoryForReadingQueryKey(storyId),
    },
  });

  const story = storyData?.story;
  const pages = storyData?.pages || [];

  const triggerColouring = useCallback(async (allUrls: string[]) => {
    // Mark all as loading (skip already done/loading)
    setColouringMap(prev => {
      const next = new Map(prev);
      for (const url of allUrls) {
        if (!next.has(url) || next.get(url)!.status === 'error') {
          next.set(url, { status: 'loading' });
        }
      }
      return next;
    });

    // Fire all requests in parallel
    await Promise.all(
      allUrls
        .filter(url => {
          const existing = colouringMap.get(url);
          return !existing || existing.status === 'error';
        })
        .map(async (url) => {
          try {
            const colouringUrl = await fetchColouringPage(url);
            setColouringMap(prev => new Map(prev).set(url, { status: 'done', url: colouringUrl }));
          } catch {
            setColouringMap(prev => new Map(prev).set(url, { status: 'error' }));
          }
        })
    );
  }, [colouringMap]);

  const handleToggle = useCallback(() => {
    const next = !colouringMode;
    setColouringMode(next);
    if (next && story) {
      const urls: string[] = [];
      if (story.coverImageUrl) urls.push(story.coverImageUrl);
      for (const p of pages) if (p.imageUrl) urls.push(p.imageUrl);
      triggerColouring(urls);
    }
  }, [colouringMode, story, pages, triggerColouring]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#1a0e08] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-amber-200/60 text-sm">Loading story…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (isError || !story) {
    return (
      <div className="min-h-[100dvh] bg-[#1a0e08] flex items-center justify-center p-4">
        <div className="bg-[#f5e6c8] rounded-2xl p-10 max-w-sm text-center">
          <BookOpen className="w-12 h-12 text-amber-800/40 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold mb-2 text-amber-900">Story Not Found</h2>
          <Link href="/library">
            <button className="mt-4 px-5 py-2.5 bg-amber-800 text-amber-50 rounded-xl text-sm font-medium">
              Back to Library
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';

  return (
    <div className="min-h-[100dvh] bg-[#1a0e08]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#120a05]/95 border-b border-amber-900/30 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/read?storyId=${storyId}`}>
            <button className="flex items-center gap-1.5 text-amber-300/70 hover:text-amber-200 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-base font-bold text-amber-100 truncate">{story.title}</h1>
          </div>
          {/* Colouring page toggle */}
          <button
            onClick={handleToggle}
            title={colouringMode ? 'Switch to full colour' : 'Switch to colouring page'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border flex-shrink-0 ${
              colouringMode
                ? 'bg-white text-gray-800 border-gray-300 shadow-inner'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/20 hover:bg-amber-500/25'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            {colouringMode ? 'Full colour' : 'Colour me!'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">

        {/* ── Cover ─────────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading icon={BookOpen} title="Cover" />
          <div className="flex justify-center">
            <div className="w-full max-w-[220px] sm:max-w-[260px]">
              <A5ImageCard
                src={story.coverImageUrl}
                alt={story.title}
                colouringMode={colouringMode}
                colouringEntry={story.coverImageUrl ? colouringMap.get(story.coverImageUrl) : undefined}
              />
            </div>
          </div>
        </section>

        {/* ── Illustrations ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeading icon={Image} title="Illustrations" count={pages.length} />
          {pages.length > 0 ? (
            <div className={gridClass}>
              {pages.map((page, i) => (
                <A5ImageCard
                  key={page.id}
                  src={page.imageUrl}
                  alt={`Page ${page.pageNumber} illustration`}
                  label={`Page ${i + 1}`}
                  colouringMode={colouringMode}
                  colouringEntry={page.imageUrl ? colouringMap.get(page.imageUrl) : undefined}
                />
              ))}
            </div>
          ) : (
            <p className="text-amber-400/40 text-sm">No illustrations yet.</p>
          )}
        </section>

        {/* ── Story ─────────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading icon={AlignLeft} title="Story" count={pages.length} />
          {pages.length > 0 ? (
            <div className={gridClass}>
              {pages.map((page, i) => (
                <A5TextCard
                  key={page.id}
                  text={page.text}
                  pageNumber={i + 1}
                  label={`Page ${i + 1}`}
                  title={story.title}
                />
              ))}
            </div>
          ) : (
            <p className="text-amber-400/40 text-sm">No story text yet.</p>
          )}
        </section>

      </div>
    </div>
  );
}
