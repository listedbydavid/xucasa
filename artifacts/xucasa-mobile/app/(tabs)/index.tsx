import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiGet, apiPost, apiDelete, adaptProperty, type Property, type SavedProperty } from '@/lib/api';
import { PropertyCard } from '@/components/PropertyCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

const BEDS_OPTIONS = ['Any', '1+', '2+', '3+', '4+'];
const TYPE_OPTIONS = ['Any', 'House', 'Condo', 'Townhouse', 'Multi'];

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [searchText, setSearchText] = useState('');
  const [activeBeds, setActiveBeds] = useState(0); // index into BEDS_OPTIONS
  const [activeType, setActiveType] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  // Build query params
  const bedsParam = activeBeds > 0 ? { minBeds: activeBeds } : {};
  const typeParam = activeType > 0 ? { type: TYPE_OPTIONS[activeType] } : {};
  const locationParam = searchText.trim().length > 1 ? { location: searchText.trim() } : {};

  const queryKey = ['properties', locationParam, bedsParam, typeParam];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchText.trim().length > 1) params.set('location', searchText.trim());
      if (activeBeds > 0) params.set('minBeds', String(activeBeds));
      if (activeType > 0) params.set('propertyType', TYPE_OPTIONS[activeType]);
      params.set('limit', '30');
      const raw = await apiGet<any>(`/api/properties?${params}`);
      // Normalise: API may return { properties: [], total: N } or []
      const list: any[] = Array.isArray(raw) ? raw : (raw?.properties ?? []);
      return list.map(adaptProperty);
    },
    staleTime: 60_000,
  });

  // Saved properties
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

  const properties: Property[] = Array.isArray(data) ? data : [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
      // revert
      setSavedIds((prev) => {
        const next = new Set(prev);
        isSaved ? next.add(propertyId) : next.delete(propertyId);
        return next;
      });
    }
  };

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.logo, { color: colors.primary, fontFamily: 'Outfit_700Bold' }]}>
          xucasa
        </Text>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'DM_Sans_400Regular' }]}
            placeholder="City, neighborhood, ZIP..."
            placeholderTextColor={colors.mutedForeground}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            onSubmitEditing={() => refetch()}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter chips */}
        <View style={styles.filters}>
          {/* Beds */}
          <View style={styles.filterGroup}>
            {BEDS_OPTIONS.slice(1).map((label, i) => (
              <TouchableOpacity
                key={label}
                style={[
                  styles.chip,
                  {
                    backgroundColor: activeBeds === i + 1 ? colors.primary : colors.card,
                    borderColor: activeBeds === i + 1 ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveBeds(activeBeds === i + 1 ? 0 : i + 1)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: activeBeds === i + 1 ? colors.primaryForeground : colors.foreground,
                      fontFamily: 'DM_Sans_500Medium',
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Results */}
      {isLoading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonCard />}
          contentContainerStyle={styles.list}
        />
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
            Couldn't load listings
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={[styles.retryText, { color: colors.primaryForeground, fontFamily: 'DM_Sans_500Medium' }]}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      ) : properties.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="home-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
            No listings found
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
            Try a different location or fewer filters.
          </Text>
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
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: Platform.OS === 'web' ? 100 : 90 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  logo: {
    fontSize: 26,
    letterSpacing: -0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  filters: {
    gap: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  list: {
    padding: 16,
    paddingTop: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 4,
  },
  retryText: {
    fontSize: 15,
  },
});
