import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Database,
  AlertCircle, ExternalLink, Loader2, Zap,
} from "lucide-react";

interface SyncLog {
  id: number;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "success" | "error";
  added: number;
  updated: number;
  removed: number;
  total: number;
  error: string | null;
}

interface IdxStatus {
  configured: boolean;
  inProgress: boolean;
  last: SyncLog | null;
  logs: SyncLog[];
  idxCount: number;
}

export function IdxSyncPanel() {
  const { data: status, isLoading, refetch } = useQuery<IdxStatus>({
    queryKey: ["/api/idx/status"],
    refetchInterval: (query) => {
      // Poll every 5s while a sync is running
      return query.state.data?.inProgress ? 5000 : false;
    },
  });

  const { mutate: triggerSync, isPending: isTriggeringSync } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/idx/sync"),
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/idx/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
        refetch();
      }, 1500);
    },
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  };

  const statusIcon = (s: SyncLog["status"]) => {
    if (s === "running") return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    if (s === "success") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    return <XCircle className="w-4 h-4 text-destructive" />;
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 animate-pulse">
        <div className="h-5 bg-muted rounded w-40 mb-4" />
        <div className="h-16 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">MLS / IDX Sync</h3>
            <p className="text-xs text-muted-foreground">Live listings from IDX Broker</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status?.configured && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Connected
            </span>
          )}
          {!status?.configured && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" />
              Not configured
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Not configured state */}
        {!status?.configured && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="font-bold text-amber-900 text-sm">Activate IDX Broker sync</p>
            <ol className="text-sm text-amber-800 space-y-1.5 list-decimal list-inside">
              <li>Sign up at <a href="https://idxbroker.com" target="_blank" rel="noopener noreferrer" className="underline font-bold inline-flex items-center gap-0.5">idxbroker.com <ExternalLink className="w-3 h-3" /></a></li>
              <li>Get MLS approval through your broker</li>
              <li>Copy your API key from: <strong>Account → API → Access Key</strong></li>
              <li>Add it as the environment secret <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">IDX_BROKER_API_KEY</code></li>
              <li>Restart the server — sync runs automatically every 4 hours</li>
            </ol>
            <p className="text-xs text-amber-700">
              Using RESO Web API instead? Set <code className="bg-amber-100 px-1 rounded font-mono">IDX_RESO_URL</code> and <code className="bg-amber-100 px-1 rounded font-mono">IDX_RESO_TOKEN</code>.
            </p>
          </div>
        )}

        {/* Stats row */}
        {status?.configured && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{status.idxCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">MLS Listings</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-foreground">
                {status.last?.status === "success" ? `+${status.last.added}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Last Added</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-foreground mt-1">
                {status.last ? formatDate(status.last.completedAt || status.last.startedAt) : "Never"}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Last Sync</p>
            </div>
          </div>
        )}

        {/* Sync trigger */}
        {status?.configured && (
          <button
            onClick={() => triggerSync()}
            disabled={isTriggeringSync || status.inProgress}
            data-testid="button-trigger-idx-sync"
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {status.inProgress || isTriggeringSync
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</>
              : <><Zap className="w-4 h-4" /> Sync Now</>
            }
          </button>
        )}

        {/* Recent sync log */}
        {status?.logs && status.logs.length > 0 && (
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Syncs</p>
            <div className="space-y-2">
              {status.logs.map(log => (
                <div key={log.id} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-0.5 flex-shrink-0">{statusIcon(log.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground capitalize">{log.status}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(log.startedAt)}</span>
                    </div>
                    {log.status === "success" && (
                      <p className="text-xs text-muted-foreground">
                        {log.total.toLocaleString()} total · +{log.added} added · {log.updated} updated · {log.removed} removed
                      </p>
                    )}
                    {log.status === "error" && (
                      <p className="text-xs text-destructive line-clamp-2">{log.error}</p>
                    )}
                    {log.status === "running" && (
                      <p className="text-xs text-blue-600">In progress…</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Syncs automatically every 4 hours when configured. Listings removed from MLS are marked inactive automatically.
        </p>
      </div>
    </div>
  );
}
