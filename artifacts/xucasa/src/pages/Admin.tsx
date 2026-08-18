import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import ConversationThreadComponent from "@/pages/ConversationThread";
import AdminToursEditor from "@/components/AdminToursEditor";
import {
  Shield, Users, Home, TrendingUp, Mail, Phone, MapPin,
  Clock, BedDouble, Bath, Maximize2, DollarSign, Eye,
  ChevronDown, ChevronUp, CheckCircle2, X, AlertCircle,
  MessageSquare, Image, FileText, Search, Layers, Briefcase,
  User, ExternalLink, UserCog, Ban, Trash2, Edit3, Save,
  Activity, Crown, ShieldCheck, UserX, MoreVertical,
  Handshake, AlertTriangle, Archive, Download, FolderOpen,
  ArrowLeft,
} from "lucide-react";


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

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { icon: any; color: string; label: string }> = {
    admin: { icon: Crown, color: "bg-red-100 text-red-800 border-red-200", label: "Admin" },
    agent: { icon: Briefcase, color: "bg-blue-100 text-blue-800 border-blue-200", label: "Agent" },
    user: { icon: User, color: "bg-gray-100 text-gray-700 border-gray-200", label: "User" },
  };
  const { icon: Icon, color, label } = config[role] || config.user;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function UserStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-200",
    suspended: "bg-amber-100 text-amber-800 border-amber-200",
    banned: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[status] || colors.active}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ActivityPill({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}>
      {count} {label}
    </span>
  );
}

function UserCard({ u, isCurrentUser, onUpdate, onDelete, isUpdating, isDeleting }: {
  u: any;
  isCurrentUser: boolean;
  onUpdate: (updates: { role?: string; status?: string; adminNotes?: string }) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(u.adminNotes || "");

  const act = u.activity || {};
  const hasActivity = Object.values(act).some((v: any) => v > 0);

  return (
    <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden" data-testid={`card-admin-user-${u.id}`}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {u.profileImageUrl ? (
              <img src={u.profileImageUrl} alt="" className="w-11 h-11 rounded-full border border-border" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                {(u.firstName?.charAt(0) || u.email?.charAt(0) || "?").toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-foreground" data-testid={`text-user-name-${u.id}`}>
                  {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName || u.email || "Unknown"}
                </h4>
                <RoleBadge role={u.role || "user"} />
                <UserStatusBadge status={u.status || "active"} />
                {isCurrentUser && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">You</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {u.email && (
                  <a href={`mailto:${u.email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                    <Mail className="w-3 h-3" /> {u.email}
                  </a>
                )}
                <span className="text-muted-foreground/50">ID: {u.id.length > 12 ? u.id.slice(0, 12) + "..." : u.id}</span>
              </div>
            </div>
          </div>
        </div>

        {hasActivity && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <ActivityPill label="listings" count={act.listings_count} color="bg-blue-50 text-blue-700 border-blue-200" />
            <ActivityPill label="saved" count={act.saved_count} color="bg-pink-50 text-pink-700 border-pink-200" />
            <ActivityPill label="searches" count={act.searches_count} color="bg-cyan-50 text-cyan-700 border-cyan-200" />
            <ActivityPill label="buyer profiles" count={act.buyer_profiles_count} color="bg-purple-50 text-purple-700 border-purple-200" />
            <ActivityPill label="pitches sent" count={act.matches_sent_count} color="bg-amber-50 text-amber-700 border-amber-200" />
            <ActivityPill label="seller pitches" count={act.pitches_count} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
            <ActivityPill label="sell leads" count={act.sell_leads_count} color="bg-orange-50 text-orange-700 border-orange-200" />
            <ActivityPill label="homes tracked" count={act.homes_count} color="bg-indigo-50 text-indigo-700 border-indigo-200" />
            <ActivityPill label="fav lists" count={act.fav_lists_count} color="bg-rose-50 text-rose-700 border-rose-200" />
            <ActivityPill label="history" count={act.history_count} color="bg-gray-50 text-gray-600 border-gray-200" />
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
            <span>Last login {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never"}</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            data-testid={`button-expand-user-${u.id}`}
          >
            <UserCog className="w-3.5 h-3.5" />
            {expanded ? "Hide" : "Manage"}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-4 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
                <div className="flex gap-1.5">
                  {["user", "agent", "admin"].map(r => (
                    <button
                      key={r}
                      onClick={() => onUpdate({ role: r })}
                      disabled={isUpdating}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        (u.role || "user") === r
                          ? "bg-primary text-white border-primary"
                          : "bg-white hover:bg-muted border-border disabled:opacity-50"
                      }`}
                      data-testid={`button-role-${r}-${u.id}`}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Account Status</label>
                <div className="flex gap-1.5">
                  {["active", "suspended", "banned"].map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        if (isCurrentUser && s !== "active") {
                          alert("You can't suspend or ban your own account.");
                          return;
                        }
                        onUpdate({ status: s });
                      }}
                      disabled={isUpdating}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        (u.status || "active") === s
                          ? s === "active" ? "bg-green-600 text-white border-green-600"
                            : s === "suspended" ? "bg-amber-500 text-white border-amber-500"
                            : "bg-red-600 text-white border-red-600"
                          : "bg-white hover:bg-muted border-border"
                      }`}
                      data-testid={`button-status-${s}-${u.id}`}
                    >
                      {s === "active" ? "Active" : s === "suspended" ? "Suspended" : "Banned"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin Notes</label>
              <div className="flex gap-2">
                <textarea
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[60px] resize-none"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal notes about this user..."
                  data-testid={`input-user-notes-${u.id}`}
                />
                <button
                  onClick={() => onUpdate({ adminNotes: notes })}
                  disabled={isUpdating || notes === (u.adminNotes || "")}
                  className="self-end px-3 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  data-testid={`button-save-notes-${u.id}`}
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {u.adminNotes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-amber-800 mb-1">Current Notes</div>
                <p className="text-sm text-amber-900">{u.adminNotes}</p>
              </div>
            )}

            {!isCurrentUser && (
              <div className="pt-2 border-t border-border/40">
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                  data-testid={`button-delete-user-${u.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete user and all data
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersTab({ users, isLoading, currentUserId, onUpdateUser, onDeleteUser, isUpdating, isDeleting }: {
  users: any[];
  isLoading: boolean;
  currentUserId: string;
  onUpdateUser: (id: string, updates: { role?: string; status?: string; adminNotes?: string }) => void;
  onDeleteUser: (id: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  let filtered = [...users];

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(u =>
      (u.firstName || "").toLowerCase().includes(q) ||
      (u.lastName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.id || "").toLowerCase().includes(q)
    );
  }

  if (roleFilter !== "all") {
    filtered = filtered.filter(u => (u.role || "user") === roleFilter);
  }
  if (statusFilter !== "all") {
    filtered = filtered.filter(u => (u.status || "active") === statusFilter);
  }

  if (sortBy === "newest") {
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortBy === "oldest") {
    filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (sortBy === "last-login") {
    filtered.sort((a, b) => {
      if (!a.lastLoginAt) return 1;
      if (!b.lastLoginAt) return -1;
      return new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime();
    });
  } else if (sortBy === "most-active") {
    filtered.sort((a, b) => {
      const aSum = Object.values(a.activity || {}).reduce((s: number, v: any) => s + (v || 0), 0);
      const bSum = Object.values(b.activity || {}).reduce((s: number, v: any) => s + (v || 0), 0);
      return (bSum as number) - (aSum as number);
    });
  } else if (sortBy === "name") {
    filtered.sort((a, b) => ((a.firstName || a.email || "") as string).localeCompare((b.firstName || b.email || "") as string));
  }

  const roleCounts = {
    all: users.length,
    user: users.filter(u => (u.role || "user") === "user").length,
    agent: users.filter(u => u.role === "agent").length,
    admin: users.filter(u => u.role === "admin").length,
  };

  const statusCounts = {
    all: users.length,
    active: users.filter(u => (u.status || "active") === "active").length,
    suspended: users.filter(u => u.status === "suspended").length,
    banned: users.filter(u => u.status === "banned").length,
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-muted" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="input-user-search"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="select-user-sort"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="last-login">Last login</option>
            <option value="most-active">Most active</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Role:</span>
            {(["all", "user", "agent", "admin"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  roleFilter === r ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
                data-testid={`button-filter-role-${r}`}
              >
                {r === "all" ? `All (${roleCounts.all})` : `${r.charAt(0).toUpperCase() + r.slice(1)} (${roleCounts[r]})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Status:</span>
            {(["all", "active", "suspended", "banned"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
                data-testid={`button-filter-status-${s}`}
              >
                {s === "all" ? `All` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${statusCounts[s]})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {users.length} users
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(u => (
            <UserCard
              key={u.id}
              u={u}
              isCurrentUser={u.id === currentUserId}
              onUpdate={(updates) => onUpdateUser(u.id, updates)}
              onDelete={() => onDeleteUser(u.id)}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-12 text-center">
          <UserX className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No users found</h3>
          <p className="text-sm text-muted-foreground">
            {search ? "Try a different search term." : "No users match the current filters."}
          </p>
        </div>
      )}
    </div>
  );
}

function ErrorReportCard({ report, onUpdateStatus, onResolve, onDelete, onAddNote }: {
  report: any;
  onUpdateStatus: (status: string) => void;
  onResolve: () => void;
  onDelete: () => void;
  onAddNote: (note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState(report.adminNotes || "");
  const [showNote, setShowNote] = useState(false);

  const typeColors: Record<string, string> = {
    uncaught_error: "bg-red-100 text-red-700",
    unhandled_rejection: "bg-orange-100 text-orange-700",
    react_error: "bg-purple-100 text-purple-700",
    api_error: "bg-yellow-100 text-yellow-700",
  };

  const statusColors: Record<string, string> = {
    new: "bg-red-100 text-red-700",
    investigating: "bg-yellow-100 text-yellow-700",
    resolved: "bg-green-100 text-green-700",
    ignored: "bg-gray-100 text-gray-500",
  };

  const timeSince = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div
      className={`bg-white rounded-xl border p-4 transition-all ${report.resolved ? "opacity-60" : ""}`}
      data-testid={`card-error-${report.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeColors[report.type] || "bg-gray-100 text-gray-600"}`}>
              {report.type?.replace(/_/g, " ")}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColors[report.status] || "bg-gray-100"}`}>
              {report.status}
            </span>
            {report.occurrences > 1 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                ×{report.occurrences}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate" data-testid={`text-error-message-${report.id}`}>
            {report.message}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {report.url && <span className="truncate max-w-[200px]">{report.url}</span>}
            <span>{timeSince(report.lastSeen)}</span>
            {report.userId && <span>User: {report.userId.slice(0, 8)}...</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            data-testid={`button-expand-error-${report.id}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {report.stack && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1">Stack Trace</h4>
              <pre className="text-[11px] bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap" data-testid={`text-stack-${report.id}`}>
                {report.stack}
              </pre>
            </div>
          )}

          {report.componentStack && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1">Component Stack</h4>
              <pre className="text-[11px] bg-gray-100 p-3 rounded-lg overflow-x-auto max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                {report.componentStack}
              </pre>
            </div>
          )}

          {report.breadcrumbs && Array.isArray(report.breadcrumbs) && report.breadcrumbs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1">User Activity Trail ({report.breadcrumbs.length} actions)</h4>
              <div className="bg-gray-50 rounded-lg p-2 max-h-[200px] overflow-y-auto">
                {(report.breadcrumbs as any[]).map((crumb: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 py-0.5 text-[11px]">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      crumb.type === "click" ? "bg-blue-400" :
                      crumb.type === "navigation" ? "bg-green-400" :
                      crumb.type === "network" ? "bg-orange-400" : "bg-gray-400"
                    }`} />
                    <span className="text-muted-foreground">{crumb.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.metadata && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1">Device Info</h4>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                {report.metadata.viewport && (
                  <span className="text-muted-foreground">Viewport: {report.metadata.viewport.width}×{report.metadata.viewport.height}</span>
                )}
                {report.metadata.online !== undefined && (
                  <span className="text-muted-foreground">Online: {report.metadata.online ? "Yes" : "No"}</span>
                )}
                {report.metadata.timestamp && (
                  <span className="text-muted-foreground">Time: {new Date(report.metadata.timestamp).toLocaleString()}</span>
                )}
                {report.userAgent && (
                  <span className="text-muted-foreground col-span-2 truncate">UA: {report.userAgent}</span>
                )}
              </div>
            </div>
          )}

          {report.adminNotes && !showNote && (
            <div className="bg-blue-50 rounded-lg p-2">
              <h4 className="text-xs font-semibold text-blue-700 mb-0.5">Admin Notes</h4>
              <p className="text-xs text-blue-800">{report.adminNotes}</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {!report.resolved && (
              <>
                <button
                  onClick={() => onUpdateStatus("investigating")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                  data-testid={`button-investigate-${report.id}`}
                >
                  Investigating
                </button>
                <button
                  onClick={() => onUpdateStatus("ignored")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Ignore
                </button>
              </>
            )}
            <button
              onClick={onResolve}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                report.resolved
                  ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
              data-testid={`button-resolve-${report.id}`}
            >
              {report.resolved ? "Reopen" : "Resolve"}
            </button>
            <button
              onClick={() => setShowNote(!showNote)}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            >
              {showNote ? "Cancel" : "Add Note"}
            </button>
            <button
              onClick={onDelete}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors ml-auto"
              data-testid={`button-delete-error-${report.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {showNote && (
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add admin note..."
                className="flex-1 text-xs border rounded-lg px-3 py-1.5"
                data-testid={`input-note-${report.id}`}
              />
              <button
                onClick={() => { onAddNote(noteText); setShowNote(false); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                data-testid={`button-save-note-${report.id}`}
              >
                <Save className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  usePageMeta({ title: 'Admin', noIndex: true });
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"pitches" | "leads" | "overview" | "referrals" | "buyers" | "users" | "representation" | "errors" | "conversations" | "audit" | "tours" | "vendors" | "partners">("overview");
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [convoSearch, setConvoSearch] = useState("");
  const [convoStatusFilter, setConvoStatusFilter] = useState("all");
  const [convoPage, setConvoPage] = useState(0);
  const CONVO_PAGE_SIZE = 20;

  const isAdminUser = isAuthenticated && (user as any)?.isAdmin;

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

  const { data: allUsers, isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdminUser,
  });

  const { data: swipeNotifications, isLoading: swipeNotificationsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/swipe-notifications"],
    enabled: isAdminUser,
  });

  const { data: propertyOffers, isLoading: propertyOffersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/property-offers"],
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, role, status, adminNotes }: { id: string; role?: string; status?: string; adminNotes?: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${id}`, { role, status, adminNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "User updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "User deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: errorReports } = useQuery<any[]>({
    queryKey: ["/api/admin/error-reports"],
    enabled: isAdminUser,
  });

  const updateErrorMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: number; status?: string; adminNotes?: string; resolved?: boolean }) => {
      await apiRequest("PATCH", `/api/admin/error-reports/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-reports"] });
      toast({ title: "Error report updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteErrorMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/error-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-reports"] });
      toast({ title: "Error report deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: errorArchive, refetch: refetchArchive } = useQuery<any[]>({
    queryKey: ["/api/admin/error-reports/archive"],
    enabled: isAdminUser && activeTab === "errors",
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/error-reports/archive");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/error-reports"] });
      refetchArchive();
      toast({ title: "Errors archived", description: `${data.archived} resolved errors moved to archive.` });
    },
    onError: (err: any) => {
      toast({ title: "Archive failed", description: err.message, variant: "destructive" });
    },
  });

  const [showArchive, setShowArchive] = useState(false);

  const [auditEventType, setAuditEventType] = useState("all");
  const { data: auditStats } = useQuery<any>({
    queryKey: ["/api/admin/audit-events/stats"],
    enabled: isAdminUser && activeTab === "audit",
  });
  const { data: auditEvents } = useQuery<any[]>({
    queryKey: ["/api/admin/audit-events", auditEventType],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (auditEventType !== "all") params.set("eventType", auditEventType);
      const res = await fetch(`/api/admin/audit-events?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit events");
      return res.json();
    },
    enabled: isAdminUser && activeTab === "audit",
  });

  const { data: adminConversations, isLoading: convoListLoading } = useQuery<any>({
    queryKey: ["/api/admin/conversations", convoSearch, convoStatusFilter, convoPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (convoSearch) params.set("search", convoSearch);
      if (convoStatusFilter !== "all") params.set("status", convoStatusFilter);
      params.set("limit", String(CONVO_PAGE_SIZE));
      params.set("offset", String(convoPage * CONVO_PAGE_SIZE));
      const res = await fetch(`/api/admin/conversations?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    enabled: isAdminUser && activeTab === "conversations",
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

        {!stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6" data-testid="skeleton-admin-stats">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-card rounded-xl border p-4 animate-pulse">
                <div className="h-7 bg-muted rounded-md w-12 mx-auto mb-2" />
                <div className="h-3 bg-muted rounded-md w-20 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6" data-testid="section-admin-stats">
            <div className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{allUsers?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total Users</div>
            </div>
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

        <div className="bg-card rounded-xl border p-4 mb-6" data-testid="section-admin-quicknav">
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

        <div className="flex gap-1 mb-6 bg-muted/30 rounded-xl p-1 overflow-x-auto" data-testid="section-admin-tabs">
          {(["overview", "users", "pitches", "leads", "buyers", "conversations", "referrals", "representation", "errors", "audit", "tours", "vendors", "partners"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab === "conversations") setSelectedConversationId(null); }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-tab-${tab}`}
            >
              {tab === "overview" ? "Overview"
                : tab === "users" ? `Users (${allUsers?.length || 0})`
                : tab === "pitches" ? `Pitches (${pitches?.length || 0})`
                : tab === "leads" ? `Leads (${sellLeads?.length || 0})`
                : tab === "buyers" ? `Buyers (${allBuyerProfiles?.length || 0})`
                : tab === "conversations" ? "Conversations"
                : tab === "referrals" ? `Referrals (${(referrals?.length || 0) + (sellerReferrals?.length || 0)})`
                : tab === "errors" ? `Errors (${errorReports?.filter((e: any) => !e.resolved).length || 0})`
                : tab === "audit" ? "Audit Log"
                : tab === "tours" ? "Tours"
                : tab === "vendors" ? "Vendors"
                : tab === "partners" ? "Partners"
                : `Representation (${swipeNotifications?.length || 0})`}
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
              <div className="space-y-3" data-testid="skeleton-admin-buyers">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-card rounded-xl border p-5 animate-pulse">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-full" />
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded-md w-32" />
                          <div className="h-3 bg-muted rounded-md w-44" />
                        </div>
                      </div>
                      <div className="space-y-1.5 text-right">
                        <div className="h-5 bg-muted rounded-md w-20 ml-auto" />
                        <div className="h-3 bg-muted rounded-md w-12 ml-auto" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="h-4 bg-muted rounded-md" />
                      <div className="h-4 bg-muted rounded-md" />
                      <div className="h-4 bg-muted rounded-md" />
                      <div className="h-4 bg-muted rounded-md" />
                    </div>
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

        {activeTab === "users" && (
          <UsersTab
            users={allUsers || []}
            isLoading={usersLoading}
            currentUserId={user?.id || ""}
            onUpdateUser={(id, updates) => updateUserMutation.mutate({ id, ...updates })}
            onDeleteUser={(id) => {
              if (confirm("Are you sure? This will permanently delete the user and ALL their data (listings, saved properties, buyer profiles, etc.). This cannot be undone.")) {
                deleteUserMutation.mutate(id);
              }
            }}
            isUpdating={updateUserMutation.isPending}
            isDeleting={deleteUserMutation.isPending}
          />
        )}

        {activeTab === "representation" && (() => {
          const notifications = swipeNotifications || [];
          const offers = propertyOffers || [];
          const unrepBuyers = notifications.filter((n: any) => n.buyerRepresented === false).length;
          const unrepSellers = notifications.filter((n: any) => n.sellerRepresented === false).length;
          const totalOffers = offers.length;
          const sorted = [...notifications].sort((a: any, b: any) => {
            const aUnrep = (a.buyerRepresented === false || a.sellerRepresented === false) ? 1 : 0;
            const bUnrep = (b.buyerRepresented === false || b.sellerRepresented === false) ? 1 : 0;
            if (bUnrep !== aUnrep) return bUnrep - aUnrep;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

          const notifStatusColors: Record<string, string> = {
            notified: "bg-blue-100 text-blue-800 border-blue-200",
            offer_created: "bg-green-100 text-green-800 border-green-200",
            dismissed: "bg-gray-100 text-gray-700 border-gray-200",
          };

          return (
            <div className="space-y-6" data-testid="section-representation">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="section-representation-stats">
                <div className="bg-white rounded-xl border p-4 text-center">
                  <div className="text-2xl font-bold text-foreground" data-testid="stat-total-signals">{notifications.length}</div>
                  <div className="text-xs text-muted-foreground">Total Interest Signals</div>
                </div>
                <div className="bg-white rounded-xl border p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600" data-testid="stat-unrep-buyers">{unrepBuyers}</div>
                  <div className="text-xs text-muted-foreground">Unrepresented Buyers</div>
                </div>
                <div className="bg-white rounded-xl border p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600" data-testid="stat-unrep-sellers">{unrepSellers}</div>
                  <div className="text-xs text-muted-foreground">Unrepresented Sellers</div>
                </div>
                <div className="bg-white rounded-xl border p-4 text-center">
                  <div className="text-2xl font-bold text-green-600" data-testid="stat-total-offers">{totalOffers}</div>
                  <div className="text-xs text-muted-foreground">Total Offers Created</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-primary" />
                  Representation Opportunities
                </h3>
                {swipeNotificationsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : sorted.length > 0 ? (
                  <div className="space-y-3">
                    {sorted.map((n: any) => (
                      <div key={n.id} className="bg-white rounded-xl border border-border/60 shadow-sm p-5" data-testid={`card-swipe-notification-${n.id}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="font-semibold text-foreground" data-testid={`text-notification-property-${n.id}`}>
                                {n.property?.title || `Property #${n.propertyId}`}
                              </h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${notifStatusColors[n.status] || "bg-gray-100 text-gray-700 border-gray-200"}`} data-testid={`badge-notification-status-${n.id}`}>
                                {n.status === "offer_created" ? "Offer Created" : n.status?.charAt(0).toUpperCase() + n.status?.slice(1)}
                              </span>
                            </div>
                            {n.property?.location && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <MapPin className="w-3.5 h-3.5" /> {n.property.location}
                              </div>
                            )}
                          </div>
                          {n.property?.price && (
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary" data-testid={`text-notification-price-${n.id}`}>{fmt(n.property.price)}</div>
                              <span className="text-xs text-muted-foreground">listing price</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {n.buyerRepresented === false && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200" data-testid={`badge-buyer-needs-rep-${n.id}`}>
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              Buyer needs representation
                            </span>
                          )}
                          {n.sellerRepresented === false && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200" data-testid={`badge-seller-needs-rep-${n.id}`}>
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              Seller needs representation
                            </span>
                          )}
                          {n.buyerRepresented === true && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200" data-testid={`badge-buyer-represented-${n.id}`}>
                              Buyer represented
                            </span>
                          )}
                          {n.sellerRepresented === true && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200" data-testid={`badge-seller-represented-${n.id}`}>
                              Seller represented
                            </span>
                          )}
                        </div>

                        <div className="bg-muted/30 rounded-lg p-3 mb-3">
                          <div className="text-xs font-medium text-muted-foreground mb-1.5">Buyer Contact</div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-medium text-foreground" data-testid={`text-buyer-name-${n.id}`}>
                              {n.buyer?.firstName && n.buyer?.lastName
                                ? `${n.buyer.firstName} ${n.buyer.lastName}`
                                : n.buyer?.firstName || n.buyer?.email || "Unknown"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {n.buyer?.email && (
                              <a href={`mailto:${n.buyer.email}`} className="flex items-center gap-1 hover:text-primary transition-colors" data-testid={`link-buyer-email-${n.id}`}>
                                <Mail className="w-3 h-3" /> {n.buyer.email}
                              </a>
                            )}
                            {n.buyer?.phone && (
                              <span className="flex items-center gap-1" data-testid={`text-buyer-phone-${n.id}`}>
                                <Phone className="w-3 h-3" /> {n.buyer.phone}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                          {n.buyerAgentEmail && (
                            <span className="flex items-center gap-1" data-testid={`text-buyer-agent-${n.id}`}>
                              <Briefcase className="w-3 h-3" /> Buyer agent: {n.buyerAgentEmail}
                            </span>
                          )}
                          {n.listingAgentEmail && (
                            <span className="flex items-center gap-1" data-testid={`text-listing-agent-${n.id}`}>
                              <Briefcase className="w-3 h-3" /> Listing agent: {n.listingAgentEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border p-12 text-center">
                    <Handshake className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">No interest signals yet</h3>
                    <p className="text-sm text-muted-foreground">When buyers swipe right on properties, representation opportunities will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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

        {activeTab === "conversations" && (
          <div className="space-y-4" data-testid="section-admin-conversations">
            {selectedConversationId ? (
              <div>
                <button
                  onClick={() => setSelectedConversationId(null)}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline mb-4"
                  data-testid="button-back-to-conversations"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to all conversations
                </button>
                <div className="bg-white rounded-xl border overflow-hidden">
                  <ConversationThreadComponent adminMode={true} adminConversationId={selectedConversationId} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by participant name or email..."
                      value={convoSearch}
                      onChange={e => { setConvoSearch(e.target.value); setConvoPage(0); }}
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="input-convo-search"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {["all", "active", "archived", "closed"].map(s => (
                      <button
                        key={s}
                        onClick={() => { setConvoStatusFilter(s); setConvoPage(0); }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          convoStatusFilter === s ? "bg-primary text-white border-primary" : "bg-white hover:bg-muted border-border"
                        }`}
                        data-testid={`button-convo-filter-${s}`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {convoListLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : adminConversations?.conversations?.length > 0 ? (
                  <div className="space-y-2">
                    {adminConversations.conversations.map((convo: any) => {
                      const buyerName = convo.buyer?.firstName
                        ? `${convo.buyer.firstName} ${convo.buyer.lastName || ""}`.trim()
                        : convo.buyer?.email || "Unknown";
                      const agentName = convo.agent?.firstName
                        ? `${convo.agent.firstName} ${convo.agent.lastName || ""}`.trim()
                        : convo.agent?.email || "Unknown";
                      const isPitch = convo.initiatedBy === "seller";

                      return (
                        <button
                          key={convo.id}
                          onClick={() => setSelectedConversationId(convo.id)}
                          className="w-full text-left bg-white rounded-xl border border-border/60 shadow-sm p-4 hover:border-primary/30 transition-colors"
                          data-testid={`card-admin-conversation-${convo.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                              {convo.property?.imageUrl ? (
                                <img src={convo.property.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Home className="w-4 h-4 text-muted-foreground/40" /></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-sm font-semibold truncate">{buyerName}</span>
                                <span className="text-muted-foreground text-xs">↔</span>
                                <span className="text-sm font-semibold truncate">{agentName}</span>
                                {isPitch && (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">Pitch</span>
                                )}
                                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                                  convo.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                }`}>
                                  {convo.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="truncate">{convo.property?.title || "—"}</span>
                                <span>·</span>
                                <span>{convo.messageCount} msg{convo.messageCount !== 1 ? "s" : ""}</span>
                                {convo.lastMessage && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate max-w-[200px]">{convo.lastMessage.content?.substring(0, 50)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                              {convo.lastMessageAt
                                ? new Date(convo.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                : new Date(convo.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border p-12 text-center">
                    <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">No conversations found</h3>
                    <p className="text-sm text-muted-foreground">
                      {convoSearch ? "Try a different search term." : "No conversations have been started yet."}
                    </p>
                  </div>
                )}

                {/* Pagination controls */}
                {adminConversations?.total > 0 && (
                  <div className="flex items-center justify-between mt-4" data-testid="convo-pagination">
                    <span className="text-xs text-muted-foreground">
                      Showing {Math.min(convoPage * CONVO_PAGE_SIZE + 1, adminConversations.total)}–{Math.min((convoPage + 1) * CONVO_PAGE_SIZE, adminConversations.total)} of {adminConversations.total}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConvoPage(p => Math.max(0, p - 1))}
                        disabled={convoPage === 0}
                        className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40 hover:bg-muted"
                        data-testid="button-convo-prev"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setConvoPage(p => p + 1)}
                        disabled={(convoPage + 1) * CONVO_PAGE_SIZE >= adminConversations.total}
                        className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40 hover:bg-muted"
                        data-testid="button-convo-next"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "errors" && (
          <div className="space-y-4" data-testid="section-errors">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Error Reports
              </h3>
              <div className="flex gap-2 text-xs items-center">
                <span className="px-2 py-1 rounded-full bg-red-100 text-red-700" data-testid="text-error-count-new">
                  {errorReports?.filter((e: any) => e.status === "new").length || 0} new
                </span>
                <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                  {errorReports?.filter((e: any) => e.status === "investigating").length || 0} investigating
                </span>
                <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">
                  {errorReports?.filter((e: any) => e.resolved).length || 0} resolved
                </span>
                <div className="w-px h-4 bg-border mx-1" />
                <button
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending || !errorReports?.some((e: any) => e.resolved)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  data-testid="button-archive-errors"
                >
                  <Archive className="w-3 h-3" />
                  {archiveMutation.isPending ? "Archiving..." : "Archive Resolved"}
                </button>
                <button
                  onClick={() => setShowArchive(!showArchive)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  data-testid="button-view-archive"
                >
                  <FolderOpen className="w-3 h-3" />
                  Archive{errorArchive && errorArchive.length > 0 ? ` (${errorArchive.length})` : ""}
                </button>
                <a
                  href="/api/admin/error-reports/archive/download"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  data-testid="button-download-archive"
                >
                  <Download className="w-3 h-3" />
                </a>
              </div>
            </div>

            {showArchive && (
              <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 space-y-3" data-testid="section-error-archive">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
                    <Archive className="w-4 h-4" />
                    Error Archive
                    <span className="text-xs font-normal text-indigo-600">data/error-archive.json</span>
                  </h4>
                  <button onClick={() => setShowArchive(false)} className="p-1 rounded hover:bg-indigo-100">
                    <X className="w-4 h-4 text-indigo-600" />
                  </button>
                </div>
                {errorArchive && errorArchive.length > 0 ? (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {errorArchive.map((batch: any, bi: number) => (
                      <details key={bi} className="bg-white rounded-lg border p-3">
                        <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
                          <span className="text-indigo-700">Batch #{bi + 1}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(batch.archivedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{batch.count} errors</span>
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          {batch.reports.map((r: any, ri: number) => (
                            <div key={ri} className="text-xs border rounded-lg p-2 bg-gray-50">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{r.type?.replace(/_/g, " ")}</span>
                                <span className="text-muted-foreground">×{r.occurrences}</span>
                              </div>
                              <p className="font-medium text-foreground truncate">{r.message}</p>
                              {r.url && <p className="text-muted-foreground truncate">{r.url}</p>}
                              <div className="flex gap-3 mt-1 text-muted-foreground">
                                <span>First: {new Date(r.firstSeen).toLocaleDateString()}</span>
                                <span>Last: {new Date(r.lastSeen).toLocaleDateString()}</span>
                              </div>
                              {r.adminNotes && <p className="mt-1 text-blue-700 bg-blue-50 rounded px-2 py-1">Note: {r.adminNotes}</p>}
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-indigo-600 text-center py-4">No archived errors yet. Resolve errors and click "Archive Resolved" to move them here.</p>
                )}
              </div>
            )}

            {errorReports && errorReports.length > 0 ? (
              <div className="space-y-3">
                {errorReports.map((report: any) => (
                  <ErrorReportCard
                    key={report.id}
                    report={report}
                    onUpdateStatus={(status: string) => updateErrorMutation.mutate({ id: report.id, status })}
                    onResolve={() => updateErrorMutation.mutate({ id: report.id, resolved: !report.resolved, status: report.resolved ? "new" : "resolved" })}
                    onDelete={() => deleteErrorMutation.mutate(report.id)}
                    onAddNote={(note: string) => updateErrorMutation.mutate({ id: report.id, adminNotes: note })}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No errors reported</h3>
                <p className="text-sm text-muted-foreground">The application is running smoothly.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-4" data-testid="section-audit">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-card rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold" data-testid="text-total-events">{auditStats?.totalEvents || 0}</div>
                <div className="text-xs text-muted-foreground">Total Events</div>
              </div>
              <div className="bg-card rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-red-600" data-testid="text-total-failures">{auditStats?.totalFailures || 0}</div>
                <div className="text-xs text-muted-foreground">Failures</div>
              </div>
              <div className="bg-card rounded-xl border p-4 text-center">
                <div className="text-2xl font-bold text-green-600" data-testid="text-success-rate">
                  {auditStats?.totalEvents ? Math.round(((auditStats.totalEvents - auditStats.totalFailures) / auditStats.totalEvents) * 100) : 100}%
                </div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium">Filter:</label>
              <select
                value={auditEventType}
                onChange={e => setAuditEventType(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm"
                data-testid="select-audit-filter"
              >
                <option value="all">All Events</option>
                <option value="auth_login_success">Login Success</option>
                <option value="auth_login_failure">Login Failure</option>
                <option value="auth_register_success">Register</option>
                <option value="onboarding_completed">Onboarding</option>
                <option value="mode_switched">Mode Switch</option>
                <option value="swipe_interest_created">Swipe Interest</option>
                <option value="buyer_interest_upserted">Buyer Interest</option>
                <option value="conversation_created">Conversation Created</option>
                <option value="message_sent">Message Sent</option>
                <option value="showing_request_created">Showing Created</option>
                <option value="showing_status_changed">Showing Status</option>
                <option value="coordination_thread_created">Coordination Thread</option>
                <option value="reverse_offer_created">Reverse Offer</option>
                <option value="buyer_offer_response">Offer Response</option>
                <option value="authorization_denied">Auth Denied</option>
              </select>
            </div>

            {auditEvents && auditEvents.length > 0 ? (
              <div className="space-y-2">
                {auditEvents.map((evt: any) => (
                  <div key={evt.id} className={`bg-card rounded-xl border p-3 text-sm ${evt.outcome === "failure" ? "border-red-200 bg-red-50/50" : ""}`} data-testid={`audit-event-${evt.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-medium text-xs">{evt.eventType}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${evt.outcome === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {evt.outcome}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{new Date(evt.createdAt).toLocaleString()}</span>
                      {evt.actorUserId && <span>User: {evt.actorUserId.substring(0, 8)}...</span>}
                      {evt.requestId && <span>Req: {evt.requestId.substring(0, 8)}...</span>}
                      {evt.propertyId && <span>Property: #{evt.propertyId}</span>}
                      {evt.conversationId && <span>Convo: #{evt.conversationId}</span>}
                    </div>
                    {evt.metadata && (
                      <div className="mt-1 text-xs font-mono text-muted-foreground bg-muted/30 rounded p-1 overflow-x-auto">
                        {JSON.stringify(evt.metadata)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-12 text-center">
                <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No audit events yet</h3>
                <p className="text-sm text-muted-foreground">Events will appear here as users interact with the platform.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "tours" && (
          <AdminToursEditor />
        )}

        {activeTab === "vendors" && <VendorsAdminPanel />}
        {activeTab === "partners" && <PartnersAdminPanel />}
      </div>
    </div>
  );
}

function VendorsAdminPanel() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const { data, isLoading } = useQuery<{ vendors: any[] }>({
    queryKey: ["/api/admin/vendors", statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/api/admin/vendors?status=${statusFilter}` : "/api/admin/vendors";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load vendors");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/admin/vendors/${id}/approve`, {}),
    onSuccess: () => {
      toast({ title: "Vendor approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
    },
    onError: (err: any) => toast({ title: "Approval failed", description: err?.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => apiRequest("PATCH", `/api/admin/vendors/${id}/reject`, { reason }),
    onSuccess: () => {
      toast({ title: "Vendor rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendors"] });
    },
    onError: (err: any) => toast({ title: "Rejection failed", description: err?.message, variant: "destructive" }),
  });

  const vendors = data?.vendors || [];

  return (
    <div className="space-y-4" data-testid="admin-vendors-panel">
      <div className="flex flex-wrap items-center gap-2">
        {["pending", "approved", "rejected", ""].map(s => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${statusFilter === s ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground"}`}
            data-testid={`button-vendor-status-${s || "all"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : vendors.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center text-muted-foreground">No vendors</div>
      ) : (
        <div className="space-y-3">
          {vendors.map(v => (
            <div key={v.id} className="bg-white border border-border rounded-xl p-4" data-testid={`admin-vendor-${v.id}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-3 min-w-0">
                  {v.logoUrl && <img src={v.logoUrl} alt="" className="w-12 h-12 rounded-lg object-contain border border-border" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold truncate">{v.businessName}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">{v.category}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {v.contactName} · {v.email} {v.phone ? `· ${v.phone}` : ""}
                    </div>
                  </div>
                </div>
                {v.status === "pending" && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => approveMutation.mutate(v.id)}
                      disabled={approveMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold disabled:opacity-50"
                      data-testid={`button-approve-vendor-${v.id}`}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt("Rejection reason (optional)") || "";
                        rejectMutation.mutate({ id: v.id, reason });
                      }}
                      disabled={rejectMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
                      data-testid={`button-reject-vendor-${v.id}`}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
              {v.description && <p className="text-sm text-muted-foreground mb-2">{v.description}</p>}
              {v.serviceAreaNeighborhoods?.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <strong>Service area:</strong> {v.serviceAreaNeighborhoods.join(", ")}
                </div>
              )}
              {v.applicationNotes && (
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded-lg">
                  <strong>Notes:</strong> {v.applicationNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PartnersAdminPanel() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("new");
  const { data, isLoading } = useQuery<{ inquiries: any[] }>({
    queryKey: ["/api/admin/partner-inquiries", statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/api/admin/partner-inquiries?status=${statusFilter}` : "/api/admin/partner-inquiries";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load inquiries");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status?: string; adminNotes?: string }) =>
      apiRequest("PATCH", `/api/admin/partner-inquiries/${id}`, { status, adminNotes }),
    onSuccess: () => {
      toast({ title: "Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-inquiries"] });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
  });

  const inquiries = data?.inquiries || [];

  return (
    <div className="space-y-4" data-testid="admin-partners-panel">
      <div className="flex flex-wrap items-center gap-2">
        {["new", "contacted", "approved", "rejected", ""].map(s => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${statusFilter === s ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground"}`}
            data-testid={`button-partner-status-${s || "all"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : inquiries.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center text-muted-foreground">No inquiries</div>
      ) : (
        <div className="space-y-3">
          {inquiries.map(q => (
            <div key={q.id} className="bg-white border border-border rounded-xl p-4" data-testid={`admin-partner-${q.id}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold truncate">{q.businessName}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground capitalize">{q.partnerType}</span>
                    <StatusBadge status={q.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {q.contactName} · {q.email} {q.phone ? `· ${q.phone}` : ""} {q.website ? `· ${q.website}` : ""}
                  </div>
                </div>
                <select
                  value={q.status}
                  onChange={e => updateMutation.mutate({ id: q.id, status: e.target.value })}
                  className="text-xs border border-border rounded-lg px-2 py-1 bg-white"
                  data-testid={`select-partner-status-${q.id}`}
                >
                  <option value="new">new</option>
                  <option value="contacted">contacted</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
              {q.message && <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">{q.message}</p>}
              <div className="text-xs text-muted-foreground space-y-0.5">
                {q.nmls && <div><strong>NMLS:</strong> {q.nmls}</div>}
                {q.agentCount && <div><strong>Agents:</strong> {q.agentCount}</div>}
                {q.mlsAffiliation && <div><strong>MLS:</strong> {q.mlsAffiliation}</div>}
                {q.apiUseCase && <div><strong>Use case:</strong> {q.apiUseCase}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
