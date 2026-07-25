import { SignUp } from '@clerk/react';
import { isCapacitor } from '@/lib/capacitor';
import { GoogleSignInNative } from '@/components/google-sign-in-native';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function SignUpPage() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center px-4 gap-4"
      style={{ background: 'hsl(28,45%,97%)' }}
    >
      {isCapacitor() && (
        <div className="w-full max-w-[440px]">
          <GoogleSignInNative />
        </div>
      )}
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}
