import { Link, useLocation } from 'wouter';
import { Sparkles, Wand2, BookOpen, Palette, Star, ChevronRight } from 'lucide-react';
import { useGetLibraryStats } from '@workspace/api-client-react';
import { useUser, useClerk } from '@clerk/react';
import { SupportButton } from '@/components/support-modal';

const BASE = import.meta.env.BASE_URL;

export default function Landing() {
  const { data: stats } = useGetLibraryStats();
  const { isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    if (isSignedIn) {
      setLocation('/create');
    } else {
      setLocation('/sign-up');
    }
  };

  const handleSignOut = () => {
    signOut(() => setLocation('/'));
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#fdf8f0', fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' }}>

      {/* ── Sticky nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(253,248,240,0.9)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(232,133,90,0.14)',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {/* Logo — icon always visible, text hidden on small screens */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <img src={`${BASE}app-icon.png`} alt="" style={{ width: 30, height: 30, borderRadius: 8 }} />
            <span className="hidden sm:inline" style={{ fontFamily: 'Fredoka, sans-serif', fontWeight: 700, fontSize: '1.05rem', color: '#1a0e08', whiteSpace: 'nowrap' }}>MyStoryBook</span>
          </div>
          {/* Nav actions — Support hidden on mobile (available in page body) */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <span className="hidden sm:flex"><SupportButton /></span>
            {isLoaded && isSignedIn ? (
              <>
                <Link href="/library">
                  <button style={{ padding: '7px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#6b4a30', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    <BookOpen style={{ width: 14, height: 14 }} />
                    My Books
                  </button>
                </Link>
                <button
                  onClick={handleSignOut}
                  style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid rgba(232,133,90,0.35)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#6b4a30', whiteSpace: 'nowrap' }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/sign-in">
                  <button style={{ padding: '7px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#6b4a30', whiteSpace: 'nowrap' }}>
                    Sign in
                  </button>
                </Link>
                <button
                  onClick={handleGetStarted}
                  style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: '#e8855a', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#fff', boxShadow: '0 2px 8px rgba(232,133,90,0.3)', whiteSpace: 'nowrap' }}
                >
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 20px 60px', textAlign: 'center' }}>
        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 100, background: 'rgba(232,133,90,0.12)', color: '#c05a2e', fontSize: '0.82rem', fontWeight: 700, marginBottom: 28 }}>
          <Sparkles style={{ width: 13, height: 13 }} />
          AI-Powered · Personalised · Magical
        </div>

        {/* App icon */}
        <div style={{ marginBottom: 24 }}>
          <img
            src={`${BASE}app-icon.png`}
            alt="MyStoryBook"
            style={{ width: 96, height: 96, borderRadius: 24, boxShadow: '0 20px 56px rgba(232,133,90,0.38), 0 4px 12px rgba(0,0,0,0.08)', display: 'inline-block' }}
          />
        </div>

        <h1 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: 'clamp(2.4rem, 6.5vw, 4.2rem)', fontWeight: 700, color: '#1a0e08', lineHeight: 1.13, margin: '0 0 20px' }}>
          Turn Your Loved Ones Into<br />
          <span style={{ color: '#e8855a' }}>Storybook Heroes</span>
        </h1>

        <p style={{ fontSize: '1.12rem', color: '#7a5535', maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.7 }}>
          Upload a photo, choose an adventure — AI writes and illustrates a personalised children's storybook starring the people you love.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={handleGetStarted} style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: '14px 32px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, #e8855a 0%, #d4693e 100%)',
            color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(232,133,90,0.45)', fontFamily: 'Fredoka, sans-serif',
            letterSpacing: '0.01em',
          }}>
            <Sparkles style={{ width: 18, height: 18 }} />
            Get Started — Free
          </button>
          <Link href="/library">
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 24px', borderRadius: 14,
              border: '2px solid rgba(26,14,8,0.12)', background: '#fff',
              color: '#1a0e08', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Fredoka, sans-serif',
            }}>
              <BookOpen style={{ width: 17, height: 17, color: '#e8855a' }} />
              My Library
              <ChevronRight style={{ width: 15, height: 15, opacity: 0.5 }} />
            </button>
          </Link>
        </div>
        <p style={{ fontSize: '0.78rem', color: '#a07055', margin: 0 }}>Free to try · No credit card required</p>
      </section>

      {/* ── Stats strip ── */}
      {stats && stats.totalStories > 0 && (
        <div style={{ background: 'rgba(232,133,90,0.07)', borderTop: '1px solid rgba(232,133,90,0.14)', borderBottom: '1px solid rgba(232,133,90,0.14)', padding: '22px 20px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '32px 56px', flexWrap: 'wrap', textAlign: 'center' }}>
            {[
              { value: String(stats.totalStories), label: 'Stories Created' },
              { value: String(stats.completedStories), label: 'Books Finished' },
              { value: '8', label: 'Illustrated Pages' },
              { value: '~3 min', label: 'Generation Time' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div style={{ fontFamily: 'Fredoka, sans-serif', fontSize: '1.9rem', fontWeight: 700, color: '#e8855a', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.82rem', color: '#7a5535', fontWeight: 600, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Features grid ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 20px' }}>
        <h2 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 700, color: '#1a0e08', textAlign: 'center', margin: '0 0 10px' }}>
          Everything in One App
        </h2>
        <p style={{ textAlign: 'center', color: '#7a5535', fontSize: '1rem', margin: '0 0 52px', lineHeight: 1.6 }}>
          No design skills needed — just a photo and your imagination.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18 }}>
          {[
            {
              icon: <Star style={{ width: 26, height: 26, color: '#e8855a' }} />,
              title: 'Personalised Character',
              desc: 'AI reads your photo and recreates the person as a cartoon hero — matching their exact hair, eyes and outfit.',
            },
            {
              icon: <BookOpen style={{ width: 26, height: 26, color: '#e8855a' }} />,
              title: 'Full Illustrated Story',
              desc: '8 pages of original story text paired with AI-generated artwork, all wrapped around your chosen adventure theme.',
            },
            {
              icon: <Palette style={{ width: 26, height: 26, color: '#e8855a' }} />,
              title: 'Colouring Pages',
              desc: 'Convert any page into a printable colouring page — perfect for quiet time away from the screen.',
            },
            {
              icon: <Sparkles style={{ width: 26, height: 26, color: '#e8855a' }} />,
              title: 'Animated Character',
              desc: 'Your hero comes to life with a short waving animation that plays before the story begins.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ background: '#fff', borderRadius: 20, padding: '26px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid rgba(232,133,90,0.12)', transition: 'box-shadow 0.2s' }}>
              <div style={{ width: 50, height: 50, borderRadius: 13, background: 'rgba(232,133,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                {icon}
              </div>
              <h3 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: '1.15rem', fontWeight: 700, color: '#1a0e08', margin: '0 0 8px' }}>{title}</h3>
              <p style={{ color: '#7a5535', lineHeight: 1.6, margin: 0, fontSize: '0.92rem' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works (dark strip) ── */}
      <section style={{ background: '#1a0e08', padding: '80px 20px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 700, color: '#f5e6d0', textAlign: 'center', margin: '0 0 52px' }}>
            Magic in Three Steps
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 36 }}>
            {[
              { n: '1', title: 'Upload a Photo', desc: 'Choose a photo of anyone — your child, a friend, even a pet. The more detail visible, the better the cartoon character.' },
              { n: '2', title: 'Pick Your Adventure', desc: 'Select a theme — space, jungle, ocean, fairy tale and more. Add a name and customise the story details.' },
              { n: '3', title: 'Read Your Book', desc: 'Your personalised storybook is ready in minutes — read it in the app, on the web, or print colouring pages.' },
            ].map(({ n, title, desc }) => (
              <div key={n} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 50, height: 50, borderRadius: 14, background: 'rgba(245,201,122,0.12)', border: '2px solid rgba(245,201,122,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fredoka, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: '#f5c97a' }}>{n}</div>
                <div>
                  <h3 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: '1.15rem', fontWeight: 700, color: '#f5e6d0', margin: '8px 0 8px' }}>{title}</h3>
                  <p style={{ color: 'rgba(245,230,208,0.65)', lineHeight: 1.65, margin: 0, fontSize: '0.92rem' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: '80px 20px' }}>
        <div style={{ maxWidth: 660, margin: '0 auto', background: 'linear-gradient(135deg,#fff7ed,#fdeede)', borderRadius: 28, padding: '52px 36px', textAlign: 'center', border: '1px solid rgba(232,133,90,0.18)', boxShadow: '0 8px 48px rgba(232,133,90,0.12)' }}>
          <div style={{ fontSize: '2.8rem', marginBottom: 10, lineHeight: 1 }}>✨</div>
          <h2 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 700, color: '#1a0e08', margin: '0 0 12px' }}>
            Ready to Create Magic?
          </h2>
          <p style={{ color: '#7a5535', lineHeight: 1.7, margin: '0 0 28px', fontSize: '0.97rem', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
            Your first story is free. Upload a photo, pick a theme, and have a personalised storybook in minutes.
          </p>
          <button onClick={handleGetStarted} style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 30px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #e8855a 0%, #d4693e 100%)',
            color: '#fff', fontSize: '1.02rem', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 6px 28px rgba(232,133,90,0.4)', fontFamily: 'Fredoka, sans-serif',
          }}>
            <Sparkles style={{ width: 18, height: 18 }} />
            Create Your Story — Free
          </button>
          <p style={{ fontSize: '0.76rem', color: '#a07055', marginTop: 14, marginBottom: 0 }}>
            No credit card required
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '24px 20px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: '0.83rem', color: '#a07055' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={`${BASE}app-icon.png`} alt="" style={{ width: 22, height: 22, borderRadius: 6 }} />
            <span style={{ fontFamily: 'Fredoka, sans-serif', fontWeight: 700, color: '#4a3020', fontSize: '0.95rem' }}>MyStoryBook</span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <Link href="/sign-in"><span style={{ color: '#a07055', cursor: 'pointer' }}>Sign in</span></Link>
            <Link href="/sign-up"><span style={{ color: '#a07055', cursor: 'pointer' }}>Sign up</span></Link>
            <Link href="/terms"><span style={{ color: '#a07055', cursor: 'pointer' }}>Terms</span></Link>
          </div>
          <span>© {new Date().getFullYear()} MyStoryBook</span>
        </div>
      </footer>

    </div>
  );
}
