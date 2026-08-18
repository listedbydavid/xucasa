import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { X, ShieldCheck, UserPlus, Loader2 } from "lucide-react";

interface OfferGateModalProps {
  propertyId: number;
  onClose: () => void;
  onAgentReady: () => void;
}

const DAVID_NAME = "David Hussain";

/**
 * Offer gate: requires the buyer to have an assigned agent before submitting an offer.
 * - Accept: assigns David Hussain via POST /api/buyer-interest, then proceeds.
 * - Invite my own agent: surfaces the existing agent invite flow (placeholder navigation).
 */
export function OfferGateModal({ propertyId, onClose, onAgentReady }: OfferGateModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [accepting, setAccepting] = useState(false);

  // Already has an agent — let caller proceed immediately
  if (user?.assignedAgentUserId) {
    onAgentReady();
    return null;
  }

  const acceptDavid = async () => {
    setAccepting(true);
    try {
      await apiRequest("POST", "/api/buyer-interest", { propertyId, source: "offer_gate" });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: `${DAVID_NAME} is now your agent`, description: "You can submit your offer." });
      onAgentReady();
      onClose();
    } catch {
      toast({ title: "Couldn't assign agent", description: "Please try again.", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  const inviteOwnAgent = () => {
    onClose();
    navigate("/dashboard?invite-agent=1");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-card rounded-3xl shadow-2xl w-full max-w-md z-10 overflow-hidden" data-testid="modal-offer-gate">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors z-20"
          aria-label="Close"
          data-testid="button-offer-gate-close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-primary/5 border-b border-border px-8 pt-8 pb-6 text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display font-bold text-xl text-foreground">You need an agent to make an offer</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Would you like to work with <span className="font-semibold text-foreground">{DAVID_NAME}</span> as your agent?
          </p>
        </div>

        <div className="px-8 py-6 space-y-3">
          <button
            onClick={acceptDavid}
            disabled={accepting}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-[.98] transition-all disabled:opacity-60"
            data-testid="button-offer-gate-accept"
          >
            {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Accept — work with {DAVID_NAME}
          </button>
          <button
            onClick={inviteOwnAgent}
            className="w-full flex items-center justify-center gap-2 bg-muted text-foreground py-3 rounded-xl font-semibold text-sm hover:bg-muted/70 transition-all"
            data-testid="button-offer-gate-invite"
          >
            <UserPlus className="w-4 h-4" />
            I have my own agent — invite them
          </button>
        </div>
      </div>
    </div>
  );
}
