import { useState } from "react";
import { useRoute, Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { useGetAgentProfile, getGetAgentProfileQueryKey } from "@workspace/api-client-react";
import { PropertyCard } from "@/components/PropertyCard";
import { Building, Phone, Mail, Globe, ShieldCheck, ChevronLeft, Award, Calendar, BadgeCheck } from "lucide-react";
import type { AgentPropertySummary } from "@workspace/api-client-react";

export default function AgentProfilePage() {
  const [, params] = useRoute("/agents/:id");
  const agentId = params?.id || "";
  const { isAuthenticated, user } = useAuth();
  
  const { data: agent, isLoading, error } = useGetAgentProfile(agentId, {
    query: { enabled: !!agentId && isAuthenticated && user?.role === "agent", queryKey: getGetAgentProfileQueryKey(agentId) }
  });

  usePageMeta({ title: agent ? `${agent.displayName} - Agent Profile` : "Agent Profile", noIndex: true });

  const [activeTab, setActiveTab] = useState<"active" | "ytd" | "prevYear" | "fiveYears">("active");

  if (!isAuthenticated || user?.role !== "agent" || !user.agentVerified) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-4">
        <ShieldCheck className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-display font-bold mb-4">Agent Profile Access</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          Agent profiles are only visible to verified agents on the xucasa network.
        </p>
        <Link href="/agents" className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold">
          Back to Directory
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-8 px-4">
        <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
          <div className="h-64 bg-muted rounded-3xl" />
          <div className="h-12 bg-muted rounded-xl w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-48 bg-muted rounded-2xl" />
            <div className="h-48 bg-muted rounded-2xl md:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-background pt-20 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Profile not found</h1>
        <p className="text-muted-foreground mb-8">This agent profile is unavailable or does not exist.</p>
        <Link href="/agents" className="text-primary font-semibold hover:underline">
          &larr; Back to Directory
        </Link>
      </div>
    );
  }

  const periods = agent.periods || { currentYear: new Date().getFullYear(), previousYear: new Date().getFullYear() - 1, fiveYearStart: new Date().getFullYear() - 4 };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-muted/30 border-b border-border pt-8 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/agents" className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Directory
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background shadow-xl overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
              {agent.profileImageUrl ? (
                <img src={agent.profileImageUrl} alt={agent.displayName || "Agent"} className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl font-bold text-muted-foreground">{agent.displayName?.[0] || "A"}</span>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                  {agent.displayName || "Agent"}
                </h1>
                {agent.lastMlsSyncAt && (
                  <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full text-xs font-bold border border-green-200 dark:border-green-800">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified MLS
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-lg text-muted-foreground font-medium mb-6">
                <Building className="w-5 h-5" />
                <span>{agent.brokerageName || "Independent"}</span>
              </div>
              
              <div className="flex flex-wrap gap-4 text-sm">
                {agent.email && (
                  <a href={`mailto:${agent.email}`} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors bg-card px-4 py-2 rounded-full border border-border shadow-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {agent.email}
                  </a>
                )}
                {agent.phone && (
                  <a href={`tel:${agent.phone}`} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors bg-card px-4 py-2 rounded-full border border-border shadow-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {agent.phone}
                  </a>
                )}
                {agent.website && (
                  <a href={agent.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors bg-card px-4 py-2 rounded-full border border-border shadow-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                License Info
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-medium text-xs uppercase tracking-wider mb-1">Agent License</p>
                  <p className="font-semibold">{agent.licenseNumber || "Not provided"} {agent.licenseState ? `(${agent.licenseState})` : ""}</p>
                </div>
                {agent.brokerageLicense && (
                  <div>
                    <p className="text-muted-foreground font-medium text-xs uppercase tracking-wider mb-1">Brokerage License</p>
                    <p className="font-semibold">{agent.brokerageLicense}</p>
                  </div>
                )}
                {agent.brokerageAddress && (
                  <div>
                    <p className="text-muted-foreground font-medium text-xs uppercase tracking-wider mb-1">Office Address</p>
                    <p className="font-semibold">{agent.brokerageAddress}</p>
                  </div>
                )}
                {agent.brokerageWebsite && (
                  <div>
                    <p className="text-muted-foreground font-medium text-xs uppercase tracking-wider mb-1">Brokerage Website</p>
                    <a
                      href={agent.brokerageWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline"
                    >
                      Visit brokerage website
                    </a>
                  </div>
                )}
              </div>
            </div>

            {agent.bio && (
              <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-3">About</h3>
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                  {agent.bio}
                </p>
              </div>
            )}
          </div>
          
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-display font-bold mb-6">Production & Listings</h2>
            
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 hide-scrollbar">
              <button
                onClick={() => setActiveTab("active")}
                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${activeTab === "active" ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
              >
                Active Listings ({agent.currentListings?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab("ytd")}
                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${activeTab === "ytd" ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
              >
                Sold YTD {periods.currentYear} ({agent.salesYtd?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab("prevYear")}
                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${activeTab === "prevYear" ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
              >
                Sold {periods.previousYear} ({agent.salesPreviousYear?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab("fiveYears")}
                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${activeTab === "fiveYears" ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
              >
                History {periods.fiveYearStart}-{periods.currentYear} ({agent.salesFiveYears?.length || 0})
              </button>
            </div>

            <div className="space-y-4">
              {activeTab === "active" && (
                agent.currentListings?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {agent.currentListings.map(p => (
                      <PropertyCard key={p.id} property={p as any} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No active listings at the moment." />
                )
              )}

              {activeTab === "ytd" && (
                agent.salesYtd?.length ? (
                  <div className="space-y-3">
                    {agent.salesYtd.map(p => <TransactionRow key={p.id} property={p} />)}
                  </div>
                ) : (
                  <EmptyState message={`No recorded sales for YTD ${periods.currentYear}.`} />
                )
              )}

              {activeTab === "prevYear" && (
                agent.salesPreviousYear?.length ? (
                  <div className="space-y-3">
                    {agent.salesPreviousYear.map(p => <TransactionRow key={p.id} property={p} />)}
                  </div>
                ) : (
                  <EmptyState message={`No recorded sales for ${periods.previousYear}.`} />
                )
              )}

              {activeTab === "fiveYears" && (
                agent.salesFiveYears?.length ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Broader history view spanning the last 5 years.
                    </p>
                    {agent.salesFiveYears.map(p => <TransactionRow key={p.id} property={p} />)}
                  </div>
                ) : (
                  <EmptyState message={`No recorded history for ${periods.fiveYearStart}-${periods.currentYear}.`} />
                )
              )}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-card border border-border border-dashed rounded-3xl py-12 px-6 text-center text-muted-foreground">
      <Calendar className="w-8 h-8 mx-auto mb-3 opacity-20" />
      <p>{message}</p>
    </div>
  );
}

function TransactionRow({ property }: { property: AgentPropertySummary }) {
  return (
    <Link
      href={`/property/${property.id}`}
      className="flex items-center gap-4 bg-card border border-border p-3 rounded-2xl hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden flex-shrink-0">
        {property.imageUrl ? (
          <img src={property.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building className="w-6 h-6 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-foreground truncate">{property.location}</h4>
        <p className="text-sm text-muted-foreground truncate">
          {property.addressCity}, {property.addressState}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-medium">
          <span>{property.beds} BD</span>
          <span>{property.baths} BA</span>
          <span>{property.sqft.toLocaleString()} SF</span>
        </div>
      </div>
      <div className="text-right pr-2">
        <p className="font-display font-bold text-lg">
          ${(property.closePrice || property.price).toLocaleString()}
        </p>
        <p className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full inline-block mt-1">
          {property.closeDate ? new Date(property.closeDate).getFullYear() : "Sold"}
        </p>
      </div>
    </Link>
  );
}
