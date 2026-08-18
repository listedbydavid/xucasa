import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

type HelpTooltipProps = {
  content: string;
  tipKey?: string;
};

export default function HelpTooltip({ content, tipKey }: HelpTooltipProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: dismissed } = useQuery<string[]>({
    queryKey: ["/api/tips/dismissed"],
    queryFn: async () => {
      const res = await fetch("/api/tips/dismissed", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tipKey && isAuthenticated,
    staleTime: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      if (!tipKey) return null;
      const res = await apiRequest("POST", "/api/tips/dismiss", { tipKey });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tips/dismissed"] });
    },
  });

  if (tipKey && isAuthenticated && dismissed?.includes(tipKey)) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Help"
            data-testid={tipKey ? `help-tooltip-${tipKey}` : "help-tooltip"}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{content}</p>
          {tipKey && isAuthenticated && (
            <button
              onClick={() => dismiss.mutate()}
              className="mt-2 text-xs underline text-amber-500 hover:text-amber-400"
              data-testid={`button-dismiss-help-${tipKey}`}
            >
              Don't show again
            </button>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
