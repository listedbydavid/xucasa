import { useEffect, useRef } from "react";
import { X, Sparkles, Banknote, Percent, Home, Calendar, Tag } from "lucide-react";
import { useLocation } from "wouter";
import type { SellerConcessionData } from "@/hooks/use-properties";

interface ConcessionDetailsModalProps {
  concession: SellerConcessionData;
  propertyId: number;
  onClose: () => void;
  onContinue: () => void;
}

export function ConcessionDetailsModal({ concession, propertyId, onClose, onContinue }: ConcessionDetailsModalProps) {
  const [, navigate] = useLocation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const items: Array<{ icon: any; label: string }> = [];
  if (concession.closingCostPercent && Number(concession.closingCostPercent) > 0) {
    items.push({ icon: Percent, label: `Seller paying ${concession.closingCostPercent}% toward closing costs` });
  }
  if (concession.closingCostFixed && concession.closingCostFixed > 0) {
    items.push({ icon: Banknote, label: `$${concession.closingCostFixed.toLocaleString()} closing cost credit` });
  }
  if (concession.rateBuydown) {
    items.push({ icon: Percent, label: `Rate buydown: ${concession.rateBuydown}` });
  }
  if (concession.assumableLoan) {
    const parts = ["Assumable loan"];
    if (concession.assumableLoanType) parts.push(concession.assumableLoanType);
    if (concession.assumableLoanRate) parts.push(`${concession.assumableLoanRate}% rate`);
    if (concession.assumableLoanBalance) parts.push(`$${concession.assumableLoanBalance.toLocaleString()} balance`);
    items.push({ icon: Home, label: parts.join(" · ") });
  }
  if (concession.sellerCreditFixed && concession.sellerCreditFixed > 0) {
    items.push({ icon: Banknote, label: `$${concession.sellerCreditFixed.toLocaleString()} seller credit` });
  }
  if (concession.flexibleMoveOut) {
    items.push({
      icon: Calendar,
      label: concession.moveOutDays ? `Flexible move-out (±${concession.moveOutDays} days)` : "Flexible move-out timing",
    });
  }
  if (concession.additionalTerms) {
    items.push({ icon: Tag, label: concession.additionalTerms });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="concession-modal-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-card rounded-3xl shadow-2xl w-full max-w-md z-10 overflow-hidden"
        data-testid="modal-concession-details"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors z-20"
          aria-label="Close"
          data-testid="button-concession-close"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-b border-border px-8 pt-8 pb-6 text-center">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 id="concession-modal-title" className="font-display font-bold text-xl text-foreground">
            {concession.headline || "Seller is offering terms"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Here's what's on the table</p>
        </div>

        <div className="px-8 py-6 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">The seller has posted general flexibility — connect with an agent for details.</p>
          ) : (
            items.map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex items-start gap-3" data-testid={`concession-item-${i}`}>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm text-foreground pt-1">{label}</span>
              </div>
            ))
          )}
        </div>

        <div className="px-8 pb-8 space-y-2">
          <button
            onClick={() => { onClose(); navigate(`/property/${propertyId}`); }}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-[.98] transition-all"
            data-testid="button-concession-connect-agent"
          >
            Connect with agent about this home
          </button>
          <button
            onClick={onContinue}
            className="w-full bg-muted text-foreground py-3 rounded-xl font-semibold text-sm hover:bg-muted/70 transition-all"
            data-testid="button-concession-continue"
          >
            Continue swiping
          </button>
        </div>
      </div>
    </div>
  );
}
