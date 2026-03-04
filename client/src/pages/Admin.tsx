import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Shield, Users, Home, TrendingUp, Mail, Phone, MapPin,
  Clock, BedDouble, Bath, Maximize2, DollarSign, Eye,
  ChevronDown, ChevronUp, CheckCircle2, X, AlertCircle,
  MessageSquare, Image, FileText, Search, Layers, Briefcase,
  User, ExternalLink,
} from "lucide-react";

const ADMIN_USER_ID = "55534280";

type SellerPitch = {
  id: number;
  userId: string | null;
  name: string;
  email: string;
  phone: string | null;
  fullAddress: string | null;
  addressCity: string | null;
  addressState: string | null;
  beds: number | null;
  baths: string | null;
  sqft: number | null;
  lotSize: number | null;
  price: number | null;
  homeType: string | null;
  condition: string | null;
  description: string | null;
  photos: string[] | null;
  timeline: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  user: any;
};

type SellLead = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  fullAddress: string | null;
  beds: number | null;
  baths: string | null;
  sqft: number | null;
  estimatedValue: number | null;
  timeline: string | null;
  motivation: string | null;
  createdAt: string;
};

type AdminStats = {
  totalPitches: number;
  newPitches: number;
  totalSellLeads: number;
  totalBuyerProfiles: number;
  totalProperties: number;
};

function fmt(n: number) {
  return "$" + n.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 border-blue-200",
    reviewing: "bg-yellow-100 text-yellow-800 border-yellow-200",
    matched: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    contacted: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[status] || "bg-gray-100 text-gray-700 border-gray-200"}`} data-testid={`badge-status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PitchCard({ pitch, onUpdateStatus }: { pitch: SellerPitch; onUpdateStatus: (id: number, status: string, notes?: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(pitch.adminNotes || "");
  const [showPhotos, setShowPhotos] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden" data-testid={`card-pitch-${pitch.id}`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground" data-testid={`text-pitch-name-${pitch.id}`}>{pitch.name}</h3>
              <StatusBadge status={pitch.status} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {pitch.email}</span>
              {pitch.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {pitch.phone}</span>}
            </div>
          </div>
          {pitch.price && (
            <div className="text-right">
              <div className="text-lg font-bold text-primary" data-testid={`text-pitch-price-${pitch.id}`}>{fmt(pitch.price)}</div>
              <span className="text-xs text-muted-foreground">asking</span>
            </div>
          )}
        </div>

        {pitch.fullAddress && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            <MapPin className="w-4 h-4" />
            {pitch.fullAddress}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {pitch.beds && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <BedDouble className="w-4 h-4" /> {pitch.beds} beds
            </div>
          )}
          {pitch.baths && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Bath className="w-4 h-4" /> {pitch.baths} baths
            </div>
          )}
          {pitch.sqft && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Maximize2 className="w-4 h-4" /> {pitch.sqft.toLocaleString()} sqft
            </div>
          )}
          {pitch.timeline && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" /> {pitch.timeline}
            </div>
          )}
        </div>

        {pitch.description && (
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 mb-3">{pitch.description}</p>
        )}

        {pitch.photos && pitch.photos.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowPhotos(!showPhotos)}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              data-testid={`button-toggle-photos-${pitch.id}`}
            >
              <Image className="w-4 h-4" />
              {pitch.photos.length} photo{pitch.photos.length !== 1 ? "s" : ""} attached
              {showPhotos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showPhotos && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {pitch.photos.map((photo, i) => (
                  <img key={i} src={photo} alt={`Photo ${i + 1}`} className="w-full h-24 object-cover rounded-lg border" />
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          data-testid={`button-expand-pitch-${pitch.id}`}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide actions" : "Actions & Notes"}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-3 animate-in slide-in-from-top-2">
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">Admin Notes</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[60px] resize-none"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes about this pitch..."
                data-testid={`input-admin-notes-${pitch.id}`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {["reviewing", "contacted", "matched", "rejected"].map(s => (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(pitch.id, s, notes)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    pitch.status === s
                      ? "bg-primary text-white border-primary"
                      : "bg-white hover:bg-muted border-border"
                  }`}
                  data-testid={`button-status-${s}-${pitch.id}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{new Date(pitch.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        {pitch.homeType && <span className="px-2 py-0.5 bg-muted rounded-full">{pitch.homeType}</span>}
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"pitches" | "leads" | "overview" | "referrals" | "buyers">("overview");

  const isAdminUser = isAuthenticated && user?.id === ADMIN_USER_ID;

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdminUser,
  });

  const { data: pitches, isLoading: pitchesLoading } = useQuery<SellerPitch[]>({
    queryKey: ["/api/admin/seller-pitches"],
    enabled: isAdminUser,
  });

  const { data: sellLeads, isLoading: leadsLoading } = useQuery<SellLead[]>({
    queryKey: ["/api/admin/sell-leads"],
    enabled: isAdminUser,
  });

  const { data: referrals, isLoading: referralsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/buyer-referrals"],
    enabled: isAdminUser,
  });

  const { data: sellerReferrals, isLoading: sellerReferralsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/seller-referrals"],
    enabled: isAdminUser,
  });

  const { data: allBuyerProfiles, isLoading: buyersLoading } = useQuery<any[]>({
    queryKey: ["/api/buyer-profiles"],
    enabled: isAdminUser,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status: string; adminNotes?: string }) => {
      await apiRequest("PATCH", `/api/admin/seller-pitches/${id}`, { status, adminNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/seller-pitches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground text-sm">Please sign in to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-sm">You don't have admin privileges.</p>
        </div>
      </div>
    );
  }

  const handleUpdateStatus = (id: number, status: string, adminNotes?: string) => {
    updateStatusMutation.mutate({ id, status, adminNotes });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-admin-title">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage seller pitches, leads, and platform activity</p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6" data-testid="section-admin-stats">
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.newPitches}</div>
              <div className="text-xs text-muted-foreground">New Pitches</div>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats.totalPitches}</div>
              <div className="text-xs text-muted-foreground">Total Pitches</div>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats.totalSellLeads}</div>
              <div className="text-xs text-muted-foreground">Sell Leads</div>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats.totalBuyerProfiles}</div>
              <div className="text-xs text-muted-foreground">Buyer Profiles</div>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats.totalProperties}</div>
              <div className="text-xs text-muted-foreground">Listings</div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border p-4 mb-6" data-testid="section-admin-quicknav">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Navigation</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {[
              { href: "/", icon: Home, label: "Home", color: "text-foreground" },
              { href: "/search", icon: Search, label: "Search", color: "text-blue-600" },
              { href: "/sell", icon: TrendingUp, label: "Sell", color: "text-emerald-600" },
              { href: "/buyers", icon: Users, label: "Buyers", color: "text-purple-600" },
              { href: "/swipe", icon: Layers, label: "My Feed", color: "text-amber-600" },
              { href: "/dashboard", icon: User, label: "My Account", color: "text-primary" },
              { href: "/agent", icon: Briefcase, label: "Agent Hub", color: "text-indigo-600" },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-transparent hover:border-border hover:bg-muted/40 transition-all group"
                data-testid={`link-quicknav-${label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div className={`w-9 h-9 rounded-lg bg-muted/50 group-hover:bg-muted flex items-center justify-center transition-colors ${color}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex gap-1 mb-6 bg-muted/30 rounded-xl p-1" data-testid="section-admin-tabs">
          {(["overview", "pitches", "leads", "buyers", "referrals"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-tab-${tab}`}
            >
              {tab === "overview" ? "Overview"
                : tab === "pitches" ? `Pitches (${pitches?.length || 0})`
                : tab === "leads" ? `Leads (${sellLeads?.length || 0})`
                : tab === "buyers" ? `Buyers (${allBuyerProfiles?.length || 0})`
                : `Referrals (${(referrals?.length || 0) + (sellerReferrals?.length || 0)})`}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Recent Seller Pitches
              </h3>
              {pitchesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : pitches && pitches.length > 0 ? (
                <div className="space-y-3">
                  {pitches.slice(0, 5).map(pitch => (
                    <PitchCard key={pitch.id} pitch={pitch} onUpdateStatus={handleUpdateStatus} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border p-8 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No seller pitches yet</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Recent Sell Leads
              </h3>
              {leadsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : sellLeads && sellLeads.length > 0 ? (
                <div className="space-y-3">
                  {sellLeads.slice(0, 5).map(lead => (
                    <div key={lead.id} className="bg-white rounded-xl border p-5" data-testid={`card-lead-${lead.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{lead.name}</h4>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>
                            {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</span>}
                          </div>
                        </div>
                        {lead.estimatedValue && (
                          <div className="text-right">
                            <div className="text-lg font-bold text-primary">{fmt(lead.estimatedValue)}</div>
                            <span className="text-xs text-muted-foreground">estimated</span>
                          </div>
                        )}
                      </div>
                      {lead.fullAddress && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                          <MapPin className="w-4 h-4" /> {lead.fullAddress}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {lead.beds && <span>{lead.beds} bd</span>}
                        {lead.baths && <span>{lead.baths} ba</span>}
                        {lead.sqft && <span>{lead.sqft.toLocaleString()} sqft</span>}
                        {lead.timeline && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {lead.timeline}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border p-8 text-center">
                  <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No sell leads yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "pitches" && (
          <div className="space-y-3">
            {pitchesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : pitches && pitches.length > 0 ? (
              pitches.map(pitch => (
                <PitchCard key={pitch.id} pitch={pitch} onUpdateStatus={handleUpdateStatus} />
              ))
            ) : (
              <div className="bg-white rounded-xl border p-12 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No seller pitches yet</h3>
                <p className="text-sm text-muted-foreground">Pitches from homeowners will appear here.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "leads" && (
          <div className="space-y-3">
            {leadsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : sellLeads && sellLeads.length > 0 ? (
              sellLeads.map(lead => (
                <div key={lead.id} className="bg-white rounded-xl border p-5" data-testid={`card-lead-full-${lead.id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{lead.name}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>
                        {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</span>}
                      </div>
                    </div>
                    {lead.estimatedValue && (
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{fmt(lead.estimatedValue)}</div>
                        <span className="text-xs text-muted-foreground">estimated</span>
                      </div>
                    )}
                  </div>
                  {lead.fullAddress && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                      <MapPin className="w-4 h-4" /> {lead.fullAddress}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {lead.beds && <span>{lead.beds} bd</span>}
                    {lead.baths && <span>{lead.baths} ba</span>}
                    {lead.sqft && <span>{lead.sqft.toLocaleString()} sqft</span>}
                    {lead.timeline && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {lead.timeline}</span>}
                    {lead.motivation && <span>Motivation: {lead.motivation}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl border p-12 text-center">
                <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No sell leads yet</h3>
                <p className="text-sm text-muted-foreground">Leads from the sell wizard will appear here.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "buyers" && (
          <div className="space-y-3">
            {buyersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : allBuyerProfiles && allBuyerProfiles.length > 0 ? (
              allBuyerProfiles.map((bp: any) => (
                <div key={bp.id} className="bg-white rounded-xl border p-5" data-testid={`card-admin-buyer-${bp.id}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {bp.user?.profileImageUrl ? (
                        <img src={bp.user.profileImageUrl} alt="" className="w-10 h-10 rounded-full border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                          {bp.displayName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold" data-testid={`text-admin-buyer-name-${bp.id}`}>{bp.displayName}</h4>
                          {bp.isPreApproved && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">Pre-Approved</span>
                          )}
                          {bp.agentId && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">Has Agent</span>
                          )}
                          {!bp.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">Inactive</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {bp.user?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {bp.user.email}</span>}
                          {bp.userId && <span className="text-muted-foreground/60">ID: {bp.userId}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary" data-testid={`text-admin-buyer-budget-${bp.id}`}>
                        {bp.preApprovalAmount >= 1000000
                          ? `$${(bp.preApprovalAmount / 1000000).toFixed(1)}M`
                          : `$${(bp.preApprovalAmount / 1000).toFixed(0)}K`}
                      </div>
                      <span className="text-xs text-muted-foreground">budget</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {bp.minBeds && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <BedDouble className="w-4 h-4" /> {bp.minBeds}{bp.maxBeds ? `–${bp.maxBeds}` : "+"} beds
                      </div>
                    )}
                    {bp.minBaths && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Bath className="w-4 h-4" /> {bp.minBaths}+ baths
                      </div>
                    )}
                    {bp.minSqft && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Maximize2 className="w-4 h-4" /> {bp.minSqft.toLocaleString()}{bp.maxSqft ? `–${bp.maxSqft.toLocaleString()}` : "+"} sqft
                      </div>
                    )}
                    {bp.moveInTimeline && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" /> {bp.moveInTimeline}
                      </div>
                    )}
                  </div>

                  {bp.preferredCities && bp.preferredCities.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {bp.preferredCities.map((city: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-primary/5 text-primary text-xs rounded-full font-medium">{city}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {bp.homeTypes && bp.homeTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {bp.homeTypes.map((type: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">{type}</span>
                      ))}
                    </div>
                  )}

                  {bp.mustHaves && bp.mustHaves.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {bp.mustHaves.map((item: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">{item}</span>
                      ))}
                    </div>
                  )}

                  {bp.dealBreakers && bp.dealBreakers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {bp.dealBreakers.map((item: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">{item}</span>
                      ))}
                    </div>
                  )}

                  {bp.bio && (
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 mb-2">{bp.bio}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {bp.needsLenderReferral && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Needs Lender</span>
                    )}
                    {bp.needsAgentReferral && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Needs Agent</span>
                    )}
                    {bp.hasAgent === false && !bp.agentId && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">Unrepresented</span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground mt-2">
                    Created {new Date(bp.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl border p-12 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No buyer profiles yet</h3>
                <p className="text-sm text-muted-foreground">Buyer profiles created on the marketplace will appear here.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "referrals" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Buyer Referrals ({referrals?.length || 0})
              </h3>
              {referralsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : referrals && referrals.length > 0 ? (
                <div className="space-y-3">
                  {referrals.map((r: any) => (
                    <div key={`buyer-${r.id}`} className="bg-white rounded-xl border p-5" data-testid={`card-referral-buyer-${r.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{r.displayName}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">Buyer</span>
                          </div>
                          {r.user && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {r.user.email}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">{fmt(r.preApprovalAmount || 0)}</div>
                          <span className="text-xs text-muted-foreground">{r.isPreApproved ? "pre-approved" : "estimated"}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {r.needsLenderReferral && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200" data-testid={`badge-needs-lender-buyer-${r.id}`}>
                            Needs Lender
                          </span>
                        )}
                        {r.needsAgentReferral && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200" data-testid={`badge-needs-agent-buyer-${r.id}`}>
                            Needs Agent
                          </span>
                        )}
                      </div>
                      {r.preferredCities && r.preferredCities.length > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                          <MapPin className="w-4 h-4" /> {r.preferredCities.join(", ")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border p-8 text-center">
                  <p className="text-sm text-muted-foreground">No buyer referrals yet.</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Home className="w-4 h-4 text-emerald-600" />
                Seller Referrals ({sellerReferrals?.length || 0})
              </h3>
              {sellerReferralsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : sellerReferrals && sellerReferrals.length > 0 ? (
                <div className="space-y-3">
                  {sellerReferrals.map((s: any) => (
                    <div key={`seller-${s.id}`} className="bg-white rounded-xl border p-5" data-testid={`card-referral-seller-${s.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{s.name}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Seller</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {s.email}</span>
                            {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {s.phone}</span>}
                          </div>
                        </div>
                        {s.estimatedValue && (
                          <div className="text-right">
                            <div className="text-lg font-bold text-primary">{fmt(s.estimatedValue)}</div>
                            <span className="text-xs text-muted-foreground">estimated</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {s.needsLenderReferral && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200" data-testid={`badge-needs-lender-seller-${s.id}`}>
                            Needs Lender (Buy Next)
                          </span>
                        )}
                        {s.needsAgentReferral && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200" data-testid={`badge-needs-agent-seller-${s.id}`}>
                            Needs Agent
                          </span>
                        )}
                      </div>
                      {s.fullAddress && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                          <MapPin className="w-4 h-4" /> {s.fullAddress}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border p-8 text-center">
                  <p className="text-sm text-muted-foreground">No seller referrals yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
