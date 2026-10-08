import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAgentDirectoryQueryKey,
  getGetAgentProfileQueryKey,
  getGetOwnAgentPublicProfileQueryKey,
  useGetOwnAgentPublicProfile,
  useSyncOwnAgentPublicProfileFromMls,
  useUpdateOwnAgentPublicProfile,
} from '@workspace/api-client-react';
import type { AgentProfile, AgentPublicProfileUpdate, OwnAgentPublicProfile } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/useColors';
import { getUserScopedQueryKey } from '@/lib/sessionQueryCache';

type StringField = Exclude<keyof AgentPublicProfileUpdate,
  'showEmail' | 'showPhone' | 'showWebsite' | 'showLicense' |
  'showBrokerageName' | 'showBrokerageAddress' | 'showBrokerageWebsite' | 'showBrokerageLicense'
>;
type VisibilityField = Extract<keyof AgentPublicProfileUpdate, `show${string}`>;

const PERSONAL_FIELDS: FieldConfig[] = [
  { label: 'Display name', key: 'displayNameOverride', mlsKey: 'mlsDisplayName' },
  { label: 'Profile image URL', key: 'profileImageUrlOverride', mlsKey: 'mlsProfileImageUrl', inputMode: 'url' },
  { label: 'License number', key: 'licenseOverride', mlsKey: 'mlsLicense', visibility: 'showLicense' },
];
const CONTACT_FIELDS: FieldConfig[] = [
  { label: 'Email address', key: 'emailOverride', mlsKey: 'mlsEmail', visibility: 'showEmail', inputMode: 'email' },
  { label: 'Phone number', key: 'phoneOverride', mlsKey: 'mlsPhone', visibility: 'showPhone', inputMode: 'tel' },
  { label: 'Website', key: 'websiteOverride', mlsKey: 'mlsWebsite', visibility: 'showWebsite', inputMode: 'url' },
];
const BROKERAGE_FIELDS: FieldConfig[] = [
  { label: 'Brokerage name', key: 'brokerageNameOverride', mlsKey: 'mlsBrokerageName', visibility: 'showBrokerageName' },
  { label: 'Brokerage address', key: 'brokerageAddressOverride', mlsKey: 'mlsBrokerageAddress', visibility: 'showBrokerageAddress' },
  { label: 'Brokerage website', key: 'brokerageWebsiteOverride', mlsKey: 'mlsBrokerageWebsite', visibility: 'showBrokerageWebsite', inputMode: 'url' },
  { label: 'Brokerage license', key: 'brokerageLicenseOverride', mlsKey: 'mlsBrokerageLicense', visibility: 'showBrokerageLicense' },
];
const OVERRIDE_FIELDS: StringField[] = [
  'displayNameOverride', 'emailOverride', 'phoneOverride', 'websiteOverride',
  'profileImageUrlOverride', 'brokerageNameOverride', 'brokerageAddressOverride',
  'brokerageWebsiteOverride', 'licenseOverride', 'brokerageLicenseOverride',
];

interface FieldConfig {
  label: string;
  key: StringField;
  mlsKey: keyof OwnAgentPublicProfile;
  visibility?: VisibilityField;
  inputMode?: 'text' | 'email' | 'tel' | 'url';
}

function initialForm(profile: OwnAgentPublicProfile): AgentPublicProfileUpdate {
  return {
    bio: profile.bio ?? '',
    displayNameOverride: profile.displayNameOverride ?? '',
    emailOverride: profile.emailOverride ?? '',
    phoneOverride: profile.phoneOverride ?? '',
    websiteOverride: profile.websiteOverride ?? '',
    profileImageUrlOverride: profile.profileImageUrlOverride ?? '',
    brokerageNameOverride: profile.brokerageNameOverride ?? '',
    brokerageAddressOverride: profile.brokerageAddressOverride ?? '',
    brokerageWebsiteOverride: profile.brokerageWebsiteOverride ?? '',
    licenseOverride: profile.licenseOverride ?? '',
    brokerageLicenseOverride: profile.brokerageLicenseOverride ?? '',
    showEmail: profile.showEmail ?? true,
    showPhone: profile.showPhone ?? true,
    showWebsite: profile.showWebsite ?? true,
    showLicense: profile.showLicense ?? true,
    showBrokerageName: profile.showBrokerageName ?? true,
    showBrokerageAddress: profile.showBrokerageAddress ?? true,
    showBrokerageWebsite: profile.showBrokerageWebsite ?? true,
    showBrokerageLicense: profile.showBrokerageLicense ?? true,
  };
}

function currentPublicPreview(profile: OwnAgentPublicProfile, form: AgentPublicProfileUpdate): AgentProfile {
  const base = profile.resolvedPreview;
  const value = (
    override: StringField,
    mls: keyof OwnAgentPublicProfile,
    fallback: string | null | undefined,
  ) => {
    const correction = form[override];
    if (typeof correction === 'string' && correction.trim()) return correction.trim();
    const verified = profile[mls];
    return typeof verified === 'string' && verified.trim() ? verified : fallback ?? null;
  };
  const visible = (flag: VisibilityField, next: string | null) => form[flag] === false ? null : next;

  return {
    ...base,
    displayName: value('displayNameOverride', 'mlsDisplayName', base.displayName),
    profileImageUrl: value('profileImageUrlOverride', 'mlsProfileImageUrl', base.profileImageUrl),
    email: visible('showEmail', value('emailOverride', 'mlsEmail', base.email)),
    phone: visible('showPhone', value('phoneOverride', 'mlsPhone', base.phone)),
    website: visible('showWebsite', value('websiteOverride', 'mlsWebsite', base.website)),
    brokerageName: visible('showBrokerageName', value('brokerageNameOverride', 'mlsBrokerageName', base.brokerageName)),
    brokerageAddress: visible('showBrokerageAddress', value('brokerageAddressOverride', 'mlsBrokerageAddress', base.brokerageAddress)),
    brokerageWebsite: visible('showBrokerageWebsite', value('brokerageWebsiteOverride', 'mlsBrokerageWebsite', base.brokerageWebsite)),
    licenseNumber: visible('showLicense', value('licenseOverride', 'mlsLicense', base.licenseNumber)),
    licenseState: form.showLicense === false ? null : base.licenseState,
    brokerageLicense: visible('showBrokerageLicense', value('brokerageLicenseOverride', 'mlsBrokerageLicense', base.brokerageLicense)),
    bio: form.bio?.trim() || null,
  };
}

function PublicOutputPreview({ agent }: { agent: AgentProfile }) {
  const colors = useColors();
  const details = [
    agent.licenseNumber || agent.licenseState
      ? { label: 'Agent license', value: [agent.licenseNumber, agent.licenseState].filter(Boolean).join(' · ') }
      : null,
    agent.brokerageLicense ? { label: 'Brokerage license', value: agent.brokerageLicense } : null,
    agent.brokerageAddress ? { label: 'Office address', value: agent.brokerageAddress } : null,
    agent.brokerageWebsite ? { label: 'Brokerage website', value: agent.brokerageWebsite } : null,
  ].filter((detail): detail is { label: string; value: string } => detail !== null);

  return (
    <View testID="own-agent-profile-preview" style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.previewLabelRow}>
        <View style={[styles.previewIcon, { backgroundColor: colors.secondary }]}>
          <Ionicons name="eye-outline" size={17} color={colors.primary} />
        </View>
        <View style={styles.previewLabelText}>
          <Text style={[styles.previewTitle, { color: colors.foreground }]}>Public output</Text>
          <Text style={[styles.previewHint, { color: colors.mutedForeground }]}>Live preview · changes are not saved yet</Text>
        </View>
      </View>

      <View style={[styles.previewProfile, { borderTopColor: colors.border }]}>
        {agent.profileImageUrl ? (
          <Image source={{ uri: agent.profileImageUrl }} style={styles.previewAvatar} />
        ) : (
          <View style={[styles.previewAvatar, styles.previewAvatarFallback, { backgroundColor: colors.muted }]}>
            <Text style={[styles.previewInitial, { color: colors.mutedForeground }]}>{agent.displayName?.charAt(0).toUpperCase() || 'A'}</Text>
          </View>
        )}
        <Text style={[styles.previewName, { color: colors.foreground }]}>{agent.displayName || 'Agent'}</Text>
        {agent.brokerageName ? <Text style={[styles.previewBrokerage, { color: colors.mutedForeground }]}>{agent.brokerageName}</Text> : null}

        {(agent.email || agent.phone || agent.website) ? (
          <View style={styles.previewContacts}>
            {agent.email ? <PreviewContact icon="mail-outline" value={agent.email} /> : null}
            {agent.phone ? <PreviewContact icon="call-outline" value={agent.phone} /> : null}
            {agent.website ? <PreviewContact icon="globe-outline" value="Website" /> : null}
          </View>
        ) : (
          <Text style={[styles.previewEmpty, { color: colors.mutedForeground }]}>No public contact details</Text>
        )}

        {details.length ? (
          <View style={[styles.previewDetails, { borderTopColor: colors.border }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.foreground }]}>Professional details</Text>
            {details.map((detail) => (
              <View key={detail.label} style={styles.previewDetail}>
                <Text style={[styles.previewDetailLabel, { color: colors.mutedForeground }]}>{detail.label}</Text>
                <Text style={[styles.previewDetailValue, { color: colors.foreground }]}>{detail.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {agent.bio ? (
          <View style={[styles.previewDetails, { borderTopColor: colors.border }]}>
            <Text style={[styles.previewSectionTitle, { color: colors.foreground }]}>About</Text>
            <Text style={[styles.previewBio, { color: colors.mutedForeground }]}>{agent.bio}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PreviewContact({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.previewContact, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={[styles.previewContactText, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Editor({ profile }: { profile: OwnAgentPublicProfile }) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<AgentPublicProfileUpdate>(() => initialForm(profile));
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const refreshCaches = (data: OwnAgentPublicProfile) => {
    queryClient.setQueryData(
      getUserScopedQueryKey(getGetOwnAgentPublicProfileQueryKey(), data.userId),
      data,
    );
    queryClient.invalidateQueries({ queryKey: getGetAgentDirectoryQueryKey() });
    if (user?.id) queryClient.invalidateQueries({ queryKey: getGetAgentProfileQueryKey(user.id) });
  };

  const update = useUpdateOwnAgentPublicProfile({
    mutation: {
      onSuccess: (data) => {
        refreshCaches(data);
        setForm(initialForm(data));
        setFeedback({ kind: 'success', text: 'Your public profile was saved.' });
      },
      onError: (error) => setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Could not save your profile.' }),
    },
  });
  const sync = useSyncOwnAgentPublicProfileFromMls({
    mutation: {
      onSuccess: (data) => {
        refreshCaches(data);
        const count = data.importedCount;
        setFeedback({
          kind: 'success',
          text: count === undefined ? 'MLS data refreshed. Your corrections were preserved.' : `MLS sync complete (${count} records). Your corrections were preserved.`,
        });
      },
      onError: (error) => setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Could not sync MLS data.' }),
    },
  });

  const save = () => {
    setFeedback(null);
    const payload: AgentPublicProfileUpdate = { ...form, bio: form.bio?.trim() || null };
    for (const key of OVERRIDE_FIELDS) {
      const value = payload[key];
      if (typeof value === 'string') payload[key] = value.trim() || null;
    }
    update.mutate({ data: payload });
  };

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const preview = currentPublicPreview(profile, form);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 6, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable testID="own-agent-profile-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={27} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>Public Profile</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Manage corrections and visibility</Text>
        </View>
      </View>
      <KeyboardAwareScrollViewCompat
        testID="own-agent-profile-form"
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 32 }]}
      >
        <View style={[styles.syncCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.syncText}>
            <Text style={[styles.syncTitle, { color: colors.secondaryForeground }]}>MLS source data</Text>
            <Text style={[styles.syncBody, { color: colors.mutedForeground }]}>
              Refresh verified details without replacing your corrections.
            </Text>
          </View>
          <Pressable
            testID="own-agent-profile-sync"
            disabled={sync.isPending || update.isPending}
            onPress={() => { setFeedback(null); sync.mutate(); }}
            style={({ pressed }) => [styles.outlineButton, { borderColor: colors.primary, opacity: pressed || sync.isPending ? 0.55 : 1 }]}
          >
            {sync.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="refresh" size={18} color={colors.primary} />}
            <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Sync MLS</Text>
          </Pressable>
        </View>

        {feedback ? (
          <View
            testID="own-agent-profile-feedback"
            style={[styles.feedback, { backgroundColor: feedback.kind === 'error' ? colors.destructive : colors.secondary }]}
          >
            <Ionicons name={feedback.kind === 'error' ? 'alert-circle' : 'checkmark-circle'} size={18} color={feedback.kind === 'error' ? colors.destructiveForeground : colors.secondaryForeground} />
            <Text style={[styles.feedbackText, { color: feedback.kind === 'error' ? colors.destructiveForeground : colors.secondaryForeground }]}>{feedback.text}</Text>
          </View>
        ) : null}

        <FormSection title="Personal information" fields={PERSONAL_FIELDS} profile={profile} form={form} setForm={setForm} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Biography</Text>
          <TextInput
            testID="agent-field-bio"
            value={form.bio ?? ''}
            onChangeText={(bio) => setForm((current) => ({ ...current, bio }))}
            placeholder="Share your experience, specialties, and approach"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={4000}
            textAlignVertical="top"
            style={[styles.bioInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
          />
        </View>
        <FormSection title="Contact details" fields={CONTACT_FIELDS} profile={profile} form={form} setForm={setForm} />
        <FormSection title="Brokerage information" fields={BROKERAGE_FIELDS} profile={profile} form={form} setForm={setForm} />

        <PublicOutputPreview agent={preview} />

        <Pressable
          testID="own-agent-profile-save"
          disabled={update.isPending || sync.isPending}
          onPress={save}
          style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary, opacity: pressed || update.isPending ? 0.6 : 1 }]}
        >
          {update.isPending ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />}
          <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Save public profile</Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function FormSection({
  title,
  fields,
  profile,
  form,
  setForm,
}: {
  title: string;
  fields: FieldConfig[];
  profile: OwnAgentPublicProfile;
  form: AgentPublicProfileUpdate;
  setForm: React.Dispatch<React.SetStateAction<AgentPublicProfileUpdate>>;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {fields.map((field) => {
        const value = form[field.key];
        const mlsValue = profile[field.mlsKey];
        const isCustom = typeof value === 'string' && value.length > 0;
        const visible = field.visibility ? form[field.visibility] !== false : true;
        return (
          <View key={field.key} style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.fieldHeader}>
              <View style={styles.fieldLabelRow}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{field.label}</Text>
                <View style={[styles.sourceBadge, { backgroundColor: isCustom ? `${colors.primary}18` : colors.muted }]}>
                  <Text style={[styles.sourceText, { color: isCustom ? colors.primary : colors.mutedForeground }]}>{isCustom ? 'CUSTOM' : mlsValue ? 'MLS' : 'EMPTY'}</Text>
                </View>
              </View>
              {field.visibility ? (
                <View style={styles.visibility}>
                  <Text style={[styles.visibilityText, { color: colors.mutedForeground }]}>{visible ? 'Visible' : 'Hidden'}</Text>
                  <Switch
                    testID={`agent-visibility-${field.visibility}`}
                    value={visible}
                    onValueChange={(next) => setForm((current) => ({ ...current, [field.visibility as VisibilityField]: next }))}
                    trackColor={{ false: colors.border, true: `${colors.primary}66` }}
                    thumbColor={visible ? colors.primary : colors.mutedForeground}
                  />
                </View>
              ) : null}
            </View>
            <TextInput
              testID={`agent-field-${field.key}`}
              value={typeof value === 'string' ? value : ''}
              onChangeText={(next) => setForm((current) => ({ ...current, [field.key]: next }))}
              placeholder={typeof mlsValue === 'string' && mlsValue ? mlsValue : `Enter ${field.label.toLowerCase()}`}
              placeholderTextColor={colors.mutedForeground}
              inputMode={field.inputMode ?? 'text'}
              autoCapitalize={field.inputMode === 'email' || field.inputMode === 'url' ? 'none' : 'sentences'}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.input }]}
            />
            {isCustom ? (
              <Pressable testID={`agent-reset-${field.key}`} onPress={() => setForm((current) => ({ ...current, [field.key]: '' }))} style={styles.reset}>
                <Ionicons name="return-down-back" size={14} color={colors.primary} />
                <Text style={[styles.resetText, { color: colors.primary }]}>Reset to verified source</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function OwnAgentProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isVerifiedAgent = user?.role === 'agent' && user.agentVerified === true;
  const ownProfileQueryKey = user?.id
    ? getUserScopedQueryKey(getGetOwnAgentPublicProfileQueryKey(), user.id)
    : getGetOwnAgentPublicProfileQueryKey();
  const profile = useGetOwnAgentPublicProfile({
    query: {
      enabled: isAuthenticated && isVerifiedAgent,
      queryKey: ownProfileQueryKey,
    },
  });
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

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
        <Text style={[styles.gateTitle, { color: colors.foreground }]}>Agent profile management</Text>
        <Text style={[styles.gateBody, { color: colors.mutedForeground }]}>This area is available only to authenticated xucasa agents.</Text>
        <Pressable testID="own-agent-profile-back" onPress={() => router.back()} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Back to profile</Text>
        </Pressable>
      </View>
    );
  }
  if (profile.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.gateBody, { color: colors.mutedForeground }]}>Loading profile settings…</Text></View>;
  }
  if (profile.isError || !profile.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topInset }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
        <Text style={[styles.gateTitle, { color: colors.foreground }]}>Couldn’t load profile</Text>
        <Text style={[styles.gateBody, { color: colors.mutedForeground }]}>Please check your agent access and try again.</Text>
        <Pressable testID="own-agent-profile-retry" onPress={() => profile.refetch()} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  return <Editor key={profile.data.userId} profile={profile.data} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { flex: 1 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 23 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 1 },
  content: { padding: 16 },
  syncCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  syncText: { flex: 1 },
  syncTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  syncBody: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  outlineButton: { height: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  outlineButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  feedback: { borderRadius: 12, padding: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 13 },
  section: { marginTop: 26, gap: 10 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20 },
  fieldCard: { borderWidth: 1, borderRadius: 15, padding: 13 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 },
  fieldLabelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  fieldLabel: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  sourceBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  sourceText: { fontFamily: 'DMSans_700Bold', fontSize: 9 },
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  visibilityText: { fontFamily: 'DMSans_400Regular', fontSize: 11 },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontFamily: 'DMSans_400Regular', fontSize: 14 },
  bioInput: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, fontFamily: 'DMSans_400Regular', fontSize: 14 },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  resetText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  previewCard: { marginTop: 30, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  previewLabelRow: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  previewLabelText: { flex: 1 },
  previewTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  previewHint: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 1 },
  previewProfile: { borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center', padding: 18 },
  previewAvatar: { width: 78, height: 78, borderRadius: 39 },
  previewAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  previewInitial: { fontFamily: 'Outfit_700Bold', fontSize: 30 },
  previewName: { fontFamily: 'Outfit_700Bold', fontSize: 24, textAlign: 'center', marginTop: 11 },
  previewBrokerage: { fontFamily: 'DMSans_500Medium', fontSize: 14, textAlign: 'center', marginTop: 2 },
  previewContacts: { width: '100%', gap: 7, marginTop: 15 },
  previewContact: { height: 40, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  previewContactText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 13 },
  previewEmpty: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 15 },
  previewDetails: { width: '100%', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 15 },
  previewSectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 17, marginBottom: 5 },
  previewDetail: { paddingTop: 8 },
  previewDetailLabel: { fontFamily: 'DMSans_500Medium', fontSize: 10, textTransform: 'uppercase' },
  previewDetailValue: { fontFamily: 'DMSans_500Medium', fontSize: 14, marginTop: 2 },
  previewBio: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  saveButton: { minHeight: 48, borderRadius: 24, paddingHorizontal: 24, marginTop: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  gateTitle: { fontFamily: 'Outfit_700Bold', fontSize: 22, textAlign: 'center' },
  gateBody: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 340 },
});