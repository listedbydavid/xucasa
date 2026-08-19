import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Switch } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiGet, apiDelete, apiPatch, adaptProperty, type SavedProperty } from '@/lib/api';
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

  const alertMutation = useMutation({
    mutationFn: ({ propertyId, enabled }: { propertyId: number; enabled: boolean }) =>
      apiPatch(`/api/saved-properties/${propertyId}/price-drop-alert`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-properties'] }),
  });

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
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
            Keep track of homes you love and get notified of price changes.
          </Text>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth')}
          >
            <Text style={[styles.ctaBtnText, { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold' }]}>
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
          <Text style={[styles.count, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
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
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
            Tap the heart on any listing to save it here.
          </Text>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/')}
          >
            <Text style={[styles.ctaBtnText, { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold' }]}>
              Browse listings
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(s: SavedProperty) => String(s.id)}
          renderItem={({ item }: { item: SavedProperty }) => (
            <View style={[styles.savedItem, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: Platform.OS === 'web' ? 1 : 0 }]}>
              <PropertyCard
                property={item.property}
                isSaved
                embedded
                onPress={() => router.push(`/property/${item.property.id}`)}
                onSaveToggle={() => handleUnsave(item.property.id)}
              />
              <View style={[styles.alertRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <View style={styles.alertCopy}>
                  <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                  <View style={styles.alertText}>
                    <Text style={[styles.alertTitle, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
                      Price drop alert
                    </Text>
                    <Text style={[styles.alertDescription, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
                      Notify me when this home’s price falls
                    </Text>
                  </View>
                </View>
                <Switch
                  accessibilityLabel={`Price drop alert for ${item.property.address}`}
                  value={item.priceDropAlerts ?? false}
                  disabled={alertMutation.isPending}
                  trackColor={{ false: colors.border, true: colors.primary + '66' }}
                  thumbColor={item.priceDropAlerts ? colors.primary : colors.mutedForeground}
                  onValueChange={(enabled) => {
                    Haptics.selectionAsync();
                    alertMutation.mutate({ propertyId: item.property.id, enabled });
                  }}
                />
              </View>
            </View>
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
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  title: {
    fontSize: 28,
  },
  count: {
    fontSize: 15,
  },
  list: {
    padding: 16,
    paddingTop: 16,
  },
  savedItem: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }
      : { elevation: 4 }),
  },
  alertRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  alertCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertText: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 15 },
  alertDescription: { fontSize: 13 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 22,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 8,
  },
  ctaBtnText: {
    fontSize: 16,
  },
});