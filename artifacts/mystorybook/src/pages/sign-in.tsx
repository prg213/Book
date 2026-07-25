import { SignIn } from '@clerk/react';
import { isCapacitor } from '@/lib/capacitor';
import { CapacitorAuthForm } from '@/components/capacitor-auth-form';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function SignInPage() {
  // In Capacitor, use our own form — Clerk's pre-built component renders an
  // invisible backdrop that blocks all touch events on the page.
  if (isCapacitor()) {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center px-4"
        style={{ background: 'hsl(28,45%,97%)' }}
      >
        <CapacitorAuthForm initialMode="sign-in" />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center px-4"
      style={{ background: 'hsl(28,45%,97%)' }}
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}
