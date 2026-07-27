import { useState, useEffect, useRef } from 'react';
import { useGetStoryForReading, getGetStoryForReadingQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { ArrowLeft, BookOpen, Image, AlignLeft, Loader2, Printer, ShoppingCart, Package, Sparkles, X } from 'lucide-react';
import { isCapacitor } from '@/lib/capacitor';
import { useUser } from '@clerk/react';

// ── Order modal ───────────────────────────────────────────────────────────────
function OrderModal({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const [loading, setLoading] = useState<'digital' | 'print' | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const { isSignedIn } = useUser();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/stripe/products`)
      .then(r => r.json())
      .then(d => setProducts(d.data ?? []))
      .catch(() => {});
  }, []);

  const getPriceId = (type: 'digital' | 'print') => {
    const name = type === 'digital' ? 'Story Generation' : 'Printed Storybook';
    const product = products.find((p: any) => p.name === name);
    return product?.prices?.[0]?.id ?? null;
  };

  const checkout = async (type: 'digital' | 'print') => {
    const priceId = getPriceId(type);
    if (!priceId) { alert('Products not available yet. Please try again shortly.'); return; }
    setLoading(type);
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, storyId, productType: type }),
      });
      const { url, error } = await r.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (e: any) {
      alert(e.message ?? 'Checkout failed. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
         onClick={onClose}>
      <div className="w-full max-w-sm bg-[#1e1008] border border-amber-800/40 rounded-2xl p-6 shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-amber-100">Order This Story</h2>
          <button onClick={onClose} className="text-amber-400/60 hover:text-amber-300 rounded-full p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Digital */}
          <button
            onClick={() => checkout('digital')}
            disabled={!!loading}
            className="w-full flex items-start gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all text-left disabled:opacity-50">
            <div className="rounded-lg bg-amber-500/20 p-2 mt-0.5 shrink-0">
              {loading === 'digital' ? <Loader2 className="h-5 w-5 text-amber-400 animate-spin" /> : <Sparkles className="h-5 w-5 text-amber-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-amber-100 text-sm">Story Generation</p>
                <p className="font-bold text-amber-300">£4.99</p>
              </div>
              <p className="text-amber-400/60 text-xs mt-0.5">Generate your personalised AI storybook</p>
            </div>
          </button>

          {/* Print */}
          <button
            onClick={() => checkout('print')}
            disabled={!!loading}
            className="w-full flex items-start gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-left disabled:opacity-50">
            <div className="rounded-lg bg-blue-500/20 p-2 mt-0.5 shrink-0">
              {loading === 'print' ? <Loader2 className="h-5 w-5 text-blue-400 animate-spin" /> : <Package className="h-5 w-5 text-blue-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-amber-100 text-sm">Printed Storybook</p>
                <p className="font-bold text-blue-300">£14.99</p>
              </div>
              <p className="text-amber-400/60 text-xs mt-0.5">Professionally printed &amp; delivered to your door</p>
            </div>
          </button>
        </div>

        {!isSignedIn && (
          <p className="text-amber-400/50 text-xs text-center mt-4">
            You'll be asked to enter your details at checkout
          </p>
        )}
      </div>
    </div>
  );
}

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
          <img src={displaySrc} alt={alt} className="w-full h-full object-contain transition-opacity duration-500"
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

const CACHE_PREFIX = 'colouring-cache-v1:';

function loadCache(storyId: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + storyId) || '{}'); } catch { return {}; }
}
function saveCache(storyId: string, record: Record<string, string>) {
  try { localStorage.setItem(CACHE_PREFIX + storyId, JSON.stringify(record)); } catch { /* storage full */ }
}

export default function StoryView() {
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get('storyId') || '';

  const [showOrderModal, setShowOrderModal] = useState(false);

  const [colouringMap, setColouringMap] = useState<Map<string, ColouringEntry>>(() => {
    const cache = loadCache(storyId);
    const map = new Map<string, ColouringEntry>();
    for (const [url, colouringUrl] of Object.entries(cache)) {
      map.set(url, { status: 'done', url: colouringUrl });
    }
    return map;
  });
  const triggeredRef = useRef<Set<string>>(new Set(Object.keys(loadCache(storyId))));

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
      .cover-sheet { width: 148mm; height: 210mm; overflow: hidden; page-break-after: always; break-after: page; background: white; position: relative; }
      .cover-sheet:last-child { page-break-after: avoid; break-after: avoid; }
      .cover-sheet img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .cover-title { position: absolute; bottom: 0; left: 0; right: 0; padding: 8mm 10mm 6mm; background: linear-gradient(transparent, rgba(0,0,0,0.7)); text-align: center; }
      .cover-title h1 { font-family: Georgia, serif; font-size: 18pt; font-weight: bold; color: white; margin: 0; text-shadow: 0 1px 4px rgba(0,0,0,0.8); line-height: 1.3; }
      .text-sheet { width: 148mm; height: 210mm; padding: 12mm 14mm 10mm; display: flex; flex-direction: column; page-break-after: always; break-after: page; background: white; }
      .text-sheet:last-child { page-break-after: avoid; break-after: avoid; }
      .text-title { font-family: Georgia, serif; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(0,0,0,0.4); text-align: center; border-bottom: 0.5pt solid rgba(0,0,0,0.15); padding-bottom: 4mm; margin-bottom: 0; }
      .text-body { font-family: Georgia, serif; font-size: 17pt; line-height: 1.85; color: #111; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .text-body p { text-align: center; margin: 0; }
      .text-footer { font-family: Georgia, serif; font-size: 8pt; color: rgba(0,0,0,0.3); text-align: center; padding-top: 4mm; }
    `;
    const sheets: string[] = [];
    if (coverUrl) sheets.push(`<div class="cover-sheet"><img src="${coverUrl}" alt="Cover" /><div class="cover-title"><h1>${story.title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1></div></div>`);
    for (const p of storyPages) {
      if (p.imageUrl) sheets.push(`<div class="sheet"><img src="${p.imageUrl}" alt="Page ${p.num}" /></div>`);
      if (p.text) sheets.push(`<div class="text-sheet"><div class="text-title">${story.title}</div><div class="text-body"><p>${p.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></div><div class="text-footer">${p.num}</div></div>`);
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${story.title}</title><style>${pageStyle}</style></head><body>${sheets.join('\n')}</body></html>`;

    // Use a hidden iframe so printing works inside iframe-hosted environments
    // (window.open triggers HTML download in some browsers when inside an iframe)
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(frame);

    const cleanup = () => { try { document.body.removeChild(frame); } catch { /* already removed */ } };

    const frameDoc = frame.contentDocument ?? frame.contentWindow?.document;
    if (!frameDoc) { cleanup(); return; }
    frameDoc.open(); frameDoc.write(html); frameDoc.close();

    const doPrint = () => {
      try { frame.contentWindow?.print(); } catch { /* ignore */ }
      // Remove after a short delay to allow the print dialog to open
      setTimeout(cleanup, 2000);
    };

    const imgs = Array.from(frameDoc.images);
    if (!imgs.length) { doPrint(); return; }
    let remaining = imgs.length;
    const check = () => { if (--remaining === 0) doPrint(); };
    imgs.forEach(img => { img.onload = check; img.onerror = check; });
    // Safety fallback in case some images never fire events
    setTimeout(doPrint, 8000);
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
    // Stagger requests 400 ms apart to stay within xAI's 5 req/s rate limit
    fresh.forEach((url, i) => {
      setTimeout(() => {
        fetchColouringPage(url)
          .then(colouringUrl => {
            // Persist to localStorage so next visit skips the API
            const cache = loadCache(storyId);
            cache[url] = colouringUrl;
            saveCache(storyId, cache);
            setColouringMap(prev => new Map(prev).set(url, { status: 'done', url: colouringUrl }));
          })
          .catch(() => { triggeredRef.current.delete(url); setColouringMap(prev => new Map(prev).set(url, { status: 'error' })); });
      }, i * 400);
    });
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
      {showOrderModal && <OrderModal storyId={storyId} onClose={() => setShowOrderModal(false)} />}
      <div className="sticky z-20 bg-[#120a05]/95 border-b border-amber-900/30 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/read?storyId=${storyId}`}>
            <button className="flex items-center gap-1.5 text-amber-300/70 hover:text-amber-200 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-base font-bold text-amber-100 truncate">{story.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {anyLoading ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400/60 bg-amber-500/10 border border-amber-500/15">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing…
              </div>
            ) : !isCapacitor() ? (
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25 transition-all duration-200">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            ) : null}
            <button onClick={() => setShowOrderModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all duration-200">
              <ShoppingCart className="w-3.5 h-3.5" /> Order
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        <section>
          <SectionHeading icon={BookOpen} title="Cover" />
          <div className={gridClass}>
            <A5ImageCard src={story.coverImageUrl} alt={story.title}
              entry={story.coverImageUrl ? colouringMap.get(story.coverImageUrl) : undefined} />
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
