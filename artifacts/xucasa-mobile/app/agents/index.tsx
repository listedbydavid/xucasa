import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  useGetAgentDirectory,
  getGetAgentDirectoryQueryKey,
  type AgentDirectoryItem,
} from '@workspace/api-client-react';

export default function AgentDirectoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const pageSize = 25;
  const canAccess = user?.role === 'agent' && user.agentVerified === true;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setOffset(0);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const params = {
    q: debouncedQuery.length >= 2 ? debouncedQuery : undefined,
    limit: pageSize,
    offset,
  };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetAgentDirectory(params, {
    query: {
      enabled: canAccess,
      staleTime: 60000,
      queryKey: getGetAgentDirectoryQueryKey(params),
    }
  });

  const renderItem = ({ item }: { item: AgentDirectoryItem }) => {
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/agents/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {item.profileImageUrl ? (
            <Image
              source={{ uri: item.profileImageUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.muted }]}>
              <Ionicons name="person" size={24} color={colors.mutedForeground} />
            </View>
          )}
          
          <View style={styles.cardInfo}>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {item.displayName || item.id}
            </Text>
            
            {item.brokerageName && (
              <Text style={[styles.brokerage, { color: colors.mutedForeground }]}>
                {item.brokerageName}
              </Text>
            )}
            
            {item.licenseNumber && (
              <Text style={[styles.license, { color: colors.mutedForeground }]}>
                Lic: {item.licenseNumber}
                {item.licenseState ? ` (${item.licenseState})` : ''}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </View>

        <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{item.currentListingsCount || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{item.salesYtdCount || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>YTD</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{item.salesFiveYearsCount || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>5 Year</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (authLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="shield-checkmark-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Verified agent access</Text>
        <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>
          The professional directory is available to verified agents.
        </Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: colors.muted }]}>
          <Ionicons name="search" size={20} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search agents by name, brokerage, or location..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Failed to load directory</Text>
          <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>
            {(error as any)?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data?.agents || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No agents found</Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                {debouncedQuery 
                  ? "Try changing your search terms" 
                  : "The agent directory is currently empty"}
              </Text>
            </View>
          }
          ListFooterComponent={
            data && data.total > pageSize ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageButton, { borderColor: colors.border }]}
                  disabled={offset === 0 || isFetching}
                  onPress={() => setOffset(current => Math.max(0, current - pageSize))}
                >
                  <Text style={{ color: offset === 0 ? colors.mutedForeground : colors.foreground }}>Previous</Text>
                </TouchableOpacity>
                <Text style={[styles.pageLabel, { color: colors.mutedForeground }]}>
                  {offset + 1}–{Math.min(offset + pageSize, data.total)} of {data.total}
                </Text>
                <TouchableOpacity
                  style={[styles.pageButton, { borderColor: colors.border }]}
                  disabled={offset + pageSize >= data.total || isFetching}
                  onPress={() => setOffset(current => current + pageSize)}
                >
                  <Text style={{ color: offset + pageSize >= data.total ? colors.mutedForeground : colors.foreground }}>Next</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    height: '100%',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 12,
  },
  pageButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pageLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
  },
  brokerage: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  license: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_600SemiBold',
  },
  emptyBody: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_600SemiBold',
  },
  errorBody: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
  },
});
