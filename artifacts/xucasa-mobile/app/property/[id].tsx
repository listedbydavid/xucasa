import React, { useState, useCallback } from 'react';
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
  Share,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiGet, apiPost, apiDelete, getPhotoUrl, formatPrice, adaptProperty, type SavedProperty } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function ListingPhoto({ uri }: { uri: string }) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={[styles.carouselPhoto, styles.carouselPhotoFallback, { backgroundColor: colors.muted }]}>
        <Ionicons name="image-outline" size={56} color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: getPhotoUrl(uri) ?? undefined }}
      style={styles.carouselPhoto}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

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
        <Ionicons name="image-outline" size={60} color={colors.mutedForeground} />
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
        renderItem={({ item }) => <ListingPhoto uri={item} />}
      />
      {photos.length > 1 && (
        <View style={styles.photoCount}>
          <Text style={styles.photoCountText}>
            {activeIndex + 1} of {photos.length}
          </Text>
        </View>
      )}
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
      setIsSaved(!next);
    } finally {
      setSavingInProgress(false);
    }
  };

  const handleShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim().replace(/\/+$/, '');
      const url = configuredWebUrl
        ? `${configuredWebUrl}/property/${id}`
        : `xucasa://property/${id}`;
      await Share.share({
        message: property?.address ? `Check out this home on xucasa: ${property.address} - ${url}` : `Check out this home on xucasa: ${url}`,
        url,
      });
    } catch (error: any) {
      // Ignore abort errors
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

  const photos = property?.photos?.filter(Boolean) ?? [];

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
          <Text style={[{ color: colors.primaryForeground, fontFamily: 'DMSans_500Medium', fontSize: 15 }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View>
          <PhotoCarousel photos={photos} />

          <TouchableOpacity
            style={[styles.floatingIconBtn, { position: 'absolute', top: Platform.OS === 'web' ? 67 + 10 : insets.top + 10, left: 14 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>

          <View style={[styles.topRightActions, { top: Platform.OS === 'web' ? 67 + 10 : insets.top + 10, right: 14 }]}>
            <TouchableOpacity
              style={styles.floatingIconBtn}
              onPress={handleShare}
            >
              <Ionicons
                name="share-outline"
                size={22}
                color="#000"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.floatingIconBtn}
              onPress={handleSaveToggle}
              disabled={savingInProgress}
            >
              <Ionicons
                name={computedIsSaved ? 'heart' : 'heart-outline'}
                size={22}
                color={computedIsSaved ? colors.primary : '#000'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
              {formatPrice(property.price)}
            </Text>
            {property.isBuyItNow && (
              <View style={[styles.buyItNowBadge, { backgroundColor: '#1a6b3a' }]}>
                <Ionicons name="flash" size={12} color="#fff" />
                <Text style={styles.buyItNowText}>Buy It Now</Text>
              </View>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>{property.beds}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'DMSans_500Medium' }]}>Beds</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>{property.baths}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'DMSans_500Medium' }]}>Baths</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
                {property.sqft?.toLocaleString() || '-'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'DMSans_500Medium' }]}>Sq Ft</Text>
            </View>
          </View>

          <Text style={[styles.address, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
            {property.address}
          </Text>
          <Text style={[styles.cityState, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
            {[property.city, property.state, property.zipCode].filter(Boolean).join(', ')}
          </Text>

          <View style={styles.badgesRow}>
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
            {property.yearBuilt != null && (
              <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.badgeText, { color: colors.foreground }]}>Built {property.yearBuilt}</Text>
              </View>
            )}
            {property.hoaFee != null && property.hoaFee > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.badgeText, { color: colors.foreground }]}>HOA ${property.hoaFee.toLocaleString()}/mo</Text>
              </View>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {property.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
                About this home
              </Text>
              <Text style={[styles.description, { color: colors.foreground, fontFamily: 'DMSans_400Regular' }]}>
                {property.description}
              </Text>
            </View>
          )}

          {property.agentName && (
            <View style={[styles.section, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 20 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
                Listing Agent
              </Text>
              <View style={styles.agentCard}>
                <View style={[styles.agentAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[{ fontSize: 20, color: colors.primary, fontFamily: 'Outfit_700Bold' }]}>
                    {(property.agentName || 'A')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.agentName, { color: colors.foreground, fontFamily: 'DMSans_700Bold' }]}>
                    {property.agentName}
                  </Text>
                  <Text style={[styles.agentContact, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
                    Contact via Messages below
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === 'web' ? 24 : insets.bottom + 8,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleSaveToggle}
          disabled={savingInProgress}
        >
          <Ionicons name={computedIsSaved ? 'heart' : 'heart-outline'} size={24} color={computedIsSaved ? colors.primary : colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.contactBtn, { backgroundColor: colors.primary, opacity: startingConvo ? 0.7 : 1 }]}
          onPress={handleContactAgent}
          disabled={startingConvo}
        >
          {startingConvo ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Ionicons name="chatbubble-ellipses" size={20} color={colors.primaryForeground} />
          )}
          <Text style={[styles.contactBtnText, { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold' }]}>
            {isAuthenticated ? 'Message Agent' : 'Sign In to Message'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 20 },
  backBtnFull: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24 },
  carousel: { position: 'relative' },
  carouselPhoto: { width: SCREEN_WIDTH, height: 340 },
  carouselPhotoFallback: { alignItems: 'center', justifyContent: 'center' },
  carouselEmpty: { height: 340, alignItems: 'center', justifyContent: 'center' },
  floatingIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  topRightActions: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 12,
  },
  photoCount: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  photoCountText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  content: { padding: 20, paddingTop: 24 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  price: { fontSize: 32 },
  buyItNowBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  buyItNowText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 20 },
  statItem: { alignItems: 'flex-start', paddingRight: 16 },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 13, marginTop: 2 },
  statDivider: { width: 1, height: 30, marginRight: 16 },
  address: { fontSize: 18, marginBottom: 4 },
  cityState: { fontSize: 15, marginBottom: 16 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  divider: { height: 1, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, marginBottom: 12 },
  description: { fontSize: 16, lineHeight: 24 },
  agentCard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  agentAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  agentName: { fontSize: 18, marginBottom: 2 },
  agentContact: { fontSize: 14 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  saveBtn: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  contactBtnText: { fontSize: 16 },
});