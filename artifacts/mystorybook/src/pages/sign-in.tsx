import { SignIn } from '@clerk/react';
import { isCapacitor } from '@/lib/capacitor';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 gap-4"
      style={{ background: 'hsl(28,45%,97%)' }}>
      {isCapacitor() && (
        <p className="text-sm text-center max-w-xs" style={{ color: 'hsl(25,20%,50%)' }}>
          Use your email and password to sign in. Google sign-in is not available in the app.
        </p>
      )}
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}
