import { Link } from 'wouter';
import { XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutCancel() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
         style={{ background: 'linear-gradient(135deg, #1a0e08 0%, #2d1a0e 100%)' }}>
      <div className="max-w-md w-full bg-amber-950/40 border border-amber-800/30 rounded-2xl p-8 text-center shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-amber-500/10 p-4">
            <XCircle className="h-12 w-12 text-amber-500/70" />
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold text-amber-100 mb-3">Order Cancelled</h1>
        <p className="text-amber-300/70 mb-8">No charge was made. You can try again any time.</p>
        <div className="flex flex-col gap-3">
          <Link href="/library">
            <Button className="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Library
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
