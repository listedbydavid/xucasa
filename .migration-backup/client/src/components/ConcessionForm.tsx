import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, X, Tag, Loader2 } from "lucide-react";

interface ConcessionFormProps {
  propertyId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormState {
  enableClosing: boolean;
  closingCostPercent: string;
  closingCostFixed: string;
  enableAssumable: boolean;
  assumableLoanRate: string;
  assumableLoanBalance: string;
  assumableLoanType: string;
  enableBuydown: boolean;
  rateBuydown: string;
  enableSellerCredit: boolean;
  sellerCreditFixed: string;
  enableMoveOut: boolean;
  moveOutDays: string;
  enableOther: boolean;
  additionalTerms: string;
  headline: string;
}

const initialState: FormState = {
  enableClosing: false,
  closingCostPercent: "",
  closingCostFixed: "",
  enableAssumable: false,
  assumableLoanRate: "",
  assumableLoanBalance: "",
  assumableLoanType: "Conventional",
  enableBuydown: false,
  rateBuydown: "",
  enableSellerCredit: false,
  sellerCreditFixed: "",
  enableMoveOut: false,
  moveOutDays: "",
  enableOther: false,
  additionalTerms: "",
  headline: "",
};

export function ConcessionForm({ propertyId, onClose, onSuccess }: ConcessionFormProps) {
  const { toast } = useToast();
  const [state, setState] = useState<FormState>(initialState);

  const computedHeadline = useMemo(() => {
    if (state.headline.trim()) return state.headline.trim();
    if (state.enableClosing && state.closingCostPercent) return `Seller paying ${state.closingCostPercent}% closing costs`;
    if (state.enableClosing && state.closingCostFixed) return `$${Number(state.closingCostFixed).toLocaleString()} closing cost credit`;
    if (state.enableAssumable && state.assumableLoanRate) return `Assumable ${state.assumableLoanType} loan at ${state.assumableLoanRate}%`;
    if (state.enableBuydown && state.rateBuydown) return `Rate buydown: ${state.rateBuydown}`;
    if (state.enableSellerCredit && state.sellerCreditFixed) return `$${Number(state.sellerCreditFixed).toLocaleString()} seller credit`;
    if (state.enableMoveOut) return "Flexible move-out timing";
    return "Seller is offering terms";
  }, [state]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = { headline: computedHeadline };
      if (state.enableClosing) {
        if (state.closingCostPercent) body.closingCostPercent = state.closingCostPercent;
        if (state.closingCostFixed) body.closingCostFixed = parseInt(state.closingCostFixed);
      }
      if (state.enableAssumable) {
        body.assumableLoan = true;
        if (state.assumableLoanRate) body.assumableLoanRate = state.assumableLoanRate;
        if (state.assumableLoanBalance) body.assumableLoanBalance = parseInt(state.assumableLoanBalance);
        if (state.assumableLoanType) body.assumableLoanType = state.assumableLoanType;
      }
      if (state.enableBuydown && state.rateBuydown) {
        body.rateBuydown = state.rateBuydown;
      }
      if (state.enableSellerCredit && state.sellerCreditFixed) {
        body.sellerCreditFixed = parseInt(state.sellerCreditFixed);
      }
      if (state.enableMoveOut) {
        body.flexibleMoveOut = true;
        if (state.moveOutDays) body.moveOutDays = parseInt(state.moveOutDays);
      }
      if (state.enableOther && state.additionalTerms) {
        body.additionalTerms = state.additionalTerms;
      }
      return apiRequest("POST", `/api/properties/${propertyId}/concessions`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/concessions/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "concessions"] });
      toast({ title: "Seller terms posted", description: "Buyers will now see what you're offering." });
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't post terms", description: err.message, variant: "destructive" });
    },
  });

  const hasAnyTerm =
    (state.enableClosing && (state.closingCostPercent || state.closingCostFixed)) ||
    (state.enableAssumable && state.assumableLoanRate) ||
    (state.enableBuydown && state.rateBuydown) ||
    (state.enableSellerCredit && state.sellerCreditFixed) ||
    state.enableMoveOut ||
    (state.enableOther && state.additionalTerms);

  const fieldStyle = "w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-card rounded-3xl shadow-2xl w-full max-w-lg z-10 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-display font-bold text-lg">Post seller terms</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
            data-testid="button-concession-form-close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Closing costs */}
          <Section
            label="Offering closing cost help"
            checked={state.enableClosing}
            onToggle={(v) => setState((s) => ({ ...s, enableClosing: v }))}
            testId="toggle-closing"
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="text-muted-foreground">% of sale price</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={state.closingCostPercent}
                  onChange={(e) => setState((s) => ({ ...s, closingCostPercent: e.target.value }))}
                  placeholder="3"
                  className={fieldStyle}
                  data-testid="input-closing-percent"
                />
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Fixed amount ($)</span>
                <input
                  type="number"
                  min="0"
                  value={state.closingCostFixed}
                  onChange={(e) => setState((s) => ({ ...s, closingCostFixed: e.target.value }))}
                  placeholder="10000"
                  className={fieldStyle}
                  data-testid="input-closing-fixed"
                />
              </label>
            </div>
          </Section>

          {/* Assumable loan */}
          <Section
            label="Assumable loan available"
            checked={state.enableAssumable}
            onToggle={(v) => setState((s) => ({ ...s, enableAssumable: v }))}
            testId="toggle-assumable"
          >
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs">
                <span className="text-muted-foreground">Type</span>
                <select
                  value={state.assumableLoanType}
                  onChange={(e) => setState((s) => ({ ...s, assumableLoanType: e.target.value }))}
                  className={fieldStyle}
                  data-testid="select-assumable-type"
                >
                  <option value="Conventional">Conventional</option>
                  <option value="FHA">FHA</option>
                  <option value="VA">VA</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Rate (%)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={state.assumableLoanRate}
                  onChange={(e) => setState((s) => ({ ...s, assumableLoanRate: e.target.value }))}
                  placeholder="2.75"
                  className={fieldStyle}
                  data-testid="input-assumable-rate"
                />
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Balance ($)</span>
                <input
                  type="number"
                  min="0"
                  value={state.assumableLoanBalance}
                  onChange={(e) => setState((s) => ({ ...s, assumableLoanBalance: e.target.value }))}
                  placeholder="425000"
                  className={fieldStyle}
                  data-testid="input-assumable-balance"
                />
              </label>
            </div>
          </Section>

          {/* Rate buydown */}
          <Section
            label="Rate buydown"
            checked={state.enableBuydown}
            onToggle={(v) => setState((s) => ({ ...s, enableBuydown: v }))}
            testId="toggle-buydown"
          >
            <input
              type="text"
              value={state.rateBuydown}
              onChange={(e) => setState((s) => ({ ...s, rateBuydown: e.target.value }))}
              placeholder="2-1 buydown"
              className={fieldStyle}
              data-testid="input-buydown"
            />
          </Section>

          {/* Seller credit */}
          <Section
            label="Seller credit"
            checked={state.enableSellerCredit}
            onToggle={(v) => setState((s) => ({ ...s, enableSellerCredit: v }))}
            testId="toggle-seller-credit"
          >
            <input
              type="number"
              min="0"
              value={state.sellerCreditFixed}
              onChange={(e) => setState((s) => ({ ...s, sellerCreditFixed: e.target.value }))}
              placeholder="5000"
              className={fieldStyle}
              data-testid="input-seller-credit"
            />
          </Section>

          {/* Flexible move-out */}
          <Section
            label="Flexible move-out"
            checked={state.enableMoveOut}
            onToggle={(v) => setState((s) => ({ ...s, enableMoveOut: v }))}
            testId="toggle-moveout"
          >
            <label className="text-xs block">
              <span className="text-muted-foreground">Days of flexibility (optional)</span>
              <input
                type="number"
                min="0"
                value={state.moveOutDays}
                onChange={(e) => setState((s) => ({ ...s, moveOutDays: e.target.value }))}
                placeholder="30"
                className={fieldStyle}
                data-testid="input-moveout-days"
              />
            </label>
          </Section>

          {/* Other */}
          <Section
            label="Other terms"
            checked={state.enableOther}
            onToggle={(v) => setState((s) => ({ ...s, enableOther: v }))}
            testId="toggle-other"
          >
            <textarea
              rows={3}
              value={state.additionalTerms}
              onChange={(e) => setState((s) => ({ ...s, additionalTerms: e.target.value }))}
              placeholder="e.g. Will include all appliances, leave the riding mower..."
              className={fieldStyle}
              data-testid="input-additional-terms"
            />
          </Section>

          {/* Headline override */}
          <div className="pt-2 border-t border-border">
            <label className="text-xs block">
              <span className="text-muted-foreground">Custom headline (optional)</span>
              <input
                type="text"
                value={state.headline}
                onChange={(e) => setState((s) => ({ ...s, headline: e.target.value }))}
                placeholder={computedHeadline}
                className={fieldStyle}
                data-testid="input-headline"
              />
            </label>
          </div>

          {/* Preview */}
          <div className="pt-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
            <div className="bg-muted/30 border border-dashed border-border rounded-xl p-4">
              <span
                className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow"
                data-testid="badge-concession-preview"
              >
                <Tag className="w-3 h-3" /> Seller Offering Terms
              </span>
              <p className="text-sm font-semibold text-foreground mt-3">{computedHeadline}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            data-testid="button-concession-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!hasAnyTerm || mutation.isPending}
            className="px-5 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="button-concession-submit"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Post terms
          </button>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  label: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
  testId: string;
}
function Section({ label, checked, onToggle, children, testId }: SectionProps) {
  return (
    <div className="border border-border rounded-xl p-3">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 rounded"
          data-testid={testId}
        />
        <span className="text-sm font-semibold">{label}</span>
      </label>
      {checked && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}
