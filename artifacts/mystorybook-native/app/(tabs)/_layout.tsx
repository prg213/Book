import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons, Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs, useRouter } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useAuth } from '@clerk/expo';
import { setAuthTokenGetter } from '@workspace/api-client-react';

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} />
        <Label>Library</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'extraLight'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={size} />
            ) : (
              <Feather name="home" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="books.vertical" tintColor={color} size={size} />
            ) : (
              <Ionicons name="library-outline" size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const router = useRouter();
  // Track whether we've seen isSignedIn:true at least once since mount.
  // This prevents an immediate bounce-back to sign-in if Clerk's context
  // hasn't fully propagated yet when the tab navigator first mounts.
  const everSignedIn = useRef(false);

  // Wire up bearer token for all API calls (mobile has no cookie jar)
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (isSignedIn) {
      everSignedIn.current = true;
    }
    // Only redirect to sign-in once we're sure the user is not signed in:
    // - Clerk must have finished loading (isLoaded)
    // - We must have never seen an authenticated state (avoids bounce-back
    //   on initial mount before Clerk propagates the new session)
    if (isLoaded && !isSignedIn && everSignedIn.current) {
      router.replace('/(auth)/sign-in');
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return null;
  // If not signed in yet, return null and let the useEffect handle redirect.
  // This prevents a premature redirect before Clerk's session propagates.
  if (!isSignedIn) return null;

  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
