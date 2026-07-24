import { useState, useEffect, useRef } from 'react';
import { useGetStoryForReading, getGetStoryForReadingQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ArrowLeft, BookOpen, Image, AlignLeft, Loader2, Printer } from 'lucide-react';

// ─── Coloring helpers ────────────────────────────────────────────────────────

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

// ─── A5 Image card ────────────────────────────────────────────────────────────

function A5ImageCard({
  src, alt, label, entry,
}: {
  src?: string | null; alt: string; label?: string; entry?: ColouringEntry;
}) {
  const isLoading = !entry || entry.status === 'loading';
  const displaySrc = entry?.status === 'done' ? entry.url : src;
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-xs font-medium text-amber-400/70 tracking-wider uppercase">{label}</p>}
      <div
        className="w-full bg-white rounded-xl overflow-hidden shadow-lg shadow-black/40 border border-white/10 relative"
        style={{ aspectRatio: `${148}/${210}` }}
      >
        {displaySrc ? (
          <img src={displaySrc} alt={alt} className="w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: isLoading ? 0.25 : 1 }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-amber-50">
            <Image className="w-12 h-12 text-amber-200" />
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70">
            <Loader2 className="w-7 h-7 text-gray-400 animate-spin mb-1.5" />
            <p className="text-[10px] text-gray-500 font-medium tracking-wide">Drawing lines…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── A5 Text card ─────────────────────────────────────────────────────────────

function A5TextCard({ text, pageNumber, label, title }: {
  text?: string | null; pageNumber: number; label?: string; title: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-xs font-medium text-amber-400/70 tracking-wider uppercase">{label}</p>}
      <div
        className="w-full bg-white rounded-xl overflow-hidden shadow-lg shadow-black/40 border border-white/10 flex flex-col"
        style={{ aspectRatio: `${148}/${210}` }}
      >
        <div className="px-5 pt-5 pb-2 border-b border-amber-900/10">
          <p className="text-[10px] text-black/40 tracking-widest uppercase text-center font-medium truncate">{title}</p>
        </div>
        <div className="flex-1 px-5 py-4 overflow-hidden flex items-start">
          {text ? (
            <p className="text-black/80 leading-relaxed" style={{
              fontFamily: "'Georgia', 'Times New Roman', serif",
              fontSize: 'clamp(9px, 1.8vw, 13px)',
              display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 14, overflow: 'hidden',
            }}>{text}</p>
          ) : (
            <div className="w-full flex items-center justify-center h-full">
              <AlignLeft className="w-8 h-8 text-amber-200" />
            </div>
          )}
        </div>
        <div className="px-5 pb-4 flex items-center justify-center">
          <span className="text-black/30" style={{ fontFamily: "'Georgia', serif", fontSize: 'clamp(9px, 1.6vw, 11px)' }}>
            {pageNumber}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoryView() {
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get('storyId') || '';

  const [colouringMap, setColouringMap] = useState<Map<string, ColouringEntry>>(new Map());
  const triggeredRef = useRef<Set<string>>(new Set());

  const { data: storyData, isLoading, isError } = useGetStoryForReading(storyId, {
    query: { enabled: !!storyId, queryKey: getGetStoryForReadingQueryKey(storyId) },
  });

  const story = storyData?.story;
  const pages = storyData?.pages || [];

  const allImageUrls: string[] = story
    ? [...(story.coverImageUrl ? [story.coverImageUrl] : []), ...pages.map(p => p.imageUrl).filter(Boolean) as string[]]
    : [];

  const anyLoading = allImageUrls.some(u => { const s = colouringMap.get(u)?.status; return !s || s === 'loading'; });

  function handlePrint() {
    if (!story) return;
    const coverUrl = story.coverImageUrl ? colouringMap.get(story.coverImageUrl)?.url ?? story.coverImageUrl : null;
    const storyPages = pages.map((p, i) => ({
      imageUrl: p.imageUrl ? (colouringMap.get(p.imageUrl)?.url ?? p.imageUrl) : null,
      text: p.text ?? '', num: i + 1,
    }));
    const pageStyle = `
      @page { size: A5 portrait; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: white; }
      .sheet { width: 148mm; height: 210mm; overflow: hidden; page-break-after: always; break-after: page; background: white; }
      .sheet:last-child { page-break-after: avoid; break-after: avoid; }
      .sheet img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .text-sheet { width: 148mm; height: 210mm; padding: 12mm 12mm 10mm; display: flex; flex-direction: column; page-break-after: always; break-after: page; background: white; }
      .text-sheet:last-child { page-break-after: avoid; break-after: avoid; }
      .text-title { font-family: Georgia, serif; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(0,0,0,0.4); text-align: center; border-bottom: 0.5pt solid rgba(0,0,0,0.15); padding-bottom: 4mm; margin-bottom: 6mm; }
      .text-body { font-family: Georgia, serif; font-size: 13pt; line-height: 1.75; color: #111; flex: 1; overflow: hidden; }
      .text-footer { font-family: Georgia, serif; font-size: 8pt; color: rgba(0,0,0,0.3); text-align: center; padding-top: 5mm; }
    `;
    const sheets: string[] = [];
    if (coverUrl) sheets.push(`<div class="sheet"><img src="${coverUrl}" alt="Cover" /></div>`);
    for (const p of storyPages) {
      if (p.imageUrl) sheets.push(`<div class="sheet"><img src="${p.imageUrl}" alt="Page ${p.num}" /></div>`);
      if (p.text) sheets.push(`<div class="text-sheet"><div class="text-title">${story.title}</div><div class="text-body">${p.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div><div class="text-footer">${p.num}</div></div>`);
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${story.title}</title><style>${pageStyle}</style></head><body>${sheets.join('\n')}</body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html); win.document.close();
    win.onload = () => win.print();
    win.document.addEventListener('DOMContentLoaded', () => {
      const imgs = Array.from(win.document.images);
      if (!imgs.length) { win.print(); return; }
      let loaded = 0;
      const check = () => { if (++loaded === imgs.length) win.print(); };
      imgs.forEach(img => { img.onload = check; img.onerror = check; });
    });
  }

  useEffect(() => {
    if (!story) return;
    const urls: string[] = [];
    if (story.coverImageUrl) urls.push(story.coverImageUrl);
    for (const p of pages) if (p.imageUrl) urls.push(p.imageUrl);
    const fresh = urls.filter(u => !triggeredRef.current.has(u));
    if (!fresh.length) return;
    for (const u of fresh) triggeredRef.current.add(u);
    setColouringMap(prev => { const next = new Map(prev); for (const u of fresh) next.set(u, { status: 'loading' }); return next; });
    for (const url of fresh) {
      fetchColouringPage(url)
        .then(colouringUrl => setColouringMap(prev => new Map(prev).set(url, { status: 'done', url: colouringUrl })))
        .catch(() => { triggeredRef.current.delete(url); setColouringMap(prev => new Map(prev).set(url, { status: 'error' })); });
    }
  }, [story, pages]);

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

  if (isError || !story) {
    return (
      <div className="min-h-[100dvh] bg-[#1a0e08] flex items-center justify-center p-4">
        <div className="bg-[#f5e6c8] rounded-2xl p-10 max-w-sm text-center">
          <BookOpen className="w-12 h-12 text-amber-800/40 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold mb-2 text-amber-900">Story Not Found</h2>
          <Link href="/library">
            <button className="mt-4 px-5 py-2.5 bg-amber-800 text-amber-50 rounded-xl text-sm font-medium">Back to Library</button>
          </Link>
        </div>
      </div>
    );
  }

  const gridClass = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';

  return (
    <div className="min-h-[100dvh] bg-[#1a0e08]">
      <div className="sticky top-0 z-20 bg-[#120a05]/95 border-b border-amber-900/30 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/read?storyId=${storyId}`}>
            <button className="flex items-center gap-1.5 text-amber-300/70 hover:text-amber-200 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-base font-bold text-amber-100 truncate">{story.title}</h1>
          </div>
          {anyLoading ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400/60 bg-amber-500/10 border border-amber-500/15 flex-shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing…
            </div>
          ) : (
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25 transition-all duration-200 flex-shrink-0">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        <section>
          <SectionHeading icon={BookOpen} title="Cover" />
          <div className="flex justify-center">
            <div className="w-full max-w-[220px] sm:max-w-[260px]">
              <A5ImageCard src={story.coverImageUrl} alt={story.title}
                entry={story.coverImageUrl ? colouringMap.get(story.coverImageUrl) : undefined} />
            </div>
          </div>
        </section>

        <section>
          <SectionHeading icon={Image} title="Illustrations" count={pages.length} />
          {pages.length > 0 ? (
            <div className={gridClass}>
              {pages.map((page, i) => (
                <A5ImageCard key={page.id} src={page.imageUrl}
                  alt={`Page ${page.pageNumber} illustration`} label={`Page ${i + 1}`}
                  entry={page.imageUrl ? colouringMap.get(page.imageUrl) : undefined} />
              ))}
            </div>
          ) : <p className="text-amber-400/40 text-sm">No illustrations yet.</p>}
        </section>

        <section>
          <SectionHeading icon={AlignLeft} title="Story" count={pages.length} />
          {pages.length > 0 ? (
            <div className={gridClass}>
              {pages.map((page, i) => (
                <A5TextCard key={page.id} text={page.text} pageNumber={i + 1}
                  label={`Page ${i + 1}`} title={story.title} />
              ))}
            </div>
          ) : <p className="text-amber-400/40 text-sm">No story text yet.</p>}
        </section>
      </div>
    </div>
  );
}
