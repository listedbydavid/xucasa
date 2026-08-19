import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiGet, apiPost, apiDelete, getPhotoUrl, formatPrice, adaptProperty, type Property, type SavedProperty } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function PhotoCarousel({ photos }: { photos: string[] }) {
  const colors = useColors();
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  }, []);

  if (photos.length === 0) {
    return (
      <View style={[styles.carouselEmpty, { backgroundColor: colors.muted }]}>
        <Ionicons name="home-outline" size={60} color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <View style={styles.carousel}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => {
          const url = getPhotoUrl(item);
          return (
            <Image
              source={{ uri: url ?? undefined }}
              style={{ width: SCREEN_WIDTH, height: 300 }}
              contentFit="cover"
            />
          );
        }}
      />
      {/* Dots */}
      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.slice(0, 10).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.5)' },
              ]}
            />
          ))}
        </View>
      )}
      <View style={styles.photoCount}>
        <Text style={styles.photoCountText}>
          {activeIndex + 1} / {photos.length}
        </Text>
      </View>
    </View>
  );
}

function SpecChip({ icon, label }: { icon: string; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.specChip, { backgroundColor: colors.muted }]}>
      <Ionicons name={icon as any} size={15} color={colors.mutedForeground} />
      <Text style={[styles.specChipText, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
        {label}
      </Text>
    </View>
  );
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [isSaved, setIsSaved] = useState<boolean | null>(null);
  const [savingInProgress, setSavingInProgress] = useState(false);

  const { data: property, isLoading, isError } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => adaptProperty(await apiGet<any>(`/api/properties/${id}`)),
    enabled: !!id,
  });

  const { data: savedData } = useQuery({
    queryKey: ['saved-properties'],
    queryFn: async () => {
      const raw = await apiGet<any[]>('/api/saved-properties');
      return (raw ?? []).map((s: any) => ({ ...s, property: adaptProperty(s.property ?? s) })) as SavedProperty[];
    },
    enabled: isAuthenticated,
  });

  // Derive isSaved from cache
  const computedIsSaved = React.useMemo(() => {
    if (isSaved !== null) return isSaved;
    if (!savedData || !id) return false;
    return savedData.some((s) => s.propertyId === Number(id));
  }, [isSaved, savedData, id]);

  const handleSaveToggle = async () => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = !computedIsSaved;
    setIsSaved(next);
    setSavingInProgress(true);
    try {
      if (next) {
        await apiPost('/api/saved-properties', { propertyId: Number(id) });
      } else {
        await apiDelete(`/api/saved-properties/${id}`);
      }
      queryClient.invalidateQueries({ queryKey: ['saved-properties'] });
    } catch {
      setIsSaved(!next); // revert
    } finally {
      setSavingInProgress(false);
    }
  };

  const [startingConvo, setStartingConvo] = useState(false);

  const handleContactAgent = async () => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (!property) return;
    setStartingConvo(true);
    try {
      // Create or retrieve the buyer conversation for this property
      const result = await apiPost<{ id: number } | { conversationId: number }>('/api/conversations', {
        propertyId: property.id,
      });
      const convoId = (result as any).id ?? (result as any).conversationId;
      if (convoId) {
        router.push(`/conversation/${convoId}`);
      } else {
        Alert.alert('Could not start conversation', 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not start conversation. Please try again.');
    } finally {
      setStartingConvo(false);
    }
  };

  const photos = property?.photos?.map((p) => getPhotoUrl(p)).filter(Boolean) as string[] ?? [];

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !property) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
          Property not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtnFull, { backgroundColor: colors.primary }]}>
          <Text style={[{ color: colors.primaryForeground, fontFamily: 'DM_Sans_500Medium', fontSize: 15 }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[]} bounces>
        {/* Photo carousel */}
        <View>
          <PhotoCarousel photos={photos} />

          {/* Back button overlay */}
          <TouchableOpacity
            style={[styles.backBtn, { top: Platform.OS === 'web' ? 67 + 10 : insets.top + 10 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Save button overlay */}
          <TouchableOpacity
            style={[styles.saveOverlayBtn, { top: Platform.OS === 'web' ? 67 + 10 : insets.top + 10 }]}
            onPress={handleSaveToggle}
            disabled={savingInProgress}
          >
            <Ionicons
              name={computedIsSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={computedIsSaved ? colors.primary : '#fff'}
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Price */}
          <Text style={[styles.price, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
            {formatPrice(property.price)}
          </Text>

          {/* Status + type badges */}
          <View style={styles.badgeRow}>
            {property.status && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
                  {property.status.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            )}
            {property.type && (
              <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.badgeText, { color: colors.foreground }]}>{property.type}</Text>
              </View>
            )}
          </View>

          {/* Address */}
          <Text style={[styles.address, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
            {property.address}
          </Text>
          <Text style={[styles.cityState, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
            {[property.city, property.state, property.zipCode].filter(Boolean).join(', ')}
          </Text>

          {/* Specs chips */}
          <View style={styles.specChips}>
            {property.beds != null && <SpecChip icon="bed-outline" label={`${property.beds} beds`} />}
            {property.baths != null && <SpecChip icon="water-outline" label={`${property.baths} baths`} />}
            {property.sqft != null && <SpecChip icon="resize-outline" label={`${property.sqft.toLocaleString()} sqft`} />}
            {property.yearBuilt != null && <SpecChip icon="calendar-outline" label={`Built ${property.yearBuilt}`} />}
            {property.parkingSpaces != null && <SpecChip icon="car-outline" label={`${property.parkingSpaces} parking`} />}
          </View>

          {/* HOA fee */}
          {property.hoaFee != null && property.hoaFee > 0 && (
            <Text style={[styles.hoaText, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
              HOA: ${property.hoaFee.toLocaleString()}/mo
            </Text>
          )}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Description */}
          {property.description ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
                About this home
              </Text>
              <Text style={[styles.description, { color: colors.foreground, fontFamily: 'DM_Sans_400Regular' }]}>
                {property.description}
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          ) : null}

          {/* Agent */}
          {property.agentName && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
                Listed by
              </Text>
              <View style={[styles.agentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.agentAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[{ fontSize: 18, color: colors.primary, fontFamily: 'Outfit_700Bold' }]}>
                    {(property.agentName || 'A')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.agentName, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]}>
                    {property.agentName}
                  </Text>
                  <Text style={[styles.agentContact, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
                    Listing agent — contact via Messages
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* MLS */}
          {property.mlsNumber && (
            <Text style={[styles.mls, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
              MLS#: {property.mlsNumber}
            </Text>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View
        style={[
          styles.ctaBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 8,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary, opacity: startingConvo ? 0.6 : 1 }]}
          onPress={handleContactAgent}
          disabled={startingConvo}
        >
          {startingConvo
            ? <ActivityIndicator size="small" color={colors.primaryForeground} />
            : <Ionicons name="chatbubble-outline" size={18} color={colors.primaryForeground} />}
          <Text style={[styles.ctaBtnText, { color: colors.primaryForeground, fontFamily: 'DM_Sans_500Medium' }]}>
            {isAuthenticated ? 'Message agent' : 'Sign in to message'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={handleSaveToggle}
          disabled={savingInProgress}
        >
          <Ionicons
            name={computedIsSaved ? 'heart' : 'heart-outline'}
            size={22}
            color={computedIsSaved ? colors.primary : colors.foreground}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: { fontSize: 20 },
  backBtnFull: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24 },
  carousel: { position: 'relative' },
  carouselEmpty: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOverlayBtn: {
    position: 'absolute',
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  photoCount: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: { padding: 20, gap: 8 },
  price: { fontSize: 28, lineHeight: 34 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  address: { fontSize: 16, marginTop: 6 },
  cityState: { fontSize: 14 },
  specChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  specChipText: { fontSize: 14 },
  hoaText: { fontSize: 13, marginTop: 4 },
  divider: { height: 1, marginVertical: 16 },
  sectionTitle: { fontSize: 18, marginBottom: 8 },
  description: { fontSize: 15, lineHeight: 23 },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  agentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  agentName: { fontSize: 15 },
  agentContact: { fontSize: 13 },
  mls: { fontSize: 12, marginTop: 4 },
  ctaBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  ctaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaBtnText: { fontSize: 16 },
  saveBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
