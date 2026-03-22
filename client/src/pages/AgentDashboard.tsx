import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useProperties, useCreateProperty, useUpdateProperty, useDeleteProperty } from "@/hooks/use-properties";
import { Plus, Edit3, Trash2, Home, X, Search, Camera, ImageOff, CheckCircle2, Link, Users, CalendarDays, ChevronDown, ChevronUp, Heart, BookmarkCheck, ShieldCheck, Radar, Send, Eye, ContactRound, MessageSquare } from "lucide-react";
import { ReverseOfferForm } from "@/components/ReverseOfferForm";
import { IdxSyncPanel } from "@/components/IdxSyncPanel";
import type { PropertyResponse, CreatePropertyRequest } from "@shared/schema";
import { Autocomplete } from "@react-google-maps/api";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { useAgentClients, useClientFavorites, useClientSearches, useOpenHouses } from "@/hooks/use-client-dashboard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BeaconTab } from "@/components/BeaconReport";
import { OpenHouseRoutePlanner } from "@/components/OpenHouseRoutePlanner";
import { AgentContactsSection } from "@/components/AgentContacts";

type AgentTab = "listings" | "clients" | "contacts" | "openhouses" | "beacon" | "idx" | "buyerinterest";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function buildStreetViewUrl(lat: number, lng: number, size = "800x500"): string {
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&fov=90&pitch=5&key=${MAPS_KEY}`;
}

export default function AgentDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { data: propertiesData, isLoading } = useProperties({ limit: 200 });
  const properties = propertiesData?.properties || [];
  const { mutate: createProperty, isPending: isCreating } = useCreateProperty();
  const { mutate: updateProperty, isPending: isUpdating } = useUpdateProperty();
  const { mutate: deleteProperty } = useDeleteProperty();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyResponse | null>(null);
  const [activeTab, setActiveTab] = useState<AgentTab>("listings");

  const myProperties = properties.filter(p => p.agentId === user?.id) || properties;

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold mb-4">Agent Portal Access Required</h1>
        <a href="/api/login" className="bg-primary text-white px-6 py-2 rounded-full font-bold">Log In</a>
      </div>
    );
  }

  const openNew = () => {
    setEditingProperty(null);
    setIsModalOpen(true);
  };

  const openEdit = (p: PropertyResponse) => {
    setEditingProperty(p);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this listing?")) {
      deleteProperty(id);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Agent Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage listings, clients, and open houses.</p>
          </div>
          {activeTab === "listings" && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-xl font-bold hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95"
              data-testid="button-add-listing"
            >
              <Plus className="w-5 h-5" />
              Add Listing
            </button>
          )}
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">
          {([
            { id: "listings",   label: "My Listings",  icon: Home },
            { id: "clients",    label: "Clients",       icon: Users },
            { id: "contacts",   label: "Contacts",      icon: ContactRound },
            { id: "openhouses", label: "Open Houses",   icon: CalendarDays },
            { id: "beacon",     label: "Beacon",        icon: Radar },
            { id: "buyerinterest", label: "Buyer Interest", icon: Heart },
            { id: "idx",        label: "MLS Sync",      icon: Search },
          ] as { id: AgentTab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all -mb-px ${
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${id}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Listings Tab */}
        {activeTab === "listings" && (
          isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-16 bg-muted rounded-xl" />
              <div className="h-16 bg-muted rounded-xl" />
            </div>
          ) : myProperties.length === 0 ? (
            <div className="text-center py-20 bg-card border border-border rounded-3xl">
              <Home className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <h3 className="font-display font-bold text-xl mb-2">No active listings</h3>
              <p className="text-muted-foreground mb-6">Create your first listing to start reaching buyers.</p>
              <button onClick={openNew} className="text-primary font-bold hover:underline">Create Listing</button>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="p-4 font-bold text-muted-foreground text-sm uppercase tracking-wider">Property</th>
                    <th className="p-4 font-bold text-muted-foreground text-sm uppercase tracking-wider">Price</th>
                    <th className="p-4 font-bold text-muted-foreground text-sm uppercase tracking-wider">Status</th>
                    <th className="p-4 font-bold text-muted-foreground text-sm uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myProperties.map(property => (
                    <tr key={property.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-property-${property.id}`}>
                      <td className="p-4 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {property.imageUrl
                            ? <img src={property.imageUrl} className="w-full h-full object-cover" alt={property.title} />
                            : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-5 h-5 text-muted-foreground/40" /></div>
                          }
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{property.title}</div>
                          <div className="text-sm text-muted-foreground">{property.location}</div>
                          {(property as any).openHouseDate && new Date((property as any).openHouseDate) > new Date() && (
                            <div className="flex items-center gap-1 mt-0.5 text-green-600 text-xs font-bold">
                              <CalendarDays className="w-3 h-3" />
                              Open House {new Date((property as any).openHouseDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-foreground">${property.price.toLocaleString()}</td>
                      <td className="p-4">
                        {property.isOffMarket ? (
                          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">Buy it Now</span>
                        ) : (
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">Active</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => openEdit(property)} className="p-2 text-muted-foreground hover:text-primary transition-colors" data-testid={`button-edit-${property.id}`} aria-label={`Edit listing ${property.title}`}>
                          <Edit3 className="w-5 h-5" aria-hidden="true" />
                        </button>
                        <button onClick={() => handleDelete(property.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors ml-2" data-testid={`button-delete-${property.id}`} aria-label={`Delete listing ${property.title}`}>
                          <Trash2 className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Clients Tab */}
        {activeTab === "clients" && <AgentClientsSection />}

        {/* Contacts CRM Tab */}
        {activeTab === "contacts" && <AgentContactsSection />}

        {/* Open Houses Tab */}
        {activeTab === "openhouses" && <AgentOpenHousesSection agentProperties={myProperties} />}

        {/* MLS / IDX Sync Tab */}
        {activeTab === "beacon" && <BeaconTab />}

        {activeTab === "buyerinterest" && <BuyerInterestSection />}

        {activeTab === "idx" && (
          <div>
            <IdxSyncPanel />
          </div>
        )}
      </div>

      {isModalOpen && (
        <PropertyFormModal
          property={editingProperty}
          onClose={() => setIsModalOpen(false)}
          onSubmit={(data) => {
            if (editingProperty) {
              updateProperty({ id: editingProperty.id, ...data }, { onSuccess: () => setIsModalOpen(false) });
            } else {
              createProperty(data, { onSuccess: () => setIsModalOpen(false) });
            }
          }}
          isPending={isCreating || isUpdating}
        />
      )}
    </div>
  );
}

// ── Buyer Interest Section ────────────────────────────────────────────────────

function BuyerInterestSection() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: interests = [], isLoading: interestLoading } = useQuery<any[]>({
    queryKey: ["/api/buyer-interest/agent"],
  });
  const { data: conversations = [] } = useQuery<any[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000,
  });
  const { data: showingRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/showing-requests"],
    refetchInterval: 30000,
  });
  const { data: offers = [] } = useQuery<any[]>({
    queryKey: ["/api/property-offers/agent"],
  });

  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const [subTab, setSubTab] = useState<"leads" | "conversations" | "showings">("leads");

  const getLeadStatus = (interest: any) => {
    const hasConvo = conversations.some((c: any) => c.propertyId === interest.propertyId && c.buyerUserId === interest.buyerUserId);
    const hasOffer = offers.some((o: any) => o.propertyId === interest.propertyId && o.buyerUserId === interest.buyerUserId);
    const hasShowing = showingRequests.some((s: any) => s.propertyId === interest.propertyId && s.buyerUserId === interest.buyerUserId);
    if (hasOffer) return "offer_created";
    if (hasShowing) return "showing_requested";
    if (hasConvo) return "in_conversation";
    return interest.source || "swipe_right";
  };

  const getConvoForLead = (interest: any) => {
    return conversations.find((c: any) => c.propertyId === interest.propertyId && c.buyerUserId === interest.buyerUserId);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      offer_created: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", label: "Offer Sent" },
      showing_requested: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300", label: "Showing" },
      in_conversation: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", label: "Chatting" },
      inquiry: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", label: "Inquiry" },
      swipe_right: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-800 dark:text-pink-300", label: "Swiped" },
      swipe: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-800 dark:text-pink-300", label: "Swiped" },
      showing_request: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300", label: "Showing" },
    };
    const s = map[status] || map.swipe_right;
    return <span className={`${s.bg} ${s.text} px-3 py-1 rounded-full text-xs font-bold`}>{s.label}</span>;
  };

  return (
    <div className="space-y-4" data-testid="section-buyer-interest">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Leads & Messages</h2>
          <p className="text-sm text-muted-foreground">Buyer interest, conversations, and showing requests</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {(["leads", "conversations", "showings"] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${subTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            data-testid={`tab-${t}`}
          >
            {t === "leads" ? `Leads (${interests.length})` : t === "conversations" ? `Messages (${conversations.length})` : `Showings (${showingRequests.length})`}
          </button>
        ))}
      </div>

      {subTab === "leads" && (
        <>
          {interestLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : interests.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-3xl">
              <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-7 h-7 text-muted-foreground opacity-40" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2" data-testid="text-no-interest">No buyer interest yet</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                When buyers express interest in your listings, leads will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {interests.map((interest: any) => {
                const status = getLeadStatus(interest);
                const property = interest.property;
                const buyer = interest.buyer;
                const convo = getConvoForLead(interest);

                return (
                  <div
                    key={interest.id}
                    className="bg-card border border-border rounded-2xl p-5 shadow-sm"
                    data-testid={`card-buyer-interest-${interest.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                        {property?.imageUrl ? (
                          <img src={property.imageUrl} alt={property.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-5 h-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <h3 className="font-bold text-foreground text-base">{property?.title || "Property"}</h3>
                            <p className="text-sm font-semibold text-foreground">${property?.price?.toLocaleString()}</p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                              {property?.beds != null && <span>{property.beds} beds</span>}
                              {property?.baths != null && <span>{property.baths} baths</span>}
                              {property?.sqft != null && <span>{property.sqft.toLocaleString()} sqft</span>}
                            </div>
                          </div>
                          {statusBadge(status)}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Eye className="w-4 h-4" />
                            <span>{buyer?.firstName ? `${buyer.firstName} ${buyer.lastName || ""}`.trim() : "Buyer"}</span>
                            <span className="text-xs">·</span>
                            <span className="text-xs">{new Date(interest.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {convo ? (
                              <button
                                onClick={() => navigate(`/conversations/${convo.id}`)}
                                className="flex items-center gap-1.5 bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold border border-border"
                                data-testid={`button-open-convo-${interest.id}`}
                              >
                                <Users className="w-3.5 h-3.5" />
                                Open Chat
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await apiRequest("POST", "/api/conversations", {
                                      propertyId: interest.propertyId,
                                      buyerUserId: interest.buyerUserId,
                                    });
                                    const data = await res.json();
                                    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/buyer-interest/agent"] });
                                    navigate(`/conversations/${data.id}`);
                                  } catch (err) {
                                    console.error("Failed to create conversation:", err);
                                  }
                                }}
                                className="flex items-center gap-1.5 bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold border border-border"
                                data-testid={`button-message-lead-${interest.id}`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Message
                              </button>
                            )}
                            {property?.agentId && property.agentId !== user?.id && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await apiRequest("POST", "/api/conversations", {
                                    propertyId: interest.propertyId,
                                    buyerUserId: interest.buyerUserId,
                                    conversationType: "agent_coordination",
                                  });
                                  const data = await res.json();
                                  queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                                  navigate(`/conversations/${data.id}`);
                                } catch (err) {
                                  console.error("Failed to create coordination thread:", err);
                                }
                              }}
                              className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-200 dark:border-amber-800"
                              data-testid={`button-contact-listing-agent-${interest.id}`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              Contact Listing Agent
                            </button>
                            )}
                            {status !== "offer_created" && (
                              <button
                                onClick={() => setSelectedNotification(interest)}
                                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 shadow-sm"
                                data-testid={`button-send-offer-${interest.id}`}
                              >
                                <Send className="w-3.5 h-3.5" />
                                Send Offer
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {subTab === "conversations" && (
        <ConversationsList conversations={conversations} navigate={navigate} user={user} />
      )}

      {subTab === "showings" && (
        <ShowingsList showings={showingRequests} navigate={navigate} />
      )}

      {selectedNotification && (
        <ReverseOfferForm
          propertyId={selectedNotification.propertyId}
          buyerUserId={selectedNotification.buyerUserId}
          propertyPrice={selectedNotification.property?.price || 0}
          propertyTitle={selectedNotification.property?.title || "Property"}
          swipeNotificationId={selectedNotification.id}
          buyerName={selectedNotification.buyer?.firstName}
          onClose={() => setSelectedNotification(null)}
          onSuccess={() => setSelectedNotification(null)}
        />
      )}
    </div>
  );
}

function ConversationsList({ conversations, navigate, user }: { conversations: any[]; navigate: (to: string) => void; user: any }) {
  const [convoFilter, setConvoFilter] = useState<"all" | "buyer" | "agent_coordination">("all");
  const buyerThreads = conversations.filter((c: any) => c.type === "buyer");
  const coordThreads = conversations.filter((c: any) => c.type === "agent_coordination");
  const filtered = convoFilter === "all" ? conversations : conversations.filter((c: any) => c.type === convoFilter);
  const buyerUnread = buyerThreads.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
  const coordUnread = coordThreads.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);

  if (conversations.length === 0) {
    return (
      <div className="text-center py-16 bg-card border border-border rounded-3xl">
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-7 h-7 text-muted-foreground opacity-40" />
        </div>
        <h3 className="font-display font-bold text-xl mb-2">No conversations yet</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          When buyers message you, conversations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setConvoFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${convoFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          data-testid="filter-convos-all"
        >
          All ({conversations.length})
        </button>
        <button
          onClick={() => setConvoFilter("buyer")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1 ${convoFilter === "buyer" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          data-testid="filter-convos-buyer"
        >
          Buyer Threads ({buyerThreads.length})
          {buyerUnread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{buyerUnread}</span>}
        </button>
        <button
          onClick={() => setConvoFilter("agent_coordination")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1 ${convoFilter === "agent_coordination" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          data-testid="filter-convos-coordination"
        >
          Agent Coordination ({coordThreads.length})
          {coordUnread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{coordUnread}</span>}
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No conversations in this category</div>
      ) : (
        filtered.map((convo: any) => {
          const isCoord = convo.type === "agent_coordination";
          const otherPartyName = isCoord
            ? (convo.agentUserId === user?.id ? (convo.buyer?.firstName || "Agent") : (convo.agent?.firstName || "Listing Agent"))
            : (convo.buyer?.firstName || "Buyer");
          return (
            <button
              key={convo.id}
              onClick={() => navigate(`/conversations/${convo.id}`)}
              className="w-full text-left bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-primary/30 transition-colors"
              data-testid={`card-conversation-${convo.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                  {convo.property?.imageUrl ? (
                    <img src={convo.property.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Home className="w-5 h-5 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="font-bold text-sm truncate">{convo.property?.title || "Property"}</h4>
                      {isCoord && (
                        <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">Agent-to-Agent</span>
                      )}
                    </div>
                    {convo.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold ml-2">{convo.unreadCount}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {otherPartyName} · {convo.lastMessage?.content?.substring(0, 60) || "No messages"}
                  </p>
                </div>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

function ShowingsList({ showings, navigate }: { showings: any[]; navigate: (to: string) => void }) {
  if (showings.length === 0) {
    return (
      <div className="text-center py-16 bg-card border border-border rounded-3xl">
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <CalendarDays className="w-7 h-7 text-muted-foreground opacity-40" />
        </div>
        <h3 className="font-display font-bold text-xl mb-2">No showing requests</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Showing requests from buyers will appear here.
        </p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    requested: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    under_review: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
    sent_to_listing_agent: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
    confirmed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    alternate_proposed: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
    declined: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    completed: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    cancelled: "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300",
  };

  return (
    <div className="space-y-3">
      {showings.map((showing: any) => (
        <div
          key={showing.id}
          className="bg-card border border-border rounded-2xl p-4 shadow-sm"
          data-testid={`card-showing-${showing.id}`}
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden flex-shrink-0">
              {showing.property?.imageUrl ? (
                <img src={showing.property.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Home className="w-5 h-5 text-muted-foreground/40" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-sm truncate">{showing.property?.title || "Property"}</h4>
                <span className={`${statusColors[showing.status] || statusColors.requested} px-2.5 py-0.5 rounded-full text-xs font-bold`}>
                  {(showing.status || "requested").replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {showing.buyer?.firstName || "Buyer"} · Dates: {(showing.requestedDates || []).join(", ")}
              </p>
              {showing.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate italic">"{showing.notes}"</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Agent Clients Section ──────────────────────────────────────────────────────

function AgentClientsSection() {
  const { data: clients = [], isLoading } = useAgentClients();
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      <AgentBuyerClientsSection />

      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">Linked Clients</h2>
            <p className="text-sm text-muted-foreground">Clients who have invited you from their dashboard to view their activity</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-3xl">
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-muted-foreground opacity-40" />
            </div>
            <h3 className="font-display font-bold text-xl mb-2">No linked clients yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              When clients invite you from their dashboard using your email, they'll appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((c: any) => (
              <ClientCard
                key={c.clientId}
                client={c}
                expanded={expandedClient === c.clientId}
                onToggle={() => setExpandedClient(expandedClient === c.clientId ? null : c.clientId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentBuyerClientsSection() {
  const { data: buyerClients = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/agent/buyer-clients"] });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/agent/buyer-clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/buyer-clients"] });
      setShowForm(false);
      toast({ title: "Buyer client added", description: "Their profile is now visible on the Buy page." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/agent/buyer-clients/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/buyer-clients"] });
      setEditingId(null);
      toast({ title: "Client updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/agent/buyer-clients/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/buyer-clients"] });
      toast({ title: "Client removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Buyer Clients</h2>
          <p className="text-sm text-muted-foreground">Add your buyer clients to connect them with matching sellers</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="flex items-center gap-2 bg-foreground text-background px-5 py-2.5 rounded-xl font-bold hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95 text-sm"
            data-testid="button-add-buyer-client"
          >
            <Plus className="w-4 h-4" />
            Add Buyer Client
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Your client's information is private</p>
          <p className="text-blue-700">Contact details (name, email, phone) are never shown publicly. When a seller pitches a property to your buyer, the seller's information is routed through xucasa and delivered directly to you — so you stay in the loop on every opportunity.</p>
        </div>
      </div>

      {showForm && (
        <BuyerClientForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
          isPending={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : buyerClients.length === 0 && !showForm ? (
        <div className="text-center py-12 bg-card border border-border rounded-3xl">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-primary opacity-60" />
          </div>
          <h3 className="font-display font-bold text-xl mb-2">No buyer clients yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
            Add your pre-approved buyers here. Their profile will appear on the Buy page so sellers can pitch matching properties — all inquiries come through you.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="text-primary font-bold hover:underline"
            data-testid="button-add-first-buyer"
          >
            Add Your First Buyer Client
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {buyerClients.map((bp: any) => (
            editingId === bp.id ? (
              <BuyerClientForm
                key={bp.id}
                initialData={bp}
                onSubmit={(data) => updateMutation.mutate({ id: bp.id, data })}
                onCancel={() => setEditingId(null)}
                isPending={updateMutation.isPending}
              />
            ) : (
              <div key={bp.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm" data-testid={`card-buyer-client-${bp.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{bp.displayName}</h3>
                    <p className="text-sm text-muted-foreground">
                      Budget: <span className="font-semibold text-foreground">${bp.preApprovalAmount?.toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingId(bp.id)} className="p-2 text-muted-foreground hover:text-primary transition-colors" data-testid={`button-edit-buyer-${bp.id}`}>
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm("Remove this buyer client?")) deleteMutation.mutate(bp.id); }} className="p-2 text-muted-foreground hover:text-destructive transition-colors" data-testid={`button-delete-buyer-${bp.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {bp.minBeds && <span className="bg-muted px-2 py-1 rounded-lg font-medium">{bp.minBeds}+ beds</span>}
                  {bp.minBaths && <span className="bg-muted px-2 py-1 rounded-lg font-medium">{bp.minBaths}+ baths</span>}
                  {bp.minSqft && <span className="bg-muted px-2 py-1 rounded-lg font-medium">{bp.minSqft?.toLocaleString()}+ sqft</span>}
                  {bp.preferredCities?.map((c: string) => <span key={c} className="bg-primary/10 text-primary px-2 py-1 rounded-lg font-medium">{c}</span>)}
                  {bp.homeTypes?.map((t: string) => <span key={t} className="bg-muted px-2 py-1 rounded-lg font-medium">{t}</span>)}
                  {bp.moveInTimeline && <span className="bg-muted px-2 py-1 rounded-lg font-medium">{bp.moveInTimeline}</span>}
                </div>
                {bp.clientName && (
                  <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                    <span className="font-medium">Private contact:</span> {bp.clientName}{bp.clientEmail ? ` · ${bp.clientEmail}` : ""}{bp.clientPhone ? ` · ${bp.clientPhone}` : ""}
                  </div>
                )}
                {bp.bio && <p className="mt-2 text-sm text-muted-foreground">{bp.bio}</p>}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

const HOME_TYPES = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Land", "Mobile Home"];
const TIMELINES = ["ASAP", "1-3 months", "3-6 months", "6-12 months", "12+ months"];

function BuyerClientForm({ initialData, onSubmit, onCancel, isPending }: {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    displayName: initialData?.displayName || "",
    clientName: initialData?.clientName || "",
    clientEmail: initialData?.clientEmail || "",
    clientPhone: initialData?.clientPhone || "",
    preApprovalAmount: initialData?.preApprovalAmount?.toString() || "",
    minBeds: initialData?.minBeds?.toString() || "",
    maxBeds: initialData?.maxBeds?.toString() || "",
    minBaths: initialData?.minBaths?.toString() || "",
    minSqft: initialData?.minSqft?.toString() || "",
    maxSqft: initialData?.maxSqft?.toString() || "",
    minLotSize: initialData?.minLotSize?.toString() || "",
    preferredCities: initialData?.preferredCities?.join(", ") || "",
    homeTypes: (initialData?.homeTypes || []) as string[],
    mustHaves: initialData?.mustHaves?.join(", ") || "",
    niceToHaves: initialData?.niceToHaves?.join(", ") || "",
    dealBreakers: initialData?.dealBreakers?.join(", ") || "",
    moveInTimeline: initialData?.moveInTimeline || "",
    bio: initialData?.bio || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim() || !form.preApprovalAmount) return;
    const splitList = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
    onSubmit({
      displayName: form.displayName.trim(),
      clientName: form.clientName.trim() || null,
      clientEmail: form.clientEmail.trim() || null,
      clientPhone: form.clientPhone.trim() || null,
      preApprovalAmount: parseInt(form.preApprovalAmount),
      minBeds: form.minBeds ? parseInt(form.minBeds) : null,
      maxBeds: form.maxBeds ? parseInt(form.maxBeds) : null,
      minBaths: form.minBaths || null,
      minSqft: form.minSqft ? parseInt(form.minSqft) : null,
      maxSqft: form.maxSqft ? parseInt(form.maxSqft) : null,
      minLotSize: form.minLotSize ? parseInt(form.minLotSize) : null,
      preferredCities: splitList(form.preferredCities),
      homeTypes: form.homeTypes,
      mustHaves: splitList(form.mustHaves),
      niceToHaves: splitList(form.niceToHaves),
      dealBreakers: splitList(form.dealBreakers),
      moveInTimeline: form.moveInTimeline || null,
      bio: form.bio.trim() || null,
    });
  };

  const toggleHomeType = (t: string) => {
    setForm(f => ({
      ...f,
      homeTypes: f.homeTypes.includes(t) ? f.homeTypes.filter(x => x !== t) : [...f.homeTypes, t],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5" data-testid="form-buyer-client">
      <h3 className="font-display font-bold text-lg text-foreground">{initialData ? "Edit Buyer Client" : "Add Buyer Client"}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">Display Name *</label>
          <input
            value={form.displayName}
            onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
            placeholder="How they appear on the Buy page"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
            required
            data-testid="input-display-name"
          />
          <p className="text-xs text-muted-foreground mt-1">This is the only name shown publicly</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">Budget (Pre-Approval) *</label>
          <input
            type="number"
            value={form.preApprovalAmount}
            onChange={e => setForm(f => ({ ...f, preApprovalAmount: e.target.value }))}
            placeholder="e.g. 500000"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
            required
            data-testid="input-budget"
          />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-800 mb-2">Private Client Contact (never shown publicly)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={form.clientName}
            onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
            placeholder="Client's real name"
            className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-foreground text-sm outline-none focus:ring-2 focus:ring-amber-300"
            data-testid="input-client-name"
          />
          <input
            type="email"
            value={form.clientEmail}
            onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
            placeholder="Client's email"
            className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-foreground text-sm outline-none focus:ring-2 focus:ring-amber-300"
            data-testid="input-client-email"
          />
          <input
            type="tel"
            value={form.clientPhone}
            onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))}
            placeholder="Client's phone"
            className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-foreground text-sm outline-none focus:ring-2 focus:ring-amber-300"
            data-testid="input-client-phone"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Min Beds</label>
          <input type="number" value={form.minBeds} onChange={e => setForm(f => ({ ...f, minBeds: e.target.value }))} placeholder="—" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-min-beds" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Max Beds</label>
          <input type="number" value={form.maxBeds} onChange={e => setForm(f => ({ ...f, maxBeds: e.target.value }))} placeholder="—" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-max-beds" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Min Baths</label>
          <input type="number" step="0.5" value={form.minBaths} onChange={e => setForm(f => ({ ...f, minBaths: e.target.value }))} placeholder="—" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-min-baths" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Min Sqft</label>
          <input type="number" value={form.minSqft} onChange={e => setForm(f => ({ ...f, minSqft: e.target.value }))} placeholder="—" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-min-sqft" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-2">Home Types</label>
        <div className="flex flex-wrap gap-2">
          {HOME_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => toggleHomeType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${form.homeTypes.includes(t) ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              data-testid={`toggle-type-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Preferred Cities (comma-separated)</label>
        <input value={form.preferredCities} onChange={e => setForm(f => ({ ...f, preferredCities: e.target.value }))} placeholder="e.g. Austin, Dallas, San Antonio" className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-cities" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-2">Move-in Timeline</label>
        <div className="flex flex-wrap gap-2">
          {TIMELINES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(f => ({ ...f, moveInTimeline: f.moveInTimeline === t ? "" : t }))}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${form.moveInTimeline === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              data-testid={`toggle-timeline-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Must-Haves</label>
          <input value={form.mustHaves} onChange={e => setForm(f => ({ ...f, mustHaves: e.target.value }))} placeholder="Pool, Garage, etc." className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-must-haves" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Nice-to-Haves</label>
          <input value={form.niceToHaves} onChange={e => setForm(f => ({ ...f, niceToHaves: e.target.value }))} placeholder="View, Patio, etc." className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-nice-haves" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Deal-Breakers</label>
          <input value={form.dealBreakers} onChange={e => setForm(f => ({ ...f, dealBreakers: e.target.value }))} placeholder="HOA, Flood zone, etc." className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30" data-testid="input-deal-breakers" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">Bio / Notes</label>
        <textarea
          value={form.bio}
          onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
          placeholder="Brief description of what your client is looking for..."
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          data-testid="input-bio"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || !form.displayName.trim() || !form.preApprovalAmount}
          className="bg-foreground text-background px-6 py-2.5 rounded-xl font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50 text-sm"
          data-testid="button-submit-buyer-client"
        >
          {isPending ? "Saving..." : initialData ? "Update Client" : "Add Client"}
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:text-foreground transition-colors text-sm" data-testid="button-cancel-buyer-client">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ClientCard({ client, expanded, onToggle }: { client: any; expanded: boolean; onToggle: () => void }) {
  const { data: favorites = [], isLoading: favLoading } = useClientFavorites(expanded ? client.clientId : null);
  const { data: searches = [], isLoading: searchLoading } = useClientSearches(expanded ? client.clientId : null);

  const initials = [client.client?.firstName, client.client?.lastName]
    .filter(Boolean)
    .map((s: string) => s[0])
    .join("") || client.client?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors text-left"
        data-testid={`button-client-${client.clientId}`}
      >
        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground">
            {client.client?.firstName || client.client?.lastName
              ? `${client.client.firstName || ""} ${client.client.lastName || ""}`.trim()
              : client.client?.email}
          </p>
          <p className="text-sm text-muted-foreground truncate">{client.client?.email}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> favorites</span>
            <span className="flex items-center gap-1"><BookmarkCheck className="w-3.5 h-3.5" /> searches</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20">
          {/* Favorites */}
          <div className="p-4 border-b border-border">
            <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" /> Favorited Homes ({favorites.length})
            </h4>
            {favLoading ? (
              <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No favorites yet</p>
            ) : (
              <div className="space-y-2">
                {favorites.map((sp: any) => (
                  <div key={sp.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5">
                    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {sp.property?.imageUrl
                        ? <img src={sp.property.imageUrl} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center"><Home className="w-4 h-4 text-muted-foreground/40" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{sp.property?.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{sp.property?.location}</p>
                    </div>
                    <p className="font-bold text-sm text-foreground flex-shrink-0">
                      ${sp.property?.price?.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved Searches */}
          <div className="p-4">
            <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-blue-500" /> Saved Searches ({searches.length})
            </h4>
            {searchLoading ? (
              <div className="space-y-2">{[1].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : searches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved searches yet</p>
            ) : (
              <div className="space-y-2">
                {searches.map((s: any) => (
                  <div key={s.id} className="bg-card border border-border rounded-xl px-3 py-2.5">
                    <p className="font-bold text-sm text-foreground">{s.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(s.criteria || {}).map(([k, v]) => (
                        <span key={k} className="bg-primary/10 text-primary text-xs font-medium px-1.5 py-0.5 rounded">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent Open Houses Section ──────────────────────────────────────────────────

function AgentOpenHousesSection({ agentProperties }: { agentProperties: PropertyResponse[] }) {
  const { data: allOpenHouses = [], isLoading } = useOpenHouses();

  return (
    <div className="space-y-4">
      <div className="pb-4 border-b border-border">
        <h2 className="text-xl font-display font-bold text-foreground">Open Houses</h2>
        <p className="text-sm text-muted-foreground">Select open houses to plan a visiting route on Google Maps</p>
      </div>
      <OpenHouseRoutePlanner openHouses={allOpenHouses} isLoading={isLoading} variant="agent" />
    </div>
  );
}

function PropertyFormModal({
  property,
  onClose,
  onSubmit,
  isPending,
}: {
  property: PropertyResponse | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const { isLoaded } = useGoogleMaps();

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [formData, setFormData] = useState({
    title: property?.title || "",
    description: property?.description || "",
    price: property?.price?.toString() || "",
    addressStreetNumber: property?.addressStreetNumber || "",
    addressStreetName: property?.addressStreetName || "",
    addressUnitNumber: property?.addressUnitNumber || "",
    addressCity: property?.addressCity || "",
    addressState: property?.addressState || "",
    addressZip: property?.addressZip || "",
    location: property?.location || "",
    beds: property?.beds?.toString() || "",
    baths: property?.baths?.toString() || "",
    sqft: property?.sqft?.toString() || "",
    lotSize: property?.lotSize?.toString() || "",
    hoaFee: property?.hoaFee?.toString() || "",
    imageUrl: property?.imageUrl || "",
    isOffMarket: property?.isOffMarket || false,
    openHouseDate: (property as any)?.openHouseDate
      ? new Date((property as any).openHouseDate).toISOString().split("T")[0]
      : "",
    openHouseTime: (property as any)?.openHouseTime || "",
  });

  // Street View preview state
  const [streetViewUrl, setStreetViewUrl] = useState<string | null>(null);
  const [streetViewUsed, setStreetViewUsed] = useState(false);
  const [photoTab, setPhotoTab] = useState<"streetview" | "url">(property?.imageUrl ? "url" : "streetview");

  const onAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place.address_components) return;

    let streetNumber = "";
    let streetName = "";
    let city = "";
    let state = "";
    let zip = "";

    for (const comp of place.address_components) {
      const types = comp.types;
      if (types.includes("street_number")) streetNumber = comp.long_name;
      if (types.includes("route")) streetName = comp.long_name;
      if (types.includes("locality")) city = comp.long_name;
      if (types.includes("administrative_area_level_1")) state = comp.short_name;
      if (types.includes("postal_code")) zip = comp.long_name;
    }

    setFormData(prev => ({
      ...prev,
      addressStreetNumber: streetNumber,
      addressStreetName: streetName,
      addressCity: city,
      addressState: state,
      addressZip: zip,
      location: `${city}, ${state}`,
      title: prev.title || (place.name || ""),
    }));

    // Auto-generate Street View from geocoordinates
    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();
    if (lat && lng) {
      const svUrl = buildStreetViewUrl(lat, lng);
      setStreetViewUrl(svUrl);
      setStreetViewUsed(false);
      setPhotoTab("streetview");
    }
  };

  const handleUseStreetView = () => {
    if (streetViewUrl) {
      setFormData(prev => ({ ...prev, imageUrl: streetViewUrl }));
      setStreetViewUsed(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullLocation = formData.addressCity
      ? `${formData.addressCity}, ${formData.addressState}`
      : formData.location;
    onSubmit({
      title: formData.title,
      description: formData.description,
      price: Number(formData.price),
      addressStreetNumber: formData.addressStreetNumber || undefined,
      addressStreetName: formData.addressStreetName || undefined,
      addressUnitNumber: formData.addressUnitNumber || undefined,
      addressCity: formData.addressCity || undefined,
      addressState: formData.addressState || undefined,
      addressZip: formData.addressZip || undefined,
      location: fullLocation || formData.location,
      beds: Number(formData.beds),
      baths: formData.baths,
      sqft: Number(formData.sqft),
      lotSize: formData.lotSize ? Number(formData.lotSize) : undefined,
      hoaFee: formData.hoaFee ? Number(formData.hoaFee) : undefined,
      imageUrl: formData.imageUrl || undefined,
      isOffMarket: formData.isOffMarket,
      status: "active",
      openHouseDate: formData.openHouseDate || undefined,
      openHouseTime: formData.openHouseTime || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="property-form-modal-title" onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="bg-card rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10">
        <div className="sticky top-0 bg-card/90 backdrop-blur-md p-6 border-b border-border flex justify-between items-center">
          <h2 id="property-form-modal-title" className="text-2xl font-display font-bold">{property ? 'Edit Listing' : 'Create Listing'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors" aria-label="Close listing form"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Address Autocomplete */}
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-bold text-muted-foreground mb-2">Search Address</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10 pointer-events-none" />
                {isLoaded ? (
                  <Autocomplete
                    onLoad={onAutocompleteLoad}
                    onPlaceChanged={onPlaceChanged}
                    options={{ componentRestrictions: { country: "us" }, types: ["address"], fields: ["address_components", "geometry", "name", "formatted_address"] }}
                  >
                    <input
                      className="w-full bg-background border-2 border-border rounded-xl pl-12 pr-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      placeholder="Start typing an address..."
                      type="text"
                      data-testid="input-address-autocomplete"
                    />
                  </Autocomplete>
                ) : (
                  <input
                    className="w-full bg-background border-2 border-border rounded-xl pl-12 pr-4 py-3 outline-none"
                    placeholder="Loading address search..."
                    disabled
                  />
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-muted-foreground mb-2">Street #</label>
                <input required value={formData.addressStreetNumber} onChange={e => setFormData({ ...formData, addressStreetNumber: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="123" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-muted-foreground mb-2">Street Name</label>
                <input required value={formData.addressStreetName} onChange={e => setFormData({ ...formData, addressStreetName: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="Main St" />
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-2">Unit/Apt</label>
                <input value={formData.addressUnitNumber} onChange={e => setFormData({ ...formData, addressUnitNumber: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="4B" />
              </div>
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-2">City</label>
                <input required value={formData.addressCity} onChange={e => setFormData({ ...formData, addressCity: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="San Diego" />
              </div>
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-2">State</label>
                <input required value={formData.addressState} onChange={e => setFormData({ ...formData, addressState: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="CA" />
              </div>
              <div>
                <label className="block text-sm font-bold text-muted-foreground mb-2">Zip</label>
                <input required value={formData.addressZip} onChange={e => setFormData({ ...formData, addressZip: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="92117" />
              </div>
            </div>
          </div>

          {/* Photo Section */}
          <div className="border-t border-border pt-6">
            <label className="block text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Listing Photo
            </label>

            {/* Tab switcher */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPhotoTab("streetview")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${photoTab === "streetview" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                <Camera className="w-4 h-4" />
                Street View Auto-Photo
              </button>
              <button
                type="button"
                onClick={() => setPhotoTab("url")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${photoTab === "url" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                <Link className="w-4 h-4" />
                Custom URL
              </button>
            </div>

            {photoTab === "streetview" && (
              <div>
                {streetViewUrl ? (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden border-2 border-border aspect-video bg-muted">
                      <img
                        src={streetViewUrl}
                        alt="Street View"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <ImageOff className="w-8 h-8 opacity-40" />
                        <p className="text-sm">No Street View available for this address</p>
                      </div>
                      {streetViewUsed && (
                        <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> In Use
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleUseStreetView}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${streetViewUsed ? "bg-green-100 text-green-800 border-2 border-green-300" : "bg-primary text-white hover:bg-primary/90"}`}
                        data-testid="button-use-street-view"
                      >
                        {streetViewUsed ? (
                          <><CheckCircle2 className="w-4 h-4" /> Street View Photo Selected</>
                        ) : (
                          <><Camera className="w-4 h-4" /> Use as Listing Photo</>
                        )}
                      </button>
                      {streetViewUsed && (
                        <button
                          type="button"
                          onClick={() => { setFormData(prev => ({ ...prev, imageUrl: "" })); setStreetViewUsed(false); }}
                          className="p-2.5 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Exterior street-level photo pulled from Google Street View for this address. Select an address above to update.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                    <Camera className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">Select an address above</p>
                    <p className="text-xs text-muted-foreground mt-1">A Street View exterior photo will appear automatically</p>
                  </div>
                )}
              </div>
            )}

            {photoTab === "url" && (
              <div className="space-y-3">
                <input
                  value={formData.imageUrl}
                  onChange={e => { setFormData({ ...formData, imageUrl: e.target.value }); setStreetViewUsed(false); }}
                  className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  placeholder="https://example.com/photo.jpg"
                  data-testid="input-image-url"
                />
                {formData.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-border aspect-video bg-muted">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Paste a direct link to a photo. For best results, use a high-resolution landscape photo.</p>
              </div>
            )}
          </div>

          {/* Core listing details */}
          <div className="grid md:grid-cols-2 gap-6 pt-2 border-t border-border">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Listing Title</label>
              <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" placeholder="Stunning Modern Home" />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Price ($)</label>
              <input required type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" placeholder="750000" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-muted-foreground mb-2">Description</label>
            <textarea required rows={4} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none" placeholder="Describe the property..." />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Beds</label>
              <input required type="number" min="0" value={formData.beds} onChange={e => setFormData({ ...formData, beds: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Baths</label>
              <input required type="number" step="0.5" min="0" value={formData.baths} onChange={e => setFormData({ ...formData, baths: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Sq Ft</label>
              <input required type="number" min="0" value={formData.sqft} onChange={e => setFormData({ ...formData, sqft: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">Lot Size (sq ft)</label>
              <input type="number" min="0" value={formData.lotSize} onChange={e => setFormData({ ...formData, lotSize: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="e.g. 5000" />
            </div>
            <div>
              <label className="block text-sm font-bold text-muted-foreground mb-2">HOA Fee ($/mo)</label>
              <input type="number" min="0" value={formData.hoaFee} onChange={e => setFormData({ ...formData, hoaFee: e.target.value })} className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 outline-none" placeholder="0 if none" />
            </div>
          </div>

          {/* Open House */}
          <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20 space-y-3">
            <p className="font-bold text-green-800 dark:text-green-400 text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Open House (optional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Date</label>
                <input
                  type="date"
                  value={formData.openHouseDate}
                  onChange={e => setFormData({ ...formData, openHouseDate: e.target.value })}
                  className="w-full bg-background border-2 border-border rounded-xl px-4 py-2.5 outline-none text-sm"
                  data-testid="input-openhouse-date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Time</label>
                <input
                  type="text"
                  value={formData.openHouseTime}
                  onChange={e => setFormData({ ...formData, openHouseTime: e.target.value })}
                  placeholder="e.g. 1:00 PM – 4:00 PM"
                  className="w-full bg-background border-2 border-border rounded-xl px-4 py-2.5 outline-none text-sm"
                  data-testid="input-openhouse-time"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
            <input
              type="checkbox"
              id="isOffMarket"
              checked={formData.isOffMarket}
              onChange={e => setFormData({ ...formData, isOffMarket: e.target.checked })}
              className="w-5 h-5 accent-yellow-500 rounded cursor-pointer"
            />
            <label htmlFor="isOffMarket" className="font-bold text-yellow-800 dark:text-yellow-400 cursor-pointer">
              Mark as "Buy it Now" (Private Listing)
            </label>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={isPending} className="px-8 py-3 font-bold bg-primary text-white rounded-xl hover:bg-primary/90 hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2" data-testid="button-submit-listing">
              {isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {property ? 'Save Changes' : 'Post Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
