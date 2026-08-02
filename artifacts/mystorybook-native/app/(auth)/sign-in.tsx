import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSSO, useSignIn, useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Required: complete any pending auth sessions when screen mounts
WebBrowser.maybeCompleteAuthSession();

// Warm up the browser on Android for faster OAuth
function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

const COLORS = {
  primary: '#F07B52',
  background: '#F9F5F0',
  card: '#FEFCFA',
  foreground: '#3D2C1F',
  muted: '#856C57',
  border: '#E1D4C4',
  error: '#E05555',
  white: '#FFFFFF',
};

type Screen = 'signIn' | 'signUp' | 'verify';

export default function SignInScreen() {
  useWarmUpBrowser();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();

  const [screen, setScreen] = useState<Screen>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const isBusy = signInStatus === 'fetching' || signUpStatus === 'fetching' || googleLoading;

  // ── Google Sign-In ──────────────────────────────────────────────────────────
  // NOTE: Do NOT pass a custom redirectUrl to startSSOFlow — @clerk/expo
  // handles the redirect internally using the clerk:// scheme. Passing a
  // custom scheme breaks the OAuth callback on Android.
  const handleGoogle = useCallback(async () => {
    try {
      setGoogleLoading(true);
      setErrorMsg('');
      const { createdSessionId, setActive, signIn, signUp } = await startSSOFlow({
        strategy: 'oauth_google',
      });
      if (createdSessionId && setActive) {
        // Activate the session — (auth)/_layout.tsx's isSignedIn guard
        // will redirect to /(tabs) automatically once Clerk state settles.
        // Do NOT call router.replace here: it races with the state update.
        await setActive({ session: createdSessionId });
      } else if (signUp?.status === 'missing_requirements') {
        // New Google user — session should already be active
      } else if (signIn?.status === 'needs_first_factor' || signIn?.status === 'needs_second_factor') {
        setErrorMsg('Additional verification required. Please sign in with email instead.');
      } else {
        const detail = signIn?.status ?? signUp?.status ?? 'no_session';
        setErrorMsg(`Sign-in incomplete (${detail}). Please try again.`);
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message ?? err?.message ?? 'Google sign-in failed.';
      setErrorMsg(msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow]);

  // ── Email Sign-In ───────────────────────────────────────────────────────────
  const handleEmailSignIn = async () => {
    setErrorMsg('');
    try {
      const result = await signIn!.create({ identifier: email, password });
      if (result.status === 'complete') {
        await signIn!.client.setActive({ session: result.createdSessionId });
      } else {
        setErrorMsg('Sign-in incomplete. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? 'Sign-in failed. Please try again.');
    }
  };

  // ── Email Sign-Up ───────────────────────────────────────────────────────────
  const handleEmailSignUp = async () => {
    setErrorMsg('');
    try {
      await signUp!.create({ emailAddress: email, password });
      await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
      setScreen('verify');
    } catch (err: any) {
      setErrorMsg(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? 'Sign-up failed. Please try again.');
    }
  };

  // ── Verify Email Code ───────────────────────────────────────────────────────
  const handleVerify = async () => {
    setErrorMsg('');
    try {
      const result = await signUp!.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await signUp!.client.setActive({ session: result.createdSessionId });
      } else {
        setErrorMsg('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? 'Verification failed.');
    }
  };

  // ── Verify screen ───────────────────────────────────────────────────────────
  if (screen === 'verify') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <View style={styles.hero}>
          <View style={styles.iconBadge}>
            <Ionicons name="mail" size={32} color={COLORS.white} />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>We sent a verification code to{'\n'}{email}</Text>
        </View>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="6-digit code"
          placeholderTextColor={COLORS.muted}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoFocus
        />
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, isBusy && styles.disabled]}
          onPress={handleVerify}
          disabled={!code || isBusy}
        >
          {isBusy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Verify</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => signUp!.prepareEmailAddressVerification({ strategy: 'email_code' })}
        >
          <Text style={styles.linkText}>Resend code</Text>
        </TouchableOpacity>

        <View nativeID="clerk-captcha" />
      </View>
    );
  }

  // ── Main sign-in / sign-up screen ───────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconBadge}>
            <Ionicons name="book" size={36} color={COLORS.white} />
          </View>
          <Text style={styles.title}>MyStoryBook</Text>
          <Text style={styles.subtitle}>
            {screen === 'signIn' ? 'Welcome back! Sign in to your stories.' : 'Create an account to get started.'}
          </Text>
        </View>

        {/* Google button */}
        <TouchableOpacity
          style={[styles.googleBtn, isBusy && styles.disabled]}
          onPress={handleGoogle}
          disabled={isBusy}
        >
          {googleLoading ? (
            <ActivityIndicator color={COLORS.foreground} />
          ) : (
            <>
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email */}
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={COLORS.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />

        {/* Password */}
        <TextInput
          style={[styles.input, { marginTop: 12 }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={COLORS.muted}
          secureTextEntry
          autoComplete={screen === 'signIn' ? 'current-password' : 'new-password'}
          textContentType={screen === 'signIn' ? 'password' : 'newPassword'}
        />

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        {/* Primary action button */}
        <TouchableOpacity
          style={[styles.primaryBtn, (!email || !password || isBusy) && styles.disabled]}
          onPress={screen === 'signIn' ? handleEmailSignIn : handleEmailSignUp}
          disabled={!email || !password || isBusy}
        >
          {isBusy && !googleLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {screen === 'signIn' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Toggle sign-in / sign-up */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => { setScreen(screen === 'signIn' ? 'signUp' : 'signIn'); setErrorMsg(''); }}
        >
          <Text style={styles.linkSubtext}>
            {screen === 'signIn' ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <Text style={styles.linkText}>
            {screen === 'signIn' ? 'Sign up' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        <View nativeID="clerk-captcha" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  title: {
    fontSize: 30,
    fontFamily: 'FredokaOne_400Regular',
    color: COLORS.foreground,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: COLORS.foreground,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'FredokaOne_400Regular',
  },
  disabled: {
    opacity: 0.55,
  },
  error: {
    color: COLORS.error,
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 4,
  },
  linkSubtext: {
    color: COLORS.muted,
    fontSize: 14,
  },
  linkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
