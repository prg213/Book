import React, { useEffect, useRef } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { isCapacitor } from '@/lib/capacitor';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Landing from '@/pages/landing';
import Create from '@/pages/create';
import Generating from '@/pages/generating';
import Library from '@/pages/library';
import Read from '@/pages/read';
import StoryView from '@/pages/story-view';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';
import SsoCallbackPage from '@/pages/sso-callback';
import CheckoutSuccess from '@/pages/checkout-success';
import CheckoutCancel from '@/pages/checkout-cancel';
import Orders from '@/pages/orders';
import Admin from '@/pages/admin';
import Terms from '@/pages/terms';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

// REQUIRED — resolves the key from window.location.hostname
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — empty in dev, auto-set in prod
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

// Strip the base path prefix before passing to wouter (which prepends it)
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

// Google OAuth doesn't work in Android WebView — hide social buttons in native app
const nativeOverrides = isCapacitor()
  ? {
      socialButtonsBlockButton: 'hidden',
      socialButtonsIconButton: 'hidden',
      dividerRow: 'hidden',
    }
  : {};

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    ...(isCapacitor() ? {} : {
      socialButtonsVariant: 'blockButton' as const,
      socialButtonsPlacement: 'top' as const,
    }),
  },
  variables: {
    colorPrimary: 'hsl(15,85%,65%)',
    colorForeground: 'hsl(25,30%,20%)',
    colorMutedForeground: 'hsl(25,20%,50%)',
    colorDanger: 'hsl(0,72%,51%)',
    colorBackground: 'hsl(28,45%,97%)',
    colorInput: 'hsl(30,50%,99%)',
    colorInputForeground: 'hsl(25,30%,20%)',
    colorNeutral: 'hsl(28,25%,80%)',
    fontFamily: "'Fredoka', 'Inter', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl shadow-orange-100/60',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[hsl(25,30%,20%)] font-semibold',
    headerSubtitle: 'text-[hsl(25,20%,50%)]',
    socialButtonsBlockButtonText: 'text-[hsl(25,30%,20%)] font-medium',
    formFieldLabel: 'text-[hsl(25,30%,20%)] font-medium',
    footerActionLink: 'text-[hsl(15,85%,60%)] font-semibold',
    footerActionText: 'text-[hsl(25,20%,50%)]',
    dividerText: 'text-[hsl(25,20%,50%)]',
    identityPreviewEditButton: 'text-[hsl(15,85%,60%)]',
    formFieldSuccessText: 'text-green-600',
    alertText: 'text-[hsl(25,30%,20%)]',
    logoBox: 'flex justify-center',
    logoImage: 'h-12 w-auto',
    socialButtonsBlockButton: 'border border-[hsl(28,25%,88%)] bg-white',
    formButtonPrimary: 'bg-[hsl(15,85%,65%)] hover:bg-[hsl(15,85%,58%)] text-white',
    formFieldInput: 'bg-white border border-[hsl(28,25%,88%)] text-[hsl(25,30%,20%)]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[hsl(28,25%,88%)]',
    alert: 'bg-red-50 border-red-200',
    otpCodeFieldInput: 'border border-[hsl(28,25%,88%)]',
    formFieldRow: '',
    main: '',
    ...nativeOverrides,
  },
};

// Blocks a route for unauthenticated users — redirects to /sign-in
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation('/sign-in');
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || !isSignedIn) return null;
  return <Component />;
}

// Invalidates the React Query cache when the signed-in user changes
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => isCapacitor() ? <Home /> : <Landing />}</Route>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/create">{() => <ProtectedRoute component={Create} />}</Route>
      <Route path="/generating" component={Generating} />
      <Route path="/library" component={Library} />
      <Route path="/read" component={Read} />
      <Route path="/story-view" component={StoryView} />
      <Route path="/sso-callback" component={SsoCallbackPage} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/checkout/cancel" component={CheckoutCancel} />
      <Route path="/orders" component={Orders} />
      <Route path="/admin" component={Admin} />
      <Route path="/terms" component={Terms} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppProviders() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={basePath || '/'}
      localization={{
        signIn: { start: { title: 'Welcome back 📖', subtitle: 'Sign in to see your storybooks' } },
        signUp: { start: { title: 'Create your account ✨', subtitle: 'Start building magical storybooks' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppProviders />
    </WouterRouter>
  );
}

export default App;
