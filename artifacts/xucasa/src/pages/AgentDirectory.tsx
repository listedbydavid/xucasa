import { useState, useEffect } from "react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building, ShieldCheck, FileText, Users } from "lucide-react";
import { useGetAgentDirectory, getGetAgentDirectoryQueryKey } from "@workspace/api-client-react";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function AgentDirectory() {
  usePageMeta({ title: "Agent Directory", noIndex: true });
  const { isAuthenticated, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const pageSize = 24;

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearchTerm]);

  const { data, isLoading, error } = useGetAgentDirectory(
    { q: debouncedSearchTerm, limit: pageSize, offset },
    {
      query: {
        enabled: isAuthenticated && user?.role === "agent" && user.agentVerified === true,
        queryKey: getGetAgentDirectoryQueryKey({ q: debouncedSearchTerm, limit: pageSize, offset }),
      },
    },
  );

  if (!isAuthenticated || user?.role !== "agent" || !user.agentVerified) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-4">
        <ShieldCheck className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-display font-bold mb-4">Agent Directory Access</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          The agent directory is a professional network available only to verified agents on xucasa.
        </p>
        {!isAuthenticated ? (
          <Link href="/auth" className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform">
            Log In or Register
          </Link>
        ) : (
          <Link href="/agent" className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform">
            Go to Agent Portal
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-muted/30 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Agent Directory
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-8">
            Search verified professionals, view production history, and connect with peers across the xucasa network.
          </p>

          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, brokerage, or license..."
              className="pl-12 h-14 bg-background border-border text-lg rounded-2xl shadow-sm focus-visible:ring-primary"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {error ? (
          <div className="text-center py-16 bg-red-50 dark:bg-red-950/20 rounded-3xl border border-red-100 dark:border-red-900/30">
            <p className="text-red-600 dark:text-red-400 font-medium">Failed to load directory. Please try again later.</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card border border-border rounded-3xl p-6 h-48 animate-pulse" />
            ))}
          </div>
        ) : data?.agents?.length === 0 ? (
          <div className="text-center py-24 bg-card border border-border rounded-3xl">
            <Users className="w-16 h-16 text-muted-foreground opacity-40 mx-auto mb-4" />
            <h3 className="font-display font-bold text-2xl mb-2">No agents found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              We couldn't find any verified agents matching "{debouncedSearchTerm}".
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{data?.total || 0} Agents</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="group block bg-card border border-border rounded-3xl p-6 hover:shadow-lg hover:border-primary/30 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start gap-4">
                    {agent.profileImageUrl ? (
                      <img
                        src={agent.profileImageUrl}
                        alt={agent.displayName || "Agent"}
                        className="w-16 h-16 rounded-full object-cover border-2 border-background shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground border-2 border-background shadow-sm">
                        {agent.displayName?.[0] || "A"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                        {agent.displayName || "Unknown Agent"}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 truncate">
                        <Building className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{agent.brokerageName || "Independent"}</span>
                      </div>
                      {(agent.licenseNumber || agent.licenseState) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>DRE# {agent.licenseNumber || "—"} {agent.licenseState ? `(${agent.licenseState})` : ""}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-border grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {agent.currentListingsCount || 0}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                        Active
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {agent.salesYtdCount || 0}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                        Sold YTD
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {agent.salesFiveYearsCount || 0}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">
                        5 Yr Total
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {(offset > 0 || offset + pageSize < (data?.total || 0)) && (
              <div className="mt-10 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  disabled={offset === 0 || isLoading}
                  onClick={() => setOffset(current => Math.max(0, current - pageSize))}
                >
                  Previous
                </Button>
                <span className="text-sm font-medium text-muted-foreground">
                  {offset + 1}–{Math.min(offset + pageSize, data?.total || 0)} of {data?.total || 0}
                </span>
                <Button
                  variant="outline"
                  disabled={offset + pageSize >= (data?.total || 0) || isLoading}
                  onClick={() => setOffset(current => current + pageSize)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
