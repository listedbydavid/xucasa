import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { apiGet, apiPatch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import type { NotificationPreferences } from '@/hooks/usePushNotifications';
import { unregisterPushDevice } from '@/lib/pushNotifications';

interface BuyerProfile {
  id: number;
  preApprovalAmount?: number;
  preferredCities?: string[];
  minBeds?: number;
  isActive?: boolean;
}

interface AssignedAgent {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  brokerageName?: string;
  profileImageUrl?: string;
}

function ProfileRow({ icon, label, value, onPress }: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const Component = onPress ? TouchableOpacity : View;
  return (
    <Component
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon as any} size={20} color={colors.foreground} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
          {label}
        </Text>
        {value && (
          <Text style={[styles.rowValue, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
            {value}
          </Text>
        )}
      </View>
      {onPress && <Feather name="chevron-right" size={20} color={colors.mutedForeground} />}
    </Component>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const queryClient = useQueryClient();
  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const { data: buyerProfile } = useQuery({
    queryKey: ['buyer-profile'],
    queryFn: () => apiGet<BuyerProfile>('/api/buyer-profiles/mine'),
    enabled: isAuthenticated,
  });

  const { data: assignedAgent } = useQuery({
    queryKey: ['assigned-agent'],
    queryFn: () => apiGet<AssignedAgent>('/api/assigned-agent'),
    enabled: isAuthenticated,
  });

  const { data: notificationPreferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => apiGet<NotificationPreferences>('/api/notification-preferences'),
    enabled: isAuthenticated,
  });

  const preferenceMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const preferences = await apiPatch<NotificationPreferences>('/api/notification-preferences', {
        pushEnabled: enabled,
        pushPriceDrop: enabled,
      });
      if (!enabled) await unregisterPushDevice().catch(() => undefined);
      return preferences;
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(['notification-preferences'], preferences);
    },
  });

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      logout();
      return;
    }
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          logout();
        },
      },
    ]);
  };

  const displayName = user?.name || user?.firstName
    ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.name
    : user?.email?.split('@')[0] ?? 'User';

  const initials = (displayName || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!isAuthenticated && !isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 10, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>Profile</Text>
        </View>
        <View style={styles.center}>
          <View style={[styles.bigAvatar, { backgroundColor: colors.muted }]}>
            <Ionicons name="person-outline" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
            Your xucasa account
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
            Sign in to save homes, track your search, and connect with your agent.
          </Text>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth')}
          >
            <Text style={[styles.ctaText, { color: colors.primaryForeground, fontFamily: 'DMSans_700Bold' }]}>
              Sign in or register
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 10, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={styles.userSection}>
          <View style={[styles.bigAvatar, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.bigAvatarText, { color: colors.primary, fontFamily: 'Outfit_700Bold' }]}>
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.userName, { color: colors.foreground, fontFamily: 'Outfit_700Bold' }]}>
              {displayName}
            </Text>
            <Text style={[styles.userEmail, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
              {user?.email}
            </Text>
          </View>
        </View>

        {/* Buyer profile section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'DMSans_700Bold' }]}>
          BUYER PROFILE
        </Text>
        <View style={styles.group}>
          {buyerProfile?.preApprovalAmount ? (
            <ProfileRow
              icon="cash-outline"
              label="Pre-approval"
              value={`$${buyerProfile.preApprovalAmount.toLocaleString()}`}
            />
          ) : (
            <ProfileRow
              icon="cash-outline"
              label="Pre-approval"
              value="Not set"
            />
          )}
          {buyerProfile?.preferredCities?.length ? (
            <ProfileRow
              icon="location-outline"
              label="Preferred cities"
              value={buyerProfile.preferredCities.join(', ')}
            />
          ) : (
            <ProfileRow
              icon="location-outline"
              label="Preferred cities"
              value="Not set"
            />
          )}
        </View>

        {/* Agent section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'DMSans_700Bold' }]}>
          MY AGENT
        </Text>
        <View style={styles.group}>
          {assignedAgent ? (
            <>
              <ProfileRow
                icon="person-circle-outline"
                label="Agent"
                value={
                  [assignedAgent.firstName, assignedAgent.lastName].filter(Boolean).join(' ').trim() ||
                  assignedAgent.email ||
                  'Assigned agent'
                }
              />
              {assignedAgent.brokerageName && (
                <ProfileRow icon="business-outline" label="Brokerage" value={assignedAgent.brokerageName} />
              )}
              {assignedAgent.phone && (
                <ProfileRow icon="call-outline" label="Phone" value={assignedAgent.phone} />
              )}
            </>
          ) : (
            <ProfileRow
              icon="person-circle-outline"
              label="Agent"
              value="An agent will be assigned soon"
            />
          )}
        </View>

        {/* Notifications */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'DMSans_700Bold' }]}>
          NOTIFICATIONS
        </Text>
        <View style={styles.group}>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowIcon}>
              <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.preferenceTitle, { color: colors.foreground, fontFamily: 'DMSans_500Medium' }]}>
                Price drop alerts
              </Text>
              <Text style={[styles.preferenceDescription, { color: colors.mutedForeground, fontFamily: 'DMSans_400Regular' }]}>
                Alert me when saved homes change price
              </Text>
            </View>
            <Switch
              accessibilityLabel="Saved-home price drop notifications"
              value={(notificationPreferences?.pushEnabled ?? true) && (notificationPreferences?.pushPriceDrop ?? true)}
              disabled={!notificationPreferences || preferenceMutation.isPending}
              trackColor={{ false: colors.border, true: colors.primary + '66' }}
              thumbColor={
                notificationPreferences?.pushEnabled && notificationPreferences?.pushPriceDrop
                  ? colors.primary
                  : colors.mutedForeground
              }
              onValueChange={(enabled) => {
                Haptics.selectionAsync();
                preferenceMutation.mutate(enabled);
              }}
            />
          </View>
        </View>

        {/* Account */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'DMSans_700Bold' }]}>
          ACCOUNT
        </Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 0 }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="log-out-outline" size={20} color="#DC3030" />
            </View>
            <Text style={[styles.signOutText, { color: '#DC3030', fontFamily: 'DMSans_500Medium' }]}>
              Sign out
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Platform.OS === 'web' ? 100 : 90 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 28 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  emptyTitle: { fontSize: 22, textAlign: 'center' },
  emptyBody: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  ctaBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 8,
  },
  ctaText: { fontSize: 16 },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  bigAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bigAvatarText: { fontSize: 24 },
  userName: { fontSize: 22 },
  userEmail: { fontSize: 15 },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1.2,
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  group: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 15 },
  preferenceTitle: { fontSize: 16 },
  preferenceDescription: { fontSize: 14, marginTop: 2 },
  signOutText: { fontSize: 16, flex: 1 },
});