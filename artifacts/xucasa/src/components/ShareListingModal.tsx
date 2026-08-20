import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Copy, Check, Share2, Loader2, Info } from "lucide-react";

export function ShareListingModal({ 
  propertyId, 
  isOpen, 
  onClose 
}: { 
  propertyId: number | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery<{ shareUrl: string }>({
    queryKey: ["/api/agent/listing-share-url", propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/agent/listing-share-url/${propertyId}`);
      if (!res.ok) throw new Error("Failed to get share url");
      return res.json();
    },
    enabled: isOpen && propertyId !== null,
  });

  const url = data?.shareUrl || "";

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleShare = async () => {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out this listing on Xucasa",
          url: url,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  if (!isOpen || !propertyId) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-display font-bold text-foreground">
            Share Listing
          </h2>
          <button 
            onClick={onClose}
            aria-label="Close share listing"
            className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : isError ? (
            <p className="py-6 text-center text-sm text-destructive">
              This share link could not be created. Confirm this is one of your listings and try again.
            </p>
          ) : (
            <>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-400 font-medium">
                  Anyone who views this listing through your link will see your contact info and be connected to you as their agent.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Shareable Link</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted border-2 border-border rounded-xl px-3 py-2.5 text-sm truncate font-medium text-foreground">
                    {url}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex justify-center items-center gap-2 border-2 border-border hover:bg-muted text-foreground font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 flex justify-center items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
