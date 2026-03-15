import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PropertyCard } from "@/components/PropertyCard";
import { SdmlsDisclaimer } from "@/components/SdmlsDisclaimer";
import {
  useSavedProperties, useSavedSearches, useDeleteSavedSearch, useRenameSavedSearch,
  useFavoriteLists, useCreateFavoriteList, useRenameFavoriteList,
  useDeleteFavoriteList, useMovePropertyToList,
} from "@/hooks/use-saved";
import {
  useSearchHistory, useDeleteSearchHistory, useClearSearchHistory,
  useMyHomes, useCreateMyHome, useDeleteMyHome, useMyHomeIntelligence,
  useUpdateProfile,
  useAgentInvite, useInviteAgent, useRemoveAgentInvite,
  useOpenHouses,
  useVerifyAgent,
} from "@/hooks/use-client-dashboard";
import { Link } from "wouter";
import {
  Heart, Search, User, Home, Clock, BookmarkCheck,
  Trash2, ChevronRight, X, Plus, Edit2, Check, MapPin,
  Droplets, TreeDeciduous, School, ShoppingCart, Building,
  Flame, Activity, ExternalLink, Camera, Loader2,
  UserPlus, CalendarDays, Mail, CheckCircle2, AlertCircle,
  FolderPlus, FolderOpen, MoreHorizontal, Pencil, List,
  Briefcase, ShieldCheck, BadgeCheck,
  FileText, DollarSign, ThumbsUp, ThumbsDown, Eye,
  ArrowRightLeft, Shield, Banknote,
  Bell, Archive, CheckCheck, Info, TrendingDown, Settings,
} from "lucide-react";
import { Autocomplete } from "@react-google-maps/api";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { OpenHouseRoutePlanner } from "@/components/OpenHouseRoutePlanner";
import { BuyerProfileModal } from "@/components/BuyerProfileModal";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BuyerProfile } from "@shared/schema";

type Section = "profile" | "myhome" | "favorites" | "searches" | "history" | "agent" | "openhouses" | "offers" | "notifications";

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const urlSection = new URLSearchParams(window.location.search).get("section");
  const [activeSection, setActiveSection] = useState<Section>(
    urlSection && ["profile","myhome","favorites","searches","history","agent","openhouses","offers","notifications"].includes(urlSection) ? urlSection as Section : "profile"
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Heart className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold mb-4">Your personal home hub</h1>
        <p className="text-muted-foreground mb-8 max-w-md">Log in to manage your profile, track your home, save favorites, and review your search history.</p>
        <a href="/api/login" className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-primary/30 transition-all hover:-translate-y-1">
          Log in or Sign up
        </a>
      </div>
    );
  }

  const navItems: { id: Section; label: string; icon: typeof User }[] = [
    { id: "profile",    label: "My Profile",       icon: User },
    { id: "myhome",     label: "My Home",          icon: Home },
    { id: "favorites",  label: "Favorites",        icon: Heart },
    { id: "searches",   label: "Saved Searches",   icon: BookmarkCheck },
    { id: "offers",     label: "Incoming Offers",  icon: FileText },
    { id: "agent",      label: "My Agent",         icon: UserPlus },
    { id: "openhouses", label: "Open Houses",      icon: CalendarDays },
    { id: "history",    label: "Search History",   icon: Clock },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20 text-xl font-bold text-primary flex-shrink-0">
            {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {user?.firstName ? `${user.firstName}'s Dashboard` : "My Dashboard"}
            </h1>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
          {/* Sidebar Nav */}
          <aside className="hidden md:flex flex-col w-56 flex-shrink-0 gap-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                data-testid={`nav-${id}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left ${
                  activeSection === id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {activeSection === id && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            ))}
          </aside>

          {/* Mobile nav pills */}
          <div className="md:hidden w-full overflow-x-auto">
            <div className="flex gap-2">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                    activeSection === id
                      ? "bg-primary text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {activeSection === "profile"    && <ProfileSection user={user} />}
            {activeSection === "myhome"     && <MyHomeSection />}
            {activeSection === "favorites"  && <FavoritesSection />}
            {activeSection === "searches"   && <SavedSearchesSection />}
            {activeSection === "offers"     && <IncomingOffersSection />}
            {activeSection === "agent"      && <MyAgentSection />}
            {activeSection === "openhouses" && <OpenHousesSection />}
            {activeSection === "history"    && <SearchHistorySection />}
            {activeSection === "notifications" && <NotificationsSection />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ── Profile Section ────────────────────────────────────────────────────────────

function ProfileSection({ user }: { user: any }) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const { mutate: updateProfile, isPending, isSuccess } = useUpdateProfile();

  const handleSave = () => {
    updateProfile({ firstName, lastName }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="My Profile" subtitle="Manage your account information" />

      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-3xl font-bold text-primary flex-shrink-0 border-2 border-primary/20">
            {(firstName || user?.firstName || user?.email || "U")[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edit-first-name" className="block text-xs font-bold text-muted-foreground mb-1">First Name</label>
                    <input
                      id="edit-first-name"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="w-full bg-background border-2 border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-last-name" className="block text-xs font-bold text-muted-foreground mb-1">Last Name</label>
                    <input
                      id="edit-last-name"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="w-full bg-background border-2 border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Email</label>
                  <input value={user?.email || ""} disabled className="w-full bg-muted border-2 border-border rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" />
                  <p className="text-xs text-muted-foreground mt-1">Email is managed by your Replit account</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50" data-testid="button-save-profile">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save
                  </button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-bold text-foreground">
                    {user?.firstName || user?.lastName
                      ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                      : "No name set"
                    }
                  </h3>
                  <button onClick={() => setEditing(true)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" data-testid="button-edit-profile">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Saved Homes" value={<FavoriteCount />} icon={Heart} color="text-rose-500" />
        <StatCard label="Saved Searches" value={<SavedSearchCount />} icon={BookmarkCheck} color="text-blue-500" />
        <StatCard label="My Homes" value={<MyHomeCount />} icon={Home} color="text-green-500" />
      </div>

      <BuyerCriteriaSection />

      <AgentVerificationSection user={user} />

      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-foreground mb-4">Account Actions</h3>
        <div className="space-y-2">
          <a href="/api/logout" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors">
            <X className="w-4 h-4" />
            Sign Out
          </a>
        </div>
      </div>
    </div>
  );
}

function BuyerCriteriaSection() {
  const [showModal, setShowModal] = useState(false);
  const { data: profile, isLoading } = useQuery<BuyerProfile | null>({
    queryKey: ["/api/buyer-profiles/mine"],
    queryFn: async () => {
      const res = await fetch("/api/buyer-profiles/mine");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Search className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="font-bold text-foreground">Buyer Criteria</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Search className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Buyer Criteria</h3>
            <p className="text-sm text-muted-foreground">Set your home search preferences</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Create a buyer profile so sellers can find you, and we can match you with homes that fit your criteria.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
          data-testid="button-create-buyer-profile"
        >
          <Plus className="w-4 h-4" />
          Create Buyer Profile
        </button>
        {showModal && <BuyerProfileModal onClose={() => setShowModal(false)} />}
      </div>
    );
  }

  const fmt = (n: number | null | undefined) => n != null ? `$${n.toLocaleString()}` : null;
  const pills: { label: string; value: string }[] = [];
  if (profile.preApprovalAmount) pills.push({ label: "Budget", value: fmt(profile.preApprovalAmount)! });
  if (profile.minBeds || profile.maxBeds) {
    const beds = profile.minBeds && profile.maxBeds
      ? `${profile.minBeds}–${profile.maxBeds}`
      : profile.minBeds ? `${profile.minBeds}+` : `Up to ${profile.maxBeds}`;
    pills.push({ label: "Beds", value: beds });
  }
  if (profile.minBaths) pills.push({ label: "Baths", value: `${profile.minBaths}+` });
  if (profile.minSqft || profile.maxSqft) {
    const sqft = profile.minSqft && profile.maxSqft
      ? `${profile.minSqft.toLocaleString()}–${profile.maxSqft.toLocaleString()}`
      : profile.minSqft ? `${profile.minSqft.toLocaleString()}+` : `Up to ${profile.maxSqft!.toLocaleString()}`;
    pills.push({ label: "Sqft", value: sqft });
  }
  if (profile.moveInTimeline) pills.push({ label: "Timeline", value: profile.moveInTimeline });

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Search className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Buyer Criteria</h3>
            <p className="text-sm text-muted-foreground" data-testid="text-buyer-display-name">{profile.displayName}</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 text-sm font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
          data-testid="button-edit-buyer-criteria"
        >
          <Edit2 className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4" data-testid="criteria-pills">
          {pills.map(p => (
            <span key={p.label} className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold" data-testid={`pill-${p.label.toLowerCase()}`}>
              {p.label}: {p.value}
            </span>
          ))}
        </div>
      )}

      {profile.preferredCities && profile.preferredCities.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2" data-testid="text-preferred-cities">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{profile.preferredCities.join(", ")}</span>
        </div>
      )}
      {profile.homeTypes && profile.homeTypes.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2" data-testid="text-home-types">
          <Home className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{profile.homeTypes.join(", ")}</span>
        </div>
      )}
      {profile.mustHaves && profile.mustHaves.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2" data-testid="text-must-haves">
          <Heart className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          <span>{profile.mustHaves.join(", ")}</span>
        </div>
      )}

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${profile.isPreApproved ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"}`} data-testid="status-pre-approval">
          {profile.isPreApproved ? "Pre-approved" : "Not yet pre-approved"}
        </span>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${profile.hasAgent ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400"}`} data-testid="status-has-agent">
          {profile.hasAgent ? "Has agent" : "Needs agent"}
        </span>
      </div>

      {showModal && <BuyerProfileModal onClose={() => setShowModal(false)} existingProfile={profile} />}
    </div>
  );
}

function AgentVerificationSection({ user }: { user: any }) {
  const [showForm, setShowForm] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState(user?.licenseNumber || "");
  const [licenseState, setLicenseState] = useState(user?.licenseState || "CA");
  const [association, setAssociation] = useState(user?.association || "");
  const [brokerageName, setBrokerageName] = useState(user?.brokerageName || "");
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const { mutate: verifyAgent, isPending } = useVerifyAgent();

  const handleVerify = () => {
    setVerifyResult(null);
    verifyAgent(
      { licenseNumber: licenseNumber.trim(), licenseState, association, brokerageName },
      {
        onSuccess: (data) => setVerifyResult(data),
        onError: () => setVerifyResult({ verified: false, error: "Verification request failed" }),
      }
    );
  };

  if (user?.agentVerified && user?.role === "agent") {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              Verified Agent
              <BadgeCheck className="w-4 h-4 text-green-600" />
            </h3>
            <p className="text-xs text-muted-foreground">Your license has been verified via MLS</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block text-xs font-bold mb-0.5">License #</span>
            <span className="text-foreground" data-testid="text-license-number">{user.licenseNumber}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs font-bold mb-0.5">State</span>
            <span className="text-foreground" data-testid="text-license-state">{user.licenseState || "—"}</span>
          </div>
          {user.brokerageName && (
            <div className="col-span-2">
              <span className="text-muted-foreground block text-xs font-bold mb-0.5">Brokerage</span>
              <span className="text-foreground" data-testid="text-brokerage">{user.brokerageName}</span>
            </div>
          )}
          {user.association && (
            <div className="col-span-2">
              <span className="text-muted-foreground block text-xs font-bold mb-0.5">Association</span>
              <span className="text-foreground" data-testid="text-association">{user.association}</span>
            </div>
          )}
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <Link href="/agent" className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors" data-testid="link-agent-dashboard">
            <Briefcase className="w-4 h-4" />
            Go to Agent Dashboard
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  if (user?.licenseNumber && !user?.agentVerified) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Agent Verification Pending</h3>
            <p className="text-xs text-muted-foreground">Your license could not be automatically verified</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground mb-4">
          <p>License #{user.licenseNumber} was submitted but could not be matched in the MLS database. You can try again or contact support.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-sm font-bold text-primary hover:text-primary/80 transition-colors"
          data-testid="button-retry-verification"
        >
          Try Again
        </button>
        {showForm && (
          <AgentForm
            licenseNumber={licenseNumber}
            setLicenseNumber={setLicenseNumber}
            licenseState={licenseState}
            setLicenseState={setLicenseState}
            association={association}
            setAssociation={setAssociation}
            brokerageName={brokerageName}
            setBrokerageName={setBrokerageName}
            onVerify={handleVerify}
            isPending={isPending}
            verifyResult={verifyResult}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">Are you a real estate agent?</h3>
          <p className="text-xs text-muted-foreground">Verify your license to unlock the Agent Dashboard</p>
        </div>
      </div>

      {!showForm ? (
        <div className="mt-4">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
            data-testid="button-become-agent"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify My License
          </button>
        </div>
      ) : (
        <AgentForm
          licenseNumber={licenseNumber}
          setLicenseNumber={setLicenseNumber}
          licenseState={licenseState}
          setLicenseState={setLicenseState}
          association={association}
          setAssociation={setAssociation}
          brokerageName={brokerageName}
          setBrokerageName={setBrokerageName}
          onVerify={handleVerify}
          isPending={isPending}
          verifyResult={verifyResult}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function AgentForm({
  licenseNumber, setLicenseNumber,
  licenseState, setLicenseState,
  association, setAssociation,
  brokerageName, setBrokerageName,
  onVerify, isPending, verifyResult, onCancel,
}: {
  licenseNumber: string; setLicenseNumber: (v: string) => void;
  licenseState: string; setLicenseState: (v: string) => void;
  association: string; setAssociation: (v: string) => void;
  brokerageName: string; setBrokerageName: (v: string) => void;
  onVerify: () => void; isPending: boolean; verifyResult: any; onCancel: () => void;
}) {
  const states = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="agent-license" className="block text-xs font-bold text-muted-foreground mb-1">
            License Number *
          </label>
          <input
            id="agent-license"
            value={licenseNumber}
            onChange={e => setLicenseNumber(e.target.value)}
            placeholder="e.g. 01234567"
            className="w-full bg-background border-2 border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
            data-testid="input-license-number"
          />
        </div>
        <div>
          <label htmlFor="agent-state" className="block text-xs font-bold text-muted-foreground mb-1">
            License State *
          </label>
          <select
            id="agent-state"
            value={licenseState}
            onChange={e => setLicenseState(e.target.value)}
            className="w-full bg-background border-2 border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
            data-testid="select-license-state"
          >
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="agent-association" className="block text-xs font-bold text-muted-foreground mb-1">
            Association / Board
          </label>
          <input
            id="agent-association"
            value={association}
            onChange={e => setAssociation(e.target.value)}
            placeholder="e.g. San Diego Association of Realtors"
            className="w-full bg-background border-2 border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
            data-testid="input-association"
          />
        </div>
        <div>
          <label htmlFor="agent-brokerage" className="block text-xs font-bold text-muted-foreground mb-1">
            Brokerage Name
          </label>
          <input
            id="agent-brokerage"
            value={brokerageName}
            onChange={e => setBrokerageName(e.target.value)}
            placeholder="e.g. Compass, Keller Williams"
            className="w-full bg-background border-2 border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
            data-testid="input-brokerage-name"
          />
        </div>
      </div>

      {verifyResult && (
        <div className={`rounded-lg p-3 text-sm ${verifyResult.verified ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"}`}>
          {verifyResult.verified ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-700 dark:text-green-400">License Verified!</p>
                {verifyResult.mlsInfo?.memberName && (
                  <p className="text-green-600 dark:text-green-500 text-xs mt-1">
                    Matched: {verifyResult.mlsInfo.memberName}
                    {verifyResult.mlsInfo.officeName && ` — ${verifyResult.mlsInfo.officeName}`}
                  </p>
                )}
                <p className="text-green-600 dark:text-green-500 text-xs mt-1">
                  Your role has been upgraded to Agent. You can now access the Agent Dashboard.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-amber-700 dark:text-amber-400">Could not verify</p>
                <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                  {verifyResult.error || "Your license was not found in the MLS database. Your information has been saved and our team will review it."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onVerify}
          disabled={isPending || !licenseNumber.trim()}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          data-testid="button-verify-license"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {isPending ? "Verifying..." : "Verify with MLS"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
          data-testid="button-cancel-agent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FavoriteCount() {
  const { data } = useSavedProperties();
  return <span>{data?.length ?? "—"}</span>;
}
function SavedSearchCount() {
  const { data } = useSavedSearches();
  return <span>{data?.length ?? "—"}</span>;
}
function MyHomeCount() {
  const { data } = useMyHomes();
  return <span>{data?.length ?? "—"}</span>;
}

// ── My Home Section ────────────────────────────────────────────────────────────

function MyHomeSection() {
  const { data: homes = [], isLoading } = useMyHomes();
  const { mutate: createHome, isPending: isCreating } = useCreateMyHome();
  const { mutate: deleteHome } = useDeleteMyHome();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);

  const selectedHome = homes.find(h => h.id === selectedHomeId) || null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Home"
        subtitle="Track your own home and explore its public records, zoning, and neighborhood data"
        action={!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors" data-testid="button-add-home">
            <Plus className="w-4 h-4" /> Add Home
          </button>
        ) : undefined}
      />

      {showAdd && (
        <AddHomeForm
          onSubmit={(data) => createHome(data, { onSuccess: () => { setShowAdd(false); } })}
          onCancel={() => setShowAdd(false)}
          isPending={isCreating}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4" data-testid="skeleton-my-homes">
          {[1, 2].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
              <div className="flex gap-4">
                <div className="w-32 flex-shrink-0 bg-muted h-28" />
                <div className="flex-1 p-4 space-y-3">
                  <div className="h-5 bg-muted rounded-md w-40" />
                  <div className="h-4 bg-muted rounded-md w-64" />
                  <div className="h-3 bg-muted rounded-md w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : homes.length === 0 && !showAdd ? (
        <EmptyState icon={Home} title="No homes tracked yet" description="Add your home address to get detailed neighborhood intelligence, zoning info, flood data, and more.">
          <button onClick={() => setShowAdd(true)} className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold hover:bg-primary hover:text-white transition-colors">
            Add My Home
          </button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {homes.map(home => (
            <div key={home.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                {/* Street View thumbnail */}
                <div className="w-32 flex-shrink-0 bg-muted relative overflow-hidden">
                  {home.imageUrl ? (
                    <img src={home.imageUrl} alt={home.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{home.nickname}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {[home.addressStreetNumber, home.addressStreetName, home.addressCity, home.addressState, home.addressZip].filter(Boolean).join(" ")}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => setSelectedHomeId(selectedHomeId === home.id ? null : home.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary hover:text-white transition-colors"
                        data-testid={`button-view-intelligence-${home.id}`}
                      >
                        <Activity className="w-3.5 h-3.5" />
                        {selectedHomeId === home.id ? "Hide" : "Intelligence"}
                      </button>
                      <button onClick={() => deleteHome(home.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" data-testid={`button-delete-home-${home.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {home.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{home.notes}"</p>}
                </div>
              </div>

              {/* Intelligence Panel */}
              {selectedHomeId === home.id && (
                <HomeIntelligencePanel homeId={home.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddHomeForm({ onSubmit, onCancel, isPending }: { onSubmit: (d: any) => void; onCancel: () => void; isPending: boolean }) {
  const { isLoaded } = useGoogleMaps();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [form, setForm] = useState({
    nickname: "", addressStreetNumber: "", addressStreetName: "", addressUnitNumber: "",
    addressCity: "", addressState: "", addressZip: "", notes: "",
  });

  const onPlaceChanged = () => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place.address_components) return;
    let sn = "", st = "", city = "", state = "", zip = "";
    for (const c of place.address_components) {
      if (c.types.includes("street_number")) sn = c.long_name;
      if (c.types.includes("route")) st = c.long_name;
      if (c.types.includes("locality")) city = c.long_name;
      if (c.types.includes("administrative_area_level_1")) state = c.short_name;
      if (c.types.includes("postal_code")) zip = c.long_name;
    }
    setForm(prev => ({
      ...prev,
      addressStreetNumber: sn, addressStreetName: st,
      addressCity: city, addressState: state, addressZip: zip,
      nickname: prev.nickname || `${sn} ${st}`.trim(),
    }));
  };

  return (
    <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 shadow-sm space-y-4">
      <h3 className="font-bold text-foreground text-lg flex items-center gap-2"><Home className="w-5 h-5 text-primary" /> Add Your Home</h3>

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1">Search Address</label>
        {isLoaded ? (
          <Autocomplete
            onLoad={ac => { autocompleteRef.current = ac; }}
            onPlaceChanged={onPlaceChanged}
            options={{ componentRestrictions: { country: "us" }, types: ["address"], fields: ["address_components", "geometry"] }}
          >
            <input className="w-full bg-background border-2 border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none" placeholder="Start typing your address..." data-testid="input-home-address" />
          </Autocomplete>
        ) : (
          <input className="w-full bg-muted border-2 border-border rounded-xl px-4 py-2.5 text-sm" disabled placeholder="Loading..." />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="home-nickname" className="block text-xs font-bold text-muted-foreground mb-1">Nickname</label>
          <input id="home-nickname" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none" placeholder="e.g. My House" data-testid="input-home-nickname" />
        </div>
        <div>
          <label htmlFor="home-city" className="block text-xs font-bold text-muted-foreground mb-1">City</label>
          <input id="home-city" value={form.addressCity} onChange={e => setForm({ ...form, addressCity: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none" placeholder="City" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1">Notes (optional)</label>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none resize-none" placeholder="Anything you want to remember about this property..." />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onSubmit(form)}
          disabled={isPending || !form.nickname}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          data-testid="button-submit-home"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Home
        </button>
        <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function HomeIntelligencePanel({ homeId }: { homeId: number }) {
  const { data, isLoading, isError } = useMyHomeIntelligence(homeId);

  if (isLoading) {
    return (
      <div className="border-t border-border bg-muted/30 p-6 space-y-6" data-testid="skeleton-home-intelligence">
        <div className="h-4 bg-muted animate-pulse rounded-md w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-muted rounded-lg" />
                <div className="h-4 bg-muted rounded-md w-24" />
              </div>
              <div className="h-6 bg-muted rounded-md w-16 mb-1" />
              <div className="h-3 bg-muted rounded-md w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="border-t border-border p-6 text-sm text-muted-foreground">Could not load intelligence data for this address.</div>
    );
  }

  const pr = data.publicRecords;
  const zoning = data.zoning;

  return (
    <div className="border-t border-border bg-muted/30 p-6 space-y-6">
      <h4 className="font-bold text-foreground text-sm uppercase tracking-widest text-muted-foreground">Property Intelligence</h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Flood Risk */}
        {pr?.flood && (
          <IntelligenceCard icon={Droplets} color="text-blue-500" title="Flood Zone" value={pr.flood.zone || "Unknown"} sub={pr.flood.isHighRisk ? "High risk zone" : "Low/minimal risk"} />
        )}
        {/* Elevation */}
        {zoning?.elevation !== null && zoning?.elevation !== undefined && (
          <IntelligenceCard icon={Activity} color="text-emerald-500" title="Elevation" value={`${Math.round(zoning.elevation)} ft`} sub="Above sea level" />
        )}
        {/* Land Use */}
        {zoning?.landUse && (
          <IntelligenceCard
            icon={MapPin}
            color="text-purple-500"
            title="Land Use"
            value={typeof zoning.landUse === 'object' ? (zoning.landUse as any)?.label || (zoning.landUse as any)?.primaryType || "Mixed" : String(zoning.landUse)}
            sub="Zoning classification"
          />
        )}
        {/* Schools */}
        {pr?.nearby?.schools?.length > 0 && (
          <IntelligenceCard icon={School} color="text-yellow-500" title="Nearby Schools" value={pr.nearby.schools.length.toString()} sub={pr.nearby.schools[0]?.name || "Within walking distance"} />
        )}
        {/* Parks */}
        {pr?.nearby?.parks?.length > 0 && (
          <IntelligenceCard icon={TreeDeciduous} color="text-green-500" title="Parks Nearby" value={pr.nearby.parks.length.toString()} sub={pr.nearby.parks[0]?.name || "In the area"} />
        )}
        {/* Groceries */}
        {pr?.nearby?.groceries?.length > 0 && (
          <IntelligenceCard icon={ShoppingCart} color="text-orange-500" title="Grocery Stores" value={pr.nearby.groceries.length.toString()} sub={pr.nearby.groceries[0]?.name || "Nearby"} />
        )}
        {/* Historic */}
        {zoning?.historicDesignations?.length > 0 && (
          <IntelligenceCard icon={Building} color="text-amber-500" title="Historic Designation" value={zoning.historicDesignations[0]} sub="Heritage protected" />
        )}
        {/* Active Construction */}
        {zoning?.activeConstruction?.length > 0 && (
          <IntelligenceCard icon={Flame} color="text-red-500" title="Nearby Construction" value={`${zoning.activeConstruction.length} site${zoning.activeConstruction.length > 1 ? "s" : ""}`} sub="Within 500m" />
        )}
      </div>

      {/* Demographic summary */}
      {pr?.neighborhood?.population && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h5 className="font-bold text-sm text-foreground mb-3">Neighborhood Demographics</h5>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {pr.neighborhood.population && <DemoStat label="Population" value={Number(pr.neighborhood.population).toLocaleString()} />}
            {pr.neighborhood.medianIncome && <DemoStat label="Median Income" value={`$${Number(pr.neighborhood.medianIncome).toLocaleString()}`} />}
            {pr.neighborhood.medianAge && <DemoStat label="Median Age" value={String(pr.neighborhood.medianAge)} />}
            {pr.neighborhood.medianHomeValue && <DemoStat label="Median Home Value" value={`$${Number(pr.neighborhood.medianHomeValue).toLocaleString()}`} />}
          </div>
        </div>
      )}

      {/* ZAPP link */}
      {zoning?.zappLink && (
        <a href={zoning.zappLink} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary font-bold hover:underline"
        >
          <ExternalLink className="w-4 h-4" /> View full zoning details on city portal
        </a>
      )}
    </div>
  );
}

function IntelligenceCard({ icon: Icon, color, title, value, sub }: { icon: any; color: string; title: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="font-bold text-foreground text-sm mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sub}</p>}
      </div>
    </div>
  );
}

function DemoStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-bold text-foreground">{value}</p>
    </div>
  );
}

// ── My Agent Section ───────────────────────────────────────────────────────────

function MyAgentSection() {
  const { data: link, isLoading } = useAgentInvite();
  const { mutate: inviteAgent, isPending: isInviting } = useInviteAgent();
  const { mutate: removeLink, isPending: isRemoving } = useRemoveAgentInvite();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleInvite = () => {
    setError("");
    if (!email || !email.includes("@")) { setError("Please enter a valid email address."); return; }
    inviteAgent(email, { onSuccess: () => setEmail("") });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Agent"
        subtitle="Invite your agent to view your favorites and saved searches"
      />

      {isLoading ? (
        <div className="bg-card border border-border rounded-2xl p-6 animate-pulse" data-testid="skeleton-my-agent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-muted rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-muted rounded-md w-48" />
              <div className="h-4 bg-muted rounded-md w-72" />
            </div>
          </div>
        </div>
      ) : link ? (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
              link.status === "active" ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
            }`}>
              {link.status === "active" ? <CheckCircle2 className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground">{link.agentEmail}</p>
              {link.status === "active" ? (
                <p className="text-sm text-green-600 font-medium flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Agent connected — they can see your favorites and saved searches
                </p>
              ) : (
                <p className="text-sm text-amber-600 font-medium flex items-center gap-1.5 mt-0.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Invitation sent — waiting for agent to create an account
                </p>
              )}
            </div>
            <button
              onClick={() => removeLink()}
              disabled={isRemoving}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              data-testid="button-remove-agent"
              title="Remove agent"
            >
              {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
            <p className="font-bold text-foreground mb-1">What your agent can see:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All your favorited homes</li>
              <li>Your saved searches and filter criteria</li>
              <li>Upcoming open houses for your favorites</li>
            </ul>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-bold text-foreground mb-2">Change agent</p>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="New agent email..."
                className="flex-1 bg-background border-2 border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none"
                data-testid="input-agent-email"
              />
              <button
                onClick={handleInvite}
                disabled={isInviting}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                data-testid="button-invite-agent"
              >
                {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Update
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">Connect with your agent</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your agent's email address and they'll be able to see your saved homes and searches — making it easy to collaborate on your home search.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted-foreground">Agent's Email Address</label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleInvite()}
                placeholder="agent@example.com"
                type="email"
                className="flex-1 bg-background border-2 border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none"
                data-testid="input-agent-email"
              />
              <button
                onClick={handleInvite}
                disabled={isInviting}
                className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                data-testid="button-invite-agent"
              >
                {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Invite Agent
              </button>
            </div>
            {error && <p className="text-xs text-destructive font-medium">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Open Houses Section ────────────────────────────────────────────────────────

function OpenHousesSection() {
  const { data: openHouses = [], isLoading } = useOpenHouses();

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Open Houses"
        subtitle="Select open houses to plan your visiting route"
      />
      <OpenHouseRoutePlanner openHouses={openHouses} isLoading={isLoading} variant="buyer" />
    </div>
  );
}

// ── Favorites Section ──────────────────────────────────────────────────────────

function FavoritesSection() {
  const { data: savedProps = [], isLoading } = useSavedProperties();
  const { data: lists = [], isLoading: listsLoading } = useFavoriteLists();
  const { mutate: createList, isPending: isCreating } = useCreateFavoriteList();
  const { mutate: renameList } = useRenameFavoriteList();
  const { mutate: deleteList } = useDeleteFavoriteList();
  const { mutate: moveProperty } = useMovePropertyToList();

  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [moveMenuPropertyId, setMoveMenuPropertyId] = useState<number | null>(null);

  const handleCreateList = () => {
    if (newListName.trim()) {
      createList(newListName.trim());
      setNewListName("");
      setShowNewListInput(false);
    }
  };

  const handleRename = (id: number) => {
    if (editingName.trim()) {
      renameList({ id, name: editingName.trim() });
      setEditingListId(null);
      setEditingName("");
    }
  };

  const filteredProps = activeListId === null
    ? savedProps
    : savedProps.filter(sp => sp.listId === activeListId);

  const listCounts = lists.reduce<Record<number, number>>((acc, list) => {
    acc[list.id] = savedProps.filter(sp => sp.listId === list.id).length;
    return acc;
  }, {});
  const unlistedCount = savedProps.filter(sp => !sp.listId).length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Favorites" subtitle="Homes you've saved while browsing" />

      <div className="flex items-center gap-2 flex-wrap" data-testid="favorite-list-tabs">
        <button
          onClick={() => setActiveListId(null)}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            activeListId === null
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          data-testid="tab-all-favorites"
        >
          <Heart className="w-3.5 h-3.5" />
          All ({savedProps.length})
        </button>

        {lists.map(list => (
          <div key={list.id} className="relative group">
            {editingListId === list.id ? (
              <div className="flex items-center gap-1.5 bg-card border border-border rounded-full px-2 py-1">
                <input
                  className="text-sm bg-transparent outline-none w-24 px-1"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleRename(list.id);
                    if (e.key === "Escape") setEditingListId(null);
                  }}
                  autoFocus
                  data-testid={`input-rename-list-${list.id}`}
                />
                <button onClick={() => handleRename(list.id)} className="p-0.5 text-green-600 hover:text-green-700">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingListId(null)} className="p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveListId(list.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  activeListId === list.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`tab-list-${list.id}`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {list.name} ({listCounts[list.id] || 0})
              </button>
            )}

            {activeListId === list.id && editingListId !== list.id && (
              <div className="absolute -top-1 -right-1 flex gap-0.5 z-10">
                <button
                  onClick={e => { e.stopPropagation(); setEditingListId(list.id); setEditingName(list.name); }}
                  className="w-5 h-5 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm"
                  title="Rename"
                  data-testid={`button-rename-list-${list.id}`}
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteList(list.id); setActiveListId(null); }}
                  className="w-5 h-5 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive shadow-sm"
                  title="Delete list"
                  data-testid={`button-delete-list-${list.id}`}
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {showNewListInput ? (
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-1.5">
            <input
              className="text-sm bg-transparent outline-none w-28 placeholder-muted-foreground"
              placeholder="List name..."
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleCreateList();
                if (e.key === "Escape") { setShowNewListInput(false); setNewListName(""); }
              }}
              autoFocus
              data-testid="input-new-list-name"
            />
            <button
              onClick={handleCreateList}
              disabled={!newListName.trim() || isCreating}
              className="p-0.5 text-green-600 hover:text-green-700 disabled:opacity-40"
              data-testid="button-confirm-new-list"
            >
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setShowNewListInput(false); setNewListName(""); }} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewListInput(true)}
            className="px-3 py-2 rounded-full text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors flex items-center gap-1.5"
            data-testid="button-create-list"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New List
          </button>
        )}
      </div>

      {(isLoading || listsLoading) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" data-testid="skeleton-favorites">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-muted" />
              <div className="p-4 space-y-3">
                <div className="h-6 bg-muted rounded-md w-32" />
                <div className="h-4 bg-muted rounded-md w-full" />
                <div className="flex items-center gap-3">
                  <div className="h-4 bg-muted rounded-md w-16" />
                  <div className="h-4 bg-muted rounded-md w-16" />
                  <div className="h-4 bg-muted rounded-md w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredProps.length === 0 ? (
        <EmptyState
          icon={activeListId ? FolderOpen : Heart}
          title={activeListId ? "This list is empty" : "No favorites yet"}
          description={activeListId ? "Move properties here from your All Favorites view." : "Click the heart icon on any property card while browsing to save it here."}
        >
          <Link href="/search" className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold hover:bg-primary hover:text-white transition-colors">
            Start Browsing
          </Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {filteredProps.map(({ property, ...saved }) => (
            <div key={property.id} className="relative group/card">
              <PropertyCard property={property} />
              {lists.length > 0 && (
                <div className="absolute top-3 left-3 z-20">
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setMoveMenuPropertyId(moveMenuPropertyId === property.id ? null : property.id); }}
                    className="w-8 h-8 bg-black/40 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors sm:opacity-0 sm:group-hover/card:opacity-100"
                    title="Move to list"
                    data-testid={`button-move-property-${property.id}`}
                  >
                    <List className="w-4 h-4" />
                  </button>

                  {moveMenuPropertyId === property.id && (
                    <div className="absolute top-10 left-0 bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[160px] z-30" data-testid={`menu-move-property-${property.id}`}>
                      <button
                        onClick={() => { moveProperty({ propertyId: property.id, listId: null }); setMoveMenuPropertyId(null); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${!saved.listId ? "text-primary font-semibold" : "text-foreground"}`}
                        data-testid="menu-item-all-favorites"
                      >
                        <Heart className="w-3.5 h-3.5" />
                        All Favorites
                        {!saved.listId && <Check className="w-3.5 h-3.5 ml-auto" />}
                      </button>
                      {lists.map(list => (
                        <button
                          key={list.id}
                          onClick={() => { moveProperty({ propertyId: property.id, listId: list.id }); setMoveMenuPropertyId(null); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${saved.listId === list.id ? "text-primary font-semibold" : "text-foreground"}`}
                          data-testid={`menu-item-list-${list.id}`}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          {list.name}
                          {saved.listId === list.id && <Check className="w-3.5 h-3.5 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredProps.length > 0 && <SdmlsDisclaimer />}
    </div>
  );
}

// ── Saved Searches Section ─────────────────────────────────────────────────────

function SavedSearchesSection() {
  const { data: savedSearches = [], isLoading } = useSavedSearches();
  const { mutate: deleteSearch } = useDeleteSavedSearch();
  const { mutate: renameSearch } = useRenameSavedSearch();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleRename = (id: number) => {
    if (editingName.trim()) {
      renameSearch({ id, name: editingName.trim() });
      setEditingId(null);
      setEditingName("");
    }
  };

  const criteriaLabel = (key: string): string => {
    const map: Record<string, string> = {
      location: "Location", minPrice: "Min Price", maxPrice: "Max Price",
      minBeds: "Min Beds", minBaths: "Min Baths", minSqft: "Min Sqft", maxHoaFee: "Max HOA",
    };
    return map[key] || key;
  };

  const formatValue = (key: string, val: any): string => {
    if (key.includes("Price") || key.includes("Hoa")) return `$${Number(val).toLocaleString()}`;
    return String(val);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Saved Searches" subtitle="Jump back into a search with your saved filters" />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="skeleton-saved-searches">
          {[1, 2].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
              <div className="h-5 bg-muted rounded-md w-36 mb-3" />
              <div className="flex flex-wrap gap-1.5 mb-4">
                <div className="h-5 bg-muted rounded-md w-24" />
                <div className="h-5 bg-muted rounded-md w-20" />
                <div className="h-5 bg-muted rounded-md w-16" />
              </div>
              <div className="h-4 bg-muted rounded-md w-28" />
            </div>
          ))}
        </div>
      ) : savedSearches.length === 0 ? (
        <EmptyState icon={BookmarkCheck} title="No saved searches" description='Use the "Save Search" button while browsing to bookmark your search filters here.'>
          <Link href="/search" className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold hover:bg-primary hover:text-white transition-colors">
            Go to Search
          </Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {savedSearches.map(search => (
            <div key={search.id} className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow" data-testid={`card-saved-search-${search.id}`}>
              <div className="flex items-start justify-between mb-3">
                {editingId === search.id ? (
                  <div className="flex items-center gap-1.5 flex-1 mr-2">
                    <input
                      className="text-sm font-bold bg-transparent border-b-2 border-primary outline-none flex-1 py-0.5 text-foreground"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleRename(search.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      data-testid={`input-rename-search-${search.id}`}
                    />
                    <button onClick={() => handleRename(search.id)} className="p-1 text-green-600 hover:text-green-700">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <h3
                    className="font-bold text-foreground cursor-pointer hover:text-primary transition-colors group flex items-center gap-1.5"
                    onClick={() => { setEditingId(search.id); setEditingName(search.name); }}
                    title="Click to rename"
                    data-testid={`text-search-name-${search.id}`}
                  >
                    {search.name}
                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </h3>
                )}
                <button onClick={() => deleteSearch(search.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {Object.entries(search.criteria as any).map(([k, v]) => (
                  <span key={k} className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-md">
                    {criteriaLabel(k)}: {formatValue(k, v)}
                  </span>
                ))}
              </div>
              <Link
                href={`/search?${new URLSearchParams(search.criteria as Record<string, string>).toString()}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary font-bold hover:underline"
              >
                View Results <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Incoming Offers Section ────────────────────────────────────────────────────

interface IncomingOffer {
  id: number;
  propertyId: number;
  offerPrice: number;
  escrowLengthDays: number;
  inspectionContingencyDays: number;
  loanContingencyDays: number;
  appraisalContingencyDays: number;
  insuranceContingencyDays: number;
  disclosureReviewDays: number;
  leasedLienedItemsDays: number;
  sellerConcessions: number;
  sellerConcessionNotes: string | null;
  buydownOffered: boolean;
  buydownType: string | null;
  buydownAmount: number | null;
  additionalTerms: string | null;
  status: string;
  createdAt: string;
  property: {
    id: number;
    title: string;
    price: number;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    imageUrl: string | null;
    location: string | null;
  };
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function offerStatusLabel(status: string): string {
  const map: Record<string, string> = {
    sent_to_buyer: "New",
    viewed: "Viewed",
    accepted: "Accepted",
    rejected: "Declined",
  };
  return map[status] || status;
}

function offerStatusColor(status: string): string {
  const map: Record<string, string> = {
    sent_to_buyer: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
    viewed: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
    accepted: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400",
    rejected: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400",
  };
  return map[status] || "bg-muted text-muted-foreground";
}

function IncomingOffersSection() {
  const { data: offers = [], isLoading } = useQuery<IncomingOffer[]>({
    queryKey: ["/api/property-offers/incoming"],
  });

  const { data: buyerProfile } = useQuery<BuyerProfile | null>({
    queryKey: ["/api/buyer-profiles/mine"],
    queryFn: async () => {
      const res = await fetch("/api/buyer-profiles/mine");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  const { mutate: updateStatus, isPending: isUpdating } = useMutation({
    mutationFn: async ({ offerId, status }: { offerId: number; status: string }) => {
      await apiRequest("PATCH", `/api/property-offers/${offerId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/property-offers/incoming"] });
    },
  });

  const needsReferral = buyerProfile?.needsAgentReferral === true || !buyerProfile?.hasAgent;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Incoming Offers"
        subtitle="Reverse offers from listing agents on properties you've liked"
      />

      {needsReferral && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6" data-testid="cta-agent-referral">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-lg" data-testid="text-referral-title">Get represented by xucasa to negotiate this offer</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Having an agent ensures you get the best terms and protections on any offer. Set up your buyer profile to get matched with a xucasa agent.
              </p>
              <Link
                href="/buyers"
                className="inline-flex items-center gap-2 mt-3 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
                data-testid="link-setup-buyer-profile"
              >
                <UserPlus className="w-4 h-4" />
                Set Up Buyer Profile
              </Link>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4" data-testid="skeleton-incoming-offers">
          {[1, 2].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
              <div className="flex flex-col sm:flex-row">
                <div className="sm:w-48 h-40 sm:h-auto bg-muted flex-shrink-0" />
                <div className="flex-1 p-5 space-y-3">
                  <div className="h-5 bg-muted rounded-md w-48" />
                  <div className="h-4 bg-muted rounded-md w-32" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-4 bg-muted rounded-md" />
                    <div className="h-4 bg-muted rounded-md" />
                    <div className="h-4 bg-muted rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : offers.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No offers yet"
          description="Swipe right on properties you like to attract seller interest!"
        >
          <Link
            href="/swipe"
            className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold hover:bg-primary hover:text-white transition-colors"
            data-testid="link-go-swipe"
          >
            Start Swiping
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-4" data-testid="offers-list">
          {offers.map(offer => (
            <div
              key={offer.id}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
              data-testid={`card-offer-${offer.id}`}
            >
              <div className="flex flex-col sm:flex-row">
                <div className="sm:w-48 h-40 sm:h-auto bg-muted flex-shrink-0 relative">
                  {offer.property.imageUrl ? (
                    <img
                      src={offer.property.imageUrl}
                      alt={offer.property.title}
                      className="w-full h-full object-cover"
                      data-testid={`img-offer-property-${offer.id}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <span
                    className={`absolute top-3 left-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${offerStatusColor(offer.status)}`}
                    data-testid={`badge-offer-status-${offer.id}`}
                  >
                    {offerStatusLabel(offer.status)}
                  </span>
                </div>

                <div className="flex-1 p-5 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <h3 className="font-bold text-foreground text-lg" data-testid={`text-offer-title-${offer.id}`}>
                        {offer.property.title}
                      </h3>
                      {offer.property.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5" data-testid={`text-offer-location-${offer.id}`}>
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          {offer.property.location}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-primary" data-testid={`text-offer-price-${offer.id}`}>
                        {formatCurrency(offer.offerPrice)}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-list-price-${offer.id}`}>
                        List: {formatCurrency(offer.property.price)}
                      </p>
                    </div>
                  </div>

                  {(offer.property.beds || offer.property.baths || offer.property.sqft) && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3" data-testid={`text-offer-specs-${offer.id}`}>
                      {offer.property.beds != null && <span>{offer.property.beds} beds</span>}
                      {offer.property.baths != null && <span>{offer.property.baths} baths</span>}
                      {offer.property.sqft != null && <span>{offer.property.sqft.toLocaleString()} sqft</span>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm border-t border-border pt-3 mb-3" data-testid={`grid-offer-terms-${offer.id}`}>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold block">Escrow</span>
                      <span className="text-foreground" data-testid={`text-escrow-${offer.id}`}>{offer.escrowLengthDays} days</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold block">Inspection</span>
                      <span className="text-foreground" data-testid={`text-inspection-${offer.id}`}>{offer.inspectionContingencyDays} days</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold block">Loan</span>
                      <span className="text-foreground" data-testid={`text-loan-${offer.id}`}>{offer.loanContingencyDays} days</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold block">Appraisal</span>
                      <span className="text-foreground" data-testid={`text-appraisal-${offer.id}`}>{offer.appraisalContingencyDays} days</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold block">Insurance</span>
                      <span className="text-foreground" data-testid={`text-insurance-${offer.id}`}>{offer.insuranceContingencyDays} days</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold block">Disclosure Review</span>
                      <span className="text-foreground" data-testid={`text-disclosure-${offer.id}`}>{offer.disclosureReviewDays} days</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold block">Leased/Liened Items</span>
                      <span className="text-foreground" data-testid={`text-leased-liened-${offer.id}`}>{offer.leasedLienedItemsDays} days</span>
                    </div>
                    {offer.sellerConcessions > 0 && (
                      <div>
                        <span className="text-muted-foreground text-xs font-bold block">Concessions</span>
                        <span className="text-foreground" data-testid={`text-concessions-${offer.id}`}>{formatCurrency(offer.sellerConcessions)}</span>
                      </div>
                    )}
                    {offer.buydownOffered && (
                      <div>
                        <span className="text-muted-foreground text-xs font-bold block">Buydown</span>
                        <span className="text-foreground" data-testid={`text-buydown-${offer.id}`}>
                          {offer.buydownType || "Yes"}{offer.buydownAmount ? ` — ${formatCurrency(offer.buydownAmount)}` : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {offer.sellerConcessionNotes && (
                    <p className="text-xs text-muted-foreground mb-2" data-testid={`text-concession-notes-${offer.id}`}>
                      <span className="font-bold">Concession notes:</span> {offer.sellerConcessionNotes}
                    </p>
                  )}

                  {offer.additionalTerms && (
                    <p className="text-xs text-muted-foreground mb-3" data-testid={`text-additional-terms-${offer.id}`}>
                      <span className="font-bold">Additional terms:</span> {offer.additionalTerms}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                    {(offer.status === "sent_to_buyer" || offer.status === "viewed") && (
                      <>
                        <button
                          onClick={() => updateStatus({ offerId: offer.id, status: "accepted" })}
                          disabled={isUpdating}
                          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                          data-testid={`button-accept-offer-${offer.id}`}
                        >
                          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                          Interested
                        </button>
                        <button
                          onClick={() => updateStatus({ offerId: offer.id, status: "rejected" })}
                          disabled={isUpdating}
                          className="flex items-center gap-2 bg-muted text-muted-foreground px-4 py-2 rounded-xl text-sm font-bold hover:bg-muted/80 transition-colors disabled:opacity-50"
                          data-testid={`button-reject-offer-${offer.id}`}
                        >
                          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                          Not Interested
                        </button>
                      </>
                    )}
                    <Link
                      href={`/property/${offer.propertyId}`}
                      className="flex items-center gap-2 text-sm font-bold text-primary hover:bg-primary/10 px-4 py-2 rounded-xl transition-colors"
                      data-testid={`link-view-property-${offer.id}`}
                    >
                      <Eye className="w-4 h-4" />
                      View Property
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Search History Section ─────────────────────────────────────────────────────

function SearchHistorySection() {
  const { data: history = [], isLoading } = useSearchHistory();
  const { mutate: deleteEntry } = useDeleteSearchHistory();
  const { mutate: clearAll, isPending: isClearing } = useClearSearchHistory();

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Search History"
        subtitle="Your recent property searches (up to 50)"
        action={history.length > 0 ? (
          <button
            onClick={() => clearAll()}
            disabled={isClearing}
            className="flex items-center gap-1.5 text-sm font-bold text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors"
            data-testid="button-clear-history"
          >
            {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Clear All
          </button>
        ) : undefined}
      />

      {isLoading ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border" data-testid="skeleton-search-history">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
              <div className="w-4 h-4 bg-muted rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-muted rounded-md w-48" />
                <div className="h-3 bg-muted rounded-md w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <EmptyState icon={Clock} title="No search history" description="Your searches will appear here. Log in before searching to track your history.">
          <Link href="/search" className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold hover:bg-primary hover:text-white transition-colors">
            Start Searching
          </Link>
        </EmptyState>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
          {history.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group" data-testid={`row-history-${entry.id}`}>
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{entry.query}</p>
                <p className="text-xs text-muted-foreground">{entry.createdAt ? formatDate(String(entry.createdAt)) : ""}</p>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/search?location=${encodeURIComponent(entry.query)}`}
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  title="Search again"
                >
                  <Search className="w-4 h-4" />
                </Link>
                <button onClick={() => deleteEntry(entry.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared UI helpers ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 pb-2 border-b border-border">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: React.ReactNode; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, children }: { icon: any; title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-16 bg-card border border-border rounded-3xl shadow-sm px-6">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-muted-foreground opacity-40" />
      </div>
      <h3 className="font-display font-bold text-xl mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto text-sm">{description}</p>
      {children}
    </div>
  );
}

const notifTypeIcons: Record<string, typeof Home> = {
  new_listing: Home, price_drop: TrendingDown, agent_match: UserPlus,
  open_house: CalendarDays, system: Info,
};
const notifTypeColors: Record<string, string> = {
  new_listing: "bg-green-100 text-green-600", price_drop: "bg-orange-100 text-orange-600",
  agent_match: "bg-blue-100 text-blue-600", open_house: "bg-purple-100 text-purple-600",
  system: "bg-gray-100 text-gray-600",
};
const notifTypeLabels: Record<string, string> = {
  new_listing: "New Listing", price_drop: "Price Drop", agent_match: "Agent Match",
  open_house: "Open House", system: "System",
};

function NotificationsSection() {
  const [filter, setFilter] = useState<"all" | "unread" | "archived">("all");
  const [prefsOpen, setPrefsOpen] = useState(false);

  const queryParams = filter === "unread" ? "?unread=true" : filter === "archived" ? "?archived=true" : "";
  const { data: notifs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/notifications", filter],
    queryFn: async () => {
      const res = await fetch(`/api/notifications${queryParams}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/notifications/${id}`, { read: true }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => { await apiRequest("PATCH", "/api/notifications/mark-all-read", {}); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/notifications/${id}`, { archived: true }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/notifications/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const generateTestMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/notifications/test", {}); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = countData?.count || 0;

  function timeSince(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="space-y-6" data-testid="section-notifications">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
            {unreadCount > 0 && (
              <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{unreadCount} unread</span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              data-testid="button-mark-all-read-dashboard"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
          <button
            onClick={() => setPrefsOpen(!prefsOpen)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            data-testid="button-notification-preferences"
          >
            <Settings className="w-4 h-4" />
            Preferences
          </button>
        </div>
      </div>

      <div className="flex gap-2" data-testid="notification-filters">
        {(["all", "unread", "archived"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            data-testid={`button-filter-${f}`}
          >
            {f === "all" ? "All" : f === "unread" ? "Unread" : "Archived"}
          </button>
        ))}
      </div>

      {prefsOpen && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4" data-testid="section-notification-preferences">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Notification Preferences
            </h3>
            <button onClick={() => setPrefsOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Receive daily email digests of new matches</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">Coming Soon</div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Get instant alerts on your device</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">Coming Soon</div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div>
                <p className="text-sm font-medium">New Listing Alerts</p>
                <p className="text-xs text-muted-foreground">Notify when properties match your saved searches</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">Coming Soon</div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Price Drop Alerts</p>
                <p className="text-xs text-muted-foreground">Notify when saved properties reduce their price</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">Coming Soon</div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-48" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !notifs || notifs.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-1">
            {filter === "archived" ? "No archived notifications" : filter === "unread" ? "All caught up!" : "No notifications yet"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            {filter === "all" ? "When you receive notifications about new listings, price drops, or agent updates, they'll appear here." : filter === "unread" ? "You've read all your notifications." : "Archived notifications will appear here."}
          </p>
          {filter === "all" && (
            <button
              onClick={() => generateTestMutation.mutate()}
              disabled={generateTestMutation.isPending}
              className="text-sm px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium"
              data-testid="button-generate-test-notifications"
            >
              {generateTestMutation.isPending ? "Generating..." : "Generate sample notifications"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n: any) => {
            const Icon = notifTypeIcons[n.type] || Info;
            const colorClass = notifTypeColors[n.type] || "bg-gray-100 text-gray-600";
            const typeLabel = notifTypeLabels[n.type] || n.type;
            return (
              <div
                key={n.id}
                className={`bg-card border border-border rounded-xl p-4 transition-all hover:shadow-sm ${!n.read ? "border-l-4 border-l-primary" : ""}`}
                data-testid={`notification-dashboard-${n.id}`}
              >
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colorClass}`}>{typeLabel}</span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <p className={`text-sm ${!n.read ? "font-semibold" : ""}`}>{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{timeSince(n.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {!n.read && (
                        <button
                          onClick={() => markReadMutation.mutate(n.id)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground flex items-center gap-1"
                          data-testid={`button-read-dashboard-${n.id}`}
                        >
                          <Check className="w-3 h-3" /> Mark read
                        </button>
                      )}
                      {n.linkUrl && (
                        <Link href={n.linkUrl} className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> View
                        </Link>
                      )}
                      {!n.archived && (
                        <button
                          onClick={() => archiveMutation.mutate(n.id)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground flex items-center gap-1"
                          data-testid={`button-archive-dashboard-${n.id}`}
                        >
                          <Archive className="w-3 h-3" /> Archive
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(n.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center gap-1 ml-auto"
                        data-testid={`button-delete-dashboard-${n.id}`}
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
