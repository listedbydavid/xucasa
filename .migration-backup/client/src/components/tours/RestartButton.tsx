import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { usePreview } from "@/lib/preview-context";
import ChangelogModal from "./ChangelogModal";

const PATH_TO_PAGE_KEY: Record<string, string> = {
  "/swipe": "swipe",
  "/search": "search",
  "/agent": "agent",
  "/dashboard": "dashboard",
  "/home-report": "home-report",
  "/onboarding": "onboarding",
};

function pageKeyForPath(path: string): string | null {
  if (PATH_TO_PAGE_KEY[path]) return PATH_TO_PAGE_KEY[path];
  if (path.startsWith("/property/")) return "property";
  return null;
}

export default function RestartButton() {
  const { isAuthenticated } = useAuth();
  const { isPreviewActive } = usePreview();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: unviewed } = useQuery<{ count: number }>({
    queryKey: ["/api/changelog/unviewed-count"],
    queryFn: async () => {
      const res = await fetch("/api/changelog/unviewed-count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const restartPage = useMutation({
    mutationFn: async (pageKey: string) => {
      const res = await apiRequest("POST", `/api/tours/progress/${encodeURIComponent(pageKey)}`, {
        currentStep: 0,
        completed: false,
        skipped: false,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tours/progress"] });
      window.location.reload();
    },
  });

  const restartAll = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tours/restart-all", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tours/progress"] });
      window.location.reload();
    },
  });

  if (!isAuthenticated) return null;
  const currentPageKey = pageKeyForPath(location);
  const hasUnviewed = (unviewed?.count ?? 0) > 0;

  return (
    <>
      <style>{`
        @keyframes xucasa-tour-dot-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
          50% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); }
        }
      `}</style>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`fixed ${isPreviewActive ? "bottom-36" : "bottom-6"} right-6 z-[9000] w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center`}
            style={{ animation: "xucasa-tour-dot-pulse 2.5s infinite" }}
            aria-label="Help and tours"
            data-testid="button-tour-restart"
          >
            <HelpCircle className="w-6 h-6" />
            {hasUnviewed && (
              <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-red-500 border-2 border-background" data-testid="badge-unviewed-changelog" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="end">
          {currentPageKey && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm"
              onClick={() => { setOpen(false); restartPage.mutate(currentPageKey); }}
              data-testid="button-restart-page-tour"
            >
              Restart page tour
            </button>
          )}
          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center justify-between"
            onClick={() => { setOpen(false); setChangelogOpen(true); }}
            data-testid="button-open-changelog"
          >
            <span>What's new</span>
            {hasUnviewed && <span className="w-2 h-2 rounded-full bg-red-500" />}
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm"
            onClick={() => { setOpen(false); restartAll.mutate(); }}
            data-testid="button-restart-all-tours"
          >
            Restart all tours
          </button>
        </PopoverContent>
      </Popover>
      <ChangelogModal open={changelogOpen} onOpenChange={setChangelogOpen} isAuthenticated={isAuthenticated} />
    </>
  );
}
