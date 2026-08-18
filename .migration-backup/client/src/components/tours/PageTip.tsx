import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Info, X } from "lucide-react";

type PageTipProps = {
  tipKey: string;
  children: React.ReactNode;
  isAuthenticated: boolean;
};

export default function PageTip({ tipKey, children, isAuthenticated }: PageTipProps) {
  const queryClient = useQueryClient();
  const { data: dismissed } = useQuery<string[]>({
    queryKey: ["/api/tips/dismissed"],
    queryFn: async () => {
      const res = await fetch("/api/tips/dismissed", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tips/dismiss", { tipKey });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tips/dismissed"] });
    },
  });

  if (isAuthenticated && dismissed?.includes(tipKey)) return null;

  return (
    <div
      className="relative flex gap-3 items-start rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 pr-9 text-sm"
      data-testid={`page-tip-${tipKey}`}
    >
      <Info className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <div className="flex-1 text-amber-900 dark:text-amber-100">{children}</div>
      {isAuthenticated && (
        <button
          onClick={() => dismiss.mutate()}
          className="absolute top-2 right-2 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
          aria-label="Dismiss tip"
          data-testid={`button-dismiss-tip-${tipKey}`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
