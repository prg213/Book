import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetStoryForReading } from '@workspace/api-client-react';
import type { StoryPage } from '@workspace/api-client-react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StoryReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [pageIndex, setPageIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const { data, isLoading, isError } = useGetStoryForReading(id ?? '');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const allPages = data ? [{ type: 'cover' as const }, ...data.pages.map(p => ({ type: 'page' as const, page: p }))] : [];
  const total = allPages.length;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPageIndex(idx);
  };

  const goBack = () => router.back();

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading story…</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Couldn't load story</Text>
        <TouchableOpacity onPress={goBack} style={[styles.backBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item }: { item: typeof allPages[0] }) => {
    if (item.type === 'cover') {
      return (
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <View style={[styles.coverPage, { backgroundColor: colors.muted }]}>
            {data.story.coverImageUrl ? (
              <Image
                source={{ uri: data.story.coverImageUrl }}
                style={styles.coverFullImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: colors.secondary }]}>
                <Ionicons name="book" size={80} color="#fff" />
              </View>
            )}
            <View style={[styles.coverOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
              <Text style={styles.coverTitle}>{data.story.title}</Text>
              <Text style={styles.coverSub}>A story starring {data.story.characterName}</Text>
            </View>
          </View>
        </View>
      );
    }

    const p = (item as { type: 'page'; page: StoryPage }).page;

    return (
      <View style={[styles.page, { width: SCREEN_WIDTH, backgroundColor: colors.background }]}>
        {p.imageUrl && (
          <Image
            source={{ uri: p.imageUrl }}
            style={styles.pageImage}
            resizeMode="cover"
          />
        )}
        <View style={[styles.textBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.pageNum, { color: colors.mutedForeground }]}>
            Page {p.pageNumber}
          </Text>
          <Text style={[styles.pageText, { color: colors.foreground }]}>
            {p.text ?? ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {data.story.title}
        </Text>
        <View style={[styles.pageCounter, { backgroundColor: colors.muted }]}>
          <Text style={[styles.pageCounterText, { color: colors.mutedForeground }]}>
            {pageIndex + 1} / {total}
          </Text>
        </View>
      </View>

      {/* Pages */}
      <FlatList
        ref={flatRef}
        data={allPages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      />

      {/* Dots */}
      <View style={[styles.dots, { paddingBottom: botPad + 16 }]}>
        {allPages.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => flatRef.current?.scrollToIndex({ index: i, animated: true })}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: i === pageIndex ? colors.primary : colors.border,
                  width: i === pageIndex ? 20 : 8,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'FredokaOne_400Regular',
  },
  pageCounter: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pageCounterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  page: {
    flex: 1,
  },
  coverPage: {
    flex: 1,
    position: 'relative',
  },
  coverFullImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 28,
    paddingBottom: 48,
  },
  coverTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'FredokaOne_400Regular',
    marginBottom: 6,
  },
  coverSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  pageImage: {
    width: '100%',
    height: '55%',
  },
  textBox: {
    flex: 1,
    margin: 16,
    marginTop: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  pageNum: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  pageText: {
    fontSize: 16,
    lineHeight: 26,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
