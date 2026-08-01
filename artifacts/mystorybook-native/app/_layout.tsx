import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" backgroundColor="#F9F5F0" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
