import { SignUp } from '@clerk/react';
import { isCapacitor } from '@/lib/capacitor';
import { CapacitorAuthForm } from '@/components/capacitor-auth-form';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      aria-label="Go back"
      style={{
        position: 'absolute', top: 20, left: 20,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'hsl(25,30%,40%)', fontSize: 15, fontWeight: 600,
        padding: '8px 4px',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </button>
  );
}

export default function SignUpPage() {
  // In Capacitor, use our own form — Clerk's pre-built component renders an
  // invisible backdrop that blocks all touch events on the page.
  if (isCapacitor()) {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center px-4"
        style={{ background: 'hsl(28,45%,97%)', position: 'relative' }}
      >
        <BackButton />
        <CapacitorAuthForm initialMode="sign-up" />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center px-4"
      style={{ background: 'hsl(28,45%,97%)', position: 'relative' }}
    >
      <BackButton />
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}
