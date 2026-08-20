import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { X, CalendarDays, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function TourRequestModal({ 
  propertyId, 
  agentFirstName, 
  isOpen, 
  onClose 
}: { 
  propertyId: number;
  agentFirstName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const { toast } = useToast();

  const tourMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (!email.trim() && !phone.trim()) throw new Error("Either email or phone is required");
      const res = await apiRequest("POST", `/api/properties/${propertyId}/tour-inquiry`, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        preferredDate: preferredDate.trim() || undefined,
        message: message.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setName("");
        setEmail("");
        setPhone("");
        setPreferredDate("");
        setMessage("");
        onClose();
      }, 3000);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send request", description: err.message, variant: "destructive" });
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-display font-bold text-foreground">
            Schedule a Tour
          </h2>
          <button 
            onClick={onClose}
            aria-label="Close tour request"
            className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {success ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-green-600 dark:text-green-500">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">Request sent!</h3>
            <p className="text-muted-foreground">{agentFirstName} will be in touch soon.</p>
          </div>
        ) : (
          <div className="p-4 overflow-y-auto space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Name *</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 outline-none" placeholder="Jane Doe" />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 outline-none" placeholder="jane@example.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 outline-none" placeholder="(555) 555-5555" />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Preferred Date</label>
              <input type="text" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 outline-none" placeholder="e.g. This Saturday morning" />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:border-amber-500 outline-none h-24 resize-none" placeholder="I'd love to see this property..." />
            </div>

            <button
              onClick={() => tourMutation.mutate()}
              disabled={tourMutation.isPending || !name.trim() || (!email.trim() && !phone.trim())}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {tourMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
              Request Tour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
