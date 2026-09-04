import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetAgentProfileQueryKey, useGetAgentProfile } from '@workspace/api-client-react';
import type { AgentPropertySummary } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/useColors';
import { formatPrice } from '@/lib/api';
import { agentPropertyRoute } from '@/lib/agentDirectoryRoutes';

function PropertySummaryRow({ property }: { property: AgentPropertySummary }) {
  const colors = useColors();
  const router = useRouter();
  const amount = property.closePrice ?? property.price;
  return (
    <Pressable
      testID={`agent-property-${property.id}`}
      accessibilityRole="button"
      onPress={() => router.push(agentPropertyRoute(property.id))}
      style={({ pressed }) => [
        styles.property,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
      ]}
    >
      {property.imageUrl ? (
        <Image source={{ uri: property.imageUrl }} style={styles.propertyImage} />
      ) : (
        <View style={[styles.propertyImage, styles.imageFallback, { backgroundColor: colors.muted }]}>
          <Ionicons name="home-outline" size={24} color={colors.mutedForeground} />
        </View>
      )}
      <View style={styles.propertyBody}>
        <Text style={[styles.propertyTitle, { color: colors.foreground }]} numberOfLines={1}>
          {property.location || property.title}
        </Text>
        {(property.addressCity || property.addressState) ? (
          <Text style={[styles.propertyLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
            {[property.addressCity, property.addressState].filter(Boolean).join(', ')}
          </Text>
        ) : null}
        <Text style={[styles.propertyDetails, { color: colors.mutedForeground }]}>
          {property.beds} bd · {property.baths} ba · {property.sqft.toLocaleString()} sqft
        </Text>
      </View>
      <View style={styles.propertyPriceWrap}>
        <Text style={[styles.propertyPrice, { color: colors.foreground }]}>{formatPrice(amount)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

function PropertySection({ title, properties, empty }: { title: string; properties: AgentPropertySummary[]; empty: string }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {properties.length ? properties.map((property) => <PropertySummaryRow key={property.id} property={property} />) : (
        <View style={[styles.emptySection, { borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{empty}</Text>
        </View>
      )}
    </View>
  );
}

function ContactButton({ icon, label, value, href }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; href: string }) {
  const colors = useColors();
  return (
    <Pressable
      testID={`agent-contact-${label.toLowerCase()}`}
      onPress={() => Linking.openURL(href)}
      style={({ pressed }) => [styles.contact, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={[styles.contactText, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

export default function AgentProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const agentId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isVerifiedAgent = user?.role === 'agent' && user.agentVerified === true;
  const profile = useGetAgentProfile(agentId, {
    query: {
      enabled: !!agentId && isAuthenticated && isVerifiedAgent,
      queryKey: getGetAgentProfileQueryKey(agentId),
    },
  });
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth');
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!isVerifiedAgent) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topInset }]}>
        <Ionicons name="shield-checkmark-outline" size={54} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Agent access only</Text>
        <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>Public agent profiles are available to authenticated xucasa agents.</Text>
        <Pressable testID="agent-profile-back" onPress={() => router.back()} style={[styles.action, { backgroundColor: colors.primary }]}>
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Back</Text>
        </Pressable>
      </View>
    );
  }
  if (profile.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.errorBody, { color: colors.mutedForeground }]}>Loading agent profile…</Text></View>;
  }
  if (profile.isError || !profile.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topInset }]}>
        <Ionicons name="person-circle-outline" size={54} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Profile unavailable</Text>
        <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>This verified-agent profile could not be found.</Text>
        <Pressable testID="agent-profile-back" onPress={() => router.replace('/agents')} style={[styles.action, { backgroundColor: colors.primary }]}>
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Back to directory</Text>
        </Pressable>
      </View>
    );
  }

  const agent = profile.data;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.nav, { paddingTop: topInset + 6, borderBottomColor: colors.border }]}>
        <Pressable testID="agent-profile-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={27} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Agent Profile</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {agent.profileImageUrl ? (
            <Image source={{ uri: agent.profileImageUrl }} style={styles.heroAvatar} />
          ) : (
            <View style={[styles.heroAvatar, styles.imageFallback, { backgroundColor: colors.muted }]}>
              <Text style={[styles.heroInitial, { color: colors.mutedForeground }]}>{agent.displayName?.charAt(0).toUpperCase() || 'A'}</Text>
            </View>
          )}
          <Text style={[styles.name, { color: colors.foreground }]}>{agent.displayName || 'Agent'}</Text>
          {agent.brokerageName ? <Text style={[styles.brokerage, { color: colors.mutedForeground }]}>{agent.brokerageName}</Text> : null}
          {agent.lastMlsSyncAt ? (
            <View style={[styles.verified, { backgroundColor: colors.secondary }]}>
              <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
              <Text style={[styles.verifiedText, { color: colors.secondaryForeground }]}>MLS verified</Text>
            </View>
          ) : null}
          <View style={styles.contacts}>
            {agent.email ? <ContactButton icon="mail-outline" label="Email" value={agent.email} href={`mailto:${agent.email}`} /> : null}
            {agent.phone ? <ContactButton icon="call-outline" label="Phone" value={agent.phone} href={`tel:${agent.phone}`} /> : null}
            {agent.website ? <ContactButton icon="globe-outline" label="Website" value="Website" href={agent.website} /> : null}
          </View>
        </View>

        <View style={[styles.production, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ProductionStat value={agent.currentListingsCount} label="Active" />
          <ProductionStat value={agent.salesYtdCount} label={`${agent.periods.currentYear} YTD`} />
          <ProductionStat value={agent.salesPreviousYearCount} label={`${agent.periods.previousYear}`} />
          <ProductionStat value={agent.salesFiveYearsCount} label="5 years" />
        </View>

        {(agent.licenseNumber || agent.licenseState || agent.brokerageLicense || agent.brokerageAddress || agent.brokerageWebsite) ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Professional details</Text>
            {agent.licenseNumber || agent.licenseState ? <Detail label="Agent license" value={[agent.licenseNumber, agent.licenseState].filter(Boolean).join(' · ')} /> : null}
            {agent.brokerageLicense ? <Detail label="Brokerage license" value={agent.brokerageLicense} /> : null}
            {agent.brokerageAddress ? <Detail label="Office address" value={agent.brokerageAddress} /> : null}
            {agent.brokerageWebsite ? <Detail label="Brokerage website" value={agent.brokerageWebsite} /> : null}
          </View>
        ) : null}
        {agent.bio ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>{agent.bio}</Text>
          </View>
        ) : null}

        <PropertySection title={`Current listings (${agent.currentListings.length})`} properties={agent.currentListings} empty="No current listings." />
        <PropertySection title={`Sales YTD ${agent.periods.currentYear} (${agent.salesYtd.length})`} properties={agent.salesYtd} empty="No recorded sales this year." />
        <PropertySection title={`Sales ${agent.periods.previousYear} (${agent.salesPreviousYear.length})`} properties={agent.salesPreviousYear} empty="No recorded sales for this period." />
        <PropertySection title={`Historical sales ${agent.periods.fiveYearStart}–${agent.periods.currentYear} (${agent.salesFiveYears.length})`} properties={agent.salesFiveYears} empty="No historical sales available." />
      </ScrollView>
    </View>
  );
}

function ProductionStat({ value, label }: { value: number; label: string }) {
  const colors = useColors();
  return <View style={styles.productionStat}><Text style={[styles.productionValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.productionLabel, { color: colors.mutedForeground }]}>{label}</Text></View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return <View style={[styles.detail, { borderBottomColor: colors.border }]}><Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  nav: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTitle: { fontFamily: 'Outfit_700Bold', fontSize: 23 },
  hero: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 },
  heroAvatar: { width: 100, height: 100, borderRadius: 50 },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  heroInitial: { fontFamily: 'Outfit_700Bold', fontSize: 38 },
  name: { fontFamily: 'Outfit_700Bold', fontSize: 28, textAlign: 'center', marginTop: 14 },
  brokerage: { fontFamily: 'DMSans_500Medium', fontSize: 16, textAlign: 'center', marginTop: 3 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  verifiedText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  contacts: { width: '100%', marginTop: 18, gap: 8 },
  contact: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactText: { fontFamily: 'DMSans_500Medium', fontSize: 14, flex: 1 },
  production: { marginHorizontal: 16, borderWidth: 1, borderRadius: 16, paddingVertical: 16, flexDirection: 'row' },
  productionStat: { flex: 1, alignItems: 'center' },
  productionValue: { fontFamily: 'Outfit_700Bold', fontSize: 21 },
  productionLabel: { fontFamily: 'DMSans_400Regular', fontSize: 10, marginTop: 2, textTransform: 'uppercase' },
  section: { paddingHorizontal: 16, marginTop: 28 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, marginBottom: 12 },
  detail: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontFamily: 'DMSans_500Medium', fontSize: 12, textTransform: 'uppercase' },
  detailValue: { fontFamily: 'DMSans_500Medium', fontSize: 15, marginTop: 3 },
  bio: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22 },
  property: { minHeight: 88, borderWidth: 1, borderRadius: 14, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  propertyImage: { width: 68, height: 68, borderRadius: 10 },
  propertyBody: { flex: 1, minWidth: 0 },
  propertyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  propertyLocation: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  propertyDetails: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 4 },
  propertyPriceWrap: { alignItems: 'flex-end', gap: 7 },
  propertyPrice: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  emptySection: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 22, alignItems: 'center' },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14 },
  errorTitle: { fontFamily: 'Outfit_700Bold', fontSize: 22, textAlign: 'center' },
  errorBody: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  action: { borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  actionText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
});