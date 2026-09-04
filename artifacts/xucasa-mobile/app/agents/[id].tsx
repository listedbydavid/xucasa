import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useGetAgentProfile, getGetAgentProfileQueryKey, type AgentPropertySummary } from '@workspace/api-client-react';

function ListingCard({ property, onPress, colors }: { property: AgentPropertySummary; onPress: () => void; colors: any }) {
  const displayPrice = property.closePrice ? property.closePrice : property.price;
  
  return (
    <TouchableOpacity
      style={[styles.listingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {property.imageUrl ? (
        <Image
          source={{ uri: property.imageUrl }}
          style={styles.listingImage}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.listingImagePlaceholder, { backgroundColor: colors.muted }]}>
          <Ionicons name="home-outline" size={24} color={colors.mutedForeground} />
        </View>
      )}
      <View style={styles.listingInfo}>
        <Text style={[styles.listingPrice, { color: colors.foreground }]}>
          ${displayPrice.toLocaleString()}
        </Text>
        <Text style={[styles.listingSpecs, { color: colors.foreground }]}>
          {property.beds} bd | {property.baths} ba | {property.sqft.toLocaleString()} sqft
        </Text>
        <Text style={[styles.listingAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
          {property.title}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={[styles.listingStatus, { color: colors.mutedForeground }]}>
            {property.status}
          </Text>
          {(property.closeDate || property.listDate) && (
            <Text style={[styles.listingDate, { color: colors.mutedForeground }]}>
              {new Date((property.closeDate || property.listDate) as string).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AgentProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const canAccess = user?.role === 'agent' && user.agentVerified === true;

  const { data: agent, isLoading, isError, error, refetch } = useGetAgentProfile(id || '', {
    query: {
      enabled: !!id && canAccess,
      queryKey: getGetAgentProfileQueryKey(id || ''),
    }
  });

  const handleContact = async (type: 'email' | 'phone' | 'web', value: string) => {
    try {
      let target: string;
      if (type === 'email') {
        target = `mailto:${value}`;
      } else if (type === 'phone') {
        target = `tel:${value}`;
      } else {
        const parsed = new URL(value);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('Unsupported website protocol');
        }
        target = parsed.toString();
      }
      if (!(await Linking.canOpenURL(target))) throw new Error('Unsupported link');
      await Linking.openURL(target);
    } catch {
      Alert.alert('Unable to open link', 'Please try again from a device that supports this action.');
    }
  };

  if (authLoading || isLoading) {
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
          Agent production profiles are available to verified agents.
        </Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isError || !agent) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Failed to load profile</Text>
        <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>
          {(error as any)?.message || 'An unexpected error occurred'}
        </Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
          <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderSection = (title: string, listings: AgentPropertySummary[]) => {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title} ({listings.length})</Text>
        {listings.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {listings.map(listing => (
              <ListingCard
                key={`${listing.id}-${listing.status}`}
                property={listing}
                colors={colors}
                onPress={() => router.push(`/property/${listing.id}`)}
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={[styles.emptySection, { color: colors.mutedForeground }]}>No recorded properties in this period.</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        {agent.profileImageUrl ? (
          <Image
            source={{ uri: agent.profileImageUrl }}
            style={styles.avatarBig}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatarBigPlaceholder, { backgroundColor: colors.muted }]}>
            <Ionicons name="person" size={48} color={colors.mutedForeground} />
          </View>
        )}
        <Text style={[styles.name, { color: colors.foreground }]}>{agent.displayName || agent.id}</Text>
        {agent.brokerageName && (
          <Text style={[styles.brokerage, { color: colors.mutedForeground }]}>{agent.brokerageName}</Text>
        )}
      </View>

      <View style={styles.contactRow}>
        {agent.phone && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
            onPress={() => handleContact('phone', agent.phone!)}
          >
            <Ionicons name="call" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Call</Text>
          </TouchableOpacity>
        )}
        {agent.email && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
            onPress={() => handleContact('email', agent.email!)}
          >
            <Ionicons name="mail" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Email</Text>
          </TouchableOpacity>
        )}
        {agent.website && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
            onPress={() => handleContact('web', agent.website!)}
          >
            <Ionicons name="globe" size={20} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Website</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.detailsContainer}>
        {agent.bio && (
          <View style={styles.detailBlock}>
            <Text style={[styles.detailTitle, { color: colors.foreground }]}>About</Text>
            <Text style={[styles.bioText, { color: colors.mutedForeground }]}>{agent.bio}</Text>
          </View>
        )}

        <View style={styles.detailBlock}>
          <Text style={[styles.detailTitle, { color: colors.foreground }]}>License & Brokerage</Text>
          {agent.licenseNumber && (
            <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
              License: {agent.licenseNumber} {agent.licenseState && `(${agent.licenseState})`}
            </Text>
          )}
          {agent.brokerageName && (
            <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
              Brokerage: {agent.brokerageName}
            </Text>
          )}
          {agent.brokerageAddress && (
            <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
              Address: {agent.brokerageAddress}
            </Text>
          )}
          {agent.brokerageLicense && (
            <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
              Brokerage License: {agent.brokerageLicense}
            </Text>
          )}
          {agent.brokerageWebsite && (
            <TouchableOpacity onPress={() => handleContact('web', agent.brokerageWebsite!)}>
              <Text style={[styles.detailLink, { color: colors.primary }]}>Visit brokerage website</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderSection('Current Listings', agent.currentListings || [])}
      {renderSection(`Closed in ${agent.periods.currentYear}`, agent.salesYtd || [])}
      {renderSection(`Closed in ${agent.periods.previousYear}`, agent.salesPreviousYear || [])}
      {renderSection(`Closed Since ${agent.periods.fiveYearStart}`, agent.salesFiveYears || [])}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  avatarBig: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  avatarBigPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  brokerage: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    textAlign: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  detailsContainer: {
    paddingHorizontal: 20,
    gap: 24,
    marginBottom: 24,
  },
  detailBlock: {
    gap: 8,
  },
  detailTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
  },
  detailText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 22,
  },
  detailLink: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    marginTop: 8,
  },
  emptySection: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bioText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 24,
  },
  section: {
    marginTop: 8,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  horizontalList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  listingCard: {
    width: 260,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  listingImage: {
    width: '100%',
    height: 140,
  },
  listingImagePlaceholder: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingInfo: {
    padding: 12,
    gap: 4,
  },
  listingPrice: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  listingSpecs: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  listingAddress: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  listingStatus: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    textTransform: 'uppercase',
  },
  listingDate: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
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
