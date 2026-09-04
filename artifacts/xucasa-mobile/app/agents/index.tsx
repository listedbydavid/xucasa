import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetAgentDirectoryQueryKey, useGetAgentDirectory } from '@workspace/api-client-react';
import type { AgentDirectoryItem } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/useColors';

function AgentCard({ agent, onPress }: { agent: AgentDirectoryItem; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      testID={`agent-card-${agent.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
      ]}
    >
      {agent.profileImageUrl ? (
        <Image source={{ uri: agent.profileImageUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.muted }]}>
          <Text style={[styles.avatarLetter, { color: colors.mutedForeground }]}>
            {agent.displayName?.trim().charAt(0).toUpperCase() || 'A'}
          </Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {agent.displayName || 'Agent'}
        </Text>
        {agent.brokerageName ? (
          <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {agent.brokerageName}
          </Text>
        ) : null}
        {(agent.licenseNumber || agent.licenseState) ? (
          <Text style={[styles.license, { color: colors.mutedForeground }]}>
            License {agent.licenseNumber || '—'}{agent.licenseState ? ` · ${agent.licenseState}` : ''}
          </Text>
        ) : null}
        <View style={[styles.stats, { borderTopColor: colors.border }]}>
          <Stat value={agent.currentListingsCount} label="Active" />
          <Stat value={agent.salesYtdCount} label="YTD" />
          <Stat value={agent.salesFiveYearsCount} label="5 years" />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function AgentDirectoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isVerifiedAgent = user?.role === 'agent' && user.agentVerified === true;
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth');
  }, [authLoading, isAuthenticated, router]);

  const directoryParams = { q: query || undefined, limit: pageSize, offset };
  const directory = useGetAgentDirectory(directoryParams, {
    query: {
      enabled: isAuthenticated && isVerifiedAgent,
      queryKey: getGetAgentDirectoryQueryKey(directoryParams),
    },
  });
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  if (authLoading || !isAuthenticated) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!isVerifiedAgent) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topInset }]}>
        <Ionicons name="shield-checkmark-outline" size={54} color={colors.mutedForeground} />
        <Text style={[styles.gateTitle, { color: colors.foreground }]}>Agent access only</Text>
        <Text style={[styles.gateBody, { color: colors.mutedForeground }]}>
          The verified-agent directory is available to authenticated xucasa agents.
        </Text>
        <Pressable testID="agent-directory-back" onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Back to profile</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Pressable testID="agent-directory-back" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Agent Directory</Text>
        </View>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Search verified professionals across the xucasa network.
        </Text>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.input }]}>
          <Ionicons name="search" size={19} color={colors.mutedForeground} />
          <TextInput
            testID="agent-directory-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Name, brokerage, or license"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
          />
          {search ? (
            <Pressable testID="agent-directory-clear" onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={19} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {directory.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={[styles.statusText, { color: colors.mutedForeground }]}>Loading verified agents…</Text></View>
      ) : directory.isError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.destructive} />
          <Text style={[styles.gateTitle, { color: colors.foreground }]}>Directory unavailable</Text>
          <Text style={[styles.gateBody, { color: colors.mutedForeground }]}>We couldn’t load the agent directory. Please try again.</Text>
          <Pressable testID="agent-directory-retry" onPress={() => directory.refetch()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          testID="agent-directory-list"
          data={directory.data?.agents ?? []}
          keyExtractor={(agent) => agent.id}
          renderItem={({ item }) => <AgentCard agent={item} onPress={() => router.push(`/agents/${encodeURIComponent(item.id)}`)} />}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 24 }]}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<Text style={[styles.results, { color: colors.mutedForeground }]}>{directory.data?.total ?? 0} verified agents</Text>}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={46} color={colors.mutedForeground} />
              <Text style={[styles.gateTitle, { color: colors.foreground }]}>No agents found</Text>
              <Text style={[styles.gateBody, { color: colors.mutedForeground }]}>Try a different name, brokerage, or license.</Text>
            </View>
          }
          ListFooterComponent={
            directory.data && directory.data.total > pageSize ? (
              <View style={styles.pagination}>
                <Pressable
                  accessibilityRole="button"
                  disabled={offset === 0 || directory.isFetching}
                  onPress={() => setOffset((current) => Math.max(0, current - pageSize))}
                  style={[styles.pageButton, { borderColor: colors.border, opacity: offset === 0 ? 0.45 : 1 }]}
                >
                  <Text style={[styles.pageButtonText, { color: colors.foreground }]}>Previous</Text>
                </Pressable>
                <Text style={[styles.pageStatus, { color: colors.mutedForeground }]}>
                  {offset + 1}–{Math.min(offset + pageSize, directory.data.total)} of {directory.data.total}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={offset + pageSize >= directory.data.total || directory.isFetching}
                  onPress={() => setOffset((current) => current + pageSize)}
                  style={[
                    styles.pageButton,
                    { borderColor: colors.border, opacity: offset + pageSize >= directory.data.total ? 0.45 : 1 },
                  ]}
                >
                  <Text style={[styles.pageButtonText, { color: colors.foreground }]}>Next</Text>
                </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  header: { paddingHorizontal: 18, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28 },
  intro: { fontFamily: 'DMSans_400Regular', fontSize: 15, marginTop: 7, marginBottom: 16 },
  searchBox: { height: 48, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 },
  searchInput: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 16, paddingVertical: 0 },
  list: { padding: 16 },
  results: { fontFamily: 'DMSans_500Medium', fontSize: 13, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: 'Outfit_700Bold', fontSize: 23 },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: 'DMSans_700Bold', fontSize: 17 },
  cardSubtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 2 },
  license: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 3 },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10 },
  stat: { flex: 1 },
  statValue: { fontFamily: 'Outfit_700Bold', fontSize: 17 },
  statLabel: { fontFamily: 'DMSans_400Regular', fontSize: 10, textTransform: 'uppercase' },
  gateTitle: { fontFamily: 'Outfit_700Bold', fontSize: 22, textAlign: 'center' },
  gateBody: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 340 },
  primaryButton: { borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  buttonText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  statusText: { fontFamily: 'DMSans_400Regular', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 70, gap: 10 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 12 },
  pageButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  pageButtonText: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  pageStatus: { fontFamily: 'DMSans_500Medium', fontSize: 12 },
});