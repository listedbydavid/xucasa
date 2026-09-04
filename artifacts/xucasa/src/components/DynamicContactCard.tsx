import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Phone } from "lucide-react";
import { TourRequestModal } from "./TourRequestModal";

interface AgentInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  profileImageUrl: string | null;
  brokerageName: string | null;
  agentMlsId: string | null;
}

interface ContactAgentResponse {
  agentType: "buyers_agent" | "listing_agent" | "platform_agent";
  agent: AgentInfo;
}

export function DynamicContactCard({ 
  propertyId, 
  onAskQuestion 
}: { 
  propertyId: number; 
  onAskQuestion: () => void;
}) {
  const [showTourModal, setShowTourModal] = useState(false);
  
  const { data, isLoading, isError } = useQuery<ContactAgentResponse>({
    queryKey: ["/api/properties", propertyId, "contact-agent"],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}/contact-agent`);
      if (!res.ok) throw new Error("Failed to load contact info");
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="hidden md:block border border-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-24 mb-4"></div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-muted"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-32"></div>
            <div className="h-3 bg-muted rounded w-24"></div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-muted rounded flex-1"></div>
          <div className="h-9 bg-muted rounded w-16"></div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="hidden md:block border border-border rounded-xl p-4 text-sm text-muted-foreground">
        Agent contact information is temporarily unavailable.
      </div>
    );
  }

  const { agentType, agent } = data;
  const isBuyersAgent = agentType === "buyers_agent";

  return (
    <>
      <div className="hidden md:block border border-border rounded-xl p-4 sticky top-24 bg-card">
        {isBuyersAgent ? (
          <p className="text-xs font-bold tracking-wider text-amber-600 mb-2">YOUR AGENT</p>
        ) : (
          <p className="text-xs font-bold tracking-wider text-muted-foreground mb-2">LISTING AGENT</p>
        )}
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center justify-center font-bold text-lg overflow-hidden flex-shrink-0">
            {agent.profileImageUrl ? (
              <img src={agent.profileImageUrl} alt={`${agent.firstName} ${agent.lastName}`} className="w-full h-full object-cover" />
            ) : (
              agent.firstName?.[0]?.toUpperCase() || "A"
            )}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-foreground truncate">{agent.firstName} {agent.lastName}</div>
            <div className="text-xs text-muted-foreground truncate">{agent.brokerageName || "Agent"}</div>
          </div>
        </div>
        {!isBuyersAgent && (
          <button
            type="button"
            onClick={onAskQuestion}
            className="mt-2 w-full flex items-center justify-center gap-2 border border-border bg-muted/60 hover:bg-muted py-2 rounded-lg text-sm font-bold transition-colors"
            data-testid="button-guest-question"
          >
            <MessageSquare className="w-4 h-4" />
            Ask a question
          </button>
        )}
        
        <div className="flex gap-2">
          {isBuyersAgent ? (
            <button 
              className="flex-1 bg-foreground text-background hover:bg-foreground/90 py-2 rounded-lg text-sm font-bold transition-colors"
              onClick={onAskQuestion}
            >
              Message {agent.firstName}
            </button>
          ) : (
            <button 
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-bold transition-colors"
              onClick={() => setShowTourModal(true)}
            >
              Schedule a Tour
            </button>
          )}
          
          {agent.phone && (
            <a 
              href={`tel:${agent.phone}`} 
              className="flex items-center justify-center w-12 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors border border-border"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
        
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          {isBuyersAgent ? (
            "Tour requests and questions go directly to your agent"
          ) : (
            "No account needed to inquire"
          )}
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-4 py-3 safe-bottom">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <button
            type="button"
            onClick={isBuyersAgent ? onAskQuestion : () => setShowTourModal(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold active:scale-[0.98] transition-all ${
              isBuyersAgent
                ? "bg-foreground text-background"
                : "bg-amber-500 text-white"
            }`}
          >
            {isBuyersAgent ? <MessageSquare className="w-4 h-4" /> : null}
            {isBuyersAgent ? `Message ${agent.firstName}` : "Schedule a Tour"}
          </button>
          {!isBuyersAgent && (
            <button
              type="button"
              onClick={onAskQuestion}
              className="flex items-center justify-center gap-2 bg-muted text-foreground py-3 px-4 rounded-xl font-semibold border border-border active:scale-[0.98]"
              aria-label="Ask a question"
            >
              <MessageSquare className="w-4 h-4" />
              Ask
            </button>
          )}
          {agent.phone && (
            <a
              href={`tel:${agent.phone.replace(/\D/g, "")}`}
              className="flex items-center justify-center gap-2 bg-muted text-foreground py-3 px-4 rounded-xl font-semibold border border-border active:scale-[0.98] transition-transform"
              aria-label={`Call ${agent.firstName} ${agent.lastName}`}
            >
              <Phone className="w-4 h-4" />
              Call
            </a>
          )}
        </div>
      </div>

      {!isBuyersAgent && (
        <TourRequestModal
          isOpen={showTourModal}
          onClose={() => setShowTourModal(false)}
          propertyId={propertyId}
          agentFirstName={agent.firstName}
        />
      )}
    </>
  );
}
