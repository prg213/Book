import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useListStories } from '@workspace/api-client-react';
import type { Story } from '@workspace/api-client-react';

function StoryCard({ story }: { story: Story }) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/story/[id]', params: { id: story.id } });
  };

  const isComplete = story.status === 'complete';
  const isGenerating = story.status === 'generating';

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={handlePress} disabled={!isComplete}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Cover */}
        <View style={[styles.coverArea, { backgroundColor: colors.muted }]}>
          {story.coverImageUrl ? (
            <Image source={{ uri: story.coverImageUrl }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="book" size={36} color={colors.mutedForeground} />
            </View>
          )}
          {/* Status badge */}
          {isGenerating && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.badgeText}>{story.generationProgress ?? 0}%</Text>
            </View>
          )}
          {isComplete && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={12} color="#fff" />
              <Text style={styles.badgeText}>Ready</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {story.title}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
            {story.characterName} · {story.theme}
          </Text>
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
            {new Date(story.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>

          {isComplete && (
            <View style={[styles.readBtn, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="book-outline" size={14} color={colors.primary} />
              <Text style={[styles.readBtnText, { color: colors.primary }]}>Read Now</Text>
            </View>
          )}
          {isGenerating && (
            <View style={[styles.readBtn, { backgroundColor: colors.muted }]}>
              <Text style={[styles.readBtnText, { color: colors.mutedForeground }]}>
                Generating…
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: stories, isLoading, isError, refetch, isFetching } = useListStories();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const Empty = () => (
    <View style={styles.empty}>
      <Ionicons name="library-outline" size={64} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No stories yet</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        Open the web app to create your first personalised storybook.
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="wifi-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 16 }]}>
          Couldn't load stories
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={stories ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <StoryCard story={item} />}
      contentContainerStyle={[
        styles.list,
        { paddingTop: topPad + 16, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 },
      ]}
      ListEmptyComponent={<Empty />}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      style={{ backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    gap: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  coverArea: {
    width: 110,
    aspectRatio: 1,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    fontFamily: 'FredokaOne_400Regular',
  },
  cardMeta: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  cardDate: {
    fontSize: 12,
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  readBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'FredokaOne_400Regular',
  },
  emptyBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
