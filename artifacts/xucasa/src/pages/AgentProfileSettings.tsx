import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { 
  useGetOwnAgentPublicProfile, 
  useUpdateOwnAgentPublicProfile, 
  useSyncOwnAgentPublicProfileFromMls,
  getGetAgentDirectoryQueryKey,
  getGetAgentProfileQueryKey,
  getGetOwnAgentPublicProfileQueryKey
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, RefreshCw, Eye, Save } from "lucide-react";
import type { AgentPublicProfileUpdate, OwnAgentPublicProfile } from "@workspace/api-client-react";

export default function AgentProfileSettings() {
  usePageMeta({ title: "Public Profile Settings", noIndex: true });
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const { data: profile, isLoading, error } = useGetOwnAgentPublicProfile({
    query: { enabled: isAuthenticated && user?.role === "agent" && user.agentVerified === true, queryKey: getGetOwnAgentPublicProfileQueryKey() }
  });

  const updateProfile = useUpdateOwnAgentPublicProfile();
  const syncMls = useSyncOwnAgentPublicProfileFromMls();

  const [formData, setFormData] = useState<AgentPublicProfileUpdate>({});
  
  const initialized = useRef(false);
  useEffect(() => {
    if (profile && !initialized.current) {
      initialized.current = true;
      setFormData({
        bio: profile.bio || "",
        displayNameOverride: profile.displayNameOverride ?? undefined,
        emailOverride: profile.emailOverride ?? undefined,
        phoneOverride: profile.phoneOverride ?? undefined,
        websiteOverride: profile.websiteOverride ?? undefined,
        profileImageUrlOverride: profile.profileImageUrlOverride ?? undefined,
        brokerageNameOverride: profile.brokerageNameOverride ?? undefined,
        brokerageAddressOverride: profile.brokerageAddressOverride ?? undefined,
        brokerageWebsiteOverride: profile.brokerageWebsiteOverride ?? undefined,
        licenseOverride: profile.licenseOverride ?? undefined,
        brokerageLicenseOverride: profile.brokerageLicenseOverride ?? undefined,
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

  if (!isAuthenticated || user?.role !== "agent" || !user.agentVerified) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-4">
        <ShieldCheck className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold mb-4">Access Restricted</h1>
        <p className="text-muted-foreground mb-8">Agent profile settings are only available to verified agents.</p>
        <Link href="/agent" className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-20 px-4 text-center">
        <p className="text-red-500 font-bold">Failed to load profile settings.</p>
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSave = () => {
    // Send explicitly null for empty overrides so they reset to MLS
    const payload: AgentPublicProfileUpdate = { ...formData };
    
    // Process string overrides: if empty string, convert to null
    const overrideFields = [
      "displayNameOverride", "emailOverride", "phoneOverride", "websiteOverride",
      "profileImageUrlOverride", "brokerageNameOverride", "brokerageAddressOverride",
      "brokerageWebsiteOverride", "licenseOverride", "brokerageLicenseOverride"
    ] as const;
    
    overrideFields.forEach(field => {
      if (payload[field] === "") {
        (payload as any)[field] = null;
      }
    });

    updateProfile.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Profile updated", description: "Your public profile has been saved." });
        queryClient.invalidateQueries({ queryKey: getGetOwnAgentPublicProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAgentDirectoryQueryKey() });
        if (user?.id) queryClient.invalidateQueries({ queryKey: getGetAgentProfileQueryKey(user.id) });
      },
      onError: (err: any) => {
        toast({ title: "Failed to update", description: err.message || "An error occurred.", variant: "destructive" });
      }
    });
  };

  const handleSync = () => {
    syncMls.mutate(undefined, {
      onSuccess: (data: any) => {
        const count = data?.importedCount;
        toast({ 
          title: "MLS Sync Complete", 
          description: count !== undefined ? `Imported ${count} records from MLS.` : "Your data has been refreshed from the MLS." 
        });
        queryClient.invalidateQueries({ queryKey: getGetOwnAgentPublicProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAgentDirectoryQueryKey() });
        if (user?.id) queryClient.invalidateQueries({ queryKey: getGetAgentProfileQueryKey(user.id) });
      },
      onError: (err: any) => {
        toast({ title: "Sync failed", description: err.message || "Could not sync with MLS.", variant: "destructive" });
      }
    });
  };

  const renderField = (
    label: string,
    overrideKey: keyof AgentPublicProfileUpdate,
    mlsValue: string | null | undefined,
    showKey?: keyof AgentPublicProfileUpdate,
    resolvedSource?: string,
  ) => {
    const overrideVal = formData[overrideKey] as string | undefined;
    const isOverridden = overrideVal !== undefined && overrideVal !== null && overrideVal !== "";
    const showVal = showKey ? (formData[showKey] as boolean) : true;
    const inheritedSource = resolvedSource === "account" ? "Account" : mlsValue ? "MLS" : "Empty";

    return (
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Label className="text-base font-bold flex items-center gap-2 mb-2">
              {label}
              {isOverridden ? (
                <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Custom</span>
              ) : inheritedSource === "MLS" ? (
                <span className="text-[10px] uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">MLS</span>
              ) : inheritedSource === "Account" ? (
                <span className="text-[10px] uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">Account</span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold">Empty</span>
              )}
            </Label>
            
            <Input
              value={overrideVal === undefined ? "" : overrideVal}
              onChange={(e) => setFormData({ ...formData, [overrideKey]: e.target.value })}
              placeholder={mlsValue || `Enter custom ${label.toLowerCase()}...`}
              className="bg-background"
            />
            {isOverridden && (
              <p className="text-xs text-muted-foreground mt-2">
                {mlsValue && <>MLS value: <span className="font-semibold text-foreground">{mlsValue}</span></>}
                <button 
                  onClick={() => setFormData({ ...formData, [overrideKey]: "" })}
                  className={mlsValue ? "ml-2 text-primary hover:underline font-semibold" : "text-primary hover:underline font-semibold"}
                >
                  {mlsValue ? "Reset to MLS" : "Use verified source"}
                </button>
              </p>
            )}
          </div>
          
          {showKey && (
            <div className="flex flex-col items-end gap-2 pt-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                {showVal ? "Visible" : "Hidden"}
              </Label>
              <Switch
                checked={showVal}
                onCheckedChange={(c) => setFormData({ ...formData, [showKey]: c })}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      <div className="bg-background border-b border-border sticky top-16 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Public Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your directory presence and MLS overrides</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncMls.isPending}
              className="font-bold rounded-full"
            >
              {syncMls.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sync MLS
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateProfile.isPending}
              className="font-bold rounded-full shadow-md"
            >
              {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold">Personal Information</h2>
          </div>
          <div className="space-y-4">
            {renderField("Display Name", "displayNameOverride", profile.mlsDisplayName, undefined, profile.resolvedPreview?.sourceFields?.displayName)}
            
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2">
              <Label className="text-base font-bold">Biography</Label>
              <Textarea
                value={formData.bio || ""}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell clients and peers about your experience, specialties, and approach..."
                className="min-h-[120px] bg-background"
              />
            </div>
            
            {renderField("Profile Image URL", "profileImageUrlOverride", profile.mlsProfileImageUrl, undefined, profile.resolvedPreview?.sourceFields?.profileImageUrl)}
            {renderField("License Number", "licenseOverride", profile.mlsLicense, "showLicense", profile.resolvedPreview?.sourceFields?.license)}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold">Contact Details</h2>
          </div>
          <div className="space-y-4">
            {renderField("Email Address", "emailOverride", profile.mlsEmail, "showEmail", profile.resolvedPreview?.sourceFields?.email)}
            {renderField("Phone Number", "phoneOverride", profile.mlsPhone, "showPhone", profile.resolvedPreview?.sourceFields?.phone)}
            {renderField("Website", "websiteOverride", profile.mlsWebsite, "showWebsite", profile.resolvedPreview?.sourceFields?.website)}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold">Brokerage Information</h2>
          </div>
          <div className="space-y-4">
            {renderField("Brokerage Name", "brokerageNameOverride", profile.mlsBrokerageName, "showBrokerageName", profile.resolvedPreview?.sourceFields?.brokerageName)}
            {renderField("Brokerage Address", "brokerageAddressOverride", profile.mlsBrokerageAddress, "showBrokerageAddress", profile.resolvedPreview?.sourceFields?.brokerageAddress)}
            {renderField("Brokerage License", "brokerageLicenseOverride", profile.mlsBrokerageLicense, "showBrokerageLicense", profile.resolvedPreview?.sourceFields?.brokerageLicense)}
            {renderField("Brokerage Website", "brokerageWebsiteOverride", profile.mlsBrokerageWebsite, "showBrokerageWebsite", profile.resolvedPreview?.sourceFields?.brokerageWebsite)}
          </div>
        </section>

        <section className="bg-primary/5 border border-primary/20 rounded-3xl p-6">
          <h2 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Live Preview
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            This is how your profile appears to other agents based on your saved settings.
          </p>
          <Link href={`/agents/${user.id}`} className="inline-flex text-sm font-semibold text-primary hover:underline mb-6">
            View full public profile
          </Link>
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-sm">
            <div className="w-24 h-24 rounded-full bg-muted overflow-hidden flex-shrink-0 border-2 border-background shadow-sm">
              {profile.resolvedPreview?.profileImageUrl ? (
                <img src={profile.resolvedPreview.profileImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                  {profile.resolvedPreview?.displayName?.[0] || "A"}
                </div>
              )}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-foreground">{profile.resolvedPreview?.displayName || "Unknown Agent"}</h3>
              <p className="font-semibold text-muted-foreground flex items-center justify-center md:justify-start gap-1.5 mt-1">
                {profile.resolvedPreview?.brokerageName || "Independent"}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3 text-sm">
                {profile.resolvedPreview?.email && <span className="bg-muted px-2.5 py-1 rounded-md">{profile.resolvedPreview.email}</span>}
                {profile.resolvedPreview?.phone && <span className="bg-muted px-2.5 py-1 rounded-md">{profile.resolvedPreview.phone}</span>}
              </div>
            </div>
          </div>
        </section>
        
      </div>
    </div>
  );
}
