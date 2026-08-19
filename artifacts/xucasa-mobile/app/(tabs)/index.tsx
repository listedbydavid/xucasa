import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiGet, apiPost, apiDelete, adaptProperty, type Property, type SavedProperty, formatPrice } from '@/lib/api';
import { PropertyCard } from '@/components/PropertyCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { MapView, Marker } from '@/components/Map';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.1;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: LATITUDE_DELTA,
  longitudeDelta: LONGITUDE_DELTA,
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  'SFH,Single Family,House': 'House',
  Condo: 'Condo',
  'Townhome,Townhouse': 'Townhouse',
  '2-4 Unit,Multi-Family': 'Multi-Family',
  Land: 'Land',
};

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [searchText, setSearchText] = useState(params.location as string || '');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);

  const mapRef = useRef<any>(null);
  const carouselRef = useRef<FlatList>(null);

  const activeBeds = Number(params.minBeds) || 0;
  const activeBaths = Number(params.minBaths) || 0;
  const activeType = (params.type as string) || '';
  const minPrice = Number(params.minPrice) || 0;
  const maxPrice = Number(params.maxPrice) || 0;
  const activeSort = (params.sort as string) || 'newest';

  const bedsParam = activeBeds > 0 ? { minBeds: activeBeds } : {};
  const bathsParam = activeBaths > 0 ? { minBaths: activeBaths } : {};
  const typeParam = activeType && activeType !== 'Any' ? { type: activeType } : {};
  const locationParam = searchText.trim().length > 1 ? { location: searchText.trim() } : {};
  const minPriceParam = minPrice > 0 ? { minPrice } : {};
  const maxPriceParam = maxPrice > 0 ? { maxPrice } : {};

  const queryKey = [
    'properties',
    locationParam,
    bedsParam,
    bathsParam,
    typeParam,
    minPriceParam,
    maxPriceParam,
    activeSort,
  ];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (searchText.trim().length > 1) p.set('location', searchText.trim());
      if (activeBeds > 0) p.set('minBeds', String(activeBeds));
      if (activeBaths > 0) p.set('minBaths', String(activeBaths));
      if (activeType && activeType !== 'Any') p.set('propertyType', activeType);
      if (minPrice > 0) p.set('minPrice', String(minPrice));
      if (maxPrice > 0) p.set('maxPrice', String(maxPrice));
      p.set('sort', activeSort);
      p.set('limit', '50');
      const raw = await apiGet<any>(`/api/properties?${p}`);
      const list: any[] = Array.isArray(raw) ? raw : (raw?.properties ?? []);
      return {
        properties: list.map(adaptProperty),
        total: Array.isArray(raw) ? list.length : Number(raw?.total ?? list.length),
      };
    },
    staleTime: 60_000,
  });

  const { data: savedData } = useQuery({
    queryKey: ['saved-properties'],
    queryFn: () => apiGet<SavedProperty[]>('/api/saved-properties'),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (savedData) {
      setSavedIds(new Set(savedData.map((s) => s.propertyId)));
    }
  }, [savedData]);

  const properties: Property[] = data?.properties ?? [];

  const mapProperties = useMemo(() => properties.filter(p => p.latitude && p.longitude), [properties]);

  const handleSaveToggle = async (propertyId: number) => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isSaved = savedIds.has(propertyId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(propertyId) : next.add(propertyId);
      return next;
    });
    try {
      if (isSaved) {
        await apiDelete(`/api/saved-properties/${propertyId}`);
      } else {
        await apiPost('/api/saved-properties', { propertyId });
      }
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev);
        isSaved ? next.add(propertyId) : next.delete(propertyId);
        return next;
      });
    }
  };

  const mapRegion = useMemo(() => {
    if (mapProperties.length === 0) return DEFAULT_REGION;

    let minLat = mapProperties[0].latitude!;
    let maxLat = mapProperties[0].latitude!;
    let minLng = mapProperties[0].longitude!;
    let maxLng = mapProperties[0].longitude!;

    mapProperties.forEach(p => {
      minLat = Math.min(minLat, p.latitude!);
      maxLat = Math.max(maxLat, p.latitude!);
      minLng = Math.min(minLng, p.longitude!);
      maxLng = Math.max(maxLng, p.longitude!);
    });

    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.05);
    const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.05);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [mapProperties]);

  const mapCoordinateKey = useMemo(
    () => mapProperties
      .map((property) => `${property.id}:${property.latitude}:${property.longitude}`)
      .join('|'),
    [mapProperties],
  );

  React.useEffect(() => {
    if (Platform.OS === 'web' || viewMode !== 'map' || mapProperties.length === 0) return;

    setSelectedPropertyId(mapProperties[0].id);
    carouselRef.current?.scrollToOffset({ offset: 0, animated: false });

    const frame = requestAnimationFrame(() => {
      if (mapProperties.length === 1) {
        mapRef.current?.animateToRegion({
          latitude: mapProperties[0].latitude!,
          longitude: mapProperties[0].longitude!,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        });
        return;
      }

      mapRef.current?.fitToCoordinates(
        mapProperties.map((property) => ({
          latitude: property.latitude!,
          longitude: property.longitude!,
        })),
        {
          animated: true,
          edgePadding: {
            top: 72,
            right: 48,
            bottom: 220,
            left: 48,
          },
        },
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [mapCoordinateKey, mapProperties, viewMode]);

  const handleMarkerPress = (property: Property, index: number) => {
    setSelectedPropertyId(property.id);
    if (Platform.OS !== 'web') {
      mapRef.current?.animateToRegion({
        latitude: property.latitude!,
        longitude: property.longitude!,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
    carouselRef.current?.scrollToIndex({ index, animated: true });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const item = viewableItems[0].item;
      setSelectedPropertyId(item.id);
      if (Platform.OS !== 'web' && item.latitude && item.longitude) {
        mapRef.current?.animateToRegion({
          latitude: item.latitude,
          longitude: item.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    }
  }).current;

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={[styles.header, { paddingTop: topPadding + 10, backgroundColor: colors.background, zIndex: 10 }]}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground, fontFamily: 'DMSans_400Regular' }]}
              placeholder="City, neighborhood, ZIP"
              placeholderTextColor={colors.mutedForeground}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                router.setParams({ location: searchText.trim() });
                refetch();
              }}
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {/* Quick Filter Chips */}
        <View style={styles.quickFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/filters', params })}
            >
              <Ionicons name="options-outline" size={16} color={colors.foreground} />
              <Text style={[styles.chipText, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/sort', params })}
            >
              <Text style={[styles.chipText, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
                {activeSort === 'price_asc' ? 'Price: Low' : activeSort === 'price_desc' ? 'Price: High' : 'Newest'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push({ pathname: '/filters', params })}>
              <Text style={[styles.chipText, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
                {minPrice > 0 || maxPrice > 0 ? `Price` : 'Any price'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push({ pathname: '/filters', params })}>
              <Text style={[styles.chipText, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
                {activeBeds > 0 ? `${activeBeds}+ beds` : 'Any beds'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push({ pathname: '/filters', params })}>
              <Text style={[styles.chipText, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
                {PROPERTY_TYPE_LABELS[activeType] ?? 'Any type'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {viewMode === 'map' ? (
          <View style={styles.mapContainer}>
            {MapView && (
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={mapRegion}
                showsUserLocation={false}
              >
                {mapProperties.map((p, i) => {
                  const isSelected = selectedPropertyId === p.id;
                  return (
                    <Marker
                      key={p.id}
                      coordinate={{ latitude: p.latitude!, longitude: p.longitude! }}
                      onPress={() => handleMarkerPress(p, i)}
                    >
                      <View style={[styles.mapMarker, { backgroundColor: isSelected ? colors.primary : colors.card, borderColor: isSelected ? colors.primary : colors.border }]}>
                        <Text style={[styles.mapMarkerText, { color: isSelected ? '#fff' : colors.foreground, fontFamily: 'DMSans_700Bold' }]}>
                          {formatPrice(p.price)}
                        </Text>
                      </View>
                    </Marker>
                  );
                })}
              </MapView>
            )}

            {/* Honest non-geographic fallback for Expo web preview. */}
            {Platform.OS === 'web' && (
              <View style={[StyleSheet.absoluteFillObject, styles.webMapFallback, { backgroundColor: colors.muted }]}>
                <View style={[styles.webMapIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="map-outline" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.webMapTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
                  Interactive map on iPhone
                </Text>
                <Text style={[styles.webMapBody, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
                  Browse the real listings below. Price pins and map gestures are available in the native app.
                </Text>
              </View>
            )}

            {/* Carousel over map */}
            {mapProperties.length > 0 && (
              <View style={styles.carouselWrap}>
                <FlatList
                  ref={carouselRef}
                  data={mapProperties}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={width - 40}
                  snapToAlignment="center"
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                  keyExtractor={(p) => String(p.id)}
                  renderItem={({ item }) => (
                    <View style={{ width: width - 40, paddingRight: 12 }}>
                      <PropertyCard
                        property={item}
                        isSaved={savedIds.has(item.id)}
                        compact
                        onPress={() => router.push(`/property/${item.id}`)}
                        onSaveToggle={() => handleSaveToggle(item.id)}
                      />
                    </View>
                  )}
                />
              </View>
            )}
          </View>
        ) : (
          /* List View */
          isLoading ? (
            <FlatList
              data={[1, 2, 3]}
              keyExtractor={(i) => String(i)}
              renderItem={() => <SkeletonCard />}
              contentContainerStyle={styles.list}
            />
          ) : isError ? (
            <View style={styles.center}>
              <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>Couldn't load listings</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
                <Text style={[styles.retryText, { color: colors.primaryForeground, fontFamily: 'DMSans_500Medium' }]}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : properties.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="home-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>No listings found</Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>Try a different location or fewer filters.</Text>
            </View>
          ) : (
            <FlatList
              data={properties}
              keyExtractor={(p: Property) => String(p.id)}
              renderItem={({ item }: { item: Property }) => (
                <PropertyCard
                  property={item}
                  isSaved={savedIds.has(item.id)}
                  onPress={() => router.push(`/property/${item.id}`)}
                  onSaveToggle={() => handleSaveToggle(item.id)}
                />
              )}
              ListHeaderComponent={
                <Text style={[styles.resultCount, { color: colors.foreground, fontFamily: 'DMSans_700Bold' }]}>
                  {(data?.total ?? properties.length).toLocaleString()} homes
                </Text>
              }
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={<View style={{ height: Platform.OS === 'web' ? 120 : 110 }} />}
            />
          )
        )}
      </View>

      {/* Floating Toggle Button */}
      <View style={[styles.floatingToggleWrap, { bottom: Platform.OS === 'web' ? 100 : insets.bottom + 65 }]}>
        <TouchableOpacity
          style={[styles.floatingToggle, { backgroundColor: colors.foreground }]}
          onPress={() => {
            Haptics.selectionAsync();
            setViewMode(viewMode === 'map' ? 'list' : 'map');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name={viewMode === 'map' ? 'list' : 'map'} size={18} color={colors.background} />
          <Text style={[styles.floatingToggleText, { color: colors.background, fontFamily: 'DMSans_700Bold' }]}>
            {viewMode === 'map' ? 'List' : 'Map'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 16 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  quickFilters: { flexDirection: 'row' },
  filtersScroll: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  chipText: { fontSize: 14 },
  content: { flex: 1 },
  mapContainer: { flex: 1 },
  mapMarker: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  mapMarkerText: { fontSize: 13 },
  webMapFallback: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 70,
    paddingHorizontal: 40,
  },
  webMapIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  webMapTitle: { fontSize: 20, textAlign: 'center' },
  webMapBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  carouselWrap: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 140 : 100,
    left: 0,
    right: 0,
  },
  list: { padding: 16, paddingTop: 16 },
  resultCount: { fontSize: 18, marginBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 20, textAlign: 'center' },
  emptyBody: { fontSize: 15, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24, marginTop: 4 },
  retryText: { fontSize: 15 },
  floatingToggleWrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
  },
  floatingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  floatingToggleText: { fontSize: 15 },
});