import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Wrench, Landmark, Building2, Plug, TrendingUp, Loader2, ArrowLeft } from "lucide-react";

type PartnerType = "vendor" | "lender" | "brokerage" | "integration" | "investor";

const PARTNER_CARDS: { type: PartnerType; icon: any; title: string; tagline: string; cta: string }[] = [
  { type: "vendor", icon: Wrench, title: "Local Vendor", tagline: "Pest control, plumbing, HVAC, landscaping & more", cta: "List my business" },
  { type: "lender", title: "Lender", icon: Landmark, tagline: "Get matched with pre-approved buyers", cta: "Become a lender partner" },
  { type: "brokerage", title: "Brokerage", icon: Building2, tagline: "Bring your team onto xucasa", cta: "Partner your brokerage" },
  { type: "integration", title: "Integration / API", icon: Plug, tagline: "MLS, CRM, or data-platform partner", cta: "Explore integrations" },
  { type: "investor", title: "Investor", icon: TrendingUp, tagline: "Interested in supporting xucasa", cta: "Get in touch" },
];

export default function Partners() {
  usePageMeta({
    title: "Partner with xucasa",
    description: "List your business, join as a lender, brokerage, integration partner, or investor.",
  });
  const { toast } = useToast();
  const [selected, setSelected] = useState<PartnerType | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [nmls, setNmls] = useState("");
  const [agentCount, setAgentCount] = useState("");
  const [mlsAffiliation, setMlsAffiliation] = useState("");
  const [apiUseCase, setApiUseCase] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        partnerType: selected,
        businessName: businessName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone || undefined,
        website: website || undefined,
        message: message || undefined,
      };
      if (selected === "lender") body.nmls = nmls || undefined;
      if (selected === "brokerage") body.agentCount = agentCount || undefined;
      if (selected === "brokerage") body.mlsAffiliation = mlsAffiliation || undefined;
      if (selected === "integration") body.apiUseCase = apiUseCase || undefined;
      const res = await apiRequest("POST", "/api/partners/inquire", body);
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
    onError: (err: any) => toast({ title: "Could not submit", description: err?.message || "Try again.", variant: "destructive" }),
  });

  const reset = () => {
    setSelected(null);
    setSubmitted(false);
    setBusinessName(""); setContactName(""); setEmail(""); setPhone("");
    setWebsite(""); setMessage(""); setNmls(""); setAgentCount("");
    setMlsAffiliation(""); setApiUseCase("");
  };

  const inputClass = "w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {!selected ? (
        <>
          <div className="text-center mb-10">
            <h1 className="text-4xl font-display font-bold text-foreground mb-3" data-testid="text-partners-title">Partner with xucasa</h1>
            <p className="text-muted-foreground text-lg">Choose how you'd like to work with us.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PARTNER_CARDS.map(card => {
              const Icon = card.icon;
              return (
                <button
                  key={card.type}
                  onClick={() => setSelected(card.type)}
                  className="bg-card border-2 border-border hover:border-primary text-left rounded-2xl p-6 transition-colors group"
                  data-testid={`button-partner-${card.type}`}
                >
                  <Icon className="w-10 h-10 text-primary mb-3" />
                  <h3 className="font-bold text-xl mb-1">{card.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{card.tagline}</p>
                  <span className="text-primary font-semibold text-sm group-hover:underline">{card.cta} →</span>
                </button>
              );
            })}
          </div>
        </>
      ) : submitted ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center" data-testid="partner-success">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Thank you!</h2>
          <p className="text-muted-foreground mb-6">We'll be in touch within 2 business days.</p>
          <button onClick={reset} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold" data-testid="button-partner-done">Back to Partners</button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8">
          <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1.5" data-testid="button-partner-back">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-2xl font-bold mb-1 capitalize">{selected} Partner Inquiry</h2>
          <p className="text-muted-foreground mb-6">Tell us a bit about your business.</p>
          <div className="space-y-3">
            <input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Business Name *" className={inputClass} data-testid="input-partner-business" />
            <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Your Name *" className={inputClass} data-testid="input-partner-contact" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email *" className={inputClass} data-testid="input-partner-email" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className={inputClass} data-testid="input-partner-phone" />
            </div>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="Website" className={inputClass} data-testid="input-partner-website" />

            {selected === "lender" && (
              <input value={nmls} onChange={e => setNmls(e.target.value)} placeholder="NMLS #" className={inputClass} data-testid="input-partner-nmls" />
            )}
            {selected === "brokerage" && (
              <>
                <input value={agentCount} onChange={e => setAgentCount(e.target.value)} placeholder="Number of agents" className={inputClass} data-testid="input-partner-agentcount" />
                <input value={mlsAffiliation} onChange={e => setMlsAffiliation(e.target.value)} placeholder="MLS affiliation" className={inputClass} data-testid="input-partner-mls" />
              </>
            )}
            {selected === "integration" && (
              <textarea value={apiUseCase} onChange={e => setApiUseCase(e.target.value)} placeholder="Describe your API use case" rows={3} className={inputClass} data-testid="input-partner-apiusecase" />
            )}

            <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} placeholder="Anything else?" rows={4} className={inputClass} data-testid="input-partner-message" />

            <button
              onClick={() => {
                if (!businessName.trim() || !contactName.trim() || !email.trim()) {
                  toast({ title: "Missing required fields", variant: "destructive" });
                  return;
                }
                mutation.mutate();
              }}
              disabled={mutation.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-partner-submit"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Inquiry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
