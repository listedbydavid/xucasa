import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiGet, apiDelete, adaptProperty, type SavedProperty } from '@/lib/api';
import { PropertyCard } from '@/components/PropertyCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

export default function SavedScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['saved-properties'],
    queryFn: async () => {
      const raw = await apiGet<any[]>('/api/saved-properties');
      return (raw ?? []).map((s: any) => ({
        ...s,
        property: adaptProperty(s.property ?? s),
      })) as SavedProperty[];
    },
    enabled: isAuthenticated,
  });

  const handleUnsave = async (propertyId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await apiDelete(`/api/saved-properties/${propertyId}`);
    queryClient.invalidateQueries({ queryKey: ['saved-properties'] });
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 10, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>Saved</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
            Sign in to save homes
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
            Keep track of homes you love and get notified of price changes.
          </Text>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth')}
          >
            <Text style={[styles.ctaBtnText, { color: colors.primaryForeground, fontFamily: 'DM_Sans_500Medium' }]}>
              Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 10, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>Saved</Text>
        {data && data.length > 0 && (
          <Text style={[styles.count, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
            {data.length} {data.length === 1 ? 'home' : 'homes'}
          </Text>
        )}
      </View>

      {isLoading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonCard />}
          contentContainerStyle={styles.list}
        />
      ) : !data || data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
            No saved homes yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
            Tap the heart on any listing to save it here.
          </Text>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/')}
          >
            <Text style={[styles.ctaBtnText, { color: colors.primaryForeground, fontFamily: 'DM_Sans_500Medium' }]}>
              Browse listings
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(s: SavedProperty) => String(s.id)}
          renderItem={({ item }: { item: SavedProperty }) => (
            <PropertyCard
              property={item.property}
              isSaved
              onPress={() => router.push(`/property/${item.property.id}`)}
              onSaveToggle={() => handleUnsave(item.property.id)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshing={false}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: Platform.OS === 'web' ? 100 : 90 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  title: {
    fontSize: 28,
  },
  count: {
    fontSize: 14,
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
  ctaBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 4,
  },
  ctaBtnText: {
    fontSize: 15,
  },
});
