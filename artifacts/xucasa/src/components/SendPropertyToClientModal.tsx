import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { X, Search, Check, Loader2, Users } from "lucide-react";

export function SendPropertyToClientModal({
  propertyId,
  isOpen,
  onClose
}: {
  propertyId: number | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Use the agent's clients for selection
  const { data: clients = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/agent-clients"],
    queryFn: async () => {
      const res = await fetch("/api/agent-clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    enabled: isOpen,
  });

  const filteredClients = clients.filter(c => {
    const search = debouncedQuery.toLowerCase();
    const name = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
    return name.includes(search) || (c.email || "").toLowerCase().includes(search);
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("Select a client");
      if (!propertyId) throw new Error("No property selected");
      const res = await apiRequest("POST", "/api/agent/send-listing", {
        clientUserId: selectedClient.id,
        propertyId: propertyId,
        note: note.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-clients", selectedClient?.id, "favorites"] });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setQuery("");
        setSelectedClient(null);
        setNote("");
        onClose();
      }, 2500);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Failed to send listing.");
    },
  });

  if (!isOpen || !propertyId) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-display font-bold text-foreground">
            Send Listing to Client
          </h2>
          <button 
            onClick={onClose}
            className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {success ? (
          <div className="p-8 text-center flex-1 flex flex-col items-center justify-center text-green-600 dark:text-green-500">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">Sent!</h3>
            <p className="text-muted-foreground">{selectedClient?.firstName} will see this in their saved homes.</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search your clients..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full bg-muted border-2 border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-primary outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No clients found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredClients.map(c => {
                    const isSelected = selectedClient?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedClient(c);
                          setErrorMsg("");
                        }}
                        className={`flex gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                          isSelected 
                            ? "border-primary bg-primary/10" 
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <p className="font-bold text-foreground text-sm truncate">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                        </div>
                        {isSelected && (
                          <div className="flex items-center justify-center pr-2">
                            <Check className="w-5 h-5 text-primary" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex-shrink-0 bg-card">
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                Personal Note (optional)
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 200))}
                placeholder="Add a personal note..."
                className="w-full bg-background border-2 border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none resize-none h-20 mb-1"
              />
              <div className="text-right text-xs text-muted-foreground mb-3">
                {note.length} / 200
              </div>
              
              {errorMsg && (
                <div className="text-destructive text-sm font-semibold mb-3 p-3 bg-destructive/10 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={() => sendMutation.mutate()}
                disabled={!selectedClient || sendMutation.isPending}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Send to {selectedClient ? selectedClient.firstName : "Client"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}