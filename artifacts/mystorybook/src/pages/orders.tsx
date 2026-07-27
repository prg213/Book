import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Package, BookOpen, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@clerk/react';

interface Order {
  id: string;
  story_id: string | null;
  product_type: 'digital' | 'print';
  status: string;
  amount_total: number | null;
  currency: string | null;
  shipping_name: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    pending:   { icon: Clock,         color: 'text-amber-400',  label: 'Pending' },
    paid:      { icon: CheckCircle,   color: 'text-green-400',  label: 'Paid' },
    fulfilled: { icon: Package,       color: 'text-blue-400',   label: 'Fulfilled' },
    cancelled: { icon: XCircle,       color: 'text-red-400',    label: 'Cancelled' },
  };
  const s = map[status] ?? map['pending'];
  const Icon = s.icon;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${s.color}`}>
      <Icon className="h-3.5 w-3.5" /> {s.label}
    </span>
  );
}

export default function Orders() {
  const { isSignedIn, isLoaded } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLoading(false); return; }

    fetch(`${import.meta.env.BASE_URL}api/orders`)
      .then(r => r.json())
      .then(data => { setOrders(data.data ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load orders.'); setLoading(false); });
  }, [isLoaded, isSignedIn]);

  return (
    <div className="min-h-screen"
         style={{ background: 'linear-gradient(135deg, #1a0e08 0%, #2d1a0e 100%)' }}>
      <div className="max-w-2xl mx-auto p-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/library">
            <Button variant="ghost" size="icon" className="rounded-full text-amber-300/70 hover:text-amber-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-display text-xl font-bold text-amber-100">My Orders</h1>
        </div>

        {!isLoaded || loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
          </div>
        ) : !isSignedIn ? (
          <div className="text-center py-16">
            <p className="text-amber-300/70 mb-4">Sign in to view your orders</p>
            <Link href="/sign-in">
              <Button className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl">Sign In</Button>
            </Link>
          </div>
        ) : error ? (
          <p className="text-red-400 text-center py-16">{error}</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-12 w-12 text-amber-700/40 mx-auto mb-3" />
            <p className="text-amber-300/60 mb-2">No orders yet</p>
            <p className="text-amber-400/40 text-sm mb-6">Order a printed storybook from any story in your library</p>
            <Link href="/library">
              <Button className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl">
                <BookOpen className="h-4 w-4 mr-2" /> Go to Library
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.id}
                   className="bg-amber-950/40 border border-amber-800/30 rounded-xl p-4 flex items-start gap-4">
                {/* Icon */}
                <div className={`rounded-xl p-2 mt-0.5 ${
                  order.product_type === 'print' ? 'bg-blue-500/10' : 'bg-amber-500/10'
                }`}>
                  {order.product_type === 'print'
                    ? <Package className="h-5 w-5 text-blue-400" />
                    : <BookOpen className="h-5 w-5 text-amber-400" />}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-amber-100 text-sm">
                    {order.product_type === 'print' ? 'Printed Storybook' : 'Story Generation'}
                  </p>
                  {order.shipping_name && (
                    <p className="text-amber-300/60 text-xs truncate">
                      {order.shipping_name}{order.shipping_city ? `, ${order.shipping_city}` : ''}
                    </p>
                  )}
                  <p className="text-amber-400/50 text-xs mt-0.5">
                    {new Date(order.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Right side */}
                <div className="text-right shrink-0">
                  {order.amount_total != null && (
                    <p className="text-amber-200 font-semibold text-sm mb-1">
                      £{(order.amount_total / 100).toFixed(2)}
                    </p>
                  )}
                  <StatusBadge status={order.status} />
                  {order.story_id && (
                    <Link href={`/story-view?storyId=${order.story_id}`}>
                      <button className="text-amber-500/70 text-xs mt-1 hover:text-amber-400 underline underline-offset-2">
                        View story
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
