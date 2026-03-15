import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Check, CheckCheck, Archive, Trash2, Home, TrendingDown, Users, Calendar, Info, X } from "lucide-react";
import { Link } from "wouter";

const typeIcons: Record<string, typeof Home> = {
  new_listing: Home,
  price_drop: TrendingDown,
  agent_match: Users,
  open_house: Calendar,
  system: Info,
};

const typeColors: Record<string, string> = {
  new_listing: "bg-green-100 text-green-600",
  price_drop: "bg-orange-100 text-orange-600",
  agent_match: "bg-blue-100 text-blue-600",
  open_house: "bg-purple-100 text-purple-600",
  system: "bg-gray-100 text-gray-600",
};

function timeSince(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: notificationsList } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    enabled: isAuthenticated && open,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}`, { read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/notifications/mark-all-read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}`, { archived: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!isAuthenticated) return null;

  const unreadCount = countData?.count || 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        data-testid="button-notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-in zoom-in" data-testid="badge-notification-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in" data-testid="panel-notifications">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="font-bold text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                  data-testid="button-mark-all-read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[380px]">
            {!notificationsList || notificationsList.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <div>
                {notificationsList.map((n: any) => {
                  const Icon = typeIcons[n.type] || Info;
                  const colorClass = typeColors[n.type] || "bg-gray-100 text-gray-600";
                  return (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors group ${!n.read ? "bg-primary/5" : ""}`}
                      data-testid={`notification-item-${n.id}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm leading-tight ${!n.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                              {n.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">{timeSince(n.createdAt)}</p>
                          </div>
                          {!n.read && (
                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button
                              onClick={() => markReadMutation.mutate(n.id)}
                              className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                              data-testid={`button-read-${n.id}`}
                            >
                              <Check className="w-3 h-3 inline mr-0.5" />Read
                            </button>
                          )}
                          {n.linkUrl && (
                            <Link
                              href={n.linkUrl}
                              onClick={() => { markReadMutation.mutate(n.id); setOpen(false); }}
                              className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
                            >
                              View
                            </Link>
                          )}
                          <button
                            onClick={() => archiveMutation.mutate(n.id)}
                            className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                            data-testid={`button-archive-${n.id}`}
                          >
                            <Archive className="w-3 h-3 inline mr-0.5" />Archive
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(n.id)}
                            className="text-[10px] px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-500"
                            data-testid={`button-delete-notification-${n.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5 bg-muted/20">
            <Link
              href="/dashboard?section=notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline font-medium block text-center"
              data-testid="link-manage-notifications"
            >
              Manage all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
