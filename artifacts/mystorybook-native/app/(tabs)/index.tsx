import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useGetLibraryStats } from '@workspace/api-client-react';

function PressableCard({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: stats } = useGetLibraryStats();

  const handleCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/library');
  };

  const handleLibrary = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/library');
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: topPad + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={[styles.iconBadge, { backgroundColor: colors.primary }]}>
          <Ionicons name="book" size={40} color="#fff" />
        </View>

        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Turn Your Loved{'\n'}Ones Into
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.primary }]}>
          Storybook Heroes
        </Text>
        <Text style={[styles.heroBody, { color: colors.mutedForeground }]}>
          Upload a photo, choose your adventure, and watch AI create a
          beautifully illustrated children's story.
        </Text>
      </View>

      {/* Stats pills */}
      {stats && stats.totalStories > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.statPill, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{stats.totalStories}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Stories</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.accent + '18' }]}>
            <Text style={[styles.statNum, { color: colors.accent }]}>{stats.completedStories}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Complete</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.secondary + '60' }]}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>{stats.inProgressStories}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>In Progress</Text>
          </View>
        </View>
      )}

      {/* CTAs */}
      <View style={styles.ctaStack}>
        <PressableCard onPress={handleCreate}>
          <View style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="sparkles" size={22} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.primaryBtnText}>Create My Story</Text>
          </View>
        </PressableCard>

        <PressableCard onPress={handleLibrary}>
          <View style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="library" size={22} color={colors.foreground} style={{ marginRight: 10 }} />
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>View Library</Text>
          </View>
        </PressableCard>
      </View>

      {/* How It Works */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Magic in Three Steps
        </Text>
        <View style={styles.stepsGrid}>
          {STEPS.map((s, i) => (
            <View key={i} style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.stepIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon as any} size={26} color="#fff" />
              </View>
              <Text style={[styles.stepNum, { color: colors.mutedForeground }]}>Step {i + 1}</Text>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>{s.title}</Text>
              <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom padding */}
      <View style={{ height: Platform.OS === 'web' ? 34 : insets.bottom + 16 }} />
    </ScrollView>
  );
}

const STEPS = [
  {
    icon: 'camera',
    title: 'Upload a Photo',
    desc: 'Pick a photo of your child, family member, or pet.',
    bg: '#F07B52',
  },
  {
    icon: 'color-wand',
    title: 'Choose Adventure',
    desc: 'Pick a theme, length, and personalise the story.',
    bg: '#E87AA0',
  },
  {
    icon: 'book',
    title: 'Read Together',
    desc: 'Your illustrated storybook is ready in minutes.',
    bg: '#A07BD0',
  },
];

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#F07B52',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 44,
    fontFamily: 'FredokaOne_400Regular',
  },
  heroSubtitle: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 16,
    fontFamily: 'FredokaOne_400Regular',
  },
  heroBody: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'FredokaOne_400Regular',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  ctaStack: {
    gap: 12,
    marginBottom: 40,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    shadowColor: '#F07B52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'FredokaOne_400Regular',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  secondaryBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'FredokaOne_400Regular',
  },
  stepsGrid: {
    gap: 12,
  },
  stepCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  stepIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: 'FredokaOne_400Regular',
  },
  stepDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
});
