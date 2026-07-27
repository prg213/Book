import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { CheckCircle, BookOpen, Package, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionResult {
  status: string;
  productType: 'digital' | 'print';
  storyId: string;
  amountTotal: number;
  currency: string;
  shippingName?: string;
}

export default function CheckoutSuccess() {
  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) { setError('No session ID found.'); setLoading(false); return; }

    fetch(`${import.meta.env.BASE_URL}api/stripe/checkout/session?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => { setResult(data); setLoading(false); })
      .catch(() => { setError('Could not verify your order.'); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
         style={{ background: 'linear-gradient(135deg, #1a0e08 0%, #2d1a0e 100%)' }}>
      <div className="max-w-md w-full bg-amber-950/40 border border-amber-800/30 rounded-2xl p-8 text-center shadow-2xl">

        {loading ? (
          <Loader2 className="h-12 w-12 text-amber-400 animate-spin mx-auto" />
        ) : error ? (
          <>
            <p className="text-red-400 mb-4">{error}</p>
            <Link href="/library">
              <Button variant="outline">Back to Library</Button>
            </Link>
          </>
        ) : result?.status === 'paid' ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-500/20 p-4">
                <CheckCircle className="h-12 w-12 text-green-400" />
              </div>
            </div>

            <h1 className="font-display text-2xl font-bold text-amber-100 mb-2">
              Order Confirmed!
            </h1>

            {result.productType === 'print' ? (
              <>
                <div className="flex justify-center mb-3">
                  <Package className="h-6 w-6 text-amber-400" />
                </div>
                <p className="text-amber-200 mb-1">
                  Your printed storybook is on its way!
                </p>
                {result.shippingName && (
                  <p className="text-amber-400/70 text-sm mb-4">Shipping to {result.shippingName}</p>
                )}
                <p className="text-amber-300/60 text-sm mb-6">
                  Allow 5–10 business days for delivery. You'll receive an email confirmation shortly.
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-3">
                  <BookOpen className="h-6 w-6 text-amber-400" />
                </div>
                <p className="text-amber-200 mb-6">
                  Your story has been unlocked and is ready to read!
                </p>
              </>
            )}

            <p className="text-amber-300/80 font-semibold mb-6">
              £{((result.amountTotal ?? 0) / 100).toFixed(2)} paid
            </p>

            <div className="flex flex-col gap-3">
              {result.storyId && (
                <Link href={`/story-view?storyId=${result.storyId}`}>
                  <Button className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-xl">
                    <BookOpen className="h-4 w-4 mr-2" /> View Story
                  </Button>
                </Link>
              )}
              <Link href="/orders">
                <Button variant="outline" className="w-full rounded-xl border-amber-700/50 text-amber-200">
                  My Orders
                </Button>
              </Link>
              <Link href="/library">
                <Button variant="ghost" className="w-full rounded-xl text-amber-400/70">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Library
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-amber-200 mb-4">Payment is being processed…</p>
            <Link href="/library">
              <Button variant="outline">Back to Library</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
