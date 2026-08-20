import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { X, Search, Check, Loader2, BadgeCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SafeAgent {
  id: string;
  firstName: string;
  lastName: string;
  brokerageName: string | null;
  agentMlsId: string | null;
  profileImageUrl: string | null;
}

export function FindAgentModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [successAgent, setSuccessAgent] = useState<SafeAgent | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: agents = [], isLoading } = useQuery<SafeAgent[]>({
    queryKey: ["/api/agents/search", { q: debouncedQuery }],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/agents/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Failed to search agents");
      const data = await res.json();
      return data.agents || [];
    },
    enabled: isOpen && debouncedQuery.length >= 2,
  });

  const linkMutation = useMutation({
    mutationFn: async (agentUserId: string) => {
      const res = await apiRequest("POST", "/api/buyer/link-agent", { agentUserId });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to link agent");
      return body;
    },
    onSuccess: (data, agentUserId) => {
      const linkedAgent = agents.find(a => a.id === agentUserId);
      if (linkedAgent) setSuccessAgent(linkedAgent);
      queryClient.invalidateQueries({ queryKey: ["/api/buyer/my-agent"] });
      setTimeout(() => {
        setSuccessAgent(null);
        setQuery("");
        onClose();
      }, 2500);
    },
    onError: (err: Error) => {
      toast({ title: "Could not link agent", description: err.message, variant: "destructive" });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-display font-bold text-foreground">
            Find Your Agent
          </h2>
          <button 
            onClick={onClose}
            aria-label="Close agent search"
            className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {successAgent ? (
          <div className="p-8 text-center flex-1 flex flex-col items-center justify-center text-green-600 dark:text-green-500">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">Agent Linked!</h3>
            <p className="text-muted-foreground">
              {successAgent.firstName} is now your agent.
            </p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-border flex-shrink-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or brokerage..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-muted border-2 border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-amber-500 outline-none"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Your agent can also send you a direct invite link — ask them to invite you through Xucasa.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
              {debouncedQuery.length < 2 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Type at least 2 characters to search.
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No verified agents found for '{debouncedQuery}'
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.map(agent => (
                    <div key={agent.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center font-bold text-lg flex-shrink-0 overflow-hidden">
                        {agent.profileImageUrl ? (
                          <img src={agent.profileImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          agent.firstName?.[0]?.toUpperCase() || "A"
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm flex items-center gap-1.5 truncate">
                          {agent.firstName} {agent.lastName}
                          <BadgeCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-500 flex-shrink-0" />
                        </p>
                        {agent.brokerageName && (
                          <p className="text-xs text-muted-foreground truncate">{agent.brokerageName}</p>
                        )}
                        {agent.agentMlsId && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">MLS: {agent.agentMlsId}</p>
                        )}
                      </div>
                      <button
                        onClick={() => linkMutation.mutate(agent.id)}
                        disabled={linkMutation.isPending}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50"
                      >
                        {linkMutation.isPending && linkMutation.variables === agent.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                        ) : (
                          "Add as my agent"
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
