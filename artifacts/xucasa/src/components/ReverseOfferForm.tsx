import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, Calendar, Shield, FileText, Percent,
  Loader2, X, ChevronDown, ChevronUp,
} from "lucide-react";

interface ReverseOfferFormProps {
  propertyId: number;
  buyerUserId: string;
  propertyPrice: number;
  propertyTitle: string;
  swipeNotificationId?: number;
  buyerName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

export function ReverseOfferForm({
  propertyId, buyerUserId, propertyPrice, propertyTitle,
  swipeNotificationId, buyerName, onClose, onSuccess,
}: ReverseOfferFormProps) {
  const { toast } = useToast();
  const [showContingencies, setShowContingencies] = useState(true);
  const [showBuydown, setShowBuydown] = useState(false);

  const [form, setForm] = useState({
    offerPrice: propertyPrice,
    escrowLengthDays: 30,
    inspectionContingencyDays: 17,
    loanContingencyDays: 21,
    appraisalContingencyDays: 17,
    insuranceContingencyDays: 5,
    disclosureReviewDays: 7,
    leasedLienedItemsDays: 5,
    sellerConcessions: 0,
    sellerConcessionNotes: "",
    buydownOffered: false,
    buydownType: "2-1",
    buydownAmount: 0,
    additionalTerms: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/property-offers", {
        propertyId,
        buyerUserId,
        ...form,
        swipeNotificationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swipe-notifications/agent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/property-offers/agent"] });
      toast({ title: "Reverse offer sent", description: "The buyer will be notified of your offer terms." });
      onSuccess?.();
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send offer.", variant: "destructive" });
    },
  });

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";
  const labelClass = "text-xs font-medium text-muted-foreground mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-reverse-offer">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-display font-bold text-foreground" data-testid="text-offer-title">
              Reverse Offer Terms
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {propertyTitle}{buyerName ? ` → ${buyerName}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors" data-testid="button-close-offer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                <DollarSign className="w-3 h-3 inline mr-1" />Offer Price
              </label>
              <input
                data-testid="input-offer-price"
                type="number"
                value={form.offerPrice || ""}
                onChange={(e) => setForm({ ...form, offerPrice: parseInt(e.target.value) || 0 })}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground mt-1">List: {formatCurrency(propertyPrice)}</p>
            </div>
            <div>
              <label className={labelClass}>
                <Calendar className="w-3 h-3 inline mr-1" />Escrow Length (days)
              </label>
              <input
                data-testid="input-escrow-days"
                type="number"
                value={form.escrowLengthDays}
                onChange={(e) => setForm({ ...form, escrowLengthDays: parseInt(e.target.value) || 30 })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowContingencies(!showContingencies)}
              className="flex items-center gap-2 text-sm font-medium text-foreground w-full py-2"
              data-testid="button-toggle-contingencies"
            >
              <Shield className="w-4 h-4 text-primary" />
              Contingency Periods (CA RPA Standard)
              {showContingencies ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
            </button>
            {showContingencies && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                <div>
                  <label className={labelClass}>Inspection (days)</label>
                  <input
                    data-testid="input-inspection-days"
                    type="number"
                    value={form.inspectionContingencyDays}
                    onChange={(e) => setForm({ ...form, inspectionContingencyDays: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Loan (days)</label>
                  <input
                    data-testid="input-loan-days"
                    type="number"
                    value={form.loanContingencyDays}
                    onChange={(e) => setForm({ ...form, loanContingencyDays: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Appraisal (days)</label>
                  <input
                    data-testid="input-appraisal-days"
                    type="number"
                    value={form.appraisalContingencyDays}
                    onChange={(e) => setForm({ ...form, appraisalContingencyDays: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Insurance (days)</label>
                  <input
                    data-testid="input-insurance-days"
                    type="number"
                    value={form.insuranceContingencyDays}
                    onChange={(e) => setForm({ ...form, insuranceContingencyDays: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Disclosure Review (days)</label>
                  <input
                    data-testid="input-disclosure-days"
                    type="number"
                    value={form.disclosureReviewDays}
                    onChange={(e) => setForm({ ...form, disclosureReviewDays: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Leased/Liened Items (days)</label>
                  <input
                    data-testid="input-leased-days"
                    type="number"
                    value={form.leasedLienedItemsDays}
                    onChange={(e) => setForm({ ...form, leasedLienedItemsDays: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />Seller Concessions
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Amount ($)</label>
                <input
                  data-testid="input-concession-amount"
                  type="number"
                  value={form.sellerConcessions || ""}
                  onChange={(e) => setForm({ ...form, sellerConcessions: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <input
                  data-testid="input-concession-notes"
                  type="text"
                  value={form.sellerConcessionNotes}
                  onChange={(e) => setForm({ ...form, sellerConcessionNotes: e.target.value })}
                  placeholder="e.g. Closing costs, repairs"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />Interest Rate Buydown
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  data-testid="toggle-buydown"
                  type="checkbox"
                  checked={form.buydownOffered}
                  onChange={(e) => {
                    setForm({ ...form, buydownOffered: e.target.checked });
                    setShowBuydown(e.target.checked);
                  }}
                  className="w-4 h-4 rounded border-input accent-primary"
                />
                <span className="text-xs text-muted-foreground">Offer buydown</span>
              </label>
            </div>
            {form.buydownOffered && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className={labelClass}>Buydown Type</label>
                  <select
                    data-testid="select-buydown-type"
                    value={form.buydownType}
                    onChange={(e) => setForm({ ...form, buydownType: e.target.value })}
                    className={inputClass}
                  >
                    <option value="2-1">2-1 Buydown</option>
                    <option value="1-0">1-0 Buydown</option>
                    <option value="3-2-1">3-2-1 Buydown</option>
                    <option value="permanent">Permanent Buydown</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Buydown Amount ($)</label>
                  <input
                    data-testid="input-buydown-amount"
                    type="number"
                    value={form.buydownAmount || ""}
                    onChange={(e) => setForm({ ...form, buydownAmount: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 12000"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <label className={labelClass}>
              <FileText className="w-3 h-3 inline mr-1" />Additional Terms / Notes
            </label>
            <textarea
              data-testid="input-additional-terms"
              value={form.additionalTerms}
              onChange={(e) => setForm({ ...form, additionalTerms: e.target.value })}
              placeholder="Any additional terms, seller credits, home warranty, personal property included, etc."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex items-center justify-between rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-cancel-offer"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.offerPrice}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-primary/20"
            data-testid="button-submit-offer"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Send Reverse Offer
          </button>
        </div>
      </div>
    </div>
  );
}
