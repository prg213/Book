/**
 * ColourBookPreviewModal
 *
 * Shows a scrollable preview of the colouring book pages before downloading.
 * Images are rendered in greyscale so users see exactly what the printed
 * colouring pages will look like.
 */

import { useEffect, useRef } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Page {
  pageNumber: number;
  text?: string | null;
  imageUrl?: string | null;
}

interface Story {
  id: string;
  title: string;
  style?: string | null;
  coverImageUrl?: string | null;
}

interface Props {
  story: Story;
  pages: Page[];
  onClose: () => void;
  onDownload: () => void;
  downloading?: boolean;
}

export default function ColourBookPreviewModal({ story, pages, onClose, onDownload, downloading }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Trap scroll on body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10">
        <div>
          <p className="text-white font-semibold text-sm leading-tight">{story.title}</p>
          <p className="text-white/50 text-xs">Colouring Book Preview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="rounded-xl gap-2"
            onClick={onDownload}
            disabled={downloading}
          >
            {downloading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>
              : <><Download className="h-4 w-4" /> Download A5 PDF</>
            }
          </Button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable page list */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="max-w-sm mx-auto space-y-8">

          {/* Cover */}
          {story.coverImageUrl && (
            <PageCard label="Cover">
              <img
                src={story.coverImageUrl}
                alt="Cover illustration"
                className="w-full aspect-square object-cover"
                style={{ filter: 'grayscale(100%) contrast(1.15)' }}
              />
              <div className="p-4 text-center border-t border-gray-200">
                <p className="font-bold text-lg leading-tight text-gray-900">{story.title}</p>
                <p className="text-xs text-gray-400 mt-1 italic">Colouring Book Edition</p>
              </div>
            </PageCard>
          )}

          {/* Story pages — illustration then text */}
          {sortedPages.map((page) => (
            <div key={page.pageNumber} className="space-y-4">
              {/* Illustration page */}
              {page.imageUrl && (
                <PageCard label={`Page ${page.pageNumber} — Illustration`}>
                  <img
                    src={page.imageUrl}
                    alt={`Page ${page.pageNumber} illustration`}
                    className="w-full aspect-square object-cover"
                    style={{ filter: 'grayscale(100%) contrast(1.15)' }}
                  />
                </PageCard>
              )}

              {/* Text page */}
              {page.text?.trim() && (
                <PageCard label={`Page ${page.pageNumber} — Story`}>
                  <div className="flex items-center justify-center h-full min-h-[180px] p-6">
                    <p className="text-center text-gray-800 leading-relaxed text-sm font-serif">
                      {page.text}
                    </p>
                  </div>
                </PageCard>
              )}
            </div>
          ))}

          {/* The End */}
          <PageCard label="The End">
            <div className="flex flex-col items-center justify-center min-h-[180px] p-6">
              <p className="font-serif text-3xl font-bold italic text-gray-900">The End</p>
              <p className="text-xs text-gray-400 mt-3">{story.title}</p>
            </div>
          </PageCard>

        </div>
      </div>
    </div>
  );
}

function PageCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-white/40 text-xs uppercase tracking-wider mb-2 font-medium">{label}</p>
      {/* A5 proportion shadow card */}
      <div
        className="bg-white rounded-xl overflow-hidden shadow-2xl border border-white/10"
        style={{ aspectRatio: '148 / 210' }}
      >
        <div className="w-full h-full flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
