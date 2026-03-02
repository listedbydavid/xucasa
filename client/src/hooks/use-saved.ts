import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { SavedPropertyResponse, SavedSearchResponse, SearchCriteria } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// ==========================================
// SAVED PROPERTIES
// ==========================================

export function useSavedProperties() {
  return useQuery<SavedPropertyResponse[]>({
    queryKey: [api.savedProperties.list.path],
    queryFn: async () => {
      const res = await fetch(api.savedProperties.list.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return []; // Not logged in, return empty
        throw new Error("Failed to fetch saved properties");
      }
      return res.json();
    },
  });
}

export function useToggleSavedProperty() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ propertyId, isSaved }: { propertyId: number, isSaved: boolean }) => {
      if (isSaved) {
        // Delete
        const url = buildUrl(api.savedProperties.delete.path, { propertyId });
        const res = await fetch(url, { method: "DELETE", credentials: "include" });
        if (!res.ok) throw new Error("Failed to unsave property");
      } else {
        // Create
        const res = await fetch(api.savedProperties.create.path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId }),
          credentials: "include",
        });
        if (!res.ok) {
          if (res.status === 401) throw new Error("Please log in to save properties.");
          throw new Error("Failed to save property");
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [api.savedProperties.list.path] });
      toast({ 
        title: vars.isSaved ? "Removed from Saved" : "Property Saved!", 
        description: vars.isSaved ? "Property removed from your favorites." : "Added to your dashboard.",
        variant: "default"
      });
    },
    onError: (err) => {
      toast({ title: "Action Failed", description: err.message, variant: "destructive" });
    }
  });
}

// ==========================================
// SAVED SEARCHES
// ==========================================

export function useSavedSearches() {
  return useQuery<SavedSearchResponse[]>({
    queryKey: [api.savedSearches.list.path],
    queryFn: async () => {
      const res = await fetch(api.savedSearches.list.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch saved searches");
      }
      return res.json();
    },
  });
}

export function useCreateSavedSearch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: { name: string, criteria: SearchCriteria }) => {
      const res = await fetch(api.savedSearches.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please log in to save searches.");
        throw new Error("Failed to save search");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.savedSearches.list.path] });
      toast({ title: "Search Saved", description: "You can find it in your dashboard." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.savedSearches.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete search");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.savedSearches.list.path] });
      toast({ title: "Deleted", description: "Saved search removed." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
}
