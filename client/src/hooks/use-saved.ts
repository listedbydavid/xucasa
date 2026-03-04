import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { SavedPropertyResponse, SavedSearchResponse, SearchCriteria, FavoriteList } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// ==========================================
// FAVORITE LISTS
// ==========================================

export function useFavoriteLists() {
  return useQuery<FavoriteList[]>({
    queryKey: ["/api/favorite-lists"],
    queryFn: async () => {
      const res = await fetch("/api/favorite-lists", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch favorite lists");
      }
      return res.json();
    },
  });
}

export function useCreateFavoriteList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/favorite-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create list");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorite-lists"] });
      toast({ title: "List Created", description: "Your new list is ready." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useRenameFavoriteList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(`/api/favorite-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to rename list");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorite-lists"] });
      toast({ title: "List Renamed" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteFavoriteList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/favorite-lists/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete list");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorite-lists"] });
      queryClient.invalidateQueries({ queryKey: [api.savedProperties.list.path] });
      toast({ title: "List Deleted", description: "Properties moved back to All Favorites." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useMovePropertyToList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ propertyId, listId }: { propertyId: number; listId: number | null }) => {
      const res = await fetch(`/api/saved-properties/${propertyId}/list`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to move property");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.savedProperties.list.path] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ==========================================
// SAVED PROPERTIES
// ==========================================

export function useSavedProperties() {
  return useQuery<SavedPropertyResponse[]>({
    queryKey: [api.savedProperties.list.path],
    queryFn: async () => {
      const res = await fetch(api.savedProperties.list.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
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
        const url = buildUrl(api.savedProperties.delete.path, { propertyId });
        const res = await fetch(url, { method: "DELETE", credentials: "include" });
        if (!res.ok) throw new Error("Failed to unsave property");
      } else {
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
