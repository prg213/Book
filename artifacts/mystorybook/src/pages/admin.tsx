import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft, BookOpen, Clock, CheckCircle, AlertCircle,
  Loader2, Search, Users, Library, MessageCircleQuestion, Mail,
} from 'lucide-react';
import { useUser } from '@clerk/react';

interface AdminTicket {
  id: string;
  userId: string | null;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

interface AdminStory {
  id: string;
  title: string;
  characterName: string;
  status: string;
  coverImageUrl: string | null;
  createdAt: string;
  userId: string | null;
  userEmail: string;
  userName: string;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'complete') return <CheckCircle className="h-3.5 w-3.5 text-green-400" />;
  if (status === 'generating') return <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />;
  if (status === 'error') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
  return <Clock className="h-3.5 w-3.5 text-amber-400/50" />;
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete: 'Complete',
    generating: 'Generating',
    error: 'Error',
    pending: 'Pending',
  };
  return <span>{map[status] ?? status}</span>;
}

export default function Admin() {
  const { isSignedIn, isLoaded } = useUser();
  const [tab, setTab] = useState<'books' | 'tickets'>('books');

  // ── Books state ──
  const [stories, setStories] = useState<AdminStory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');

  // ── Tickets state ──
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch(`${base}api/admin/stories`)
      .then(async r => {
        if (r.status === 403) { setForbidden(true); setLoading(false); return; }
        const d = await r.json();
        setStories(d.stories ?? []);
        setTotal(d.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isLoaded, isSignedIn, base]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || tab !== 'tickets') return;
    setTicketsLoading(true);
    fetch(`${base}api/support/tickets`)
      .then(async r => r.ok ? r.json() : { tickets: [] })
      .then(d => setTickets(d.tickets ?? []))
      .catch(() => {})
      .finally(() => setTicketsLoading(false));
  }, [isLoaded, isSignedIn, tab, base]);

  const resolveTicket = async (id: string, status: string) => {
    await fetch(`${base}api/support/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const filtered = stories.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.characterName.toLowerCase().includes(q) ||
      s.userEmail.toLowerCase().includes(q) ||
      s.userName.toLowerCase().includes(q)
    );
  });

  // Group by user
  const userGroups = filtered.reduce<Record<string, { name: string; email: string; stories: AdminStory[] }>>(
    (acc, s) => {
      const key = s.userId ?? 'anonymous';
      if (!acc[key]) acc[key] = { name: s.userName, email: s.userEmail, stories: [] };
      acc[key].stories.push(s);
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #1a0e08 0%, #2d1a0e 100%)' }}>
      <div className="max-w-5xl mx-auto p-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/library">
            <button className="text-amber-300/60 hover:text-amber-200 rounded-full p-1">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-amber-100">Admin</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {([
            { key: 'books', label: 'Books', icon: Library },
            { key: 'tickets', label: 'Support Tickets', icon: MessageCircleQuestion },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === key
                  ? 'bg-amber-600/30 text-amber-200 border border-amber-600/40'
                  : 'bg-amber-950/40 text-amber-400/60 border border-amber-800/20 hover:text-amber-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === 'tickets' && tickets.filter(t => t.status === 'open').length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {tickets.filter(t => t.status === 'open').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* States */}
        {!isLoaded || (isLoaded && !isSignedIn) ? (
          <div className="text-center py-20">
            <p className="text-amber-300/60">Sign in to access admin.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
          </div>
        ) : forbidden ? (
          <div className="text-center py-20 space-y-3">
            <AlertCircle className="h-12 w-12 text-red-400/60 mx-auto" />
            <p className="text-red-300">Access denied — your account isn't set as admin.</p>
            <p className="text-amber-400/40 text-sm max-w-sm mx-auto">
              Ask the developer to add your user ID to the <code className="bg-amber-900/30 px-1 rounded">ADMIN_USER_IDS</code> environment variable.
            </p>
            <Link href="/library">
              <button className="mt-4 px-4 py-2 rounded-xl bg-amber-700/30 text-amber-300 text-sm">
                Back to Library
              </button>
            </Link>
          </div>
        ) : tab === 'tickets' ? (
          /* ── Tickets panel ── */
          ticketsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20">
              <MessageCircleQuestion className="h-10 w-10 text-amber-700/30 mx-auto mb-3" />
              <p className="text-amber-400/40">No support tickets yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(ticket => (
                <div key={ticket.id} className="bg-amber-950/40 border border-amber-800/20 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ticket.status === 'open' ? 'bg-red-500/20 text-red-300' :
                          ticket.status === 'resolved' ? 'bg-green-500/20 text-green-300' :
                          'bg-amber-800/30 text-amber-400/60'
                        }`}>
                          {ticket.status.toUpperCase()}
                        </span>
                        <span className="text-amber-200 text-sm font-semibold truncate">{ticket.subject}</span>
                      </div>
                      <div className="flex items-center gap-2 text-amber-400/50 text-xs">
                        <Mail className="h-3 w-3" />
                        <span>{ticket.email}</span>
                        <span>·</span>
                        <span>{new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {ticket.status !== 'resolved' && (
                        <button
                          onClick={() => resolveTicket(ticket.id, 'resolved')}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-green-700/20 text-green-300 hover:bg-green-700/40 transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                      {ticket.status !== 'closed' && (
                        <button
                          onClick={() => resolveTicket(ticket.id, 'closed')}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-800/20 text-amber-400/60 hover:bg-amber-800/40 transition-colors"
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-amber-300/70 text-sm leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { icon: Library, label: 'Total Books', value: total },
                { icon: Users, label: 'Users', value: Object.keys(userGroups).length },
                { icon: CheckCircle, label: 'Complete', value: stories.filter(s => s.status === 'complete').length },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-amber-950/40 border border-amber-800/30 rounded-xl p-4 text-center">
                  <Icon className="h-5 w-5 text-amber-400/60 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-100">{value}</p>
                  <p className="text-amber-400/50 text-xs">{label}</p>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/40" />
              <input
                type="text"
                placeholder="Search by title, character, or user…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-amber-950/40 border border-amber-800/30 rounded-xl text-amber-100 placeholder-amber-400/30 text-sm focus:outline-none focus:border-amber-600/50"
              />
            </div>

            {/* Books grouped by user */}
            {Object.entries(userGroups).map(([userId, group]) => (
              <div key={userId} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-full bg-amber-600/20 flex items-center justify-center shrink-0">
                    <span className="text-amber-300 text-xs font-bold">
                      {group.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-amber-200 text-sm font-semibold">{group.name}</p>
                    {group.email && <p className="text-amber-400/50 text-xs">{group.email}</p>}
                  </div>
                  <span className="ml-auto text-amber-400/40 text-xs">{group.stories.length} book{group.stories.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {group.stories.map(story => (
                    <Link key={story.id} href={`/story-view?storyId=${story.id}`}>
                      <div className="bg-amber-950/40 border border-amber-800/20 rounded-xl overflow-hidden hover:border-amber-600/40 transition-all cursor-pointer group">
                        {/* Cover */}
                        <div className="aspect-[148/210] bg-amber-900/30 relative">
                          {story.coverImageUrl ? (
                            <img
                              src={story.coverImageUrl}
                              alt={story.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="h-8 w-8 text-amber-700/40" />
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="p-2">
                          <p className="text-amber-100 text-xs font-semibold truncate leading-tight">{story.title}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <StatusIcon status={story.status} />
                            <span className="text-amber-400/50 text-[10px]">
                              <StatusLabel status={story.status} />
                            </span>
                          </div>
                          <p className="text-amber-400/30 text-[10px] mt-0.5">
                            {new Date(story.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <BookOpen className="h-10 w-10 text-amber-700/30 mx-auto mb-3" />
                <p className="text-amber-400/40">No books match your search.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
