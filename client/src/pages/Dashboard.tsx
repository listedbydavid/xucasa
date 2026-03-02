import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PropertyCard } from "@/components/PropertyCard";
import { useSavedProperties, useSavedSearches, useDeleteSavedSearch } from "@/hooks/use-saved";
import {
  useSearchHistory, useDeleteSearchHistory, useClearSearchHistory,
  useMyHomes, useCreateMyHome, useDeleteMyHome, useMyHomeIntelligence,
  useUpdateProfile,
} from "@/hooks/use-client-dashboard";
import { Link } from "wouter";
import {
  Heart, Search, User, Home, Clock, BookmarkCheck,
  Trash2, ChevronRight, X, Plus, Edit2, Check, MapPin,
  Droplets, TreeDeciduous, School, ShoppingCart, Building,
  Flame, Activity, ExternalLink, Camera, Loader2,
} from "lucide-react";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const LIBRARIES: ('places')[] = ['places'];

type Section = "profile" | "myhome" | "favorites" | "searches" | "history";

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("profile");
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
    { id: "profile",   label: "My Profile",       icon: User },
    { id: "myhome",    label: "My Home",           icon: Home },
    { id: "favorites", label: "Favorites",         icon: Heart },
    { id: "searches",  label: "Saved Searches",    icon: BookmarkCheck },
    { id: "history",   label: "Search History",    icon: Clock },
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

        <div className="flex gap-8">
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
          <div className="md:hidden w-full overflow-x-auto pb-4">
            <div className="flex gap-2 mb-6">
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
            {activeSection === "profile"   && <ProfileSection user={user} />}
            {activeSection === "myhome"    && <MyHomeSection />}
            {activeSection === "favorites" && <FavoritesSection />}
            {activeSection === "searches"  && <SavedSearchesSection />}
            {activeSection === "history"   && <SearchHistorySection />}
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
                    <label className="block text-xs font-bold text-muted-foreground mb-1">First Name</label>
                    <input
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="w-full bg-background border-2 border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">Last Name</label>
                    <input
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
        <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}</div>
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
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAPS_KEY, libraries: LIBRARIES });
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
          <label className="block text-xs font-bold text-muted-foreground mb-1">Nickname</label>
          <input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none" placeholder="e.g. My House" data-testid="input-home-nickname" />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">City</label>
          <input value={form.addressCity} onChange={e => setForm({ ...form, addressCity: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none" placeholder="City" />
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
      <div className="border-t border-border p-6 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Loading public records & zoning data...</span>
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

// ── Favorites Section ──────────────────────────────────────────────────────────

function FavoritesSection() {
  const { data: savedProps = [], isLoading } = useSavedProperties();

  return (
    <div className="space-y-6">
      <SectionHeader title="Favorites" subtitle="Homes you've saved while browsing" />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-80 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : savedProps.length === 0 ? (
        <EmptyState icon={Heart} title="No favorites yet" description="Click the heart icon on any property card while browsing to save it here.">
          <Link href="/search" className="bg-foreground text-background px-6 py-2.5 rounded-full font-bold hover:bg-primary hover:text-white transition-colors">
            Start Browsing
          </Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {savedProps.map(({ property }) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Saved Searches Section ─────────────────────────────────────────────────────

function SavedSearchesSection() {
  const { data: savedSearches = [], isLoading } = useSavedSearches();
  const { mutate: deleteSearch } = useDeleteSavedSearch();

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
        <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}</div>
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
                <h3 className="font-bold text-foreground">{search.name}</h3>
                <button onClick={() => deleteSearch(search.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
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
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
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
