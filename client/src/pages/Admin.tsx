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
  User, ExternalLink, UserCog, Ban, Trash2, Edit3, Save,
  Activity, Crown, ShieldCheck, UserX, MoreVertical,
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

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"pitches" | "leads" | "overview" | "referrals" | "buyers" | "users">("overview");

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
          {(["overview", "users", "pitches", "leads", "buyers", "referrals"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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
