import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import queryString from "query-string";
import type { SearchCriteria, PropertyResponse, CreatePropertyRequest, UpdatePropertyRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// GET /api/properties
export function useProperties(filters?: SearchCriteria & { isOffMarket?: 'true' | 'false' }) {
  return useQuery<PropertyResponse[]>({
    queryKey: [api.properties.list.path, filters],
    queryFn: async () => {
      const url = filters && Object.keys(filters).length > 0 
        ? `${api.properties.list.path}?${queryString.stringify(filters)}` 
        : api.properties.list.path;
        
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    },
  });
}

// GET /api/properties/:id
export function useProperty(id: number | null) {
  return useQuery<PropertyResponse | null>({
    queryKey: [api.properties.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.properties.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch property");
      return res.json();
    },
    enabled: !!id,
  });
}

async function throwOnError(res: Response, fallback: string) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || fallback);
  }
  return res.json();
}

// POST /api/properties
export function useCreateProperty() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: CreatePropertyRequest) => {
      const res = await fetch(api.properties.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return throwOnError(res, "Failed to create property");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.properties.list.path] });
      toast({ title: "Property Listed", description: "Your property is now live!" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not create listing", description: err.message, variant: "destructive" });
    }
  });
}

// PUT /api/properties/:id
export function useUpdateProperty() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdatePropertyRequest) => {
      const url = buildUrl(api.properties.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      return throwOnError(res, "Failed to update property");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.properties.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.properties.get.path, variables.id] });
      toast({ title: "Property Updated", description: "Changes saved successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update listing", description: err.message, variant: "destructive" });
    }
  });
}

// DELETE /api/properties/:id
export function useDeleteProperty() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.properties.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete property");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.properties.list.path] });
      toast({ title: "Property Deleted", description: "The listing has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
}
