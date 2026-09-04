import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  useGetOwnAgentPublicProfile,
  useUpdateOwnAgentPublicProfile,
  useSyncOwnAgentPublicProfileFromMls,
  type AgentPublicProfileUpdate,
  getGetOwnAgentPublicProfileQueryKey,
  getGetAgentDirectoryQueryKey,
  getGetAgentProfileQueryKey,
} from '@workspace/api-client-react';

function FormField({ 
  label, 
  value, 
  onChangeText, 
  placeholder,
  multiline = false,
  provenance,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  provenance?: string | null;
  colors: any;
}) {
  return (
    <View style={styles.fieldContainer}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        {provenance && (
          <Text style={[styles.provenance, { color: colors.mutedForeground }]}>
            {provenance}
          </Text>
        )}
      </View>
      <TextInput
        style={[
          styles.input,
          { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
          multiline && styles.inputMultiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} style={styles.resetButton}>
          <Text style={[styles.resetButtonText, { color: colors.primary }]}>Reset to MLS or account value</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ToggleField({
  label,
  value,
  onValueChange,
  colors,
}: {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  colors: any;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary + '66' }}
        thumbColor={value ? colors.primary : colors.mutedForeground}
      />
    </View>
  );
}

export default function AgentProfileSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const canAccess = user?.role === 'agent' && user.agentVerified === true;

  const { data: profile, isLoading, isError, error, refetch } = useGetOwnAgentPublicProfile({
    query: {
      enabled: canAccess,
      queryKey: getGetOwnAgentPublicProfileQueryKey(),
    },
  });
  const updateProfile = useUpdateOwnAgentPublicProfile();
  const syncMls = useSyncOwnAgentPublicProfileFromMls();

  // Form state
  const [formData, setFormData] = useState<AgentPublicProfileUpdate>({});

  useEffect(() => {
    if (profile) {
      setFormData({
        bio: profile.bio || '',
        displayNameOverride: profile.displayNameOverride || '',
        emailOverride: profile.emailOverride || '',
        phoneOverride: profile.phoneOverride || '',
        websiteOverride: profile.websiteOverride || '',
        profileImageUrlOverride: profile.profileImageUrlOverride || '',
        brokerageNameOverride: profile.brokerageNameOverride || '',
        brokerageAddressOverride: profile.brokerageAddressOverride || '',
        brokerageWebsiteOverride: profile.brokerageWebsiteOverride || '',
        licenseOverride: profile.licenseOverride || '',
        brokerageLicenseOverride: profile.brokerageLicenseOverride || '',
        showEmail: profile.showEmail ?? true,
        showPhone: profile.showPhone ?? true,
        showWebsite: profile.showWebsite ?? true,
        showLicense: profile.showLicense ?? true,
        showBrokerageName: profile.showBrokerageName ?? true,
        showBrokerageAddress: profile.showBrokerageAddress ?? true,
        showBrokerageWebsite: profile.showBrokerageWebsite ?? true,
        showBrokerageLicense: profile.showBrokerageLicense ?? true,
      });
    }
  }, [profile]);

  const handleSave = () => {
    // Convert empty strings to null for override fields
    const payload: AgentPublicProfileUpdate = {
      ...formData,
      bio: formData.bio || null,
      displayNameOverride: formData.displayNameOverride || null,
      emailOverride: formData.emailOverride || null,
      phoneOverride: formData.phoneOverride || null,
      websiteOverride: formData.websiteOverride || null,
      profileImageUrlOverride: formData.profileImageUrlOverride || null,
      brokerageNameOverride: formData.brokerageNameOverride || null,
      brokerageAddressOverride: formData.brokerageAddressOverride || null,
      brokerageWebsiteOverride: formData.brokerageWebsiteOverride || null,
      licenseOverride: formData.licenseOverride || null,
      brokerageLicenseOverride: formData.brokerageLicenseOverride || null,
    };

    updateProfile.mutate({ data: payload }, {
      onSuccess: () => {
        Alert.alert('Success', 'Profile updated successfully.');
        queryClient.invalidateQueries({ queryKey: getGetOwnAgentPublicProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAgentDirectoryQueryKey() });
        if (user?.id) queryClient.invalidateQueries({ queryKey: getGetAgentProfileQueryKey(user.id) });
      },
      onError: (err) => {
        Alert.alert('Error', (err as any)?.message || 'Failed to update profile.');
      }
    });
  };

  const handleSync = () => {
    syncMls.mutate(undefined, {
      onSuccess: (data) => {
        const message = data.importedCount === undefined
          ? 'Your MLS profile data has been refreshed.'
          : `Imported ${data.importedCount} MLS records.`;
        Alert.alert('MLS Synced', message);
        queryClient.invalidateQueries({ queryKey: getGetOwnAgentPublicProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAgentDirectoryQueryKey() });
        if (user?.id) queryClient.invalidateQueries({ queryKey: getGetAgentProfileQueryKey(user.id) });
      },
      onError: (err) => {
        Alert.alert('Error', (err as any)?.message || 'Failed to sync with MLS.');
      }
    });
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
          Public profile settings are available after agent verification.
        </Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Failed to load settings</Text>
        <Text style={[styles.errorBody, { color: colors.mutedForeground }]}>
          {(error as any)?.message || 'An unexpected error occurred'}
        </Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
          <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getProvenance = (overrideVal?: string | null, mlsVal?: string | null) => {
    if (overrideVal) return 'Custom Override';
    if (mlsVal) return 'From MLS';
    return 'From Account';
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 16 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={60}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Preview & Sync</Text>
          <TouchableOpacity 
            style={[styles.syncBtn, { backgroundColor: colors.primary + '15' }]} 
            onPress={handleSync}
            disabled={syncMls.isPending}
          >
            {syncMls.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="sync" size={16} color={colors.primary} />
            )}
            <Text style={[styles.syncBtnText, { color: colors.primary }]}>Sync MLS</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.previewBox, { backgroundColor: colors.muted }]}>
          <Text style={[styles.previewTitle, { color: colors.foreground }]}>
            {profile.resolvedPreview?.displayName || 'Your Name'}
          </Text>
          <Text style={[styles.previewSubtitle, { color: colors.mutedForeground }]}>
            {profile.resolvedPreview?.brokerageName || 'Brokerage Name'}
          </Text>
          {profile.lastMlsSyncAt && (
            <Text style={[styles.previewSync, { color: colors.mutedForeground }]}>
              Last synced: {new Date(profile.lastMlsSyncAt).toLocaleString()}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Basic Info</Text>
        <FormField
          label="Display Name Override"
          value={formData.displayNameOverride || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, displayNameOverride: text }))}
          placeholder={profile.mlsDisplayName || 'Leave blank to use account name'}
          provenance={getProvenance(formData.displayNameOverride, profile.mlsDisplayName)}
          colors={colors}
        />
        <FormField
          label="Bio"
          value={formData.bio || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
          placeholder="Tell buyers about yourself..."
          multiline
          colors={colors}
        />
        <FormField
          label="Profile Image URL Override"
          value={formData.profileImageUrlOverride || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, profileImageUrlOverride: text }))}
          placeholder="https://..."
          provenance={getProvenance(formData.profileImageUrlOverride, profile.mlsProfileImageUrl)}
          colors={colors}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contact Info</Text>
        <FormField
          label="Email Override"
          value={formData.emailOverride || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, emailOverride: text }))}
          placeholder={profile.mlsEmail || 'Leave blank to use account email'}
          provenance={getProvenance(formData.emailOverride, profile.mlsEmail)}
          colors={colors}
        />
        <ToggleField
          label="Show Email on Profile"
          value={formData.showEmail ?? true}
          onValueChange={(val) => setFormData(prev => ({ ...prev, showEmail: val }))}
          colors={colors}
        />

        <FormField
          label="Phone Override"
          value={formData.phoneOverride || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, phoneOverride: text }))}
          placeholder={profile.mlsPhone || 'Enter phone number'}
          provenance={getProvenance(formData.phoneOverride, profile.mlsPhone)}
          colors={colors}
        />
        <ToggleField
          label="Show Phone on Profile"
          value={formData.showPhone ?? true}
          onValueChange={(val) => setFormData(prev => ({ ...prev, showPhone: val }))}
          colors={colors}
        />

        <FormField
          label="Website Override"
          value={formData.websiteOverride || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, websiteOverride: text }))}
          placeholder={profile.mlsWebsite || 'https://...'}
          provenance={getProvenance(formData.websiteOverride, profile.mlsWebsite)}
          colors={colors}
        />
        <ToggleField
          label="Show Website on Profile"
          value={formData.showWebsite ?? true}
          onValueChange={(val) => setFormData(prev => ({ ...prev, showWebsite: val }))}
          colors={colors}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>License & Brokerage</Text>
        <FormField
          label="License Override"
          value={formData.licenseOverride || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, licenseOverride: text }))}
          placeholder={profile.mlsLicense || 'License Number'}
          provenance={getProvenance(formData.licenseOverride, profile.mlsLicense)}
          colors={colors}
        />
        <ToggleField
          label="Show License on Profile"
          value={formData.showLicense ?? true}
          onValueChange={(val) => setFormData(prev => ({ ...prev, showLicense: val }))}
          colors={colors}
        />

        <FormField
          label="Brokerage Name Override"
          value={formData.brokerageNameOverride || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, brokerageNameOverride: text }))}
          placeholder={profile.mlsBrokerageName || 'Brokerage Name'}
          provenance={getProvenance(formData.brokerageNameOverride, profile.mlsBrokerageName)}
          colors={colors}
        />
        <ToggleField
          label="Show Brokerage Name"
          value={formData.showBrokerageName ?? true}
          onValueChange={(val) => setFormData(prev => ({ ...prev, showBrokerageName: val }))}
          colors={colors}
        />

        <FormField
          label="Brokerage Address Override"
          value={formData.brokerageAddressOverride || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, brokerageAddressOverride: text }))}
          placeholder={profile.mlsBrokerageAddress || 'Brokerage Address'}
          provenance={getProvenance(formData.brokerageAddressOverride, profile.mlsBrokerageAddress)}
          colors={colors}
        />
        <ToggleField
          label="Show Brokerage Address"
          value={formData.showBrokerageAddress ?? true}
          onValueChange={(val) => setFormData(prev => ({ ...prev, showBrokerageAddress: val }))}
          colors={colors}
        />

        <FormField
          label="Brokerage License Override"
          value={formData.brokerageLicenseOverride || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, brokerageLicenseOverride: text }))}
          placeholder={profile.mlsBrokerageLicense || 'Brokerage License'}
          provenance={getProvenance(formData.brokerageLicenseOverride, profile.mlsBrokerageLicense)}
          colors={colors}
        />
        <ToggleField
          label="Show Brokerage License"
          value={formData.showBrokerageLicense ?? true}
          onValueChange={(val) => setFormData(prev => ({ ...prev, showBrokerageLicense: val }))}
          colors={colors}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, updateProfile.isPending && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

    </KeyboardAwareScrollViewCompat>
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
  section: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 16,
  },
  previewBox: {
    padding: 16,
    borderRadius: 12,
    gap: 4,
  },
  previewTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
  },
  previewSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  previewSync: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginTop: 8,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  syncBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  resetButton: {
    alignSelf: 'flex-start',
    paddingTop: 8,
    paddingVertical: 4,
  },
  resetButtonText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  provenance: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveBtnText: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
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
