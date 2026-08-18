import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type ChangelogEntry = {
  id: number;
  version: string;
  title: string;
  description: string;
  category: string | null;
  publishedAt: string;
};

type ChangelogModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
};

export default function ChangelogModal({ open, onOpenChange, isAuthenticated }: ChangelogModalProps) {
  const queryClient = useQueryClient();
  const { data: entries } = useQuery<ChangelogEntry[]>({
    queryKey: ["/api/changelog"],
    queryFn: async () => {
      const res = await fetch("/api/changelog");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const markViewed = useMutation({
    mutationFn: async (version: string | null) => {
      const res = await apiRequest("POST", "/api/changelog/viewed", { version });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changelog/unviewed-count"] });
    },
  });

  useEffect(() => {
    if (open && isAuthenticated && entries && entries.length > 0) {
      markViewed.mutate(entries[0].version);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated, entries?.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="changelog-modal">
        <DialogHeader>
          <DialogTitle>What's new in xucasa</DialogTitle>
          <DialogDescription>Recent updates and new features.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {entries?.map((entry) => (
            <div key={entry.id} className="border-l-2 border-amber-500 pl-4" data-testid={`changelog-entry-${entry.version}`}>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">{entry.version}</Badge>
                {entry.category && (
                  <Badge className="text-xs bg-amber-500 hover:bg-amber-600">{entry.category}</Badge>
                )}
              </div>
              <h3 className="font-medium text-base">{entry.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
            </div>
          ))}
          {entries && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No updates yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
