import { useState } from "react";
import { useLocation } from "wouter";
import { useAgentListings, useDeleteProperty } from "@/hooks/use-properties";
import { Home, ImageOff, Share2, Edit3, Trash2, Send, Camera } from "lucide-react";
import { ShareListingModal } from "@/components/ShareListingModal";
import { SendPropertyToClientModal } from "@/components/SendPropertyToClientModal";

export function AgentListingsSection() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useAgentListings();
  const { mutate: deleteProperty } = useDeleteProperty();

  const [sharePropertyId, setSharePropertyId] = useState<number | null>(null);
  const [sendPropertyId, setSendPropertyId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-16 bg-muted rounded-xl" />
        <div className="h-16 bg-muted rounded-xl" />
      </div>
    );
  }

  const created = data?.created || [];
  const attributed = data?.attributed || [];
  const totalListings = created.length + attributed.length;

  if (totalListings === 0) {
    return (
      <div className="text-center py-20 bg-card border border-border rounded-3xl">
        <Home className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
        <h3 className="font-display font-bold text-xl mb-2">No active listings</h3>
        <p className="text-muted-foreground mb-6">Create your first listing to start reaching buyers.</p>
        <button onClick={() => setLocation("/agent/listings/new")} className="text-primary font-bold hover:underline">
          Create Listing
        </button>
      </div>
    );
  }

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this listing?")) {
      deleteProperty(id);
    }
  };

  const statusStyle = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      coming_soon: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      pre_market: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
      off_market: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
      pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
    return styles[status] || styles.draft;
  };

  const renderTable = (properties: any[], canManage: boolean) => (
    <div className="bg-card rounded-2xl border border-border overflow-x-auto shadow-sm">
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
          {properties.map(property => (
            <tr key={property.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-property-${property.id}`}>
              <td className="p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {property.imageUrl || property.photos?.[0] ? (
                    <img src={property.imageUrl || property.photos?.[0]} className="w-full h-full object-cover" alt={property.title} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-5 h-5 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div>
                  <div className="font-bold text-foreground">{property.title}</div>
                  <div className="text-sm text-muted-foreground">{property.location}</div>
                </div>
              </td>
              <td className="p-4 font-bold text-foreground">${property.price.toLocaleString()}</td>
              <td className="p-4">
                <span className={`${statusStyle(property.status)} px-3 py-1 rounded-full text-xs font-bold capitalize`}>
                  {property.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="p-4 text-right">
                <button
                  onClick={() => property.status !== "draft" && setSharePropertyId(property.id)}
                  disabled={property.status === "draft"}
                  title={property.status === "draft" ? "Publish this draft before sharing" : "Share listing"}
                  className="inline-flex items-center gap-1 px-3 py-1.5 mr-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors border border-amber-200 dark:border-amber-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                <button
                  onClick={() => property.status !== "draft" && setSendPropertyId(property.id)}
                  disabled={property.status === "draft"}
                  title={property.status === "draft" ? "Publish this draft before sending" : "Send to client"}
                  className="inline-flex items-center gap-1 px-3 py-1.5 mr-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send to Client
                </button>
                {canManage && (
                  <>
                    <button
                      onClick={() => setLocation(`/agent/listings/${property.id}/edit`)}
                      className="p-2 text-muted-foreground hover:text-primary transition-colors"
                      title="Edit Listing"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setLocation(`/agent/listings/${property.id}/edit#photos`)}
                      className="p-2 text-muted-foreground hover:text-primary transition-colors ml-1"
                      title="Manage Photos"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  <button 
                    onClick={() => handleDelete(property.id)} 
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors ml-2" 
                    title="Delete Listing"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8">
      {created.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-bold text-foreground mb-4">Agent-Created Listings</h2>
          {renderTable(created, true)}
        </div>
      )}
      
      {attributed.length > 0 && (
        <div>
          <h2 className="text-xl font-display font-bold text-foreground mb-4">MLS-Attributed Listings</h2>
          {renderTable(attributed, false)}
        </div>
      )}

      <ShareListingModal
        propertyId={sharePropertyId}
        isOpen={sharePropertyId !== null}
        onClose={() => setSharePropertyId(null)}
      />
      
      <SendPropertyToClientModal
        propertyId={sendPropertyId}
        isOpen={sendPropertyId !== null}
        onClose={() => setSendPropertyId(null)}
      />
    </div>
  );
}