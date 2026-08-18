import { useLocation } from "wouter";
import { Eye, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { usePreview, type PreviewRole } from "@/lib/preview-context";

const ROLE_LABELS: Record<NonNullable<PreviewRole>, string> = {
  buyer: "Buyer",
  homeowner: "Homeowner",
  agent: "Agent",
  explorer: "Explorer",
};

const ROLE_DESTINATIONS: Record<NonNullable<PreviewRole>, string> = {
  buyer: "/swipe",
  homeowner: "/home-report",
  agent: "/agent",
  explorer: "/swipe",
};

const ROLE_COLORS: Record<NonNullable<PreviewRole>, string> = {
  buyer: "bg-blue-500",
  homeowner: "bg-green-500",
  agent: "bg-purple-500",
  explorer: "bg-gray-500",
};

export function AdminPreviewBar() {
  const { user, isAuthenticated } = useAuth();
  const { previewRole, setPreviewRole } = usePreview();
  const [, navigate] = useLocation();

  const isAdmin = isAuthenticated && Boolean((user as any)?.isAdmin);
  if (!isAdmin) return null;

  const handleActivate = (role: NonNullable<PreviewRole>) => {
    setPreviewRole(role);
    navigate(ROLE_DESTINATIONS[role]);
  };

  const handleExit = () => {
    setPreviewRole(null);
    navigate("/admin");
  };

  if (!previewRole) {
    return (
      <div className="fixed bottom-20 right-4 z-[9100]" data-testid="admin-preview-launcher">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="bg-slate-800 hover:bg-slate-700 text-white shadow-lg gap-2 rounded-full px-4"
              data-testid="button-preview-as"
            >
              <Eye className="w-4 h-4" />
              Preview as...
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {(Object.keys(ROLE_LABELS) as NonNullable<PreviewRole>[]).map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => handleActivate(role)}
                className="gap-2 cursor-pointer"
                data-testid={`button-preview-${role}`}
              >
                <span className={`w-2 h-2 rounded-full ${ROLE_COLORS[role]}`} />
                {ROLE_LABELS[role]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 z-[100] ${ROLE_COLORS[previewRole]} text-white shadow-md`}
        data-testid="admin-preview-banner"
      >
        <div className="flex items-center justify-between px-4 py-2 max-w-7xl mx-auto gap-2">
          <div className="flex items-center gap-2 text-sm font-medium min-w-0">
            <Eye className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              Admin Preview — viewing as <strong>{ROLE_LABELS[previewRole]}</strong>
            </span>
            <span className="opacity-75 text-xs hidden sm:inline">(your account is unchanged)</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExit}
            className="text-white hover:bg-white/20 gap-1 h-7 text-xs flex-shrink-0"
            data-testid="button-exit-preview-top"
          >
            <X className="w-3 h-3" />
            <span className="hidden sm:inline">Exit Preview → Back to Admin</span>
            <span className="sm:hidden">Exit</span>
          </Button>
        </div>
      </div>

      <div className="fixed bottom-20 right-4 z-[9100]">
        <Button
          size="sm"
          onClick={handleExit}
          className="bg-slate-800 hover:bg-slate-700 text-white shadow-lg gap-2 rounded-full px-4"
          data-testid="button-exit-preview-floating"
        >
          <X className="w-4 h-4" />
          Exit Preview
        </Button>
      </div>
    </>
  );
}
