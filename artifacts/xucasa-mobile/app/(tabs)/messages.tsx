import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiGet, adaptConversation, type Conversation } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

function ConversationRow({ item, onPress }: { item: Conversation; onPress: () => void }) {
  const colors = useColors();
  const name = item.otherUserName || item.otherUserEmail || 'Agent';
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const timeAgo = item.lastMessageAt
    ? new Date(item.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : '';

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
        <Text style={[styles.avatarText, { color: colors.primary, fontFamily: 'DM_Sans_700Bold' }]}>
          {initials}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, { color: colors.foreground, fontFamily: 'DM_Sans_500Medium' }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.rowTime, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
            {timeAgo}
          </Text>
        </View>
        {item.propertyAddress && (
          <Text style={[styles.rowProp, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]} numberOfLines={1}>
            re: {item.propertyAddress}
          </Text>
        )}
        <Text style={[styles.rowLast, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]} numberOfLines={1}>
          {item.lastMessage || 'No messages yet'}
        </Text>
      </View>

      {/* Unread badge */}
      {(item.unreadCount ?? 0) > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
            {item.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const raw = await apiGet<any[]>('/api/conversations');
      const currentId = user?.id ?? '';
      return (raw ?? []).map((c: any) => adaptConversation(c, currentId)) as Conversation[];
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 10, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>Messages</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="chatbubble-ellipses-outline" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
            Sign in to view messages
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
            Connect with agents and sellers about homes you're interested in.
          </Text>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth')}
          >
            <Text style={[styles.ctaText, { color: colors.primaryForeground, fontFamily: 'DM_Sans_500Medium' }]}>
              Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const conversations = data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 10, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Loading...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubble-ellipses-outline" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
            No messages yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: 'DM_Sans_400Regular' }]}>
            When you inquire about a listing, your conversation will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c: Conversation) => String(c.id)}
          renderItem={({ item }: { item: Conversation }) => (
            <ConversationRow
              item={item}
              onPress={() => router.push(`/conversation/${item.id}`)}
            />
          )}
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
  },
  title: { fontSize: 28 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 16 },
  rowContent: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: 15, flex: 1 },
  rowTime: { fontSize: 12, flexShrink: 0 },
  rowProp: { fontSize: 12 },
  rowLast: { fontSize: 13 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: { fontSize: 20, textAlign: 'center' },
  emptyBody: { fontSize: 15, textAlign: 'center' },
  ctaBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 4,
  },
  ctaText: { fontSize: 15 },
});
