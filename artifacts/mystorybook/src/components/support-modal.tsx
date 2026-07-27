/**
 * SupportButton + SupportModal
 * Drop <SupportButton /> anywhere to get a floating "Support" button that
 * opens a ticket-submission form. Pre-fills email if the user is signed in.
 */
import { useState } from 'react';
import { useUser } from '@clerk/react';
import { MessageCircleQuestion, X, Send, CheckCircle } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const SUBJECTS = [
  'Story generation failed',
  'Image quality issue',
  'Payment / billing question',
  'App not loading',
  'Account problem',
  'Feature request',
  'Other',
];

export function SupportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open support"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 10,
          border: '1.5px solid rgba(232,133,90,0.35)',
          background: 'transparent', cursor: 'pointer',
          fontSize: '0.88rem', fontWeight: 600, color: '#6b4a30',
          touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
          whiteSpace: 'nowrap',
        }}
      >
        <MessageCircleQuestion style={{ width: 15, height: 15, flexShrink: 0 }} />
        Support
      </button>
      {open && <SupportModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SupportModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser();
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress ?? '');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !message.trim()) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, message }),
      });
      if (!r.ok) throw new Error('Server error');
      setDone(true);
    } catch {
      setError('Could not submit — please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Overlay
  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(26,14,8,0.55)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  };
  const card: React.CSSProperties = {
    width: '100%', maxWidth: 480, background: '#fff', borderRadius: 20,
    padding: '28px 24px', boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
    display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box',
    position: 'relative',
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 11,
    border: '1.5px solid hsl(28,25%,88%)', background: '#fdf8f0',
    color: 'hsl(25,30%,20%)', fontSize: 15, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const primaryBtn: React.CSSProperties = {
    width: '100%', padding: '13px', borderRadius: 13,
    background: 'hsl(15,85%,65%)', color: '#fff', fontSize: 15,
    fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, fontFamily: 'inherit',
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(25,20%,55%)', padding: 4 }}
        >
          <X style={{ width: 18, height: 18 }} />
        </button>

        {done ? (
          /* Success state */
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <CheckCircle style={{ width: 48, height: 48, color: '#3ddc84', margin: '0 auto 16px' }} />
            <h2 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: '1.35rem', fontWeight: 700, color: '#1a0e08', margin: '0 0 8px' }}>
              Ticket submitted!
            </h2>
            <p style={{ color: 'hsl(25,20%,50%)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
              We've received your message and will get back to you at <strong>{email}</strong> as soon as possible.
            </p>
            <button onClick={onClose} style={{ ...primaryBtn, width: 'auto', padding: '11px 28px' }}>Done</button>
          </div>
        ) : (
          <>
            <div>
              <h2 style={{ fontFamily: 'Fredoka, sans-serif', fontSize: '1.35rem', fontWeight: 700, color: '#1a0e08', margin: '0 0 4px' }}>
                Contact Support
              </h2>
              <p style={{ color: 'hsl(25,20%,50%)', fontSize: 13, margin: 0 }}>
                We usually respond within 24 hours.
              </p>
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(25,30%,35%)', marginBottom: 5 }}>
                Your email
              </label>
              <input
                style={input} type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {/* Subject */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(25,30%,35%)', marginBottom: 5 }}>
                Subject
              </label>
              <select
                style={{ ...input, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                value={subject} onChange={e => setSubject(e.target.value)}
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Message */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(25,30%,35%)', marginBottom: 5 }}>
                Message
              </label>
              <textarea
                style={{ ...input, minHeight: 110, resize: 'vertical' } as React.CSSProperties}
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Describe the issue or question…"
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'hsl(0,72%,51%)', margin: 0, textAlign: 'center' }}>{error}</p>
            )}

            <button style={primaryBtn} onClick={handleSubmit} disabled={loading}>
              <Send style={{ width: 16, height: 16 }} />
              {loading ? 'Sending…' : 'Send message'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
